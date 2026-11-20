import pg from "pg";
import { ENV } from "./env.js";

const { Pool } = pg;

async function connectToDb(): Promise<void> {
  const pool = new Pool({ connectionString: ENV.DATABASE_URL });

  try {
    await pool.query("SELECT 1");
    console.log("✅✅ Database connected successfully");
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

export { connectToDb };
