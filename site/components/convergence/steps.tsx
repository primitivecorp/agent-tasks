import type { ReactNode } from "react";

export type GateStatus = "unknown" | "pass" | "fail";
export type GateKey = "lint" | "tests" | "integ";
export type GateState = { s: GateStatus; at: string; note?: string };
export type ActorKind = "idle" | "live" | "done";

export type Version = { id: string; by: string };

export type Step = {
  title: string;
  body: ReactNode;
  sys: string;
  /** index into `versions` of the current snapshot */
  cur: number;
  changed?: string[];
  actor: { kind: ActorKind; text: string };
  gates: Record<GateKey, GateState>;
};

export const versions: Version[] = [
  { id: "h0", by: "starting point" },
  { id: "h1", by: "agent edit" },
  { id: "h2", by: "auto-fix" },
  { id: "h3", by: "agent fix" },
];

export const gateMeta: Record<GateKey, { name: string; desc: string }> = {
  lint: { name: "lint", desc: "code style · ruff" },
  tests: { name: "tests", desc: "test suite · pytest" },
  integ: { name: "integrity", desc: "required by cluster policy" },
};

const U = (at: string, note?: string): GateState => ({ s: "unknown", at, note });
const P = (at: string): GateState => ({ s: "pass", at });
const F = (at: string, note: string): GateState => ({ s: "fail", at, note });

export const steps: Step[] = [
  {
    title: "A ticket arrives",
    body: (
      <>
        Bug report: <strong>CSV export drops the last row.</strong> Acceptance criteria: a new test
        that covers it, and the existing export tests still pass. Three checks — gates — will judge
        the work: <strong>lint</strong> (code style), <strong>tests</strong> (the test suite) and{" "}
        <strong>integrity</strong> (required by the cluster’s policy; it confirms no check was
        disabled and no test deleted). One agent does the editing. A formatter is on hand to fix
        style problems automatically.
      </>
    ),
    sys:
      "An AgentTask is admitted against a pinned plan: driver = implement; gates lint → tests; integrity@policy injected by the AgentClusterPolicy. Nothing about this plan can change while the task runs.",
    cur: 0,
    actor: { kind: "idle", text: "Nothing is running yet" },
    gates: { lint: U("h0"), tests: U("h0"), integ: U("h0") },
  },
  {
    title: "Start: nothing is known yet",
    body: (
      <>
        The code sits at its starting version, <code>h0</code>. No gate has judged anything. And
        even if <code>h0</code> already passed every check, that wouldn’t count — the agent has to
        do the work before “done” is possible.
      </>
    ),
    sys:
      "Decide → RunAction(implement, Initial). Done is unreachable while the driver has zero completions, so a base tree that is already green can never be mistaken for success.",
    cur: 0,
    actor: { kind: "live", text: "Agent editing in its sandbox" },
    gates: { lint: U("h0"), tests: U("h0"), integ: U("h0") },
  },
  {
    title: "The agent edits → h1",
    body: (
      <>
        The agent changes the export code and its test. That is a new version, <code>h1</code>.
        Every gate is unknown for <code>h1</code> — a verdict only ever describes the version it
        looked at, and none has looked at this one.
      </>
    ),
    sys:
      'Fold: lineage h0 → h1; changed paths src/export.py, tests/test_export.py. Every gate defaults to invalidatedBy ["**"], so all are Unknown.',
    cur: 1,
    changed: ["src/export.py", "tests/test_export.py"],
    actor: { kind: "idle", text: "New version h1 — ready to be checked" },
    gates: { lint: U("h1"), tests: U("h1"), integ: U("h1") },
  },
  {
    title: "Lint fails on h1",
    body: (
      <>
        Lint runs against <code>h1</code> and fails: one line is too long. Before spending an agent
        turn, the system reaches for the cheapest fix that could work — the formatter.
      </>
    ),
    sys:
      "lint = Failed@h1. Decide → RunAction(lint@fix, FixAction). Remediation escalates in cost: fix action first, driver second.",
    cur: 1,
    changed: ["src/export.py", "tests/test_export.py"],
    actor: { kind: "live", text: "Running lint on h1" },
    gates: { lint: F("h1", "E501 line too long · src/export.py:41"), tests: U("h1"), integ: U("h1") },
  },
  {
    title: "The formatter fixes it → h2",
    body: (
      <>
        The formatter rewraps the line: version <code>h2</code>. Lint’s failure was about{" "}
        <code>h1</code>, so it no longer applies — lint is unknown again, not “failed”. Tests and
        integrity still haven’t run.
      </>
    ),
    sys:
      "Fold: lineage h1 → h2; lint.FixAttemptedAt = h1; lint cleared because src/export.py matches its globs. A no-op formatter would have left lint Failed and sent the gate straight to the driver.",
    cur: 2,
    changed: ["src/export.py"],
    actor: { kind: "live", text: "Formatter auto-fixing (lint@fix)" },
    gates: {
      lint: U("h2", "was: failed on h1 — no longer applies"),
      tests: U("h2"),
      integ: U("h2"),
    },
  },
  {
    title: "Lint passes h2. Tests fail h2.",
    body: (
      <>
        Lint runs again and passes — its verdict is stamped “verified at h2”. Tests run next and
        fail: the trailing-row test still breaks. There is no auto-fix for a failing test, so the
        agent is called back with the exact failure in hand.
      </>
    ),
    sys:
      "lint = Passed@h2; tests = Failed@h2. No fixAction on tests → Decide → RunAction(implement, GateFailure(tests), failures=[tests]). Driver run 2 of 5.",
    cur: 2,
    changed: ["src/export.py"],
    actor: { kind: "live", text: "Running lint, then tests, on h2" },
    gates: {
      lint: P("h2"),
      tests: F("h2", "test_export_trailing_row: AssertionError"),
      integ: U("h2"),
    },
  },
  {
    title: "The agent fixes the bug → h3",
    body: (
      <>
        The agent fixes the off-by-one and finishes the test: version <code>h3</code>. Now
        everything that looked at the changed files is unknown again — including lint, which passed{" "}
        <code>h2</code>. A green light on an old version is not a green light on this one.
      </>
    ),
    sys:
      "Fold: lineage h2 → h3; lint, tests and integrity@policy all cleared. This is the step a pipeline cannot express: a verdict became unknown because the tree changed underneath it.",
    cur: 3,
    changed: ["src/export.py", "tests/test_export.py"],
    actor: { kind: "live", text: "Agent fixing the bug, with the test failure in hand" },
    gates: {
      lint: U("h3", "was: passed on h2 — not valid for h3"),
      tests: U("h3", "was: failed on h2"),
      integ: U("h3"),
    },
  },
  {
    title: "Everything re-checks h3",
    body: (
      <>
        Lint passes. Tests pass. Integrity passes — it re-checks every change, by policy, and
        confirms nothing was suppressed or deleted. All three verdicts now carry the same stamp:{" "}
        <code>h3</code>.
      </>
    ),
    sys: "All blocking gates Passed with verifiedSnapshot == currentSnapshot (h3).",
    cur: 3,
    changed: ["src/export.py", "tests/test_export.py"],
    actor: { kind: "live", text: "Running all three gates on h3" },
    gates: { lint: P("h3"), tests: P("h3"), integ: P("h3") },
  },
  {
    title: "Done",
    body: (
      <>
        The agent has worked, and every required gate is green for the same version. The change is
        ready for a pull request; the sandbox is released. That is the whole loop: edit, check, and
        repeat until all the lights are green for one version at once.
      </>
    ),
    sys: "Decide → Done → condition Validated → work namespace released → Succeeded.",
    cur: 3,
    changed: ["src/export.py", "tests/test_export.py"],
    actor: { kind: "done", text: "Done — ready for a pull request" },
    gates: { lint: P("h3"), tests: P("h3"), integ: P("h3") },
  },
];
