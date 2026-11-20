import { api, type ApiEnvelope } from "@/lib/api";
import type { SourcesPage } from "@/lib/types";

export type ListSourcesParams = {
  search?: string;
  sourceType?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export async function listSources(
  workspaceId: string,
  params: ListSourcesParams = {},
): Promise<SourcesPage> {
  const res = await api.get<ApiEnvelope<SourcesPage>>(
    `/api/workspace/${workspaceId}`,
    { params },
  );
  return (
    res.data.data ?? {
      sources: [],
      pagination: { total: 0, page: 1, limit: params.limit ?? 20, totalPages: 0 },
    }
  );
}
