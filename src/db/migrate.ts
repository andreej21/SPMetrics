import { getDbHandle } from "./client";
import { DDL } from "./ddl";
import { loadEnv } from "./env";

async function main() {
  loadEnv();
  const { raw, driver } = await getDbHandle();
  console.log(`Applying schema via ${driver}...`);

  if (driver === "pglite") {
    // PGlite exposes .exec() for multi-statement SQL.
    await (raw as { exec: (sql: string) => Promise<unknown> }).exec(DDL);
  } else {
    await (raw as { query: (sql: string) => Promise<unknown> }).query(DDL);
    await (raw as { end: () => Promise<void> }).end();
  }

  console.log("✓ Schema applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
