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
} from "drizzle-orm/pg-core";
import { defineRelations } from "drizzle-orm";
import type { SourceMetadata } from "../types/source.js";
import type { ConversationCitation } from "../types/conversation.js";

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
  })
);
