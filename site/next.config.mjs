import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // The site is fully static (the walkthrough is client-side and the docs
  // are prerendered MDX), so `next build` emits `out/` for any static host.
  output: "export",
  // Emit route/index.html so any static host serves /loop and /docs/* without rewrites.
  trailingSlash: true,
};

export default withMDX(config);
