import { NextRequest, NextResponse } from "next/server";
import { siteByS2sKey } from "@/lib/sites";
import { ingestBatch, type IncomingEvent } from "@/lib/ingest";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: {
    anonId?: string;
    email?: string;
    externalId?: string;
    events?: IncomingEvent[];
  };

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

  const events = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
  if (events.length === 0) {
    return json({ error: "no_events" }, { status: 400 });
  }

  const result = await ingestBatch(
    {
      siteId: site.id,
      selfHost: site.domain ?? undefined,
      anonId: body.anonId ?? undefined,
      source: "server",
    },
    events,
  );

  return json(result);
}
