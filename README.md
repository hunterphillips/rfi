# RFX

Automate drafting responses to RFIs, RFPs, and other solicitations.

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
