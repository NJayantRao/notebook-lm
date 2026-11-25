import { betterAuth, type Logger as BetterAuthLogger } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { ENV } from "../config/env.js";
import logger, { redact, sanitizeText } from "../config/logger.js";
import db from "../db/index.js";
import { account, session, user, verification } from "../db/schema.js";

const isHttps = ENV.BETTER_AUTH_URL.startsWith("https://");

// Better Auth uses a single log(level, message, ...args) callback rather than
// separate methods, so Winston needs a small adapter.
const authLogger: BetterAuthLogger = {
  level: ENV.LOG_LEVEL ?? "warn",
  log: (level, message, ...args) => {
    logger.log(level, "auth.provider", {
      message: sanitizeText(message),
      ...(args.length > 0 ? { details: redact(args) } : {}),
    });
  },
};

export const auth = betterAuth({
  baseURL: ENV.BETTER_AUTH_URL,
  secret: ENV.BETTER_AUTH_SECRET,
  trustedOrigins: [ENV.CLIENT_URL, "http://localhost:3000"],
  logger: authLogger,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  socialProviders: {
    google: {
      clientId: ENV.GOOGLE_CLIENT_ID,
      clientSecret: ENV.GOOGLE_CLIENT_SECRET,
    },
  },
  advanced: {
    // production only: cross-site cookies must be Secure
    defaultCookieAttributes: isHttps ? { sameSite: "none", secure: true } : {},
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
  },
  databaseHooks: {
    session: {
      create: {
        before: async () => {
          logger.info("auth.sign_in.started");
        },
        after: async (createdSession) => {
          // Never log the session token; the id is enough for correlation.
          logger.info("auth.sign_in.succeeded", {
            sessionId: createdSession.id,
            userId: createdSession.userId,
          });
        },
      },
    },
    user: {
      create: {
        after: async (createdUser) => {
          logger.info("auth.user.created", { userId: createdUser.id });
        },
      },
    },
  },
  onAPIError: {
    onError: async (error) => {
      logger.error("auth.sign_in.failed", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    },
  },
});
