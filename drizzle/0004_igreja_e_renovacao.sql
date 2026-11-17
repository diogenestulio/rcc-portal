ALTER TYPE "public"."content_kind" ADD VALUE 'igreja';--> statement-breakpoint
ALTER TABLE "content_revision" ADD COLUMN "event_date" date;--> statement-breakpoint
ALTER TABLE "content_revision" ADD COLUMN "event_end_date" date;--> statement-breakpoint
ALTER TABLE "content_revision" ADD COLUMN "event_place" text;--> statement-breakpoint
ALTER TABLE "content_revision" ADD COLUMN "external_url" text;