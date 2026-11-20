import express, { type Express } from "express";
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
import { refreshUserMemoryFunction } from "./functions/refresh-user-memory.function.js";
import memoryRoutes from "./routes/memories.route.js";

const app: Express = express();

app.use(corsMiddleware);
app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json());

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [indexSourceFunction, refreshUserMemoryFunction],
  })
);

app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspace/:workspaceId", sourceRoutes);
app.use("/api/workspace/:workspaceId/conversations", conversationRoutes);
app.use("/api/memories", memoryRoutes);

app.get("/", (_req, res) => {
  res.send("Hello, World!");
});

app.use(errorMiddleware);

export default app;
