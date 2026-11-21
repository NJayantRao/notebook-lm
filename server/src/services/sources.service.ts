import type { Express } from "express";
import { basename, extname } from "node:path";
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
import { scrapeWebsiteByUrl } from "../lib/firecrawl.js";
import { getYouTubeTranscript, getYouTubeVideoId } from "../lib/youtube.js";
import { inngest } from "../lib/inngest.js";
import { removeUploadedPdf, verifyPdfFile } from "../lib/multer.js";
import { extractPdfText } from "../lib/pdf.js";
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

const enqueueSourceIndexing = async (
  source: SourceRecord
): Promise<SourceRecord> => {
  try {
    await inngest.send({
      name: "source/index.requested",
      data: { sourceId: source.id },
    });
  } catch (error) {
    console.error(`Failed to enqueue indexing for source ${source.id}:`, error);
    await repository.updateSourceRecord(source.id, {
      status: "failed",
      metadata: {
        ...source.metadata,
        processingError:
          error instanceof Error
            ? error.message
            : "Source indexing could not be queued.",
      },
    });
    throw new ServiceUnavailableError(
      "The source was saved, but indexing could not be scheduled. Try again later.",
      "SOURCE_INDEXING_QUEUE_FAILED"
    );
  }

  return source;
};

const saveWebsiteImport = async (
  workspaceId: string,
  input: ImportWebsiteSourceInput
) => {
  const scraped = await scrapeWebsiteByUrl(input.url);

  const source = await repository.createWebsiteSource(workspaceId, {
    title: input.title ?? scraped.title ?? new URL(scraped.url).hostname,
    content: scraped.markdown,
    url: scraped.url,
    status: "pending",
    metadata: {
      ...scraped.metadata,
      importedFrom: input.url,
    },
  });

  return enqueueSourceIndexing(source);
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

  const content = await getYouTubeTranscript(videoId);
  const source = await repository.createYouTubeSource(workspaceId, {
    title: input.title ?? `YouTube video ${videoId}`,
    content,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    status: "pending",
    metadata: { videoId, importedFrom: input.url },
  });

  return enqueueSourceIndexing(source);
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
    await verifyPdfFile(file.path);
    const extracted = await extractPdfText(file.path);

    const originalName = basename(file.originalname);
    const title = basename(originalName, extname(originalName)).trim();

    const source = await repository.createSource(workspaceId, {
      sourceType: "pdf",
      title: title || "Uploaded PDF",
      content: extracted.text,
      status: "pending",
      metadata: {
        originalName,
        storedFileName: file.filename,
        mimeType: "application/pdf",
        size: file.size,
        fileName: originalName,
        fileSize: file.size,
        resourceType: "raw",
        pageCount: extracted.pageCount,
      },
    });
    sourceCreated = true;

    return await enqueueSourceIndexing(source);
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

  return repository.deleteAllSourcesByWorkspaceId(workspaceId);
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

  return result;
};

export default {
  listAllSources,
  createSources,
  importWebsiteSource,
  importYouTubeSource,
  uploadPdfSource,
  bulkDeleteSources,
  deleteSource,
};
