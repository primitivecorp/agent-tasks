/*
Copyright 2026 Primitive Instruments Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package convergence

import (
	"errors"
	"time"
)

// Bounds shared by the controller and the executors (section 11.8).
const (
	// MaxEvidenceInline caps the evidence excerpt stored on a gate.
	MaxEvidenceInline = 4096
	// MaxChangedPaths caps the changed-path set an executor may report before
	// it must set ChangedPathsTruncated.
	MaxChangedPaths = 2048
	// LineageSampleMax caps the changed-path sample kept per SnapshotRecord.
	LineageSampleMax = 16
)

// Sentinel errors (section 11.8). Every error the package returns wraps one
// of these, so callers test with errors.Is.
var (
	// ErrUnknownStep: the result names a step that is not in the plan.
	ErrUnknownStep = errors.New("convergence: unknown step")
	// ErrAttemptReplay: the result's Attempt is not the stored count plus one.
	ErrAttemptReplay = errors.New("convergence: execution attempt replay")
	// ErrStaleInput: the result's input snapshot is not the current snapshot.
	ErrStaleInput = errors.New("convergence: stale input snapshot")
	// ErrGateMutation: a gate reported a result snapshot that differs from
	// its input snapshot.
	ErrGateMutation = errors.New("convergence: gate mutated the workspace")
	// ErrInvariant: the view violates an internal invariant.
	ErrInvariant = errors.New("convergence: invariant violated")
	// ErrInvalidPlan: Plan.Validate found a defect in the plan.
	ErrInvalidPlan = errors.New("convergence: invalid plan")
	// ErrInvalidBudgets: Budgets.Validate found a non-positive budget.
	ErrInvalidBudgets = errors.New("convergence: invalid budgets")
)

// StepKind separates the steps that mutate the workspace from the steps
// that assert properties of it.
type StepKind string

// The two step kinds.
const (
	Action StepKind = "Action"
	Gate   StepKind = "Gate"
)

// GateResult is a gate's recorded verdict. The zero value counts as Unknown.
type GateResult string

// The four gate results.
const (
	Unknown GateResult = "Unknown"
	Passed  GateResult = "Passed"
	Failed  GateResult = "Failed"
	Errored GateResult = "Errored"
)

// Plan is the resolved, immutable input. Admission builds it once per task
// (section 4) and it never changes while the task runs.
type Plan struct {
	// Driver names the one authored Action step.
	Driver string
	// Steps are in topological order of `after`, ties by declaration order.
	// Fix actions are not in this slice. They hang off their gates.
	Steps []Step
}

// Step is one resolved plan step.
type Step struct {
	Name string
	Kind StepKind
	// Blocking applies to gates only.
	Blocking bool
	// InvalidatedBy applies to gates only. Admission defaults it to ["**"].
	InvalidatedBy []string
	// FixAction applies to gates only. Synthesized with Name "<gate>@fix".
	FixAction *Step
	// Injected marks a required gate the policy added as "<name>@policy".
	Injected bool
}

// View is the bounded working state of one task (section 2.3).
type View struct {
	CurrentSnapshot string
	// Lineage is seeded with the base snapshot (section 11.4, R4).
	Lineage []SnapshotRecord
	// Oscillation is sticky once set.
	Oscillation bool

	// Gates holds one entry per Gate step, keyed by step name.
	Gates map[string]GateState
	// Actions holds the driver and every synthesized "<gate>@fix".
	Actions map[string]ActionState

	DriverRuns int
	Spend      Spend
}

// GateState is the recorded state of one gate.
type GateState struct {
	Result           GateResult
	VerifiedSnapshot string
	// Evidence is a capped excerpt.
	Evidence    string
	EvidenceRef string
	// FailureCount is observability only. No control flow reads it.
	FailureCount int
	// FixAttemptedAt is the INPUT snapshot of the most recent fix attempt.
	FixAttemptedAt string
	// FixAttempts counts fix attempts over the gate's lifetime.
	FixAttempts int
	// InfraRetries counts consecutive Errored executions. Only a success of
	// this step resets it.
	InfraRetries int
	// ExecutionAttempt counts completed (folded) executions of this step.
	ExecutionAttempt int
}

// ActionState is the recorded state of one action.
type ActionState struct {
	Completions  int
	LastSnapshot string
	// InfraRetries counts consecutive Errored executions. Only a success
	// resets it.
	InfraRetries     int
	ExecutionAttempt int
}

// SnapshotRecord is one entry of the lineage.
type SnapshotRecord struct {
	Snapshot     string
	Parent       string
	FilesChanged int
	LinesChanged int
	// PathsSample holds at most LineageSampleMax entries.
	PathsSample []string
	PathCount   int
}

// Spend is what the task has consumed so far.
type Spend struct {
	Tokens int64
	// ActiveRuntime is maintained by the caller. It accumulates from
	// Provisioned and pauses while Suspended.
	ActiveRuntime time.Duration
}

// Budgets bounds a task. Every field must be positive (R6).
type Budgets struct {
	Tokens             int64
	WallClock          time.Duration
	MaxDriverRuns      int
	FixAttemptsPerGate int
	InfraRetries       int
}

// ExecStatus is how an execution ended.
type ExecStatus string

// The three execution statuses. The spec names them Completed, Errored, and
// Canceled (section 11.2). The Exec prefix exists because Errored is also a
// GateResult, and Go allows one Errored per package. The string values are
// unchanged.
const (
	// ExecCompleted: the step ran to a verdict. Actions did work; gates
	// produced Passed or Failed.
	ExecCompleted ExecStatus = "Completed"
	// ExecErrored: infrastructure failure, no verdict.
	ExecErrored ExecStatus = "Errored"
	// ExecCanceled: suspend or deletion, no verdict.
	ExecCanceled ExecStatus = "Canceled"
)

// Trigger says why an execution was scheduled.
type Trigger string

// The three triggers.
const (
	Initial     Trigger = "Initial"
	GateFailure Trigger = "GateFailure"
	FixTrigger  Trigger = "FixAction"
)

// ExecutionResult is what Fold consumes: one finished execution.
type ExecutionResult struct {
	// StepName is a plan step name or "<gate>@fix".
	StepName string
	Kind     StepKind
	Trigger  Trigger
	// TriggerGate names the gate for GateFailure and FixAction triggers.
	TriggerGate   string
	InputSnapshot string
	// Attempt MUST equal the stored ExecutionAttempt plus one (R5).
	Attempt int

	Status ExecStatus
	// GateResult applies to gates with Status Completed.
	GateResult GateResult
	ExitReason string

	// The fields below apply to actions with Status Completed.
	ResultSnapshot        string
	ChangedPaths          []string
	ChangedPathsTruncated bool
	ChangedPathCount      int

	Evidence    string
	EvidenceRef string
	TokensIn    int64
	TokensOut   int64
	Turns       int
}

// ActionType is what Decide asks the controller to do next.
type ActionType string

// The four decision types.
const (
	RunAction ActionType = "RunAction"
	RunGate   ActionType = "RunGate"
	Escalate  ActionType = "Escalate"
	Done      ActionType = "Done"
)

// Decision is what Decide returns. The spec's prose calls it Action; the
// code uses Decision because Action is a StepKind.
type Decision struct {
	Type ActionType
	// StepName is a plan step or "<gate>@fix".
	StepName string
	Trigger  Trigger
	// Failures is a list by schema. Phase 1 carries at most one entry.
	Failures []FailureContext
	Reason   EscalateReason
}

// FailureContext is the evidence a driver run receives for one failed gate.
type FailureContext struct {
	Gate        string
	Evidence    string
	EvidenceRef string
}

// EscalateReason names the bound that ended the task.
type EscalateReason string

// The five escalation reasons (section 2.5).
const (
	ReasonOscillation EscalateReason = "oscillation"
	ReasonWallClock   EscalateReason = "wall-clock"
	ReasonTokenBudget EscalateReason = "token-budget"
	ReasonInfra       EscalateReason = "infra"
	ReasonDriverRuns  EscalateReason = "driver-runs"
)

// NewView returns the initial view for a task (section 11.4, R4): the base
// snapshot is current and seeds the lineage, every gate is Unknown, and
// every action, the driver and each fix action, is at zero. The plan must
// have passed Validate.
func NewView(baseSnapshot string, plan Plan) View {
	v := View{
		CurrentSnapshot: baseSnapshot,
		Lineage:         []SnapshotRecord{{Snapshot: baseSnapshot}},
		Gates:           make(map[string]GateState),
		Actions:         make(map[string]ActionState),
	}
	for _, step := range plan.Steps {
		switch step.Kind {
		case Gate:
			v.Gates[step.Name] = GateState{Result: Unknown}
			if step.FixAction != nil {
				v.Actions[step.FixAction.Name] = ActionState{}
			}
		case Action:
			v.Actions[step.Name] = ActionState{}
		}
	}
	return v
}
