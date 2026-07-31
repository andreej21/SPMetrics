ALTER TABLE "orders" ADD COLUMN "is_suspicious" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "is_suspicious" boolean DEFAULT false;