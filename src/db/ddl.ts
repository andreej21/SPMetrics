/**
 * Schema DDL, hand-kept in sync with schema.ts.
 *
 * We apply raw DDL (rather than drizzle-kit push) because dev runs on embedded
 * PGlite where a separate migration daemon / live connection isn't available.
 * Everything here is idempotent, so `db:migrate` is safe to run repeatedly and
 * works identically against PGlite and a real Postgres.
 */
export const DDL = /* sql */ `
DO $$ BEGIN
  CREATE TYPE platform AS ENUM ('generic', 'shopify', 'woocommerce', 'custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM (
    'page_view','product_view','collection_view','search','add_to_cart',
    'remove_from_cart','checkout_started','checkout_step','purchase','identify','custom'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS sites (
  id text PRIMARY KEY,
  name text NOT NULL,
  domain text,
  platform platform NOT NULL DEFAULT 'generic',
  pixel_token text NOT NULL,
  s2s_key text NOT NULL,
  allowed_origins text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sites_pixel_token_idx ON sites (pixel_token);

CREATE TABLE IF NOT EXISTS identities (
  id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  email text,
  email_hash text,
  phone text,
  external_id text,
  traits jsonb DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS identities_site_email_idx ON identities (site_id, email_hash);
CREATE INDEX IF NOT EXISTS identities_site_external_idx ON identities (site_id, external_id);

CREATE TABLE IF NOT EXISTS visitors (
  id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  identity_id text REFERENCES identities(id) ON DELETE SET NULL,
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  first_referrer text,
  first_landing_page text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visitors_site_idx ON visitors (site_id);
CREATE INDEX IF NOT EXISTS visitors_identity_idx ON visitors (identity_id);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  visitor_id text NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  fbclid text, gclid text, ttclid text,
  channel text,
  referrer text,
  landing_page text,
  user_agent text,
  device_type text,
  country text,
  region text,
  ip_hash text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  event_count integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sessions_site_visitor_idx ON sessions (site_id, visitor_id);
CREATE INDEX IF NOT EXISTS sessions_site_started_idx ON sessions (site_id, started_at);

CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  visitor_id text REFERENCES visitors(id) ON DELETE SET NULL,
  session_id text REFERENCES sessions(id) ON DELETE SET NULL,
  identity_id text REFERENCES identities(id) ON DELETE SET NULL,
  type event_type NOT NULL,
  name text,
  props jsonb DEFAULT '{}'::jsonb,
  url text,
  path text,
  referrer text,
  utm_source text, utm_medium text, utm_campaign text,
  source text NOT NULL DEFAULT 'client',
  dedupe_key text,
  client_ts timestamptz,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_site_received_idx ON events (site_id, received_at);
CREATE INDEX IF NOT EXISTS events_session_idx ON events (session_id);
CREATE INDEX IF NOT EXISTS events_site_type_idx ON events (site_id, type);
CREATE UNIQUE INDEX IF NOT EXISTS events_dedupe_idx ON events (site_id, dedupe_key);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  visitor_id text REFERENCES visitors(id) ON DELETE SET NULL,
  session_id text REFERENCES sessions(id) ON DELETE SET NULL,
  identity_id text REFERENCES identities(id) ON DELETE SET NULL,
  external_order_id text,
  order_number text,
  total_amount bigint NOT NULL DEFAULT 0,
  subtotal_amount bigint,
  currency text NOT NULL DEFAULT 'USD',
  is_new_customer boolean,
  line_items jsonb DEFAULT '[]'::jsonb,
  attributed_channel text,
  attributed_source text,
  attributed_campaign text,
  placed_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_site_external_idx ON orders (site_id, external_order_id);
CREATE INDEX IF NOT EXISTS orders_site_placed_idx ON orders (site_id, placed_at);

CREATE TABLE IF NOT EXISTS ad_spend (
  id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  provider text NOT NULL,
  channel text NOT NULL,
  source text,
  day date NOT NULL,
  campaign text NOT NULL DEFAULT '',
  campaign_id text NOT NULL DEFAULT '',
  spend bigint NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP INDEX IF EXISTS ad_spend_uniq_idx;
CREATE UNIQUE INDEX IF NOT EXISTS ad_spend_uniq_idx ON ad_spend (site_id, provider, day, channel, campaign_id);
CREATE INDEX IF NOT EXISTS ad_spend_site_day_idx ON ad_spend (site_id, day);
`;
