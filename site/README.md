# agent-tasks site

The project website: a visual, step-by-step explanation of how an agent-tasks
task converges (`/`), built to grow into the documentation home for the
project. Next.js (App Router, static export) with Tailwind CSS.

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm lint
pnpm build    # static export to out/
```

The walkthrough follows the reference trace in `../implementation.md` §10 and
uses the same terminology; the glossary at the bottom of the page maps each
plain-language name to its term in the spec.

## shadcn/ui

The app is laid out exactly as `pnpm dlx shadcn@latest init -t next` produces
(that command is `create-next-app` followed by `shadcn init`). The `shadcn init`
step has not been run yet: it fetches from `ui.shadcn.com`, which was blocked by
egress policy in the environment that scaffolded this. From a network that
allows that host, run:

```bash
pnpm dlx shadcn@latest init -d -y
pnpm dlx shadcn@latest add button badge table collapsible
```

and then replace the hand-styled controls in `components/convergence/` with the
generated primitives.
