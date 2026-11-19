import { ENV } from "../config/env.js";
import cors from "cors";

const corsMiddleware = cors({
  origin: ENV.CLIENT_URL,
  credentials: true,
  methods: ["POST", "GET", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Origin", "Authorization"],
});

export default corsMiddleware;