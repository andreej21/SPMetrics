import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteByPixelToken } from "@/lib/sites";
import { ingestBatch, type IncomingEvent } from "@/lib/ingest";
import { json } from "@/lib/http";
import type { OrderLineItem } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shopify adapter (v1 stub).
 *
 * Register this URL as the `orders/create` (and `orders/paid`) webhook, with the
 * site's pixel token in the query string:  /api/webhooks/shopify?site=pk_...
 *
 * Reliable stitching trick (same as Triple Whale): the pixel writes the visitor's
 * anon id into a cart attribute at checkout, so it comes back on the order as a
 * note_attribute named `sp_vid`. That's how a server-side order finds its session.
 *
 * NOTE: HMAC verification uses the site's s2sKey as the shared secret for now.
 * A real Shopify app would verify against the app's API secret and handle the
 * OAuth install flow — that's the next iteration of this adapter.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("site") ?? "";
  const site = await siteByPixelToken(token);
  if (!site) return json({ error: "unknown_site" }, { status: 401 });

  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  if (!verifyShopifyHmac(raw, hmac, site.s2sKey)) {
    return json({ error: "bad_hmac" }, { status: 401 });
  }

  let payload: ShopifyOrder;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const anonId = payload.note_attributes?.find((a) => a.name === "sp_vid")?.value;

  const lineItems: OrderLineItem[] = (payload.line_items ?? []).map((li) => ({
    productId: String(li.product_id ?? ""),
    variantId: String(li.variant_id ?? ""),
    title: li.title,
    quantity: li.quantity,
    price: toMinorUnits(li.price),
  }));

  const purchase: IncomingEvent = {
    type: "purchase",
    dedupeKey: `shopify_order_${payload.id}`,
    email: payload.email ?? payload.customer?.email ?? undefined,
    externalId: payload.customer?.id ? String(payload.customer.id) : undefined,
    ts: payload.created_at ? new Date(payload.created_at).getTime() : undefined,
    order: {
      externalOrderId: String(payload.id),
      orderNumber: payload.order_number ? String(payload.order_number) : undefined,
      totalAmount: toMinorUnits(payload.total_price),
      subtotalAmount: payload.subtotal_price ? toMinorUnits(payload.subtotal_price) : undefined,
      currency: payload.currency ?? "USD",
      isNewCustomer: payload.customer?.orders_count === 1,
      lineItems,
    },
  };

  // If we have an email, emit an identify first so the order links to a person.
  const events: IncomingEvent[] = [];
  if (purchase.email) {
    events.push({ type: "identify", email: purchase.email, externalId: purchase.externalId });
  }
  events.push(purchase);

  const result = await ingestBatch(
    { siteId: site.id, selfHost: site.domain ?? undefined, anonId, source: "server" },
    events,
  );

  return json({ ok: true, ...result });
}

function verifyShopifyHmac(raw: string, headerHmac: string, secret: string): boolean {
  if (!headerHmac) return false;
  const digest = createHmac("sha256", secret).update(raw, "utf8").digest("base64");
  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(headerHmac);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Shopify sends money as decimal strings ("129.95"); we store integer minor units.
function toMinorUnits(v?: string | number | null): number {
  if (v == null) return 0;
  return Math.round(Number(v) * 100);
}

type ShopifyOrder = {
  id: number | string;
  order_number?: number | string;
  email?: string;
  currency?: string;
  total_price?: string;
  subtotal_price?: string;
  created_at?: string;
  note_attributes?: { name: string; value: string }[];
  customer?: { id?: number | string; email?: string; orders_count?: number };
  line_items?: { product_id?: number | string; variant_id?: number | string; title: string; quantity: number; price: string }[];
};
