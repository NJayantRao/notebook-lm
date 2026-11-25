import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { ENV } from "../config/env.js";
import { relations } from "./schema.js";

const db = drizzle(ENV.DATABASE_URL, { relations });

export const closeDb = (): Promise<void> => db.$client.end();

export default db;
