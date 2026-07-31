/**
 * Attribution parsing.
 *
 * Turns a landing URL + referrer into a normalized channel, mirroring how
 * platforms like Triple Whale classify traffic. Click ids (fbclid/gclid/ttclid)
 * are the strongest signal and take priority over UTMs, which beat the referrer.
 */

export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  spmSource?: string;
  spmVersion?: string;
  spmExperiment?: string;
  spmChannel?: string;
  referrer?: string;
  landingPage?: string;
  channel: string; // e.g. "facebook / paid", "google / organic", "direct", "referral"
};

const CLICK_ID_CHANNEL: Record<string, string> = {
  fbclid: "facebook / paid",
  gclid: "google / paid",
  ttclid: "tiktok / paid",
  msclkid: "bing / paid",
};

// Known referrer hosts → source. Extend as needed.
const REFERRER_SOURCE: { test: RegExp; source: string; medium: string }[] = [
  { test: /(^|\.)google\./i, source: "google", medium: "organic" },
  { test: /(^|\.)bing\./i, source: "bing", medium: "organic" },
  { test: /(^|\.)duckduckgo\./i, source: "duckduckgo", medium: "organic" },
  { test: /(^|\.)(facebook|instagram|fb)\./i, source: "facebook", medium: "social" },
  { test: /(^|\.)(t\.co|twitter|x)\./i, source: "twitter", medium: "social" },
  { test: /(^|\.)tiktok\./i, source: "tiktok", medium: "social" },
  { test: /(^|\.)(youtube|youtu\.be)\./i, source: "youtube", medium: "social" },
  { test: /(^|\.)(reddit)\./i, source: "reddit", medium: "social" },
  { test: /(^|\.)(linkedin|lnkd\.in)\./i, source: "linkedin", medium: "social" },
  { test: /(^|\.)(pinterest)\./i, source: "pinterest", medium: "social" },
];

function safeUrl(raw?: string | null): URL | null {
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * @param landingPage full landing URL (with query string)
 * @param referrer    document.referrer at first touch
 * @param selfHost    the store's own host, so we can treat self-referrals as internal
 */
export function classify(landingPage?: string | null, referrer?: string | null, selfHost?: string): Attribution {
  const url = safeUrl(landingPage);
  const q = url?.searchParams;

  const get = (k: string) => q?.get(k) || undefined;

  const attr: Attribution = {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmContent: get("utm_content"),
    utmTerm: get("utm_term"),
    fbclid: get("fbclid"),
    gclid: get("gclid"),
    ttclid: get("ttclid"),
    spmSource: get("spm_source"),
    spmVersion: get("spm_version"),
    spmExperiment: get("spm_experiment"),
    spmChannel: get("spm_channel"),
    referrer: referrer || undefined,
    landingPage: landingPage || undefined,
    channel: "direct",
  };

  // 1) Click ids win — they mean a paid click almost every time.
  for (const [param, channel] of Object.entries(CLICK_ID_CHANNEL)) {
    if (get(param)) {
      attr.channel = channel;
      attr.utmSource ??= channel.split(" / ")[0];
      attr.utmMedium ??= "paid";
      return attr;
    }
  }

  // 2) Explicit UTMs.
  if (attr.utmSource || attr.utmMedium) {
    attr.channel = `${attr.utmSource ?? "unknown"} / ${attr.utmMedium ?? "unknown"}`;
    return attr;
  }

  // 3) Referrer-based classification.
  const ref = safeUrl(referrer);
  if (ref) {
    if (selfHost && ref.host.replace(/^www\./, "") === selfHost.replace(/^www\./, "")) {
      // internal navigation — treat as continuation, not a new source
      attr.channel = "direct";
      return attr;
    }
    for (const rule of REFERRER_SOURCE) {
      if (rule.test.test(ref.host)) {
        attr.utmSource ??= rule.source;
        attr.utmMedium ??= rule.medium;
        attr.channel = `${rule.source} / ${rule.medium}`;
        return attr;
      }
    }
    // Unknown external referrer.
    attr.utmSource ??= ref.host;
    attr.utmMedium ??= "referral";
    attr.channel = `${ref.host} / referral`;
    return attr;
  }

  // 4) No signal at all.
  attr.channel = "direct";
  return attr;
}

export function deviceTypeFromUA(ua?: string | null): "mobile" | "tablet" | "desktop" {
  if (!ua) return "desktop";
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
}
