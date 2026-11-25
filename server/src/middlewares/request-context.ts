import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { runWithRequestContext } from "../lib/request-context.js";

const MAX_REQUEST_ID_LENGTH = 100;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

const resolveRequestId = (value: unknown): string => {
  if (typeof value === "string") {
    const candidate = value.trim();
    if (
      candidate.length > 0 &&
      candidate.length <= MAX_REQUEST_ID_LENGTH &&
      REQUEST_ID_PATTERN.test(candidate)
    ) {
      return candidate;
    }
  }

  return randomUUID();
};

export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = resolveRequestId(req.header("x-request-id"));
  res.setHeader("x-request-id", requestId);
  runWithRequestContext({ requestId }, () => next());
};

export default requestContextMiddleware;
