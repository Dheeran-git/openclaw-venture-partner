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
pnpm dev               # boots apps/web on :3000
```

## Verifying the wire

```sh
# LLM client smoke test (per provider + router-selected)
pnpm --filter @openclaw/agent smoke

# Inngest registration: should report function_count >= 1, mode "dev"
curl -s http://localhost:3000/api/inngest | jq

# Inngest dev server (separate terminal, with apps/web also running)
pnpm dlx inngest-cli@latest dev -u http://localhost:3000/api/inngest
# UI: http://localhost:8288 — trigger system/healthcheck from there
```

## Build order

See `CLAUDE.md` for the locked Phase 1–7 build order. The LLM client (`packages/agent/src/llm/`) must be the first piece of code to work end-to-end — every business module depends on it.
