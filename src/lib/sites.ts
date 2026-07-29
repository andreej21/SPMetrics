import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export async function siteByPixelToken(token: string) {
  if (!token) return null;
  const db = await getDb();
  return (await db.query.sites.findFirst({ where: eq(schema.sites.pixelToken, token) })) ?? null;
}

export async function siteByS2sKey(key: string) {
  if (!key) return null;
  const db = await getDb();
  const site = await db.query.sites.findFirst({ where: eq(schema.sites.s2sKey, key) });
  return site ?? null;
}
