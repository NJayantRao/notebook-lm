import { NonRetriableError } from "inngest";

import { inngest } from "../lib/inngest.js";
import { getYouTubeVideoId } from "../lib/youtube.js";
import sourcesRepository from "../repository/sources.repository.js";
import { S3ObjectNotFoundError } from "../lib/s3.js";
import preparation from "../services/source-preparation.service.js";
import type { SourceMetadata } from "../types/source.js";

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message.trim()
    ? error.message
    : "Source preparation failed.";

const withoutInternalMetadata = (metadata: SourceMetadata) => {
  const {
    processingError: _processingError,
    chunkCount: _chunkCount,
    indexedAt: _indexedAt,
    useScrapedTitle: _useScrapedTitle,
    ...rest
  } = metadata;

  return rest;
};

const requireSourceId = (data: unknown): string => {
  if (
    typeof data !== "object" ||
    data === null ||
    !("sourceId" in data) ||
    typeof data.sourceId !== "string" ||
    !data.sourceId.trim()
  ) {
    throw new Error("The source preparation event is missing its source ID.");
  }

  return data.sourceId.trim();
};

const requireStringMetadata = (
  metadata: SourceMetadata,
  key: string
): string | null => {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const errorCode = (error: unknown): string =>
  typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";

const isNonRetriablePdfError = (error: unknown): boolean =>
  error instanceof S3ObjectNotFoundError ||
  [
    "PDF_EXTRACTION_FAILED",
    "PDF_TEXT_NOT_FOUND",
    "INVALID_PDF_SIGNATURE",
    "ENOENT",
    "EACCES",
  ].includes(errorCode(error));

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

type SaveResult = { saved: boolean; length: number };

export const prepareSourceFunction = inngest.createFunction(
  {
    id: "prepare-source",
    retries: 3,
    singleton: {
      key: "event.data.sourceId",
      mode: "skip",
    },
    triggers: [{ event: "source/prepare.requested" }],
    onFailure: async ({ event, error }) => {
      let sourceId = "unknown";

      try {
        sourceId = requireSourceId(event.data.event.data);
        console.error(`Preparing source ${sourceId} failed after retries:`, error);

        const source = await sourcesRepository.findSourceById(sourceId);
        if (!source) {
          return;
        }

        const updated = await sourcesRepository.updateSourceRecord(sourceId, {
          status: "failed",
          metadata: {
            ...withoutInternalMetadata(source.metadata),
            processingError: getErrorMessage(error),
          },
        });
        if (!updated) {
          console.warn(
            `Source ${sourceId} was removed before its preparation failure could be recorded.`
          );
        }
      } catch (persistError) {
        console.error(
          `Failed to record preparation failure for source ${sourceId}:`,
          persistError
        );
      }
    },
  },
  async ({ event, step }) => {
    const sourceId = requireSourceId(event.data);
    const source = await step.run("load-source", () =>
      sourcesRepository.findSourceById(sourceId)
    );

    if (!source || source.status === "ready") {
      return { sourceId, status: "skipped" };
    }

    if (!source.content?.trim()) {
      if (source.sourceType === "website") {
        const url = source.url ?? requireStringMetadata(source.metadata, "importedFrom");
        if (!url) {
          throw new NonRetriableError(`Website source ${sourceId} does not have a URL.`);
        }
        if (!isHttpUrl(url)) {
          throw new NonRetriableError(`Website source ${sourceId} has an invalid URL.`);
        }

        const result: SaveResult = await step.run("scrape-and-save-website", async () => {
          const scraped = await preparation.scrapeWebsite(url);
          const useScrapedTitle =
            source.metadata.useScrapedTitle === true && Boolean(scraped.title);
          const metadata: SourceMetadata = {
            ...withoutInternalMetadata(source.metadata),
            ...withoutInternalMetadata(scraped.metadata),
            importedFrom: url,
          };

          const updated = await sourcesRepository.updateSourceRecord(sourceId, {
            content: scraped.markdown,
            url: scraped.url,
            ...(useScrapedTitle && scraped.title ? { title: scraped.title } : {}),
            metadata,
          });

          return { saved: Boolean(updated), length: scraped.markdown.length };
        });
        if (!result.saved) {
          return { sourceId, status: "skipped" };
        }
      } else if (source.sourceType === "yt_url") {
        const videoId =
          requireStringMetadata(source.metadata, "videoId") ??
          (source.url ? getYouTubeVideoId(source.url) : null);
        if (!videoId) {
          throw new NonRetriableError(`YouTube source ${sourceId} does not have a valid video ID.`);
        }

        const result: SaveResult = await step.run("fetch-and-save-youtube", async () => {
          const transcript = await preparation.fetchYouTubeTranscript(videoId);
          const updated = await sourcesRepository.updateSourceRecord(sourceId, {
            content: transcript.content,
            metadata: {
              ...withoutInternalMetadata(source.metadata),
              transcriptStarts: transcript.startSeconds,
            },
          });

          return { saved: Boolean(updated), length: transcript.content.length };
        });
        if (!result.saved) {
          return { sourceId, status: "skipped" };
        }
      } else if (source.sourceType === "pdf") {
        const s3Key = requireStringMetadata(source.metadata, "s3Key");
        if (!s3Key) {
          throw new NonRetriableError(`PDF source ${sourceId} does not have a stored file.`);
        }

        const result: SaveResult = await step.run("extract-and-save-pdf", async () => {
          try {
            const buffer = await preparation.downloadPdf(s3Key);
            await preparation.verifyPdf(buffer);
            const extracted = await preparation.extractPdf(buffer);
            const updated = await sourcesRepository.updateSourceRecord(sourceId, {
              content: extracted.text,
              metadata: {
                ...withoutInternalMetadata(source.metadata),
                pageCount: extracted.pageCount,
              },
            });

            return { saved: Boolean(updated), length: extracted.text.length };
          } catch (error) {
            if (isNonRetriablePdfError(error)) {
              throw new NonRetriableError(
                `PDF source ${sourceId} is missing, unreadable, scanned, or encrypted.`,
                { cause: error }
              );
            }
            throw error;
          }
        });
        if (!result.saved) {
          return { sourceId, status: "skipped" };
        }
      } else {
        throw new NonRetriableError(
          `Source type ${source.sourceType} does not need background preparation.`
        );
      }
    }

    await step.sendEvent("enqueue-source-indexing", {
      name: "source/index.requested",
      data: { sourceId },
    });

    return { sourceId, status: "prepared" };
  }
);
