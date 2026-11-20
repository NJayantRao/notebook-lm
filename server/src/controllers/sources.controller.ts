import type { NextFunction, Request, Response } from "express";

import ApiResponse from "../utils/api-response.js";
import { BadRequestError } from "../utils/api-error.js";
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

const validateUploadWorkspace = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    validate(workspaceIdParamsSchema, req.params);
    next();
  } catch (error) {
    next(error);
  }
};

const uploadPdf = async (req: Request, res: Response) => {
  const { workspaceId } = validate(workspaceIdParamsSchema, req.params);
  if (!req.file) {
    throw new BadRequestError("A PDF file is required.", "PDF_REQUIRED");
  }

  const result = await service.uploadPdfSource(
    req.user.id,
    workspaceId,
    req.file,
  );

  res
    .status(201)
    .json(new ApiResponse(201, "PDF uploaded successfully", result));
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
  validateUploadWorkspace,
  uploadPdf,
  bulkDeleteSources,
  deleteSource,
};
