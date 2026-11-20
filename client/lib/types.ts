export type Workspace = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  icon: string | null;
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type SourceType = "text" | "markdown" | "pdf" | "website" | "yt_url";
export type SourceStatus = "pending" | "processing" | "failed" | "ready";

export type SourceMetadata = {
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
  [key: string]: unknown;
};

export type Source = {
  id: string;
  workspaceId: string;
  sourceType: SourceType;
  title: string;
  content: string | null;
  url: string | null;
  status: SourceStatus;
  metadata: SourceMetadata;
  createdAt: string;
  updatedAt: string;
};

export type SourcesPagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type SourcesPage = {
  sources: Source[];
  pagination: SourcesPagination;
};

type WorkspaceCitation = {
  number: number;
  sourceId: string;
  title: string;
  sourceType: SourceType;
  url: string | null;
  chunkIndex: number;
  excerpt: string;
  score?: number;
};

type WebCitation = {
  number: number;
  title: string;
  sourceType: "web";
  url: string;
  excerpt: string;
  score?: number;
};

export type ConversationCitation = WorkspaceCitation | WebCitation;

export type ConversationMessage = {
  id: string;
  conversationId: string;
  sequence: number;
  role: "user" | "assistant";
  content: string;
  sources: ConversationCitation[];
  createdAt: string;
};

export type Conversation = {
  id: string;
  workspaceId: string;
  title: string | null;
  summary: string | null;
  summaryMessageCount: number;
  summarizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: ConversationMessage[];
};
