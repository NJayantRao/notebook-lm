import express, { type Express } from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import corsMiddleware from "./middlewares/cors.js";
import errorMiddleware from "./middlewares/error-handler.js";
import workspaceRoutes from "./routes/workspaces.route.js";
import sourceRoutes from "./routes/sources.route.js";
import conversationRoutes from "./routes/conversations.route.js";
import { inngest } from "./lib/inngest.js";
import { serve } from "inngest/express";
import { indexSourceFunction } from "./functions/index-source.function.js";
import { prepareSourceFunction } from "./functions/prepare-source.function.js";
import { refreshUserMemoryFunction } from "./functions/refresh-user-memory.function.js";
import {
  cleanupSourceVectorsFunction,
  cleanupWorkspaceNamespaceFunction,
} from "./functions/cleanup.function.js";
import memoryRoutes from "./routes/memories.route.js";
import { checkDatabaseConnection } from "./config/db.js";
import { NotFoundError } from "./utils/api-error.js";
import { requireAuth } from "./middlewares/require-auth.js";

const app: Express = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(corsMiddleware);
app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json({ limit: "1mb" }));

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [
      indexSourceFunction,
      prepareSourceFunction,
      refreshUserMemoryFunction,
      cleanupSourceVectorsFunction,
      cleanupWorkspaceNamespaceFunction,
    ],
  })
);

app.use("/api/workspaces", requireAuth);
app.use("/api/workspace", requireAuth);
app.use("/api/memories", requireAuth);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspace/:workspaceId/conversations", conversationRoutes);
app.use("/api/workspace/:workspaceId", sourceRoutes);
app.use("/api/memories", memoryRoutes);

app.get("/health", async (_req, res) => {
  await checkDatabaseConnection();
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.send("Hello, World!");
});

app.use((_req, res) => {
  res.status(404).json(new NotFoundError("Route not found"));
});

app.use(errorMiddleware);

export default app;
