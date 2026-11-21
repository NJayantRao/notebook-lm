import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { encodingForModel } from "js-tiktoken";

import type { SourceRecord } from "../repository/sources.repository.js";
import sourceChunksRepository, {
  type NewSourceChunk,
  type SourceChunkContent,
} from "../repository/source-chunks.repository.js";
import { EMBEDDING_MODEL } from "../lib/openai.js";
import {
  deleteSourceVectors,
  upsertSourceChunkDocuments,
} from "../lib/pinecone.js";

const CHUNK_SIZE = 450;
const CHUNK_OVERLAP = 60;

const HEADING_LINE = /^\s{0,3}#{1,6}\s+\S/;

const nearestHeading = (content: string, chunkText: string): string | undefined => {
  const firstLine = chunkText.split(/\r?\n/)[0]?.trim();
  if (!firstLine) {
    return undefined;
  }

  const position = content.indexOf(firstLine);
  if (position < 0) {
    return undefined;
  }

  const headings = content
    .slice(0, position)
    .split(/\r?\n/)
    .filter((line) => HEADING_LINE.test(line) && line.trim());
  return headings.at(-1)?.trim();
};

const createSourceChunks = async (source: SourceRecord): Promise<number> => {
  const content = source.content;
  if (!content?.trim()) {
    throw new Error(`Source ${source.id} does not contain indexable text.`);
  }

  const encoding = encodingForModel(EMBEDDING_MODEL);
  const splitterOptions = {
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    lengthFunction: (text: string) => encoding.encode(text).length,
  };
  const createSplitter = () =>
    source.sourceType === "markdown" || source.sourceType === "website"
      ? RecursiveCharacterTextSplitter.fromLanguage("markdown", splitterOptions)
      : new RecursiveCharacterTextSplitter(splitterOptions);

  const splitText = async (text: string): Promise<string[]> => {
    const chunks = await createSplitter().splitText(text);
    return chunks.map((chunk) => chunk.trim()).filter(Boolean);
  };

  const toChunk = (
    text: string,
    index: number,
    metadata: Record<string, unknown>
  ): NewSourceChunk => ({
    sourceId: source.id,
    index,
    content: text,
    tokenCount: encoding.encode(text).length,
    metadata,
  });

  // New PDFs keep page boundaries with a form feed. Each page is split on its
  // own, blank pages are skipped, and the chunk index continues across pages.
  if (source.sourceType === "pdf" && content.includes("\f")) {
    const pages = content.split("\f");
    const chunks: NewSourceChunk[] = [];

    for (const [pageIndex, pageText] of pages.entries()) {
      if (!pageText.trim()) {
        continue;
      }

      for (const text of await splitText(pageText)) {
        chunks.push(
          toChunk(text, chunks.length, {
            sourceType: source.sourceType,
            page: pageIndex + 1,
          })
        );
      }
    }

    return sourceChunksRepository.replaceSourceChunks(source.id, chunks);
  }

  // YouTube transcripts are stored as time-grouped blocks separated by form
  // feeds; the matching start offsets live in the source metadata.
  if (source.sourceType === "yt_url" && content.includes("\f")) {
    const blocks = content.split("\f");
    const starts = Array.isArray(source.metadata.transcriptStarts)
      ? source.metadata.transcriptStarts
      : [];
    const chunks: NewSourceChunk[] = [];

    for (const [blockIndex, blockText] of blocks.entries()) {
      if (!blockText.trim()) {
        continue;
      }

      const rawStart = starts[blockIndex];
      const startSeconds =
        typeof rawStart === "number" && Number.isFinite(rawStart) && rawStart >= 0
          ? rawStart
          : undefined;

      for (const text of await splitText(blockText)) {
        chunks.push(
          toChunk(text, chunks.length, {
            sourceType: source.sourceType,
            ...(startSeconds === undefined ? {} : { startSeconds }),
          })
        );
      }
    }

    return sourceChunksRepository.replaceSourceChunks(source.id, chunks);
  }

  // Non-PDF sources and legacy PDFs stored before page-aware extraction are
  // indexed as a single block with no page metadata.
  const wantsHeading =
    source.sourceType === "markdown" || source.sourceType === "website";
  const texts = await splitText(content);
  const chunks = texts.map((text, index) => {
    const heading = wantsHeading ? nearestHeading(content, text) : undefined;
    return toChunk(text, index, {
      sourceType: source.sourceType,
      ...(heading ? { heading } : {}),
    });
  });

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
  const embeddingInputs = chunks.map((sourceChunk) => {
    const heading =
      typeof sourceChunk.metadata.heading === "string" &&
      sourceChunk.metadata.heading.trim()
        ? sourceChunk.metadata.heading.trim()
        : undefined;
    return `${source.title}\n\n${heading ? `${heading}\n\n` : ""}${sourceChunk.content}`;
  });
  await upsertSourceChunkDocuments(
    source.workspaceId,
    chunks.map((sourceChunk, index) => ({
      id: sourceChunk.id,
      text: embeddingInputs[index]!,
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
