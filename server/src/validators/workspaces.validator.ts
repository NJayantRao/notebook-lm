import { z } from "zod";

const workspaceFields = {
  title: z.string().trim().min(1, "Title cannot be empty").max(120),
  description: z.string().max(500).nullable(),
  icon: z.string().max(8).nullable(),
  model: z.enum(["gpt-4o-mini"]),
};

export const createWorkspaceSchema = z
  .object({
    title: workspaceFields.title,
    description: workspaceFields.description.optional(),
    icon: workspaceFields.icon.optional(),
    model: workspaceFields.model.optional(),
  })
  .strict();

export const updateWorkspaceSchema = z
  .object({
    title: workspaceFields.title.optional(),
    description: workspaceFields.description.optional(),
    icon: workspaceFields.icon.optional(),
    model: workspaceFields.model.optional(),
  })
  .strict()
  .refine(
    (workspace) =>
      Object.values(workspace).some((value) => value !== undefined),
    {
      message: "At least one workspace field must be provided",
    }
  );

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
