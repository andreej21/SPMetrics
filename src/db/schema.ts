import {
  pgTable,
  text,
  timestamp,
  date,
  jsonb,
  integer,
  bigint,
  numeric,
  boolean,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

/**
 * SPMetrics data model
 * --------------------
 * The pipeline funnels every touch into `events` (append-only), while
 * `visitors` / `sessions` / `identities` / `orders` are the derived,
 * queryable entities that attribution is built on.
 *
 *   ad click ──▶ session (first-touch attribution captured here)
 *      │
 *      ▼
 *   visitor (anon, first-party cookie) ──identify──▶ identity (email/external id)
 *      │                                                  │
 *      └──────────────── events ─────────────────────────┘
 *                          │
 *                          ▼
 *                        order (revenue, attributed back to session/click)
 */

export const platformEnum = pgEnum("platform", ["generic", "shopify", "woocommerce", "custom"]);

export const eventTypeEnum = pgEnum("event_type", [
  "page_view",
  "product_view",
  "collection_view",
  "search",
  "add_to_cart",
  "remove_from_cart",
  "checkout_started",
  "checkout_step",
  "purchase",
  "identify",
  "impression",
  "custom",
]);

// A "site" is a single tracked property belonging to a customer of ours.
export const sites = pgTable(
  "sites",
  {
    id: text("id").primaryKey(), // site_...
    name: text("name").notNull(),
    domain: text("domain"), // primary storefront domain, e.g. shop.example.com
    platform: platformEnum("platform").notNull().default("generic"),

    // Public token — embedded in the browser snippet, safe to expose.
    pixelToken: text("pixel_token").notNull(),
    // Secret key — used for server-to-server events & webhook verification. Never sent to the browser.
    s2sKey: text("s2s_key").notNull(),

    // Comma-separated list of origins allowed to POST to /api/collect (CORS + anti-abuse).
    allowedOrigins: text("allowed_origins"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pixelTokenIdx: uniqueIndex("sites_pixel_token_idx").on(t.pixelToken),
  }),
);

// SPMetrics custom parameters — flexible tracking beyond standard UTMs.
export const spmParamsEnum = pgEnum("spm_param_source", ["url", "server", "sdk"]);

// Known person. A visitor is linked to an identity once we learn who they are.
export const identities = pgTable(
  "identities",
  {
    id: text("id").primaryKey(), // idn_...
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    email: text("email"),
    emailHash: text("email_hash"), // sha256(lowercased email) — for privacy-safe matching
    phone: text("phone"),
    externalId: text("external_id"), // e.g. Shopify customer id
    traits: jsonb("traits").$type<Record<string, unknown>>().default({}),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteEmailIdx: uniqueIndex("identities_site_email_idx").on(t.siteId, t.emailHash),
    siteExternalIdx: index("identities_site_external_idx").on(t.siteId, t.externalId),
  }),
);

// Anonymous first-party visitor, keyed by our persistent cookie id.
export const visitors = pgTable(
  "visitors",
  {
    id: text("id").primaryKey(), // vis_... (this is the value stored in the first-party cookie)
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    identityId: text("identity_id").references(() => identities.id, { onDelete: "set null" }),

    // First-touch attribution for the *visitor* (their very first session ever).
    firstUtmSource: text("first_utm_source"),
    firstUtmMedium: text("first_utm_medium"),
    firstUtmCampaign: text("first_utm_campaign"),
    firstReferrer: text("first_referrer"),
    firstLandingPage: text("first_landing_page"),

    // SPMetrics custom parameters (spm_*).
    firstSpmSource: text("first_spm_source"),
    firstSpmVersion: text("first_spm_version"),
    firstSpmExperiment: text("first_spm_experiment"),
    firstSpmChannel: text("first_spm_channel"),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteIdx: index("visitors_site_idx").on(t.siteId),
    identityIdx: index("visitors_identity_idx").on(t.identityId),
  }),
);

// A single visit. Session-level attribution is what most ad platforms report against.
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // ses_...
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id")
      .notNull()
      .references(() => visitors.id, { onDelete: "cascade" }),

    // Attribution snapshot for this session (last-non-direct click within the visit window).
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),

    // SPMetrics custom parameters (spm_*).
    spmSource: text("spm_source"),
    spmVersion: text("spm_version"),
    spmExperiment: text("spm_experiment"),
    spmChannel: text("spm_channel"),

    // Ad-platform click ids — the strongest attribution signal.
    fbclid: text("fbclid"),
    gclid: text("gclid"),
    ttclid: text("ttclid"),
    // Normalized channel, e.g. "facebook / paid", "google / organic", "direct".
    channel: text("channel"),

    referrer: text("referrer"),
    landingPage: text("landing_page"),

    // Device / client context.
    userAgent: text("user_agent"),
    deviceType: text("device_type"), // mobile | tablet | desktop
    country: text("country"),
    region: text("region"),
    ipHash: text("ip_hash"), // sha256(ip + daily salt) — never store raw IP

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }).notNull().defaultNow(),
    eventCount: integer("event_count").notNull().default(0),
    isSuspicious: boolean("is_suspicious").default(false),
  },
  (t) => ({
    siteVisitorIdx: index("sessions_site_visitor_idx").on(t.siteId, t.visitorId),
    siteStartedIdx: index("sessions_site_started_idx").on(t.siteId, t.startedAt),
  }),
);

// Append-only raw event stream. Everything else is derived from this.
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(), // evt_...
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
    identityId: text("identity_id").references(() => identities.id, { onDelete: "set null" }),

    type: eventTypeEnum("type").notNull(),
    name: text("name"), // free-form name for `custom` events

    // Arbitrary event payload: product ids, cart value, search query, etc.
    props: jsonb("props").$type<Record<string, unknown>>().default({}),

    // Page context at time of event.
    url: text("url"),
    path: text("path"),
    referrer: text("referrer"),

    // Attribution snapshot copied onto the event for fast per-event queries.
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),

    // SPMetrics custom parameters.
    spmSource: text("spm_source"),
    spmVersion: text("spm_version"),
    spmExperiment: text("spm_experiment"),

    // "client" (browser pixel) vs "server" (s2s / webhook) — s2s is the source of truth for money.
    source: text("source").notNull().default("client"),

    // Client-supplied event id for idempotency/dedup across retries + client/server double-fire.
    dedupeKey: text("dedupe_key"),

    clientTs: timestamp("client_ts", { withTimezone: true }), // when it happened in the browser
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(), // when we got it
  },
  (t) => ({
    siteReceivedIdx: index("events_site_received_idx").on(t.siteId, t.receivedAt),
    sessionIdx: index("events_session_idx").on(t.sessionId),
    typeIdx: index("events_site_type_idx").on(t.siteId, t.type),
    dedupeIdx: uniqueIndex("events_dedupe_idx").on(t.siteId, t.dedupeKey),
  }),
);

// Purchases. Ideally written from s2s/webhook (trustworthy), deduped against client purchase events.
export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(), // ord_...
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
    identityId: text("identity_id").references(() => identities.id, { onDelete: "set null" }),

    externalOrderId: text("external_order_id"), // platform order id (Shopify order id, etc.)
    orderNumber: text("order_number"),

    // Money is stored in minor units (cents) to avoid float drift.
    totalAmount: bigint("total_amount", { mode: "number" }).notNull().default(0),
    subtotalAmount: bigint("subtotal_amount", { mode: "number" }),
    currency: text("currency").notNull().default("USD"),
    isNewCustomer: boolean("is_new_customer"),

    lineItems: jsonb("line_items").$type<OrderLineItem[]>().default([]),

    // Attribution as resolved at order time (the model can be recomputed later).
    attributedChannel: text("attributed_channel"),
    attributedSource: text("attributed_source"),
    attributedCampaign: text("attributed_campaign"),

    isSuspicious: boolean("is_suspicious").default(false),

    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteExternalIdx: uniqueIndex("orders_site_external_idx").on(t.siteId, t.externalOrderId),
    sitePlacedIdx: index("orders_site_placed_idx").on(t.siteId, t.placedAt),
  }),
);

// Ad impressions (for view-through attribution). Track when a user sees an ad,
// so we can attribute later conversions that happen without a click.
export const impressions = pgTable(
  "impressions",
  {
    id: text("id").primaryKey(), // imp_...
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),

    // Ad source info
    provider: text("provider").notNull(), // "meta" | "google" | "tiktok" | "custom"
    channel: text("channel"), // "facebook / paid" | "google / paid" etc, matches session.channel
    source: text("source"), // facebook | google | tiktok
    campaign: text("campaign"),
    adId: text("ad_id"), // the specific ad/creative id
    adTitle: text("ad_title"),

    // Impression window for view-through lookback (default 7/30 days)
    viewThroughWindow: integer("view_through_window").notNull().default(30), // days

    impressedAt: timestamp("impressed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteVisitorIdx: index("impressions_site_visitor_idx").on(t.siteId, t.visitorId),
    siteChannelIdx: index("impressions_site_channel_idx").on(t.siteId, t.channel),
    siteImpressionIdx: index("impressions_site_impressed_idx").on(t.siteId, t.impressedAt),
  }),
);

// Daily ad spend pulled from ad platforms (or entered manually), so we can join
// spend to attributed revenue and compute ROAS. One row per site/provider/day/campaign.
export const adSpend = pgTable(
  "ad_spend",
  {
    id: text("id").primaryKey(), // spd_...
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),

    provider: text("provider").notNull(), // meta | google | tiktok | manual
    // Normalized channel string that MATCHES how attribution labels sessions/orders,
    // e.g. "facebook / paid" — this is the join key for channel-level ROAS.
    channel: text("channel").notNull(),
    source: text("source"), // facebook | google | tiktok

    day: date("day").notNull(), // the spend date (YYYY-MM-DD)
    campaign: text("campaign").notNull().default(""), // campaign name ('' = channel-level)
    campaignId: text("campaign_id").notNull().default(""),

    spend: bigint("spend", { mode: "number" }).notNull().default(0), // minor units
    impressions: bigint("impressions", { mode: "number" }).notNull().default(0),
    clicks: bigint("clicks", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("USD"),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("ad_spend_uniq_idx").on(t.siteId, t.provider, t.day, t.channel, t.campaignId),
    siteDayIdx: index("ad_spend_site_day_idx").on(t.siteId, t.day),
  }),
);

export type OrderLineItem = {
  productId?: string;
  variantId?: string;
  title?: string;
  quantity: number;
  price: number; // minor units
};

// Convenience type exports
export type Site = typeof sites.$inferSelect;
export type Visitor = typeof visitors.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Identity = typeof identities.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Impression = typeof impressions.$inferSelect;
export type AdSpend = typeof adSpend.$inferSelect;
