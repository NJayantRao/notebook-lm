import { inngest } from "../lib/inngest.js";
import { getYouTubeVideoId } from "../lib/youtube.js";
import sourcesRepository from "../repository/sources.repository.js";
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
          throw new Error(`Website source ${sourceId} does not have a URL.`);
        }

        const scraped = await step.run("scrape-website", () =>
          preparation.scrapeWebsite(url)
        );
        const useScrapedTitle =
          source.metadata.useScrapedTitle === true && Boolean(scraped.title);
        const metadata: SourceMetadata = {
          ...withoutInternalMetadata(source.metadata),
          ...withoutInternalMetadata(scraped.metadata),
          importedFrom: url,
        };

        const updated = await step.run("save-website-content", () =>
          sourcesRepository.updateSourceRecord(sourceId, {
            content: scraped.markdown,
            url: scraped.url,
            ...(useScrapedTitle && scraped.title ? { title: scraped.title } : {}),
            metadata,
          })
        );
        if (!updated) {
          return { sourceId, status: "skipped" };
        }
      } else if (source.sourceType === "yt_url") {
        const videoId =
          requireStringMetadata(source.metadata, "videoId") ??
          (source.url ? getYouTubeVideoId(source.url) : null);
        if (!videoId) {
          throw new Error(`YouTube source ${sourceId} does not have a video ID.`);
        }

        const content = await step.run("fetch-youtube-transcript", () =>
          preparation.fetchYouTubeTranscript(videoId)
        );
        const updated = await step.run("save-youtube-content", () =>
          sourcesRepository.updateSourceRecord(sourceId, { content })
        );
        if (!updated) {
          return { sourceId, status: "skipped" };
        }
      } else if (source.sourceType === "pdf") {
        const storedFileName = requireStringMetadata(
          source.metadata,
          "storedFileName"
        );
        if (!storedFileName) {
          throw new Error(`PDF source ${sourceId} does not have a stored file.`);
        }

        const filePath = preparation.resolveStoredPdfPath(storedFileName);
        if (!filePath) {
          throw new Error(`PDF source ${sourceId} has an invalid stored file.`);
        }

        await step.run("verify-pdf-file", () => preparation.verifyPdf(filePath));
        const extracted = await step.run("extract-pdf-text", () =>
          preparation.extractPdf(filePath)
        );
        const updated = await step.run("save-pdf-content", () =>
          sourcesRepository.updateSourceRecord(sourceId, {
            content: extracted.text,
            metadata: {
              ...withoutInternalMetadata(source.metadata),
              pageCount: extracted.pageCount,
            },
          })
        );
        if (!updated) {
          return { sourceId, status: "skipped" };
        }
      } else {
        throw new Error(
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
