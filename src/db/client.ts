import * as schema from "./schema";

/**
 * One DB accessor for the whole app.
 *
 *   - No DATABASE_URL  -> embedded PGlite (Postgres in WASM, persisted to ./.pgdata).
 *                         Zero install, great for local dev.
 *   - DATABASE_URL set  -> real Postgres via node-postgres (prod / staging).
 *
 * The returned handle is a Drizzle client in both cases, so query code is identical.
 */

// Both drivers expose the same Drizzle query API. We surface a single type
// (node-postgres') so query code has one consistent set of method signatures —
// a union type would make calls like .onConflictDoNothing(cfg) ambiguous.
export type Db = import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema>;

type DbHandle = {
  db: Db;
  driver: "pglite" | "pg";
  raw: unknown;
};

// Cache across hot-reloads / lambda invocations so we don't open a new pool per request.
const globalForDb = globalThis as unknown as { __spmetricsDb?: Promise<DbHandle> };

async function create(): Promise<DbHandle> {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    // Managed Postgres (Supabase/Neon/RDS) requires SSL; local Postgres doesn't.
    // Enable SSL unless the host is clearly local or SSL was explicitly disabled.
    const isLocal = /@(localhost|127\.0\.0\.1|::1)[:/]/.test(url);
    const sslDisabled = /sslmode=disable/.test(url);
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX ?? 10),
      ssl: !isLocal && !sslDisabled ? { rejectUnauthorized: false } : undefined,
    });
    return { db: drizzle(pool, { schema }), driver: "pg", raw: pool };
  }

  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = process.env.PGLITE_DATA_DIR || ".pgdata";
  const client = new PGlite(dataDir);
  await client.waitReady;
  // PGlite's Drizzle client is API-compatible; present it as the unified Db type.
  return { db: drizzle(client, { schema }) as unknown as Db, driver: "pglite", raw: client };
}

export function getDbHandle(): Promise<DbHandle> {
  if (!globalForDb.__spmetricsDb) {
    globalForDb.__spmetricsDb = create();
  }
  return globalForDb.__spmetricsDb;
}

export async function getDb() {
  return (await getDbHandle()).db;
}

export { schema };
