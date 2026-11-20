import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../lib/auth.js";
import { UnauthorizedError } from "../utils/api-error.js";

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
      return next(new UnauthorizedError("Authentication required"));
    }

    req.user = session.user;
    req.session = session.session;

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    return next(new UnauthorizedError("Authentication failed"));
  }
};
