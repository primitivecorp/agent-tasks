import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const h2 = "font-heading text-[1.55rem] font-bold leading-[1.15] tracking-tight";
const svgText = "fill-current font-mono text-[13px]";
const svgNote = "fill-current font-sans text-[11px] opacity-70";

export function BecomeTheLoop() {
  return (
    <section aria-labelledby="become" className="mb-14 grid gap-5">
      <h2 id="become" className={h2}>
        We become the coding and verification loop
      </h2>
      <figure className="m-0 grid gap-3">
        <svg
          viewBox="0 0 880 230"
          role="img"
          aria-label="A ticket, prepared by humans, enters the agent-tasks loop where an agent edits, gates check, and failures return to the agent; the loop produces a pull request; humans verify on staging and release; a staging failure re-opens the loop"
          className="block h-auto w-full text-foreground"
        >
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0 0L10 5L0 10z" fill="currentColor" />
            </marker>
            <marker id="arr-signal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0 0L10 5L0 10z" className="fill-signal" />
            </marker>
          </defs>
          {/* human end: ticket */}
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="14" y="70" width="128" height="52" rx="6" />
          </g>
          <g textAnchor="middle" className={svgText}>
            <text x="78" y="92">ticket</text>
          </g>
          <g textAnchor="middle" className={svgNote}>
            <text x="78" y="110">filed · detailed · triaged</text>
            <text x="78" y="142">humans</text>
          </g>
          {/* the loop */}
          <g>
            <rect x="188" y="30" width="300" height="140" rx="10" className="fill-signal-soft stroke-signal" strokeWidth="2" />
            <text x="338" y="52" textAnchor="middle" className="fill-signal font-mono text-[11px] tracking-[0.08em]">
              AGENT-TASKS
            </text>
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="206" y="78" width="80" height="40" rx="6" className="fill-card" />
              <rect x="298" y="78" width="80" height="40" rx="6" className="fill-card" />
              <rect x="390" y="78" width="80" height="40" rx="6" className="fill-card" />
              <line x1="288" y1="98" x2="294" y2="98" markerEnd="url(#arr)" />
              <line x1="380" y1="98" x2="386" y2="98" markerEnd="url(#arr)" />
              <path d="M430 120 L430 140 L246 140 L246 124" markerEnd="url(#arr)" className="stroke-signal" />
            </g>
            <g textAnchor="middle" className={svgText}>
              <text x="246" y="102">edit</text>
              <text x="338" y="102">check</text>
              <text x="430" y="102">verdict</text>
            </g>
            <g textAnchor="middle" className={svgNote}>
              <text x="338" y="158">a failure goes back to the agent, with the evidence</text>
            </g>
          </g>
          {/* pull request */}
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="534" y="70" width="128" height="52" rx="6" />
          </g>
          <g textAnchor="middle" className={svgText}>
            <text x="598" y="92">pull request</text>
          </g>
          <g textAnchor="middle" className={svgNote}>
            <text x="598" y="110">all green, one version</text>
          </g>
          {/* staging + release */}
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="708" y="70" width="158" height="52" rx="6" />
          </g>
          <g textAnchor="middle" className={svgText}>
            <text x="787" y="92">staging → release</text>
          </g>
          <g textAnchor="middle" className={svgNote}>
            <text x="787" y="110">does it do what was asked?</text>
            <text x="787" y="142">humans</text>
          </g>
          {/* connectors */}
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="144" y1="96" x2="184" y2="96" markerEnd="url(#arr)" />
            <line x1="490" y1="96" x2="530" y2="96" markerEnd="url(#arr)" />
            <line x1="664" y1="96" x2="704" y2="96" markerEnd="url(#arr)" />
            <path d="M840 124 L840 200 L338 200 L338 174" strokeDasharray="4 4" markerEnd="url(#arr-signal)" className="stroke-signal" />
          </g>
          <g className={svgNote}>
            <text x="560" y="194">fails on staging → the loop re-opens, and the finding becomes a check</text>
          </g>
        </svg>
        <figcaption className="max-w-[72ch] text-[0.95rem] leading-[1.5] text-muted-foreground">
          The ends stay human. The middle — the part that repeats fifty times per ticket — becomes
          something the cluster runs: an agent working in an isolated sandbox, checked on every
          version, sent back with the evidence when a check fails, stopped when everything passes
          for the same version or a budget runs out.
        </figcaption>
      </figure>
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h3 className="font-heading text-[1.05rem] font-bold">The agent does the work</h3>
          <p className="mt-1 text-[0.97rem] leading-[1.45] text-muted-foreground">
            Reproduces the problem, edits the code, writes the tests, and opens the pull request —
            inside a sandbox that can’t reach anything it shouldn’t.
          </p>
        </div>
        <div>
          <h3 className="font-heading text-[1.05rem] font-bold">The gates keep it honest</h3>
          <p className="mt-1 text-[0.97rem] leading-[1.45] text-muted-foreground">
            Unit tests, integration tests, lint, format, and an integrity check the team can’t turn
            off. Each verdict is about one exact version of the code; change the code and it has to
            be earned again.
          </p>
        </div>
        <div>
          <h3 className="font-heading text-[1.05rem] font-bold">Humans keep the judgement</h3>
          <p className="mt-1 text-[0.97rem] leading-[1.45] text-muted-foreground">
            What to build, how precisely to describe it, and whether the shipped change does what was
            asked. Those checks scale with tickets, not with agent turns.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/loop" className={buttonVariants({ size: "lg" })}>
          See one ticket go through the loop
        </Link>
        <a
          href="https://github.com/primitivecorp/agent-tasks/blob/main/implementation.md"
          className={buttonVariants({ variant: "outline", size: "lg" })}
          rel="noreferrer"
        >
          Read the specification
        </a>
      </div>
    </section>
  );
}
