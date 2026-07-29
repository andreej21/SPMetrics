import { eq } from "drizzle-orm";
import { getDbHandle, schema } from "./client";
import { fetchMetaSpend } from "@/lib/meta";
import { upsertSpend } from "@/lib/spend";
import { loadEnv } from "./env";

/**
 * Pull Meta ad spend into ad_spend.
 *
 *   META_ACCESS_TOKEN=... META_AD_ACCOUNT_ID=123456 \
 *   npm run spend:meta -- --token pk_... --since 2026-07-01 --until 2026-07-29
 *
 * --token is the site's PIXEL token (identifies which site the spend belongs to).
 */
function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

async function main() {
  loadEnv();
  const pixelToken = arg("--token");
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const since = arg("--since") ?? daysAgo(30);
  const until = arg("--until") ?? daysAgo(0);

  if (!pixelToken || !accessToken || !adAccountId) {
    console.error("Need: --token pk_... and env META_ACCESS_TOKEN, META_AD_ACCOUNT_ID");
    process.exit(1);
  }

  const { db, raw, driver } = await getDbHandle();
  const site = await db.query.sites.findFirst({ where: eq(schema.sites.pixelToken, pixelToken) });
  if (!site) {
    console.error("No site found for that pixel token.");
    process.exit(1);
  }

  console.log(`Pulling Meta spend ${since} → ${until} for ${site.name}...`);
  const { rows, currency } = await fetchMetaSpend(accessToken, adAccountId, since, until);
  const n = await upsertSpend(site.id, rows);
  const total = rows.reduce((s, r) => s + r.spend, 0);
  console.log(`✓ Upserted ${n} rows. Total spend: ${(total / 100).toFixed(2)} ${currency}`);

  if (driver === "pg") await (raw as { end: () => Promise<void> }).end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
