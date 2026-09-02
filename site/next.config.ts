import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site is fully static (the walkthrough is client-side), so `next build`
  // emits `out/` for GitHub Pages or any static host.
  output: "export",
  // Emit route/index.html so any static host serves /loop without rewrites.
  trailingSlash: true,
};

export default nextConfig;
