import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM binary + fs assets; keep it external so Next doesn't try to bundle it.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
