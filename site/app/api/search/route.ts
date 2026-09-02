import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

// Static export: the index is prerendered to a JSON file and searched in the
// browser (components/search.tsx uses the static client).
export const dynamic = "force-static";
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source);
