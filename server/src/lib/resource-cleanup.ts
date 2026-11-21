import type { SourceMetadata } from "../types/source.js";
import { removeUploadedPdfByName } from "./multer.js";
import { deleteSourceVectors, deleteWorkspaceVectors } from "./pinecone.js";

export type SourceCleanupData = {
  id: string;
  workspaceId: string;
  metadata: SourceMetadata;
};

const isMissingFile = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

const cleanupSourcePdf = async (source: SourceCleanupData): Promise<void> => {
  const storedFileName = source.metadata.storedFileName;
  if (typeof storedFileName !== "string" || !storedFileName.trim()) {
    return;
  }

  try {
    await removeUploadedPdfByName(storedFileName);
  } catch (error) {
    if (!isMissingFile(error)) {
      throw error;
    }
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
  sources: Array<Pick<SourceCleanupData, "id" | "metadata">>
): Promise<void> => {
  await deleteWorkspaceVectors(workspaceId);

  for (const source of sources) {
    await cleanupSourcePdf({ ...source, workspaceId });
  }
};
