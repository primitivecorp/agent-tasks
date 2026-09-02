import { Badge } from "@/components/ui/badge";

type Kind = "does" | "checks" | "both";

type Step = { t: string; d: string; k: Kind };
type Phase = { label: string; steps: Step[] };

const phases: Phase[] = [
  {
    label: "Before the code",
    steps: [
      {
        t: "Create the ticket",
        d: "From a security scan, a self-review, a failing metric, a dependency update — or a person.",
        k: "does",
      },
      {
        t: "Add detail and verify the problem",
        d: "Reproduce it in a sandbox, attach the evidence, and make the ticket precise enough to act on.",
        k: "both",
      },
      {
        t: "Triage",
        d: "Route by labels, repository, and policy. Pick the workflow.",
        k: "does",
      },
    ],
  },
  {
    label: "The code",
    steps: [
      {
        t: "Implement",
        d: "Edit in an isolated sandbox: the code, the tests, the docs, the cleanup.",
        k: "does",
      },
      {
        t: "Check every version",
        d: "Lint, tests with clean logs, complexity limits, CPU and memory deltas, profiles of new functions, docs, integrity.",
        k: "checks",
      },
      {
        t: "Fix and repeat",
        d: "A failing check comes back with the evidence. Formatters and fixers run before an agent turn is spent.",
        k: "does",
      },
      {
        t: "Open and manage the pull request",
        d: "Describe the change, keep it current, address review — from people or from other agents.",
        k: "does",
      },
      {
        t: "Merge when the gates are clear",
        d: "By policy: automatic on green, or behind an approval gate the team places.",
        k: "does",
      },
    ],
  },
  {
    label: "After the code",
    steps: [
      {
        t: "Verify on staging",
        d: "The same gates, against the deployed change.",
        k: "checks",
      },
      {
        t: "Release",
        d: "By policy, like merge.",
        k: "does",
      },
      {
        t: "Verify in production",
        d: "The same gates, live: smoke, health, the specific behaviour the ticket named.",
        k: "checks",
      },
      {
        t: "Close the ticket",
        d: "Report what shipped, what was verified, and what it cost.",
        k: "does",
      },
    ],
  },
];

function KindBadge({ k }: { k: Kind }) {
  if (k === "both") {
    return (
      <span className="flex gap-1">
        <Badge variant="secondary">does</Badge>
        <Badge variant="outline" className="border-signal/50 bg-signal-soft text-signal">
          checks
        </Badge>
      </span>
    );
  }
  return k === "does" ? (
    <Badge variant="secondary">does</Badge>
  ) : (
    <Badge variant="outline" className="border-signal/50 bg-signal-soft text-signal">
      checks
    </Badge>
  );
}

const h2 = "font-heading text-[1.55rem] font-bold leading-[1.15] tracking-tight";

export function Capabilities() {
  return (
    <section aria-labelledby="cap" className="mb-14 grid gap-5">
      <h2 id="cap" className={h2}>
        Everything you used to do by hand is a step a task can run
      </h2>
      <p className="max-w-[72ch] text-[1.02rem] text-muted-foreground">
        A task is a workflow. Every stage below is a step it can perform itself — and every step is
        one of two kinds: it either <strong className="font-semibold text-foreground">does</strong>{" "}
        something to the code, or it{" "}
        <strong className="font-semibold text-foreground">checks</strong> a version of it and returns
        a verdict. This lifecycle is one example. Yours can add steps, drop steps, or put a person
        in the middle of one.
      </p>
      <div className="grid gap-5 md:grid-cols-3">
        {phases.map((ph) => (
          <div key={ph.label} className="grid content-start gap-2.5">
            <span className="font-mono text-[0.76rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {ph.label}
            </span>
            {ph.steps.map((s) => (
              <div key={s.t} className="grid gap-1.5 rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-heading text-[1.02rem] font-bold leading-snug">{s.t}</h3>
                  <KindBadge k={s.k} />
                </div>
                <p className="text-[0.92rem] leading-[1.45] text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="max-w-[72ch] text-[1.02rem] leading-[1.5]">
        <strong className="font-heading font-bold">Humans where you want them, not where you’re stuck
        with them.</strong>{" "}
        <span className="text-muted-foreground">
          None of these steps waits on a person by default. A team places human gates where it wants
          them — an approval before merge, a sign-off before release, an intent check on staging —
          and removes them as the automated gates earn trust. That’s a dial, not a boundary.
        </span>
      </p>
    </section>
  );
}
