# internal/convergence — Executable Contract and Test Specification

Companion to `implementation.md` (v2.2). Division of authority:
`implementation.md` §2 is normative for *semantics* — what the model means.
This document is normative for the *implementation* — exact types, exact
comparisons, edge-case rulings the spec leaves implicit, and the complete
test matrix. Where this document is more precise, it wins; where it would
contradict the spec's semantics, that is a bug in this document.

The other reviews converged on the same conclusion: if `Fold` + `Decide`
survive aggressive table, property, and fuzz testing, the interesting part of
the paradigm is validated before Kubernetes enters the picture. This document
is the plan for making that true.

---

## 1. Package contract

`internal/convergence` is plain Go. Hard rules, enforced by review and by the
import-lint check in CI:

1. **Zero Kubernetes imports.** Not `apimachinery`, not `client-go`, nothing.
   The controller maps API types to and from this package's types at its own
   boundary.
2. **No I/O, no clock, no randomness.** The package never calls `time.Now`,
   never reads files, never touches the network. Wall-clock spend arrives as
   a value the caller maintains (`Spend.ActiveRuntime`); everything else is
   pure data in, pure data out.
3. **Determinism.** Identical inputs produce byte-identical outputs. This
   forbids Go map iteration in any order-sensitive path: every walk iterates
   `Plan.Steps` (a slice, fixed in topological order at resolution), never a
   map.
4. **Value semantics.** `Fold` returns a new `View`; it never mutates its
   argument. Views are small (implementation.md §2.3 bounds them), so the deep
   copy is cheap and buys replayability: the controller can re-fold the same
   terminal execution after a crashed status write and get the same view.

The two exported functions:

```go
func NewView(baseSnapshot string, plan Plan) View
func Fold(v View, r ExecutionResult) (View, error)
func Decide(p Plan, v View, b Budgets) (Action, error)
```

plus validation helpers (`Plan.Validate`, `Budgets.Validate`) and the
constants of §8. `Decide` carries a caller invariant: it is consulted only
when no execution is active (single-flight is the controller's job, not this
package's).

---

## 2. Types

Complete definitions. Field comments here are contract, not decoration.

```go
type StepKind string
const (
    Action StepKind = "Action"
    Gate   StepKind = "Gate"
)

type GateResult string
const (
    Unknown GateResult = "Unknown" // absent counts as Unknown
    Passed  GateResult = "Passed"
    Failed  GateResult = "Failed"
    Errored GateResult = "Errored"
)

// ---- Plan: the resolved, immutable input --------------------------------

type Plan struct {
    Driver string // name of the one authored Action step
    Steps  []Step // topological order of `after`, ties by declaration order;
                  // fix actions are NOT in this slice (they hang off gates)
}

type Step struct {
    Name          string
    Kind          StepKind
    Blocking      bool     // gates only
    InvalidatedBy []string // gates only; already defaulted to ["**"] upstream
    FixAction     *Step    // gates only; synthesized, Name = "<gate>@fix"
    Injected      bool
}

// ---- View: the bounded working state ------------------------------------

type View struct {
    CurrentSnapshot string
    Lineage         []SnapshotRecord // seeded with the base snapshot (§4, R4)
    Oscillation     bool             // sticky once set

    Gates   map[string]GateState  // one entry per Gate step
    Actions map[string]ActionState // driver + every synthesized "<gate>@fix"

    DriverRuns int
    Spend      Spend
}

type GateState struct {
    Result           GateResult
    VerifiedSnapshot string
    Evidence         string // capped excerpt
    EvidenceRef      string
    FailureCount     int    // observability only; no control-flow reads it
    FixAttemptedAt   string // INPUT snapshot of the most recent fix attempt
    FixAttempts      int    // lifetime
    InfraRetries     int    // consecutive; reset only by success of this step
    ExecutionAttempt int    // completed (folded) executions of this step
}

type ActionState struct {
    Completions      int
    LastSnapshot     string
    InfraRetries     int // consecutive; reset only by success
    ExecutionAttempt int
}

type SnapshotRecord struct {
    Snapshot     string
    Parent       string
    FilesChanged int
    LinesChanged int
    PathsSample  []string // ≤ LineageSampleMax entries
    PathCount    int
}

type Spend struct {
    Tokens        int64
    ActiveRuntime time.Duration // maintained by the caller: accumulates from
                                // Provisioned, pauses while Suspended
}

type Budgets struct {
    Tokens             int64
    WallClock          time.Duration
    MaxDriverRuns      int
    FixAttemptsPerGate int
    InfraRetries       int
}

// ---- ExecutionResult: what Fold consumes --------------------------------

type ExecStatus string
const (
    Completed ExecStatus = "Completed" // ran to a verdict (actions: did work;
                                       // gates: produced Passed or Failed)
    Errored   ExecStatus = "Errored"   // infrastructure failure, no verdict
    Canceled  ExecStatus = "Canceled"  // suspend/deletion; no verdict
)

type Trigger string
const (
    Initial     Trigger = "Initial"
    GateFailure Trigger = "GateFailure"
    FixTrigger  Trigger = "FixAction"
)

type ExecutionResult struct {
    StepName      string   // plan step name or "<gate>@fix"
    Kind          StepKind
    Trigger       Trigger
    TriggerGate   string   // for GateFailure / FixAction
    InputSnapshot string
    Attempt       int      // MUST equal stored ExecutionAttempt + 1 (§4, R5)

    Status     ExecStatus
    GateResult GateResult // gates with Status == Completed
    ExitReason string

    // Actions with Status == Completed:
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

// ---- Action: what Decide returns -----------------------------------------

type ActionType string
const (
    RunAction ActionType = "RunAction"
    RunGate   ActionType = "RunGate"
    Escalate  ActionType = "Escalate"
    Done      ActionType = "Done"
)

type Decision struct { // returned as `Action` in prose; named Decision in code
    Type     ActionType
    StepName string     // plan step or "<gate>@fix"
    Trigger  Trigger
    Failures []FailureContext // list by schema; Phase 1 carries ≤ 1 entry
    Reason   EscalateReason
}

type FailureContext struct {
    Gate        string
    Evidence    string
    EvidenceRef string
}

type EscalateReason string
const (
    ReasonOscillation EscalateReason = "oscillation"
    ReasonWallClock   EscalateReason = "wall-clock"
    ReasonTokenBudget EscalateReason = "token-budget"
    ReasonInfra       EscalateReason = "infra"
    ReasonDriverRuns  EscalateReason = "driver-runs"
)
```

---

## 3. Decide — normative algorithm

Exact comparisons: spend limits use `>` ("exceeds"); run/attempt counters use
`>=` ("reaches"). First match wins; within a rule class, first step in
`Plan.Steps` order wins.

```
Decide(p, v, b):
  # ---- preamble: bounds that end the task wherever the walk stands -------
  if v.Oscillation                                → Escalate(ReasonOscillation)
  if v.Spend.ActiveRuntime > b.WallClock          → Escalate(ReasonWallClock)
  if v.Spend.Tokens        > b.Tokens             → Escalate(ReasonTokenBudget)
  if v.Actions[p.Driver].InfraRetries >= b.InfraRetries
                                                  → Escalate(ReasonInfra, driver)
  for step in p.Steps where step.Kind == Gate && step.Blocking:
      if v.Gates[step].InfraRetries >= b.InfraRetries
                                                  → Escalate(ReasonInfra, step)

  # ---- walk --------------------------------------------------------------
  for step in p.Steps:
    if step.Kind == Action:                 # only the driver, by admission
        if v.Actions[step].Completions == 0 → RunAction(step, Initial)
        continue

    g := v.Gates[step.Name]
    switch g.Result:
    case Passed:
        continue          # invariant: g.VerifiedSnapshot == v.CurrentSnapshot;
                          # anything else is ErrInvariant (§4), not a decision
    case Unknown:
        → RunGate(step)
    case Errored:
        if g.InfraRetries < b.InfraRetries  → RunGate(step)
        continue          # only NON-BLOCKING gates reach this line — blocking
                          # exhaustion escalated in the preamble. An unrunnable
                          # non-blocking gate must not be able to block Done.
    case Failed:
        if !step.Blocking:                    continue
        fix := step.FixAction
        if fix != nil
           && g.FixAttemptedAt != v.CurrentSnapshot
           && g.FixAttempts    <  b.FixAttemptsPerGate
           && v.Actions[fix.Name].InfraRetries < b.InfraRetries
                                            → RunAction(fix.Name, FixTrigger(step))
        if v.DriverRuns >= b.MaxDriverRuns  → Escalate(ReasonDriverRuns, step)
                                            → RunAction(p.Driver,
                                                        GateFailure(step),
                                                        failures=[{step, g.Evidence,
                                                                   g.EvidenceRef}])

  # ---- fixed point --------------------------------------------------------
  return Done
```

### Rulings

These are the decisions the spec's prose leaves implicit. Each is pinned by a
test case in §7.

- **R1 — Infra exhaustion escalates only where no fallback exists.** The
  driver and blocking gates escalate (`ReasonInfra`). A fix action whose
  infra is exhausted is skipped by the fourth conjunct — the gate degrades to
  the driver, exactly as if the fix cap were spent; a broken fixer must not
  kill a task that has a defined fallback. A non-blocking gate that cannot
  run is tolerated: it degrades to the same standing as a non-blocking
  failure. (Safety of the unconditional driver preamble check: the driver's
  counter is consecutive and reset by success, so `InfraRetries >= cap`
  entails its most recent runs all errored, which entails either it never
  completed or the gate that re-triggered it is still Failed — in both
  worlds the driver is needed, so the escalation can never fire in a state
  that did not require the driver.)
- **R2 — Failed results carry forward exactly like Passed.** §2.2's
  invalidation rule applies to "a recorded result", not to passes: a gate
  Failed at `h` whose globs miss the change is Failed at `h'` with
  `VerifiedSnapshot` re-stamped. Consequence: a driver run that does not
  touch a failed gate's declared paths leaves it Failed and burns budget —
  correct, and bounded by `MaxDriverRuns`.
- **R3 — Contradictory action results over-invalidate.** `ResultSnapshot !=
  InputSnapshot` with an empty `ChangedPaths` and no truncation flag is an
  executor contradiction; `Fold` treats it as truncated (clear every gate).
  Conservative in the only safe direction.
- **R6 — Zero-valued budgets are invalid, not infinite and not instant.**
  `Budgets.Validate()` requires every field positive; the controller applies
  defaults at resolution. The package never interprets 0.

---

## 4. Fold — normative transitions

`Fold(v, r) → (View, error)`. Validation first; a validation error means the
caller handed the package garbage, and the returned view is unchanged:

| Check | Error |
|---|---|
| `r.StepName` is a plan step or a synthesized `<gate>@fix` for a plan gate | `ErrUnknownStep` |
| `r.Attempt == stored ExecutionAttempt + 1` | `ErrAttemptReplay` (**R5**: the controller folds and persists in one status write; a crash before the write re-folds the same result against the same stored counter, so a legitimate replay always presents `stored+1`. Anything else is a double-fold bug and must be loud, not absorbed.) |
| `r.InputSnapshot == v.CurrentSnapshot` | `ErrStaleInput` (single-flight makes this impossible; loud beats silent) |
| Gate with `Status == Completed` echoes `ResultSnapshot == InputSnapshot` (when set) | `ErrGateMutation` (defense in depth behind the executor-level check of implementation.md §5.3) |

Then, by case — every rule below also increments the step's
`ExecutionAttempt` (that is what frees the next deterministic AgentStep
name), and adds `TokensIn/Out` to spend:

**Canceled** (either kind): nothing else changes. R5's counter increment is
the entire effect.

**Errored** (either kind): `InfraRetries++` on the step. Gates additionally
record `Result = Errored`. No completion, no `FixAttempts`, no
`FixAttemptedAt`, no `DriverRuns`.

**Gate Completed**: `Result = r.GateResult`, `VerifiedSnapshot =
r.InputSnapshot`, evidence fields copied (capped at `MaxEvidenceInline`),
`FailureCount++` on Failed, `InfraRetries = 0`.

**Action Completed**: `Completions++`, `LastSnapshot = r.ResultSnapshot`,
`InfraRetries = 0`; `DriverRuns++` if the step is the driver. If the trigger
was `FixAction`: `FixAttempts++` and `FixAttemptedAt = r.InputSnapshot` on
the attributed gate. Then the snapshot logic:

1. `r.ResultSnapshot == v.CurrentSnapshot` → no-op mutation: no lineage
   append, no invalidation, **not** oscillation.
2. Otherwise: if `r.ResultSnapshot` equals any lineage entry other than the
   current snapshot (a non-parent ancestor) → set `Oscillation = true`
   (sticky). Append a `SnapshotRecord` (paths sampled to
   `LineageSampleMax`), adopt `CurrentSnapshot = r.ResultSnapshot`, and apply
   invalidation to every gate with a recorded result:
   - effective change set = `["**"]` if `ChangedPathsTruncated` or the R3
     contradiction holds, else `r.ChangedPaths`;
   - change set ∩ `glob(step.InvalidatedBy)` empty → re-stamp
     `VerifiedSnapshot = CurrentSnapshot` (Passed **and** Failed alike, R2);
   - otherwise → `Result = Unknown` (evidence fields retained for
     observability; control flow never reads stale evidence).

**R4 — lineage is seeded.** `NewView(base, plan)` initializes
`CurrentSnapshot = base`, `Lineage = [{Snapshot: base}]`, every plan gate at
`Unknown`, every action (driver and each `<gate>@fix`) at zero. Seeding the
base is what makes a later revert-to-base an oscillation, matching the
paper's "tree hash seen twice ⇒ cycle".

### The Done predicate

`Decide` returns `Done` exactly when the walk falls through, which is
equivalent to:

```
  ∀ Action a in p.Steps:            Completions(a) ≥ 1        # the driver
∧ ∀ blocking Gate g:                Result(g) == Passed
                                    ∧ VerifiedSnapshot(g) == CurrentSnapshot
∧ ∀ non-blocking Gate g:            Result(g) ∈ {Passed, Failed}
                                    ∧ VerifiedSnapshot(g) == CurrentSnapshot
                                    ∨ InfraRetries(g) ≥ b.InfraRetries   # R1
```

Fix actions are not in `p.Steps` and impose no Done obligation.

---

## 5. Termination bound

The property suite (§7.3, P1) asserts a computable bound, not just "it
stopped". With `G` = gates, `F` = gates carrying a fix action:

```
driver completions   ≤ MaxDriverRuns
fix completions      ≤ F · FixAttemptsPerGate
action completions   ≤ MaxDriverRuns + F · FixAttemptsPerGate =: A
snapshots (lineage)  ≤ A + 1
gate completions     ≤ G · (A + 1)              # a gate reruns only when a new
                                                # snapshot cleared it
errored executions   ≤ InfraRetries · (completions + 1)   per step, because the
                                                # counter is consecutive
total executions     ≤ (A + G·(A+1)) · (InfraRetries + 1) + small constant
```

Oscillation, wall clock, and tokens only tighten this. Every `Decide` call
either returns a terminal (`Done`/`Escalate`) or schedules an execution that
strictly consumes one of the bounded quantities above — that is the
termination argument, and P1 checks the arithmetic against reality.

---

## 6. Glob dialect (R7)

Pinned to `github.com/bmatcuk/doublestar/v4` semantics:

- Patterns match the **whole** repository-relative path, `/`-separated, no
  leading `./`, case-sensitive.
- `**` spans directory separators; `*` does not.
- The executor contract (implementation.md §5.3) delivers paths in exactly this
  normalized form; `Fold` does not re-normalize.

A pattern that fails to compile is a plan-resolution error
(`Plan.Validate()`), never a runtime decision.

---

## 7. Test specification

### 7.1 Fixture vocabulary

One standard plan, reused by most cases — `pyMinimal`:

```
implement          Action, driver
lint               Gate, blocking, invalidatedBy ["**/*.py"], fix lint@fix
unit               Gate, blocking, invalidatedBy ["**"]
integrity@policy   Gate, blocking, invalidatedBy ["**"], injected
nb-metrics         Gate, non-blocking, invalidatedBy ["**"]     (variant plans)
```

Budgets unless stated: `MaxDriverRuns 3, FixAttemptsPerGate 2,
InfraRetries 2, Tokens 1e6, WallClock 20m`. Snapshots are letters `h0…h5`;
`edit(paths…)` denotes an action result carrying those changed paths.

### 7.2 Table-driven cases

Each case is one `Fold`/`Decide` interaction with an explicit expectation,
and pins the named clause. IDs are stable — reference them in test names.

| ID | Case | Expect | Pins |
|---|---|---|---|
| C01 | `unit` Passed@h1; driver edits `README.md` → h2 | `unit` Unknown (default `**`) | §2.2 default |
| C02 | `lint` Passed@h1; edit `docs/x.md` → h2 | `lint` Passed, `VerifiedSnapshot` re-stamped h2 | §2.2 carry |
| C03 | `lint` Passed@h1; edit `src/a.py` → h2 | `lint` Unknown, not Failed | §2.2 clear |
| C04 | Result with `ChangedPathsTruncated` | every gate Unknown | §2.2 truncation |
| C05 | `ResultSnapshot != input`, empty paths, no flag | treated as truncated | R3 |
| C06 | Action completes with `ResultSnapshot == current` | completion recorded; no lineage append; no oscillation | §2.4 Fold 1 |
| C07 | Rebase-shaped edit (only `vendor/**`) with `lint` Passed | `lint` survives | §2.2 corollary |
| C08 | Two successive edits | lineage `h0→h1→h2`, parents linked, samples capped | §2.3 |
| C09 | `lint` **Failed**@h1; edit `docs/x.md` → h2 | `lint` still Failed, re-stamped h2 | R2 |
| C10 | Edit produces `h1` again after `h0→h1→h2` | `Oscillation` set; next `Decide` = Escalate(oscillation) | §2.4 Fold 2 |
| C11 | Edit produces `h0` (revert to base) | oscillation — lineage is seeded | R4 |
| C12 | All gates Passed@h0 (no `after` edges), driver never ran | `RunAction(implement, Initial)` — never Done | §2.4 no-op |
| C13 | `lint` Failed, `unit` Unknown | walk short-circuits at `lint`; `unit` not scheduled | §2.4 walk order |
| C14 | `nb-metrics` Unknown | `RunGate(nb-metrics)` — non-blocking gates still run | §2.4 |
| C15 | `lint` Failed@h1, fix unattempted | `RunAction(lint@fix, FixAction)` before any driver run | §2.4 fix-first |
| C16 | `lint@fix` completes as no-op (h1→h1); `lint` still Failed@h1 | `FixAttemptedAt == h1` ⇒ next is driver, not the fixer | §2.4 Fold 3 |
| C17 | `lint` fails at h1, h2 with fixes each time; `FixAttempts == 2` | third failure goes straight to driver | §2.4 fix cap |
| C18 | blocking failure with `DriverRuns == 3` | Escalate(driver-runs) | §2.4 driver cap |
| C19 | final budgeted driver run produces h3; `unit` Unknown@h3 | `RunGate(unit)` — the last fix is observed, never escalated past | §2.4 property |
| C20 | `nb-metrics` Failed@current, everything else green, driver ran | Done | §2.4 blocking |
| C21 | `unit` Passed@h1 (not re-stamped), current h2 | `RunGate(unit)`; Done unreachable | §2.4 Done |
| C22 | driver ran, all blocking Passed@current | Done | §2.4 |
| C23 | `unit` Errored once | `RunGate(unit)` retry | §2.4 Errored |
| C24 | `unit` (blocking) `InfraRetries == 2` | preamble Escalate(infra) | R1 |
| C25 | error, success, error on one step | no escalation — reset on success | §2.4 Fold |
| C26 | error at h1, snapshot moves to h2, error again | `InfraRetries == 2` ⇒ escalate — snapshot change resets nothing | §2.4 Fold |
| C27 | `lint@fix` `InfraRetries == 2`, `lint` Failed | fix skipped (4th conjunct) ⇒ driver; no FixAttempts burned by the errors | R1 |
| C28 | `nb-metrics` `InfraRetries == 2`, all else green | Done — exhausted non-blocking gate tolerated | R1, Done |
| C29 | driver Errored twice | `DriverRuns` unchanged; Escalate(infra) via preamble | §2.4 Fold |
| C30 | any fold, including Canceled | `ExecutionAttempt` +1 exactly once | R5, §2.3 |
| C31 | Canceled fold | nothing but the attempt counter changes | §2.4 Fold |
| C32 | same `(plan, view, budgets)` twice | identical `Decision`; same `(view, result)` twice | contract §1.3 |
| C33 | `ActiveRuntime > WallClock` | Escalate(wall-clock) | §2.5 |
| C34 | `Tokens` exceeded | Escalate(token-budget) | §2.5 |
| C35 | `r.Attempt != stored+1` / unknown step / stale input / gate echo mismatch | the four `Fold` errors, view unchanged | §4 |

### 7.3 Properties

Run under `testing/quick` or rapid-style generation; each property drives the
simulation harness (§7.4) with generated plans, budgets, and worlds.

- **P1 — Bounded termination.** For any world, the converge loop reaches
  `Done` or `Escalate` in at most the §5 bound of executions. Assert the
  count, not just termination.
- **P2 — Purity.** Re-running any recorded `Fold`/`Decide` call yields
  byte-identical output (also run the suite with `GODEBUG=randseednop=0`-style
  map-order hostility: shuffle map insertion order when constructing views).
- **P3 — No stale green** (the one that hunts false carry-forward). In a
  world where every gate's verdict is a pure function of the files matching
  its *concern set*, and every generated gate declares `invalidatedBy ⊇`
  concern set (the authoring contract), then at `Done` every gate re-evaluated
  directly against the final world passes. A deliberate second generator
  violates the authoring contract (`invalidatedBy ⊉` concern) and asserts the
  harness **does** produce stale green — proving the property has teeth and
  the contract is load-bearing.
- **P4 — Monotonicity.** `ExecutionAttempt`, `FixAttempts`, `FailureCount`,
  `DriverRuns`, spend, and lineage length never decrease across folds;
  `InfraRetries` decreases only to zero and only on a success of that step.
- **P5 — Done soundness.** Whenever `Decide` returns `Done`, the §4 Done
  predicate holds on the view, verified independently of the walk.
- **P6 — Fix dedupe.** No trace contains two fix-action executions for the
  same (gate, input snapshot).
- **P7 — Oscillation priority.** After a fold sets `Oscillation`, no further
  execution is ever scheduled.

### 7.4 Simulation harness and the world model

One loop used by P1–P7 and the golden tests:

```go
// Converge drives Decide against a world until terminal; returns the trace.
func Converge(p Plan, b Budgets, w World, maxSteps int) (Outcome, []Event)

type World interface {
    // RunGate evaluates the gate against current world state.
    RunGate(gate string) (GateResult, evidence string)
    // RunAction applies the next scripted/generated edit, returns the result.
    RunAction(step string, trigger Trigger) ExecutionResult
}
```

The generated world for P3: `files map[string]int` (path → version); each
gate owns a concern glob; its verdict is a deterministic predicate over the
versions of matching files (e.g. parity of their sum, with the driver's
"fix" incrementing versions until the predicate flips). Actions mutate a
random subset of files and report exactly the touched paths; a hostile
variant reports truncated or contradictory change sets to exercise C04/C05
paths under the loop.

### 7.5 Golden traces

- **G1** — the fake-executor script of implementation.md §5.3 encoded as a
  scripted `World`; assert the exact decision sequence of the §10 reference
  trace, line for line (initial driver, lint fail, `lint@fix`, re-lint, unit
  fail, driver run 2, full re-verify at h3, Done).
- **G2** — the same script with the `lint@fix` entry replaced by a no-op
  result: assert one fixer attempt, then driver.
- **G3** — oscillation script (driver alternates two snapshots): assert
  Escalate(oscillation) on the second visit, before any further scheduling.

### 7.6 Fuzz

Go native fuzzing:

- **F1** — `FuzzFold`: arbitrary `ExecutionResult` bytes against a valid
  view: never panics; returns either a §4 error (view unchanged) or a view
  satisfying P4's monotonicity and the internal invariant (Passed ⇒
  `VerifiedSnapshot == CurrentSnapshot`).
- **F2** — `FuzzGlobs`: arbitrary patterns and paths through the §6 matcher:
  never panics; compile failures only ever surface via `Plan.Validate`.

---

## 8. Implementation notes

- Constants: `MaxEvidenceInline = 4096`, `MaxChangedPaths = 2048`,
  `LineageSampleMax = 16`. Exported — the controller and executors share
  them.
- Errors: `ErrUnknownStep`, `ErrAttemptReplay`, `ErrStaleInput`,
  `ErrGateMutation`, `ErrInvariant` — all `errors.Is`-able sentinels wrapped
  with `%w` and context.
- A `Passed` gate with `VerifiedSnapshot != CurrentSnapshot` cannot exist
  (invalidation re-stamps or clears); `Decide` returns `ErrInvariant` rather
  than guessing. Loud beats silent, in both directions.
- File layout: `types.go`, `fold.go`, `decide.go`, `glob.go`, `validate.go`;
  tests as `fold_test.go`, `decide_test.go`, `properties_test.go`,
  `harness_test.go`, `golden_test.go`, `fuzz_test.go`.
- `Plan.Validate()` re-checks what admission guarantees (single Action,
  driver named, DAG order given, globs compile, `@` only in synthesized
  names) so the package is safe against a buggy caller, and the tests can
  construct plans without the controller.
- Dependency budget: `doublestar/v4` and the standard library. Nothing else.

## 9. Traceability

Every ruling and clause above is pinned: R1 → C24/C27/C28, R2 → C09,
R3 → C05, R4 → C11, R5 → C30/C35, R6 → `Budgets.Validate` unit tests,
R7 → F2 and C01–C03. The §5 bound → P1. The implementation.md §8 Step-1 bullet
list is covered by C01–C35 ∪ {P3, P5}; CI fails if a bullet loses its named
test. When `internal/convergence` is green under this matrix, Kubernetes may
enter the picture (implementation.md §8, Steps 2–5).
