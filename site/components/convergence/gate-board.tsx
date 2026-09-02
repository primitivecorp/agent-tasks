import { CheckIcon, CircleHelpIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { gateMeta, type GateKey, type GateState } from "./steps";

const pillByStatus = {
  unknown: "border-dashed border-unknown bg-unknown-soft text-unknown",
  pass: "border-pass bg-pass-soft text-pass",
  fail: "border-fail bg-fail-soft text-fail",
} as const;

const rowByStatus = {
  unknown: "border-border",
  pass: "border-pass/45",
  fail: "border-fail/45",
} as const;

const Icon = { unknown: CircleHelpIcon, pass: CheckIcon, fail: XIcon } as const;

function Stamp({ st }: { st: GateState }) {
  const lead =
    st.s === "unknown" ? "not yet judged for " : st.s === "pass" ? "verified at " : "failed on ";
  return (
    <div className="font-mono text-[0.8rem] leading-[1.45] text-muted-foreground">
      {lead}
      <b className="font-medium text-foreground">{st.at}</b>
      {st.note && (
        <span className={st.s === "fail" ? "block text-fail" : "block italic"}>{st.note}</span>
      )}
    </div>
  );
}

export function GateRow({ id, st }: { id: GateKey; st: GateState }) {
  const meta = gateMeta[id];
  const StatusIcon = Icon[st.s];
  return (
    <div
      role="listitem"
      className={`grid grid-cols-[1fr_auto] items-center gap-3.5 rounded-lg border bg-muted px-3.5 py-3 transition-colors duration-300 md:grid-cols-[minmax(120px,1.1fr)_minmax(112px,auto)_minmax(0,1.6fr)] ${rowByStatus[st.s]}`}
    >
      <div className="font-mono text-[0.95rem] font-medium">
        {meta.name}
        <span className="block font-sans text-[0.82rem] font-normal text-muted-foreground">
          {meta.desc}
        </span>
      </div>
      <Badge
        variant="outline"
        className={`justify-self-start font-mono transition-colors duration-300 ${pillByStatus[st.s]}`}
      >
        <StatusIcon aria-hidden="true" />
        {st.s}
      </Badge>
      <div className="col-span-2 md:col-span-1">
        <Stamp st={st} />
      </div>
    </div>
  );
}

export function GateBoard({ gates }: { gates: Record<GateKey, GateState> }) {
  return (
    <div role="list" aria-label="Gates and their verdicts" className="grid gap-2">
      {(Object.keys(gateMeta) as GateKey[]).map((k) => (
        <GateRow key={k} id={k} st={gates[k]} />
      ))}
    </div>
  );
}
