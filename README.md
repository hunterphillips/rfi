# RFX

Automate drafting RFx responses (RFI / RFP / RFQ / RFB) with an agent workflow.

A user pastes or uploads an RFx; a Parser extracts the discrete topics and a Scope extractor pulls the ServiceNow surface in scope. For each topic, a Planner emits a search plan that parallel Researchers execute (sn-docs MCP + Tavily web), and an Architect synthesizes the findings into a capability map. The user reviews each map and can re-research with feedback, trim it inline, or approve. Approved topics flow into a per-topic Drafter that renders Markdown from the capability map, and an Editor harmonizes voice across the document. Final responses can be edited inline and ultimately approved.

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

## Two-phase agent topology

- **Creation** — Parser + Scope extractor (parallel).
- **Phase 1 — research** (per topic, parallel): **Planner** → **Researchers** (per `SearchItem`, with `ResearcherBag` budgets + max-turns salvage) → **Architect** synthesizes a `CapabilityMap` (architecture narrative, features, components, open questions, sources).
- **Architect-review gate** — user can re-research with feedback, trim the map inline (features / components / open questions / narrative), or approve each topic.
- **Phase 2 — draft** — per approved topic, **Drafter** renders the capability map as Markdown (no research tools; only optional `attached_context`). **Editor** harmonizes voice across all topics in one pass. The final Markdown is also editable inline.

## Statuses

`parsed` → `researching` → `researched` → `drafting` → `ready` → `in_review` → `approved`
