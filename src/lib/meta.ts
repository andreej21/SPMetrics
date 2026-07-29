import type { SpendRow } from "./spend";

/**
 * Meta (Facebook/Instagram) Marketing API connector.
 *
 * Pulls campaign-level daily spend so it can be joined to attributed revenue.
 * You need an access token with `ads_read` and an ad account id. For dev, generate
 * a token in the Graph API Explorer; for production, a proper Meta app + long-lived
 * token (that's the one 👤 step this whole integration needs).
 *
 * Channel is normalized to "facebook / paid" to match how the pixel labels fbclid
 * traffic, so channel-level ROAS lines up automatically.
 */
const API_VERSION = "v21.0";

export type MetaResult = { rows: SpendRow[]; currency: string };

export async function fetchMetaSpend(
  accessToken: string,
  adAccountId: string,
  since: string, // YYYY-MM-DD
  until: string, // YYYY-MM-DD
): Promise<MetaResult> {
  const acct = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const currency = await fetchAccountCurrency(accessToken, acct);

  const params = new URLSearchParams({
    level: "campaign",
    time_increment: "1", // one row per day
    fields: "campaign_id,campaign_name,spend,impressions,clicks",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
    access_token: accessToken,
  });

  let url: string | null = `https://graph.facebook.com/${API_VERSION}/${acct}/insights?${params.toString()}`;
  const rows: SpendRow[] = [];

  // Follow pagination.
  for (let page = 0; url && page < 50; page++) {
    const res = await fetch(url);
    const body = (await res.json()) as {
      data?: MetaInsightRow[];
      paging?: { next?: string };
      error?: { message: string; type: string; code: number };
    };
    if (body.error) throw new Error(`Meta API error: ${body.error.message} (code ${body.error.code})`);

    for (const d of body.data ?? []) {
      rows.push({
        provider: "meta",
        channel: "facebook / paid",
        source: "facebook",
        day: d.date_start,
        campaign: d.campaign_name ?? "",
        campaignId: d.campaign_id ?? "",
        spend: Math.round(parseFloat(d.spend ?? "0") * 100),
        impressions: parseInt(d.impressions ?? "0", 10),
        clicks: parseInt(d.clicks ?? "0", 10),
        currency,
      });
    }
    url = body.paging?.next ?? null;
  }

  return { rows, currency };
}

async function fetchAccountCurrency(accessToken: string, acct: string): Promise<string> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${acct}?fields=currency&access_token=${encodeURIComponent(accessToken)}`,
    );
    const body = (await res.json()) as { currency?: string };
    return body.currency ?? "USD";
  } catch {
    return "USD";
  }
}

type MetaInsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  date_start: string;
  date_stop: string;
};
