# View-Through Attribution — Track Conversions from Ad Impressions

## Overview

View-through attribution lets you measure conversions that happened without a direct click. Example: user sees a retargeting ad, browses away, then converts 2 days later without re-clicking the ad.

**This solves a critical attribution gap**: Meta Pixel can only see click → conversion paths. If a user sees an impression but converts via direct traffic, email, or organic, Meta has no record of that impression's influence.

## How It Works

1. **Record an impression** when a user sees an ad (from Meta, Google, TikTok, or custom)
   - Send to `/api/impressions` with the visitor's `anonId` (sp_vid from the pixel)
   - Include provider, channel, campaign, creative ID
   - Set a lookback window (default 30 days)

2. **SPMetrics stores the impression** linked to the visitor

3. **When a conversion happens**, SPMetrics looks back:
   - Did this visitor see an impression in the last N days?
   - From which source/channel?
   - If YES → attribute to view-through
   - If NO → attribute to last-click (normal click-through attribution)

4. **Dashboard shows the breakdown**:
   - "View-through vs click-through" table
   - Revenue/orders split between view-through and click-through conversions
   - VT% = how much revenue came from view-through vs clicks

## Endpoints

### POST /api/impressions

Record an ad impression.

**Authentication**: Bearer token (site's s2sKey)

**Request**:
```json
{
  "anonId": "vis_abc123",
  "provider": "meta",
  "channel": "facebook / paid",
  "source": "facebook",
  "campaign": "summer_sale",
  "adId": "ad_12345",
  "adTitle": "Summer Clearance",
  "viewThroughWindow": 30
}
```

**Response**:
```json
{
  "ok": true,
  "visitorId": "vis_abc123"
}
```

## Integration Examples

### Meta Pixel Impressions

Track impressions from Meta's Conversions API or Pixel events:

```typescript
import { ImpressionsClient } from "@spmetrics/conversions-client";

const impressions = new ImpressionsClient({
  baseUrl: "https://your-domain.com",
  s2sKey: process.env.SPMETRICS_S2S_KEY,
});

// When user sees a Meta ad
await impressions.recordMetaImpression("vis_abc123", {
  campaign: "summer_sale",
  adId: "ad_12345",
  adTitle: "Summer Clearance",
  viewThroughWindow: 30, // days
});
```

### Google Ads

```typescript
await impressions.recordGoogleImpression("vis_abc123", {
  campaign: "shopping_feed",
  adId: "ad_67890",
  adTitle: "Blue Shoes",
  viewThroughWindow: 7,
});
```

### Custom Impressions

From your own ad network, programmatic platform, or internal retargeting:

```typescript
await impressions.recordCustomImpression("vis_abc123", "custom_network", {
  channel: "internal_email_retarget",
  source: "email",
  campaign: "abandoned_cart",
  adId: "email_campaign_456",
  viewThroughWindow: 14,
});
```

## Dashboard

On the **Attribution** dashboard, you'll see a new table:

| Source | Provider | View-through Revenue | Click-through Revenue | Total Revenue | VT % | Orders |
|--------|----------|----------------------|----------------------|---------------|------|--------|
| facebook | meta | $5,000 | $12,000 | $17,000 | 29% | 45 |
| google | google | $2,000 | $8,000 | $10,000 | 20% | 32 |

**VT %** = share of revenue attributed to view-throughs (vs clicks within that lookback window).

## Real-World Example

**Scenario**: Retargeting campaign for users who abandoned cart.

1. User browses your store, adds item to cart, leaves
2. You show a retargeting ad (impression recorded)
3. User doesn't click the ad, but 2 days later:
   - Gets an email reminder
   - Returns directly
   - Completes purchase

**Without view-through**: Purchase attributed to direct traffic (0 credit to your retargeting ad)
**With view-through**: Purchase attributed 50% to retargeting impression + 50% to direct (or configurable split)

## Lookback Windows

The `viewThroughWindow` controls how long an impression is eligible for attribution:

- **7 days** — short-window brand ads, seasonal campaigns
- **14 days** — typical retargeting
- **30 days** — high-value/long consideration products
- **Custom** — your business logic

A conversion only counts as view-through if it happened within the impression's window.

## Combining with Assisted Conversions

SPMetrics supports two forms of multi-touch insight:

1. **Assisted conversions** — sessions where user visited multiple channels (click 1 → click 2 → conversion)
2. **View-through conversions** — impression → conversion without intermediate click

Both appear in the Attribution dashboard to give you the complete picture.

## Limitations & Future Work

**Current**:
- View-through attribution is 30-day lookback based on single most-recent impression
- No weight distribution across multiple impressions from same visitor
- No cross-device view-through (desktop impression → mobile conversion)

**Coming**:
- Probabilistic matching for unknown visitors (impression on different device/browser)
- Multi-impression weighting (linear, exponential decay models)
- Attribution window A/B testing (which lookback maximizes ROAS?)

## FAQ

**Q: Do I need to send impressions for the pixel to work?**
A: No. The pixel captures clicks automatically. Impressions are optional, for tracking view-through (non-click) conversions.

**Q: What if an impression and click happen from the same visitor?**
A: The click takes priority (click-through attribution). View-through is only attributed if **no click** matched that source/channel.

**Q: How do I get impressions from Meta/Google?**
A: 
- **Meta**: Use Pixel events (`PageView`, custom events) + Conversions API impression data
- **Google**: Use Google Ads conversion tracking + their view-through attribution API, or manually send via Conversions Client
- **Custom**: You manage the impression tracking (e.g., logging impressions server-side)

**Q: Can I change the lookback window per impression?**
A: Yes, each impression has its own `viewThroughWindow`. So you can set 30 days for brand ads, 7 days for retargeting, etc.

**Q: Why does view-through show lower revenue than last-click attribution?**
A: Because impressions only count conversions that happen **without a click**. If users click the ad, they're click-through attributed instead. View-through captures "incremental" conversions that wouldn't have happened without the impression.
