# Adding the SPMetrics pixel to a website

## The core idea (read this first)
A pixel is just a `<script>` tag. "Installing on a third-party website" means getting
that tag onto the pages of a site. **You can only do that on a site you (or your
client) can edit** — its theme, its CMS, or its tag manager. You can't inject a pixel
into a site you have no access to; the site owner runs the snippet, or gives you access.

So the real flow for a client/merchant is always one of:
1. **You have admin access** → you paste it yourself.
2. **The merchant pastes it** → you send them the snippet + these instructions.
3. **You use their tag manager** (Google Tag Manager) → the cleanest, no theme edits.

Everything below assumes SPMetrics is already deployed to a public URL
(see [DEPLOY.md](DEPLOY.md)) and you've minted a token with `npm run site:create`.

---

## The snippet
`site:create` prints this, filled in with the site's token and your collector URL:

```html
<script>
  !function(){window.sp=window.sp||function(){(sp.q=sp.q||[]).push(arguments)};
  var s=document.createElement('script');s.async=1;s.src='https://YOUR-COLLECTOR/px.js';
  document.head.appendChild(s);}();
  sp('init','pk_XXXXXXXX');
</script>
```

It must load on **every page** of the site, so it goes in the global `<head>`,
not one page.

---

## Method 1 — Any site you can edit the HTML of
Paste the snippet just before `</head>` in the site's layout/template. Done.
Static sites, custom apps, Webflow (Project Settings → Custom Code → Head Code),
Framer, Carrd, etc. all have a "head code" field — paste it there.

## Method 2 — Shopify
1. Shopify admin → **Online Store → Themes → … → Edit code**.
2. Open **`layout/theme.liquid`**.
3. Paste the snippet right before `</head>`. Save.
4. (For reliable purchase tracking) also fire a purchase on the order-status page:
   Settings → Checkout → **Order status page → Additional scripts**:
   ```html
   <script>
     sp('track','purchase',{ _id:'{{ order.order_number }}', order:{
       externalOrderId:'{{ order.order_number }}',
       totalAmount: {{ order.total_price }},           /* Shopify gives cents */
       currency:'{{ order.currency }}'
     }});
   </script>
   ```
5. Best practice: also write the visitor id into cart attributes so server-side
   orders stitch back (this is what the webhook adapter reads as `sp_vid`).

## Method 3 — Google Tag Manager (works on ANY site, no theme edits)
This is how agencies install pixels on clients' sites.
1. In GTM: **Tags → New → Custom HTML**.
2. Paste the snippet.
3. Trigger: **All Pages**. Save.
4. **Submit / Publish** the container.
If the site already has GTM, you never touch their code — you just need access to
their GTM container (or they add you).

## Method 4 — WordPress
- Easiest: a "header/footer scripts" plugin (e.g. WPCode) → paste in the header.
- Or theme editor → `header.php` before `</head>`.

---

## Verify it worked (every time)
1. Load the site in Chrome with the **SPMetrics Pixel Helper** extension installed
   (see [extension/README.md](extension/README.md)).
2. The badge should go **green**; open the popup — you should see the pixel token,
   the collector origin, and a `page_view` event.
3. Cross-check in Supabase: a new row in `sessions`/`events` for that site.

---

## Making it *truly* first-party (per-merchant CNAME)
By default the merchant's browser sees `px.js` coming from your domain
(`spmetrics.vercel.app`), which Safari treats as third-party → the `sp_vid` cookie
gets capped to ~7 days. To get the durable first-party cookie that's the whole point:

1. Merchant adds a DNS **CNAME**: `metrics.theirstore.com → cname.vercel-dns.com`
   (or your host's CNAME target).
2. Add `metrics.theirstore.com` as a domain in your Vercel project.
3. Give them a snippet whose `src` is `https://metrics.theirstore.com/px.js`.
4. Set `COOKIE_DOMAIN=.theirstore.com` handling per-site (roadmap: store this on the
   site record and set the cookie domain dynamically in `/api/collect`).

Now the pixel and collector are same-site with the store → first-party cookie that
survives ITP. This is your biggest edge over the stock Meta/Google pixels.
