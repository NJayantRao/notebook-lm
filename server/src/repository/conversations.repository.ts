import { and, asc, count, desc, eq, gt, inArray, lte } from "drizzle-orm";
import type { Message } from "mem0ai";

import db from "../db/index.js";
import {
  chunk,
  conversation,
  message,
  source,
  workspace,
} from "../db/schema.js";
import type { ConversationCitation } from "../types/conversation.js";
import { InternalServerError } from "../utils/api-error.js";

export type RetrievedSourceChunk = {
  id: string;
  sourceId: string;
  title: string;
  sourceType: typeof source.$inferSelect.sourceType;
  url: string | null;
  chunkIndex: number;
  content: string;
};

export type ConversationRecord = typeof conversation.$inferSelect;
export type MessageRecord = typeof message.$inferSelect;
export type ConversationDetail = ConversationRecord & {
  messages: MessageRecord[];
};

type PersistExchangeInput = {
  workspaceId: string;
  conversationId?: string;
  title?: string;
  userContent: string;
  assistantContent: string;
  sources: ConversationCitation[];
};

export type PersistedExchange = {
  conversation: ConversationDetail;
  userMessageCount: number;
};

const findReadyChunksByIds = async (
  workspaceId: string,
  chunkIds: string[]
): Promise<RetrievedSourceChunk[]> => {
  if (chunkIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: chunk.id,
      sourceId: source.id,
      title: source.title,
      sourceType: source.sourceType,
      url: source.url,
      chunkIndex: chunk.index,
      content: chunk.content,
    })
    .from(chunk)
    .innerJoin(source, eq(chunk.sourceId, source.id))
    .where(
      and(
        inArray(chunk.id, chunkIds),
        eq(source.workspaceId, workspaceId),
        eq(source.status, "ready")
      )
    );
};

const findConversationsByWorkspaceId = async (
  workspaceId: string
): Promise<ConversationRecord[]> =>
  db
    .select()
    .from(conversation)
    .where(eq(conversation.workspaceId, workspaceId))
    .orderBy(desc(conversation.updatedAt));

const findConversationDetail = async (
  workspaceId: string,
  conversationId: string
): Promise<ConversationDetail | undefined> => {
  const [record] = await db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.id, conversationId),
        eq(conversation.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!record) {
    return undefined;
  }

  const messages = await db
    .select()
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(asc(message.sequence));

  return { ...record, messages };
};

const findConversationMemoryMessages = async (
  userId: string,
  conversationId: string,
  throughUserMessageCount: number
): Promise<Message[] | undefined> => {
  const [ownedConversation] = await db
    .select({ id: conversation.id })
    .from(conversation)
    .innerJoin(workspace, eq(conversation.workspaceId, workspace.id))
    .where(
      and(eq(conversation.id, conversationId), eq(workspace.userId, userId))
    )
    .limit(1);

  if (!ownedConversation) {
    return undefined;
  }

  const firstSequence = Math.max(0, (throughUserMessageCount - 16) * 2);
  const lastSequence = throughUserMessageCount * 2;
  const messages = await db
    .select({ role: message.role, content: message.content })
    .from(message)
    .where(
      and(
        eq(message.conversationId, conversationId),
        gt(message.sequence, firstSequence),
        lte(message.sequence, lastSequence)
      )
    )
    .orderBy(asc(message.sequence));

  return messages;
};

const persistExchange = async (
  input: PersistExchangeInput
): Promise<PersistedExchange> =>
  db.transaction(async (tx) => {
    let activeConversation: ConversationRecord;
    let firstSequence = 1;

    if (input.conversationId) {
      const [existing] = await tx
        .select()
        .from(conversation)
        .where(
          and(
            eq(conversation.id, input.conversationId),
            eq(conversation.workspaceId, input.workspaceId)
          )
        )
        .limit(1)
        .for("update");

      if (!existing) {
        throw new InternalServerError(
          "The conversation was not available while saving the response."
        );
      }

      activeConversation = existing;
      const [lastMessage] = await tx
        .select({ sequence: message.sequence })
        .from(message)
        .where(eq(message.conversationId, existing.id))
        .orderBy(desc(message.sequence))
        .limit(1);
      firstSequence = (lastMessage?.sequence ?? 0) + 1;
    } else {
      const [created] = await tx
        .insert(conversation)
        .values({
          workspaceId: input.workspaceId,
          title: input.title ?? null,
        })
        .returning();

      if (!created) {
        throw new InternalServerError("Failed to create conversation.");
      }

      activeConversation = created;
    }

    const savedMessages = await tx
      .insert(message)
      .values([
        {
          conversationId: activeConversation.id,
          sequence: firstSequence,
          role: "user",
          content: input.userContent,
          sources: [],
        },
        {
          conversationId: activeConversation.id,
          sequence: firstSequence + 1,
          role: "assistant",
          content: input.assistantContent,
          sources: input.sources,
        },
      ])
      .returning();

    if (savedMessages.length !== 2) {
      throw new InternalServerError("Failed to save conversation messages.");
    }

    const [userMessages] = await tx
      .select({ count: count() })
      .from(message)
      .where(
        and(
          eq(message.conversationId, activeConversation.id),
          eq(message.role, "user")
        )
      );

    const [updatedConversation] = await tx
      .update(conversation)
      .set({ updatedAt: new Date() })
      .where(eq(conversation.id, activeConversation.id))
      .returning();

    if (!updatedConversation) {
      throw new InternalServerError("Failed to update conversation.");
    }

    return {
      conversation: {
        ...updatedConversation,
        messages: savedMessages.sort(
          (left, right) => left.sequence - right.sequence
        ),
      },
      userMessageCount: userMessages?.count ?? 0,
    };
  });

export default {
  findReadyChunksByIds,
  findConversationsByWorkspaceId,
  findConversationDetail,
  findConversationMemoryMessages,
  persistExchange,
};
