CREATE TYPE "artifact_status" AS ENUM('pending', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "artifact_type" AS ENUM('roadmap', 'mindmap', 'podcast', 'quiz', 'flashcards');--> statement-breakpoint
CREATE TABLE "artifact" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"type" "artifact_type" NOT NULL,
	"status" "artifact_status" DEFAULT 'pending'::"artifact_status" NOT NULL,
	"title" text NOT NULL,
	"input" jsonb NOT NULL,
	"content" jsonb DEFAULT '{"kind":"empty"}' NOT NULL,
	"source_index" jsonb DEFAULT '[]' NOT NULL,
	"source_hash" text NOT NULL,
	"params_hash" text NOT NULL,
	"audio_key" text,
	"audio_meta" jsonb,
	"duration_sec" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flashcard" (
	"id" text PRIMARY KEY,
	"artifact_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"citation" jsonb DEFAULT 'null',
	"ease_factor" double precision DEFAULT 2.5 NOT NULL,
	"interval" integer DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"next_review_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt" (
	"id" text PRIMARY KEY,
	"artifact_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"score" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"answers" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "artifact_workspaceId_idx" ON "artifact" ("workspace_id");--> statement-breakpoint
CREATE INDEX "artifact_workspaceId_type_idx" ON "artifact" ("workspace_id","type");--> statement-breakpoint
CREATE INDEX "artifact_status_idx" ON "artifact" ("status");--> statement-breakpoint
CREATE INDEX "artifact_createdAt_idx" ON "artifact" ("created_at");--> statement-breakpoint
CREATE INDEX "flashcard_artifactId_idx" ON "flashcard" ("artifact_id");--> statement-breakpoint
CREATE INDEX "flashcard_workspaceId_idx" ON "flashcard" ("workspace_id");--> statement-breakpoint
CREATE INDEX "flashcard_workspaceId_nextReviewAt_idx" ON "flashcard" ("workspace_id","next_review_at");--> statement-breakpoint
CREATE INDEX "quiz_attempt_artifactId_userId_idx" ON "quiz_attempt" ("artifact_id","user_id");--> statement-breakpoint
CREATE INDEX "quiz_attempt_workspaceId_userId_idx" ON "quiz_attempt" ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "quiz_attempt_createdAt_idx" ON "quiz_attempt" ("created_at");--> statement-breakpoint
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_artifact_id_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifact"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_artifact_id_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifact"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;