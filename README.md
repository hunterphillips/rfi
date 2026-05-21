# RFX

Company tool for drafting RFx responses (RFI / RFP / RFQ / RFB) with an agent workflow. RFIs are the current focus; the architecture is designed to extend to the other three.

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

System prompt for the Drafter loads `lib/ipc-profile.md` to ground answers in company's actual capabilities.

## Statuses

`parsed` → `drafting` → `ready` → `in_review` → `approved`
