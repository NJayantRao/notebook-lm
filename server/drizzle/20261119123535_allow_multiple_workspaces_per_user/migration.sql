ALTER TABLE "workspace" DROP CONSTRAINT "workspace_user_id_key";--> statement-breakpoint
CREATE INDEX "workspace_userId_idx" ON "workspace" ("user_id");