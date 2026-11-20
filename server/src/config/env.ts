import dotenv from "dotenv";

dotenv.config();

const ENV = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL:
    process.env.DATABASE_URL || "postgresql://admin:admin@localhost:5432/admin",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY!,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_INDEX: process.env.PINECONE_INDEX,
};

export { ENV };
