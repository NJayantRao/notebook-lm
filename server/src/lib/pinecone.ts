import { Pinecone } from "@pinecone-database/pinecone";
import { ENV } from "../config/env.js";
import { ServiceUnavailableError } from "../utils/api-error.js";

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
  await getWorkspaceIndex(workspaceId).documents.delete({
    filter: { sourceId: { $eq: sourceId } },
  });
};

export const deleteWorkspaceVectors = async (
  workspaceId: string
): Promise<void> => {
  await getWorkspaceIndex(workspaceId).documents.delete({
    deleteAll: true,
  });
};

export const searchSourceChunkDocuments = async (
  workspaceId: string,
  query: string,
  topK: number
): Promise<Array<{ id: string; score?: number }>> => {
  try {
    const result = await getWorkspaceIndex(workspaceId).documents.search({
      scoreBy: [{ type: "embed", field: "chunk_text", query }],
      topK,
    });

    return result.matches.flatMap((match) =>
      typeof match._score === "number"
        ? [{ id: match._id, score: match._score }]
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

export const upsertSourceChunkDocuments = async (
  workspaceId: string,
  documents: SourceChunkDocument[]
): Promise<void> => {
  if (documents.length === 0) {
    return;
  }

  await getWorkspaceIndex(workspaceId).documents.upsert({
    documents: documents.map((document) => ({
      _id: document.id,
      chunk_text: document.text,
      title: document.metadata.sourceTitle,
      ...document.metadata,
    })),
  });
};
