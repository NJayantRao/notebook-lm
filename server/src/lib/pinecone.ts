import { Pinecone } from "@pinecone-database/pinecone";
import { ENV } from "../config/env.js";
import logger, { markLogged, timed } from "../config/logger.js";
import { ServiceUnavailableError } from "../utils/api-error.js";

const PROVIDER = "pinecone";

type SourceChunkDocument = {
  id: string;
  text: string;
  metadata: {
    sourceId: string;
    workspaceId: string;
    sourceType: string;
    sourceTitle: string;
    chunkIndex: number;
    tokenCount: number;
  };
};

let client: Pinecone | undefined;

const getWorkspaceIndex = (workspaceId: string) => {
  const apiKey = ENV.PINECONE_API_KEY?.trim();
  const indexName = ENV.PINECONE_INDEX?.trim();
  if (!apiKey || !indexName) {
    throw new ServiceUnavailableError(
      "Pinecone is not configured.",
      "PINECONE_NOT_CONFIGURED"
    );
  }

  client ??= new Pinecone({ apiKey });
  return client.index({ name: indexName, namespace: workspaceId });
};

export const deleteSourceVectors = async (
  workspaceId: string,
  sourceId: string
): Promise<void> => {
  await timed(
    "vector.delete",
    { provider: PROVIDER, workspaceId, sourceId, scope: "source" },
    () =>
      getWorkspaceIndex(workspaceId).documents.delete({
        filter: { sourceId: { $eq: sourceId } },
      })
  );
};

export const deleteWorkspaceVectors = async (
  workspaceId: string
): Promise<void> => {
  await timed(
    "vector.delete",
    { provider: PROVIDER, workspaceId, scope: "workspace" },
    () =>
      getWorkspaceIndex(workspaceId).documents.delete({
        deleteAll: true,
      })
  );
};

export const searchSourceChunkDocuments = async (
  workspaceId: string,
  query: string,
  topK: number
): Promise<Array<{ id: string; score?: number }>> => {
  try {
    const result = await timed(
      "vector.query",
      { provider: PROVIDER, workspaceId, count: topK, queryChars: query.length },
      () =>
        getWorkspaceIndex(workspaceId).documents.search({
          scoreBy: [{ type: "embed", field: "chunk_text", query }],
          topK,
        })
    );

    return result.matches.flatMap((match) =>
      typeof match._score === "number"
        ? [{ id: match._id, score: match._score }]
        : []
    );
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    logger.error("vector.query.failed", { provider: PROVIDER, workspaceId, error });
    const apiError = new ServiceUnavailableError(
      "Workspace source search is unavailable.",
      "PINECONE_SEARCH_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }
};

export const upsertSourceChunkDocuments = async (
  workspaceId: string,
  documents: SourceChunkDocument[]
): Promise<void> => {
  if (documents.length === 0) {
    return;
  }

  await timed(
    "vector.upsert",
    { provider: PROVIDER, workspaceId, count: documents.length },
    () =>
      getWorkspaceIndex(workspaceId).documents.upsert({
        documents: documents.map((document) => ({
          _id: document.id,
          chunk_text: document.text,
          title: document.metadata.sourceTitle,
          ...document.metadata,
        })),
      })
  );

  // The index computes embeddings for `chunk_text` on write, so this is where
  // embeddings are actually created (Pinecone inference, not a direct SDK call).
  logger.info("embeddings.created", {
    provider: PROVIDER,
    workspaceId,
    count: documents.length,
  });
};
