import { build, context } from "esbuild";
import { existsSync } from "node:fs";

// Load env for the collector origin (Node 22+).
for (const f of [".env.local", ".env"]) {
  if (existsSync(f) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(f);
    } catch {}
  }
}

const origin = process.env.NEXT_PUBLIC_COLLECTOR_ORIGIN || "http://localhost:3000";
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const opts = {
  entryPoints: ["pixel-src/pixel.ts"],
  outfile: "public/px.js",
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ["es2018"],
  format: "iife",
  legalComments: "none",
  define: {
    "__COLLECTOR_ORIGIN__": JSON.stringify(origin),
  },
  banner: { js: "/* SPMetrics px.js — first-party analytics tracker */" },
};

if (watch) {
  const ctx = await context(opts);
  await ctx.watch();
  console.log("👀 pixel: watching pixel-src/pixel.ts → public/px.js");
} else {
  await build(opts);
  console.log(`✓ pixel built → public/px.js (collector origin: ${origin})`);
}
