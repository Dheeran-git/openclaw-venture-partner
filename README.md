# OpenClaw Venture Partner

Autonomous AI deal-flow agent for freelancers and digital agencies. Built on OpenClaw. Hackathon prototype, designed for production scaling.

## Layout

```
apps/
  web/      Next.js 15 dashboard (App Router + TS + Tailwind 3)
  worker/   Inngest worker host
  agent/    OpenClaw runtime + custom skills (chat platforms)
packages/
  agent/    LLM client + prompts + scoring/drafting/negotiation
  db/       Supabase schema, migrations, typed clients
  scraping/ Scraper interface + adapters (Zyte, Firecrawl)
  memory/   Client memory read/write
  shared/   Env loader, constants, types
openclaw-design-system/  Frozen design bundle from Claude Design — do not modify
```

## Setup

```sh
pnpm install
cp .env.example .env   # then fill in keys you have
pnpm dev               # boots apps/web
```

## Build order

See `CLAUDE.md` for the locked Phase 1–7 build order. The LLM client (`packages/agent/src/llm/`) must be the first piece of code to work end-to-end — every business module depends on it.
