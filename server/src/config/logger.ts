import { createLogger, format, transports } from "winston";

import { ENV } from "./env.js";
import { getRequestContext } from "../lib/request-context.js";

const { combine, timestamp, json, colorize, printf, errors } = format;

const level = ENV.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

// Correlation fields are attached to every entry emitted while handling a request.
const requestContextFormat = format((info) => {
  const context = getRequestContext();
  if (context?.requestId && info.requestId === undefined) {
    info.requestId = context.requestId;
  }
  if (context?.userId && info.userId === undefined) {
    info.userId = context.userId;
  }
  return info;
});

// SDK errors sometimes embed request URLs or headers. Strip query strings and
// credential-shaped values before they reach a log sink.
export const sanitizeText = (text: string): string =>
  text
    .replace(/\b(https?:\/\/[^\s?)"']+)\?[^\s"']*/gi, "$1?[redacted]")
    .replace(/\b(bearer\s+)[^\s"']+/gi, "$1[redacted]")
    .replace(
      /\b(api[-_]?key|token|secret|password|authorization|cookie)\s*[:=]\s*[^\s,;"']+/gi,
      "$1=[redacted]"
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");

// Turns an Error passed as `{ error }` into plain, loggable fields.
const serializeError = format((info) => {
  if (info.error instanceof Error) {
    info.error = {
      name: info.error.name,
      message: sanitizeText(info.error.message),
      stack: info.error.stack,
    };
  }
  return info;
});

// Development: readable, coloured, one block per entry.
const devFormat = combine(
  errors({ stack: true }),
  serializeError(),
  requestContextFormat(),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  colorize({ level: true }),
  printf(({ timestamp, level, message, stack, error, ...meta }) => {
    const errorDetails = error as
      | { name?: string; message?: string; stack?: string }
      | undefined;
    const stackText = stack ?? errorDetails?.stack;
    const extra = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    const errorText = errorDetails
      ? ` [${errorDetails.name ?? "Error"}: ${errorDetails.message ?? ""}]`
      : "";
    return `${level}: ${message}${errorText}${extra}${stackText ? `\n${stackText}` : ""} ${timestamp}`;
  })
);

// Production: structured JSON lines on stdout (Render captures stdout).
const prodFormat = combine(
  errors({ stack: true }),
  serializeError(),
  requestContextFormat(),
  timestamp(),
  json()
);

const logger = createLogger({
  level,
  transports: [
    new transports.Console({
      format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
      // server.ts installs explicit handlers so process failures are logged once.
      handleExceptions: false,
      handleRejections: false,
    }),
    // Optional file output, off by default (Render's disk is not persistent).
    ...(process.env.LOG_TO_FILE === "true"
      ? [
          new transports.File({
            filename: "app.log",
            format: prodFormat, // no colours in files
            maxsize: 5 * 1024 * 1024,
            maxFiles: 3,
          }),
        ]
      : []),
  ],
});

/**
 * Runs an operation and logs its success with a duration. Failures are
 * intentionally not logged here: callers log them where they are handled so a
 * single failure never produces two entries.
 */
export const timed = async <T>(
  event: string,
  meta: Record<string, unknown>,
  operation: () => Promise<T>
): Promise<T> => {
  const startedAt = performance.now();
  const result = await operation();
  logger.info(event, {
    ...meta,
    durationMs: Math.round(performance.now() - startedAt),
  });
  return result;
};

const SENSITIVE_KEY_PATTERN =
  /password|secret|token|authorization|cookie|email|api[-_]?key|^code$|^state$/i;

const redactValue = (value: unknown, seen: WeakMap<object, unknown>): unknown => {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (value instanceof Error || value instanceof Date) {
    return value;
  }

  const cached = seen.get(value);
  if (cached) {
    return cached;
  }

  if (Array.isArray(value)) {
    const result: unknown[] = [];
    seen.set(value, result);
    for (const item of value) {
      result.push(redactValue(item, seen));
    }
    return result;
  }

  const result: Record<string, unknown> = {};
  seen.set(value, result);
  for (const [key, item] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? "[redacted]"
      : redactValue(item, seen);
  }
  return result;
};

/** Returns a copy of metadata with sensitive keys masked. */
export const redact = <T>(value: T): T =>
  redactValue(value, new WeakMap()) as T;

const loggedErrors = new WeakSet<object>();

/** Marks an error as logged so outer layers can avoid logging it again. */
export const markLogged = (error: unknown): void => {
  if (typeof error === "object" && error !== null) {
    loggedErrors.add(error);
  }
};

export const wasLogged = (error: unknown): boolean =>
  typeof error === "object" && error !== null && loggedErrors.has(error);

export default logger;
