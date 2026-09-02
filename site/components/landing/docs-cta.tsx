import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const h2 = "font-heading text-[1.55rem] font-bold leading-[1.15] tracking-tight";

const entries = [
  {
    href: "/docs/install",
    t: "Install",
    d: "Requirements, the operator, and the one policy object a cluster needs before any task runs.",
  },
  {
    href: "/docs/first-task",
    t: "Your first task",
    d: "Define step classes and a workflow, file a task, and follow it to a verified result.",
  },
  {
    href: "/docs/concepts/model",
    t: "Concepts",
    d: "Snapshots, Actions and Gates, the ledger of verdicts, and why the loop terminates.",
  },
  {
    href: "/docs/connectors",
    t: "Connectors",
    d: "Create tasks from Linear or GitHub Issues, and let tasks merge, deploy and verify.",
  },
];

export function DocsCta() {
  return (
    <section aria-labelledby="docs" className="mb-14 grid gap-5">
      <h2 id="docs" className={h2}>
        Documentation
      </h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {entries.map((e) => (
          <Link key={e.href} href={e.href} className="group rounded-xl outline-ring/50 focus-visible:outline-2">
            <Card size="sm" className="h-full transition-colors group-hover:border-signal/60">
              <CardHeader>
                <CardTitle className="group-hover:text-signal">{e.t}</CardTitle>
                <CardDescription className="text-[0.95rem] leading-[1.45]">{e.d}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
