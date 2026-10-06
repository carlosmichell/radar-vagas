CREATE TYPE "public"."job_status" AS ENUM('new', 'saved', 'applied', 'discarded');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location" text NOT NULL,
	"workplace_type" text DEFAULT 'not_informed' NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"published_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "job_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "jobs_published_at_idx" ON "jobs" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_workplace_type_idx" ON "jobs" USING btree ("workplace_type");