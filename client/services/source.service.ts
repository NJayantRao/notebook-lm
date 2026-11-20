import { api, type ApiEnvelope } from "@/lib/api";
import type { Source, SourcesPage } from "@/lib/types";

export type ImportWebsiteSourceInput = {
  url: string;
  title?: string;
};

export type ImportYouTubeSourceInput = {
  url: string;
  title?: string;
};

export async function uploadPdfSource(
  workspaceId: string,
  file: File
): Promise<Source> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post<ApiEnvelope<Source>>(
    `/api/workspace/${workspaceId}/upload`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  if (!res.data.data) {
    throw new Error(res.data.message || "Failed to upload PDF");
  }
  return res.data.data;
}

export type ListSourcesParams = {
  search?: string;
  sourceType?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export async function listSources(
  workspaceId: string,
  params: ListSourcesParams = {}
): Promise<SourcesPage> {
  const res = await api.get<ApiEnvelope<SourcesPage>>(
    `/api/workspace/${workspaceId}`,
    { params }
  );
  return (
    res.data.data ?? {
      sources: [],
      pagination: {
        total: 0,
        page: 1,
        limit: params.limit ?? 20,
        totalPages: 0,
      },
    }
  );
}

export async function importWebsiteSource(
  workspaceId: string,
  input: ImportWebsiteSourceInput
): Promise<Source> {
  const res = await api.post<ApiEnvelope<Source>>(
    `/api/workspace/${workspaceId}/import/website`,
    input
  );
  if (!res.data.data) {
    throw new Error(res.data.message || "Failed to scrape website");
  }
  return res.data.data;
}

export async function importYouTubeSource(
  workspaceId: string,
  input: ImportYouTubeSourceInput
): Promise<Source> {
  const res = await api.post<ApiEnvelope<Source>>(
    `/api/workspace/${workspaceId}/import/youtube`,
    input
  );
  if (!res.data.data) {
    throw new Error(res.data.message || "Failed to get YouTube transcript");
  }
  return res.data.data;
}
