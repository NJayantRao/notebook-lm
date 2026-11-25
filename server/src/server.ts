import type { Server } from "node:http";

import app from "./app.js";
import { connectToDb } from "./config/db.js";
import { ENV } from "./config/env.js";
import { connectToInngest } from "./config/inngest.js";
import logger from "./config/logger.js";
import { closeDb } from "./db/index.js";

const PORT = ENV.PORT;
let httpServer: Server | undefined;
let shuttingDown = false;

const shutdown = (signal: string): void => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info("server.shutdown.started", { signal });

  void (async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    }
    await closeDb();
    logger.info("server.shutdown.completed", { signal });
  })().catch((error: unknown) => {
    logger.error("server.shutdown.failed", { signal, error });
    process.exitCode = 1;
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  logger.error("process.uncaught_exception", { error });
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error("process.unhandled_rejection", {
    error: reason instanceof Error ? reason : new Error(String(reason)),
  });
  process.exit(1);
});

try {
  logger.info("server.starting", {
    port: PORT,
    nodeEnv: process.env.NODE_ENV ?? "development",
    nodeVersion: process.version,
  });

  const startedAt = performance.now();
  await connectToDb();
  logger.info("database.connected", {
    durationMs: Math.round(performance.now() - startedAt),
  });

  await connectToInngest();

  httpServer = app.listen(PORT, () => {
    logger.info("server.listening", { port: PORT });
  });
} catch (error) {
  logger.error("server.startup.failed", { error });
  process.exit(1);
}
