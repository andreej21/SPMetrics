import { NextRequest } from "next/server";
import { siteByS2sKey } from "@/lib/sites";
import { ingestBatch, type IncomingEvent } from "@/lib/ingest";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-to-server ingestion. The merchant's backend calls this with the secret
 * s2s key to send trustworthy events (above all: purchases). Because there's no
 * browser, the caller passes the visitor's anon id if they have it (e.g. read
 * from the sp_vid cookie at checkout) so the order stitches to the right session.
 *
 *   POST /api/s2s
 *   Authorization: Bearer sk_...
 *   { "anonId": "vis_...", "events": [ { "type": "purchase", "order": {...} } ] }
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const key = auth.replace(/^Bearer\s+/i, "").trim();
  const site = await siteByS2sKey(key);
  if (!site) return json({ error: "unauthorized" }, { status: 401 });

  let body: { anonId?: string; email?: string; events?: IncomingEvent[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events.slice(0, 200) : [];
  if (events.length === 0) return json({ error: "no_events" }, { status: 400 });

  const result = await ingestBatch(
    {
      siteId: site.id,
      selfHost: site.domain ?? undefined,
      anonId: body.anonId,
      source: "server",
    },
    events,
  );

  return json({ ok: true, ...result });
}
