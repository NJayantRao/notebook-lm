import type { ErrorRequestHandler } from "express";

import logger, { wasLogged } from "../config/logger.js";
import { getRequestId } from "../lib/request-context.js";
import ApiError, {
  BadRequestError,
  InternalServerError,
  PayloadTooLargeError,
} from "../utils/api-error.js";

const errorMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = getRequestId();
  const method = req.method;
  const path = req.path; // never include the query string

  if (err instanceof ApiError) {
    if (!wasLogged(err)) {
      if (err.statusCode >= 500) {
        logger.error("http.error", {
          error: err,
          method,
          path,
          status: err.statusCode,
          code: err.code,
          requestId,
        });
      } else {
        logger.warn("http.error", {
          method,
          path,
          status: err.statusCode,
          code: err.code,
          requestId,
        });
      }
    }

    res.status(err.statusCode).json(err);
    return;
  }

  if (!wasLogged(err)) {
    logger.error("http.error", { error: err, method, path, requestId });
  }

  let error: ApiError;

  if (err?.status >= 400 && err?.status < 500) {
    if (err.type === "entity.parse.failed") {
      error = new BadRequestError("Malformed JSON request body", "INVALID_JSON");
    } else if (err.status === 413 || err.type === "entity.too.large") {
      error = new PayloadTooLargeError("Request payload is too large");
    } else {
      error = new BadRequestError("Invalid request");
    }
  } else {
    error = new InternalServerError("Internal Server Error");
  }

  res.status(error.statusCode).json(error);
};

export default errorMiddleware;
