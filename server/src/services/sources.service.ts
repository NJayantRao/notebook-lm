import { NotFoundError } from "../utils/api-error.js";
import repository, {
  type SourceFilters,
} from "../repository/sources.repository.js";
import workspaceRepository from "../repository/workspaces.repository.js";
import type { CreateSourceInput } from "../validators/sources.validator.js";

const WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND";
const SOURCE_NOT_FOUND = "SOURCE_NOT_FOUND";

const requireOwnedWorkspace = async (userId: string, workspaceId: string) => {
  const workspace = await workspaceRepository.findWorkspaceByIdAndUserId(
    workspaceId,
    userId,
  );

  if (!workspace) {
    throw new NotFoundError("Workspace not found", WORKSPACE_NOT_FOUND);
  }

  return workspace;
};

const listAllSources = async (
  userId: string,
  workspaceId: string,
  filters: SourceFilters,
) => {
  await requireOwnedWorkspace(userId, workspaceId);

  const [sources, total] = await Promise.all([
    repository.findSourcesByWorkspaceId(workspaceId, filters),
    repository.countSourcesByWorkspaceId(workspaceId, filters),
  ]);

  return {
    sources,
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
};

const createSources = async (
  userId: string,
  workspaceId: string,
  input: CreateSourceInput,
) => {
  await requireOwnedWorkspace(userId, workspaceId);

  return repository.createSource(workspaceId, input);
};

const bulkDeleteSources = async (userId: string, workspaceId: string) => {
  await requireOwnedWorkspace(userId, workspaceId);

  return repository.deleteAllSourcesByWorkspaceId(workspaceId);
};

const deleteSource = async (
  userId: string,
  workspaceId: string,
  sourceId: string,
) => {
  await requireOwnedWorkspace(userId, workspaceId);

  const result = await repository.deleteSourceByWorkspaceIdAndId(
    workspaceId,
    sourceId,
  );

  if (!result) {
    throw new NotFoundError("Source not found", SOURCE_NOT_FOUND);
  }

  return result;
};

export default {
  listAllSources,
  createSources,
  bulkDeleteSources,
  deleteSource,
};
