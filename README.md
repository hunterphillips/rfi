# rfi

Internal IPC tool for drafting RFI responses with an agent workflow.

A user pastes or uploads an RFI's questions; a Parser extracts the discrete questions, the user confirms; per-question Drafter agents (with sn-docs MCP, web search, and optional user-attached context as tools) write each answer; an Editor harmonizes voice and assembles a Markdown draft. Drafts can be commented on, assigned for review, and approved.

## Stack

- Next.js (app router) on Vercel
- Supabase (auth via magic link, Postgres, file storage)
- OpenAI Agents SDK (TypeScript) with MCP support
- Tavily for web search; `sn-docs` MCP for ServiceNow content
- Resend for transactional email
- `unpdf` + `mammoth` for PDF/DOCX ingestion

## Local setup

```bash
pnpm install
cp .env.local.example .env.local   # fill in keys
pnpm dev
```

Open http://localhost:3000.

## Architecture

- **Parser agent** — extracts the question list from raw RFI input. User confirms.
- **Drafter agents** — one per question, run in parallel. Tools: `sn-docs` MCP, web search, optional attached context.
- **Editor agent** — voice/tone harmonization across drafts; mutates section content in place.

System prompt for the Drafter loads `lib/ipc-profile.md` to ground answers in IPC's actual capabilities.

## Statuses

`parsed` → `drafting` → `ready` → `in_review` → `approved`

## Build phases

- ✅ **Phase 0 — Setup.** Next.js 16 + Tailwind + TS scaffold, agent SDK + Supabase + parsers + email + search deps, IPC profile placeholder, env template.
- ✅ **Phase 1 — Auth + skeleton.** Supabase clients, root `proxy.ts` (session refresh + auth gate), magic-link login restricted to `@integritypro.com`, sign-out, drafts list shell.
- ✅ **Phase 2 — Parser flow.** PDF/DOCX/text extraction, Parser agent with Zod-typed output, `/drafts/new` (paste-or-upload), `/drafts/[id]` `parsed` view with editable question list and save action.
- 🚧 **Phase 3 — Drafter + Editor.** Per-question parallel Drafters with `sn-docs` MCP + Tavily web search + user-attached context tools; Editor for voice harmonization; SSE progress stream from `/api/drafts/[id]/draft`; `drafting` UI subscribes and updates per-question.
- ⬜ **Phase 4 — Read + comment.** `ready` UI renders the assembled Markdown; per-question comment threads; owner/editor inline edits.
- ⬜ **Phase 5 — Assign + approve.** Reviewer assignment (existing user or email invite); Resend notifications; approve / request-changes actions; `ready → in_review → approved`.
- ⬜ **Phase 6 — Polish + deploy.** Empty/error states, Vercel + Supabase prod, custom Resend sender domain.

Defaults locked in: Tavily for web search, GPT-5 for Drafter/Editor, GPT-5-mini for Parser, no pgvector / no semantic retrieval (uploads stuff into the prompt up to a size limit), Markdown output rendered in-browser, comment anchoring at question-level only.
