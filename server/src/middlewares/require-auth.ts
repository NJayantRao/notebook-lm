import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../lib/auth.js";
import { setRequestUserId } from "../lib/request-context.js";
import logger, { markLogged } from "../config/logger.js";
import ApiError, { UnauthorizedError } from "../utils/api-error.js";

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      logger.debug("auth.session.missing", { path: req.path });
      return next(new UnauthorizedError("Authentication required"));
    }

    req.user = session.user;
    req.session = session.session;
    setRequestUserId(session.user.id);

    next();
  } catch (error) {
    if (!(error instanceof ApiError)) {
      logger.error("auth.session.failed", { error, path: req.path });
      markLogged(error);
    }
    return next(error);
  }
};
