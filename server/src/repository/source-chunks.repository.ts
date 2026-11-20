import { and, asc, eq, gte, sql } from "drizzle-orm";

import db from "../db/index.js";
import { chunk } from "../db/schema.js";

export type SourceChunkRecord = typeof chunk.$inferSelect;
export type SourceChunkContent = Pick<
  SourceChunkRecord,
  "id" | "sourceId" | "index" | "content" | "tokenCount" | "metadata"
>;

export type NewSourceChunk = {
  sourceId: string;
  index: number;
  content: string;
  tokenCount: number;
  metadata?: Record<string, unknown> | undefined;
};

const replaceSourceChunks = async (
  sourceId: string,
  chunks: NewSourceChunk[]
): Promise<number> => {
  if (chunks.length > 0) {
    await db
      .insert(chunk)
      .values(
        chunks.map((sourceChunk) => ({
          ...sourceChunk,
          metadata: sourceChunk.metadata ?? {},
        }))
      )
      .onConflictDoUpdate({
        target: [chunk.sourceId, chunk.index],
        set: {
          content: sql`excluded.content`,
          tokenCount: sql`excluded.token_count`,
          metadata: sql`excluded.metadata`,
          updatedAt: new Date(),
        },
      });
  }

  await db
    .delete(chunk)
    .where(and(eq(chunk.sourceId, sourceId), gte(chunk.index, chunks.length)));

  return chunks.length;
};

const findSourceChunks = async (
  sourceId: string,
  offset: number,
  limit: number
): Promise<SourceChunkContent[]> =>
  db
    .select({
      id: chunk.id,
      sourceId: chunk.sourceId,
      index: chunk.index,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      metadata: chunk.metadata,
    })
    .from(chunk)
    .where(eq(chunk.sourceId, sourceId))
    .orderBy(asc(chunk.index))
    .limit(limit)
    .offset(offset);

export default {
  replaceSourceChunks,
  findSourceChunks,
};
