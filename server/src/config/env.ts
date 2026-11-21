import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalApiKey = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional()
);

const envSchema = z.object({
  PORT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(5000)
  ),
  DATABASE_URL: z.url(),
  CLIENT_URL: z.url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().trim().min(32),
  BETTER_AUTH_URL: z.url().default("http://localhost:5000"),
  GOOGLE_CLIENT_ID: z.string().trim().min(1),
  GOOGLE_CLIENT_SECRET: z.string().trim().min(1),
  FIRECRAWL_API_KEY: z.string().trim().min(1),
  TAVILY_API_KEY: z.string().trim().min(1),
  MEM0_API_KEY: z.string().trim().min(1),
  OPENAI_API_KEY: optionalApiKey,
  PINECONE_API_KEY: optionalApiKey,
  PINECONE_INDEX: optionalApiKey,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const ENV = parsed.data;
