import type { SourceMetadata } from "../types/source.js";
import { deleteArtifactPrefix, deletePdf, S3ObjectNotFoundError } from "./s3.js";
import { deleteSourceVectors, deleteWorkspaceVectors } from "./pinecone.js";

export type SourceCleanupData = {
  id: string;
  workspaceId: string;
  sourceType?: string;
  metadata: SourceMetadata;
};

const cleanupSourcePdf = async (source: SourceCleanupData): Promise<void> => {
  if (source.sourceType !== "pdf") {
    return;
  }

  const s3Key = source.metadata.s3Key;
  if (typeof s3Key !== "string" || !s3Key.trim()) {
    return;
  }

  try {
    await deletePdf(s3Key);
  } catch (error) {
    if (error instanceof S3ObjectNotFoundError) {
      return;
    }
    throw error;
  }
};

// These helpers are only called from Inngest cleanup functions. Errors are
// intentionally propagated so Inngest can retry the cleanup.
export const cleanupSourceResources = async (
  source: SourceCleanupData
): Promise<void> => {
  await deleteSourceVectors(source.workspaceId, source.id);
  await cleanupSourcePdf(source);
};

export const cleanupWorkspaceResources = async (
  workspaceId: string,
  sources: Array<Pick<SourceCleanupData, "id" | "sourceType" | "metadata">>
): Promise<void> => {
  await deleteWorkspaceVectors(workspaceId);

  for (const source of sources) {
    await cleanupSourcePdf({ ...source, workspaceId });
  }
};

/** Removes every generated-audio object under a deleted workspace. */
export const cleanupArtifactResources = async (
  workspaceId: string
): Promise<number> => deleteArtifactPrefix(workspaceId);
