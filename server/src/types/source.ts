export type SourceMetadata = Record<string, unknown> & {
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  storedFileName?: string;
  s3Key?: string;
  publicId?: string;
  resourceType?: "raw" | "image";
  importedFrom?: string;
  videoId?: string;
  processingError?: string;
  chunkCount?: number;
  pageCount?: number;
  transcriptStarts?: number[];
  indexedAt?: string;
};
