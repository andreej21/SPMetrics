import { eq } from "drizzle-orm";
import { getDbHandle } from "./client";
import { schema } from "./client";
import { newSiteId } from "@/lib/ids";
import { loadEnv } from "./env";

// Fixed dev credentials so the demo storefront + curl examples are reproducible.
const DEV_PIXEL_TOKEN = "pk_dev_demo";
const DEV_S2S_KEY = "sk_dev_demo";

async function main() {
  loadEnv();
  const { db, raw, driver } = await getDbHandle();

  const existing = await db.query.sites.findFirst({
    where: eq(schema.sites.pixelToken, DEV_PIXEL_TOKEN),
  });

  if (existing) {
    console.log("Demo site already exists:", existing.id);
  } else {
    const [site] = await db
      .insert(schema.sites)
      .values({
        id: newSiteId(),
        name: "Demo Store",
        domain: "localhost",
        platform: "generic",
        pixelToken: DEV_PIXEL_TOKEN,
        s2sKey: DEV_S2S_KEY,
        allowedOrigins: "", // reflect any origin in dev
      })
      .returning();
    console.log("✓ Created demo site:", site.id);
  }

  console.log("\nDev credentials:");
  console.log("  pixel token :", DEV_PIXEL_TOKEN);
  console.log("  s2s key     :", DEV_S2S_KEY);

  if (driver === "pg") await (raw as { end: () => Promise<void> }).end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
