import { NotFoundError } from "../utils/api-error.js";
import repository from "../repository/workspaces.repository.js";
import sourcesRepository from "../repository/sources.repository.js";
import { inngest } from "../lib/inngest.js";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from "../validators/workspaces.validator.js";

const WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND";

const listWorkspaces = (userId: string) =>
  repository.findWorkspacesByUserId(userId);

const createWorkspace = (userId: string, input: CreateWorkspaceInput) =>
  repository.createWorkspace(userId, input);

const getWorkspaceById = async (userId: string, workspaceId: string) => {
  const result = await repository.findWorkspaceByIdAndUserId(
    workspaceId,
    userId
  );

  if (!result) {
    throw new NotFoundError("Workspace not found", WORKSPACE_NOT_FOUND);
  }

  return result;
};

const updateWorkspace = async (
  userId: string,
  workspaceId: string,
  input: UpdateWorkspaceInput
) => {
  const result = await repository.updateWorkspace(workspaceId, userId, input);

  if (!result) {
    throw new NotFoundError("Workspace not found", WORKSPACE_NOT_FOUND);
  }

  return result;
};

const deleteWorkspace = async (userId: string, workspaceId: string) => {
  await getWorkspaceById(userId, workspaceId);
  const sources =
    await sourcesRepository.findSourceCleanupDataByWorkspaceId(workspaceId);
  const result = await repository.deleteWorkspace(workspaceId, userId);

  if (!result) {
    throw new NotFoundError("Workspace not found", WORKSPACE_NOT_FOUND);
  }

  if (sources.length > 0) {
    await inngest.send({
      name: "workspace/namespace.cleanup",
      data: { workspaceId, sources },
    });
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
