'use client';

/**
 * Tiny client-side logger.
 *
 * Callers pass a short snake.dotted event name plus ids, lengths, counts,
 * statuses and durations. Never pass tokens, message text, document content,
 * emails, or full URLs with query strings.
 */

type LogMeta = Record<string, unknown>;
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isProduction = process.env.NODE_ENV === 'production';
const SENSITIVE_KEY = /password|secret|token|authorization|cookie|email|api[-_]?key|^code$|^state$/i;

const sanitize = (meta: LogMeta | undefined): LogMeta => {
  if (!meta) return {};
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[redacted]' : value,
    ])
  );
};

const write = (level: LogLevel, event: string, meta?: LogMeta): void => {
  if (isProduction && (level === 'debug' || level === 'info')) return;

  const prefix = level === 'warn' || level === 'error' ? '[app]' : '';
  const details = sanitize(meta);
  const args: unknown[] = prefix ? [prefix, event] : [event];
  if (Object.keys(details).length > 0) args.push(details);

  if (level === 'error') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  else if (level === 'info') console.info(...args);
  else console.debug(...args);
};

export const logger = {
  debug: (event: string, meta?: LogMeta) => write('debug', event, meta),
  info: (event: string, meta?: LogMeta) => write('info', event, meta),
  warn: (event: string, meta?: LogMeta) => write('warn', event, meta),
  error: (event: string, meta?: LogMeta) => write('error', event, meta),
};

export default logger;
