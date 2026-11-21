export class TimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

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
