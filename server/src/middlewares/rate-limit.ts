import type { NextFunction, Request, Response } from "express";

import logger from "../config/logger.js";
import { TooManyRequestsError } from "../utils/api-error.js";

type RateBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  name: string;
  windowMs: number;
  limit: number;
  message: string;
  code: string;
};

const buckets = new Map<string, RateBucket>();

const sweepExpiredBuckets = (now: number) => {
  if (buckets.size < 1000) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

export const createRateLimiter = ({
  name,
  windowMs,
  limit,
  message,
  code,
}: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return next();
    }

    const now = Date.now();
    const key = `${name}:${userId}`;
    sweepExpiredBuckets(now);

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    const resetSeconds = Math.ceil(bucket.resetAt / 1000);
    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (bucket.count >= limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000)
      );
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader("Retry-After", String(retryAfterSeconds));
      logger.warn("rate_limit.exceeded", {
        userId,
        bucket: name,
        route: req.path,
        limit,
        retryAfterSeconds,
      });
      return next(new TooManyRequestsError(message, code));
    }

    bucket.count += 1;
    res.setHeader("RateLimit-Remaining", String(limit - bucket.count));
    return next();
  };
};

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
export const chatRateLimit = createRateLimiter({
  name: "chat",
  windowMs: TEN_MINUTES,
  limit: 30,
  message: "Too many chat requests. Please wait a few minutes and try again.",
  code: "CHAT_RATE_LIMIT_EXCEEDED",
});

export const sourceRateLimit = createRateLimiter({
  name: "source",
  windowMs: ONE_HOUR,
  limit: 20,
  message: "Too many source requests. Please try again later.",
  code: "SOURCE_RATE_LIMIT_EXCEEDED",
});

export const memoryRateLimit = createRateLimiter({
  name: "memory",
  windowMs: ONE_HOUR,
  limit: 60,
  message: "Too many memory requests. Please try again later.",
  code: "MEMORY_RATE_LIMIT_EXCEEDED",
});

export const artifactRateLimit = createRateLimiter({
  name: "artifact",
  windowMs: ONE_HOUR,
  limit: 60,
  message: "Too many artifact requests. Please try again later.",
  code: "ARTIFACT_RATE_LIMIT_EXCEEDED",
});
