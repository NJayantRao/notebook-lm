import { api, type ApiEnvelope } from "@/lib/api";

export async function addUserMemory(content: string): Promise<void> {
  const res = await api.post<ApiEnvelope<unknown>>("/api/memories", {
    content,
  });
  if (!res.data.success) {
    throw new Error(res.data.message || "Failed to add memory");
  }
}
