import { api, type ApiEnvelope } from "@/lib/api";
import type { Workspace, WorkspaceListItem } from "@/lib/types";

export type CreateWorkspaceInput = {
  title: string;
  description?: string | null;
  icon?: string | null;
  model?: string;
};

export async function listWorkspaces(): Promise<WorkspaceListItem[]> {
  const res = await api.get<ApiEnvelope<WorkspaceListItem[]>>("/api/workspaces");
  return res.data.data ?? [];
}

export async function createWorkspace(
  input: CreateWorkspaceInput
): Promise<Workspace> {
  const res = await api.post<ApiEnvelope<Workspace>>("/api/workspaces", input);
  if (!res.data.data) {
    throw new Error(res.data.message || "Failed to create workspace");
  }
  return res.data.data;
}

export async function getWorkspaceById(
  workspaceId: string
): Promise<Workspace> {
  const res = await api.get<ApiEnvelope<Workspace>>(
    `/api/workspaces/${workspaceId}`
  );
  if (!res.data.data) {
    throw new Error(res.data.message || "Workspace not found");
  }
  return res.data.data;
}

export async function deleteWorkspace(workspaceId: string): Promise<Workspace> {
  const res = await api.delete<ApiEnvelope<Workspace>>(
    `/api/workspaces/${workspaceId}`
  );
  if (!res.data.data) {
    throw new Error(res.data.message || "Failed to delete workspace");
  }
  return res.data.data;
}
