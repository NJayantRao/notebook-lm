import { and, desc, eq } from "drizzle-orm";

import { InternalServerError } from "../utils/api-error.js";
import db from "../db/index.js";
import { workspace } from "../db/schema.js";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from "../validators/workspaces.validator.js";

type Workspace = typeof workspace.$inferSelect;

const findWorkspacesByUserId = async (userId: string): Promise<Workspace[]> =>
  db
    .select()
    .from(workspace)
    .where(eq(workspace.userId, userId))
    .orderBy(desc(workspace.createdAt));

const findWorkspaceByIdAndUserId = async (
  workspaceId: string,
  userId: string,
): Promise<Workspace | undefined> => {
  const [result] = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.id, workspaceId), eq(workspace.userId, userId)))
    .limit(1);

  return result;
};

const createWorkspace = async (
  userId: string,
  data: CreateWorkspaceInput,
): Promise<Workspace> => {
  const [result] = await db
    .insert(workspace)
    .values({
      userId,
      title: data.title,
      description: data.description ?? null,
      icon: data.icon ?? null,
      model: data.model ?? "openai-4o-mini",
    })
    .returning();

  if (!result) {
    throw new InternalServerError("Failed to create workspace");
  }

  return result;
};

const updateWorkspace = async (
  workspaceId: string,
  userId: string,
  data: UpdateWorkspaceInput,
): Promise<Workspace | undefined> => {
  const [result] = await db
    .update(workspace)
    .set(data)
    .where(and(eq(workspace.id, workspaceId), eq(workspace.userId, userId)))
    .returning();

  return result;
};

const deleteWorkspace = async (
  workspaceId: string,
  userId: string,
): Promise<Workspace | undefined> => {
  const [result] = await db
    .delete(workspace)
    .where(and(eq(workspace.id, workspaceId), eq(workspace.userId, userId)))
    .returning();

  return result;
};

export default {
  findWorkspacesByUserId,
  findWorkspaceByIdAndUserId,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
};
