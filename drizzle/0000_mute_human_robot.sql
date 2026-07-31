CREATE TYPE "public"."event_type" AS ENUM('page_view', 'product_view', 'collection_view', 'search', 'add_to_cart', 'remove_from_cart', 'checkout_started', 'checkout_step', 'purchase', 'identify', 'custom');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('generic', 'shopify', 'woocommerce', 'custom');--> statement-breakpoint
CREATE TYPE "public"."spm_param_source" AS ENUM('url', 'server', 'sdk');--> statement-breakpoint
CREATE TABLE "ad_spend" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"provider" text NOT NULL,
	"channel" text NOT NULL,
	"source" text,
	"day" date NOT NULL,
	"campaign" text DEFAULT '' NOT NULL,
	"campaign_id" text DEFAULT '' NOT NULL,
	"spend" bigint DEFAULT 0 NOT NULL,
	"impressions" bigint DEFAULT 0 NOT NULL,
	"clicks" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"visitor_id" text,
	"session_id" text,
	"identity_id" text,
	"type" "event_type" NOT NULL,
	"name" text,
	"props" jsonb DEFAULT '{}'::jsonb,
	"url" text,
	"path" text,
	"referrer" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"spm_source" text,
	"spm_version" text,
	"spm_experiment" text,
	"source" text DEFAULT 'client' NOT NULL,
	"dedupe_key" text,
	"client_ts" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identities" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"email" text,
	"email_hash" text,
	"phone" text,
	"external_id" text,
	"traits" jsonb DEFAULT '{}'::jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"visitor_id" text,
	"session_id" text,
	"identity_id" text,
	"external_order_id" text,
	"order_number" text,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"subtotal_amount" bigint,
	"currency" text DEFAULT 'USD' NOT NULL,
	"is_new_customer" boolean,
	"line_items" jsonb DEFAULT '[]'::jsonb,
	"attributed_channel" text,
	"attributed_source" text,
	"attributed_campaign" text,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"spm_source" text,
	"spm_version" text,
	"spm_experiment" text,
	"spm_channel" text,
	"fbclid" text,
	"gclid" text,
	"ttclid" text,
	"channel" text,
	"referrer" text,
	"landing_page" text,
	"user_agent" text,
	"device_type" text,
	"country" text,
	"region" text,
	"ip_hash" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"platform" "platform" DEFAULT 'generic' NOT NULL,
	"pixel_token" text NOT NULL,
	"s2s_key" text NOT NULL,
	"allowed_origins" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"identity_id" text,
	"first_utm_source" text,
	"first_utm_medium" text,
	"first_utm_campaign" text,
	"first_referrer" text,
	"first_landing_page" text,
	"first_spm_source" text,
	"first_spm_version" text,
	"first_spm_experiment" text,
	"first_spm_channel" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_spend_uniq_idx" ON "ad_spend" USING btree ("site_id","provider","day","channel","campaign_id");--> statement-breakpoint
CREATE INDEX "ad_spend_site_day_idx" ON "ad_spend" USING btree ("site_id","day");--> statement-breakpoint
CREATE INDEX "events_site_received_idx" ON "events" USING btree ("site_id","received_at");--> statement-breakpoint
CREATE INDEX "events_session_idx" ON "events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "events_site_type_idx" ON "events" USING btree ("site_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "events_dedupe_idx" ON "events" USING btree ("site_id","dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "identities_site_email_idx" ON "identities" USING btree ("site_id","email_hash");--> statement-breakpoint
CREATE INDEX "identities_site_external_idx" ON "identities" USING btree ("site_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_site_external_idx" ON "orders" USING btree ("site_id","external_order_id");--> statement-breakpoint
CREATE INDEX "orders_site_placed_idx" ON "orders" USING btree ("site_id","placed_at");--> statement-breakpoint
CREATE INDEX "sessions_site_visitor_idx" ON "sessions" USING btree ("site_id","visitor_id");--> statement-breakpoint
CREATE INDEX "sessions_site_started_idx" ON "sessions" USING btree ("site_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_pixel_token_idx" ON "sites" USING btree ("pixel_token");--> statement-breakpoint
CREATE INDEX "visitors_site_idx" ON "visitors" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "visitors_identity_idx" ON "visitors" USING btree ("identity_id");