ALTER TYPE "public"."event_type" ADD VALUE 'impression' BEFORE 'custom';--> statement-breakpoint
CREATE TABLE "impressions" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"visitor_id" text,
	"session_id" text,
	"provider" text NOT NULL,
	"channel" text,
	"source" text,
	"campaign" text,
	"ad_id" text,
	"ad_title" text,
	"view_through_window" integer DEFAULT 30 NOT NULL,
	"impressed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "impressions" ADD CONSTRAINT "impressions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impressions" ADD CONSTRAINT "impressions_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impressions" ADD CONSTRAINT "impressions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "impressions_site_visitor_idx" ON "impressions" USING btree ("site_id","visitor_id");--> statement-breakpoint
CREATE INDEX "impressions_site_channel_idx" ON "impressions" USING btree ("site_id","channel");--> statement-breakpoint
CREATE INDEX "impressions_site_impressed_idx" ON "impressions" USING btree ("site_id","impressed_at");