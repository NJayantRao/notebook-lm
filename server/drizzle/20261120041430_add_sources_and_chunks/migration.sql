CREATE TYPE "source_status" AS ENUM('pending', 'processing', 'failed', 'ready');--> statement-breakpoint
CREATE TYPE "source_type" AS ENUM('text', 'markdown', 'pdf', 'website', 'yt_url');--> statement-breakpoint
CREATE TABLE "chunk" (
	"id" text PRIMARY KEY,
	"source_id" text NOT NULL,
	"index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"url" text,
	"status" "source_status" DEFAULT 'pending'::"source_status" NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chunk_sourceId_idx" ON "chunk" ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chunk_sourceId_index_unique" ON "chunk" ("source_id","index");--> statement-breakpoint
CREATE INDEX "source_workspaceId_idx" ON "source" ("workspace_id");--> statement-breakpoint
CREATE INDEX "source_status_idx" ON "source" ("status");--> statement-breakpoint
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_source_id_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;