import { gateMeta, type GateKey, type GateState } from "./steps";

const glyph = { unknown: "?", pass: "✓", fail: "✕" } as const;
const word = { unknown: "unknown", pass: "pass", fail: "fail" } as const;

const pillByStatus = {
  unknown: "border-dashed border-unk bg-unk-bg text-unk",
  pass: "border-pass bg-pass-bg text-pass",
  fail: "border-fail bg-fail-bg text-fail",
} as const;

const rowByStatus = {
  unknown: "border-line",
  pass: "border-pass/45",
  fail: "border-fail/45",
} as const;

function Stamp({ st }: { st: GateState }) {
  const lead =
    st.s === "unknown" ? "not yet judged for " : st.s === "pass" ? "verified at " : "failed on ";
  return (
    <div className="font-mono text-[0.8rem] leading-[1.45] text-muted">
      {lead}
      <b className="font-medium text-ink">{st.at}</b>
      {st.note && (
        <span className={st.s === "fail" ? "block text-fail" : "block italic text-muted"}>
          {st.note}
        </span>
      )}
    </div>
  );
}

export function GateRow({ id, st }: { id: GateKey; st: GateState }) {
  const meta = gateMeta[id];
  return (
    <div
      role="listitem"
      className={`grid grid-cols-[1fr_auto] items-center gap-3.5 rounded-lg border bg-surface-2 px-3.5 py-3 transition-colors duration-300 md:grid-cols-[minmax(120px,1.1fr)_minmax(112px,auto)_minmax(0,1.6fr)] ${rowByStatus[st.s]}`}
    >
      <div className="font-mono text-[0.95rem] font-medium">
        {meta.name}
        <span className="block font-sans text-[0.82rem] font-normal text-muted">{meta.desc}</span>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 justify-self-start whitespace-nowrap rounded-full border-[1.5px] px-2.5 py-1 font-mono text-[0.8rem] font-medium transition-colors duration-300 ${pillByStatus[st.s]}`}
      >
        <span aria-hidden="true">{glyph[st.s]}</span>
        <span>{word[st.s]}</span>
      </span>
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
