import logger from "../config/logger.js";
import sourceChunksService from "../services/source-chunks.service.js";
import sourcesRepository, {
  type SourceRecord,
} from "../repository/sources.repository.js";
import { inngest } from "../lib/inngest.js";

const CHUNKS_PER_BATCH = 50;

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message.trim()
    ? error.message
    : "Source indexing failed.";

const withoutIndexingMetadata = (metadata: Record<string, unknown>) => {
  const {
    processingError: _processingError,
    chunkCount: _chunkCount,
    indexedAt: _indexedAt,
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
    throw new Error("The source indexing event is missing its source ID.");
  }

  return data.sourceId.trim();
};

export const indexSourceFunction = inngest.createFunction(
  {
    id: "index-source",
    retries: 3,
    singleton: {
      key: "event.data.sourceId",
      mode: "skip",
    },
    triggers: [{ event: "source/index.requested" }],
    onFailure: async ({ event, error }) => {
      let sourceId = "unknown";

      try {
        sourceId = requireSourceId(event.data.event.data);
        logger.error("source.index.failed", { sourceId, error });

        const source = await sourcesRepository.findSourceById(sourceId);
        if (!source) {
          return;
        }

        const updated = await sourcesRepository.updateSourceRecord(sourceId, {
          status: "failed",
          metadata: {
            ...withoutIndexingMetadata(source.metadata),
            processingError: getErrorMessage(error),
          },
        });
        if (!updated) {
          logger.warn("source.index.failure_unrecorded", { sourceId });
        }
      } catch (persistError) {
        logger.error("source.index.failure_persist_failed", {
          sourceId,
          error: persistError,
        });
      }
    },
  },
  async ({ event, step, attempt, runId }) => {
    const startedAt = performance.now();
    const sourceId = requireSourceId(event.data);
    const loadedSource = await step.run("load-source", async () => {
      const found = await sourcesRepository.findSourceById(sourceId);
      if (found) {
        logger.info("source.index.started", {
          sourceId,
          workspaceId: found.workspaceId,
          sourceType: found.sourceType,
          attempt,
          runId,
        });
      }
      return found;
    });
    // Inngest serializes step output as JSON, so restore Date fields before
    // handing the record to the indexing service.
    const source: SourceRecord | undefined = loadedSource
      ? {
          ...loadedSource,
          createdAt: new Date(loadedSource.createdAt),
          updatedAt: new Date(loadedSource.updatedAt),
        }
      : undefined;
    if (!source || source.status === "ready") {
      return { sourceId, status: "skipped" };
    }

    const jobMeta = {
      sourceId,
      workspaceId: source.workspaceId,
      sourceType: source.sourceType,
      attempt,
      runId,
    };

    if (
      source.sourceType !== "text" &&
      source.sourceType !== "markdown" &&
      source.sourceType !== "yt_url" &&
      source.sourceType !== "website" &&
      source.sourceType !== "pdf"
    ) {
      throw new Error(`Source type ${source.sourceType} cannot be indexed.`);
    }

    if (!source.content?.trim()) {
      throw new Error(`Source ${sourceId} does not contain indexable text.`);
    }

    const sourceMetadata = withoutIndexingMetadata(source.metadata);
    const markedProcessing = await step.run("mark-source-processing", () =>
      sourcesRepository.updateSourceRecord(sourceId, {
        status: "processing",
        metadata: sourceMetadata,
      })
    );
    if (!markedProcessing) {
      return { sourceId, status: "skipped" };
    }

    await step.run("delete-previous-vectors", async () => {
      try {
        await sourceChunksService.deleteSourceVectorsForWorkspace(
          source.workspaceId,
          sourceId
        );
      } catch (error) {
        // A missing namespace is expected for first-time indexing and retries.
        const message =
          error instanceof Error ? error.message.toLowerCase() : "";
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? error.status
            : undefined;
        const namespaceMissing =
          status === 404 ||
          message.includes("404") ||
          message.includes("namespace not found") ||
          message.includes("not found");
        if (!namespaceMissing) {
          throw error;
        }
        logger.debug("source.index.vectors_namespace_missing", {
          ...jobMeta,
          status,
        });
      }
    });

    const stats = await step.run("create-source-chunks", async () => {
      logger.info("source.index.step", { ...jobMeta, step: "chunk-source" });
      const result = await sourceChunksService.createSourceChunks(source);
      logger.info("source.index.chunked", {
        ...jobMeta,
        chunkCount: result.count,
        avgTokens: Math.round(result.totalTokens / Math.max(1, result.count)),
      });
      return result;
    });
    const chunkCount = stats.count;
    if (chunkCount === 0) {
      throw new Error(`Source ${sourceId} produced no indexable chunks.`);
    }

    await step.run("save-source-chunk-count", () =>
      sourcesRepository.updateSourceRecord(sourceId, {
        metadata: { ...sourceMetadata, chunkCount },
      })
    );

    for (
      let offset = 0, batchNumber = 0;
      offset < chunkCount;
      offset += CHUNKS_PER_BATCH, batchNumber += 1
    ) {
      const chunks = await step.run(`load-source-chunks-${batchNumber}`, () =>
        sourceChunksService.findSourceChunks(sourceId, offset, CHUNKS_PER_BATCH)
      );
      const expectedCount = Math.min(CHUNKS_PER_BATCH, chunkCount - offset);
      if (chunks.length !== expectedCount) {
        throw new Error(
          `Source ${sourceId} returned ${chunks.length} chunks in batch ${batchNumber}; expected ${expectedCount}.`
        );
      }

      await step.run(`upsert-source-chunks-${batchNumber}`, async () => {
        const batchStartedAt = performance.now();
        await sourceChunksService.indexSourceChunkBatch(source, chunks);
        const durationMs = Math.round(performance.now() - batchStartedAt);
        logger.info("source.index.embedded", {
          ...jobMeta,
          batch: batchNumber,
          count: chunks.length,
          durationMs,
        });
        logger.info("source.index.upserted", {
          ...jobMeta,
          batch: batchNumber,
          count: chunks.length,
        });
      });
    }

    const markedReady = await step.run("mark-source-ready", async () => {
      const updated = await sourcesRepository.updateSourceRecord(sourceId, {
        status: "ready",
        metadata: {
          ...sourceMetadata,
          chunkCount,
          indexedAt: new Date().toISOString(),
        },
      });
      if (updated) {
        logger.info("source.index.ready", {
          ...jobMeta,
          chunkCount,
          totalDurationMs: Math.round(performance.now() - startedAt),
        });
      }
      return updated;
    });
    if (!markedReady) {
      throw new Error(`Source ${sourceId} was deleted while it was indexing.`);
    }

    return { sourceId, status: "ready", chunkCount };
  }
);
