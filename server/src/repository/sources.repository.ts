import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import db from "../db/index.js";
import { source } from "../db/schema.js";
import type { SourceMetadata } from "../types/source.js";
import { InternalServerError } from "../utils/api-error.js";

type Source = typeof source.$inferSelect;
export type SourceRecord = Source;

type CreateSourceData = {
  sourceType: Source["sourceType"];
  title: string;
  content: string | null;
  url?: string | null;
  status?: Source["status"];
  metadata?: SourceMetadata | undefined;
};

export type SourceFilters = {
  search?: string | undefined;
  sourceType?: Source["sourceType"] | undefined;
  status?: Source["status"] | undefined;
  page: number;
  limit: number;
};

const buildSourceConditions = (
  workspaceId: string,
  filters: SourceFilters
): SQL => {
  const conditions: SQL[] = [eq(source.workspaceId, workspaceId)];

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const searchCondition = or(
      ilike(source.title, pattern),
      ilike(source.content, pattern),
      ilike(source.url, pattern)
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  if (filters.sourceType) {
    conditions.push(eq(source.sourceType, filters.sourceType));
  }

  if (filters.status) {
    conditions.push(eq(source.status, filters.status));
  }

  return and(...conditions)!;
};

const findSourcesByWorkspaceId = async (
  workspaceId: string,
  filters: SourceFilters
): Promise<Source[]> =>
  db
    .select()
    .from(source)
    .where(buildSourceConditions(workspaceId, filters))
    .orderBy(desc(source.createdAt))
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit);

const countSourcesByWorkspaceId = async (
  workspaceId: string,
  filters: SourceFilters
): Promise<number> => {
  const [result] = await db
    .select({ value: count() })
    .from(source)
    .where(buildSourceConditions(workspaceId, filters));

  return result?.value ?? 0;
};

const findSourceById = async (
  sourceId: string
): Promise<Source | undefined> => {
  const [result] = await db
    .select()
    .from(source)
    .where(eq(source.id, sourceId))
    .limit(1);

  return result;
};

const updateSourceRecord = async (
  sourceId: string,
  update: {
    status?: Source["status"];
    metadata?: SourceMetadata;
  }
): Promise<boolean> => {
  const [result] = await db
    .update(source)
    .set(update)
    .where(eq(source.id, sourceId))
    .returning({ id: source.id });

  return result !== undefined;
};

const updateSourceStatus = (
  sourceId: string,
  status: Source["status"]
): Promise<boolean> => updateSourceRecord(sourceId, { status });

const createSource = async (
  workspaceId: string,
  data: CreateSourceData
): Promise<Source> => {
  const [result] = await db
    .insert(source)
    .values({
      workspaceId,
      sourceType: data.sourceType,
      title: data.title,
      content: data.content,
      url: data.url ?? null,
      status: data.status ?? "pending",
      metadata: data.metadata ?? {},
    })
    .returning();

  if (!result) {
    throw new InternalServerError("Failed to create source");
  }

  return result;
};

const createWebsiteSource = (
  workspaceId: string,
  data: Omit<CreateSourceData, "sourceType">
): Promise<Source> =>
  createSource(workspaceId, { ...data, sourceType: "website" });

const createYouTubeSource = (
  workspaceId: string,
  data: Omit<CreateSourceData, "sourceType">
): Promise<Source> =>
  createSource(workspaceId, { ...data, sourceType: "yt_url" });

const deleteAllSourcesByWorkspaceId = async (
  workspaceId: string
): Promise<number> => {
  const deleted = await db
    .delete(source)
    .where(eq(source.workspaceId, workspaceId))
    .returning();

  return deleted.length;
};

const deleteSourceByWorkspaceIdAndId = async (
  workspaceId: string,
  sourceId: string
): Promise<Source | undefined> => {
  const [result] = await db
    .delete(source)
    .where(and(eq(source.workspaceId, workspaceId), eq(source.id, sourceId)))
    .returning();

  return result;
};

export default {
  findSourcesByWorkspaceId,
  countSourcesByWorkspaceId,
  findSourceById,
  updateSourceRecord,
  updateSourceStatus,
  createSource,
  createWebsiteSource,
  createYouTubeSource,
  deleteAllSourcesByWorkspaceId,
  deleteSourceByWorkspaceIdAndId,
};
