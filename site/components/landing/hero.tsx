import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const beats = [
  {
    t: "Tasks exist.",
    d: "Tickets, trackers, backlogs. The work is already written down.",
    missing: false,
  },
  {
    t: "Sandboxes exist.",
    d: "Isolated environments where an agent can edit and run code without putting anything else at risk.",
    missing: false,
  },
  {
    t: "Orchestration doesn’t.",
    d: "Nothing runs the work between them. So people do, managing agents by hand, one at a time.",
    missing: true,
  },
];

export function Hero() {
  return (
    <header className="grid gap-5 pt-12 pb-10">
      <p className="font-mono text-[0.78rem] uppercase tracking-[0.08em] text-muted-foreground">
        agent-tasks · a Kubernetes operator and five custom resources
      </p>
      <h1 className="max-w-[22ch] font-heading text-[clamp(2.2rem,4.6vw,3.5rem)] font-extrabold leading-[1.04] tracking-tight text-balance">
        Task orchestration for coding agents, as Kubernetes resources.
      </h1>
      <div className="grid max-w-[66ch] gap-3 text-[1.12rem] leading-[1.5]">
        <p>
          agent-tasks turns a ticket into an <code className="font-mono text-[0.92em]">AgentTask</code>,
          runs a coding agent inside a loop of checks your cluster defines, and carries the result
          through review, merge, deployment and verification until the ticket is closed. Every check
          is tied to the exact version of the code it judged, every task is bounded, and all of it is
          a resource you manage with kubectl, RBAC and git.
        </p>
        <p>
          To scale agents you have to trust them, and to trust them you have to let them iterate on
          their own. The operator is what makes that safe: it decides what runs next, it never lets
          a stale verdict count, and it always stops with a stated reason.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/docs" className={buttonVariants()}>
          Read the docs
        </Link>
        <Link href="/docs/install" className={buttonVariants({ variant: "outline" })}>
          Install the operator
        </Link>
        <Link href="/loop" className={buttonVariants({ variant: "ghost" })}>
          See one task go through the loop
        </Link>
      </div>
      <ol aria-label="What exists and what is missing" className="mt-3 grid gap-3.5 md:grid-cols-3">
        {beats.map((b) => (
          <li
            key={b.t}
            className={`border-t-[3px] bg-card px-4 pt-3.5 pb-4 text-[0.98rem] leading-[1.45] ${
              b.missing ? "border-signal" : "border-foreground"
            }`}
          >
            <strong
              className={`mb-1 block font-heading text-[1.05rem] font-bold ${b.missing ? "text-signal" : ""}`}
            >
              {b.t}
            </strong>
            <span className="text-muted-foreground">{b.d}</span>
          </li>
        ))}
      </ol>
    </header>
  );
}
