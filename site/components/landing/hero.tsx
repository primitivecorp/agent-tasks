const beats = [
  {
    t: "Tasks exist.",
    d: "Tickets, trackers, backlogs. The work is already written down.",
    missing: false,
  },
  {
    t: "Sandboxes exist.",
    d: "Isolated environments where an agent can run without putting anything else at risk.",
    missing: false,
  },
  {
    t: "Orchestration doesn’t.",
    d: "Nothing runs the work between them. So people do — managing agents by hand, one at a time.",
    missing: true,
  },
];

export function Hero() {
  return (
    <header className="grid gap-5 pt-12 pb-10">
      <p className="font-mono text-[0.78rem] uppercase tracking-[0.08em] text-muted-foreground">
        agent-tasks · orchestration for coding agents on Kubernetes
      </p>
      <h1 className="max-w-[22ch] font-heading text-[clamp(2.3rem,5vw,3.8rem)] font-extrabold leading-[1.02] tracking-tight text-balance">
        You can’t scale agents by managing them one at a time.
      </h1>
      <div className="grid max-w-[64ch] gap-3 text-[1.15rem] leading-[1.5]">
        <p>
          To scale, you have to trust them. To trust them, you have to let them iterate on their
          own: edit the code, run the checks, and prove the result.
        </p>
        <p className="text-muted-foreground">
          agent-tasks is that loop — the coding and verification cycle every team already runs,
          made something a cluster can run for you.
        </p>
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
