import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { ENV } from "../config/env.js";

const db = drizzle(ENV.DATABASE_URL);

export default db;
