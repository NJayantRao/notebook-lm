import type { Request, Response } from "express";
import { z } from "zod";

import ApiResponse from "../utils/api-response.js";
import validate from "../utils/validate.js";

import service from "../services/workspaces.service.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
} from "../validators/workspaces.validator.js";

const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace id"),
});

const listWorkspaces = async (req: Request, res: Response) => {
  const workspaces = await service.listWorkspaces(req.user.id);

  res
    .status(200)
    .json(new ApiResponse(200, "Workspaces fetched successfully", workspaces));
};

const createWorkspace = async (req: Request, res: Response) => {
  const input = validate(createWorkspaceSchema, req.body);
  const workspace = await service.createWorkspace(req.user.id, input);

  res
    .status(201)
    .json(new ApiResponse(201, "Workspace created successfully", workspace));
};

const getWorkspaceById = async (req: Request, res: Response) => {
  const { workspaceId } = validate(workspaceIdParamsSchema, req.params);
  const workspace = await service.getWorkspaceById(req.user.id, workspaceId);

  res
    .status(200)
    .json(new ApiResponse(200, "Workspace fetched successfully", workspace));
};

const updateWorkspace = async (req: Request, res: Response) => {
  const { workspaceId } = validate(workspaceIdParamsSchema, req.params);
  const input = validate(updateWorkspaceSchema, req.body);
  const workspace = await service.updateWorkspace(
    req.user.id,
    workspaceId,
    input
  );

  res
    .status(200)
    .json(new ApiResponse(200, "Workspace updated successfully", workspace));
};

const deleteWorkspace = async (req: Request, res: Response) => {
  const { workspaceId } = validate(workspaceIdParamsSchema, req.params);
  const workspace = await service.deleteWorkspace(req.user.id, workspaceId);

  res
    .status(200)
    .json(new ApiResponse(200, "Workspace deleted successfully", workspace));
};

export default {
  listWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
};
