ALTER TABLE "groups" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "groups_public_idx" ON "groups" USING btree ("is_public");