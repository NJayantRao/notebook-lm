# Server

Express API for the NotebookLM clone. It uses Better Auth for sessions,
Drizzle with PostgreSQL for persistence, and Inngest for background work.

## Requirements

- Node.js 24 or newer
- pnpm 12.21.0 (declared in `package.json`)
- PostgreSQL 17 — the repository root has a `docker-compose.yml` for local use
- An Inngest dev server for local background jobs
- Google OAuth credentials
- API keys for Firecrawl, Tavily, and Mem0
- OpenAI and Pinecone credentials for chat, embeddings, and source indexing
- An S3 bucket (AWS S3 or an S3-compatible provider such as Neon Object
  Storage) for uploaded PDFs

## Local setup

From the repository root, start PostgreSQL:

```sh
docker compose up -d db
```

The local `docker-compose.yml` uses `admin` / `admin` with database `admin`, so
the matching local `DATABASE_URL` is
`postgresql://admin:admin@localhost:5432/admin`.

Then, from `server/`:

```sh
pnpm install
cp .env.example .env
pnpm exec drizzle-kit migrate
pnpm dev
```

The API defaults to `http://localhost:5000`. Apply schema changes with
`pnpm exec drizzle-kit migrate`; `drizzle-kit push` is also available for local
prototyping.

Run the Inngest dev server in a second terminal:

```sh
pnpm dlx inngest-cli@latest dev -u http://localhost:5000/api/inngest
```

`GET /health` checks the database connection. `GET /api/inngest` exposes the
registered functions to Inngest.

## Environment variables

Fill `server/.env` using `server/.env.example` as the key list. The server
validates the environment on startup and fails fast with a descriptive error if
a required value is missing or malformed.

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | No | Defaults to `5000`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `CLIENT_URL` | No | Deployed frontend origin. CORS and Better Auth also trust `http://localhost:3000`; defaults to that origin. |
| `BETTER_AUTH_URL` | No | Auth base URL; defaults to `http://localhost:5000`. |
| `BETTER_AUTH_SECRET` | Yes | At least 32 characters. |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret. |
| `FIRECRAWL_API_KEY` | Yes | Required at startup for website imports. |
| `TAVILY_API_KEY` | Yes | Required at startup for web search. |
| `MEM0_API_KEY` | Yes | Required at startup for memory refresh. |
| `OPENAI_API_KEY` | For chat/indexing | Embeddings and chat responses. |
| `PINECONE_API_KEY` | For indexing | Vector storage. |
| `PINECONE_INDEX` | For indexing | Dense-vector index name. |
| `AWS_REGION` | Yes | Region for the S3 client. |
| `S3_BUCKET` | Yes | Bucket that stores uploaded PDFs. |
| `AWS_ENDPOINT_URL_S3` | For S3-compatible providers | Custom endpoint; omit for AWS S3. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | No | Omit to use the AWS default credential chain (IAM roles). |
| `S3_KEY_PREFIX` | No | Optional key prefix; defaults to no prefix. |
| `S3_FORCE_PATH_STYLE` | No | Defaults to `true` when `AWS_ENDPOINT_URL_S3` is set; required by providers such as Neon Object Storage. |
| `S3_PUBLIC_BASE_URL` | No | CDN/public base URL used to build `metadata.fileUrl`. Without it the stored URL is `s3://<bucket>/<key>`. |

Configure the Google OAuth redirect URI as
`<BETTER_AUTH_URL>/api/auth/callback/google`.

### PDF object storage

Uploaded PDFs are streamed through multer's memory storage and written to S3 as
`[<S3_KEY_PREFIX>/]workspaces/<workspaceId>/pdfs/<uuid>.pdf`. The resulting key
is stored as `metadata.s3Key` and a canonical URL as `metadata.fileUrl`; no PDF
is written to the local filesystem. The bucket only needs `s3:PutObject`,
`s3:GetObject`, and `s3:DeleteObject` on that prefix.

Assume the bucket is private. `metadata.fileUrl` is an identifier, not a
publicly fetchable link; when a downloadable link is needed, use the
`getSignedPdfUrl` helper in `src/lib/s3.ts` to create a short-lived presigned
GET URL. Never persist presigned URLs in the database.

Never commit `.env`; only `.env.example` is tracked.

## Background work

Inngest functions are registered in `src/app.ts`:

- `source/prepare.requested` (`prepare-source`) scrapes websites, fetches
  YouTube transcripts, and extracts PDF text. It saves the prepared content,
  then enqueues indexing. Expensive preparation no longer runs inside the HTTP
  request.
- `source/index.requested` (`index-source`) splits text into chunks, stores
  them in PostgreSQL, and upserts documents to the workspace's Pinecone
  namespace. Pinecone embeds their `chunk_text` field using its integrated
  `text-embedding-3-small` model. It moves a source from
  `pending` through `processing` to `ready`; exhausted failures are marked
  `failed`.
- `conversation/memory.refresh.requested` (`refresh-user-memory`) updates Mem0
  memories after every 16 user messages.

The Pinecone index must have a document schema with an integrated
`text-embedding-3-small` `chunk_text` field and a `title` string field.

## Runtime behavior

- Authenticated API routes are mounted under `/api/workspaces`,
  `/api/workspace`, and `/api/memories`.
- Rate limits are in-memory and keyed per user: chat posts `30 / 10 minutes`,
  source imports/uploads `20 / hour`, and memory writes `60 / hour`. Responses
  include `RateLimit-*` headers and `Retry-After` on `429`.
- Deleting a source, all sources, or a workspace removes its Pinecone vectors
  and S3 objects after the database delete. Missing S3 objects are ignored and
  other cleanup failures are retried by Inngest; a failure to enqueue cleanup
  is logged but does not fail the delete request.
