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

- **Creation** — Parser splits the RFx into topics; Scope extractor identifies the ServiceNow products in scope.
- **Research** — per topic, a Planner builds a search plan, parallel Researchers execute it (ServiceNow docs + web), and an Architect synthesizes the findings into a capability map.
- **Review** — the user can rerun research with feedback, trim the map inline, or approve each topic.
- **Draft** — a Drafter renders each approved map as Markdown, then an Editor harmonizes voice across the document. The result is editable inline.

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
