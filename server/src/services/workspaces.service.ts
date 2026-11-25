import logger from "../config/logger.js";
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

const createWorkspace = async (
  userId: string,
  input: CreateWorkspaceInput
) => {
  const created = await repository.createWorkspace(userId, input);
  logger.info("workspace.created", { userId, workspaceId: created.id });
  return created;
};

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
    try {
      await inngest.send({
        name: "workspace/namespace.cleanup",
        data: { workspaceId, sources },
      });
    } catch (error) {
      logger.warn("workspace.cleanup.enqueue.failed", {
        workspaceId,
        sourceCount: sources.length,
        error,
      });
    }
  }

  // Artifact cleanup must run even when a workspace had no sources.
  try {
    await inngest.send({
      name: "workspace/artifacts.cleanup",
      data: { workspaceId },
    });
  } catch (error) {
    logger.warn("workspace.artifact_cleanup.enqueue.failed", {
      workspaceId,
      error,
    });
  }

  logger.info("workspace.deleted", {
    userId,
    workspaceId,
    sourceCount: sources.length,
  });
  return result;
};

export default {
  listWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
};
