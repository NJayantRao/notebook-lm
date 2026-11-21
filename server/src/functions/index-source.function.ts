import sourceChunksService from "../services/source-chunks.service.js";
import sourcesRepository from "../repository/sources.repository.js";
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
        console.error(`Indexing source ${sourceId} failed after retries:`, error);

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
          console.warn(
            `Source ${sourceId} was removed before its indexing failure could be recorded.`
          );
        }
      } catch (persistError) {
        console.error(
          `Failed to record indexing failure for source ${sourceId}:`,
          persistError
        );
      }
    },
  },
  async ({ event, step }) => {
    const sourceId = requireSourceId(event.data);
    const source = await sourcesRepository.findSourceById(sourceId);
    if (!source || source.status === "ready") {
      return { sourceId, status: "skipped" };
    }

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

    await step.run("delete-previous-vectors", () =>
      sourceChunksService.deleteSourceVectorsForWorkspace(
        source.workspaceId,
        sourceId
      )
    );

    const chunkCount = await step.run("create-source-chunks", () =>
      sourceChunksService.createSourceChunks(source)
    );
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

      await step.run(`upsert-source-chunks-${batchNumber}`, () =>
        sourceChunksService.indexSourceChunkBatch(source, chunks)
      );
    }

    const markedReady = await step.run("mark-source-ready", () =>
      sourcesRepository.updateSourceRecord(sourceId, {
        status: "ready",
        metadata: {
          ...sourceMetadata,
          chunkCount,
          indexedAt: new Date().toISOString(),
        },
      })
    );
    if (!markedReady) {
      throw new Error(`Source ${sourceId} was deleted while it was indexing.`);
    }

    return { sourceId, status: "ready", chunkCount };
  }
);
