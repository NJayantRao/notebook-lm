CREATE TABLE "workspace" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"description" text,
	"icon" text,
	"model" text DEFAULT 'openai-4o-mini' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;