import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const h2 = "font-heading text-[1.55rem] font-bold leading-[1.15] tracking-tight";
const svgText = "fill-current font-mono text-[13px]";
const svgNote = "fill-muted-foreground font-sans text-[11px]";

const kinds = [
  {
    kind: "AgentStepClass",
    scope: "cluster",
    writer: "platform admins",
    what: "A capability: an Action that changes code (the agent, a formatter) or a Gate that judges a version of it (lint, tests, a review). Image, command, timeout, budgets.",
  },
  {
    kind: "AgentClusterPolicy",
    scope: "cluster",
    writer: "platform admins",
    what: "Which classes may run, which gates every task must pass, budget ceilings, and the namespace template each task gets. One object, named default. No policy, no tasks.",
  },
  {
    kind: "AgentWorkflow",
    scope: "namespace",
    writer: "teams",
    what: "Composition only: which steps run, in what order, and which paths invalidate each verdict. A step has no behavioural fields, so a team cannot weaken a gate or add an image.",
  },
  {
    kind: "AgentTask",
    scope: "namespace",
    writer: "people, connectors",
    what: "One ticket’s intent: the goal and the workflow. Its status is the live state of the loop: current version, every gate’s verdict and the version it judged, spend, the one execution in flight.",
  },
  {
    kind: "AgentStep",
    scope: "namespace",
    writer: "the operator",
    what: "One bounded execution, an agent turn or a gate run, with everything it needs copied from the pinned plan and its result. Immutable; its name is the idempotency key.",
  },
];

const workflowYaml = `apiVersion: agents.primitive.dev/v1alpha1
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
      after: [lint]`;

const taskYaml = `apiVersion: agents.primitive.dev/v1alpha1
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
    name: python-minimal`;

// Five boxes, one reconcile loop. x = 20 + i*232, width 200.
const boxes = [
  { t: "AgentTask", n: "goal + workflowRef; status holds the view" },
  { t: "Decide", n: "plan + view + budgets → one next step" },
  { t: "AgentStep", n: "immutable execution record" },
  { t: "executor", n: "runs in the task’s own namespace" },
  { t: "Fold", n: "result → view: verdicts keyed to versions" },
];
const X = (i: number) => 20 + i * 232;
const CX = (i: number) => X(i) + 100;

export function Resources() {
  return (
    <section aria-labelledby="resources" className="mb-14 grid gap-5">
      <h2 id="resources" className={h2}>
        Five resources and one operator
      </h2>
      <p className="max-w-[72ch] text-[1.02rem]">
        Everything is a Kubernetes object in the group{" "}
        <code className="font-mono text-[0.92em]">agents.primitive.dev/v1alpha1</code>. Administrators
        own what can run and what every task must pass. Teams compose. The operator reconciles, and
        nothing but the operator writes status.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[12rem]">Kind</TableHead>
              <TableHead className="w-[6.5rem]">Scope</TableHead>
              <TableHead className="w-[9rem]">Written by</TableHead>
              <TableHead>What it is</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kinds.map((k) => (
              <TableRow key={k.kind}>
                <TableCell className="font-mono text-[0.86rem] font-medium">{k.kind}</TableCell>
                <TableCell className="text-muted-foreground">{k.scope}</TableCell>
                <TableCell className="text-muted-foreground">{k.writer}</TableCell>
                <TableCell className="whitespace-normal text-[0.95rem] leading-[1.45]">{k.what}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="mt-2 font-heading text-[1.15rem] font-bold">What a team writes</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <figure className="m-0 grid gap-2">
          <pre className="m-0 overflow-x-auto rounded-md border border-border bg-code p-4 font-mono text-[0.8rem] leading-[1.5]">
            <code>{workflowYaml}</code>
          </pre>
          <figcaption className="text-[0.9rem] text-muted-foreground">
            A workflow: the agent as driver, gates ordered cheapest first. <code className="font-mono">unit</code>{" "}
            declares no <code className="font-mono">invalidatedBy</code>, so any change re-runs the tests.
          </figcaption>
        </figure>
        <figure className="m-0 grid gap-2">
          <pre className="m-0 overflow-x-auto rounded-md border border-border bg-code p-4 font-mono text-[0.8rem] leading-[1.5]">
            <code>{taskYaml}</code>
          </pre>
          <figcaption className="text-[0.9rem] text-muted-foreground">
            A task: a goal and a workflow. Nothing else is inferred. Every field except{" "}
            <code className="font-mono">suspend</code> is frozen once created.
          </figcaption>
        </figure>
      </div>
      <p className="max-w-[72ch] text-[1.02rem] leading-[1.5]">
        That is the entire authoring surface for a team. Images, commands and per-run budgets live on
        classes an administrator owns. The gates every task must pass come from the cluster policy and
        are injected into the plan at admission, where the team cannot see or remove them.
      </p>

      <h3 className="mt-2 font-heading text-[1.15rem] font-bold">How the operator runs a task</h3>
      <figure className="m-0 grid gap-3">
        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 1180 190"
            role="img"
            aria-label="The reconcile loop: an AgentTask's view feeds Decide, which picks one next step; the operator creates an AgentStep; an executor runs it in the task's namespace; Fold applies the result to the view; repeat until every blocking gate is passed at the current version."
            className="block h-auto w-full min-w-[760px] text-foreground"
          >
            <defs>
              <marker id="rs-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M0 0L10 5L0 10z" fill="currentColor" />
              </marker>
            </defs>
            {boxes.map((b, i) => (
              <g key={b.t}>
                <rect
                  x={X(i)}
                  y="40"
                  width="200"
                  height="56"
                  rx="8"
                  className={i === 1 || i === 4 ? "fill-signal-soft stroke-signal" : "fill-card stroke-border"}
                  strokeWidth="1.5"
                />
                <text x={CX(i)} y="74" textAnchor="middle" className={svgText}>
                  {b.t}
                </text>
                <text x={CX(i)} y="118" textAnchor="middle" className={svgNote}>
                  {b.n}
                </text>
                {i < boxes.length - 1 ? (
                  <line
                    x1={X(i) + 200}
                    y1="68"
                    x2={X(i + 1) - 2}
                    y2="68"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    markerEnd="url(#rs-arr)"
                  />
                ) : null}
              </g>
            ))}
            {/* return: Fold → AgentTask view */}
            <path
              d={`M ${CX(4)} 96 V 150 H ${CX(0)} V 100`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeDasharray="4 4"
              markerEnd="url(#rs-arr)"
            />
            <text x={(CX(0) + CX(4)) / 2} y="168" textAnchor="middle" className={svgNote}>
              one execution in flight per task · repeat until every blocking gate is Passed at the current version · then Validated → namespace released → Succeeded
            </text>
          </svg>
        </div>
        <figcaption className="max-w-[72ch] text-[0.92rem] text-muted-foreground">
          Two pure functions do the deciding. <code className="font-mono">Fold</code> applies a finished
          step to the view, clearing exactly the verdicts the change invalidates.{" "}
          <code className="font-mono">Decide</code> returns one next step, an escalation with a reason, or
          done. The controller is a thin shell around them, which is why it survives crashes: an execution
          is created at most once and a result is folded exactly once.{" "}
          <Link href="/docs/concepts/model" className="underline decoration-signal decoration-[1.5px] underline-offset-[3px]">
            The convergence model
          </Link>
          .
        </figcaption>
      </figure>
    </section>
  );
}
