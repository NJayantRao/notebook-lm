import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  pgEnum,
  jsonb,
  integer,
  uniqueIndex,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { defineRelations } from "drizzle-orm";
import type { SourceMetadata } from "../types/source.js";
import type { ConversationCitation } from "../types/conversation.js";
import type {
  ArtifactAudioMeta,
  ArtifactCitation,
  ArtifactContent,
  ArtifactInput,
  ArtifactSourceIndexEntry,
  QuizAttemptAnswer,
} from "../types/artifact.js";

export const sourceTypeEnum = pgEnum("source_type", [
  "text",
  "markdown",
  "pdf",
  "website",
  "yt_url",
]);

export const sourceStatusEnum = pgEnum("source_status", [
  "pending",
  "processing",
  "failed",
  "ready",
]);

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

export const artifactTypeEnum = pgEnum("artifact_type", [
  "roadmap",
  "mindmap",
  "podcast",
  "quiz",
  "flashcards",
]);

export const artifactStatusEnum = pgEnum("artifact_status", [
  "pending",
  "generating",
  "ready",
  "failed",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const workspace = pgTable(
  "workspace",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    title: text("title").notNull(),

    description: text("description"),

    icon: text("icon"),

    model: text("model").notNull().default("openai-4o-mini"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("workspace_userId_idx").on(table.userId)]
);

export const source = pgTable(
  "source",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    sourceType: sourceTypeEnum("source_type").notNull(),

    title: text("title").notNull(),

    content: text("content"),

    url: text("url"),

    status: sourceStatusEnum("status").notNull().default("pending"),

    metadata: jsonb("metadata").$type<SourceMetadata>().notNull().default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("source_workspaceId_idx").on(table.workspaceId),
    index("source_status_idx").on(table.status),
  ]
);

export const chunk = pgTable(
  "chunk",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    sourceId: text("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),

    index: integer("index").notNull(),

    content: text("content").notNull(),

    tokenCount: integer("token_count").notNull(),

    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("chunk_sourceId_idx").on(table.sourceId),

    uniqueIndex("chunk_sourceId_index_unique").on(table.sourceId, table.index),
  ]
);

export const conversation = pgTable(
  "conversation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    title: text("title"),

    summary: text("summary"),

    summaryMessageCount: integer("summary_message_count").notNull().default(0),

    summarizedAt: timestamp("summarized_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("conversation_workspaceId_idx").on(table.workspaceId),
    index("conversation_workspaceId_updatedAt_idx").on(
      table.workspaceId,
      table.updatedAt
    ),
  ]
);

export const message = pgTable(
  "message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),

    sequence: integer("sequence").notNull(),

    role: messageRoleEnum("role").notNull(),

    content: text("content").notNull(),

    sources: jsonb("sources")
      .$type<ConversationCitation[]>()
      .notNull()
      .default([]),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("message_conversationId_sequence_unique").on(
      table.conversationId,
      table.sequence
    ),
  ]
);

export const artifact = pgTable(
  "artifact",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    type: artifactTypeEnum("type").notNull(),
    status: artifactStatusEnum("status").notNull().default("pending"),
    title: text("title").notNull(),
    input: jsonb("input").$type<ArtifactInput>().notNull(),
    content: jsonb("content")
      .$type<ArtifactContent>()
      .notNull()
      .default({ kind: "empty" }),
    sourceIndex: jsonb("source_index")
      .$type<ArtifactSourceIndexEntry[]>()
      .notNull()
      .default([]),
    sourceHash: text("source_hash").notNull(),
    paramsHash: text("params_hash").notNull(),
    audioKey: text("audio_key"),
    audioMeta: jsonb("audio_meta").$type<ArtifactAudioMeta | null>(),
    durationSec: integer("duration_sec"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("artifact_workspaceId_idx").on(table.workspaceId),
    index("artifact_workspaceId_type_idx").on(table.workspaceId, table.type),
    index("artifact_status_idx").on(table.status),
    index("artifact_createdAt_idx").on(table.createdAt),
  ]
);

export const flashcard = pgTable(
  "flashcard",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifact.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    citation: jsonb("citation").$type<ArtifactCitation | null>().default(null),
    easeFactor: doublePrecision("ease_factor").notNull().default(2.5),
    interval: integer("interval").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("flashcard_artifactId_idx").on(table.artifactId),
    index("flashcard_workspaceId_idx").on(table.workspaceId),
    index("flashcard_workspaceId_nextReviewAt_idx").on(
      table.workspaceId,
      table.nextReviewAt
    ),
  ]
);

export const quizAttempt = pgTable(
  "quiz_attempt",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifact.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    answers: jsonb("answers").$type<QuizAttemptAnswer[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("quiz_attempt_artifactId_userId_idx").on(table.artifactId, table.userId),
    index("quiz_attempt_workspaceId_userId_idx").on(
      table.workspaceId,
      table.userId
    ),
    index("quiz_attempt_createdAt_idx").on(table.createdAt),
  ]
);

export const relations = defineRelations(
  {
    user,
    session,
    account,
    verification,
    workspace,
    source,
    chunk,
    conversation,
    message,
    artifact,
    flashcard,
    quizAttempt,
  },
  (r) => ({
    user: {
      sessions: r.many.session({
        from: r.user.id,
        to: r.session.userId,
      }),

      accounts: r.many.account({
        from: r.user.id,
        to: r.account.userId,
      }),

      workspaces: r.many.workspace({
        from: r.user.id,
        to: r.workspace.userId,
      }),

      quizAttempts: r.many.quizAttempt({
        from: r.user.id,
        to: r.quizAttempt.userId,
      }),
    },

    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },

    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },

    workspace: {
      user: r.one.user({
        from: r.workspace.userId,
        to: r.user.id,
      }),
      sources: r.many.source({
        from: r.workspace.id,
        to: r.source.workspaceId,
      }),
      conversations: r.many.conversation({
        from: r.workspace.id,
        to: r.conversation.workspaceId,
      }),
      artifacts: r.many.artifact({
        from: r.workspace.id,
        to: r.artifact.workspaceId,
      }),
      flashcards: r.many.flashcard({
        from: r.workspace.id,
        to: r.flashcard.workspaceId,
      }),
      quizAttempts: r.many.quizAttempt({
        from: r.workspace.id,
        to: r.quizAttempt.workspaceId,
      }),
    },
    source: {
      workspace: r.one.workspace({
        from: r.source.workspaceId,
        to: r.workspace.id,
      }),

      chunks: r.many.chunk({
        from: r.source.id,
        to: r.chunk.sourceId,
      }),
    },
    conversation: {
      workspace: r.one.workspace({
        from: r.conversation.workspaceId,
        to: r.workspace.id,
      }),
      messages: r.many.message({
        from: r.conversation.id,
        to: r.message.conversationId,
      }),
    },
    chunk: {
      source: r.one.source({
        from: r.chunk.sourceId,
        to: r.source.id,
      }),
    },
    message: {
      conversation: r.one.conversation({
        from: r.message.conversationId,
        to: r.conversation.id,
      }),
    },
    artifact: {
      workspace: r.one.workspace({
        from: r.artifact.workspaceId,
        to: r.workspace.id,
      }),
      flashcards: r.many.flashcard({
        from: r.artifact.id,
        to: r.flashcard.artifactId,
      }),
      quizAttempts: r.many.quizAttempt({
        from: r.artifact.id,
        to: r.quizAttempt.artifactId,
      }),
    },
    flashcard: {
      artifact: r.one.artifact({
        from: r.flashcard.artifactId,
        to: r.artifact.id,
      }),
      workspace: r.one.workspace({
        from: r.flashcard.workspaceId,
        to: r.workspace.id,
      }),
    },
    quizAttempt: {
      artifact: r.one.artifact({
        from: r.quizAttempt.artifactId,
        to: r.artifact.id,
      }),
      workspace: r.one.workspace({
        from: r.quizAttempt.workspaceId,
        to: r.workspace.id,
      }),
      user: r.one.user({
        from: r.quizAttempt.userId,
        to: r.user.id,
      }),
    },
  })
);
