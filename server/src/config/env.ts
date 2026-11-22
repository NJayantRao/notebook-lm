import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalApiKey = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional()
);

const optionalBoolean = z.preprocess(
  (value) => {
    if (value === "" || value === undefined) return undefined;
    if (value === true || value === "1" || value === "true") return true;
    if (value === false || value === "0" || value === "false") return false;
    return value;
  },
  z.boolean().optional()
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
  TAVILY_API_KEY: optionalApiKey,
  MEM0_API_KEY: optionalApiKey,
  OPENAI_API_KEY: optionalApiKey,
  PINECONE_API_KEY: optionalApiKey,
  PINECONE_INDEX: optionalApiKey,
  AWS_ENDPOINT_URL_S3: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url().optional()
  ),
  AWS_ACCESS_KEY_ID: optionalApiKey,
  AWS_SECRET_ACCESS_KEY: optionalApiKey,
  AWS_REGION: z.string().trim().min(1),
  S3_BUCKET: z.string().trim().min(1),
  S3_KEY_PREFIX: optionalApiKey,
  S3_FORCE_PATH_STYLE: optionalBoolean,
  S3_PUBLIC_BASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url().optional()
  ),
  INNGEST_DEV: optionalBoolean,
  INNGEST_SIGNING_KEY: optionalApiKey,
  INNGEST_EVENT_KEY: optionalApiKey,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const ENV = parsed.data;
