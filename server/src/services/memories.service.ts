import logger from "../config/logger.js";
import {
  addUserMemory,
  deleteUserMemory,
  getUserMemories,
  updateUserMemory,
} from "../lib/mem0.js";
import type {
  CreateMemoryInput,
  UpdateMemoryInput,
} from "../validators/memories.validator.js";

const listUserMemories = (userId: string, page: number, pageSize: number) =>
  getUserMemories(userId, page, pageSize);

const createUserMemory = async (
  userId: string,
  input: CreateMemoryInput
) => {
  const result = await addUserMemory(
    userId,
    [{ role: "user", content: input.content }],
    { source: "manual" }
  );
  logger.info("memory.created", {
    userId,
    contentChars: input.content.length,
    count: Array.isArray(result) ? result.length : 0,
  });
  return result;
};

const updateMemory = async (
  userId: string,
  memoryId: string,
  input: UpdateMemoryInput
) => {
  const result = await updateUserMemory(userId, memoryId, input.text);
  logger.info("memory.updated", {
    userId,
    memoryId,
    textChars: input.text.length,
  });
  return result;
};

const removeMemory = async (userId: string, memoryId: string) => {
  const result = await deleteUserMemory(userId, memoryId);
  logger.info("memory.deleted", { userId, memoryId });
  return result;
};

export default {
  listUserMemories,
  createUserMemory,
  updateMemory,
  removeMemory,
};
