# SPMetrics — implementation roadmap

Legend:  ✅ done · 🔨 building now · ⬜ to do · 👤 = only you can do it (accounts/access) · 🤖 = I build it

## Phase 0 — Foundation (DONE)
- ✅ 🤖 First-party pixel (`px.js`) — cookie, batching, SPA, attribution capture
- ✅ 🤖 Collector pipeline (`/api/collect`, `/api/s2s`, Shopify webhook adapter)
- ✅ 🤖 Data model + Supabase (Postgres) connected
- ✅ 🤖 Site registration CLI (`npm run site:create`)
- ✅ 🤖 Chrome pixel-checker extension
- ✅ 🤖 Deploy config + install/deploy docs

## Phase 1 — See it & ship it public
1. ⬜ 👤 **Verify locally** — load the extension, test on `/demo.html` (2 min)
2. ⬜ 👤 **Deploy to Vercel** — public collector (follow DEPLOY.md; I guide each screen)
3. ⬜ 👤 **Install on one real site** — your own or a client's (INSTALL.md)

## Phase 2 — Make it a product you look at
4. 🔨 🤖 **Dashboard** — revenue by channel, orders, conversion rate, AOV, recent orders
5. ⬜ 🤖 **Auth + multi-tenant** — login, each customer sees only their sites

## Phase 3 — The competitive moat
6. ⬜ 🤖 **Ad-spend integration (Meta first)** — pull spend, join to attributed revenue = true ROAS
   - ⬜ 👤 sub-step: create a Meta developer app + approve API access (only you can)
7. ⬜ 🤖 **Attribution models** — first/last click, linear, time-decay
8. ⬜ 🤖 **Google + TikTok spend** — same pattern as Meta

## Phase 4 — Scale & harden (when you have real traffic)
9. ⬜ 🤖 Rate limiting + bot filtering on the collector
10. ⬜ 🤖 Edge collector + queue (decouple ingest from DB writes)
11. ⬜ 🤖 ClickHouse/BigQuery for the event firehose (only at high volume)

---

### The rule of thumb
- Anything marked 🤖 I can build without you.
- Anything marked 👤 needs your accounts/access — I'll hand you exact steps and stand by.
- We go **top to bottom**. Don't skip to Phase 3 before Phase 1.
