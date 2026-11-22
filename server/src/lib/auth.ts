import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { ENV } from "../config/env.js";
import db from "../db/index.js";
import { account, session, user, verification } from "../db/schema.js";

export const auth = betterAuth({
  baseURL: ENV.BETTER_AUTH_URL,
  secret: ENV.BETTER_AUTH_SECRET,
  trustedOrigins: [ENV.CLIENT_URL, "http://localhost:3000"],
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
});
