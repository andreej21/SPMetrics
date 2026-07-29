import { existsSync } from "node:fs";

/**
 * Load .env.local for standalone scripts (migrate/seed) run via tsx.
 * Next.js loads env automatically for the app, so this is a no-op there.
 */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file) && typeof process.loadEnvFile === "function") {
      try {
        process.loadEnvFile(file);
      } catch {
        /* ignore */
      }
    }
  }
}
