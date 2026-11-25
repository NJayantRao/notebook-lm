import morgan from "morgan";
import type { RequestHandler } from "express";

import logger from "../config/logger.js";
import { getRequestId } from "../lib/request-context.js";

const isProduction = process.env.NODE_ENV === "production";

// Never logged.
const SKIPPED_PATHS = new Set(["/health", "/ready"]);
// Successful requests to these paths are logged at debug level.
const QUIET_PREFIXES = ["/api/inngest"];

const pathOf = (url: string | undefined): string =>
  (url ?? "").split("?")[0] ?? "";

const requestLogger: RequestHandler = morgan(
  (tokens, req, res) =>
    JSON.stringify({
      method: tokens.method?.(req, res) ?? "",
      path: pathOf(tokens.url?.(req, res)), // query string removed on purpose (OAuth codes)
      status: Number(tokens.status?.(req, res) ?? 0),
      durationMs: Number(tokens["response-time"]?.(req, res) ?? 0),
    }),
  {
    skip: (req) => {
      const path = pathOf(req.originalUrl ?? req.url);
      return (
        SKIPPED_PATHS.has(path) ||
        (req.method === "PUT" && path.startsWith("/api/inngest"))
      );
    },
    stream: {
      write: (line) => {
        try {
          const { method, path, status, durationMs } = JSON.parse(line) as {
            method: string;
            path: string;
            status: number;
            durationMs: number;
          };
          const quiet =
            QUIET_PREFIXES.some((prefix) => path.startsWith(prefix)) &&
            status < 400;
          const level =
            status >= 500
              ? "error"
              : status >= 400
                ? "warn"
                : quiet
                  ? "debug"
                  : "info";
          const requestId = getRequestId();

          logger.log(level, "http.request", {
            method,
            path,
            status,
            durationMs: Math.round(durationMs),
            ...(isProduction && requestId ? { requestId } : {}),
          });
        } catch {
          logger.info("http.request.unparsed");
        }
      },
    },
  }
);

export default requestLogger;
