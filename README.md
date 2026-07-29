# SPMetrics

**Smart Pixel Metrics.** A first-party analytics & attribution pixel + event pipeline — the core of a
Triple Whale-style product. Built as **Next.js + TypeScript + Postgres**, with a
generic tracking core and a pluggable platform adapter (Shopify) layer.

**v1 scope: the pixel + event pipeline.** (Dashboard and ad-spend/ROAS joins are
the next phases — see the roadmap.)

## What it does

```
 ad click ──▶ landing page (fbclid / gclid / ttclid / utm_*)
    │
    ▼
 px.js (first-party)  ──batch──▶  /api/collect  ──▶  ingest
    │  sp_vid cookie                                   │
    │  (survives ITP/adblock)              visitor ─ session ─ events
    ▼                                          │         │
 merchant backend / Shopify  ──▶ /api/s2s ────┘         ▼
   (trusted purchases)         /api/webhooks/shopify   order  ← attributed to the click
```

- **First-party pixel** (`px.js`): persistent visitor id in a first-party cookie
  **and** localStorage, so identity survives Safari ITP and most ad-blockers.
- **Resilient delivery**: events are batched and flushed via `fetch(keepalive)` /
  `sendBeacon`, including on tab close. Purchases flush immediately.
- **SPA-aware**: auto page views on `history` navigation, not just first load.
- **Attribution**: click ids > UTMs > referrer, normalized to a channel
  (`facebook / paid`, `google / organic`, `direct`, …), captured at session entry
  and inherited by orders.
- **Server-side ingestion**: `/api/s2s` (Bearer key) for trustworthy purchase
  events; `/api/webhooks/shopify` maps `orders/create` → an attributed order,
  stitched to the browser session via an `sp_vid` cart attribute.
- **Dedup & idempotency**: unique `(site, dedupe_key)` on events and
  `(site, external_order_id)` on orders — client + server can both fire a purchase
  without double-counting.
- **Privacy**: emails and IPs are stored hashed (SHA-256; IPs salted per day).

## Data model (`src/db/schema.ts`)

`sites` · `visitors` (anon, first-party) · `identities` (known person) ·
`sessions` (attribution snapshot) · `events` (append-only stream) · `orders` (revenue).

## Running locally

No database install needed — dev uses **PGlite** (Postgres in WASM, persisted to
`./.pgdata`). Set `DATABASE_URL` to point at a real Postgres in production.

```bash
npm install
npm run pixel:build      # compile pixel-src/pixel.ts → public/px.js
npm run db:migrate       # apply schema (idempotent)
npm run seed             # create demo site (token pk_dev_demo / key sk_dev_demo)
npm run dev              # http://localhost:3000
```

Then open **http://localhost:3000/demo.html**, click around, and inspect
**http://localhost:3000/api/debug/stats** (dev-only).

### Send events by hand

```bash
# Client-style batch
curl -s -X POST http://localhost:3000/api/collect -H 'Content-Type: application/json' -d '{
  "token":"pk_dev_demo",
  "landingPage":"https://shop.example.com/?fbclid=abc",
  "events":[{"type":"purchase","dedupeKey":"o1","order":{"externalOrderId":"1001","totalAmount":2999,"currency":"USD"}}]
}'

# Trusted server-to-server purchase
curl -s -X POST http://localhost:3000/api/s2s \
  -H 'Authorization: Bearer sk_dev_demo' -H 'Content-Type: application/json' \
  -d '{"anonId":"vis_...","events":[{"type":"purchase","order":{"externalOrderId":"2002","totalAmount":8900}}]}'
```

## Install snippet (for a real store)

```html
<script>
  !function(){window.sp=window.sp||function(){(sp.q=sp.q||[]).push(arguments)};
  var s=document.createElement('script');s.async=1;s.src='https://YOUR_COLLECTOR/px.js';
  document.head.appendChild(s);}();
  sp('init','YOUR_PIXEL_TOKEN');
</script>
```

Track: `sp('track','add_to_cart',{...})`, `sp('identify',{email})`,
`sp('track','purchase',{order:{...}})`.

## Layout

```
pixel-src/pixel.ts              the browser tracker (compiled to public/px.js)
scripts/build-pixel.mjs         esbuild bundler for the pixel
src/db/                         schema, DDL, client (PGlite dev / pg prod), migrate, seed
src/lib/attribution.ts          click-id / UTM / referrer → channel
src/lib/ingest.ts               visitor→session→event→identity→order engine
src/lib/{ids,http,sites}.ts     ids/hashing, CORS/IP, site auth
src/app/api/collect             browser event collector
src/app/api/s2s                 server-to-server ingestion
src/app/api/webhooks/shopify    Shopify adapter (stub)
```

## Roadmap (next phases)

1. **Dashboard** — attribution overview (spend-free): sessions, conversion rate,
   revenue by channel/campaign, customer journeys.
2. **Ad-spend & ROAS** — pull Meta/Google/TikTok spend via their APIs and join to
   attributed revenue for true ROAS per campaign (the "why" of Triple Whale).
3. **Attribution models** — first-click, last-click, linear, position-based,
   time-decay, computed from the event stream (currently last-non-direct at session).
4. **Real Shopify app** — OAuth install, Web Pixel Extension, HMAC against the app
   secret, `sp_vid` injected into cart attributes automatically.
5. **Scale** — move `/api/collect` to the edge, buffer to a queue (Kafka/SQS) →
   warehouse (ClickHouse/BigQuery) for high-volume ingestion.
6. **Consent** — Consent Mode / GPC handling and per-region data policies.
```
