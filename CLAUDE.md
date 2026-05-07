# rfi

Internal IPC tool for drafting RFI responses with an agent workflow. A user pastes/uploads RFI questions; agents extract, draft, and assemble a Markdown response that can be reviewed, commented on, assigned, and approved.

See [README.md](./README.md) for the architecture overview and build phases.

## Stack

- Next.js 16 (app router, Turbopack) + TypeScript + Tailwind 4
- Supabase — auth (magic link), Postgres, RLS
- `@openai/agents` (Agents SDK, TS) with MCP support
- Tavily for web search; `sn-docs` MCP for ServiceNow content
- `unpdf` + `mammoth` for PDF/DOCX ingestion
- `react-markdown` + `remark-gfm` for draft rendering
- Resend for transactional email
- Hosted on Vercel (planned)

## Structure

- `app/` — Next.js app router (auth pages, drafts pages, API routes)
- `app/auth/callback/` — magic-link redirect handler
- `lib/supabase/` — Supabase clients: `client.ts` (browser), `server.ts` (server), `middleware.ts` (proxy helper)
- `lib/ipc-profile.md` — IPC capability profile injected into agent system prompts; edit by PR
- `proxy.ts` — Next 16 proxy file (formerly `middleware.ts`); refreshes session + gates routes
- `_reference/` — local-only RFI examples (gitignored)

## Development

### Setup

```bash
pnpm install
cp .env.local.example .env.local   # fill keys; Supabase URL + publishable key are already populated
```

### Running

```bash
pnpm dev          # next dev (Turbopack)
```

App lives at http://localhost:3000.

### Verification

```bash
pnpm exec tsc --noEmit   # typecheck
pnpm lint                # eslint
pnpm build               # full build
```

For UI changes, start the dev server and exercise the feature in the browser before declaring a phase done. The Playwright MCP is available for that.

## Conventions

- **Proxy, not middleware.** Next 16 deprecated `middleware.ts`. The root file is `proxy.ts` and exports `proxy`. The session-refresh helper in `lib/supabase/middleware.ts` keeps the legacy name for parity with Supabase docs but is just a helper module.
- **Server-side Supabase client is async.** `createClient()` from `lib/supabase/server.ts` returns a Promise — always `await` it.
- **Auth gate.** `proxy.ts` redirects unauthenticated requests to `/login` (preserving `?next=`) and authenticated requests away from `/login`. `/login` and `/auth/*` are the public paths.
- **Domain restriction.** Sign-in is restricted to `@integritypro.com` both in the login server action (UX) and via a DB trigger on `auth.users` (hard gate). The allowed domain is env-configurable: `ALLOWED_EMAIL_DOMAIN`.
- **pnpm build allowlist.** `pnpm-workspace.yaml` sets `allowBuilds: { sharp: true, unrs-resolver: true }`. pnpm regenerates this block on install — don't strip it.

## Data model

Tables live in Supabase Postgres with RLS enabled:

- `profiles` — public mirror of `auth.users` (id, email, full_name)
- `drafts` — one row per RFI; `questions` JSONB carries `[{ index, text, status, content, sources }]`; statuses: `parsed | drafting | ready | in_review | approved`
- `comments` — anchored to `draft_id` and optionally `anchor_question_index`
- `assignments` — `reviewer | editor` role; `assignee_user_id` OR `assignee_email` (auto-claimed on signup)

The migration is in Supabase under the name `initial_schema`. Use the Supabase MCP (`list_tables`, `apply_migration`) for further changes.

## Agent architecture (in progress)

Three roles, each an `@openai/agents` Agent:

1. **Parser** — extracts the question list from raw RFI input. User confirms before drafting starts.
2. **Drafter** — runs once per question (parallel). Tools: `sn-docs` MCP, web search (Tavily), and any user-attached context. Produces answer + sources.
3. **Editor** — voice/tone harmonization across drafts; mutates `questions[].content` in place.

The IPC capability profile in `lib/ipc-profile.md` is loaded into the Drafter's system prompt to ground answers in IPC's actual capabilities.

## Useful pointers

- `.env.local.example` — the canonical list of environment variables and what each is for.
- `_reference/` — example RFI inputs/outputs (local only, gitignored).
- Supabase project: created via MCP — discover with `list_projects` if needed.
