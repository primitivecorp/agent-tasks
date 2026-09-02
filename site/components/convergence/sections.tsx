/* Static sections around the walkthrough. Server components; no interactivity. */

export function Masthead() {
  return (
    <header className="grid gap-4.5 pt-11 pb-7">
      <p className="font-mono text-[0.78rem] uppercase tracking-[0.08em] text-muted">
        agent-tasks · how one task gets done
      </p>
      <h1 className="font-display text-[clamp(2.2rem,4.5vw,3.4rem)] font-extrabold leading-[1.02] tracking-tight text-balance">
        The Convergence Loop
      </h1>
      <p className="max-w-[62ch] text-[1.18rem]">
        One bug ticket, from the agent’s first edit to a change that is ready to merge — in nine
        steps, with every check shown as it happens.
      </p>
      <ol aria-label="The three rules" className="prose-code mt-2 grid gap-3.5 md:grid-cols-3">
        <Rule title="Every version of the code gets a name.">
          <code>h0</code>, <code>h1</code>, <code>h2</code>… Each is a snapshot of the whole
          codebase.
        </Rule>
        <Rule title="A check’s verdict is about one version only.">
          Change the code, and any verdict that could be affected goes back to{" "}
          <em className="not-italic font-semibold text-unk">unknown</em>.
        </Rule>
        <Rule title="Done means all green on the same version.">
          After the agent has actually done the work — a starting point that already passes
          doesn’t count.
        </Rule>
      </ol>
    </header>
  );
}

function Rule({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="border-t-[3px] border-ink bg-surface px-4 pt-3.5 pb-4 text-[0.98rem] leading-[1.45]">
      <strong className="mb-1 block font-display text-[1.02rem] font-bold">{title}</strong>
      <span className="text-muted">{children}</span>
    </li>
  );
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t-2 border-line bg-surface px-4 pt-3.5 pb-3.5">
      <h3 className="mb-1.5 font-display text-[1.05rem] font-bold">{title}</h3>
      <p className="text-[0.95rem] leading-[1.45] text-muted">{children}</p>
    </div>
  );
}

export function WhyItStops() {
  return (
    <section aria-labelledby="why" className="mb-13 grid gap-4.5">
      <h2 id="why" className="font-display text-[1.55rem] font-bold leading-[1.15] tracking-tight">
        Why it always stops
      </h2>
      <p className="max-w-[70ch] text-[0.92rem] text-muted">
        The loop above could, in principle, run forever. It can’t in practice: each of these ends
        the task with a stated reason.
      </p>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <Tile title="The loop repeats itself">
          If an edit lands the code back on a version it already had, the agent is going in
          circles. Stop.
        </Tile>
        <Tile title="Too many agent runs">
          The agent gets a fixed number of runs per task — five by default. Spend them without
          going green, and the task stops.
        </Tile>
        <Tile title="Out of time">
          A wall-clock budget, counted only while the task is actually working. Pausing a task
          doesn’t burn its time.
        </Tile>
        <Tile title="Out of tokens">A token budget for the whole task, across every agent run.</Tile>
        <Tile title="The plumbing keeps failing">
          If a check or the agent can’t even run — infrastructure, not code — it’s retried a couple
          of times, then the task stops rather than spinning.
        </Tile>
      </div>
    </section>
  );
}

const svgText = "fill-current font-mono text-[13px]";
const svgNote = "fill-current font-sans text-[11px] opacity-70";

export function PipelineCompare() {
  return (
    <section aria-labelledby="cmp" className="mb-13 grid gap-4.5">
      <h2 id="cmp" className="font-display text-[1.55rem] font-bold leading-[1.15] tracking-tight">
        Why not a normal pipeline?
      </h2>
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <figure className="m-0 rounded-[10px] border border-line bg-surface px-4.5 pt-4.5 pb-4">
          <h3 className="mb-2.5 font-display text-[1.05rem] font-bold">A pipeline</h3>
          <svg
            viewBox="0 0 520 120"
            role="img"
            aria-label="A pipeline: edit, lint, test, done, each running exactly once in order"
            className="block h-auto w-full text-ink"
          >
            <defs>
              <marker id="ar1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M0 0L10 5L0 10z" fill="currentColor" />
              </marker>
            </defs>
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="14" y="30" width="96" height="44" rx="6" />
              <rect x="146" y="30" width="96" height="44" rx="6" />
              <rect x="278" y="30" width="96" height="44" rx="6" />
              <rect x="410" y="30" width="96" height="44" rx="6" />
              <line x1="112" y1="52" x2="142" y2="52" markerEnd="url(#ar1)" />
              <line x1="244" y1="52" x2="274" y2="52" markerEnd="url(#ar1)" />
              <line x1="376" y1="52" x2="406" y2="52" markerEnd="url(#ar1)" />
            </g>
            <g textAnchor="middle" className={svgText}>
              <text x="62" y="57">edit</text>
              <text x="194" y="57">lint</text>
              <text x="326" y="57">test</text>
              <text x="458" y="57">done</text>
            </g>
            <g textAnchor="middle" className={svgNote}>
              <text x="62" y="98">runs once</text>
              <text x="194" y="98">runs once</text>
              <text x="326" y="98">runs once</text>
            </g>
          </svg>
          <figcaption className="mt-2.5 text-[0.95rem] leading-[1.45] text-muted">
            Each step runs once, in order. If the code changes after lint ran, lint’s green light is
            stale — and the pipeline has no way to know.
          </figcaption>
        </figure>
        <figure className="m-0 rounded-[10px] border border-line bg-surface px-4.5 pt-4.5 pb-4">
          <h3 className="mb-2.5 font-display text-[1.05rem] font-bold">This system</h3>
          <svg
            viewBox="0 0 520 190"
            role="img"
            aria-label="A loop: a version is checked; if all checks are green for that version the task is done, otherwise a fix produces a new version and the affected verdicts reset to unknown"
            className="block h-auto w-full text-ink"
          >
            <defs>
              <marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M0 0L10 5L0 10z" fill="currentColor" />
              </marker>
            </defs>
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="14" y="30" width="110" height="44" rx="6" />
              <rect x="176" y="30" width="150" height="44" rx="6" />
              <rect x="396" y="30" width="110" height="44" rx="6" />
              <rect x="176" y="126" width="150" height="44" rx="6" />
              <line x1="126" y1="52" x2="172" y2="52" markerEnd="url(#ar2)" />
              <line x1="328" y1="52" x2="392" y2="52" markerEnd="url(#ar2)" />
              <path d="M251 76 L251 122" markerEnd="url(#ar2)" />
              <path d="M176 148 L69 148 L69 78" markerEnd="url(#ar2)" />
            </g>
            <g textAnchor="middle" className={svgText}>
              <text x="69" y="57">version h</text>
              <text x="251" y="57">gates judge h</text>
              <text x="451" y="57">done</text>
              <text x="251" y="153">fix → version h′</text>
            </g>
            <g className={svgNote}>
              <text x="360" y="44" textAnchor="middle">all green</text>
              <text x="258" y="102">any gate red</text>
              <text x="76" y="112">affected verdicts</text>
              <text x="76" y="125">reset to unknown</text>
            </g>
          </svg>
          <figcaption className="mt-2.5 text-[0.95rem] leading-[1.45] text-muted">
            Verdicts are tied to versions. Any change flips the affected verdicts back to unknown,
            and the loop runs until every required gate is green for the same version.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export function Safety() {
  const items = [
    {
      t: "Unknown until proven.",
      d: "The default is to re-check. Skipping a re-check has to be declared on purpose, per file pattern — and a mistake there means extra work, never a false green.",
    },
    {
      t: "Required checks belong to the cluster, not the team.",
      d: "The integrity gate is added by cluster policy when the task starts. A team can’t remove it, reorder it, or narrow what re-triggers it — not even by defining a look-alike.",
    },
    {
      t: "The agent edits code, nothing else.",
      d: "It works in its own isolated sandbox and can’t touch the task’s definition, the checks, or the budgets. Everything it does flows through the code and the verdicts about it.",
    },
  ];
  return (
    <section aria-labelledby="safe" className="mb-13 grid gap-4.5">
      <h2 id="safe" className="font-display text-[1.55rem] font-bold leading-[1.15] tracking-tight">
        Safety, in three sentences
      </h2>
      <div className="grid gap-5.5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {items.map((it) => (
          <div key={it.t}>
            <h3 className="font-display text-[1.05rem] font-bold">{it.t}</h3>
            <p className="mt-1 text-[0.97rem] leading-[1.45] text-muted">{it.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const rows: [string, string, string][] = [
  ["Version (h0, h1…)", "A snapshot of the whole codebase, named by its git tree hash.", "snapshot — §2.1"],
  ["Gate", "A check that judges one version: pass, fail, or unknown. It never changes code.", "Gate step, Gate class — §2.1, §3.1"],
  [
    "Agent, formatter",
    "Things that change the code. The agent is the one “driver”; the formatter is a fix action a gate can call first.",
    "Action, driver, fix action — §2.1, §3.3",
  ],
  [
    "“Verified at h2”",
    "Which version a verdict is about. Carrying a verdict forward means moving this stamp — allowed only when the change can’t affect the gate.",
    "verifiedSnapshot, invalidatedBy — §2.2, §2.3",
  ],
  [
    "Record, then choose",
    "The two functions the whole loop is built from: fold what just happened into the state; decide the single next thing to run.",
    "Fold, Decide — §2.4, §11",
  ],
  [
    "The recipe",
    "The frozen plan a task runs against: which gates, which agent, which budgets. Nothing edits it after the task starts.",
    "resolved plan — §3.4, §4",
  ],
  ["Why it stops", "The five stopping rules above.", "termination — §2.5"],
];

export function Glossary() {
  return (
    <section aria-labelledby="gloss" className="prose-code mb-13 grid gap-4.5">
      <h2 id="gloss" className="font-display text-[1.55rem] font-bold leading-[1.15] tracking-tight">
        The same ideas, in the spec’s words
      </h2>
      <p className="max-w-[70ch] text-[0.92rem] text-muted">
        Plain names on this page map one-to-one onto terms in <code>implementation.md</code>.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[0.95rem]">
          <thead>
            <tr>
              {["On this page", "What it means", "In the spec"].map((h) => (
                <th
                  key={h}
                  className="border-b border-line px-3 py-2.5 text-left font-mono text-[0.76rem] font-medium uppercase tracking-[0.06em] text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([a, b, c]) => (
              <tr key={a}>
                <td className="border-b border-line px-3 py-2.5 align-top font-semibold whitespace-nowrap">{a}</td>
                <td className="border-b border-line px-3 py-2.5 align-top">{b}</td>
                <td className="border-b border-line px-3 py-2.5 align-top font-mono text-[0.82rem] text-muted">{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="prose-code mt-2 border-t border-line pt-2.5 pb-12 text-[0.9rem] text-muted">
      This walkthrough follows the reference trace in <code>implementation.md</code> §10 step for
      step. Source:{" "}
      <a
        href="https://github.com/primitivecorp/agent-tasks"
        className="underline decoration-accent decoration-[1.5px] underline-offset-[3px]"
      >
        github.com/primitivecorp/agent-tasks
      </a>
      .
    </footer>
  );
}
