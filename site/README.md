# agent-tasks site

The project website and documentation. Next.js (App Router, static export),
Tailwind CSS v4, shadcn/ui for the site's own pages, and
[fumadocs](https://fumadocs.dev) for the documentation under `/docs`.

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm lint
pnpm build    # static export to out/
```

## Layout

| Path                            | What it is                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `app/(home)/page.tsx`           | The overview: the problem, the five resources and the operator, guarantees, lifecycle.     |
| `app/(home)/loop/page.tsx`      | The step-by-step walkthrough of one task converging (the reference trace, spec §10).       |
| `app/docs/`                     | The fumadocs layout and catch-all page that render `content/docs`.                          |
| `content/docs/**/*.mdx`         | The documentation. Folders are sidebar sections; `meta.json` sets order and titles.        |
| `app/api/search/route.ts`       | The search index, prerendered as a static file; queries run in the browser.                 |
| `components/landing/`           | Sections of the overview page.                                                              |
| `components/convergence/`       | The walkthrough's stepper, lineage and gate board.                                          |
| `components/ui/`                | shadcn/ui registry components.                                                              |
| `lib/source.ts`                 | The fumadocs content source (`fumadocs-mdx` macro API, no generated files).                |
| `lib/layout.shared.tsx`         | Nav title and links shared by the docs layout.                                              |

Both the site pages and the docs read from the same design tokens in
`app/globals.css`: fumadocs' `shadcn.css` preset maps its `--color-fd-*`
variables onto the shadcn tokens, so the docs pick up the site's palette and
dark mode automatically.

## Writing documentation

Add an `.mdx` file under `content/docs`. Frontmatter carries `title` and
`description`; the body starts at `##`. Quote any frontmatter value that
contains a colon. Available in MDX without imports: the fumadocs defaults
(`Callout`, `Cards`/`Card`, code blocks with titles), plus `Steps`/`Step`,
`Tabs`/`Tab` and `TypeTable` from `components/mdx.tsx`. Internal links are
site-relative (`/docs/install`). The sidebar order lives in the nearest
`meta.json`; the top-level one uses separators and `...folder` extraction to
keep the tree flat.

The documentation describes the system as specified in `../implementation.md`.
Pages that document Phase 2 behaviour say so in a callout.

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

Dark mode is class-based through `next-themes`, provided by fumadocs'
`RootProvider` in `app/provider.tsx`, following the system preference by
default.
