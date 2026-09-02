import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const h2 = "font-heading text-[1.55rem] font-bold leading-[1.15] tracking-tight";

const points = [
  {
    t: "No stale green",
    d: "Every check is tied to the exact version of the code it judged. Change the code and the verdict goes back to unknown until it is earned again.",
  },
  {
    t: "Required checks can’t be removed",
    d: "The cluster’s policy adds them to every task. Not the team, not the agent, not a look-alike step can take them out or weaken them.",
  },
  {
    t: "It always stops",
    d: "A fixed number of agent runs, a time budget, a token budget, and loop detection. Every task ends with a stated reason — success or otherwise.",
  },
  {
    t: "The agent only touches code",
    d: "It works in its own sandbox and cannot edit the task, the checks, or the budgets. Everything it does flows through the code and the verdicts about it.",
  },
];

export function Trust() {
  return (
    <section aria-labelledby="trust" className="mb-14 grid gap-5">
      <h2 id="trust" className={h2}>
        Why letting go is reasonable
      </h2>
      <p className="max-w-[70ch] text-[1.02rem] text-muted-foreground">
        Trust here isn’t a feeling about the model. It is four properties of the loop.
      </p>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
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
