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
| `CLIENT_URL` | No | Trusted browser origin; defaults to `http://localhost:3000`. |
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

Configure the Google OAuth redirect URI as
`<BETTER_AUTH_URL>/api/auth/callback/google`.

Never commit `.env`; only `.env.example` is tracked.

## Background work

Inngest functions are registered in `src/app.ts`:

- `source/prepare.requested` (`prepare-source`) scrapes websites, fetches
  YouTube transcripts, and extracts PDF text. It saves the prepared content,
  then enqueues indexing. Expensive preparation no longer runs inside the HTTP
  request.
- `source/index.requested` (`index-source`) splits text into 800-token chunks
  with 100-token overlap, stores them in PostgreSQL, embeds them with OpenAI
  `text-embedding-3-small` at 1532 dimensions, and upserts vectors to the
  workspace's Pinecone namespace. It moves a source from `pending` through
  `processing` to `ready`; exhausted failures are marked `failed`.
- `conversation/memory.refresh.requested` (`refresh-user-memory`) updates Mem0
  memories after every 16 user messages.

The Pinecone index must be a dense-vector index with 1532 dimensions.

## Runtime behavior

- Authenticated API routes are mounted under `/api/workspaces`,
  `/api/workspace`, and `/api/memories`.
- Rate limits are in-memory and keyed per user: chat posts `30 / 10 minutes`,
  source imports/uploads `20 / hour`, and memory writes `60 / hour`. Responses
  include `RateLimit-*` headers and `Retry-After` on `429`.
- Deleting a source, all sources, or a workspace removes its Pinecone vectors
  and stored PDFs after the database delete. External cleanup failures are
  logged but do not fail the delete.
