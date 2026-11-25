import logger from "../config/logger.js";

export class TimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

export const isTimeoutError = (error: unknown): boolean =>
  error instanceof TimeoutError ||
  (error instanceof Error &&
    /timed?\s*out|timeout|etimedout/i.test(error.message));

/**
 * Logs a degraded provider call at warn when it timed out. Returns true when a
 * timeout was logged so callers can avoid logging the same failure again.
 */
export const logProviderTimeout = (
  provider: string,
  operation: string,
  timeoutMs: number,
  error: unknown
): boolean => {
  if (!isTimeoutError(error)) {
    return false;
  }

  logger.warn("provider.timeout", {
    provider,
    operation,
    timeoutMs,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return true;
};

// Wraps SDK calls that do not expose a timeout option. The underlying promise
// is intentionally not cancelled; the caller simply stops waiting for it.
export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new TimeoutError(label, timeoutMs)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};
