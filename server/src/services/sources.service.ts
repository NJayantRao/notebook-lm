import type { Express } from "express";
import { basename, extname } from "node:path";
import { ENV } from "../config/env.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from "../utils/api-error.js";
import repository, {
  type SourceRecord,
  type SourceFilters,
} from "../repository/sources.repository.js";
import workspaceRepository from "../repository/workspaces.repository.js";
import { getYouTubeVideoId } from "../lib/youtube.js";
import { inngest } from "../lib/inngest.js";
import { removeUploadedPdf } from "../lib/multer.js";
import type {
  CreateSourceInput,
  ImportWebsiteSourceInput,
  ImportYouTubeSourceInput,
} from "../validators/sources.validator.js";

const WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND";
const SOURCE_NOT_FOUND = "SOURCE_NOT_FOUND";

const requireOwnedWorkspace = async (userId: string, workspaceId: string) => {
  const workspace = await workspaceRepository.findWorkspaceByIdAndUserId(
    workspaceId,
    userId
  );

  if (!workspace) {
    throw new NotFoundError("Workspace not found", WORKSPACE_NOT_FOUND);
  }

  return workspace;
};

const assertSourceCapacity = async (workspaceId: string): Promise<void> => {
  const { total } = await repository.countSourcesByWorkspaceId(workspaceId, {
    page: 1,
    limit: 1,
  });
  if (total >= ENV.MAX_SOURCES_PER_WORKSPACE) {
    throw new ConflictError(
      `This workspace can contain at most ${ENV.MAX_SOURCES_PER_WORKSPACE} sources.`,
      "MAX_SOURCES_REACHED"
    );
  }
};

const listAllSources = async (
  userId: string,
  workspaceId: string,
  filters: SourceFilters
) => {
  await requireOwnedWorkspace(userId, workspaceId);

  const [sources, counts] = await Promise.all([
    repository.findSourcesByWorkspaceId(workspaceId, filters),
    repository.countSourcesByWorkspaceId(workspaceId, filters),
  ]);

  return {
    sources,
    pagination: {
      total: counts.total,
      readyCount: counts.ready,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(counts.total / filters.limit),
    },
  };
};

const markEnqueueFailure = async (
  source: SourceRecord,
  error: unknown,
  message: string,
  code: string
): Promise<never> => {
  console.error(`Failed to enqueue work for source ${source.id}:`, error);
  await repository.updateSourceRecord(source.id, {
    status: "failed",
    metadata: {
      ...source.metadata,
      processingError:
        error instanceof Error && error.message.trim()
          ? error.message
          : message,
    },
  });
  throw new ServiceUnavailableError(message, code);
};

const enqueueSourceIndexing = async (
  source: SourceRecord
): Promise<SourceRecord> => {
  try {
    await inngest.send({
      name: "source/index.requested",
      data: { sourceId: source.id },
    });
  } catch (error) {
    await markEnqueueFailure(
      source,
      error,
      "The source was saved, but indexing could not be scheduled. Try again later.",
      "SOURCE_INDEXING_QUEUE_FAILED"
    );
  }

  return source;
};

const enqueueSourcePreparation = async (
  source: SourceRecord
): Promise<SourceRecord> => {
  try {
    await inngest.send({
      name: "source/prepare.requested",
      data: { sourceId: source.id },
    });
  } catch (error) {
    await markEnqueueFailure(
      source,
      error,
      "The source was saved, but processing could not be scheduled. Try again later.",
      "SOURCE_PROCESSING_QUEUE_FAILED"
    );
  }

  return source;
};

const saveWebsiteImport = async (
  workspaceId: string,
  input: ImportWebsiteSourceInput
) => {
  await assertSourceCapacity(workspaceId);

  const source = await repository.createWebsiteSource(workspaceId, {
    title: input.title ?? new URL(input.url).hostname,
    content: null,
    url: input.url,
    status: "pending",
    metadata: {
      importedFrom: input.url,
      useScrapedTitle: !input.title,
    },
  });

  return enqueueSourcePreparation(source);
};

const saveYouTubeImport = async (
  workspaceId: string,
  input: ImportYouTubeSourceInput
) => {
  const videoId = getYouTubeVideoId(input.url);
  if (!videoId) {
    throw new BadRequestError(
      "Enter a valid YouTube video URL.",
      "INVALID_YOUTUBE_URL"
    );
  }

  await assertSourceCapacity(workspaceId);

  const source = await repository.createYouTubeSource(workspaceId, {
    title: input.title ?? `YouTube video ${videoId}`,
    content: null,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    status: "pending",
    metadata: { videoId, importedFrom: input.url },
  });

  return enqueueSourcePreparation(source);
};

const createSources = async (
  userId: string,
  workspaceId: string,
  input: CreateSourceInput
) => {
  await requireOwnedWorkspace(userId, workspaceId);

  if (input.sourceType === "website") {
    return saveWebsiteImport(workspaceId, input);
  }

  if (input.sourceType === "yt_url") {
    return saveYouTubeImport(workspaceId, input);
  }

  await assertSourceCapacity(workspaceId);

  const source = await repository.createSource(workspaceId, input);
  return enqueueSourceIndexing(source);
};

const importWebsiteSource = async (
  userId: string,
  workspaceId: string,
  input: ImportWebsiteSourceInput
) => {
  await requireOwnedWorkspace(userId, workspaceId);
  return saveWebsiteImport(workspaceId, input);
};

const importYouTubeSource = async (
  userId: string,
  workspaceId: string,
  input: ImportYouTubeSourceInput
) => {
  await requireOwnedWorkspace(userId, workspaceId);
  return saveYouTubeImport(workspaceId, input);
};

const uploadPdfSource = async (
  userId: string,
  workspaceId: string,
  file: Express.Multer.File
) => {
  let sourceCreated = false;

  try {
    await requireOwnedWorkspace(userId, workspaceId);

    const originalName = basename(file.originalname);
    const title = basename(originalName, extname(originalName)).trim();

    await assertSourceCapacity(workspaceId);

    const source = await repository.createSource(workspaceId, {
      sourceType: "pdf",
      title: title || "Uploaded PDF",
      content: null,
      status: "pending",
      metadata: {
        originalName,
        storedFileName: file.filename,
        mimeType: "application/pdf",
        size: file.size,
        fileName: originalName,
        fileSize: file.size,
        resourceType: "raw",
      },
    });
    sourceCreated = true;

    return await enqueueSourcePreparation(source);
  } catch (error) {
    if (!sourceCreated) {
      try {
        await removeUploadedPdf(file.path);
      } catch (cleanupError) {
        console.error(
          "Failed to remove an unregistered PDF upload:",
          cleanupError
        );
      }
    }

    throw error;
  }
};

const bulkDeleteSources = async (userId: string, workspaceId: string) => {
  await requireOwnedWorkspace(userId, workspaceId);

  const deletedSources =
    await repository.deleteAllSourcesByWorkspaceId(workspaceId);
  if (deletedSources.length > 0) {
    await inngest.send({
      name: "source/vectors.cleanup",
      data: {
        workspaceId,
        sources: deletedSources.map((item) => ({
          id: item.id,
          workspaceId: item.workspaceId,
          metadata: item.metadata,
        })),
      },
    });
  }

  return deletedSources.length;
};

const deleteSource = async (
  userId: string,
  workspaceId: string,
  sourceId: string
) => {
  await requireOwnedWorkspace(userId, workspaceId);

  const result = await repository.deleteSourceByWorkspaceIdAndId(
    workspaceId,
    sourceId
  );

  if (!result) {
    throw new NotFoundError("Source not found", SOURCE_NOT_FOUND);
  }

  await inngest.send({
    name: "source/vectors.cleanup",
    data: {
      workspaceId,
      sources: [
        {
          id: result.id,
          workspaceId: result.workspaceId,
          metadata: result.metadata,
        },
      ],
    },
  });

  return result;
};

const reindexSource = async (
  userId: string,
  workspaceId: string,
  sourceId: string
) => {
  await requireOwnedWorkspace(userId, workspaceId);

  const source = await repository.findSourceByWorkspaceIdAndId(
    workspaceId,
    sourceId
  );
  if (!source) {
    throw new NotFoundError("Source not found", SOURCE_NOT_FOUND);
  }

  const needsPreparation =
    source.sourceType === "website" ||
    source.sourceType === "yt_url" ||
    source.sourceType === "pdf";
  const { processingError: _processingError, ...metadata } = source.metadata;
  const updatedSource: SourceRecord = {
    ...source,
    status: "pending",
    content: needsPreparation ? null : source.content,
    metadata,
  };

  const saved = await repository.updateSourceRecord(sourceId, {
    status: "pending",
    content: updatedSource.content,
    metadata,
  });
  if (!saved) {
    throw new NotFoundError("Source not found", SOURCE_NOT_FOUND);
  }

  return needsPreparation
    ? enqueueSourcePreparation(updatedSource)
    : enqueueSourceIndexing(updatedSource);
};

export default {
  listAllSources,
  createSources,
  importWebsiteSource,
  importYouTubeSource,
  uploadPdfSource,
  bulkDeleteSources,
  deleteSource,
  reindexSource,
};
