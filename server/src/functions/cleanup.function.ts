import { inngest } from "../lib/inngest.js";
import {
  cleanupSourceResources,
  cleanupWorkspaceResources,
  type SourceCleanupData,
} from "../lib/resource-cleanup.js";
import type { SourceMetadata } from "../types/source.js";

type SourceCleanupEvent = {
  workspaceId: string;
  sources: SourceCleanupData[];
};

type WorkspaceCleanupEvent = {
  workspaceId: string;
  sources: Array<{ id: string; sourceType?: string; metadata: SourceMetadata }>;
};

const requireSourceCleanupEvent = (data: unknown): SourceCleanupEvent => {
  if (
    typeof data !== "object" ||
    data === null ||
    !("workspaceId" in data) ||
    typeof data.workspaceId !== "string" ||
    !("sources" in data) ||
    !Array.isArray(data.sources)
  ) {
    throw new Error("The source cleanup event is invalid.");
  }

  return data as SourceCleanupEvent;
};

const requireWorkspaceCleanupEvent = (data: unknown): WorkspaceCleanupEvent => {
  if (
    typeof data !== "object" ||
    data === null ||
    !("workspaceId" in data) ||
    typeof data.workspaceId !== "string" ||
    !("sources" in data) ||
    !Array.isArray(data.sources)
  ) {
    throw new Error("The workspace cleanup event is invalid.");
  }

  return data as WorkspaceCleanupEvent;
};

export const cleanupSourceVectorsFunction = inngest.createFunction(
  {
    id: "cleanup-source-vectors",
    retries: 3,
    triggers: [{ event: "source/vectors.cleanup" }],
  },
  async ({ event, step }) => {
    const { sources } = requireSourceCleanupEvent(event.data);

    await step.run("delete-source-resources", async () => {
      for (const source of sources) {
        await cleanupSourceResources(source);
      }
    });

    return { cleanedSources: sources.length };
  }
);

export const cleanupWorkspaceNamespaceFunction = inngest.createFunction(
  {
    id: "cleanup-workspace-namespace",
    retries: 3,
    triggers: [{ event: "workspace/namespace.cleanup" }],
  },
  async ({ event, step }) => {
    const { workspaceId, sources } = requireWorkspaceCleanupEvent(event.data);

    await step.run("delete-workspace-resources", () =>
      cleanupWorkspaceResources(workspaceId, sources)
    );

    return { workspaceId, cleanedSources: sources.length };
  }
);
