import { Pinecone } from "@pinecone-database/pinecone";
import { ENV } from "../config/env.js";
import { ServiceUnavailableError } from "../utils/api-error.js";
import { EMBEDDING_DIMENSIONS } from "./openai.js";

type SourceChunkVector = {
  id: string;
  values: number[];
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
  await getWorkspaceIndex(workspaceId).deleteMany({
    filter: { sourceId },
  });
};

export const deleteWorkspaceVectors = async (
  workspaceId: string
): Promise<void> => {
  await getWorkspaceIndex(workspaceId).deleteAll();
};

export const querySourceChunkVectors = async (
  workspaceId: string,
  vector: number[],
  topK: number
): Promise<Array<{ id: string; score?: number }>> => {
  try {
    const result = await getWorkspaceIndex(workspaceId).query({
      vector,
      topK,
      includeMetadata: false,
    });

    return result.matches.flatMap((match) =>
      match.id
        ? [{ id: match.id, ...(match.score === undefined ? {} : { score: match.score }) }]
        : []
    );
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    console.error("Pinecone source search failed:", error);
    throw new ServiceUnavailableError(
      "Workspace source search is unavailable.",
      "PINECONE_SEARCH_FAILED"
    );
  }
};

export const upsertSourceChunkVectors = async (
  workspaceId: string,
  vectors: SourceChunkVector[]
): Promise<void> => {
  if (vectors.length === 0) {
    return;
  }

  if (
    vectors.some(
      (vector) =>
        vector.values.length !== EMBEDDING_DIMENSIONS ||
        !vector.values.every(Number.isFinite)
    )
  ) {
    throw new Error(
      `Pinecone vectors must contain ${EMBEDDING_DIMENSIONS} finite values.`
    );
  }

  await getWorkspaceIndex(workspaceId).upsert({ records: vectors });
};
