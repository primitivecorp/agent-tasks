import { KindBadge } from "@/components/landing/capabilities";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Step = { t: string; k: "does" | "checks"; via: string; fix?: string };
type Team = { name: string; who: string; steps: Step[]; note: string };

const teams: Team[] = [
  {
    name: "One lane",
    who: "A small team, one service, no merge queue. One change lands at a time.",
    steps: [
      { t: "Open the pull request", k: "does", via: "GitHub" },
      { t: "Review", k: "checks", via: "a person" },
      { t: "Wait for a turn", k: "checks", via: "the lane" },
      { t: "Integrated with main", k: "checks", via: "git", fix: "rebase" },
      { t: "Merge", k: "does", via: "GitHub" },
      { t: "Verify staging", k: "checks", via: "staging" },
      { t: "Release", k: "does", via: "CD" },
      { t: "Verify production", k: "checks", via: "production" },
      { t: "Close the ticket", k: "does", via: "the tracker" },
    ],
    note: "Every deployment carries one change, so a failing check is that change’s. Waiting costs nothing: the sandbox is released while the task waits its turn.",
  },
  {
    name: "Monorepo with a merge queue",
    who: "Thousands of changes a day, the team’s own queue, the team’s own canary analysis.",
    steps: [
      { t: "Open the pull request", k: "does", via: "GitHub" },
      { t: "Review", k: "checks", via: "a person" },
      { t: "Enqueue", k: "does", via: "the merge queue" },
      { t: "Landed", k: "checks", via: "the merge queue" },
      { t: "Canary analysis", k: "checks", via: "CD" },
      { t: "Close the ticket", k: "does", via: "the tracker" },
    ],
    note: "The queue batches and speculates however it likes. The task only ever sees landed, or rejected with the evidence attached.",
  },
  {
    name: "Release by flag",
    who: "Code lands in bulk. Each change is released, judged and rolled back by its own flag.",
    steps: [
      { t: "Merge and land", k: "does", via: "the merge queue" },
      { t: "Deployed", k: "checks", via: "production" },
      { t: "Flag on for 1%", k: "does", via: "flags" },
      { t: "Flag metrics against control", k: "checks", via: "flags", fix: "flag off" },
      { t: "Flag on for everyone", k: "does", via: "flags" },
      { t: "Close the ticket", k: "does", via: "the tracker" },
    ],
    note: "Deploy is not release. Production verification is per change, and nothing is serialized.",
  },
  {
    name: "Preview only",
    who: "Everything verified before merge, in isolation. Production is left to CD.",
    steps: [
      { t: "Deploy a preview", k: "does", via: "the task’s own namespace" },
      { t: "End-to-end tests against it", k: "checks", via: "the preview" },
      { t: "Open the pull request", k: "does", via: "GitHub" },
      { t: "Review", k: "checks", via: "a person" },
      { t: "Merge", k: "does", via: "GitHub" },
      { t: "Close the ticket", k: "does", via: "the tracker" },
    ],
    note: "No connector is needed for the environment, and the cost grows with the number of tasks, not with the square of it.",
  },
];

const h2 = "font-heading text-[1.55rem] font-bold leading-[1.15] tracking-tight";

export function TeamWorkflows() {
  return (
    <section aria-labelledby="teams" className="mb-14 grid gap-5">
      <h2 id="teams" className={h2}>
        One example. Your workflow is yours.
      </h2>
      <p className="max-w-[72ch] text-[1.02rem]">
        agent-tasks does not decide how you merge, deploy or release. Your workflow lists the
        steps, and each step points at a system you already run: your merge queue, your CD, your
        flags, your approvals. The steps before the pull request are the same for all four teams
        below; what differs is what they chose after it.
      </p>
      <div className="grid gap-5 md:grid-cols-2 md:items-start">
        {teams.map((team) => (
          <Card key={team.name} size="sm">
            <CardHeader>
              <CardTitle className="font-heading text-[1.1rem] font-bold">{team.name}</CardTitle>
              <CardDescription className="text-[0.95rem] leading-[1.45]">{team.who}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="m-0 grid list-none gap-1.5 p-0">
                {team.steps.map((s, i) => (
                  <li
                    key={s.t}
                    className="grid grid-cols-[1.5rem_1fr_auto] items-baseline gap-x-2 border-t border-border pt-1.5 first:border-t-0 first:pt-0"
                  >
                    <span className="font-mono text-[0.78rem] text-muted-foreground">{i + 1}</span>
                    <span className="text-[0.95rem] leading-snug">
                      {s.t}
                      <span className="text-muted-foreground"> · via {s.via}</span>
                      {s.fix ? (
                        <Badge variant="outline" className="ml-2 align-middle font-mono text-[0.7rem]">
                          fix: {s.fix}
                        </Badge>
                      ) : null}
                    </span>
                    <KindBadge k={s.k} />
                  </li>
                ))}
              </ol>
            </CardContent>
            <CardFooter>
              <p className="m-0 text-[0.92rem] leading-[1.45] text-muted-foreground">{team.note}</p>
            </CardFooter>
          </Card>
        ))}
      </div>
      <p className="max-w-[72ch] text-[1.02rem] leading-[1.5]">
        <strong className="font-heading font-bold">A person can stand before any step.</strong>{" "}
        Teams place approval gates where they want them, and platform administrators can require
        one before any kind of step. The building blocks never change: steps that do, steps that
        check, facts that arrive from the systems you already run, and waiting until they do.
      </p>
    </section>
  );
}
