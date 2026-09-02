import { versions } from "./steps";

const XS = [80, 240, 400, 560];

/** The chain of code versions so far; the current one is highlighted. */
export function Lineage({ cur }: { cur: number }) {
  return (
    <svg
      viewBox="0 0 640 132"
      role="img"
      aria-label={`Versions of the code so far, left to right; current is ${versions[cur].id}`}
      className="block h-auto w-full max-w-full"
    >
      <defs>
        <marker
          id="lineage-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0L10 5L0 10z" className="fill-ink" />
        </marker>
      </defs>
      {versions.map((v, i) => {
        const cx = XS[i];
        const state = i < cur ? "past" : i === cur ? "current" : "future";
        const future = state === "future";
        const current = state === "current";
        return (
          <g key={v.id} className={future ? "opacity-20" : undefined}>
            {i > 0 && (
              <line
                x1={XS[i - 1] + 58}
                y1={52}
                x2={cx - 60}
                y2={52}
                className="stroke-ink"
                strokeWidth={1.5}
                strokeDasharray={future ? "4 4" : undefined}
                markerEnd="url(#lineage-arrow)"
              />
            )}
            <rect
              x={cx - 52}
              y={30}
              width={104}
              height={44}
              rx={8}
              className={
                current
                  ? "fill-surface stroke-accent"
                  : "fill-surface-2 stroke-muted"
              }
              strokeWidth={current ? 2.5 : 1.25}
              strokeDasharray={future ? "4 4" : undefined}
            />
            <text
              x={cx}
              y={58}
              textAnchor="middle"
              className="fill-ink font-mono text-[17px] font-medium"
            >
              {v.id}
            </text>
            <text
              x={cx}
              y={100}
              textAnchor="middle"
              className="fill-muted font-sans text-[12px]"
            >
              {v.by}
            </text>
            {current && (
              <text
                x={cx}
                y={18}
                textAnchor="middle"
                className="fill-accent font-mono text-[11px] tracking-[0.08em]"
              >
                CURRENT
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
