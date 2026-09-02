import type { ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";

// The overview and the walkthrough share the site's own header; the docs
// under /docs use the fumadocs layout instead.
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      {children}
    </>
  );
}
