# R4

Internal IPC tool for drafting RFx responses (RFI / RFP / RFQ / RFB) with an agent workflow. RFI is the current focus. A user pastes/uploads an RFI; agents extract topics + ServiceNow scope, plan + research + synthesize a capability map per topic, and (after architect review) draft + harmonize a Markdown response that can be reviewed, commented on, assigned, and approved.

See [README.md](./README.md) for the architecture overview. The active build plan lives at `.claude/plans/phases.md` (local-only).

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
- `app/api/drafts/[id]/draft/` — SSE route that runs all Drafters + Editor for a fresh draft
- `app/api/drafts/[id]/questions/[index]/draft/` — SSE route for per-question regenerate (with optional reviewer feedback)
- `app/auth/callback/` — magic-link redirect handler
- `lib/agents/` — Agent definitions: `parser.ts`, `drafter.ts`, `editor.ts`; tool wrappers under `lib/agents/tools/`
- `lib/supabase/` — Supabase clients: `client.ts` (browser), `server.ts` (server), `middleware.ts` (proxy helper)
- `lib/ipc-profile.md` — IPC capability profile injected into agent system prompts; edit by PR
- `proxy.ts` — Next 16 proxy file (formerly `middleware.ts`); refreshes session + gates routes
- `scripts/` — local diagnostic scripts (`diag-mcp.ts`, `diag-drafter.ts`); run with `pnpm dlx tsx --env-file=.env.local scripts/<name>.ts`
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
- **SSE handlers keep running after the client disconnects.** This is intentional: long Drafter/Editor runs should complete server-side even if the user navigates away. Do **not** tie an `AbortController` to a React effect cleanup — React 19 StrictMode double-invokes effects in dev and will cancel every fetch immediately. See `app/drafts/[id]/draft-runner.tsx`.
- **MCP tool budgets via `RunContext`.** To bound how many times the agent can call a specific tool per run, wrap it as a `tool()`, store the counter on `RunContext.context`, and pass `{ context: { ... } }` to `run()`. The original MCP tool is hidden via `toolFilter: { blockedToolNames: [...] }` on the MCP server. Pattern: `lib/agents/tools/sn-search.ts`.
- **Adding a new app-router API route requires a `next dev` restart.** Turbopack lazy-compiles routes on first hit, but in Next 16 routes added while the dev server is running sometimes never register. If `[draft] route module loaded` (or your route's first log) doesn't fire on a request, restart `pnpm dev`.

## Data model

Tables live in Supabase Postgres with RLS enabled:

- `profiles` — public mirror of `auth.users` (id, email, full_name)
- `drafts` — one row per RFI; `questions` JSONB carries `[{ index, text, status, content, sources }]`; statuses: `parsed | drafting | ready | in_review | approved`
- `comments` — anchored to `draft_id` and optionally `anchor_question_index`
- `assignments` — `reviewer | editor` role; `assignee_user_id` OR `assignee_email` (auto-claimed on signup)

The migration is in Supabase under the name `initial_schema`. Use the Supabase MCP (`list_tables`, `apply_migration`) for further changes.

## Agent architecture

Three roles, each an `@openai/agents` Agent:

1. **Parser** (`lib/agents/parser.ts`) — extracts the question list from raw RFI input. gpt-5-mini, Zod-typed output. User confirms before drafting starts.
2. **Drafter** (`lib/agents/drafter.ts`) — runs once per question (parallel). Tools: a budget-capped `sn_search_docs` wrapper, the rest of the sn-docs MCP (`sn_get_doc`, `sn_list_bundles`, …), Tavily web search, and a user-attached-context lookup. Produces `{ content, sources }`.
3. **Editor** (`lib/agents/editor.ts`) — voice/tone harmonization across all drafted questions; mutates `questions[].content` in place. Skipped on per-question regenerate.

Drafter system prompt loads `lib/ipc-profile.md` to ground answers in IPC's capabilities. Each `run()` is called with `{ maxTurns: 15, context: { snSearchCount: 0 } }` — the context object is what the search-budget wrapper increments.

Per-question regenerate posts to `/api/drafts/[id]/questions/[index]/draft` with optional `{ feedback }` and only re-runs that one Drafter (no Editor pass).

## Useful pointers

- `.env.local.example` — the canonical list of environment variables and what each is for.
- `_reference/` — example RFI inputs/outputs (local only, gitignored).
- Supabase project: created via MCP — discover with `list_projects` if needed.
