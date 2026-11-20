import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { encodingForModel } from "@langchain/core/utils/tiktoken";

import type { SourceRecord } from "../repository/sources.repository.js";
import sourceChunksRepository, {
  type SourceChunkContent,
} from "../repository/source-chunks.repository.js";
import { createEmbeddings, EMBEDDING_MODEL } from "../lib/openai.js";
import {
  deleteSourceVectors,
  upsertSourceChunkVectors,
} from "../lib/pinecone.js";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

const createSourceChunks = async (source: SourceRecord): Promise<number> => {
  const content = source.content?.trim();
  if (!content) {
    throw new Error(`Source ${source.id} does not contain indexable text.`);
  }

  const encoding = await encodingForModel(EMBEDDING_MODEL);
  const splitterOptions = {
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    lengthFunction: (text: string) => encoding.encode(text).length,
  };
  const splitter =
    source.sourceType === "markdown" || source.sourceType === "website"
      ? RecursiveCharacterTextSplitter.fromLanguage("markdown", splitterOptions)
      : new RecursiveCharacterTextSplitter(splitterOptions);
  const texts = (await splitter.splitText(content))
    .map((text) => text.trim())
    .filter(Boolean);

  const chunks = texts.map((text, index) => ({
    sourceId: source.id,
    index,
    content: text,
    tokenCount: encoding.encode(text).length,
    metadata: { sourceType: source.sourceType },
  }));

  return sourceChunksRepository.replaceSourceChunks(source.id, chunks);
};

const findSourceChunks = (
  sourceId: string,
  offset: number,
  limit: number
): Promise<SourceChunkContent[]> =>
  sourceChunksRepository.findSourceChunks(sourceId, offset, limit);

const deleteSourceVectorsForWorkspace = (
  workspaceId: string,
  sourceId: string
): Promise<void> => deleteSourceVectors(workspaceId, sourceId);

const indexSourceChunkBatch = async (
  source: SourceRecord,
  chunks: SourceChunkContent[]
): Promise<void> => {
  const embeddings = await createEmbeddings(
    chunks.map((sourceChunk) => sourceChunk.content)
  );
  if (embeddings.length !== chunks.length) {
    throw new Error("Embedding count did not match the source chunk count.");
  }

  await upsertSourceChunkVectors(
    source.workspaceId,
    chunks.map((sourceChunk, index) => ({
      id: sourceChunk.id,
      values: embeddings[index]!,
      metadata: {
        sourceId: source.id,
        workspaceId: source.workspaceId,
        sourceType: source.sourceType,
        sourceTitle: source.title,
        chunkIndex: sourceChunk.index,
        tokenCount: sourceChunk.tokenCount,
      },
    }))
  );
};

export default {
  createSourceChunks,
  findSourceChunks,
  deleteSourceVectorsForWorkspace,
  indexSourceChunkBatch,
};
