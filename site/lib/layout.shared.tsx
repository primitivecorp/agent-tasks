import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const GITHUB_URL = "https://github.com/primitivecorp/agent-tasks";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <span className="font-mono font-medium tracking-tight">agent-tasks</span>,
      url: "/",
    },
    links: [
      { text: "Home", url: "/" },
      { text: "The loop, step by step", url: "/loop" },
      { text: "Docs", url: "/docs", active: "nested-url" },
    ],
    githubUrl: GITHUB_URL,
  };
}
