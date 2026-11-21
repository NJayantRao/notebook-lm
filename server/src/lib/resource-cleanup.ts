import type { SourceMetadata } from "../types/source.js";
import { removeUploadedPdfByName } from "./multer.js";
import { deleteSourceVectors, deleteWorkspaceVectors } from "./pinecone.js";

export type SourceCleanupData = {
  id: string;
  workspaceId: string;
  metadata: SourceMetadata;
};

const tryCleanup = async (
  label: string,
  task: () => Promise<void>
): Promise<void> => {
  try {
    await task();
  } catch (error) {
    console.error(`Failed to clean up ${label}:`, error);
  }
};

const cleanupSourcePdf = async (source: SourceCleanupData): Promise<void> => {
  const storedFileName = source.metadata.storedFileName;
  if (typeof storedFileName !== "string" || !storedFileName.trim()) {
    return;
  }

  await removeUploadedPdfByName(storedFileName);
};

export const cleanupSourceResources = async (
  source: SourceCleanupData
): Promise<void> => {
  await tryCleanup(`vectors for source ${source.id}`, () =>
    deleteSourceVectors(source.workspaceId, source.id)
  );
  await tryCleanup(`PDF file for source ${source.id}`, () =>
    cleanupSourcePdf(source)
  );
};

export const cleanupWorkspaceResources = async (
  workspaceId: string,
  sources: Array<Pick<SourceCleanupData, "id" | "metadata">>
): Promise<void> => {
  await tryCleanup(`vectors for workspace ${workspaceId}`, () =>
    deleteWorkspaceVectors(workspaceId)
  );

  for (const source of sources) {
    await tryCleanup(`PDF file for source ${source.id}`, () =>
      cleanupSourcePdf({ ...source, workspaceId })
    );
  }
};
