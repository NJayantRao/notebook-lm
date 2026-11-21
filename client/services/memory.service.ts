import { api, type ApiEnvelope } from "@/lib/api";

export type UserMemory = {
  id: string;
  memory?: string;
  data?: { memory?: string };
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type UserMemoriesPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: UserMemory[];
};

export async function addUserMemory(content: string): Promise<void> {
  const res = await api.post<ApiEnvelope<unknown>>("/api/memories", {
    content,
  });
  if (!res.data.success) {
    throw new Error(res.data.message || "Failed to add memory");
  }
}

export async function listMemories(
  page = 1,
  pageSize = 50
): Promise<UserMemoriesPage> {
  const res = await api.get<ApiEnvelope<UserMemoriesPage>>("/api/memories", {
    params: { page, pageSize },
  });
  return (
    res.data.data ?? { count: 0, next: null, previous: null, results: [] }
  );
}

export async function updateMemory(
  memoryId: string,
  text: string
): Promise<void> {
  const res = await api.patch<ApiEnvelope<unknown>>(
    `/api/memories/${encodeURIComponent(memoryId)}`,
    { text }
  );
  if (!res.data.success) {
    throw new Error(res.data.message || "Failed to update memory");
  }
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const res = await api.delete<ApiEnvelope<unknown>>(
    `/api/memories/${encodeURIComponent(memoryId)}`
  );
  if (!res.data.success) {
    throw new Error(res.data.message || "Failed to delete memory");
  }
}
