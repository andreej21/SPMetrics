# Server-Side Conversions API

The Conversions API lets you send purchase and custom events to SPMetrics from your backend, bypassing ad-blockers and ensuring reliable attribution.

**Why use it?**
- **Ad-blocker resistant** — events sent server-to-server always arrive
- **Offline conversions** — track phone orders, POS sales, support-assisted purchases
- **Reliable deduplication** — prevents double-counting when both pixel and backend fire
- **Custom events** — anything beyond purchase (wishlist adds, support tickets, etc.)

## Quick Start

### 1. Authentication

All requests require a Bearer token with your site's `s2sKey`:

```bash
Authorization: Bearer sk_dev_demo
```

Get your key from the SPMetrics dashboard or via `npm run site:create`.

### 2. Record a Purchase

**POST** `/api/conversions`

```bash
curl -X POST https://your-domain.com/api/conversions \
  -H "Authorization: Bearer sk_dev_demo" \
  -H "Content-Type: application/json" \
  -d '{
    "anonId": "vis_abc123",
    "email": "customer@example.com",
    "events": [{
      "type": "purchase",
      "dedupeKey": "order_999",
      "order": {
        "externalOrderId": "999",
        "orderNumber": "#1001",
        "totalAmount": 12995,
        "currency": "USD",
        "lineItems": [
          {
            "productId": "prod_1",
            "title": "Widget",
            "quantity": 1,
            "price": 12995
          }
        ]
      }
    }]
  }'
```

**Response:**
```json
{
  "visitorId": "vis_abc123",
  "sessionId": "ses_xyz789",
  "accepted": 1,
  "identityId": "idn_...optional"
}
```

### 3. TypeScript Client

For Node.js backends, use the provided client:

```typescript
import { ConversionsClient } from "@spmetrics/conversions-client";

const client = new ConversionsClient({
  baseUrl: "https://your-domain.com",
  s2sKey: process.env.SPMETRICS_S2S_KEY,
});

// Record a purchase
await client.recordPurchase("order_999", {
  anonId: "vis_abc123", // from sp_vid cookie if available
  email: "customer@example.com",
  totalAmount: 12995, // cents
  currency: "USD",
  isNewCustomer: true,
  lineItems: [
    {
      productId: "prod_1",
      title: "Widget",
      quantity: 1,
      price: 12995,
    },
  ],
});

// Identify a visitor
await client.identify("vis_abc123", {
  email: "customer@example.com",
  externalId: "shopify_123",
  traits: { plan: "premium" },
});

// Track a custom event
await client.trackEvent("support_ticket_created", {
  anonId: "vis_abc123",
  props: { priority: "high" },
  dedupeKey: "ticket_456",
});
```

## Integration Guides

### Shopify

Two approaches:

#### A) Webhook (Current)

1. Create the pixel and embed the loader snippet on your Storefront
2. Add this to your checkout custom code:
   ```javascript
   // Set sp_vid in cart notes so Shopify webhook can find it
   Shopify.checkout.note_attributes = [
     { name: "sp_vid", value: localStorage.getItem("sp_vid") }
   ];
   ```
3. Register `/api/webhooks/shopify?site=pk_...` as your `orders/create` webhook
4. SPMetrics will match the order to the visitor via `sp_vid` and record it

#### B) App Integration (Recommended, Future)

Once we ship the full Shopify OAuth app:
- Install the app from the Shopify App Store
- Orders are automatically sent server-to-server, no setup required

### Stripe / Payment Processors

When a payment succeeds in your `checkout.session.completed` webhook:

```typescript
const client = new ConversionsClient({...});

await client.recordPurchase(session.id, {
  anonId: session.metadata.spmetrics_visitor_id, // pass from checkout page
  email: session.customer_email,
  totalAmount: session.amount_total,
  currency: session.currency.toUpperCase(),
  isNewCustomer: !customerExisted,
  lineItems: session.line_items.data.map(item => ({
    productId: item.price.product,
    title: item.description,
    quantity: item.quantity,
    price: item.price.unit_amount,
  })),
});
```

### Custom Backend / WooCommerce / BigCommerce

When an order is placed, extract the `sp_vid` cookie value (or from browser localStorage if you have it):

```typescript
const anonId = req.cookies.get("sp_vid")?.value;

await client.recordPurchase(orderId, {
  anonId,
  email: order.customer.email,
  totalAmount: order.total * 100,
  currency: order.currency,
  isNewCustomer: order.customer.orderCount === 1,
  lineItems: order.items.map(item => ({
    productId: item.id,
    title: item.name,
    quantity: item.quantity,
    price: item.price * 100,
  })),
});
```

## Event Types

### Purchase
```typescript
{
  type: "purchase",
  dedupeKey: "order_123", // unique, prevents duplicate records
  order: {
    externalOrderId: "123", // platform order id
    orderNumber: "#5001",
    totalAmount: 5999, // minor units (cents)
    subtotalAmount: 5000,
    currency: "USD",
    isNewCustomer: true,
    lineItems: [
      {
        productId: "prod_abc",
        variantId: "var_xyz",
        title: "Deluxe Widget",
        quantity: 2,
        price: 2500, // per unit, minor units
      }
    ]
  }
}
```

### Identify
```typescript
{
  type: "identify",
  email: "customer@example.com",
  externalId: "customer_id_from_your_system",
  traits: {
    plan: "premium",
    lifetime_value: 15000,
    // any custom fields
  }
}
```

### Custom Event
```typescript
{
  type: "custom",
  name: "support_ticket",
  props: {
    priority: "high",
    category: "billing",
  },
  dedupeKey: "ticket_999"
}
```

## Deduplication

To prevent double-counting when both the pixel and backend fire the same event:

1. **Always set `dedupeKey`** if you know the unique identifier
2. For purchases: use `order_<externalOrderId>` or similar
3. The system dedupes on `(siteId, dedupeKey)` — if both pixel and backend send the same key, only one record is created

## Error Handling

```typescript
try {
  await client.recordPurchase("order_123", {...});
} catch (error) {
  console.error("Conversions API failed:", error.message);
  // Decide: retry, log to sentry, or gracefully degrade
}
```

Common errors:
- `missing_auth` — no Bearer token
- `invalid_key` — wrong s2sKey
- `no_events` — empty events array
- `invalid_json` — malformed JSON

## Testing

Use the test storefront at `/shop.html` to generate test visitor IDs, then:

```bash
curl -X POST http://localhost:3000/api/conversions \
  -H "Authorization: Bearer sk_dev_demo" \
  -H "Content-Type: application/json" \
  -d '{
    "anonId": "vis_test123",
    "events": [{
      "type": "purchase",
      "dedupeKey": "test_order_1",
      "order": {
        "externalOrderId": "test_1",
        "totalAmount": 4999,
        "currency": "USD"
      }
    }]
  }'
```

Check `/api/debug/stats` to verify the order was recorded.

## Rate Limits

- **Batch size**: max 50 events per request
- **Frequency**: no hard limit (implement your own backoff if retrying)

## FAQ

**Q: Do I need the pixel if I use Conversions API?**
A: No, but the pixel captures **click attribution** (UTM params, referrer, click IDs from ads). Conversions API is best paired with the pixel for full journey tracking.

**Q: What if I don't have `anonId`?**
A: SPMetrics will create a new visitor. Attribution will be incomplete. Ideally, pass the `sp_vid` cookie value from the pixel.

**Q: Can I send historical orders?**
A: Yes, as long as `dedupeKey` is unique. Useful for backfilling data.

**Q: Does this work with Google Ads / Meta Pixel conversion events?**
A: Yes. When you send a purchase via Conversions API with the visitor's session data, SPMetrics attributes it correctly. No direct integration with GA4/Meta needed (though those have their own conversion APIs too).
