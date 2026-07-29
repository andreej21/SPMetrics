import { getDbHandle, schema } from "./client";
import { newSiteId, newPixelToken, newS2sKey } from "@/lib/ids";
import { loadEnv } from "./env";

/**
 * Register a real site and mint its tokens.
 *
 *   npm run site:create -- --name "Acme" --domain acme.com --origins "https://acme.com"
 *
 * Prints the pixel token (public, goes in the browser snippet) and the s2s key
 * (secret, for server-to-server / webhooks), plus a ready-to-paste install snippet.
 */
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  loadEnv();
  const name = arg("--name");
  if (!name) {
    console.error('Usage: npm run site:create -- --name "Acme" [--domain acme.com] [--platform generic|shopify] [--origins "https://acme.com,https://www.acme.com"]');
    process.exit(1);
  }
  const domain = arg("--domain") ?? null;
  const platform = (arg("--platform") as (typeof schema.platformEnum.enumValues)[number]) ?? "generic";
  const origins = arg("--origins") ?? null;

  const { db, raw, driver } = await getDbHandle();
  const pixelToken = newPixelToken();
  const s2sKey = newS2sKey();

  const [site] = await db
    .insert(schema.sites)
    .values({
      id: newSiteId(),
      name,
      domain,
      platform,
      pixelToken,
      s2sKey,
      allowedOrigins: origins,
    })
    .returning();

  const origin = process.env.NEXT_PUBLIC_COLLECTOR_ORIGIN || "https://YOUR-COLLECTOR-DOMAIN";

  console.log("\n✓ Site created\n");
  console.log("  id          :", site.id);
  console.log("  name        :", site.name);
  console.log("  domain      :", site.domain ?? "(none)");
  console.log("  platform    :", site.platform);
  console.log("  pixel token :", pixelToken, "  <- public, put in the snippet");
  console.log("  s2s key     :", s2sKey, "     <- SECRET, server-side only");
  console.log("  allowed origins:", origins ?? "(any — restrict before production)");

  console.log("\n─ Install snippet (paste in the site's <head>) ─\n");
  console.log(`<script>
  !function(){window.sp=window.sp||function(){(sp.q=sp.q||[]).push(arguments)};
  var s=document.createElement('script');s.async=1;s.src='${origin}/px.js';
  document.head.appendChild(s);}();
  sp('init','${pixelToken}');
</script>\n`);

  if (driver === "pg") await (raw as { end: () => Promise<void> }).end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
