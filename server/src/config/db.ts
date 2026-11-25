import pg from "pg";

import { ENV } from "./env.js";
import { timed } from "./logger.js";

const { Pool } = pg;

async function connectToDb(): Promise<void> {
  const pool = new Pool({ connectionString: ENV.DATABASE_URL });

  try {
    await timed("database.connect", {}, () => pool.query("SELECT 1"));
  } finally {
    await pool.end();
  }
}

async function checkDatabaseConnection(): Promise<void> {
  const pool = new Pool({ connectionString: ENV.DATABASE_URL });

  try {
    await timed("database.health", {}, () => pool.query("SELECT 1"));
  } finally {
    await pool.end();
  }
}

export { connectToDb, checkDatabaseConnection };
