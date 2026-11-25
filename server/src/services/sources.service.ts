import type { Express } from "express";
import { basename, extname } from "node:path";
import logger, { markLogged } from "../config/logger.js";
import {
  BadRequestError,
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
import { verifyPdfFile } from "../lib/multer.js";
import { deletePdf, putPdf } from "../lib/s3.js";
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
  logger.error("source.enqueue.failed", {
    sourceId: source.id,
    workspaceId: source.workspaceId,
    sourceType: source.sourceType,
    error,
  });
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
  const apiError = new ServiceUnavailableError(message, code);
  markLogged(apiError);
  throw apiError;
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
  logger.info("source.created", {
    sourceId: source.id,
    workspaceId,
    sourceType: source.sourceType,
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

  const source = await repository.createYouTubeSource(workspaceId, {
    title: input.title ?? `YouTube video ${videoId}`,
    content: null,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    status: "pending",
    metadata: { videoId, importedFrom: input.url },
  });
  logger.info("source.created", {
    sourceId: source.id,
    workspaceId,
    sourceType: source.sourceType,
    videoId,
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

  const source = await repository.createSource(workspaceId, input);
  logger.info("source.created", {
    sourceId: source.id,
    workspaceId,
    sourceType: source.sourceType,
    contentChars: source.content?.length ?? 0,
  });
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
  let objectKey: string | undefined;

  try {
    await requireOwnedWorkspace(userId, workspaceId);

    verifyPdfFile(file.buffer);

    const originalName = basename(file.originalname);
    const title = basename(originalName, extname(originalName)).trim();
    const { key, url } = await putPdf(workspaceId, file.buffer);
    objectKey = key;

    const source = await repository.createSource(workspaceId, {
      sourceType: "pdf",
      title: title || "Uploaded PDF",
      content: null,
      status: "pending",
      metadata: {
        fileUrl: url,
        s3Key: key,
        storedFileName: key,
        originalName,
        mimeType: "application/pdf",
        size: file.size,
        fileName: originalName,
        fileSize: file.size,
        resourceType: "raw",
      },
    });
    sourceCreated = true;
    logger.info("source.created", {
      sourceId: source.id,
      workspaceId,
      sourceType: "pdf",
      size: file.size,
    });

    return await enqueueSourcePreparation(source);
  } catch (error) {
    if (objectKey && !sourceCreated) {
      try {
        await deletePdf(objectKey);
      } catch (cleanupError) {
        logger.warn("source.upload.orphan_cleanup.failed", {
          workspaceId,
          keyLength: objectKey.length,
          error: cleanupError,
        });
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
    try {
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
    } catch (error) {
      logger.warn("source.cleanup.enqueue.failed", {
        workspaceId,
        count: deletedSources.length,
        error,
      });
    }
  }

  logger.info("source.bulk_deleted", {
    workspaceId,
    count: deletedSources.length,
  });

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

  try {
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
  } catch (error) {
    logger.warn("source.cleanup.enqueue.failed", {
      workspaceId,
      sourceId,
      error,
    });
  }

  logger.info("source.deleted", { workspaceId, sourceId });
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

  logger.info("source.reindex.requested", {
    workspaceId,
    sourceId,
    sourceType: source.sourceType,
    needsPreparation,
  });

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
