import { RepeatIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Owner = "anyone" | "product" | "engineering" | "qa" | "ci" | "agent" | "tracker";

const ownerLabel: Record<Owner, string> = {
  anyone: "Anyone",
  product: "Product",
  engineering: "Engineering",
  qa: "QA",
  ci: "CI/CD",
  agent: "agent-tasks",
  tracker: "Tracker",
};

const ownerClass: Record<Owner, string> = {
  anyone: "",
  product: "",
  engineering: "",
  qa: "",
  ci: "",
  tracker: "",
  agent: "border-signal/50 bg-signal-soft text-signal",
};

type Stage = {
  title: string;
  detail: string;
  today: Owner[];
  after: Owner[];
  afterNote: string;
  loop?: { actions: string[]; gates: string[]; until: string };
};

const stages: Stage[] = [
  {
    title: "A ticket is filed",
    detail: "A bug or a product change, usually with minimal technical detail.",
    today: ["anyone"],
    after: ["anyone"],
    afterNote: "Unchanged. Your tracker stays the front door.",
  },
  {
    title: "Humans add detail",
    detail: "Reviewed and enriched until the ask is specific enough to act on.",
    today: ["product", "engineering"],
    after: ["product", "engineering"],
    afterNote: "Unchanged — and more valuable than before. A precise ticket is the specification the agent works to.",
  },
  {
    title: "Triage",
    detail: "Prioritised, routed, accepted by a product or engineering owner.",
    today: ["product", "engineering"],
    after: ["product", "engineering"],
    afterNote: "Unchanged. Accepting a ticket is what hands it to the loop.",
  },
  {
    title: "Root cause reproduced, pull request opened",
    detail: "Once the problem can be reproduced, the work starts and a PR is opened.",
    today: ["engineering"],
    after: ["agent"],
    afterNote: "The agent reproduces it in an isolated sandbox and opens the pull request itself.",
  },
  {
    title: "The coding and verification loop",
    detail: "Repeats until every human reviewer and every automated check passes.",
    today: ["engineering", "ci"],
    after: ["agent", "ci"],
    afterNote:
      "agent-tasks runs this. An agent edits in its sandbox; every version is checked by the gates; a failure goes back to the agent with the evidence; a review change re-enters the loop. It stops only when every required check passes for the same version — or a budget says stop.",
    loop: {
      actions: [
        "write the code",
        "add unit tests",
        "add integration tests",
        "simplify; remove unnecessary comments",
        "write user-facing docs, if required",
        "format",
        "open or update the PR",
        "respond to review → again",
      ],
      gates: [
        "lint",
        "unit tests pass",
        "integration tests pass, logs clean",
        "cyclomatic complexity within limits",
        "CPU and memory deltas within bounds",
        "profiles for new or hot functions",
        "docs updated when required",
        "integrity: nothing suppressed or deleted",
      ],
      until: "until every human reviewer and every check passes — for the same version",
    },
  },
  {
    title: "Merge",
    detail: "The pull request lands on main.",
    today: ["engineering"],
    after: ["engineering"],
    afterNote: "Manual by default. Automatic on green when the team’s policy allows it.",
  },
  {
    title: "Verify on staging",
    detail: "Product, QA and engineering check the change does what the ticket asked. If it fails after merging, the loop re-opens.",
    today: ["product", "qa", "engineering"],
    after: ["product", "qa", "engineering"],
    afterNote:
      "Unchanged — humans judge intent, and that check is worth one per ticket, not one per agent turn. A failure re-opens the loop with the finding attached, and the finding becomes a new check so it can’t recur.",
  },
  {
    title: "Release to production",
    detail: "If staging passes, the change ships.",
    today: ["engineering"],
    after: ["engineering"],
    afterNote: "Unchanged. Releasing stays a human decision; what follows it no longer has to be.",
  },
  {
    title: "Verify in production",
    detail: "After the release, confirm the change works where it matters — usually informally: someone watches dashboards, or waits for a report.",
    today: ["engineering"],
    after: ["agent", "engineering"],
    afterNote:
      "A step of the workflow, not an afterthought. The same gates run against production after the release — smoke checks, health, the specific behaviour the ticket named. If it fails, the loop re-opens with the evidence, exactly as it does for staging.",
  },
  {
    title: "Ticket completed",
    detail: "The tracker is updated and the ticket closes.",
    today: ["anyone"],
    after: ["tracker"],
    afterNote: "Status flows back to the ticket automatically at every stage, not just the last one.",
  },
];

function ChipGroup({ label, items, accent }: { label: string; items: string[]; accent?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className={`rounded px-2 py-0.5 font-mono text-[0.76rem] ${
              accent ? "border border-signal/40 bg-card text-foreground" : "bg-code text-foreground"
            }`}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function Owners({ owners }: { owners: Owner[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {owners.map((o) => (
        <Badge key={o} variant={o === "agent" ? "outline" : "secondary"} className={ownerClass[o]}>
          {ownerLabel[o]}
        </Badge>
      ))}
    </div>
  );
}

const h2 = "font-heading text-[1.55rem] font-bold leading-[1.15] tracking-tight";
const colHead = "font-mono text-[0.76rem] font-medium uppercase tracking-[0.06em] text-muted-foreground";

export function Lifecycle() {
  return (
    <section aria-labelledby="lifecycle" className="mb-14 grid gap-5">
      <h2 id="lifecycle" className={h2}>
        How a change ships today — and the part we take over
      </h2>
      <p className="max-w-[70ch] text-[1.02rem] text-muted-foreground">
        Every team runs some version of this. Most of the time goes into one stage: the loop in the
        middle, repeated until everything passes. That stage is what agent-tasks runs. The ends —
        deciding what to build, and judging whether what shipped is what was asked for — stay human.
      </p>

      <div className="grid gap-2">
        <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.5fr)] gap-4 px-4 md:grid">
          <span className={colHead}>Stage</span>
          <span className={colHead}>Today</span>
          <span className={colHead}>With agent-tasks</span>
        </div>
        {stages.map((s, i) => {
          const isLoop = Boolean(s.loop);
          return (
            <div
              key={s.title}
              className={`grid gap-4 rounded-lg border bg-card px-4 py-3.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.5fr)] ${
                isLoop ? "border-signal/60 shadow-[0_0_0_1px_var(--signal-soft)]" : "border-border"
              }`}
            >
              <div className="grid gap-1.5">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[0.78rem] text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-heading text-[1.05rem] font-bold leading-snug">{s.title}</h3>
                </div>
                <p className="text-[0.92rem] leading-[1.45] text-muted-foreground">{s.detail}</p>
                {s.loop && (
                  <div className="mt-1.5 grid gap-2.5 rounded-md bg-muted px-3 py-2.5">
                    <ChipGroup label="the agent does" items={s.loop.actions} />
                    <ChipGroup label="the checks that must pass" items={s.loop.gates} accent />
                    <p className="flex items-center gap-1.5 text-[0.85rem] text-muted-foreground">
                      <RepeatIcon aria-hidden="true" className="size-3.5 shrink-0 text-signal" />
                      {s.loop.until}
                    </p>
                  </div>
                )}
              </div>
              <div className="grid content-start gap-1.5">
                <span className={`${colHead} md:hidden`}>Today</span>
                <Owners owners={s.today} />
              </div>
              <div className="grid content-start gap-1.5">
                <span className={`${colHead} md:hidden`}>With agent-tasks</span>
                <Owners owners={s.after} />
                <p className="text-[0.92rem] leading-[1.45] text-muted-foreground">{s.afterNote}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
