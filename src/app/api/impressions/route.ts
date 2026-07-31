import { NextRequest } from "next/server";
import { siteByS2sKey } from "@/lib/sites";
import { getDb, schema } from "@/db/client";
import { json } from "@/lib/http";
import { newImpressionId, newVisitorId } from "@/lib/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ImpressionPayload {
  anonId?: string;
  provider: string; // "meta" | "google" | "tiktok" | "custom"
  channel?: string; // "facebook / paid", "google / paid", etc
  source?: string; // facebook | google | tiktok
  campaign?: string;
  adId?: string;
  adTitle?: string;
  viewThroughWindow?: number; // default 30 days
}

export async function POST(req: NextRequest) {
  let body: ImpressionPayload;

  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return json({ error: "missing_auth" }, { status: 401 });
  }

  const s2sKey = auth.slice(7);
  const site = await siteByS2sKey(s2sKey);
  if (!site) {
    return json({ error: "invalid_key" }, { status: 401 });
  }

  const db = await getDb();
  const now = new Date();

  // Find or create visitor if anonId provided
  let visitorId: string | null = null;
  if (body.anonId) {
    const existing = await db.query.visitors.findFirst({
      where: (v, { and, eq }) =>
        and(eq(v.id, body.anonId!), eq(v.siteId, site.id)),
    });
    visitorId = existing?.id ?? body.anonId;

    if (!existing) {
      await db
        .insert(schema.visitors)
        .values({
          id: visitorId,
          siteId: site.id,
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .onConflictDoNothing({ target: schema.visitors.id });
    }
  } else {
    visitorId = newVisitorId();
    await db
      .insert(schema.visitors)
      .values({
        id: visitorId,
        siteId: site.id,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoNothing({ target: schema.visitors.id });
  }

  // Record the impression
  await db.insert(schema.impressions).values({
    id: newImpressionId(),
    siteId: site.id,
    visitorId,
    provider: body.provider,
    channel: body.channel,
    source: body.source,
    campaign: body.campaign,
    adId: body.adId,
    adTitle: body.adTitle,
    viewThroughWindow: body.viewThroughWindow ?? 30,
    impressedAt: now,
  });

  return json({ ok: true, visitorId });
}
