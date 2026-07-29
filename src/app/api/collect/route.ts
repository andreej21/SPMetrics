import { NextRequest, NextResponse } from "next/server";
import { siteByPixelToken } from "@/lib/sites";
import { ingestBatch, type IncomingEvent } from "@/lib/ingest";
import { corsHeaders, preflight, clientIp, dailySalt, json } from "@/lib/http";
import { hashIp, newVisitorId } from "@/lib/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "sp_vid"; // first-party visitor id
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 years

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  let body: {
    token?: string;
    anonId?: string;
    landingPage?: string;
    referrer?: string;
    events?: IncomingEvent[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders(origin) });
  }

  const site = await siteByPixelToken(body.token ?? "");
  if (!site) {
    return json({ error: "unknown_token" }, { status: 401, headers: corsHeaders(origin) });
  }

  const headers = corsHeaders(origin, site.allowedOrigins);
  const events = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
  if (events.length === 0) {
    return json({ error: "no_events" }, { status: 400, headers });
  }

  // Prefer the server-set cookie over a client-supplied anon id (harder to spoof).
  const cookieVid = req.cookies.get(COOKIE)?.value;
  const anonId = cookieVid || body.anonId || newVisitorId();

  const ua = req.headers.get("user-agent") ?? undefined;
  const ipHash = hashIp(clientIp(req), dailySalt());

  const result = await ingestBatch(
    {
      siteId: site.id,
      selfHost: site.domain ?? undefined,
      anonId,
      landingPage: body.landingPage,
      referrer: body.referrer,
      userAgent: ua,
      ipHash,
      country: req.headers.get("x-vercel-ip-country") ?? undefined,
      region: req.headers.get("x-vercel-ip-country-region") ?? undefined,
      source: "client",
    },
    events,
  );

  const res = json({ ok: true, ...result }, { headers });

  // (Re)issue the first-party cookie so the browser keeps sending the same visitor id.
  const cookieDomain = process.env.COOKIE_DOMAIN?.trim() || undefined;
  res.cookies.set(COOKIE, result.visitorId, {
    httpOnly: false, // pixel reads it too; it's not a secret
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    domain: cookieDomain,
  });
  return res;
}
