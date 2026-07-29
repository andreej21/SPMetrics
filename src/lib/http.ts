import { NextRequest, NextResponse } from "next/server";

/**
 * CORS for the collector. The pixel runs on the merchant's storefront origin
 * and POSTs cross-origin to us, so we must reflect an allowed origin and allow
 * credentials (for the first-party cookie round-trip via the collector domain).
 */
export function corsHeaders(origin: string | null, allowed?: string | null): Record<string, string> {
  // allowed = comma-separated list stored on the site; empty/"*" means reflect any origin.
  const list = (allowed ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowAny = list.length === 0 || list.includes("*");
  const allowOrigin = origin && (allowAny || list.includes(origin)) ? origin : list[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function preflight(req: NextRequest, allowed?: string | null): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin"), allowed) });
}

// Best-effort client IP from common proxy headers.
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "0.0.0.0";
}

// Daily salt so hashed IPs can't be correlated across days.
export function dailySalt(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as Record<string, unknown>, init);
}
