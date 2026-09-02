"use client";

import { useCallback, useEffect, useState } from "react";
import { GateBoard } from "./gate-board";
import { Lineage } from "./lineage";
import { steps, versions } from "./steps";

const actorDot = {
  idle: "bg-line",
  live: "bg-accent animate-pulse motion-reduce:animate-none",
  done: "bg-pass",
} as const;

/** The interactive walkthrough: one ticket converging, one step at a time. */
export function Stepper() {
  const [i, setI] = useState(0);
  const last = steps.length - 1;
  const go = useCallback((k: number) => setI(Math.max(0, Math.min(last, k))), [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setI((k) => Math.min(last, k + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setI((k) => Math.max(0, k - 1));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [last]);

  const s = steps[i];
  const version = versions[s.cur];

  return (
    <section
      aria-label="Step-by-step walkthrough"
      className="my-2.5 mb-14 grid items-start gap-7 md:grid-cols-[minmax(280px,36ch)_minmax(0,1fr)]"
    >
      <div className="grid gap-3.5 md:sticky md:top-5">
        <div className="grid gap-1.5">
          <span className="font-mono text-[0.8rem] tracking-[0.04em] text-muted">
            Step {i + 1} of {steps.length}
          </span>
          <h2 className="font-display text-[1.55rem] font-bold leading-[1.15] tracking-tight text-balance">
            {s.title}
          </h2>
        </div>
        <p className="prose-code text-[1.06rem] md:min-h-[9.5em] [&_strong]:font-semibold">
          {s.body}
        </p>
        <details className="sys border-l-2 border-line pl-3">
          <summary className="font-mono text-[0.8rem] uppercase tracking-[0.04em] text-muted">
            In system terms
          </summary>
          <p className="mt-2 font-mono text-[0.84rem] leading-normal text-muted">{s.sys}</p>
        </details>
        <nav aria-label="Walkthrough controls" className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => go(i - 1)}
            disabled={i === 0}
            className="whitespace-nowrap rounded-md border-[1.5px] border-ink bg-surface px-3.5 py-2 text-[0.95rem] font-semibold text-ink disabled:cursor-default disabled:opacity-35"
          >
            ← Back
          </button>
          <ol aria-label="Steps" className="mx-auto flex gap-[7px]">
            {steps.map((st, k) => (
              <li key={st.title}>
                <button
                  type="button"
                  aria-label={`Step ${k + 1}: ${st.title}`}
                  aria-current={k === i ? "step" : undefined}
                  onClick={() => go(k)}
                  className={`block h-[11px] w-[11px] rounded-full border-[1.5px] ${
                    k === i
                      ? "border-accent bg-accent"
                      : k < i
                        ? "border-muted bg-muted"
                        : "border-muted bg-transparent"
                  }`}
                />
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => go(i + 1)}
            disabled={i === last}
            className="whitespace-nowrap rounded-md border-[1.5px] border-ink bg-ink px-3.5 py-2 text-[0.95rem] font-semibold text-bg disabled:cursor-default disabled:opacity-35"
          >
            {i === last ? "Finished" : "Next →"}
          </button>
        </nav>
      </div>

      <div
        aria-live="polite"
        className="grid gap-5.5 rounded-[10px] border border-line bg-surface px-5.5 pt-5 pb-5.5"
      >
        <div className="flex min-h-[1.6em] items-center gap-2.5 text-[0.98rem] font-semibold">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 flex-none rounded-full ${actorDot[s.actor.kind]}`}
          />
          <span>{s.actor.text}</span>
        </div>
        <figure className="m-0">
          <Lineage cur={s.cur} />
          <figcaption className="mt-1.5 flex min-h-[1.8em] flex-wrap items-center gap-2 text-[0.9rem] text-muted">
            {s.changed && s.changed.length > 0 ? (
              <>
                <span>{version.id} changed:</span>
                {s.changed.map((p) => (
                  <span
                    key={p}
                    className="rounded bg-code-bg px-2 py-0.5 font-mono text-[0.78rem] text-ink"
                  >
                    {p}
                  </span>
                ))}
              </>
            ) : (
              <span>{version.id} is the code on the main branch, untouched.</span>
            )}
          </figcaption>
        </figure>
        <GateBoard gates={s.gates} />
      </div>
    </section>
  );
}
