import type { Request, Response } from "express";

import ApiResponse from "../utils/api-response.js";
import validate from "../utils/validate.js";
import service from "../services/memories.service.js";
import {
  createMemorySchema,
  memoryIdParamsSchema,
  memoryListQuerySchema,
  updateMemorySchema,
} from "../validators/memories.validator.js";

const listUserMemories = async (req: Request, res: Response) => {
  const { page, pageSize } = validate(memoryListQuerySchema, req.query);
  const result = await service.listUserMemories(req.user.id, page, pageSize);

  res.status(200).json(new ApiResponse(200, "Memories retrieved", result));
};

const createUserMemory = async (req: Request, res: Response) => {
  const input = validate(createMemorySchema, req.body);
  const result = await service.createUserMemory(req.user.id, input);

  res.status(201).json(new ApiResponse(201, "Memory created", result));
};

const updateMemory = async (req: Request, res: Response) => {
  const { memoryId } = validate(memoryIdParamsSchema, req.params);
  const input = validate(updateMemorySchema, req.body);
  const result = await service.updateMemory(req.user.id, memoryId, input);

  res.status(200).json(new ApiResponse(200, "Memory updated", result));
};

const deleteMemory = async (req: Request, res: Response) => {
  const { memoryId } = validate(memoryIdParamsSchema, req.params);
  const result = await service.removeMemory(req.user.id, memoryId);

  res.status(200).json(new ApiResponse(200, "Memory deleted", result));
};

export default {
  listUserMemories,
  createUserMemory,
  updateMemory,
  deleteMemory,
};
