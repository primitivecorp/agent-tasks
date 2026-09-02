"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { GateBoard } from "./gate-board";
import { Lineage } from "./lineage";
import { steps, versions } from "./steps";

const actorDot = {
  idle: "bg-border",
  live: "bg-signal animate-pulse motion-reduce:animate-none",
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
          <span className="font-mono text-[0.8rem] tracking-[0.04em] text-muted-foreground">
            Step {i + 1} of {steps.length}
          </span>
          <h2 className="font-heading text-[1.55rem] font-bold leading-[1.15] tracking-tight text-balance">
            {s.title}
          </h2>
        </div>
        <p className="prose-code text-[1.06rem] md:min-h-[9.5em] [&_strong]:font-semibold">
          {s.body}
        </p>
        <Collapsible className="border-l-2 border-border pl-3">
          <CollapsibleTrigger
            render={<Button variant="ghost" size="sm" />}
            className="group -ml-2 h-7 gap-1 px-2 font-mono text-[0.78rem] uppercase tracking-[0.04em] text-muted-foreground"
          >
            <ChevronRightIcon className="transition-transform group-data-[panel-open]:rotate-90" />
            In system terms
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-2 font-mono text-[0.84rem] leading-normal text-muted-foreground">
              {s.sys}
            </p>
          </CollapsibleContent>
        </Collapsible>
        <nav aria-label="Walkthrough controls" className="mt-1.5 flex items-center gap-3">
          <Button variant="outline" onClick={() => go(i - 1)} disabled={i === 0}>
            <ArrowLeftIcon />
            Back
          </Button>
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
                      ? "border-signal bg-signal"
                      : k < i
                        ? "border-muted-foreground bg-muted-foreground"
                        : "border-muted-foreground bg-transparent"
                  }`}
                />
              </li>
            ))}
          </ol>
          <Button onClick={() => go(i + 1)} disabled={i === last}>
            {i === last ? "Finished" : "Next"}
            {i !== last && <ArrowRightIcon />}
          </Button>
        </nav>
      </div>

      <Card aria-live="polite">
        <CardContent className="grid gap-5.5">
          <div className="flex min-h-[1.6em] items-center gap-2.5 text-[0.98rem] font-semibold">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 flex-none rounded-full ${actorDot[s.actor.kind]}`}
            />
            <span>{s.actor.text}</span>
          </div>
          <figure className="m-0">
            <Lineage cur={s.cur} />
            <figcaption className="mt-1.5 flex min-h-[1.8em] flex-wrap items-center gap-2 text-[0.9rem] text-muted-foreground">
              {s.changed && s.changed.length > 0 ? (
                <>
                  <span>{version.id} changed:</span>
                  {s.changed.map((p) => (
                    <span
                      key={p}
                      className="rounded bg-code px-2 py-0.5 font-mono text-[0.78rem] text-foreground"
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
        </CardContent>
      </Card>
    </section>
  );
}
