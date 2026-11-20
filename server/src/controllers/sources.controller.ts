import type { Request, Response } from "express";

import ApiResponse from "../utils/api-response.js";
import validate from "../utils/validate.js";

import service from "../services/sources.service.js";
import {
  createSourceSchema,
  listSourcesQuerySchema,
  sourceParamsSchema,
  workspaceIdParamsSchema,
} from "../validators/sources.validator.js";

const listAllSources = async (req: Request, res: Response) => {
  const { workspaceId } = validate(workspaceIdParamsSchema, req.params);
  const filters = validate(listSourcesQuerySchema, req.query);
  const result = await service.listAllSources(req.user.id, workspaceId, filters);

  res
    .status(200)
    .json(new ApiResponse(200, "Sources fetched successfully", result));
};

const createSources = async (req: Request, res: Response) => {
  const { workspaceId } = validate(workspaceIdParamsSchema, req.params);
  const input = validate(createSourceSchema, req.body);
  const result = await service.createSources(req.user.id, workspaceId, input);

  res
    .status(201)
    .json(new ApiResponse(201, "Source created successfully", result));
};

const bulkDeleteSources = async (req: Request, res: Response) => {
  const { workspaceId } = validate(workspaceIdParamsSchema, req.params);
  const deletedCount = await service.bulkDeleteSources(req.user.id, workspaceId);

  res
    .status(200)
    .json(
      new ApiResponse(200, "Sources deleted successfully", { deletedCount }),
    );
};

const deleteSource = async (req: Request, res: Response) => {
  const { workspaceId, sourceId } = validate(sourceParamsSchema, req.params);
  const result = await service.deleteSource(req.user.id, workspaceId, sourceId);

  res
    .status(200)
    .json(new ApiResponse(200, "Source deleted successfully", result));
};

export default {
  listAllSources,
  createSources,
  bulkDeleteSources,
  deleteSource,
};
