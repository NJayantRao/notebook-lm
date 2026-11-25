import logger from "../config/logger.js";
import { inngest } from "../lib/inngest.js";
import {
  cleanupArtifactResources,
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
    onFailure: async ({ event, error }) => {
      const { workspaceId, sources } = requireSourceCleanupEvent(
        event.data.event.data
      );
      logger.error("cleanup.vectors.failed", {
        workspaceId,
        count: sources.length,
        error,
      });
    },
  },
  async ({ event, step, attempt, runId }) => {
    const { workspaceId, sources } = requireSourceCleanupEvent(event.data);

    await step.run("delete-source-resources", async () => {
      logger.info("cleanup.vectors.started", {
        workspaceId,
        count: sources.length,
        attempt,
        runId,
      });
      for (const source of sources) {
        await cleanupSourceResources(source);
      }
      logger.info("cleanup.vectors.completed", {
        workspaceId,
        count: sources.length,
        attempt,
        runId,
      });
    });

    return { cleanedSources: sources.length };
  }
);

export const cleanupWorkspaceNamespaceFunction = inngest.createFunction(
  {
    id: "cleanup-workspace-namespace",
    retries: 3,
    triggers: [{ event: "workspace/namespace.cleanup" }],
    onFailure: async ({ event, error }) => {
      const { workspaceId, sources } = requireWorkspaceCleanupEvent(
        event.data.event.data
      );
      logger.error("cleanup.namespace.failed", {
        workspaceId,
        count: sources.length,
        error,
      });
    },
  },
  async ({ event, step, attempt, runId }) => {
    const { workspaceId, sources } = requireWorkspaceCleanupEvent(event.data);

    await step.run("delete-workspace-resources", async () => {
      logger.info("cleanup.namespace.started", {
        workspaceId,
        count: sources.length,
        attempt,
        runId,
      });
      const result = await cleanupWorkspaceResources(workspaceId, sources);
      logger.info("cleanup.namespace.completed", {
        workspaceId,
        count: sources.length,
        attempt,
        runId,
        result,
      });
      return result;
    });

    return { workspaceId, cleanedSources: sources.length };
  }
);

const requireWorkspaceId = (data: unknown): string => {
  if (
    typeof data !== "object" ||
    data === null ||
    !("workspaceId" in data) ||
    typeof data.workspaceId !== "string" ||
    !data.workspaceId.trim()
  ) {
    throw new Error("The artifact cleanup event is invalid.");
  }

  return data.workspaceId.trim();
};

export const cleanupArtifactsFunction = inngest.createFunction(
  {
    id: "cleanup-artifacts",
    retries: 3,
    triggers: [{ event: "workspace/artifacts.cleanup" }],
    onFailure: async ({ event, error }) => {
      let workspaceId = "unknown";
      try {
        workspaceId = requireWorkspaceId(event.data.event.data);
      } catch {
        // Keep the placeholder id when the event itself is malformed.
      }
      logger.error("cleanup.artifacts.failed", { workspaceId, error });
    },
  },
  async ({ event, step, attempt, runId }) => {
    const workspaceId = requireWorkspaceId(event.data);

    const deletedCount = await step.run("delete-artifact-prefix", async () => {
      logger.info("cleanup.artifacts.started", {
        workspaceId,
        attempt,
        runId,
      });
      const count = await cleanupArtifactResources(workspaceId);
      logger.info("cleanup.artifacts.completed", {
        workspaceId,
        attempt,
        runId,
        deletedCount: count,
      });
      return count;
    });

    return { workspaceId, deletedCount };
  }
);
