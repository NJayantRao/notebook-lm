import { NotFoundError } from "../../../utils/api-error.js";
import repository from "../repository/workspace.repository.js";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from "../validators/workspace.validator.js";

const WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND";

const listWorkspaces = (userId: string) =>
  repository.findWorkspacesByUserId(userId);

const createWorkspace = (userId: string, input: CreateWorkspaceInput) =>
  repository.createWorkspace(userId, input);

const getWorkspaceById = async (userId: string, workspaceId: string) => {
  const result = await repository.findWorkspaceByIdAndUserId(
    workspaceId,
    userId,
  );

  if (!result) {
    throw new NotFoundError("Workspace not found", WORKSPACE_NOT_FOUND);
  }

  return result;
};

const updateWorkspace = async (
  userId: string,
  workspaceId: string,
  input: UpdateWorkspaceInput,
) => {
  const result = await repository.updateWorkspace(workspaceId, userId, input);

  if (!result) {
    throw new NotFoundError("Workspace not found", WORKSPACE_NOT_FOUND);
  }

  return result;
};

const deleteWorkspace = async (userId: string, workspaceId: string) => {
  const result = await repository.deleteWorkspace(workspaceId, userId);

  if (!result) {
    throw new NotFoundError("Workspace not found", WORKSPACE_NOT_FOUND);
  }

  return result;
};

export default {
  listWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
};
