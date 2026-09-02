import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const h2 = "font-heading text-[1.55rem] font-bold leading-[1.15] tracking-tight";
const svgText = "fill-current font-mono text-[13px]";
const svgNote = "fill-muted-foreground font-sans text-[11px]";

// Ten steps, one boundary. x = 20 + i*116, width 100.
const steps = [
  { t: "ticket", n: "from any source" },
  { t: "reproduce", n: "evidence" },
  { t: "implement", n: "in a sandbox" },
  { t: "check", n: "gates" },
  { t: "pull request", n: "managed" },
  { t: "merge", n: "by policy" },
  { t: "staging", n: "verify" },
  { t: "release", n: "by policy" },
  { t: "production", n: "verify live" },
  { t: "close", n: "report" },
];
const X = (i: number) => 20 + i * 116;
const CX = (i: number) => X(i) + 50;

export function BecomeTheLoop() {
  return (
    <section aria-labelledby="loop" className="mb-14 grid gap-5">
      <h2 id="loop" className={h2}>
        One task, the whole lifecycle
      </h2>
      <figure className="m-0 grid gap-3">
        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 1180 262"
            role="img"
            aria-label="Ten steps inside one agent-tasks boundary: ticket, reproduce, implement, check, pull request, merge, staging, release, production, close. A failing check returns to implement; failures on staging or in production return to implement too. Optional human gates sit before merge and release."
            className="block h-auto w-full min-w-[720px] text-foreground"
          >
            <defs>
              <marker id="lp-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M0 0L10 5L0 10z" fill="currentColor" />
              </marker>
              <marker id="lp-arr-signal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M0 0L10 5L0 10z" className="fill-signal" />
              </marker>
            </defs>
            {/* boundary */}
            <rect x="10" y="28" width="1160" height="176" rx="12" className="fill-signal-soft/40 stroke-signal" strokeWidth="2" />
            <text x="26" y="50" className="fill-signal font-mono text-[11px] tracking-[0.08em]">
              AGENT-TASKS · ONE WORKFLOW
            </text>
            {/* optional human gates */}
            <g className={svgNote}>
              <text x={CX(5)} y="72" textAnchor="middle">optional human gate</text>
              <text x={CX(7)} y="72" textAnchor="middle">optional human gate</text>
            </g>
            <g fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3">
              <line x1={CX(5)} y1="75" x2={CX(5)} y2="84" />
              <line x1={CX(7)} y1="75" x2={CX(7)} y2="84" />
            </g>
            {/* steps */}
            {steps.map((s, i) => (
              <g key={s.t}>
                <rect
                  x={X(i)}
                  y="86"
                  width="100"
                  height="44"
                  rx="6"
                  className={s.n === "gates" || s.n === "verify" || s.n === "verify live" ? "fill-card stroke-signal" : "fill-card stroke-current"}
                  strokeWidth="1.5"
                />
                <text x={CX(i)} y="112" textAnchor="middle" className={svgText}>
                  {s.t}
                </text>
                <text x={CX(i)} y="150" textAnchor="middle" className={svgNote}>
                  {s.n}
                </text>
                {i < steps.length - 1 && (
                  <line x1={X(i) + 102} y1="108" x2={X(i + 1) - 3} y2="108" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#lp-arr)" />
                )}
              </g>
            ))}
            {/* returns: check -> implement (solid); staging and production -> implement (dashed) */}
            <g fill="none" strokeWidth="1.5" className="stroke-signal">
              <path d={`M${CX(3) - 34} 130 L${CX(3) - 34} 168 L${CX(2) - 38} 168 L${CX(2) - 38} 133`} markerEnd="url(#lp-arr-signal)" />
              <path d={`M${CX(6) - 34} 130 L${CX(6) - 34} 186`} strokeDasharray="4 4" />
              <path d={`M${CX(8) + 38} 130 L${CX(8) + 38} 186 L${CX(2) + 38} 186 L${CX(2) + 38} 133`} strokeDasharray="4 4" markerEnd="url(#lp-arr-signal)" />
            </g>
            <g className={svgNote}>
              <text x="26" y="232">
                solid: a failing check goes back to the agent with the evidence · dashed: a failure on staging or in production re-opens the work the same way
              </text>
            </g>
          </svg>
        </div>
        <figcaption className="max-w-[74ch] text-[0.95rem] leading-[1.5]">
          One task can run the whole lifecycle. Every box is a step; the ones that check produce a
          verdict about one exact version of the code, and any failing verdict sends the work back
          with the evidence. Human approval is a gate you place — before merge, before release,
          anywhere — or don’t.
        </figcaption>
      </figure>
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h3 className="font-heading text-[1.05rem] font-bold">Scale with compute, not headcount</h3>
          <p className="mt-1 text-[0.97rem] leading-[1.45] text-muted-foreground">
            Each task runs in its own sandbox with its own budgets. Ten tickets or a thousand, the
            workflow is the same; only the compute changes — and verification is the cheap, elastic
            kind.
          </p>
        </div>
        <div>
          <h3 className="font-heading text-[1.05rem] font-bold">Trust comes from the gates, not the model</h3>
          <p className="mt-1 text-[0.97rem] leading-[1.45] text-muted-foreground">
            Every verdict is about one exact version. Change the code and it has to be earned again.
            Required gates come from cluster policy and can’t be removed by the team or the agent.
          </p>
        </div>
        <div>
          <h3 className="font-heading text-[1.05rem] font-bold">Humans are a dial, not a boundary</h3>
          <p className="mt-1 text-[0.97rem] leading-[1.45] text-muted-foreground">
            Put an approval gate where you want one and take it out when the checks have earned it.
            The default is to fail and report, not to ask — asking doesn’t scale.
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
