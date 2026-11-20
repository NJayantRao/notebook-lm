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

export type Source = {
  id: string;
  workspaceId: string;
  sourceType: SourceType;
  title: string;
  content: string | null;
  url: string | null;
  status: SourceStatus;
  metadata: Record<string, unknown>;
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
