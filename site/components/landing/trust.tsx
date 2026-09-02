import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const h2 = "font-heading text-[1.55rem] font-bold leading-[1.15] tracking-tight";

const points = [
  {
    t: "No stale green",
    d: "A verdict is recorded against the version and the verifier that produced it. A change to the code clears the verdicts whose declared paths it touches, and by default it clears them all. Green at an older version is unknown for the current one.",
  },
  {
    t: "Policy is enforced at admission",
    d: "Required gates are injected into every plan as <name>@policy: always blocking, always re-run, impossible to remove or shadow from a workflow. Budgets over a ceiling are rejected, never clamped. A cluster without a policy admits nothing.",
  },
  {
    t: "It always stops",
    d: "A cap on agent runs, a wall-clock budget that pauses when the task does, a token budget, retry limits, and loop detection when the agent returns to a version it already produced. Five reasons, each stated on the task.",
  },
  {
    t: "The agent only touches code",
    d: "Task spec is frozen after creation; status is written by the operator alone. The agent works in its own namespace behind default-deny network policy and never holds a credential. Merges, releases and ticket edits are performed by connectors.",
  },
  {
    t: "Crash-safe by construction",
    d: "Step names are deterministic from stored state, so a retry recomputes the same name and creation is idempotent. Results fold exactly once. A controller restart replays; it never repeats an agent run.",
  },
];

export function Trust() {
  return (
    <section aria-labelledby="trust" className="mb-14 grid gap-5">
      <h2 id="trust" className={h2}>
        What the operator guarantees
      </h2>
      <p className="max-w-[70ch] text-[1.02rem]">
        Letting an agent iterate is reasonable because of properties of the loop, not a feeling about
        the model. Each of these is enforced in code, validation rules or RBAC.
      </p>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {points.map((p) => (
          <Card key={p.t} size="sm">
            <CardHeader>
              <CardTitle>{p.t}</CardTitle>
              <CardDescription className="text-[0.95rem] leading-[1.45]">{p.d}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
