// Reproduces `shadcn add <component>` for this project offline.
//
// The registry pipeline (shadcn-ui/ui, apps/v4/scripts/build-registry.mts)
// compiles the "nova" style into the Base UI component sources with
// createStyleMap + transformStyle from the shadcn package, then the CLI
// rewrites registry aliases to the project's aliases. This script does the
// same against a checkout of shadcn-ui/ui, for the components listed below.
//
//   SRC=/path/to/shadcn-ui/apps/v4/registry node scripts/sync-shadcn.mjs
//
// From a network that can reach ui.shadcn.com, `pnpm dlx shadcn@latest add
// <name>` produces identical files and is the preferred route.
import { readFileSync, writeFileSync } from "node:fs";
import { createStyleMap, transformStyle } from "shadcn/utils";

const SRC = process.env.SRC;
if (!SRC) throw new Error("SRC must point at shadcn-ui/ui/apps/v4/registry");

const styleMap = createStyleMap(readFileSync(`${SRC}/styles/style-nova.css`, "utf8"));
const names = process.argv.slice(2);
if (names.length === 0) names.push("button", "badge", "card", "table", "collapsible", "separator");

for (const n of names) {
  const source = readFileSync(`${SRC}/bases/base/ui/${n}.tsx`, "utf8");
  let out = await transformStyle(source, { styleMap });
  out = out
    .replaceAll("@/registry/bases/base/lib/utils", "@/lib/utils")
    .replaceAll("@/registry/bases/base/ui/", "@/components/ui/")
    .replaceAll("@/registry/bases/base/hooks/", "@/hooks/");
  // The CLI's transform-font step: the cn-font-heading marker becomes the
  // font-heading utility when the project's CSS declares --font-heading:
  // (globals.css does), and is dropped otherwise.
  out = out.replaceAll("cn-font-heading", "font-heading");
  const leftover = [...new Set(out.match(/cn-[a-z0-9-]+/g) ?? [])];
  writeFileSync(`components/ui/${n}.tsx`, out);
  console.log(`components/ui/${n}.tsx: ${out.split("\n").length} lines${leftover.length ? `  UNRESOLVED: ${leftover.join(" ")}` : ""}`);
}
