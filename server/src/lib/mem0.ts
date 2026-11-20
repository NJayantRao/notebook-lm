import { MemoryClient, type Memory, type Message } from "mem0ai";

import { ENV } from "../config/env.js";
import {
  BadGatewayError,
  NotFoundError,
  ServiceUnavailableError,
} from "../utils/api-error.js";

let client: MemoryClient | undefined;

export type UserMemoriesPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Memory[];
};

const getClient = (): MemoryClient => {
  const apiKey = ENV.MEM0_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableError(
      "User memory is not configured.",
      "MEM0_NOT_CONFIGURED"
    );
  }

  client ??= new MemoryClient({ apiKey });
  return client;
};

const callMem0 = async <T>(
  operation: string,
  request: () => Promise<T>
): Promise<T> => {
  try {
    return await request();
  } catch (error) {
    console.error(`Mem0 ${operation} failed:`, error);
    throw new BadGatewayError(
      "The memory service could not complete the request. Please try again.",
      "MEM0_REQUEST_FAILED"
    );
  }
};

const findUserMemory = async (
  userId: string,
  memoryId: string
): Promise<Memory> => {
  const mem0 = getClient();
  const pageSize = 100;

  for (let page = 1; ; page += 1) {
    const response = await callMem0("memory lookup", () =>
      mem0.getAll({ filters: { user_id: userId }, page, pageSize })
    );
    const memory = response.results.find((item) => item.id === memoryId);
    if (memory) {
      return memory;
    }

    if (response.results.length < pageSize) {
      throw new NotFoundError("Memory not found", "MEMORY_NOT_FOUND");
    }
  }
};

export const addUserMemory = (
  userId: string,
  messages: Message[],
  metadata?: Record<string, unknown>
) => {
  const mem0 = getClient();
  return callMem0("memory creation", () =>
    mem0.add(messages, {
      userId,
      infer: true,
      ...(metadata ? { metadata } : {}),
    })
  );
};

export const getUserMemories = (
  userId: string,
  page = 1,
  pageSize = 50
): Promise<UserMemoriesPage> => {
  const mem0 = getClient();
  return callMem0("memory retrieval", () =>
    mem0.getAll({
      filters: { user_id: userId },
      page,
      pageSize,
    })
  );
};

export const searchUserMemories = async (
  userId: string,
  query: string
): Promise<string[]> => {
  const mem0 = getClient();
  const response = await callMem0("memory search", () =>
    mem0.search(query, {
      filters: { user_id: userId },
      topK: 5,
    })
  );

  return response.results.flatMap((memory) => {
    const content = memory.memory ?? memory.data?.memory;
    return typeof content === "string" && content.trim()
      ? [content.trim()]
      : [];
  });
};

export const updateUserMemory = async (
  userId: string,
  memoryId: string,
  text: string
) => {
  await findUserMemory(userId, memoryId);
  const mem0 = getClient();
  return callMem0("memory update", () => mem0.update(memoryId, { text }));
};

export const deleteUserMemory = async (userId: string, memoryId: string) => {
  await findUserMemory(userId, memoryId);
  const mem0 = getClient();
  return callMem0("memory deletion", () =>
    mem0.delete(memoryId, { deleteLinked: true })
  );
};
