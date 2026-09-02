import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="prose-code pb-12 text-[0.9rem] text-muted-foreground">
      <Separator className="mb-4" />
      agent-tasks is open source under Apache-2.0.{" "}
      <Link
        href="/docs"
        className="underline decoration-signal decoration-[1.5px] underline-offset-[3px]"
      >
        docs
      </Link>
      {" · "}
      <a
        href="https://github.com/primitivecorp/agent-tasks"
        className="underline decoration-signal decoration-[1.5px] underline-offset-[3px]"
        rel="noreferrer"
      >
        GitHub
      </a>
      {" · "}
      <a
        href="https://github.com/primitivecorp/agent-tasks/blob/main/implementation.md"
        className="underline decoration-signal decoration-[1.5px] underline-offset-[3px]"
        rel="noreferrer"
      >
        the specification
      </a>
      {" · "}
      <a
        href="https://github.com/primitivecorp/agent-tasks/blob/main/paper/main.pdf"
        className="underline decoration-signal decoration-[1.5px] underline-offset-[3px]"
        rel="noreferrer"
      >
        the paper
      </a>
    </footer>
  );
}
