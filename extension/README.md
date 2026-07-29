# SPMetrics Pixel Helper (Chrome extension)

Checks whether the SPMetrics pixel is installed and firing on any page — the
equivalent of Meta's Pixel Helper for your own pixel.

## What it shows (Triple-Whale-style)
- **Pixel block:** pixel id, version, platform, headless flag, collector origin,
  and the first-party `sp_vid` visitor id — read from the `window.__SPMETRICS__`
  object the pixel publishes on init.
- **Events:** a live, expandable list. Each event shows an icon, a friendly label
  ("Page Load", "Add to Cart", "Purchase"…), a **Valid / ⚠ / Invalid** status, and a
  timestamp. Expand a row to see its **Received Parameters** (url, product, price,
  order total, email, token).
- **Troubleshoot** button: a pass/fail checklist (px.js loaded, sp() present,
  initialized, cookie set, events sending).
- **⤢ pop-out** button: opens the helper in its own resizable window.
- The list **live-updates** every second, and the toolbar badge shows a live event count.

## Install (developer mode)
1. Open **chrome://extensions**
2. Toggle **Developer mode** (top-right) on
3. Click **Load unpacked** and select this `extension/` folder
4. Pin the extension, open any page with the pixel (e.g. your `/demo.html`), and click the icon

Works in any Chromium browser (Chrome, Edge, Brave, Arc). Requires Chrome 111+
(uses `world: "MAIN"` content scripts).

## How it works
- `inject.js` runs in the page, detects the pixel and wraps `fetch`/`sendBeacon`.
- `bridge.js` relays findings to `background.js`, which holds per-tab state and the badge.
- `popup.js` renders the status panel.

## Notes / next steps
- Detection assumes the conventions this pixel uses (`sp()` global, `px.js`, `/api/collect`,
  `sp_vid` cookie). If you rename any of those, update `inject.js`.
- Icons (`icon16/48/128.png`) are bundled and referenced in `manifest.json`.
  Regenerate/restyle them with `npm run icons:build` (edit colors in `scripts/make-icons.mjs`).
- To publish on the Chrome Web Store later, you'll also need a privacy note and store listing.
