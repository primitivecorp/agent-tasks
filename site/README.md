# agent-tasks site

The project website: a visual, step-by-step explanation of how an agent-tasks
task converges (`/`), built to grow into the documentation home for the
project. Next.js (App Router, static export), Tailwind CSS v4, shadcn/ui.

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

The project is a standard shadcn/ui setup — preset `base-nova` (Base UI
primitives, "nova" style, neutral base color, lucide icons), the defaults of
`pnpm dlx shadcn@latest init -t next -d`. `components.json`, `lib/utils.ts`
and the `app/globals.css` structure are what `init` writes; the site's
identity is expressed as values of the standard tokens plus a few additions
(`signal`, `pass`, `fail`, `unknown`, `code`) declared alongside them.

Components live in `components/ui/` and are the official registry files.
They were produced with `scripts/sync-shadcn.mjs`, which runs the registry's
own build transform (`createStyleMap` + `transformStyle` from the `shadcn`
package, then the CLI's alias and font-marker rewrites) against a checkout of
`shadcn-ui/ui`, because the environment that set this up could not reach
`ui.shadcn.com`. From a network that can, the CLI is the preferred route and
yields identical files:

```bash
pnpm dlx shadcn@latest add button badge card table collapsible separator
```

Dark mode is class-based through `next-themes` (`components/theme-provider.tsx`),
following the system preference by default.
