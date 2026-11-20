import type { Express } from "express";
import { basename, extname } from "node:path";
import { BadRequestError, NotFoundError } from "../utils/api-error.js";
import repository, {
  type SourceFilters,
} from "../repository/sources.repository.js";
import workspaceRepository from "../repository/workspaces.repository.js";
import { scrapeWebsiteByUrl } from "../lib/firecrawl.js";
import { getYouTubeTranscript, getYouTubeVideoId } from "../lib/youtube.js";
import { removeUploadedPdf, verifyPdfFile } from "../lib/multer.js";
import { extractPdfText } from "../lib/pdf.js";
import type { CreateSourceInput } from "../validators/sources.validator.js";

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
  input: CreateSourceInput
) => {
  await requireOwnedWorkspace(userId, workspaceId);

  if (input.sourceType === "website") {
    const scraped = await scrapeWebsiteByUrl(input.url);

    return repository.createSource(workspaceId, {
      sourceType: "website",
      title: input.title ?? scraped.title ?? new URL(scraped.url).hostname,
      content: scraped.markdown,
      url: scraped.url,
      status: "ready",
      metadata: scraped.metadata,
    });
  }

  if (input.sourceType === "yt_url") {
    const videoId = getYouTubeVideoId(input.url);
    if (!videoId) {
      throw new BadRequestError(
        "Enter a valid YouTube video URL.",
        "INVALID_YOUTUBE_URL"
      );
    }

    const content = await getYouTubeTranscript(videoId);
    return repository.createSource(workspaceId, {
      sourceType: "yt_url",
      title: input.title ?? `YouTube video ${videoId}`,
      content,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      status: "ready",
      metadata: { videoId },
    });
  }

  return repository.createSource(workspaceId, input);
};

const uploadPdfSource = async (
  userId: string,
  workspaceId: string,
  file: Express.Multer.File
) => {
  try {
    await requireOwnedWorkspace(userId, workspaceId);
    await verifyPdfFile(file.path);
    const extracted = await extractPdfText(file.path);

    const originalName = basename(file.originalname);
    const title = basename(originalName, extname(originalName)).trim();

    return await repository.createSource(workspaceId, {
      sourceType: "pdf",
      title: title || "Uploaded PDF",
      content: extracted.text,
      status: "ready",
      metadata: {
        originalName,
        storedFileName: file.filename,
        mimeType: "application/pdf",
        size: file.size,
        pageCount: extracted.pageCount,
      },
    });
  } catch (error) {
    try {
      await removeUploadedPdf(file.path);
    } catch (cleanupError) {
      console.error(
        "Failed to remove an unregistered PDF upload:",
        cleanupError
      );
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
  uploadPdfSource,
  bulkDeleteSources,
  deleteSource,
};
