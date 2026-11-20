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

const createUserMemory = (userId: string, input: CreateMemoryInput) =>
  addUserMemory(userId, [{ role: "user", content: input.content }], {
    source: "manual",
  });

const updateMemory = (
  userId: string,
  memoryId: string,
  input: UpdateMemoryInput
) => updateUserMemory(userId, memoryId, input.text);

const removeMemory = (userId: string, memoryId: string) =>
  deleteUserMemory(userId, memoryId);

export default {
  listUserMemories,
  createUserMemory,
  updateMemory,
  removeMemory,
};
