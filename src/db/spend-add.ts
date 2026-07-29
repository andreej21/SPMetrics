import { eq } from "drizzle-orm";
import { getDbHandle, schema } from "./client";
import { upsertSpend } from "@/lib/spend";
import { loadEnv } from "./env";

/**
 * Manually add/adjust ad spend for a day — so you can test ROAS without any
 * ad-platform API access.
 *
 *   npm run spend:add -- --token pk_... --channel "facebook / paid" --day 2026-07-28 --spend 45.00 [--currency USD] [--campaign "Summer"]
 *
 * --spend is in MAJOR units (dollars) here for convenience; stored as cents.
 */
function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  loadEnv();
  const pixelToken = arg("--token");
  const channel = arg("--channel");
  const day = arg("--day");
  const spend = arg("--spend");
  if (!pixelToken || !channel || !day || spend == null) {
    console.error('Usage: npm run spend:add -- --token pk_... --channel "facebook / paid" --day 2026-07-28 --spend 45.00 [--campaign "Name"] [--currency USD]');
    process.exit(1);
  }

  const { db, raw, driver } = await getDbHandle();
  const site = await db.query.sites.findFirst({ where: eq(schema.sites.pixelToken, pixelToken) });
  if (!site) {
    console.error("No site found for that pixel token.");
    process.exit(1);
  }

  const n = await upsertSpend(site.id, [
    {
      provider: "manual",
      channel,
      source: channel.split(" / ")[0],
      day,
      campaign: arg("--campaign") ?? "",
      spend: Math.round(parseFloat(spend) * 100),
      currency: arg("--currency") ?? "USD",
    },
  ]);
  console.log(`✓ Upserted ${n} spend row: ${channel} ${day} ${spend} for ${site.name}`);

  if (driver === "pg") await (raw as { end: () => Promise<void> }).end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
