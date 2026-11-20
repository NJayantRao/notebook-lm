import express, { type Express } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import corsMiddleware from "./middlewares/cors.js";
import errorMiddleware from "./middlewares/error-handler.js";
import workspaceRoutes from "./routes/workspaces.route.js";
import sourceRoutes from "./routes/sources.route.js";

const app: Express = express();

app.use(corsMiddleware);
app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json());

app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspace/:workspaceId", sourceRoutes);

app.get("/", (_req, res) => {
  res.send("Hello, World!");
});

app.use(errorMiddleware);

export default app;
