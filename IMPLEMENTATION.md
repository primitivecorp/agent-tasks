# agent-tasks — Phase 1 Implementation Specification (v2)

Kubernetes-native task orchestration for autonomous coding agents.

Repository: `github.com/primitivecorp/agent-tasks`
API group: `agents.primitive.dev/v1alpha1`
License: Apache-2.0

Revision v2.2. Supersedes the v1 specification. Appendix A maps every change
back to its rationale, including the post-review revisions. Appendix B
reserves the concepts deliberately deferred out of Phase 1. The executable
contract and test matrix for the pure core live in `CONVERGENCE.md`.

---

## 1. What this system does

A ticket enters the system. An agent writes code in an isolated sandbox. A set
of verification gates run repeatedly as the code changes. When every gate holds
against a single snapshot of the workspace, the change is pushed and a pull
request is opened.

The model in one paragraph:

> Kubernetes reconciles the task. Actions mutate the workspace, producing
> immutable snapshots. Gates verify snapshots and produce evidence. The ledger
> remembers which gate results are still valid. `NextAction` chooses the next
> mutation or verification until every blocking gate holds for one snapshot
> under one immutable resolved plan — or a bounded termination condition fires.

The system is **not** a DAG execution engine. Gate results are keyed by
workspace snapshot and invalidated when the snapshot changes. Execution order
is derived from ledger state at each reconcile, not authored as a pipeline.

### 1.1 The Phase 1 promise

Phase 1 is deliberately small. Given a **single task**, a **single candidate**,
and an **immutable resolved plan**, the operator repeatedly executes idempotent
actions and verification gates until all blocking gates hold for one immutable
snapshot, or a bounded termination condition fires.

Phase 1 proves five things, and nothing else is required to prove the paradigm:

1. **Deterministic resolution** — a task admits against exactly one pinned,
   fully resolved plan.
2. **Crash-safe execution** — every execution is idempotent; the controller
   can crash at any point without duplicating or losing work.
3. **Invalidation correctness** — gate results carry forward only under
   explicitly declared, safe rules.
4. **Pure convergence decisions** — the decision function is I/O-free and
   exhaustively unit-testable.
5. **Bounded termination** — every task reaches `Succeeded` or `Failed` in
   bounded work.

Phase 1 has no external runtime dependencies: no sandbox runtime, no LLM, no
git remote, no database, no issue tracker, **and no admission webhooks**.
`kubectl apply` a task and it converges against scripted gate results.

### 1.2 Phase 1 deliverables

- Five CRDs with full schemas, CEL validation rules, and print columns
- The gate-state view (the ledger's bounded materialization) and the pure
  `Fold`/`Decide` convergence functions
- The `AgentTask` and `AgentStep` controllers
- The `Ensure`-based executor interface and a fake executor producing scripted
  results
- Work-namespace lifecycle: creation, network-policy/quota materialization,
  release on success, retention on failure, finalizer teardown on deletion

### 1.3 Cut from Phase 1

Multi-candidate execution, `FanOut`, parallel gate execution, findings
resolution, tracker connectors and workflow auto-selection, merge policies,
sampled audit, Kueue admission, catalog dependencies, the diff-size ratchet,
diff-scoped gates, elicitation/questions, the `Retry` escalation policy, the
Postgres projection, the read API, the web UI, real executors, and the git
broker. None of these answers the Phase 1 question. Appendix B records the
reserved semantics so later phases do not have to rediscover them.

---

## 2. Core model

### 2.1 Definitions

| Term | Definition |
|---|---|
| Snapshot | Immutable content identity of the workspace at a point in time. `snapshotID` = git tree hash (submodule and LFS pointers are part of tree content). Written `h`. |
| Action | A step that may mutate the workspace. Completing an Action produces a new snapshot or leaves the snapshot unchanged. An Action has run-state, never validity: it is not "green forever", it either has completed or it has not. |
| Gate | A step that evaluates a snapshot and returns `Passed`, `Failed`, or `Errored`, plus evidence. A Gate never mutates the workspace. |
| Driver | The one Action step designated by the workflow as the agent that does the work. It runs once at task start and again whenever a failed gate needs a fix that no cheaper fix Action resolved. |
| Fix Action | An ordinary Action class referenced by a Gate class (`fixAction`). Plan resolution synthesizes it into a first-class resolved Action with identity `<gate>@fix` (§4), owning its own state and execution names, excluded from the topological walk. Tried once per snapshot before spending a driver run. |
| Ledger | Conceptually, the partial function `(gate, gateKey) → result + evidence`. Its Kubernetes representation is the bounded **gate-state view** (§2.3), not an append-only log. |
| Gate key | `hash(snapshotID, resolvedClassSpecHash)` — changing the verifier invalidates its old results. Within one task the plan is pinned, so the key degenerates to `snapshotID`; the structure exists for cross-task reuse later. |
| Resolved plan | The complete, immutable, executable interpretation of the task: workflow, policy, every referenced class, injected required gates, budgets. Pinned at admission (§4). |
| Convergence | Every blocking gate `Passed` with `verifiedSnapshot == currentSnapshot`, every Action step completed at least once — the driver included. |

Actions mutate state. Gates assert properties of state. Everything in the
model follows from keeping those two apart.

### 2.2 Invalidation

Each workflow **gate** step declares `invalidatedBy`, a list of path globs.

**The default is `["**"]`: any change invalidates.** Carry-forward is an
explicit, opt-in optimization declared with narrower globs. This direction is
deliberate: a false carry-forward is a correctness and security bug; an
unnecessary revalidation is merely expensive.

When an Action completes and produces `h'` from `h` with changed path set `P`:

```
for each gate g with a recorded result:
    if P ∩ glob(g.invalidatedBy) == ∅:
        g.verifiedSnapshot = h'          # re-stamp: result carries forward
    else:
        g.result = Unknown               # cleared; Unknown is what schedules it
```

Re-stamping is what keeps the convergence check uniform: `Done` compares every
blocking gate's `verifiedSnapshot` against `currentSnapshot`, and carry-forward
is the act of moving that stamp.

Two hard rules:

- If the executor reports the changed path set as **truncated** (§5.3), treat
  it as `["**"]`: clear every gate. Over-invalidation is always safe.
- Actions never carry forward. They have completions, not validity.

A rebase is an ordinary snapshot change and follows the same rule (no rebase
exists in Phase 1 — the base ref never moves — but the rule is stated so
Phase 2 inherits it unchanged; see Appendix B on diff-scoped gates).

### 2.3 State: the gate-state view

`AgentTask.status` holds the **bounded working set required to reconcile**,
never exhaustive provenance. Full history is a later phase's projection
(Postgres), off the reconcile path.

```go
// Sketch of the status view. Exact API types in §3.4.

type View struct {
    CurrentSnapshot string
    Lineage         []SnapshotRecord // full hash chain — see bound below
    Oscillation     bool             // set by Fold, read by Decide

    Gates   map[string]GateState     // keyed by resolved step name
    Actions map[string]ActionState   // keyed by resolved action name —
                                     // synthesized `<gate>@fix` entries included

    DriverRuns int                   // every driver completion, initial included
    Spend      Spend                 // tokens + accumulated ACTIVE runtime:
                                     // starts at Provisioned, pauses Suspended
}

type GateState struct {
    Result           string // Unknown | Passed | Failed | Errored
    VerifiedSnapshot string
    EvidenceRef      string
    Evidence         string // inline excerpt, capped (§5.3)
    FailureCount     int    // observability only
    FixAttemptedAt   string // INPUT snapshot of the most recent fix attempt
                            // for this gate — written by Fold, read by Decide
    FixAttempts      int    // lifetime, bounded by budgets.fixAttemptsPerGate
    InfraRetries     int    // CONSECUTIVE Errored executions; reset to 0 by
                            // any successful execution of this step
    ExecutionAttempt int    // completed executions; next name uses +1
}

type ActionState struct {
    Completions      int
    LastSnapshot     string // snapshot the last completion produced
    InfraRetries     int    // consecutive Errored executions; reset on success
    ExecutionAttempt int
}
```

Rules that make the view sufficient and bounded:

- **Counters are stored, never derived.** `ExecutionAttempt` feeds the
  deterministic AgentStep name (§3.5); it cannot be reconstructed by counting
  history that may have been evicted, so it is an explicit field, incremented
  exactly once per folded execution.
- **Lineage appends only when the snapshot actually changes.** A no-op Action
  (formatter with nothing to fix) records a completion and appends nothing.
- **Lineage is kept in full, and is bounded anyway.** Every new snapshot costs
  a driver or fix-action attempt, and both are capped, so the full chain is at
  most a few dozen entries. Windowing it would reintroduce an oscillation
  blind spot for zero savings. Each `SnapshotRecord` stores the hash, parent
  hash, files/lines changed, and a changed-path *sample* (≤ 16 paths plus a
  total count) — the full path set is consumed at fold time and not persisted.
- Evidence is persisted as a capped inline excerpt plus an opaque ref; the
  durable evidence store is a later phase.

### 2.4 Fold and Decide: the pure core

`internal/convergence` is plain Go with no Kubernetes imports. It exposes two
pure functions, and they are the primary unit-test target. This section is
the semantic overview; the executable contract — exact types, comparisons,
edge-case rulings, and the full test matrix — lives in `CONVERGENCE.md`,
which is normative for the implementation:

```go
// Fold applies one completed execution to the view: adopts the result
// snapshot, appends lineage, applies invalidation (§2.2), updates counters
// and spend, and sets the oscillation flag.
func Fold(v View, r ExecutionResult) View

// Decide returns the single next action for the current view.
// It performs no I/O and never sees Kubernetes objects.
func Decide(plan Plan, v View, b Budgets) Action

type Action struct {
    Type     ActionType // RunAction | RunGate | Escalate | Done
    StepName string
    Trigger  Trigger    // Initial | GateFailure | FixAction
    // For driver runs triggered by failures. A LIST so that one driver
    // invocation can address multiple failures when parallel gates arrive
    // in a later phase; Phase 1's serial walk yields exactly one entry.
    Failures []FailureContext // {gate, evidenceRef, evidence excerpt}
    Reason   string           // for Escalate
}
```

The controller is a thin shell around these two functions: it feeds completed
`AgentStep` results into `Fold`, persists the view, calls `Decide`, and
materializes the returned action. Single-flight is the controller's invariant,
not `Decide`'s concern: `Decide` is only consulted when no execution is
active.

**Fold**, on an Action completion producing `h'` from current `h`:

1. If `h' == h`: record the completion; no lineage append; no invalidation.
   A no-op mutation is normal and is **not** oscillation.
2. If `h' != h`: if `h'` equals any lineage entry other than `h` (a non-parent
   ancestor), set `Oscillation` — the workspace has returned to an earlier
   state, the loop is cycling. Then append `h'`, adopt it as current, and
   apply invalidation with the changed path set.
3. Increment the step's `ExecutionAttempt`, the action's `Completions`,
   `DriverRuns` if the step is the driver, and spend; reset the step's
   `InfraRetries` to 0. If the trigger was `FixAction`: increment
   `FixAttempts` on the attributed gate **and set its `FixAttemptedAt` to the
   execution's INPUT snapshot** — the input, not the result. A no-op fixer
   leaves the snapshot unchanged and the gate still `Failed`, and it is
   exactly `FixAttemptedAt == currentSnapshot` that stops `Decide` from
   scheduling the same fixer again and moves the gate to the driver.

**Fold**, on a Gate completion: record `{result, verifiedSnapshot = input
snapshot, evidence}`; increment `ExecutionAttempt`, `FailureCount` on a
failure, and spend; reset the gate's `InfraRetries` to 0 — the infra bound
counts consecutive failures to perform a step, not lifetime bad luck.
Single-flight guarantees the input snapshot is still current.

**Fold**, on an `Errored` execution of either kind: increment the step's
`ExecutionAttempt` and `InfraRetries`; gates record the `Errored` result;
actions record no completion. Retry happens naturally — the gate is
re-schedulable and the action is still incomplete — and the preamble's infra
bound caps the consecutive run. Only success resets the counter; a snapshot
change deliberately does not — a step that has never succeeded does not earn
fresh retries because the workspace moved.

**Fold**, on a canceled or abandoned execution: increment `ExecutionAttempt`
(freeing the deterministic name) and change nothing else.

**Decide** evaluates in this order:

```
# ---- global preamble: bounds that end the task regardless of position ----
1  if v.Oscillation                          → Escalate("oscillation")
2  if spend.wallClock  > budgets.wallClock   → Escalate("wall-clock")
3  if spend.tokens     > budgets.tokens      → Escalate("token-budget")
4  if the driver, or any BLOCKING gate, has InfraRetries >= budgets.infraRetries
                                             → Escalate("infra", step)
   # infra exhaustion escalates only where no fallback exists: an exhausted
   # fix action degrades to the driver, an exhausted non-blocking gate is
   # tolerated (CONVERGENCE.md, ruling R1)

# ---- walk steps in topological order of `after`, ties by declaration ----
5  for step in plan.steps:
     if step.kind == Action:
        if v.Actions[step].Completions == 0  → RunAction(step, Initial)
        continue                              # actions run once unless re-triggered
                                              # (an Errored run left it incomplete;
                                              #  the preamble bounds the retries)

     g = v.Gates[step]
     if g.Result == Passed:                   # invalidation guarantees
        continue                              #   verifiedSnapshot == current
     if g.Result == Unknown                  → RunGate(step)
     if g.Result == Errored:
        if g.InfraRetries < budgets.infraRetries
                                             → RunGate(step)   # fresh attempt
        continue           # only non-blocking gates reach this line (blocking
                           # exhaustion escalated in the preamble); a gate that
                           # cannot run must not block Done if a failing one
                           # would not have
     if g.Result == Failed:
        if !step.Blocking                     → continue  # recorded, tolerated
        if step.FixAction != nil
           && g.FixAttemptedAt != v.CurrentSnapshot
           && g.FixAttempts < budgets.fixAttemptsPerGate
           && v.Actions["<step>@fix"].InfraRetries < budgets.infraRetries
                                             → RunAction("<step>@fix",
                                                         FixAction(step))
                                             # a fixer with dead infra is
                                             # skipped, not escalated (R1)
        if v.DriverRuns >= budgets.maxDriverRuns
                                             → Escalate("driver-runs", step)
                                             → RunAction(plan.Driver,
                                                         GateFailure(step),
                                                         failures=[g])

# ---- fixed point ----
6  → Done      # every Action completed ≥ 1 (driver included), every gate has
               # a result at the current snapshot, every blocking gate Passed
```

Properties worth stating because their absence was a v1 bug:

- **Budget guards remediation, never verification.** The driver-runs check
  sits inside the Failed branch, guarding the decision to spend another fix.
  A gate left Unknown by the final budgeted fix is still run — the last fix's
  outcome is always observed before any escalation.
- **The stuck check is reachable and cannot misfire.** Passed steps `continue`
  before any budget logic; failed blocking steps hit the caps in a defined
  order (fix action, then driver, then escalate).
- **`Blocking` is honored.** A failed non-blocking gate is recorded, surfaced
  in status and events, and never blocks `Done`, never burns a fix, never
  short-circuits the walk. Non-blocking gates still *run* (the Unknown branch
  applies to every gate), so `Done` implies every gate reported at the final
  snapshot — the one tolerated exception is a non-blocking gate whose
  executor is infra-exhausted (R1) — and only blocking gates must pass.
- **A no-op task cannot succeed.** The driver is a step; a never-run Action
  returns `RunAction` before the walk can reach `Done`. `Done` therefore
  implies the driver completed at least once, even when the base tree already
  satisfies every gate.
- **Gate re-runs are bounded without their own guard.** A gate only becomes
  Unknown again via a new snapshot; new snapshots only come from budget-capped
  Actions.
- **Fix loops terminate.** A fix Action runs at most once per (gate, snapshot)
  — `Fold` records `FixAttemptedAt` from the fix's input snapshot, so even a
  no-op fixer is never rescheduled at the snapshot it failed to change —
  and at most `fixAttemptsPerGate` times per gate lifetime; a fixer that keeps
  producing fresh snapshots without fixing the gate falls through to the
  driver, which is capped.

### 2.5 Termination

Exactly five conditions, all checked in the pure core:

| Condition | Detection | Outcome |
|---|---|---|
| Success | Every blocking gate `Passed` at `currentSnapshot`, every Action completed ≥ 1 | `Validated` → cleanup → `Succeeded` |
| Oscillation | A newly produced snapshot equals a non-parent ancestor in lineage | `Failed("oscillation")` |
| Driver runs | `DriverRuns` reaches `budgets.maxDriverRuns` while a blocking gate is failed | `Failed("driver-runs")` |
| Wall clock | Active runtime — accumulated since `Provisioned`, excluding time spent `Suspended` — exceeds `budgets.wallClock` | `Failed("wall-clock")` |
| Infrastructure | The driver's or a **blocking** gate's consecutive `Errored` executions reach `budgets.infraRetries` — an exhausted fix action degrades to the driver, an exhausted non-blocking gate is tolerated (R1) | `Failed("infra")` |

Token exhaustion folds into the wall-clock/budget family
(`Failed("token-budget")`). The diff-size ratchet from v1 is deferred: it is a
flailing *heuristic*, not a termination guarantee, and the five conditions
above already bound the loop (Appendix B).

The escalation policy in Phase 1 is `Fail`, and it is the only policy: set
`Failed` with the reason, cancel the active execution, retain the work
namespace for post-mortem under a retention TTL (§5.4).

---

## 3. API types

All types live in `api/v1alpha1/`. Group `agents.primitive.dev`, version
`v1alpha1`. Five kinds. `TrackerConnection` is deferred entirely — a kind with
no controller is still sticky API surface.

Validation strategy for every kind: **structural schema + CEL
(`x-kubernetes-validations`) for shape, enums, and immutability; controller
admission for anything cross-object** (§4). Phase 1 ships no webhooks — no
cert management, no failure-policy decisions, no TOCTOU class of bugs.
Cross-object CEL is impossible anyway; the controller check was always going
to be the authoritative one.

### 3.1 AgentStepClass (cluster-scoped)

Declares an executable capability. Written by cluster administrators only.

```go
type AgentStepClassSpec struct {
    Kind     string // Action | Gate
    Executor string // Fake in Phase 1; SandboxExec | Job | Http reserved
    Image    string
    Command  []string
    Args     []string
    Timeout  metav1.Duration

    // Gate-only. CEL rejects these on kind: Action.
    Blocking  bool
    FixAction string       // Action class name; plan resolution synthesizes
                           // the fix identity "<gate>@fix" from it (§4)
    Evidence  EvidenceSpec

    // Action-only. CEL rejects these on kind: Gate.
    TurnBudget  int   // per-invocation bound, enforced by the executor
    TokenBudget int64 // per-invocation bound, enforced by the executor

    // Reserved, documented, unimplemented in Phase 1 (Appendix B):
    // Scope: Tree | Diff   — diff-scoped gates key on (baseRev, snapshot)
    // Cost:  Cheap | Expensive — feeds the expensive-runs budget
}

type EvidenceSpec struct {
    Format string // junit | sarif | json | text
}
```

The `kind` split replaces v1's behavioral boolean matrix. `mutatesWorkspace`
is derivable (Actions mutate, Gates must not — the executor contract enforces
it), `agentDriven` is unnecessary (turn/token budgets are simply ignored by
executors that do not consume turns), `producesFindings` is deferred with the
findings feature, and autofix stops being a sub-command of a gate and becomes
an ordinary, reusable Action class referenced by name.

```yaml
apiVersion: agents.primitive.dev/v1alpha1
kind: AgentStepClass
metadata:
  name: lint-python
spec:
  kind: Gate
  executor: Fake
  image: sandbox/toolchain-python:v1
  command: ["ruff", "check", "--output-format=json"]
  timeout: 2m
  blocking: true
  fixAction: lint-python-fix
  evidence:
    format: json
---
apiVersion: agents.primitive.dev/v1alpha1
kind: AgentStepClass
metadata:
  name: lint-python-fix
spec:
  kind: Action
  executor: Fake
  image: sandbox/toolchain-python:v1
  command: ["ruff", "check", "--fix"]
  timeout: 2m
---
apiVersion: agents.primitive.dev/v1alpha1
kind: AgentStepClass
metadata:
  name: coding-agent
spec:
  kind: Action
  executor: Fake
  image: sandbox/agent:v1
  timeout: 15m
  turnBudget: 40
  tokenBudget: 200000
```

CEL rules (kubebuilder `XValidation` markers):

- `kind` immutable after creation
- Gate-only fields absent when `kind == Action`; Action-only fields absent
  when `kind == Gate`
- `blocking` defaults to `true` for Gates (the safe direction)

Controller-checked at plan resolution (§4): `fixAction` names an existing
class of `kind: Action`.

### 3.2 AgentClusterPolicy (cluster-scoped singleton)

Cluster-wide constraints and the work-namespace template. Written by cluster
administrators only. Phase 1 has no multi-tenancy, so the selector/matching
machinery from v1 is deferred: **the policy is a singleton named `default`**,
enforced by CEL (`self.metadata.name == 'default'`). Namespace selectors,
conflict resolution, and `matchedNamespaces` return with multi-tenancy in a
later phase; the shape below is forward-compatible with that.

```go
type AgentClusterPolicySpec struct {
    AllowedClasses []string       // class names; ["*"] allows all
    RequiredGates  []RequiredGate // injected into every resolved plan (§4)
    Ceilings       Budgets
    WorkNamespace  WorkNamespaceTemplate
}

type RequiredGate struct {
    Name  string // resolved-plan identity becomes "<name>@policy" — a
                 // reserved namespace no workflow step can occupy, so
                 // collision is impossible rather than an admission error
    Class string // concrete Gate class — deterministic, never a group
}

type WorkNamespaceTemplate struct {
    ResourceQuota   *corev1.ResourceQuotaSpec
    LimitRange      *corev1.LimitRangeSpec
    NetworkPolicies []string        // names from the operator's built-in library
    RuntimeClasses  []string        // permitted isolation tiers (Phase 2 pods)
    RetainOnFailure metav1.Duration // post-mortem retention, default 24h
}

type Budgets struct {
    Tokens             int64
    WallClock          metav1.Duration // ACTIVE runtime; excludes Suspended time
    MaxDriverRuns      int // default 5; total driver invocations, initial included
    FixAttemptsPerGate int // default 3
    InfraRetries       int // default 2; CONSECUTIVE failures of one step
}
```

```yaml
apiVersion: agents.primitive.dev/v1alpha1
kind: AgentClusterPolicy
metadata:
  name: default
spec:
  allowedClasses: ["*"]
  requiredGates:
    - name: integrity
      class: integrity-check
  ceilings:
    tokens: 8000000
    wallClock: 4h
    maxDriverRuns: 8
    fixAttemptsPerGate: 5
    infraRetries: 3
  workNamespace:
    networkPolicies: [default-deny-ingress, default-deny-egress, allow-dns]
    runtimeClasses: [kata-qemu]
    retainOnFailure: 24h
```

`networkPolicies` names resolve against a small library embedded in the
operator (`default-deny-ingress`, `default-deny-egress`, `allow-dns` in
Phase 1); an unknown name fails task admission. The per-task namespace is the
unit of network isolation — this is the foundation of per-pod networking when
real executor pods arrive, and its lifecycle is exercised now (§5.4).

No policy present ⇒ **no task admits**. An unconstrained cluster is never the
default.

### 3.3 AgentWorkflow (namespaced)

Composes step classes into a dependency graph and designates the driver.
Written by teams. Composition only: a workflow cannot introduce an image,
change a class's behavior, or remove injected gates (which never appear in
its spec at all — see §4).

```go
type AgentWorkflowSpec struct {
    Driver    string // name of the one Action step that is the agent
    Workspace WorkspaceSpec
    Budgets   Budgets // must not exceed policy ceilings; rejected, not clamped
    Steps     []WorkflowStep
}

type WorkflowStep struct {
    Name          string   // unique; the gate-state key
    Class         string   // AgentStepClass name
    After         []string // step names; must form a DAG
    InvalidatedBy []string // path globs; gates only; DEFAULT ["**"]
}

type WorkspaceSpec struct {
    Repo           string
    BaseRef        string
    SparseCheckout []string
}
```

```yaml
apiVersion: agents.primitive.dev/v1alpha1
kind: AgentWorkflow
metadata:
  name: python-minimal
  namespace: agent-tasks-platform
spec:
  driver: implement
  workspace:
    repo: git@github.com:primitivecorp/example
    baseRef: main
  budgets:
    tokens: 400000
    wallClock: 20m
    maxDriverRuns: 5
  steps:
    - name: implement
      class: coding-agent
    - name: lint
      class: lint-python
      after: [implement]
      invalidatedBy: ["**/*.py"]
    - name: unit
      class: test-pytest
      after: [lint]           # order encodes cost: cheap gates first, fail fast
      # no invalidatedBy ⇒ ["**"]: any change re-runs the tests. The safe default.
```

CEL rules: step names unique; `driver` non-empty; `spec` immutable after
creation (edit-by-replace; running tasks are pinned regardless).

Controller-checked at plan resolution (§4): every class exists and is allowed
by policy; **exactly one step is an Action, and `driver` names it** — a
Phase 1 workflow is one driver plus gates; fix actions are synthesized, never
authored, and multi-action workflows return only when a later phase defines
their rerun semantics (an authored second Action would have defined-but-
degenerate run-exactly-once semantics: a trap, not a feature); `invalidatedBy`
appears only on Gate steps; `after` references exist and form no cycle; step
names are DNS-1123 labels — `@` cannot appear in an authored name, which is
what makes the synthesized `@fix`/`@policy` identity space collision-proof;
budgets ≤ ceilings.

There is no `selection`, no `candidates`, no `escalationPolicy`, no
`mergePolicy`, and no `fanOut`. Workflow selection is `workflowRef` on the
task, full stop, until connectors exist.

### 3.4 AgentTask (namespaced)

The durable ticket-scoped intent. Spec written by a human (connectors are a
later phase); status written by the operator only.

```go
type AgentTaskSpec struct {
    Goal        Goal
    WorkflowRef corev1.LocalObjectReference // required
    Suspend     bool                        // the only mutable spec field
}

type Goal struct {
    Title              string
    Body               string
    AcceptanceCriteria []string
}

type AgentTaskStatus struct {
    ObservedGeneration int64
    Phase              string             // display only; conditions are authoritative
    Conditions         []metav1.Condition // Admitted, Provisioned, Suspended,
                                          // Validated, Succeeded, Failed

    ResolvedPlan  *ResolvedPlan // set once at admission; CEL-frozen thereafter
    WorkNamespace string

    View            ViewStatus // the gate-state view, §2.3
    ActiveExecution string     // name of the single in-flight AgentStep, or ""
}

type ResolvedPlan struct {
    Workflow ResolvedRef
    Policy   ResolvedRef
    Driver   string
    Budgets  Budgets
    Steps    []ResolvedStep // topo-sorted; includes injected required gates
    PlanHash string         // hash over the resolved content
}

type ResolvedRef struct {
    Name       string
    Generation int64
    SpecHash   string
}

type ResolvedStep struct {
    Name          string
    Kind          string // Action | Gate
    Class         string
    ClassSpecHash string
    Executor      string
    Image         string // digest-pinned when resolvable; Phase 2 for real registries
    Command       []string
    Args          []string
    Timeout       metav1.Duration
    Blocking      bool     // gates
    FixAction     *ResolvedStep // synthesized: Name = "<gate>@fix"; owns its
                                // ActionState and execution names; embedded
                                // here (single source of truth) and excluded
                                // from the topological walk
    InvalidatedBy []string // defaulted; ["**"] for injected gates
    Injected      bool     // true for policy-required gates
    After         []string
}
```

Key properties:

- **The plan is the complete executable interpretation.** Classes are resolved
  *into* it, so an admin editing or deleting an `AgentStepClass` mid-flight
  cannot change a running task's images, commands, or gate set. New tasks pick
  up the new class; running tasks finish on the plan they admitted with. The
  supersede story (cancel-and-recreate on class change) is a Phase 2 policy
  decision, documented so nobody "fixes" pinning by removing it.
- **The plan is O(workflow), not O(history)** — it belongs in status. The
  bounding rules of §2.3 apply to history, never to the plan.
- **Set-once is CEL-enforced**, meeting the "in admission, not convention"
  bar: `!has(oldSelf.resolvedPlan) || self.resolvedPlan == oldSelf.resolvedPlan`,
  and equivalent transition rules on `view` fields the controller owns.
- **Spec immutability is CEL-enforced**: every spec field except `suspend`
  is frozen after creation. Mid-flight goal edits feeding new text to the
  agent are not a thing.

Conditions:

| Condition | Meaning |
|---|---|
| `Admitted` | Plan resolved and pinned. `False` with reason on any resolution failure; the controller re-attempts via watches on workflows, classes, and the policy — recovery requires no manual poke. |
| `Provisioned` | Work namespace exists with quota and network policies materialized; view initialized at the base snapshot. |
| `Suspended` | `spec.suspend` observed: active execution canceled, workspace and view retained, scheduling held, and the wall-clock budget paused. |
| `Validated` | Convergence reached (`Decide` returned `Done`). |
| `Succeeded` | Terminal. Post-`Validated` cleanup complete. Phase 1 has no merge path, so `Validated` proceeds directly to cleanup and `Succeeded`. |
| `Failed` | Terminal, with the termination reason. |

```yaml
apiVersion: agents.primitive.dev/v1alpha1
kind: AgentTask
metadata:
  name: fix-csv-export
  namespace: agent-tasks-platform
spec:
  goal:
    title: "CSV export drops the trailing row"
    body: |
      Reproduce with tests/fixtures/small.csv.
    acceptanceCriteria:
      - "New test covering the off-by-one"
      - "Existing export tests still pass"
  workflowRef:
    name: python-minimal
```

Print columns:

```
NAME  WORKFLOW  PHASE  SNAPSHOT  DRIVER  TOKENS  AGE
```

(`SNAPSHOT` is the short current hash; `DRIVER` is `runs/cap`.)

### 3.5 AgentStep (namespaced)

A single bounded execution: **a completely self-contained, immutable
execution record**. Created and owned by the `AgentTask` controller in the
task's namespace (owner references make deletion GC-safe). Executing it must
require no reads of mutable external objects — everything comes from the
resolved plan.

```go
type AgentStepSpec struct {
    TaskRef  corev1.LocalObjectReference
    TaskUID  types.UID
    StepName string
    Kind     string // Action | Gate

    Trigger  string // Initial | GateFailure | FixAction
    Failures []FailureContext // list; Phase 1 carries at most one entry

    InputSnapshot    string
    ExecutionAttempt int

    // Resolved execution — copied verbatim from the plan, never looked up.
    Executor string
    Image    string
    Command  []string
    Args     []string
    Timeout  metav1.Duration
    Evidence EvidenceSpec

    Goal          *Goal  // driver runs only
    WorkNamespace string // where Phase 2 executors place workloads

    TTLSecondsAfterFinished int32 // default 3600; reaped by the operator (§5.2)
}

type FailureContext struct {
    Gate        string
    EvidenceRef string
    Evidence    string // capped excerpt
}

type AgentStepStatus struct {
    Phase      string // Pending | Running | Succeeded | Failed | Errored
    Result     string // gates: Passed | Failed | Errored
    ExitReason string // Clean | TurnBudget | Timeout | Error | Canceled

    // Actions only.
    ResultSnapshot        string
    ChangedPaths          []string // capped at 2048 entries
    ChangedPathsTruncated bool     // true ⇒ Fold treats the change as ["**"]
    ChangedPathCount      int

    EvidenceRef string
    Evidence    string // inline, capped at 4KiB

    TurnsUsed int
    TokensIn  int64
    TokensOut int64

    StartedAt *metav1.Time
    EndedAt   *metav1.Time
    Conditions []metav1.Condition
}
```

The whole spec is CEL-frozen after creation.

**Naming.** The object name is the idempotency key and must be deterministic
from stored state and DNS-1123/label-safe (≤ 63 chars):

```
name = trunc(taskName, 24) + "-" + trunc(stepName, 12) + "-" +
       sha256(taskUID + "/" + stepName + "/" + inputSnapshot + "/" +
              executionAttempt)[:10]
```

Synthesized identities (`lint@fix`, `integrity@policy`) contain `@`, which is
not legal in a Kubernetes object name: the readable `stepName` segment is
sanitized (`@` → `-`) when the name is assembled. Identity lives in the
hashed suffix — the hash input uses the unsanitized step name — so
sanitization can never collide two distinct executions.

`executionAttempt` for the next execution of a step is always
`view.<step>.ExecutionAttempt + 1` — an explicit stored counter (§2.3), so a
duplicate reconcile recomputes the identical name and `AlreadyExists` makes
creation idempotent. The counter advances only in `Fold`, when the named
execution completes (or is discarded after cancellation).

`ttlSecondsAfterFinished` on a CRD is **not** a Kubernetes built-in: the
AgentStep controller reaps terminal steps after the TTL, and only after the
task controller has marked them folded (label `agents.primitive.dev/folded`).

### 3.6 Deferred kinds

`TrackerConnection` (and everything downstream of it: sweep, field mappings,
auto-selection) is deferred to the connector phase. `AgentCandidate` arrives
with multi-candidate execution. Neither name may be reused for anything else.

---

## 4. Admission and the resolved plan

Admission is a controller responsibility, executed once per task, before any
execution. There are no admission webhooks in Phase 1; CEL covers structure,
and the controller performs the cross-object checks authoritatively — the
place where they are free of webhook TOCTOU races, because the result is
pinned immediately.

`Admit(task)`:

1. **Fetch policy.** The `AgentClusterPolicy` named `default` must exist.
   Absent ⇒ `Admitted=False, reason=NoPolicy` (watch-driven retry).
2. **Fetch workflow** from `spec.workflowRef`. Absent ⇒
   `Admitted=False, reason=NoWorkflow`.
3. **Resolve every class** referenced by workflow steps, `fixAction` fields,
   and policy `requiredGates`. Validate: classes exist; classes are in
   `allowedClasses`; step/class kinds are consistent (gate steps use Gate
   classes, `fixAction` targets Action classes); **exactly one step is an
   Action and `driver` names it**; step names are DNS-1123 labels;
   `invalidatedBy` appears only on gate steps; `after` forms a DAG.
4. **Default invalidation**: any gate step without `invalidatedBy` gets
   `["**"]`.
5. **Synthesize fix actions.** For each gate whose class declares `fixAction`,
   synthesize a resolved Action with identity `<gate>@fix` from the referenced
   Action class, embedded under the gate's resolved step. It is a first-class
   execution identity — it owns an `ActionState`, an `ExecutionAttempt`
   counter, and AgentStep names — but it is not in the topological walk: it
   runs only when `Decide` remediates its gate.
6. **Inject required gates — always, unconditionally.** For each policy
   `requiredGate`, append a resolved gate step with identity `<name>@policy`,
   `after` all workflow steps, `blocking: true`, `invalidatedBy: ["**"]`,
   `injected: true`. Injection is **never suppressed by an authored step of
   the same class**: an authored step's `after` and `invalidatedBy` are
   team-controlled, so honoring it as a substitute would let a workflow
   shadow a required gate with a weakened copy. No deduplication is
   attempted — the duplicate run when a team voluntarily authors the same
   class is the cheap outcome, and the team can delete its own copy. The
   `@policy` identity lives in the reserved namespace (§3.3), so collision
   with a workflow step is impossible by construction rather than an
   admission error. Injection happens at **plan resolution, not by mutating
   the workflow object** — teams never see, and can never edit or remove,
   the injected steps; the invariant needs no mutating webhook to hold.
7. **Validate budgets ≤ ceilings.** Reject (`Admitted=False,
   reason=BudgetCeiling`), never clamp.
8. **Pin.** Write `status.resolvedPlan` (with `specHash` for workflow, policy,
   and every class, plus the aggregate `planHash`), set `Admitted=True`.
   CEL freezes it from this write forward.

Later edits to the workflow, the policy, or any class have **no effect** on an
admitted task. Zero re-resolution paths exist.

---

## 5. Controllers

Two controllers. Reconcile is level-triggered and idempotent, and never
performs the work itself: an execution is a long, expensive, non-idempotent
side effect, and reconcile may fire at any time.

### 5.1 AgentTask controller

```
Reconcile(task):
  if task.DeletionTimestamp != nil:
      cancelActiveExecution()
      deleteWorkNamespace(); wait for termination     # finalizer path: deletion only
      removeFinalizer(); return

  ensureFinalizer()

  if !Admitted:      Admit(task); return               # §4
  if !Provisioned:   provisionWorkNamespace()          # §5.4
                     initView(baseSnapshot)
                     setCondition(Provisioned); return

  if terminal (Succeeded | Failed): maybeReapRetainedNamespace(); return

  if task.Spec.Suspend:
      if activeExecution: Cancel(it)                   # workspace and view RETAINED
      setCondition(Suspended); return                  # wall clock PAUSES here
  clearCondition(Suspended)                            # resume restarts the clock

  if activeExecution != "":
      step = get(activeExecution)
      if step missing or terminal:
          view = Fold(view, resultOf(step))            # pure; §2.4
          label step folded; activeExecution = ""
          write status; return                         # one state change per reconcile
      return                                           # running; step watch re-triggers

  if Validated:                                        # ordinary-reconcile cleanup —
      requestWorkNamespaceDeletion()                   # success cleanup is NOT the
      if workNamespaceStillExists():                   # finalizer's job
          requeueAfter(poll); return                   # deletion is ASYNC: wait it out
      setCondition(Succeeded); return                  # Succeeded MEANS cleanup done

  action = Decide(plan, view, budgets)
  switch action.Type:
    case RunAction, RunGate:
        createAgentStep(action)                        # deterministic name;
        activeExecution = name; write status           # AlreadyExists ⇒ adopt
    case Escalate:
        setCondition(Failed, action.Reason)
        stampNamespaceRetention()                      # retained for post-mortem
    case Done:
        setCondition(Validated)
```

Notes:

- Reconcile is re-triggered by AgentStep status changes through an owner-ref
  watch, and by watches on `AgentWorkflow`, `AgentStepClass`, and
  `AgentClusterPolicy` to recover un-admitted tasks the moment a missing
  object appears.
- **Suspend suspends.** It cancels the in-flight execution and holds
  scheduling; the namespace, workspace, and view survive, and clearing
  `spec.suspend` resumes from the exact gate state. v1's
  teardown-on-suspend was cancellation wearing suspend's name.
- **Success cleanup is ordinary reconciliation** (`Validated` → release →
  `Succeeded`). The finalizer is the emergency path for deletion only.
- Crash safety of the fold: `activeExecution` is cleared in the same status
  write that persists the folded view. A crash before the write re-folds the
  same terminal step (Fold is pure; `Poll` of a terminal execution is stable);
  a crash after it leaves a folded, labeled step for the reaper.
- Wall-clock enforcement needs no timer loop: reconcile computes remaining
  budget and uses `RequeueAfter` to wake at expiry. The budget measures
  **active runtime**: accumulation starts at `Provisioned` (a task parked on
  a missing class burns nothing) and pauses while `Suspended`. The view
  stores the accumulated active duration plus the timestamp accumulation
  last resumed, so the clock survives controller restarts.

### 5.2 AgentStep controller

```
Reconcile(step):
  if step terminal:
      if folded label set and TTL elapsed: delete(step)
      else: requeueAfter(remaining TTL)
      return

  executor := executors[step.Spec.Executor]
  state := executor.Ensure(ctx, executionID(step), step.Spec)   # idempotent
  if state.Running:
      requeueAfter(pollInterval)                                # 5s in Phase 1
      updateStatus(Running); return
  writeTerminalStatus(state)                                    # result, snapshot,
                                                                # changedPaths, evidence,
                                                                # spend, exitReason
```

`executionID(step) = step.Name`. There is no dispatch-then-persist-handle
race because there is no dispatch: `Ensure` may be called arbitrarily many
times and creates the underlying execution at most once.

### 5.3 Executor interface

```go
// internal/executor/executor.go

type Executor interface {
    // Ensure creates the execution for executionID if it does not exist and
    // returns its current state. Idempotent: callers may invoke it any
    // number of times. Implementations key on executionID — a Job executor
    // creates/adopts a Job named by it; a remote executor sends it as an
    // idempotency key.
    Ensure(ctx context.Context, executionID string, spec StepSpec) (State, error)
    Poll(ctx context.Context, executionID string) (State, error)   // stable once terminal
    Cancel(ctx context.Context, executionID string) error
}

type State struct {
    Running               bool
    Result                string // Passed | Failed | Errored (gates)
    ExitReason            string
    ResultSnapshot        string   // actions: the produced snapshot;
                                   // gates: echo of the input snapshot
    ChangedPaths          []string // actions; full set up to the cap
    ChangedPathsTruncated bool     // set ⇒ consumers must over-invalidate
    ChangedPathCount      int
    EvidenceRef           string
    Evidence              string   // capped
    TurnsUsed             int
    TokensIn, TokensOut   int64
}
```

Contract points that exist because their absence was a v1 bug: `ChangedPaths`
is part of the result (invalidation is uncomputable without it), truncation is
explicit and consumers must respond by clearing everything, and terminal
results are stable under repeated `Poll` so folds are replayable.

One invariant is stated now so real executors are built to it: **gates execute
against read-only workspace mounts**, and an executor echoes the gate's input
snapshot as `ResultSnapshot`. A mismatch is a contract violation surfaced as
`Errored (ExitReason: GateMutation)` — never adopted as a new snapshot.
Read-only mounting is the mechanism; the echo check is the backstop. "Gates
never mutate" is enforced, not assumed.

**Fake executor (Phase 1).** Reads a scripted outcome from a ConfigMap keyed
by `(stepName, executionAttempt)`. Delay is implemented as a deadline recorded
at first `Ensure`; `Poll` reports `Running` until the deadline passes — no
sleeps anywhere (§9). The script also supplies the initial base snapshot used
by `initView`.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fake-executor-script
  namespace: agent-tasks-platform
data:
  script.yaml: |
    initialSnapshot: h0
    steps:
      - stepName: implement
        attempt: 1
        result: Passed
        resultSnapshot: h1
        changedPaths: ["src/export.py", "tests/test_export.py"]
        delay: 2s
      - stepName: lint
        attempt: 1
        result: Failed
        evidence: "E501 line too long: src/export.py:41"
        delay: 1s
      # lint's synthesized fix action — a first-class identity in the plan:
      - stepName: lint@fix
        attempt: 1
        result: Passed
        resultSnapshot: h2
        changedPaths: ["src/export.py"]
      - stepName: lint
        attempt: 2
        result: Passed
      - stepName: unit
        attempt: 1
        result: Failed
        evidence: "test_export_trailing_row: AssertionError"
      - stepName: implement
        attempt: 2
        result: Passed
        resultSnapshot: h3
        changedPaths: ["src/export.py", "tests/test_export.py"]
      - stepName: lint
        attempt: 3
        result: Passed
      - stepName: unit
        attempt: 2
        result: Passed
      - stepName: integrity@policy
        attempt: 1
        result: Passed
```

### 5.4 Work-namespace lifecycle

One namespace per task — the isolation and networking boundary for everything
derived from the agent's workspace, and the foundation of per-pod networking
when real executor pods land. Phase 1 runs no pods in it, but creates it,
materializes policy into it, and manages its full lifecycle, because that
lifecycle (and its teardown) is a Phase 1 deliverable.

- **Name**: `at-<taskUID[:12]>` — collision-free, length-safe. Recorded in
  `status.workNamespace`.
- **Provision**: create the namespace labeled with the task reference; apply
  the `ResourceQuota` and `LimitRange` from the policy template; materialize
  each named `NetworkPolicy` from the operator's embedded library (§3.2).
- **Success**: deleted during ordinary reconciliation before `Succeeded`.
- **Failure**: retained for post-mortem, stamped with a
  `agents.primitive.dev/delete-after` timestamp from
  `workNamespace.retainOnFailure`; the task controller reaps it on a
  `RequeueAfter` timer. Reaping is owned here — no separate component, no
  unowned TTL label.
- **Deletion**: the finalizer cancels the active execution, deletes the
  namespace, and **waits for it to actually terminate** before removing the
  finalizer (namespace deletion is async and can hang on stuck resources; the
  wait is what makes teardown observable rather than assumed).

A namespaced object cannot own a cluster-scoped `Namespace`, so garbage
collection never applies to it and every path above is explicit.

---

## 6. Security invariants

Enforced in code, CEL, and RBAC — not by convention. Phase 1 has no real
executors, but every invariant that can hold now, holds now.

1. **Behavior lives on classes; workflows compose.** A workflow step schema
   has no behavioral fields at all — `kind`, `blocking`, `fixAction`, budgets
   are class-side. (Note: with structural schemas, unknown fields in an
   applied manifest are *pruned*, not rejected; `kubectl`'s strict field
   validation surfaces them client-side. The invariant holds because the
   fields cannot exist server-side, not because a webhook rejects them.)
2. **Resolution happens once, at admission, and pins everything** — workflow,
   policy, and every class, resolved *into* the plan by content. Later edits
   to any of them cannot alter a running task's gate set, images, commands,
   ceilings, or budgets. Set-once is CEL-enforced on the status field.
3. **Required gates are injected at plan resolution — always, never authored,
   never suppressed.** Nothing in the workflow schema can express removing
   them, no mutating webhook exists to be misconfigured, and an authored step
   of the same class never stands in for the policy's copy: the authored
   step's `after` and `invalidatedBy` are team-controlled, so treating it as
   satisfying the requirement would let a workflow shadow a required gate
   with a weakened one. The injected copy owns a reserved identity
   (`<name>@policy`), is always blocking, and is always invalidated by any
   change (`["**"]`) — a required gate that could carry forward from the
   base snapshot would be a required gate that never re-runs.
4. **Budgets are rejected, not clamped.** A workflow requesting more than the
   policy ceiling fails admission with a reason.
5. **No policy admits nothing.** A cluster without the `default`
   `AgentClusterPolicy` runs zero tasks.
6. **Invalidation defaults closed.** `invalidatedBy` defaults to `["**"]`;
   a truncated change report over-invalidates. Stale green is structurally
   harder than wasted re-verification.
7. **The agent never writes spec.** All agent influence enters through step
   results and evidence. Task spec is CEL-frozen except `suspend`; status
   subresources are writable only by the operator's service account (RBAC).
8. **Workflow selection never reads free text.** Phase 1 selection is an
   explicit `workflowRef`; when tracker-driven selection returns, it resolves
   from trusted structured fields only (Appendix B).
9. **Evidence is not trusted from the workspace.** Executors produce evidence
   from tool output and copy it out; a path inside the agent-writable
   workspace is never the source of record. (Phase 1: inline capped excerpts;
   durable store later.) In the same spirit, real executors run gates against
   read-only workspace mounts, with the snapshot-echo check of §5.3 as the
   backstop.
10. **Provenance placement (reserved).** A `ValidatingAdmissionPolicy` will
    require any pod whose image matches `sandbox/*` to set
    `runtimeClassName: kata-*` and live in a work namespace. It lands with the
    real executor; the namespace shape, labels, and naming it depends on are
    set correctly in Phase 1.

RBAC:

| Role | AgentStepClass / AgentClusterPolicy | AgentWorkflow | AgentTask | AgentStep | Statuses |
|---|---|---|---|---|---|
| Cluster admin | write | — | — | — | — |
| Team | read | write | write | read | — |
| Operator SA | read | read | read + finalizers | write | sole writer |

The operator additionally holds create/delete on `Namespace`,
`ResourceQuota`, `LimitRange`, and `NetworkPolicy` for work-namespace
lifecycle.

---

## 7. Repository layout

```
api/v1alpha1/                 five kinds, deepcopy, defaults, CEL markers
cmd/manager/                  operator entrypoint
internal/controller/          AgentTask, AgentStep
internal/convergence/         Fold, Decide, invalidation, lineage — pure Go,
                              zero Kubernetes imports
internal/plan/                admission resolution, injection, spec hashing,
                              topo sort
internal/executor/            interface
internal/executor/fake/       Phase 1 executor
internal/worknamespace/       namespace lifecycle + embedded netpol library
config/crd/                   generated manifests
config/samples/               one of each kind
config/rbac/                  roles per §6
examples/stepclasses/         reusable class library (Action/Gate pairs)
test/e2e/testdata/            acceptance fixtures
paper/                        whitepaper sources
```

### Scaffolding

```bash
kubebuilder init \
  --domain primitive.dev \
  --repo github.com/primitivecorp/agent-tasks \
  --project-name agent-tasks

kubebuilder create api --group agents --version v1alpha1 \
  --kind AgentStepClass --resource --controller=false --namespaced=false
kubebuilder create api --group agents --version v1alpha1 \
  --kind AgentClusterPolicy --resource --controller=false --namespaced=false
kubebuilder create api --group agents --version v1alpha1 \
  --kind AgentWorkflow --resource --controller=false
kubebuilder create api --group agents --version v1alpha1 \
  --kind AgentTask --resource --controller
kubebuilder create api --group agents --version v1alpha1 \
  --kind AgentStep --resource --controller
```

No webhook scaffolds. Validation is CEL markers plus `internal/plan`.
(The policy needs no controller in Phase 1: it is read at admission, and the
namespace-matching controller returns with multi-tenancy.)

---

## 8. Build order

### Step 1 — Pure logic, no Kubernetes

`internal/convergence` as plain Go with table-driven tests. `CONVERGENCE.md`
is the normative contract for this step: it enumerates the concrete case
matrix (C01–C35), the property/fuzz suite, the world-model harness, and the
termination bound the tests assert. The list below is the summary the cases
pin; each bullet encodes a decision from this document:

- Default `["**"]`: a gate without globs is cleared by any change
- Carry-forward on glob miss, including the `verifiedSnapshot` re-stamp
- A result cleared by intersection is Unknown, not Failed
- A truncated change report clears every gate
- A rebase-shaped change (unrelated paths) preserves unrelated gates
- A no-op Action (result snapshot == current) is recorded and is not
  oscillation and appends no lineage
- Oscillation fires when a new snapshot equals a non-parent ancestor
- A task whose base snapshot already passes every gate still runs the driver:
  `Done` is unreachable with zero driver completions
- Fix-before-driver: failed gate with a fixAction runs the fix first
- Fix dedupe: a fix action runs at most once per (gate, snapshot); a no-op
  fixer (result snapshot == input) sets `FixAttemptedAt` and is not
  rescheduled — the gate proceeds to the driver
- Fix cap: `fixAttemptsPerGate` exhausted falls through to the driver
- Driver cap: `maxDriverRuns` reached with a blocking failure escalates
- The last budgeted fix is always observed: a gate left Unknown by the final
  driver run is re-run, never escalated past
- Errored (gate or action): retries up to `infraRetries` consecutive
  failures, then escalates as infra for the driver and blocking gates; an
  exhausted fix action degrades to the driver and an exhausted non-blocking
  gate is tolerated at `Done` (R1); errors burn no fix or driver budget
- Infra reset: a success resets a step's consecutive count — two transient
  errors separated by a success never escalate; a snapshot change alone
  resets nothing
- Non-blocking failure is recorded, does not schedule a fix, does not block
  `Done`
- `Done` requires every blocking gate green with `verifiedSnapshot ==
  currentSnapshot`; green at `h1` and Unknown at `h2` does not satisfy it
- Cost ordering: a cheap failing gate short-circuits before a later gate runs
- `Fold` then `Decide` is deterministic: identical inputs, identical outputs,
  and `ExecutionAttempt` advances exactly once per folded execution

### Step 2 — Types, CEL, generated manifests

All five kinds, deepcopy, defaults, print columns, CEL validation rules
(immutability transitions included), `make manifests` clean in CI.

### Step 3 — Plan resolution and admission

`internal/plan` with envtest: resolution, kind-consistency checks, the
single-authored-Action rule, DAG validation, ceiling enforcement, fix-action
synthesis (`<gate>@fix`), required-gate injection — always, including over a
workflow that authors the required class with weakened invalidation —
pinning, and watch-driven admission retry.

### Step 4 — Controllers with the fake executor

Both controllers under envtest: single-flight, deterministic naming +
`AlreadyExists` adoption, fold crash-replay, suspend/resume, namespace
provision/release/retention, finalizer teardown, TTL reaping.

### Step 5 — Acceptance

```bash
kubectl apply -f test/e2e/testdata/
kubectl wait --for=condition=Succeeded \
  agenttask/fix-csv-export --timeout=2m
```

(`Succeeded` is actually set in this design; the v1 acceptance test waited on
a condition nothing wrote.)

`test/e2e/testdata/` contains: the `default` `AgentClusterPolicy`, the class
library (driver, gate/fix pairs, integrity gate), one `AgentWorkflow`, one
`AgentTask`, and the fake-executor script ConfigMap.

Additional cases: escalation on oscillation; escalation on driver-run
exhaustion; escalation on wall clock, with suspended time excluded; infra
escalation; suspend mid-task then resume to completion; task rejected for
budgets over ceilings; task rejected for a workflow cycle; task rejected for
a second authored Action; a workflow authoring the required gate's class
still receives the injected `@policy` copy; task blocked on a missing class,
then admitted when the class appears; `Succeeded` set only after the work
namespace is observed gone; namespace retained on failure and reaped after
retention; full teardown on task deletion.

---

## 9. Conventions

- Group `agents.primitive.dev`, version `v1alpha1` only
- `observedGeneration` on every status; `metav1.Condition` with `Reason` on
  every transition
- Events on gate transitions, fix attempts, driver runs, escalation, and
  namespace lifecycle
- Errors wrapped with `%w`
- No `time.Sleep` anywhere on a reconcile path — controllers requeue; the
  fake executor models delay as a deadline observed by `Poll`
- Structured logging via `logr`; task name, step name, and current snapshot
  on every line
- Apache-2.0 header on every Go file
- `make test lint manifests` green, `git diff --exit-code` after manifests
- No model/tool attribution in generated code or manifests

---

## 10. Reference trace

A task using `python-minimal` against the fake script in §5.3. The policy
injects the `integrity@policy` gate.

```
 1  apply AgentTask fix-csv-export
 2  Admit: policy default + workflow python-minimal + classes resolved,
    lint@fix synthesized, integrity@policy injected — always, blocking,
    invalidatedBy ["**"] — plan pinned
 3  condition Admitted
 4  provision namespace at-3f9c01d2a7b4, quota + default-deny + allow-dns
 5  view initialized at h0                          condition Provisioned
 6  Decide → RunAction implement (Initial)          # driver must run: no
                                                    # no-op success exists
 7  implement a1 → Passed, h1, changed {src/export.py, tests/test_export.py}
 8  Fold: lineage h0→h1; all gates Unknown (default rules)
 9  Decide → RunGate lint         → Failed at h1 (E501)
10  Decide → RunAction lint@fix (FixAction lint)          # fix before driver
11  lint@fix a1 → Passed, h2, changed {src/export.py}
12  Fold: lint.FixAttemptedAt = h1; lineage h1→h2; lint cleared (globs hit);
    unit/integrity@policy were Unknown
13  Decide → RunGate lint         → Passed at h2
14  Decide → RunGate unit         → Failed at h2 (trailing-row assertion)
15  unit has no fixAction → Decide → RunAction implement
       (GateFailure unit, failures=[{unit, evidence}])    # driver run 2
16  implement a2 → Passed, h3, changed {src/export.py, tests/test_export.py}
17  Fold: lineage h2→h3; lint, unit, integrity@policy all cleared
18  Decide → RunGate lint → Passed; unit → Passed;
    integrity@policy → Passed                              (all at h3)
19  Decide → Done: driver ran (2), all blocking gates Passed@h3
20  condition Validated
21  ordinary reconcile: request deletion of at-3f9c01d2a7b4
22  requeue until the namespace is observed gone; condition Succeeded
```

Line 17 is the behavior that distinguishes this system from a pipeline: gates
that had passed became Unknown because the snapshot changed underneath them.
Line 6 is the behavior that distinguishes it from a pure gate loop: verifying
the base tree is never success — the driver's work is part of the fixed point.

---

## Appendix A — Changes from v1

| # | v1 | v2 | Why |
|---|---|---|---|
| 1 | Behavioral booleans (`blocking`, `mutatesWorkspace`, `agentDriven`, `producesFindings`) | `kind: Action \| Gate` with per-kind fields | Actions mutate, gates assert; the boolean matrix encoded invalid combinations and let `implement` masquerade as a gate |
| 2 | Missing `invalidatedBy` ⇒ never invalidated | Defaults to `["**"]` | False carry-forward is a correctness/security bug; it also silently neutralized injected integrity gates |
| 3 | `NextAction` bullet order made the stuck check unreachable and escalatable-on-pass; `blocking` unused | Rewritten `Decide` (§2.4): budget guards remediation only, blocking honored, driver-completion required for `Done` | Three correctness bugs, including no-op success on an already-green base tree |
| 4 | `Autofix` + `AgentFix` as special verbs/modes | Fix Actions (`fixAction` on gate classes) + the designated `driver`; verbs are `RunAction`/`RunGate`/`Escalate`/`Done` | One execution model instead of three; fixes become reusable classes; AgentFix's undefined target resolved by the driver designation |
| 5 | `Dispatch() → Handle`, handle-guard "exactly once" | `Ensure(executionID, spec)` idempotent by contract | The dispatch-then-persist race made the v1 claim false; crash recovery is now inherent |
| 6 | Append-only ledger + full lineage + mermaid in status | Bounded gate-state view; counters stored, not derived; full-but-bounded hash chain | etcd object cap; deterministic names must survive history eviction |
| 7 | Pin = workflow/policy name+hash only | `ResolvedPlan`: complete executable interpretation incl. classes, pinned in status, CEL set-once | Admin class edits changed running tasks; hash-without-snapshot was unusable on drift |
| 8 | Webhooks (validating + mutating) | No webhooks: CEL + authoritative controller admission; required gates injected at plan resolution | Removes cert/deploy complexity and webhook TOCTOU; injection into the plan is strictly stronger than mutating team objects |
| 9 | Policy with selectors, defaults, conflict status | Singleton `AgentClusterPolicy/default` | No multi-tenancy in Phase 1; selector machinery returns with it |
| 10 | Suspend = cancel + teardown | Suspend cancels the execution, retains namespace/view; resume continues | v1 destroyed the workspace it claimed to suspend |
| 11 | Teardown described as finalizer work; e2e waited on a condition never set | Success cleanup is ordinary reconciliation → `Succeeded`; finalizer is deletion-only; retention reaped by the controller | Lifecycle correctness; the acceptance test can pass |
| 12 | `Result` lacked changed paths; ledger lacked mode; `Errored` unhandled | `ChangedPaths` (+ truncation ⇒ over-invalidate), fix tracking in `GateState`, explicit infra-retry policy | Invalidation was uncomputable; fix dedupe was unrecordable |
| 13 | Tree hash | `snapshotID` + structural `gateKey(snapshot, class-spec hash)`; `scope: Tree \| Diff` reserved | Changing the verifier must invalidate results; base-rev stays out of snapshot identity so rebases keep unrelated evidence (Appendix B) |
| 14 | Candidates, FanOut, findings, selection modes, merge policies, Elicit/Retry, catalog, diff-ratchet, TrackerConnection in-schema | Cut; semantics reserved in Appendix B | None answers the Phase 1 question; Kubernetes APIs are sticky |
| 15 | Attempt semantics ambiguous across name/script/window | Stored `ExecutionAttempt` per step; lifetime driver cap + per-gate fix caps replace the sliding window | Determinism for names; simpler termination with one driver |

### v2 → v2.1 (post-review revisions)

| # | v2 | v2.1 | Why |
|---|---|---|---|
| 16 | Fix actions resolved by content only; execution identity existed nowhere but the fake script | First-class synthesized identities `<gate>@fix` at plan resolution, owning `ActionState` and step names, embedded under the gate, excluded from the topological walk | The state model keyed everything by step name while fix executions had none — counters, deterministic names, and the script keying had nothing to attach to |
| 17 | `FixAttemptedAt` read by `Decide`, never written by `Fold` | `Fold` sets it to the fix's **input** snapshot | A no-op fixer was rescheduled until the lifetime cap instead of falling through to the driver after one attempt |
| 18 | Required-gate injection deduplicated by class | Always injected as `<name>@policy`; an authored occurrence never suppresses it; no dedup logic exists | An authored step of the same class carries team-controlled `invalidatedBy`/`after` — dedup let a workflow shadow a required gate with a weakened copy, reintroducing the v1 integrity hole |
| 19 | `InfraRetries` counted per step lifetime | Consecutive: reset by any success of that step; deliberately not reset by snapshot changes | Two unrelated transient errors hours apart could kill a task; snapshot-keyed resets would hand a never-succeeding step unlimited retries |
| 20 | `Succeeded` set in the same reconcile that requests namespace deletion | Set only after the namespace is observed gone | Namespace deletion is async and `Succeeded` is documented as "cleanup complete"; the e2e now actually verifies teardown |
| 21 | Workflows could author multiple Action steps with run-once semantics | Exactly one authored Action — the driver — enforced at admission | Extra authored actions had defined but degenerate semantics (run exactly once, ever): a rerun-expectations trap with no Phase 1 use |
| 22 | Wall clock = age since task creation | Active runtime: accumulates from `Provisioned`, pauses while `Suspended` | Suspension and admission waits consumed budget, contradicting suspend-and-resume and failing parked tasks that never ran |
| 23 | `DriverAttempts`; gate non-mutation asserted | `DriverRuns`/`maxDriverRuns`; gates run on read-only mounts with a snapshot-echo backstop (real executors) | "Attempts" read as remediation-only, excluding the initial run; "gates never mutate" needed a mechanism, not an assumption. Synthesized `@` identities are sanitized in object names (`@` is not DNS-1123) with identity preserved in the hashed suffix |

### v2.1 → v2.2 (with CONVERGENCE.md)

| # | v2.1 | v2.2 | Why |
|---|---|---|---|
| 24 | Infra exhaustion escalated uniformly for any step | Escalates only where no fallback exists — the driver and blocking gates; an exhausted fix action degrades to the driver, an exhausted non-blocking gate is tolerated at `Done` (ruling R1) | Uniform escalation let a broken fixer, or a broken gate that by definition cannot block `Done`, kill a task that had a defined fallback |
| 25 | Test coverage as a bullet list | `CONVERGENCE.md`: the normative package contract — exact types, `Fold` validation errors, glob dialect, Done predicate, an asserted termination bound, cases C01–C35, properties P1–P7 (including the world-model stale-green hunt), golden traces, fuzz targets | The bullets encoded decisions but not executable expectations; the pure core is the part worth validating exhaustively before Kubernetes enters |

## Appendix B — Reserved concepts (deferred, not discarded)

- **Diff-scoped gates (`scope: Diff`).** The suppression meta-gate judges the
  diff `base..snapshot`, not the tree. Its key is `(baseRev, snapshotID)`; a
  rebase invalidates diff-scoped gates and preserves tree-scoped ones. Phase 1
  defers this because the base ref never moves, making the two scopes
  behaviorally identical. Do **not** fold base identity into `snapshotID`
  itself — that would invalidate every gate on every rebase and destroy the
  monorepo-concurrency property the ledger exists for.
- **Multi-candidate execution (`AgentCandidate`).** A candidate owns its own
  snapshot lineage, gate state, and spend. Gates filter, they do not rank;
  selection tiebreak: integrity-gate clean (disqualifying), no new
  dependencies, smaller diff, reviewer score — and the integrity gate runs
  before ranking, because best-of-N is adversarial selection pressure toward
  gaming. Fan out cheap, converge to one candidate before provisioning
  anything stateful.
- **Parallel gates / FanOut.** `Failures` is already a list so one driver run
  can address multiple concurrent failures; the ledger key must grow an
  instance dimension before any step runs more than once concurrently.
- **Diff-size ratchet.** Early flailing detection (monotonic diff growth with
  blocking failures). A heuristic on top of termination, not part of it.
- **Findings.** Gate output as structured items requiring resolution, with a
  resolution path in the plan.
- **Tracker connectors and workflow selection.** `Ref | Tag | Auto | Default`
  resolution from trusted structured fields only — never ticket free text,
  which is writable by anyone with issue access, including the agent.
- **Merge policies and sampled audit.** `Manual | AutoOnGreen |
  AutoWithSampledAudit`, with post-merge validation feeding failures back as
  new gates.
- **Durable evidence store; Postgres projection** (gap-free: step finalizer
  released only after the append commits); **read API; UI; Kueue admission;
  real executors; git broker** (credentials never enter the sandbox — the
  broker pulls); **provenance `ValidatingAdmissionPolicy`** (§6.10);
  **class-change supersede policy** for running tasks; **per-class `cost`**
  feeding an expensive-runs budget.
