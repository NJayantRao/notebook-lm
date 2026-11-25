import logger from "../config/logger.js";
import conversationsRepository from "../repository/conversations.repository.js";
import { addUserMemory } from "../lib/mem0.js";
import { inngest } from "../lib/inngest.js";

type MemoryRefreshEvent = {
  userId: string;
  conversationId: string;
  throughUserMessageCount: number;
};

const requireMemoryRefreshEvent = (data: unknown): MemoryRefreshEvent => {
  if (
    typeof data !== "object" ||
    data === null ||
    !("userId" in data) ||
    typeof data.userId !== "string" ||
    !("conversationId" in data) ||
    typeof data.conversationId !== "string" ||
    !("throughUserMessageCount" in data) ||
    typeof data.throughUserMessageCount !== "number" ||
    !Number.isInteger(data.throughUserMessageCount) ||
    data.throughUserMessageCount < 16 ||
    data.throughUserMessageCount % 16 !== 0
  ) {
    throw new Error("The memory refresh event is invalid.");
  }

  return {
    userId: data.userId,
    conversationId: data.conversationId,
    throughUserMessageCount: data.throughUserMessageCount,
  };
};

export const refreshUserMemoryFunction = inngest.createFunction(
  {
    id: "refresh-user-memory",
    retries: 3,
    concurrency: { limit: 1, key: "event.data.userId" },
    triggers: [{ event: "conversation/memory.refresh.requested" }],
    onFailure: async ({ event, error }) => {
      const eventData = requireMemoryRefreshEvent(event.data.event.data);
      logger.error("memory.refresh.failed", {
        userId: eventData.userId,
        conversationId: eventData.conversationId,
        throughUserMessageCount: eventData.throughUserMessageCount,
        error,
      });
    },
  },
  async ({ event, step, attempt, runId }) => {
    const { userId, conversationId, throughUserMessageCount } =
      requireMemoryRefreshEvent(event.data);
    const jobMeta = { userId, conversationId, throughUserMessageCount, attempt, runId };

    const messages = await step.run("load-conversation-messages", async () => {
      logger.info("memory.refresh.started", jobMeta);
      return conversationsRepository.findConversationMemoryMessages(
        userId,
        conversationId,
        throughUserMessageCount
      );
    });

    if (!messages) {
      logger.debug("memory.refresh.skipped", {
        ...jobMeta,
        reason: "conversation-not-found",
      });
      return { status: "skipped", reason: "conversation-not-found" };
    }

    // Only user-authored messages are stored in the third-party memory service.
    const userMessages = messages.filter((message) => message.role === "user");
    if (userMessages.length !== 16) {
      throw new Error(
        `Expected 16 user messages for conversation ${conversationId}, ` +
          `received ${userMessages.length}.`
      );
    }

    const memories = await step.run("upsert-user-memory", async () => {
      logger.info("memory.refresh.step", { ...jobMeta, step: "upsert-memory" });
      const result = await addUserMemory(userId, userMessages, {
        source: "conversation",
        conversationId,
        throughUserMessageCount,
      });
      logger.info("memory.refresh.completed", {
        ...jobMeta,
        memoryOperations: result.length,
      });
      return result;
    });

    return {
      status: "updated",
      conversationId,
      throughUserMessageCount,
      memoryOperations: memories.length,
    };
  }
);
