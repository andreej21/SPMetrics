import { NextRequest } from "next/server";
import { siteByS2sKey } from "@/lib/sites";
import { upsertSpend, type SpendRow } from "@/lib/spend";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Push ad-spend rows (from your own ETL, a cron, or a CSV import).
 *
 *   POST /api/spend
 *   Authorization: Bearer sk_...
 *   { "rows": [ { "provider":"meta","channel":"facebook / paid","day":"2026-07-20","spend":4500 } ] }
 *
 * spend is in minor units (cents). Rows upsert on (site, provider, day, campaign).
 */
export async function POST(req: NextRequest) {
  const key = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const site = await siteByS2sKey(key);
  if (!site) return json({ error: "unauthorized" }, { status: 401 });

  let body: { rows?: SpendRow[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return json({ error: "no_rows" }, { status: 400 });

  const upserted = await upsertSpend(site.id, rows.slice(0, 5000));
  return json({ ok: true, upserted });
}
