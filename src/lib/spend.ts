import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newSpendId } from "./ids";

/**
 * Ad-spend rows are upserted (one per site/provider/day/campaign) so pulling the
 * same date range twice just refreshes numbers rather than duplicating them.
 */
export type SpendRow = {
  provider: string; // meta | google | tiktok | manual
  channel: string; // MUST match attribution labels, e.g. "facebook / paid"
  source?: string; // facebook | google | tiktok
  day: string; // YYYY-MM-DD
  campaign?: string;
  campaignId?: string;
  spend: number; // minor units
  impressions?: number;
  clicks?: number;
  currency?: string;
};

export async function upsertSpend(siteId: string, rows: SpendRow[]): Promise<number> {
  const db = await getDb();
  let n = 0;
  for (const r of rows) {
    await db
      .insert(schema.adSpend)
      .values({
        id: newSpendId(),
        siteId,
        provider: r.provider,
        channel: r.channel,
        source: r.source ?? null,
        day: r.day,
        campaign: r.campaign ?? "",
        campaignId: r.campaignId ?? "",
        spend: Math.round(r.spend),
        impressions: r.impressions ?? 0,
        clicks: r.clicks ?? 0,
        currency: r.currency ?? "USD",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.adSpend.siteId, schema.adSpend.provider, schema.adSpend.day, schema.adSpend.campaignId],
        set: {
          channel: r.channel,
          source: r.source ?? null,
          campaign: r.campaign ?? "",
          spend: Math.round(r.spend),
          impressions: r.impressions ?? 0,
          clicks: r.clicks ?? 0,
          currency: r.currency ?? "USD",
          updatedAt: new Date(),
        },
      });
    n++;
  }
  return n;
}
