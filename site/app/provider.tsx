"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import SearchDialog from "@/components/search";

// RootProvider carries next-themes (class-based dark mode) and the search
// dialog. It lives in a client component so the dialog component can be
// passed from the server-rendered root layout.
export function Provider({ children }: { children: ReactNode }) {
  return <RootProvider search={{ SearchDialog }}>{children}</RootProvider>;
}
