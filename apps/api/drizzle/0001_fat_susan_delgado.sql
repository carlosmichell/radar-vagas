ALTER TABLE "jobs" ADD COLUMN "technology" text;--> statement-breakpoint
CREATE INDEX "jobs_technology_idx" ON "jobs" USING btree ("technology");