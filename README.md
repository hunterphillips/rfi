# RFX

Automate drafting RFx responses (RFI / RFP / RFQ / RFB) with an agent workflow.

A user pastes or uploads an RFx. A Parser breaks it into discrete topics while a Scope extractor identifies the ServiceNow products in scope. Each topic then gets its own research: a Planner lays out a search plan, parallel Researchers work through it (ServiceNow docs via MCP, web via Tavily), and an Architect distills the findings into a capability map. The user reviews each map — sending it back with feedback, trimming it inline, or approving it. Once approved, a Drafter turns each map into Markdown and an Editor smooths the voice across the whole document. The finished response can be edited inline and signed off.

## Stack

- Next.js 16 (app router, Turbopack) on Vercel
- Supabase (magic-link auth, Postgres + RLS)
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

## Agent workflow

```
RFx ──> Parser + Scope extractor
              │
              ▼                                 (per topic)
        Planner ──> Researchers ──> Architect ──> capability map
              │
              ▼
        user review ──> re-research / trim / approve
              │
              ▼                                 (approved topics)
        Drafter ──> Editor ──> final Markdown response
```

- **Creation** — Parser + Scope extractor (parallel).
- **Phase 1 — research** (per topic, parallel): **Planner** → **Researchers** (per `SearchItem`, with `ResearcherBag` budgets + max-turns salvage) → **Architect** synthesizes a `CapabilityMap` (architecture narrative, features, components, open questions, sources).
- **Human-review** — user can rerun research with feedback, trim the map inline (features / components / open questions / narrative), or approve each topic.
- **Phase 2 — draft** — per approved topic, **Drafter** renders the capability map as Markdown (no research tools; only optional `attached_context`). **Editor** harmonizes voice across all topics in one pass. The final Markdown is also editable inline.

## Statuses

`parsed` → `researching` → `researched` → `drafting` → `ready` → `in_review` → `approved`
