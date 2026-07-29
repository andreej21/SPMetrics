import type { Config } from "drizzle-kit";

// Used only for `drizzle-kit generate/studio` against a real Postgres
// (set DATABASE_URL). Local dev applies schema via `npm run db:migrate`.
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://localhost:5432/spmetrics",
  },
} satisfies Config;
