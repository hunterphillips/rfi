# RFX

Internal IPC tool for drafting RFx responses (RFI / RFP / RFQ / RFB) with an agent workflow. RFI is the current focus. A user pastes/uploads an RFI; agents extract topics + ServiceNow scope, plan + research + synthesize a capability map per topic, and (after architect review) draft + harmonize a Markdown response that can be reviewed, commented on, assigned, and approved.

See [README.md](./README.md) for the architecture overview. Active build plans live under `.claude/plans/` (local-only).

## Stack

- Next.js 16 (app router, Turbopack) + TypeScript + Tailwind 4
- Supabase — auth (magic link), Postgres, RLS
- `@openai/agents` (Agents SDK, TS) with MCP support
- Tavily for web search; `sn-docs` MCP for ServiceNow content
- `unpdf` + `mammoth` for PDF/DOCX ingestion
- `react-markdown` + `remark-gfm` for draft rendering
- Resend for transactional email
- Hosted on Vercel (Hobby plan, Fluid Compute) at `rfi-coral.vercel.app`

## Structure

- `app/` — Next.js app router. Auth pages, drafts pages, API routes, shared UI.
- `app/components/` — shared layout (`app-header.tsx`) + brand (`brand.tsx`: `BrandLockup` for header, `BrandHero` for /login, `BrandMark` SVG for empty states). Logos come from `public/logo-banner.png` and `public/logo-full.png`.
- `app/components/ui/` — primitives: `button.tsx` (variants: primary/secondary/ghost/danger/link, sizes xs/sm/md/lg; primary uses the IPC gradient), `input.tsx` (`Input`/`Textarea`/`Label`), `card.tsx` (`Card`/`CardHeader`/`Body`/`Footer`/`Eyebrow`), `pill.tsx` (tonal), `status-pill.tsx` (driven by `TopicStatus`/`DraftStatus`), `progress-rail.tsx` (signature gradient bar; `PipelineStep` vertical variant).
- `app/api/drafts/[id]/research/` — SSE; phase 1 (Planner → parallel Researchers → Architect, per topic).
- `app/api/drafts/[id]/topics/[index]/research/` — SSE; re-research one topic with optional `{ feedback }`.
- `app/api/drafts/[id]/topics/[index]/approve/` — toggle a topic's `approved | researched` status (no agents).
- `app/api/drafts/[id]/draft/` — SSE; phase 2 (per-topic Drafter from capability_map → Editor across all). Requires all eligible topics to be `approved`.
- `app/api/drafts/[id]/topics/[index]/draft/` — SSE; per-topic re-draft from existing capability_map; optional `{ feedback }`.
- `app/api/drafts/[id]/cancel/` — flips `cancel_requested`; both phase routes poll this.
- `app/auth/callback/` — magic-link redirect handler.
- `lib/agents/` — agent definitions. Each exports a `*_MODEL` constant + a `*_PROMPT_HASH` (sha256[:16] of the instructions template, used for telemetry rollups).
  - `parser.ts` (Topic Extractor, gpt-5-mini)
  - `scope.ts` (Scope Extractor, gpt-5-mini)
  - `planner.ts` (Search Planner, gpt-5-mini)
  - `researcher.ts` (Researcher + Salvager, gpt-5-mini, with `errorHandlers: { maxTurns }` salvage path). `runResearcher(item, mcp, opts?)` accepts an optional `{ budget }` override (used by the budget sweep eval) and returns `{ output, telemetry, tokensIn?, tokensOut? }`.
  - `architect.ts` (Capability Map synthesizer, gpt-5, no tools, no IPC profile)
  - `drafter.ts` / `editor.ts` (gpt-5; inject IPC profile via `_profile.ts`). `makeDrafter()` and `makeEditor()` return `{ agent, promptHash, model }` — the hash is computed post-profile-interpolation so profile edits change it.
  - `_hash.ts` — `hashPrompt(template)` helper.
  - `_profile.ts` (shared IPC profile loader; only Drafter + Editor use it)
  - `stream-utils.ts` (SDK event-shape helpers — legacy from monolithic Drafter; reuseable)
- `lib/agents/tools/` — tool factories:
  - `evidence.ts` (typed `EvidenceItem`, `ToolBudget`, `ResearcherBag`; per-Researcher search/doc-fetch budgets enforced in wrappers)
  - `web-search.ts`, `sn-search.ts`, `sn-get-doc.ts` (each takes a `ResearcherBag?` and returns compact `{ ok, results } | { ok: false, error }` JSON to the model)
  - `sn-docs.ts` (sn-docs MCP server factory)
- `lib/agents/workflows/` — orchestration (Anthropic taxonomy: predefined LLM-orchestrated code paths). Both workflows accept `{ draftId?, traceId? }` in opts; when set, each agent stage calls `recordRun()` to insert an `agent_runs` row.
  - `research.ts` — `runResearchWorkflow(topics, opts)` + `updateTopic(topic, feedback, opts)`
  - `draft.ts` — `runDraftWorkflow(topics, opts)`
  - `events.ts` — `ResearchEvent` / `DraftEvent` discriminated unions
- `lib/evals/` — eval harness shared infra:
  - `types.ts` (`EvalCase`, `EvalResult`, `EvalSummary`, `JudgeScore`)
  - `judge.ts` (gpt-5 judges: `judgeParser`, `judgeScope`, `judgeResearcher`; each returns `{ scores, notes }`)
  - `runner.ts` (`runEval(stage, fixtureFile, runFn, judgeFn)`)
- `lib/observability/record-run.ts` — `recordRun(input)` inserts an `agent_runs` row (best-effort, swallows + logs errors). `extractUsage(result)` pulls `tokensIn`/`tokensOut` from `result.runContext.usage`.
- `lib/supabase/` — Supabase clients: `client.ts` (browser), `server.ts` (server), `middleware.ts` (proxy helper).
- `lib/cn.ts` — tiny classnames helper (`cn(...parts)`). No `clsx` dependency.
- `lib/ipc-profile.md` — IPC capability profile; injected into Drafter + Editor prompts only (Architect deliberately doesn't get it).
- `lib/types.ts` — `DraftRow`, `DraftTopic`, `Scope`, `CapabilityMap`, `PlanItem`, `ResearchSummary`, `FeedbackEntry`, status enums.
- `proxy.ts` — Next 16 proxy file (formerly `middleware.ts`); refreshes session + gates routes.
- `scripts/` — local diagnostic + eval scripts. `diag-*` are service-role / single-shot probes; `eval-*` run fixture suites with gpt-5 judges and print aggregates.
  - `diag-{research,draft,mcp,schema}.ts` — workflow + MCP + schema smoke
  - `diag-{agent-runs,agent-runs-query,drafts-columns,sn-search,sn-get-doc,comments-columns}.ts` — observability + MCP-shape + table-schema probes
  - `eval-{parser,scope,researcher}.ts` — per-stage evals against `evals/fixtures/*.json`
  - `eval-budget-sweep.ts` — runs researcher fixtures across budget variants; comparison table
- `supabase/migrations/` — applied via Supabase dashboard SQL editor (MCP OAuth is broken at time of writing).
- `evals/fixtures/` — hand-crafted eval fixtures (`parser.json`, `scope.json`, `researcher.json`).
- `agent-lab/` — separate Python sandbox; converged design that the parent ported back from. Diverges deliberately on terminology and SDK shape. Useful as historical reference.
- `_reference/` — local-only RFI examples (gitignored).

## Development

### Setup

```bash
pnpm install
cp .env.local.example .env.local   # fill keys
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

### Diag scripts

```bash
pnpm dlx tsx --env-file=.env.local scripts/diag-research.ts --topic "..."
pnpm dlx tsx --env-file=.env.local scripts/diag-research.ts <fixture-path>
pnpm dlx tsx --env-file=.env.local scripts/diag-draft.ts <state.json>
pnpm dlx tsx --env-file=.env.local scripts/diag-mcp.ts
pnpm dlx tsx --env-file=.env.local scripts/diag-schema.ts
pnpm dlx tsx --env-file=.env.local scripts/diag-agent-runs.ts        # post-migration smoke
pnpm dlx tsx --env-file=.env.local scripts/diag-agent-runs-query.ts  # rollup of recent runs
```

### Evals (gpt-5 judges; real API cost)

```bash
pnpm dlx tsx --env-file=.env.local scripts/eval-parser.ts
pnpm dlx tsx --env-file=.env.local scripts/eval-scope.ts
pnpm dlx tsx --env-file=.env.local scripts/eval-researcher.ts
pnpm dlx tsx --env-file=.env.local scripts/eval-budget-sweep.ts      # ~35-40 min; teeing to a log is a good idea
```

## Conventions

- **Proxy, not middleware.** Next 16 deprecated `middleware.ts`. Root file is `proxy.ts` and exports `proxy`. The session-refresh helper in `lib/supabase/middleware.ts` keeps the legacy name for parity with Supabase docs.
- **Server-side Supabase client is async.** `createClient()` from `lib/supabase/server.ts` returns a Promise — always `await` it.
- **Auth gate.** `proxy.ts` redirects unauthenticated requests to `/login` (preserving `?next=`) and authenticated requests away from `/login`. `/login` and `/auth/*` are public.
- **No email-domain restriction.** Sign-up/sign-in is open to any email. (Earlier builds hard-gated `@integritypro.com` via an `auth.users` trigger + a login-action check; both were removed — see `supabase/migrations/20260523b_drop_email_domain_gate.sql`.)
- **pnpm build allowlist.** `pnpm-workspace.yaml` sets `allowBuilds: { sharp: true, unrs-resolver: true }`. Don't strip it.
- **SSE handlers keep running after the client disconnects.** Long Researcher/Drafter runs should complete server-side even if the user navigates away. Do NOT tie an `AbortController` to a React effect cleanup — React 19 StrictMode double-invokes effects in dev and will cancel every fetch immediately. See `app/drafts/[id]/draft-runner.tsx` for the pattern.
- **`maxDuration = 300` is the Vercel Hobby + Fluid Compute ceiling.** All four agent-running SSE routes set this. A phase that runs past 300s gets killed mid-flight; the cancel-poll can't help (function is dead). Recovery is a manual SQL reset of the draft's `status` back to `parsed`/`researched` and `cancel_requested` to `false`. If phases start regularly exceeding 300s, the architecture needs to move to a durable queue (Inngest) — not a longer timeout.
- **Tool budgets via `ResearcherBag`, NOT `RunContext.context`.** The old monolithic-Drafter `ToolBudgetContext` pattern was deliberately removed during the agent-lab port. Per-Researcher budgets live in a closure-bound `ResearcherBag` (`lib/agents/tools/evidence.ts`); wrappers receive `bag?: ResearcherBag` at construction time. Defaults: `DEFAULT_SN_BUDGET = { maxSearches: 2, maxDocFetches: 1 }`, `DEFAULT_WEB_BUDGET = { maxSearches: 2, maxDocFetches: 0 }`.
- **Tool returns are normalized + truncated.** Every wrapper returns `{ ok: true, results: [...] }` or `{ ok: false, error }` to the model. Snippets capped at `SNIPPET_MAX = 400`, doc previews at `CONTENT_PREVIEW_MAX = 4000`. Raw upstream payloads stay on the typed `EvidenceItem` for downstream salvager / future evals.
- **Salvager is a fallback, not the primary control.** `errorHandlers: { maxTurns }` triggers only when reasoning loops past `RESEARCHER_MAX_TURNS = 6`. Per-tool budgets prevent over-search before max_turns is reached.
- **Tracing.** Every agent-running route wraps in `withTrace(name, async () => {...}, { traceId })` with a fresh `generateTraceId()`. Trace URL is logged on the first line: `[<stage> <id>] View trace: https://platform.openai.com/traces/trace?trace_id=<id>`. The trace id is persisted to `drafts.trace_id` at phase start and to every `agent_runs.trace_id` row, so a draft's rows can be joined to the OpenAI traces dashboard.
- **Per-stage telemetry.** When the SSE route passes `{ draftId, traceId }` to the workflow, each stage (planner / researcher / architect / drafter / editor) records one `agent_runs` row with `model`, `prompt_hash`, `tokens_in/out`, `latency_ms`, `salvaged`, `budget_used`, and any error. Diag scripts naturally skip telemetry (they don't pass `draftId`). Parser/scope run pre-draft-insert in `app/drafts/new/actions.ts` and are NOT recorded today — adding them is straightforward but unscheduled.
- **`response_format: "json"` for sn-docs MCP.** Both `sn-search.ts` and `sn-get-doc.ts` pass `response_format: "json"` to the MCP. Without it, the MCP returns Markdown-formatted text and the wrappers silently return empty results. `sn_search_docs` JSON is a top-level array `[{ score, title, bundle, url, breadcrumbs, page_id, chunk_index, excerpt }]` (snippet is `excerpt`); `sn_get_doc` is an array of `{ chunk_index, title, bundle, url, page_id, breadcrumbs, content }` chunks that the wrapper concatenates by `chunk_index`. Bundle names must be canonical-full (`vancouver-it-service-management`, not `vancouver-itsm`).
- **Adding a new app-router API route requires a `next dev` restart.** Turbopack lazy-compiles, and in Next 16 routes added while the dev server is running sometimes never register.
- **Frontend is light-theme canonical, IPC-branded.** Design tokens live in `app/globals.css` `@theme` — surfaces `canvas/elev-1/2/3`, lines `line/line-2/3`, ink scale `ink/ink-2..5`, brand `lime/grass/emerald/teal`, semantic `danger/warn/info`, plus `accent` (`#1d7a4a` — the AA-contrast green for *text* on light bg). Fonts: Chakra Petch (display), Manrope (body), JetBrains Mono. Use the primitives in `app/components/ui/` rather than re-rolling buttons/inputs/pills. Use `bg-emerald/10 border-emerald/30` style opacity modifiers for tinted surfaces; **don't** use surface tokens with opacity (`bg-elev-1/60` etc. are invisible on light). Use `text-accent` for green text (not `text-teal`/`text-emerald` which lack contrast on white). The signature lime→emerald→teal `brand-gradient` utility is reserved for: brand mark, primary CTAs, `ProgressRail`, hairline page accents — keep it scarce.
- **Product name is "RFX"** in user-facing UI (set in `BrandLockup`'s `productLabel` and `BrandHero`'s `tagline` defaults in `app/components/brand.tsx`, plus `app/layout.tsx` metadata). Repo dir is still `/rfi/` for legacy reasons.

## Data model

Tables in Supabase Postgres with RLS enabled:

- `profiles` — public mirror of `auth.users` (id, email, full_name).
- `drafts` — one row per RFI. Columns:
  - `topics JSONB` — `[{ index, text, status, plan, research, capability_map, feedback_history, content, sources }]`. Renamed from `questions` during the agent-lab port.
  - `scope JSONB NULL` — `{ products: [{ name }], version: string | null, summary: string } | null`. Extracted at parse time.
  - `status` — `parsed | researching | researched | drafting | ready | in_review | approved`. Enforced via a CHECK constraint.
  - `cancel_requested boolean`, `trace_id text`, `input_text`, `title`, `attached_context jsonb`.
- `agent_runs` — one row per agent stage execution (planner / researcher / architect / drafter / editor; salvager folds into the researcher row's `salvaged` flag). Columns: `draft_id` (FK with `ON DELETE CASCADE`), `topic_index`, `stage`, `model`, `prompt_hash`, `trace_id`, `tokens_in`, `tokens_out`, `cost_usd` (nullable — computed downstream from a model-rate map), `latency_ms`, `salvaged`, `budget_used jsonb`, `error`, `raw_telemetry jsonb`. RLS tied to `drafts.owner_id`.
- `comments` — per-topic threads (Phase 5). Columns: `id, draft_id, anchor_question_index` (legacy name = topic index), **`author_id NOT NULL`** (refs `auth.users`; the original scaffold's author column — NOT `author_user_id`), `body`, `resolved bool DEFAULT false`, `resolved_at`, `created_at`, `updated_at`. RLS (`20260523_phase5_collab.sql`): owner/assignee read+insert, author/owner update+delete.
- `assignments` — reviewer assignment (Phase 5). Columns: `id, draft_id, role` (`reviewer | editor`), `assignee_user_id` (nullable — set when the email maps to a profile) OR `assignee_email`, **`assigned_by NOT NULL`** (refs `auth.users`; the owner who created the row), `status` (`pending | accepted | declined`), `created_at`, `updated_at`. RLS: owner manages; assignee sees own row (matched by user id or `auth.jwt()` email via the `is_draft_assignee()` SECURITY DEFINER helper).
- **⚠️ The live schema for `comments`/`assignments` carries NOT-NULL columns (`author_id`, `assigned_by`) that pre-dated and weren't in older docs. When writing to a Postgres table, introspect the real columns (e.g. `scripts/diag-phase5.ts`, or an `information_schema.columns` query in the dashboard) rather than trusting prose — two Phase 5 insert bugs came from building against an incomplete column list.

Per-topic status enum: `pending | planning | researching | researched | approved | drafting | drafted | failed`.

Migrations live in `supabase/migrations/*.sql`. Apply via Supabase dashboard SQL editor — Supabase MCP OAuth flow is broken at time of writing ("Unrecognized client_id" from Supabase). Service-role API calls via `@supabase/supabase-js` work fine for table reads/writes (see `scripts/diag-schema.ts` for an example).

## Agent architecture

Two-phase, gated topology.

**Phase 1 — research** (`runResearchWorkflow`, route `POST /api/drafts/[id]/research`):
1. **Parser** runs at draft creation time (`/drafts/new`), not at phase 1 — produces the topic list the user reviews/edits.
2. **Scope extractor** runs in parallel with Parser at creation time; produces `Scope | null` recorded on the draft. Failure is swallowed (logged) — pipeline tolerates null scope.
3. For each topic in parallel:
   - **Planner** produces a `SearchPlan` of 3-5 `SearchItem`s. Sees the scope as additional context when non-empty; can emit `bundle` hints per item.
   - **Researchers** (parallel, one per SearchItem) — each gets a `ResearcherBag` with `DEFAULT_SN_BUDGET` or `DEFAULT_WEB_BUDGET`. Tool wrappers enforce budgets; salvager fires only if `RESEARCHER_MAX_TURNS = 6` trips.
   - **Architect** synthesizes the per-Researcher summaries into a `CapabilityMap { architecture_narrative, features[], components[], open_questions[], sources[] }`.
4. Draft-level status flips `parsed → researching → researched`.

**Architect-review gate** (`/drafts/[id]` shows `ResearchedView`): user reviews each capability map; can **re-research with feedback** (POST `/topics/[i]/research`), **approve** (POST `/topics/[i]/approve`), or **approve all and draft**.

**Phase 2 — draft** (`runDraftWorkflow`, route `POST /api/drafts/[id]/draft`): requires status `researched` and at least one `approved` topic with a capability_map.
1. For each approved topic in parallel: **Drafter** renders the capability_map as Markdown. No research tools — only an optional `attached_context` tool when the user attached docs.
2. **Editor** harmonizes voice across all drafted topics in one pass. Mutates `topics[].content` in place via index-keyed rewrites.
3. Draft-level status flips `researched → drafting → ready`.

Per-topic re-draft (POST `/topics/[i]/draft`, allowed in `ready` / `in_review`) re-runs only the Drafter for that topic from the existing capability_map; supports optional `{ feedback }`. Editor is NOT re-run.

`topics[i].content` also has a non-agent write path: `updateTopicContent` server action (called from the Edit button in `question-card.tsx`) lets the owner manually edit the rendered Markdown without an LLM call. Allowed in `ready` / `in_review`. Sources are left untouched on manual edits.

## Useful pointers

- `.env.local.example` — canonical env var list. `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_*`, `TAVILY_API_KEY`, `SN_DOCS_MCP_URL`, `SN_DOCS_API_KEY`.
- `_reference/` — gitignored real RFI examples; useful for manual smoke.
- `agent-lab/CLAUDE.md` — Python sandbox; the "Divergence from parent project" section was the punch list for the agent-lab-port plan and is now historical context.
- `.claude/plans/` — see `agent-lab-extraction.md`, `agent-lab-port.md`, `scope-extractor.md`, `aci-tightening.md`, `evals-and-observability.md` (Tier 1 + Tier 2 shipped; Tier 3 is enterprise-readiness), `phases.md`.
- `.claude/pickup.md` — current session handoff state.
- Supabase project: `nccnvsnkvbsypliehgxu` (org `xajzgyaovdvccmuvfkhg` / "HP"), free tier, us-east-2.
