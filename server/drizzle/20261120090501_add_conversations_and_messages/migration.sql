CREATE TYPE "message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"title" text,
	"summary" text,
	"summary_message_count" integer DEFAULT 0 NOT NULL,
	"summarized_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY,
	"conversation_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "conversation_workspaceId_idx" ON "conversation" ("workspace_id");--> statement-breakpoint
CREATE INDEX "conversation_workspaceId_updatedAt_idx" ON "conversation" ("workspace_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_conversationId_sequence_unique" ON "message" ("conversation_id","sequence");--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE;