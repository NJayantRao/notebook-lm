# Client

Next.js 16 frontend for the NotebookLM clone. It uses Better Auth for sessions
and TanStack Query for server state.

## Requirements

- Node.js 24 or newer (matches the server toolchain)
- pnpm 12.21.0 (declared in `package.json`)
- A running API server; see `../server/README.md`

## Local setup

From `client/`:

```sh
pnpm install
```

Create `client/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_AUTH_URL=http://localhost:5000
```

`NEXT_PUBLIC_API_URL` is used for API calls. `NEXT_PUBLIC_AUTH_URL` is used by
the Better Auth client and falls back to `NEXT_PUBLIC_API_URL`. Set both to the
server origin so browser requests do not go to the Next.js origin.

Start the app:

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `pnpm dev` — start the development server
- `pnpm build` — production build
- `pnpm start` — serve the production build
- `pnpm lint` — run ESLint

## Notes

- The API and auth routes are protected server-side. Client route guards are
  UX-only and are not a security boundary.
- Source status is polled while `pending` or `processing`; website scraping,
  YouTube transcript retrieval, and PDF extraction run in Inngest jobs and are
  not part of the upload request.
