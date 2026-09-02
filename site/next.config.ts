import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site is fully static (the walkthrough is client-side), so `next build`
  // emits `out/` for GitHub Pages or any static host.
  output: "export",
};

export default nextConfig;
