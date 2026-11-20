# Server

## Source indexing

Text, Markdown, website, PDF, and YouTube transcript sources are saved with
`pending` status and queued through Inngest. The indexing function splits them
into 800-token chunks with 100-token overlap, stores each chunk in PostgreSQL,
embeds it with OpenAI `text-embedding-3-small` at 1532 dimensions, and upserts
the vectors to the configured Pinecone index. Website Markdown uses
Markdown-aware splitting; PDF extracted text uses the default recursive text
splitter. Each workspace uses its own Pinecone namespace. Successful sources
move through `processing` to `ready`; exhausted indexing failures are marked
`failed`.

Configure `OPENAI_API_KEY`, `PINECONE_API_KEY`, and `PINECONE_INDEX` in
`server/.env`. The Pinecone index must be a dense-vector index with 1532
dimensions.

For local development, run the API with `pnpm dev` and run the Inngest dev
server in a second terminal:

```sh
pnpm dlx inngest-cli@latest dev -u http://localhost:5000/api/inngest
```
