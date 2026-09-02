import Link from "next/link";

const links = [
  { href: "/", label: "Overview" },
  { href: "/loop", label: "The loop, step by step" },
];

export function SiteNav() {
  return (
    <nav
      aria-label="Site"
      className="mx-auto flex w-full max-w-[1120px] items-center gap-6 px-7 pt-6 text-[0.92rem]"
    >
      <Link href="/" className="font-mono font-medium tracking-tight">
        agent-tasks
      </Link>
      <div className="ml-auto flex items-center gap-5 text-muted-foreground">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-foreground">
            {l.label}
          </Link>
        ))}
        <a
          href="https://github.com/primitivecorp/agent-tasks"
          className="hover:text-foreground"
          rel="noreferrer"
        >
          GitHub
        </a>
      </div>
    </nav>
  );
}
