import { ENV } from "../config/env.js";
import cors from "cors";

const allowedOrigins = new Set([
  new URL(ENV.CLIENT_URL).origin,
  "http://localhost:3000",
]);

const corsMiddleware = cors({
  origin: (origin, callback) => {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ["POST", "GET", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Origin", "Authorization"],
});

export default corsMiddleware;
