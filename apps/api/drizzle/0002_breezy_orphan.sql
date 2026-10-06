CREATE TYPE "public"."radar_user_role" AS ENUM('viewer', 'admin');--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" "radar_user_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;