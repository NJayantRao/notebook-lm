export type SourceMetadata = Record<string, unknown> & {
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  publicId?: string;
  resourceType?: "raw" | "image";
  importedFrom?: string;
  videoId?: string;
  processingError?: string;
  chunkCount?: number;
  pageCount?: number;
  indexedAt?: string;
};
