# OpenClaw Venture Partner — Production Build Guide

**Audience:** Claude Code, working alongside the project owner (Dheeran), in the existing repo at `C:\Code\openclaw`.

**Status at start of this guide:** Phases 1 and 2 are complete (23 commits, both phases on `main`). Foundation is solid: monorepo, Supabase schema, working LLM client, scout pipeline (scrape → score → realtime dashboard), design system fully wired. This document covers everything from Phase 3 onwards through production launch readiness.

**Posture shift:** The earlier `CLAUDE.md` framed this as "hackathon-shaped, production-aligned." That framing is retired. From this document forward, the goal is **a real production-grade SaaS product** — not a demo, not a prototype, not a hackathon submission with deferred TODOs. Every architectural decision must be defensible at production scale (1k → 100k users), every external boundary must be properly abstracted, every security and operational concern must be addressed. The hackathon submission is a *byproduct* of building the product correctly, not the destination.

**Operating mode:** Hybrid. This document is the full specification — read it cover to cover before starting Phase 3. Each phase has explicit checkpoints inside it where the project owner confirms before you continue. Do not skip checkpoints. Do not collapse multiple checkpoints into one. The owner reviewing a screen, a commit, or a test result is the primary mechanism that prevents architectural drift.

---

## Table of contents

1. [What we're actually building](#1-what-were-actually-building)
2. [Production architecture — the full picture](#2-production-architecture--the-full-picture)
3. [Locked-in technical decisions](#3-locked-in-technical-decisions)
4. [LLM client — five-provider production chain](#4-llm-client--five-provider-production-chain)
5. [Scraping — Zyte primary, Firecrawl self-hosted, stub fallback](#5-scraping--zyte-primary-firecrawl-self-hosted-stub-fallback)
6. [OpenClaw integration — the agent runtime](#6-openclaw-integration--the-agent-runtime)
7. [Chat platforms — Telegram and Discord primary, others scaffolded](#7-chat-platforms--telegram-and-discord-primary-others-scaffolded)
8. [Database — full production schema](#8-database--full-production-schema)
9. [Authentication and multi-tenancy](#9-authentication-and-multi-tenancy)
10. [The HITL approval security model](#10-the-hitl-approval-security-model)
11. [Phase 3 — pitch drafting and HITL approval](#11-phase-3--pitch-drafting-and-hitl-approval)
12. [Phase 4 — Layer 2 proof-of-value](#12-phase-4--layer-2-proof-of-value)
13. [Phase 5 — Layer 3 negotiation and client memory](#13-phase-5--layer-3-negotiation-and-client-memory)
14. [Phase 6 — production hardening](#14-phase-6--production-hardening)
15. [Phase 7 — observability, testing, deployment](#15-phase-7--observability-testing-deployment)
16. [Operational rules](#16-operational-rules)
17. [Environment variables — final manifest](#17-environment-variables--final-manifest)
18. [Onboarding the next session](#18-onboarding-the-next-session)

---

## 1. What we're actually building

OpenClaw Venture Partner is an autonomous AI agent that runs the full deal lifecycle for solo freelancers and small digital agencies. Built on top of the open-source OpenClaw personal-AI-assistant framework. The product runs three layers of demand-finding work:

**Layer 1 — Scout.** Scrapes job boards (Upwork, LinkedIn, Indeed, Freelancer, Reddit, Contra, X/Twitter) for explicit job postings matching the operator's profile. Scores each lead with a calibrated rubric. Phase 2 already shipped this.

**Layer 2 — Architect.** Watches for warm leads from growth signals — funding rounds, key hires, public site issues, GitHub activity. For each warm lead, the agent generates a concrete proof-of-value artifact (a Lighthouse audit summary, a small sample component, a bug-reproduction repo) and attaches it to outreach.

**Layer 3 — Negotiator.** Once a lead becomes a client, the agent maintains persistent client memory in a markdown-style knowledge file. It drafts replies to incoming client emails using full conversation history. It detects upsell opportunities and surfaces them as new pitch drafts.

Across all three layers, **the brand promise is draft-only**: the agent never sends, posts, commits, or pays without an explicit human approval click. Every outbound action goes through a Telegram (primary), Discord, WhatsApp, Slack, or in-dashboard approval gate with cryptographic verification (`payload_hash`) to prevent man-in-the-middle modification of drafts between display and approval.

The product surface is a Linear-density dark-mode web dashboard with a coral accent. The chat surfaces are bots that route through OpenClaw's adapter system. All four product surfaces (web + Telegram + Discord + Slack/WhatsApp) read from and write to the same Supabase database; the database is the single source of truth.

The user-base target is solo operators and small (1-5 person) digital agencies, primarily React/Next.js freelancers but the rubric and prompt system is profile-driven so any tech stack works. Pricing/monetization is deferred — the build target is a complete free-to-use SaaS with optional paid tier later, possibly open-source. That decision happens after the product is built, not before.

---

## 2. Production architecture — the full picture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         INGRESS / SURFACES                            │
├─────────────────────┬──────────────────┬─────────────────────────────┤
│   Web Dashboard     │   Telegram Bot   │   Discord / Slack / WhatsApp│
│   Next.js 15 App    │   (primary)      │   (scaffolded, not wired)   │
└──────────┬──────────┴────────┬─────────┴──────────────┬──────────────┘
           │                   │                        │
           │                   ▼                        │
           │         ┌──────────────────┐               │
           │         │  OpenClaw Agent  │               │
           │         │  Runtime         │               │
           │         │  (skills/MCPs)   │               │
           │         └────┬─────────────┘               │
           │              │                             │
           ▼              ▼                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                               │
├─────────────────────┬──────────────────┬─────────────────────────────┤
│   Next.js API       │   Inngest Jobs   │   Supabase Edge Functions   │
│   (HTTP entry)      │   (background)   │   (webhooks, cron)          │
└──────────┬──────────┴────────┬─────────┴──────────────┬──────────────┘
           │                   │                        │
           ▼                   ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       BUSINESS LOGIC PACKAGES                         │
├──────────────────┬───────────────────┬───────────────────────────────┤
│  packages/agent  │  packages/scraping│  packages/memory              │
│  - llm/ client   │  - zyte (primary) │  - client_memory_md           │
│  - scoring/      │  - firecrawl      │  - upsert/diff/render         │
│  - drafting/     │  - stub (fallback)│                               │
│  - negotiation/  │                   │                               │
│  - prompts/      │                   │                               │
└──────────────────┴───────────────────┴───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        DATA + AUTH LAYER                              │
├──────────────────────────────┬───────────────────────────────────────┤
│  Supabase Postgres + RLS     │  Supabase Auth                        │
│  - 11 tables, full RLS       │  - email/password + magic link        │
│  - migrations 0001-00xx      │  - OAuth (Google, GitHub)             │
│  - Realtime channels         │                                       │
└──────────────────────────────┴───────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL PROVIDERS                              │
├────────────────┬────────────────┬────────────────┬───────────────────┤
│  LLM (5 chain) │  Email (Resend)│  Scraping      │  Telemetry        │
│  Copilot       │                │  Zyte API      │  Sentry           │
│  Gemini        │                │  Firecrawl     │  PostHog          │
│  Groq          │                │  Stub          │  Inngest          │
│  OpenRouter    │                │                │                   │
│  Anthropic*    │                │                │                   │
└────────────────┴────────────────┴────────────────┴───────────────────┘
```

The data flow rule is **strict**: HTTP/event entry → application layer → business logic packages → data layer → external providers. No layer skips downward. No layer reaches up. This is what makes the system testable, swappable, and scalable.

The four ingress surfaces (web, Telegram, Discord, Slack/WhatsApp) all read and write through the same business logic, the same database, the same approval flow. They are *adapters*, not separate apps. A pitch drafted on the web can be approved from Telegram. A scout triggered from Telegram appears in real-time on the web dashboard. Single source of truth.

---

## 3. Locked-in technical decisions

These decisions were made earlier in the project, are *not* up for re-discussion mid-build, and apply to every line of code from this point forward:

**Monorepo:** pnpm workspaces. Folders: `apps/`, `packages/`. Established in Phase 1.

**Frontend:** Next.js 15 App Router + TypeScript strict + Tailwind CSS v3. Deploy: Vercel.

**Database + Auth:** Supabase Postgres + Auth + Realtime. Production migration enables RLS on all tables (currently disabled per Phase 2). Real Supabase Auth replaces hardcoded `DEMO_USER_ID` (Phase 6).

**Background jobs:** Inngest. Production tier when traffic justifies; free tier through development.

**LLM provider chain:** Copilot OAuth → Gemini → Groq → OpenRouter → Anthropic (dormant 5th fallback). See section 4 for full detail.

**Scraping:** Zyte primary (called directly from our Inngest worker, not via OpenClaw — scraping is a worker-side concern, not a chat concern), Firecrawl self-hosted secondary, Stub fallback. See section 5.

**Email:** Resend. Production custom domain.

**Agent runtime:** OpenClaw (https://github.com/openclaw/openclaw). All chat-platform integrations and the agent reasoning loop run through OpenClaw's adapter system. Custom skills live in `apps/agent/skills/`.

**Chat platforms:** Telegram and Discord both primary (fully wired and tested). WhatsApp and Slack scaffolded (env vars in `.env.example`, OpenClaw plugins listed in Gateway config but disabled, activation is a config flip). See section 7.

**Observability:** Sentry for errors, PostHog for product analytics, Inngest UI for background-job tracing, custom `llm_calls` and `audit_log` tables for LLM and security telemetry.

**Testing:** Vitest for unit tests, Playwright for E2E, all critical paths covered. See section 15.

---

## 4. LLM client — five-provider production chain

The LLM client is the single most important abstraction in the codebase. It already exists at `packages/agent/src/llm/client.ts` from Phase 1. It needs upgrades for production.

### 4.0 Two LLM-routing layers — and why

After the OpenClaw audit, it became clear that LLM calls in our system happen at two distinct layers, and we should be deliberate about which layer handles which call type:

**Layer A — Worker-side calls (our internal LLM client).** Lead scoring, pitch drafting, reply drafting, Lighthouse summarization, classification, memory updates. These run inside Inngest workers, generate structured output validated against Zod schemas, are logged to `llm_calls`, are subject to per-user budget caps, and are the bulk of our LLM volume. Use `packages/agent/src/llm/client.ts`. The five-provider chain documented below applies to this layer.

**Layer B — Chat-side calls (OpenClaw's internal routing).** Skill matching, intent disambiguation, conversational response generation in chat. OpenClaw makes these calls itself when our skills don't know how to respond directly. We don't proxy these through our client — we just configure OpenClaw to use the *same five providers in the same order* via its native LLM config. The bill stays consolidated (same API keys, same providers).

Why two layers, not one: if we routed every chat call through our internal client, we'd be adding a network hop for no benefit. OpenClaw's own LLM routing is well-built and supports our entire provider list natively. Trying to force-bridge them would add complexity without reducing it.

What this means in practice:
- **Pricing, cost tracking, budget guards, idempotency keys** — all apply to Layer A only. OpenClaw has its own observability for Layer B; we configure it to use our provider keys but we don't try to merge telemetry.
- **Provider health checks** — both layers do their own. They'll usually agree because they're hitting the same providers, but they're independent caches.
- **Smoke tests** — `pnpm --filter @openclaw/agent llm-smoke` tests Layer A. The `openclaw doctor` CLI tests Layer B. Run both as part of CI.
- **Cost reconciliation** — at end of each day, the total bill from each provider should roughly match `sum(cost_usd)` from `llm_calls` *plus* whatever OpenClaw used. The Layer B portion is harder to attribute per-user; if it becomes a problem at scale, we can add OpenClaw-side telemetry hooks. Until then, Layer B is "shared overhead" billed against the user's daily budget at Layer A's rate.

The rest of this section describes Layer A in detail. Layer B configuration is in section 6.7 (Setup, Stage D).

### Provider order (final)

1. **Copilot OAuth** — primary. Authenticated via dummy GitHub Pro Student account. Free for the user.
2. **Gemini** — second fallback. `gemini-2.5-flash` for fast, `gemini-2.5-pro` for capable.
3. **Groq** — third fallback. `llama-3.3-70b-versatile` for balanced/capable, `llama-3.1-8b-instant` for fast.
4. **OpenRouter** — fourth fallback. Routes to whatever model is configured; default `openai/gpt-4o-mini` for cost.
5. **Anthropic** — fifth fallback, **dormant by default**. Adapter file ships, env var unset → router skips. If a future user has an Anthropic key, setting `ANTHROPIC_API_KEY` activates it as a final fallback.

The router picks the first healthy provider in the list. Health is checked with a 60-second cache (cheap probe call, cached result for next calls). If a provider returns a structured-output validation failure, retry once on the same provider, then fail over to the next. If a provider returns a hard error (auth, rate limit, network), fail over immediately.

### Required upgrades for production

The Phase 1 client is functional but has gaps that need closing:

**Cost tracking.** Every call must record `cost_usd` based on the provider's actual pricing for input and output tokens. Phase 1 left this as `nullable` for unknown providers; production needs a pricing table and per-provider math:

```typescript
// packages/agent/src/llm/pricing.ts
export const PRICING: Record<string, { in: number; out: number }> = {
  // Per 1M tokens, USD
  "openai/gpt-4o-mini":           { in: 0.15,  out: 0.60  },
  "openai/gpt-4o":                { in: 2.50,  out: 10.00 },
  "google/gemini-2.5-flash":      { in: 0.075, out: 0.30  },
  "google/gemini-2.5-pro":        { in: 1.25,  out: 5.00  },
  "groq/llama-3.3-70b-versatile": { in: 0.59,  out: 0.79  },
  "groq/llama-3.1-8b-instant":    { in: 0.05,  out: 0.08  },
  "anthropic/claude-sonnet-4-5":  { in: 3.00,  out: 15.00 },
  "copilot/gpt-4o":               { in: 0,     out: 0     }, // Pro account is flat-fee
  // Add more as we use them
};

export function computeCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = PRICING[model];
  if (!price) return null;
  return (price.in * inputTokens + price.out * outputTokens) / 1_000_000;
}
```

**Model-tier mapping per provider.** The client takes a `model: 'fast' | 'balanced' | 'capable'` tier; each provider maps it to its actual model name. Document this mapping per-provider in each adapter file as a const at the top.

**Streaming.** Production needs streaming for UX (the dashboard shows pitch drafts streaming in token-by-token). The client gets a parallel `stream()` method:

```typescript
export interface LLMClient {
  complete<T>(opts: CompleteOpts<T>): Promise<T>;
  stream(opts: StreamOpts): AsyncIterable<{ chunk: string; done: boolean }>;
}
```

Streaming bypasses Zod validation (you stream text, not structured output). For structured-output streaming, accumulate the full response and validate once at the end.

**Provider health metrics.** Add a `provider_health` table (migration 0005) tracking per-provider success rate, p50/p95 latency, and cost per call over the last 24h. The router reads from this on health check; the dashboard's Settings page (Phase 6) renders it.

```sql
create table provider_health (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  checked_at timestamptz not null default now(),
  ok boolean not null,
  latency_ms int,
  error_kind text,
  error_message text
);
create index on provider_health(provider, checked_at desc);
```

**Idempotency keys.** For safety on retry/replay, the client takes an optional `idempotencyKey`. When set, if a prior call with the same key+input exists in `llm_calls`, return the cached response instead of calling the provider. This protects against duplicate-charging on Inngest retries.

**Budget guards.** Per-user daily LLM spend cap (default $5/day for free tier, configurable per user). Check before each call; if exceeded, throw a `BudgetExceededError` that propagates to the user as a friendly "daily AI quota reached, resets at midnight UTC" message. Implementation: aggregate `cost_usd` from `llm_calls` for `user_id` in the last 24h.

### Copilot OAuth adapter — the critical one

Copilot OAuth is the primary provider. The setup is finicky; document it once carefully so the dummy-account dance is reproducible.

**Setup walkthrough (one-time, do this before Phase 3 step 1):**

1. Use the dummy GitHub account (NOT the user's main account).
2. Verify Copilot Pro is active on the dummy account (GitHub Education Pack or paid Pro).
3. Generate an OAuth device-flow token using `copilot-api` or the equivalent CLI:
   ```bash
   npx copilot-api auth
   # Visit the URL, paste the device code, confirm
   # Save the token printed to stdout
   ```
4. Set `COPILOT_TOKEN=<token>` in `.env`. Never commit this file.
5. Run the LLM smoke test against Copilot specifically: `pnpm --filter @openclaw/agent llm-smoke -- --provider copilot`. Expect a successful round-trip.

**Adapter behavior:**

- Use the Copilot chat completions endpoint. The endpoint and model names are stable but document them as constants at the top of `copilot.ts` so they're easy to update.
- Map `model: 'fast'` → `gpt-4o-mini`, `'balanced'` → `gpt-4o`, `'capable'` → `gpt-4o`.
- Token usage is reported in the response; log to `llm_calls`.
- Cost: zero for the user (Pro account is flat-fee), so `cost_usd: 0` always.
- Rate limits: real but generous. On 429, fail over rather than retry.

**Operational concern:** Copilot's terms of service permit personal use of the Copilot subscription for coding-adjacent tasks. Using it for arbitrary chat completions is in a gray area. The dummy-account isolation is the user's chosen mitigation. Document this explicitly in the adapter file header so future maintainers understand the choice.

### Health-check probe

The router checks provider health with a probe call. Make it cheap:

```typescript
const PROBE = { prompt: "Reply with the single word: ok", maxTokens: 5 };
```

A successful probe response is anything containing "ok" case-insensitive. Cache the result per-provider for 60 seconds.

### Checkpoint — LLM client

After implementing the upgrades:

- [ ] All five adapters present, documented, with model-tier maps.
- [ ] `pricing.ts` with at least the eight models listed above.
- [ ] `provider_health` table created and migration applied.
- [ ] Streaming method implemented and tested with a 20-token prompt.
- [ ] Idempotency key works: re-calling with the same key returns cached response without hitting provider.
- [ ] Budget guard works: setting `USER_DAILY_BUDGET_USD=0.01` and running 5 cheap calls trips the guard.
- [ ] Smoke test runs all five adapters and prints latency/cost per provider. Anthropic adapter is dormant when key is unset (skipped, not failed).

Show the smoke test output to the project owner before moving on.

---

## 5. Scraping — Zyte primary, Firecrawl self-hosted, stub fallback

The scraping stack uses three providers behind a single `Scraper` interface. Selection is by env config; no business code knows which is active.

```
SCRAPER=zyte       (production primary)
SCRAPER=firecrawl  (self-hosted secondary)
SCRAPER=stub       (default for dev / demo predictability)
```

When unset, defaults to `stub`. When set to `zyte` but `ZYTE_API_KEY` is missing, falls back to `firecrawl` if `FIRECRAWL_URL` is set, else `stub`. Cascading fallback at startup, log a warning.

### 5.1 Zyte setup walkthrough (do this once)

Zyte is the production scraper. **It is called directly by our Inngest worker, not routed through OpenClaw.** Scraping happens entirely on the worker side: an Inngest event triggers a scout pipeline, the pipeline calls `scraper.scrape()` (which dispatches to Zyte), parses results, scores them, writes to Supabase. OpenClaw never sees any of this — it only learns about new leads when the user asks ("what did you find?") and the chat agent calls `getRecentLeads` MCP tool. Keeping scraping out of OpenClaw avoids unnecessary network hops and keeps responsibilities clean: OpenClaw owns the chat surface, our worker owns business logic.

Here's the full Zyte setup sequence:

**Step 1 — Sign up.**
1. Go to [zyte.com](https://www.zyte.com/) using the dummy GitHub account.
2. Click "Sign up." Choose GitHub OAuth.
3. Confirm the email Zyte sends.

**Step 2 — Activate GitHub Student perk (if eligible).**
1. The dummy account should have GitHub Student status (per the user's setup).
2. In Zyte's dashboard, navigate to Billing → Plans.
3. Look for the "GitHub Student" or "GitHub Education" perk option. Apply it.
4. Verify the free-tier credit is now visible (typically several thousand requests/month).

**Step 3 — Create the API key.**
1. Dashboard → API Keys → Create.
2. Name: `openclaw-venture-partner-prod`.
3. Permissions: "Access Zyte API."
4. Copy the key immediately (Zyte shows it once).
5. Store in `.env` as `ZYTE_API_KEY=<key>`. Do not commit.

**Step 4 — (If using Zyte Smart Proxy Manager / cloud spider): set up a crawler.**

The user mentioned this. Most use cases for OpenClaw Venture Partner do *not* need a hosted spider — the Zyte Extract API handles ad-hoc scraping per-request, which is what we want. However, if scaling to >1k requests/hour, hosting a spider makes economic sense.

For now, **stick with the Extract API** (per-request scraping). Skip spider hosting until traffic justifies it. Document this decision in `packages/scraping/src/zyte.ts` header.

**Step 5 — Smoke test the API key.**

```bash
curl -u "$ZYTE_API_KEY:" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.upwork.com/nx/search/jobs/?q=react", "browserHtml": true}' \
  https://api.zyte.com/v1/extract
```

Expect a JSON response with `browserHtml` field containing rendered HTML. If you get a 401, the key is wrong. If you get a 402, billing isn't set up.

### 5.2 Zyte adapter (production-grade upgrade)

Phase 2 shipped a Zyte adapter (`packages/scraping/src/zyte.ts`). Production-grade upgrade list:

**Per-source URL builders.** Extract URL construction into per-source functions:

```typescript
// packages/scraping/src/zyte/sources.ts
export function upworkSearchUrl(query: string): string {
  return `https://www.upwork.com/nx/search/jobs/?q=${encodeURIComponent(query)}&sort=recency`;
}
export function linkedinSearchUrl(query: string): string {
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&f_TPR=r604800`;
}
// ... indeed, contra, freelancer, reddit, x
```

The scout function takes a `sources: SourceType[]` parameter and runs Zyte against each. Currently we only do Upwork; expand in Phase 3.

**Per-source parser modules.** Each source has different HTML/JSON shape. Parse them in dedicated files:

```
packages/scraping/src/zyte/
├── client.ts          # makeZyteScraper, base HTTP
├── sources.ts         # URL builders
└── parsers/
    ├── upwork.ts
    ├── linkedin.ts
    ├── indeed.ts
    └── ...
```

Each parser exports `parse(browserHtml: string, sourceUrl: string): ScrapedLead[]`. The scraper's `scrape()` method dispatches to the right parser based on the source URL.

**Hardening.** Two-strategy fallback per parser (Phase 2's `state-walk + DOM regex` approach was right). On parse failure, log the raw HTML to a `scrape_failures` table for offline debugging:

```sql
create table scrape_failures (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  url text not null,
  raw_html text,
  parser_strategy text,
  error_message text,
  created_at timestamptz default now()
);
```

This is invaluable when Upwork or LinkedIn changes their HTML and the parser breaks — you have the original page content to update the parser against.

**Rate limiting per source.** Each source has different tolerance. Throttle inside the adapter:

```typescript
const RATE_LIMITS = {
  upwork:   { rpm: 10 },  // generous
  linkedin: { rpm: 4 },   // very strict
  indeed:   { rpm: 8 },
  // ...
};
```

Use a simple per-source token bucket. On exceeded, queue requests rather than failing.

**Retries.** On transient failure (network, 5xx), retry with exponential backoff: 1s, 4s, 16s. Max 3 attempts. After that, fail over to Firecrawl.

### 5.3 Firecrawl self-hosted secondary

Firecrawl ([github.com/mendableai/firecrawl](https://github.com/mendableai/firecrawl)) is open-source. Self-hosting is the only way to use it free at this scale.

**Self-hosting walkthrough:**

1. Provision a small VPS — Hetzner CX22 (~€4/month) or DigitalOcean basic droplet.
2. SSH in, install Docker.
3. Clone and run:
   ```bash
   git clone https://github.com/mendableai/firecrawl.git
   cd firecrawl
   cp apps/api/.env.example apps/api/.env
   # Edit .env: set USE_DB_AUTHENTICATION=false (we manage auth ourselves)
   docker compose up -d
   ```
4. The API runs on `:3002` by default. Reverse-proxy via nginx or Caddy with SSL (Let's Encrypt).
5. Set `FIRECRAWL_URL=https://firecrawl.your-domain.com` and `FIRECRAWL_API_KEY=<some-shared-secret>` in our `.env`.

**Adapter:**

```typescript
// packages/scraping/src/firecrawl.ts
export function makeFirecrawlScraper(url: string, apiKey: string): Scraper {
  return {
    name: "firecrawl",
    async scrape(query, limit) {
      // For each source URL, POST to {url}/v1/scrape with formats=['markdown', 'html']
      // Parse markdown via the same per-source parsers (markdown is more stable than HTML)
      // ...
    }
  };
}
```

**Why Firecrawl as secondary:** when Zyte's free tier is exhausted, Firecrawl on a $5/mo VPS handles unlimited requests. Slower (10-30s vs Zyte's 3-8s) but works. Production users with their own infra get a path.

### 5.4 Stub scraper

Already exists. Phase 2 shipped 12 deterministic fixtures. **Keep it as the default for dev environments.** Production env (`NODE_ENV=production`) errors if SCRAPER is unset or `stub` — production must use a real scraper.

### 5.5 Scraper interface (final)

```typescript
// packages/scraping/src/types.ts
export type SourceType =
  | "upwork" | "linkedin" | "indeed" | "freelancer"
  | "contra" | "reddit" | "x" | "github" | "other";

export interface ScrapedLead {
  source: SourceType;
  source_url: string;
  title: string;
  description: string;
  posted_at: Date;
  budget_text: string | null;
  raw: unknown;
}

export interface ScrapeRequest {
  query: string;
  limit: number;
  sources?: SourceType[];  // defaults to ['upwork']
  user_id: string;          // for rate limit accounting
}

export interface Scraper {
  name: string;
  scrape(req: ScrapeRequest): Promise<ScrapedLead[]>;
  health(): Promise<{ ok: boolean; latency_ms?: number; error?: string }>;
}
```

The `health()` method is new — the scout function calls it before scraping; if unhealthy, fail over to the next configured scraper.

### Checkpoint — scraping

- [ ] Zyte API key works against the curl smoke test.
- [ ] `packages/scraping/src/zyte/parsers/upwork.ts` returns valid `ScrapedLead[]` from a real Upwork search HTML.
- [ ] LinkedIn, Indeed, Reddit parsers exist (best-effort; LinkedIn especially is fragile, document the HTML pattern).
- [ ] Firecrawl adapter exists and is callable (even if no Firecrawl instance is running yet).
- [ ] Stub remains the default for `NODE_ENV !== 'production'`.
- [ ] `scrape_failures` table created.
- [ ] Per-source rate limits in place.

---

## 6. OpenClaw integration — the agent runtime

This section is critical and has been under-specified until now. OpenClaw is not optional — the entire chat-platform integration and agent reasoning loop runs through it. Production-grade means treating OpenClaw as a real dependency with a versioned, documented integration surface.

### 6.1 What OpenClaw is

OpenClaw (https://github.com/openclaw/openclaw) is an open-source self-hosted AI agent platform created by Peter Steinberger (founder of PSPDFKit). As of mid-2026, it has crossed 100k GitHub stars in its first week and is actively maintained, with daily releases and 50+ official channel and tool plugins. The project's affectionate name is "Molty" (a space lobster), reflected in the brand mark.

**Critical: OpenClaw is NOT an npm library you embed in your app.** It is a standalone application — a long-lived Node.js process called the *Gateway* — that you deploy alongside our app. We integrate with it through three contracts: skill files in its workspace directory, MCP tools registered as plugins, and its WebSocket control plane (default port 18789) when our app needs to query its state.

What OpenClaw provides:

- **The Gateway** — a single long-running process that handles message routing, session management, authentication, and tool dispatch. Default bind: `ws://127.0.0.1:18789` (loopback), with secure remote modes for production.
- **Channel adapters (built-in)** — WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage (via BlueBubbles), Microsoft Teams, Matrix, WebChat, plus 15+ others. Each is a plugin shipped with OpenClaw or installable via its plugin system.
- **Skill loading** — drop markdown files into `~/.openclaw/workspace/skills/` (or the equivalent path on the deployment) with YAML frontmatter and the agent indexes and routes to them automatically.
- **Multi-LLM provider support** — Anthropic, OpenAI, Google Gemini, Groq, OpenRouter, and Ollama for local models. Built-in. We don't have to write provider adapters for OpenClaw; we configure which provider it uses.
- **Browser, file, cron, sessions tools** — out of the box.
- **macOS menu bar app + iOS/Android companion nodes** — for users who want a native client beyond chat.
- **Multi-agent routing** — route different channels or accounts to isolated agent workspaces, each with its own session history and system prompt.
- **CLI (`openclaw onboard`, `openclaw doctor`, `openclaw security audit`, etc.)** — first-class operations commands.

What OpenClaw does NOT provide:

- A SaaS dashboard for end users (we're building that).
- Domain-specific business logic (lead scoring, pitch drafting, client memory).
- Persistent multi-tenant database (we use Supabase).
- A Web Auth system (each Gateway instance is single-operator-trust by design).

Our product, Venture Partner, is a closed-source agent that customizes an OpenClaw deployment with our skills, MCP tools, and an integrated web dashboard backed by Supabase.

### 6.2 How users will actually use OpenClaw with our product

There are three deployment models, each with different tradeoffs. The choice is a Phase 6 product decision, but we should design the architecture to support all three.

**Model A — Hosted by us (multi-tenant per-user instances).** We run a fleet of OpenClaw Gateways, one per user, on Railway or similar. User signs up on our dashboard, we provision an OpenClaw instance for them, they connect their Telegram by entering a code into our bot which binds their Telegram user ID to their `profiles` row. Lowest friction for users; highest infrastructure cost and complexity for us.

**Model B — Self-hosted by the user (BYO Gateway).** User runs their own OpenClaw Gateway (Railway template, DigitalOcean 1-Click, or local install). They configure it to point at our hosted skill bundle and MCP tool endpoints. We provide the integration package and the dashboard; they own their Gateway. Highest user privacy; some friction at signup. This is the default OpenClaw philosophy — local-first, user-controlled.

**Model C — Hybrid.** We offer both. Free tier: BYO Gateway. Paid tier: we host. Users on free tier never have their data leave their machine; users on paid tier trade some privacy for zero-setup convenience.

**Recommendation for the build:** design the integration so that switching between A, B, and C is configuration, not code changes. The skills are static `.md` files that ship with our product. The MCP tools are HTTPS endpoints exposed by our Next.js app. The Gateway connects to our endpoints over the network, regardless of where the Gateway runs. Decision can be deferred safely to Phase 6 if we keep the integration HTTP-based.

For Phase 3 development specifically, **use Model A on your own dev environment**: a Railway-deployed OpenClaw instance pointed at your local Next.js dev server (via tunnel — Tailscale, ngrok, or similar) for MCP tool calls. This lets you iterate on the integration without juggling local long-running processes.

### 6.3 Ownership boundary — what OpenClaw owns vs what we own

This diagram is the most important reference for the entire integration. Read it carefully. Internalize it. When in doubt during Phase 3 onward, return here.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              OpenClaw owns                                    │
│                       (do not reimplement these)                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  • Telegram / Discord / Slack / WhatsApp adapters (message I/O, webhooks)    │
│  • Inline-keyboard rendering and callback parsing per platform               │
│  • Multi-platform message normalization (text, buttons, attachments)         │
│  • Skill-loading system (reads our .md files, parses frontmatter, indexes    │
│    triggers)                                                                  │
│  • Trigger matching (exact phrase + LLM-based intent classification)         │
│  • The agent reasoning loop (calls LLM, decides skill, calls tools, streams) │
│  • MCP tool registration and invocation (with parameter validation)          │
│  • Conversation state (per-user, per-platform, short-term memory)            │
│  • Streaming response handling (Telegram message edits, etc.)                │
│  • Rate-limiting per platform's protocol (don't flood Telegram, etc.)        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │  we provide → it consumes
                                    │
┌──────────────────────────────────────────────────────────────────────────────┐
│                              We own                                           │
│              (everything outside the chat-runtime concern)                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  • LLM provider config for OpenClaw (we configure the chain, OpenClaw uses it) │
│  • Our internal LLM client for worker-side calls (scoring, drafting, etc.)   │
│  • Skill content — every .md file in apps/agent/skills/ is ours              │
│  • MCP tool implementations — every function in apps/agent/src/mcp-tools/    │
│    is ours (runScout, draftPitch, approvePitch, etc.)                        │
│  • Supabase database — leads, scores, pitches, approvals, audit_log          │
│  • Inngest workers — scout pipeline, pitch drafting, email send, lighthouse  │
│  • Web dashboard — Next.js, talks to Supabase directly, never via OpenClaw   │
│  • Auth — Supabase Auth, sessions, RLS                                       │
│  • Resend integration — email sending lives in our worker, not OpenClaw      │
│  • payload_hash security model — verification happens in our API routes      │
│  • Persistent client memory (clients.memory_md) — Supabase, not OpenClaw     │
│  • Long-term user memory and analytics — our domain                          │
│  • All business rules, scoring rubrics, prompt content                       │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

The integration surface — the seam between OpenClaw and us — is exactly two things:

1. **Configuration handoff (one-time, at agent start).** We pass into the OpenClaw constructor: our LLM client, the path to our skills directory, our list of MCP tools, the active platform adapters with their tokens.

2. **MCP tool calls (per-message, runtime).** When OpenClaw decides a user message should trigger an action, it calls into our MCP tool functions. The tool function does the actual work (database query, Inngest event, etc.) and returns a result that OpenClaw streams back to the user.

Everything else is one-way: OpenClaw uses our LLM client, our skills, our tools, but doesn't reach beyond them into the database or the dashboard or the workers. Our workers and dashboard never call into OpenClaw — they read/write Supabase, and OpenClaw observes those changes either through MCP-tool round-trips or through its own subscriptions when needed.

### 6.4 The two surfaces: web vs chat

Users interact with Venture Partner through two surfaces. They are **architecturally independent** but **share state through Supabase.**

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│       WEB SURFACE           │         │       CHAT SURFACE          │
│   (Next.js dashboard)       │         │   (Telegram + others)       │
│                             │         │                             │
│   User clicks button        │         │   User types message        │
│       │                     │         │       │                     │
│       ▼                     │         │       ▼                     │
│   Next.js API route         │         │   OpenClaw (skill match)    │
│       │                     │         │       │                     │
│       │                     │         │       ▼                     │
│       │                     │         │   OpenClaw → MCP tool       │
│       │                     │         │       │                     │
│       └──────────┬──────────┴─────────┴───────┘                     │
│                  │                                                   │
│                  ▼                                                   │
│         ┌────────────────────────┐                                   │
│         │  Inngest event fires   │                                   │
│         │  OR direct DB write    │                                   │
│         └────────┬───────────────┘                                   │
│                  │                                                   │
│                  ▼                                                   │
│         ┌────────────────────────┐                                   │
│         │   Worker executes      │                                   │
│         │   (scrape/score/draft) │                                   │
│         └────────┬───────────────┘                                   │
│                  │                                                   │
│                  ▼                                                   │
│         ┌────────────────────────┐                                   │
│         │   Supabase write       │                                   │
│         │   (leads/pitches/etc)  │                                   │
│         └────────┬───────────────┘                                   │
│                  │                                                   │
│                  ▼                                                   │
│         ┌────────────────────────┐                                   │
│         │  Realtime broadcast    │                                   │
│         └─┬──────────────────┬───┘                                   │
│           │                  │                                       │
│           ▼                  ▼                                       │
│   ┌──────────────┐    ┌──────────────────┐                           │
│   │  Web tab(s)  │    │ OpenClaw watcher │                           │
│   │   updates    │    │  → Telegram msg  │                           │
│   └──────────────┘    └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

Notice: the two surfaces converge at the worker / Supabase layer. Whether the action started on web or in Telegram, it enters the same pipeline. A pitch drafted by a button click on the web can be approved by tapping a Telegram inline button — because both routes write to the same `pitches` row and read the same `payload_hash`.

This is the architectural payoff of using OpenClaw correctly: chat is a peer surface, not a hack-on. Phase 3's HITL approval flow lights up both surfaces simultaneously without any extra coordination logic.

### 6.5 Concrete data flow — full Telegram-driven example

Walk through this once, end to end, before writing any Phase 3 code. It's the canonical example of how OpenClaw, our code, and the database collaborate.

**User action:** opens Telegram on phone, types `draft a pitch for the top lead`.

**Step 1 — Telegram → OpenClaw.** Telegram's Bot API delivers the incoming message to OpenClaw via webhook (or long-polling). OpenClaw's Telegram adapter normalizes it into `{ user_telegram_id: 123456, text: "draft a pitch for the top lead", platform: "telegram" }`.

**Step 2 — OpenClaw user binding.** OpenClaw queries `profiles` where `telegram_user_id = 123456` to find the corresponding `user_id`. (We seed this binding during onboarding — the user enters a code from the dashboard into the bot, the bot sets the field.)

**Step 3 — OpenClaw skill match.** OpenClaw scans loaded skills. `draft_pitch.skill.md` has a trigger matching `"draft (a )?pitch for {target}"`. Matches. Extracts `{target}` = `"the top lead"`.

**Step 4 — OpenClaw → our LLM client (disambiguation).** "The top lead" is ambiguous. OpenClaw calls our LLM with a small prompt asking which lead the user means, given the recent leads list. The skill body has guidance for this. To get the recent leads, OpenClaw calls our `getTopLead` MCP tool.

**Step 5 — MCP tool → Supabase.** `getTopLead({ user_id })` runs `select * from leads inner join scores on ... where user_id = $1 order by scores.score desc limit 1`. Returns the lead. OpenClaw uses it to confirm with the user: *"You mean: 'Senior Next.js engineer for SaaS dashboard rebuild' (score 95)?"* User replies `yes`.

**Step 6 — OpenClaw → MCP tool (the action).** OpenClaw calls our `draftPitch` MCP tool with `{ user_id, lead_id }`. The tool fires an Inngest event `pitch/draft-requested` and returns `{ ok: true, message: "Drafting now..." }`. OpenClaw relays this to the user via Telegram.

**Step 7 — Inngest worker runs.** The worker (`apps/worker/src/functions/draftPitch.ts`) picks up the event. It loads the lead, the user's profile, and (Phase 5+) any client memory. Calls our LLM client with the `draft-pitch` prompt. Computes `payload_hash`. Inserts a new row into `pitches` with `status='draft'`. Broadcasts on the `pitch:{user_id}` Realtime channel.

**Step 8 — Web dashboard updates.** If the user has the dashboard open in a browser, the new pitch appears live in the LeadDetail panel via Realtime subscription.

**Step 9 — OpenClaw delivers to Telegram.** Either through a separate Realtime watcher process inside OpenClaw, or because our worker also calls a `notifyPitchReady` MCP tool, OpenClaw sends a Telegram message to the user's chat with the drafted pitch text and an inline keyboard: `[ ✅ Approve & send ]   [ ✏️ Edit ]   [ ❌ Reject ]`. The button payloads include `pitch_id` and `payload_hash`.

**Step 10 — User taps Approve.** Telegram sends a callback query to OpenClaw's adapter with the button's payload.

**Step 11 — OpenClaw → MCP tool (approval).** OpenClaw extracts the payload, calls our `approvePitch` MCP tool with `{ pitch_id, payload_hash, user_id, actor_platform: "telegram" }`. The tool POSTs to our internal approval handler (or calls the same logic directly).

**Step 12 — Approval handler runs payload-hash verification.** Per section 10. Loads the pitch, recomputes the expected hash, compares. If matched, writes `approvals` row, fires `pitch/approved` event. If not matched, returns 409 — OpenClaw replies to the user: *"Pitch has changed since you reviewed it. Please open the dashboard to review the latest version."*

**Step 13 — Send worker runs.** `pitch/approved` is delivered to `apps/worker/src/functions/sendPitch.ts`. Loads pitch + lead. Calls Resend. Updates `pitches.sent_at`. Audit-logs.

**Step 14 — Confirmation.** Worker broadcasts on Realtime; web dashboard's pitch row flips to `sent`. OpenClaw also receives the broadcast (or another MCP-tool round trip), sends a final Telegram confirmation: *"Sent ✅. Reply tracking enabled."*

That's the complete flow. OpenClaw is in steps 1, 2, 3, 4, 6, 9, 11, 14. Our code is in everything else. The database is the single source of truth tying both surfaces together.

### 6.6 OpenClaw audit results — what we actually have to work with

The audit was conducted before this document was finalized. Findings, with their implications for the Phase 3 build:

**Maturity and adoption.** OpenClaw is one of the fastest-growing open-source projects in GitHub history — 100k+ stars within its first week of launch (late January 2026), 368k+ stars total. Daily release cadence. Wide ecosystem of community plugins. This is a mature, stable foundation, not a hobby project. Treat it like Express or React in stability terms.

**Distribution model.** OpenClaw is distributed as:
- Direct install: `npm install -g openclaw` (the CLI is the primary entry point)
- Docker image (official, multi-arch)
- DigitalOcean 1-Click Marketplace
- Railway one-click template ([railway.com/deploy/self-host-openclaw](https://railway.com/deploy/self-host-openclaw))
- Fly.io supported pattern with managed HTTPS
- Nix package
- Source build for development

**There is no `@openclaw/runtime` npm library to import.** OpenClaw is an application, not a library. We deploy it; we don't embed it.

**Telegram adapter.** Built-in, mature, supports inline keyboards and callback queries (verified — required for HITL approval). The Telegram channel plugin ships with the core OpenClaw package.

**Skill system.** Yes, exactly as we designed our skills around. Skills are markdown files with YAML frontmatter, stored in `~/.openclaw/workspace/skills/` (or the configured workspace path). Both bundled (with OpenClaw), managed (via plugin system), and workspace (custom user files) skills are supported.

**MCP support.** OpenClaw integrates with MCP servers as a first-class plugin type. We expose our backend tools as an MCP server (HTTPS endpoint with the standard MCP protocol) and OpenClaw connects to it. This is the production-clean integration path; we don't try to wedge our tools into OpenClaw's plugin system as TypeScript imports.

**LLM providers.** OpenClaw natively supports Anthropic, OpenAI, Google Gemini, Groq, OpenRouter, and Ollama. **All five of our intended providers are first-class.** We configure OpenClaw to use our provider chain via its config; we don't pass our own LLM client into it the way I previously assumed. Our Next.js workers continue to use our own LLM client for non-OpenClaw LLM calls (scoring, drafting, etc. that run server-side on Inngest).

**Streaming.** Telegram message-edit-based streaming is supported.

**Active maintenance.** Active. Multiple commits per day from multiple contributors. Created by Peter Steinberger; community-driven going forward.

**What this means for our build:**

1. **No vendoring required.** We use upstream OpenClaw via a deployment template.
2. **No "agent runtime" to write.** We don't run `apps/agent` as a Node process. Our `apps/agent/` directory becomes a *resource bundle* — skills (`.md` files), MCP tool implementations (HTTPS handlers), config templates — that gets shipped to (or referenced by) the OpenClaw Gateway.
3. **Two of our LLM providers run in two places.** OpenClaw uses our provider chain when *it* makes LLM calls (parsing user intent, drafting chat responses). Our Inngest workers use our own LLM client when *they* make LLM calls (scoring leads, drafting pitches). Both providers point at the same upstream APIs (Copilot, Gemini, Groq, OpenRouter, Anthropic-dormant). We pay once.
4. **The Gateway is the deployment unit.** Phase 6 (production hardening) sets up our hosted Gateway service. Phase 3 development uses a Railway dev instance.

This audit replaces the "do the audit before Phase 3" task. Phase 3 begins with implementation, not investigation. If during Phase 3 something turns out to be different from this audit (a feature was deprecated, the deployment template changed, etc.), surface it immediately as a blocker. But the architectural plan can proceed with confidence.

### 6.7 Setup — deploying and integrating OpenClaw

The setup is a four-stage flow: (a) deploy a Gateway, (b) drop our skills into its workspace, (c) expose our MCP tools as an HTTPS endpoint, (d) configure the Gateway to point at our provider chain and our MCP server.

**Stage A — Deploy a Gateway (development).**

For Phase 3 development, deploy via the Railway one-click template:

1. Go to [railway.com/deploy/self-host-openclaw](https://railway.com/deploy/self-host-openclaw).
2. Click "Deploy on Railway." Sign in with GitHub.
3. Name the service `openclaw-vp-dev`.
4. Wait ~1 minute for the build.
5. Open the deployed service URL — it redirects to `/setup`, OpenClaw's first-run wizard.
6. In the wizard:
   - **AI provider:** select OpenRouter (we'll override later via config to use the full chain). Paste your `OPENROUTER_API_KEY`.
   - **Channel:** select Telegram. Paste your `TELEGRAM_BOT_TOKEN` (from BotFather).
   - **Admin password:** set one, save it in 1Password.
7. The Gateway starts. The wizard hands off to `/admin`.
8. Save the Railway service URL (e.g. `https://openclaw-vp-dev.up.railway.app`) and the `OPENCLAW_GATEWAY_TOKEN` from environment variables — we'll need both in our `.env`.

For production, repeat with a `openclaw-vp-prod` service. Use Railway's environment variable separation. Production gets its own Telegram bot (different `@BotFather` setup so dev and prod don't clobber each other's webhooks).

**Stage B — Author and ship skills.**

Skills live in `apps/agent/skills/` in our repo as the source of truth. They get deployed to the OpenClaw Gateway's workspace via one of two paths:

- **Easy path (Phase 3):** Manually upload skills through the OpenClaw `/admin` UI when they change. Acceptable for development; not for production.
- **Production path (Phase 6):** Build a `pnpm --filter @openclaw/agent deploy-skills` command that pushes our skill files to the Gateway via its admin API. Triggered manually or via CI.

Each skill is a markdown file. The format OpenClaw expects:

```markdown
---
name: scout
description: Find new freelance leads from job boards.
triggers:
  - "find leads"
  - "scout {query}"
  - "find jobs for {query}"
---

# Scout

When a user asks me to find leads:

1. Confirm query (ask if missing).
2. Confirm sources (default: Upwork only).
3. Call the `runScout` tool with `{ user_id, query, sources }`.
4. Stream progress updates as the tool reports them.
5. Send digest: "Found N new leads, top score X. View at <dashboard URL>".

# Constraints

- Never auto-trigger without explicit user request.
- Per-user budget: max 10 scout runs per day.
- If user requests an unsupported source, list supported ones.
```

OpenClaw's skill loader picks these up automatically. Trigger matching is handled by OpenClaw (exact phrase + LLM-based fallback).

The full skill list for our product (final):

```
apps/agent/skills/
├── scout.skill.md
├── draft_pitch.skill.md
├── approve_pitch.skill.md
├── reject_pitch.skill.md
├── reply_to_email.skill.md
├── client_memory.skill.md
├── lighthouse_audit.skill.md
├── show_top_lead.skill.md
└── help.skill.md
```

**Stage C — Expose MCP tools as an HTTPS endpoint.**

This is the integration seam between OpenClaw and our Next.js app. We run an MCP server at `apps/web/app/api/mcp/route.ts` that:

1. Authenticates incoming requests via a shared secret (`MCP_SHARED_SECRET` in `.env`, set on both sides).
2. Identifies the calling user via the binding between OpenClaw's session and our `profiles.telegram_user_id` (or other platform binding).
3. Routes tool calls to handlers.
4. Returns MCP-protocol-compliant responses.

```typescript
// apps/web/app/api/mcp/route.ts
import { McpServer } from "@modelcontextprotocol/sdk/server";
import { runScoutHandler, draftPitchHandler, approvePitchHandler /* ... */ } from "@openclaw/agent/mcp-tools";
import { authenticateMcpRequest } from "@/lib/mcp-auth";

const server = new McpServer({ name: "openclaw-vp", version: "1.0.0" });

server.tool("runScout", runScoutHandler.schema, async (args, ctx) => {
  const userId = await authenticateMcpRequest(ctx.request);
  return runScoutHandler.execute({ ...args, user_id: userId });
});

server.tool("draftPitch", /* ... */);
server.tool("approvePitch", /* ... */);
// ...

export const POST = server.handler();
```

The handlers themselves live in `packages/agent/src/mcp-tools/` and are pure functions:

```typescript
// packages/agent/src/mcp-tools/runScout.ts
import { z } from "zod";
import { inngest } from "@openclaw/worker/inngest";

export const runScoutHandler = {
  schema: z.object({
    query: z.string().min(2).max(120),
    sources: z.array(z.enum(["upwork", "linkedin", "indeed", "reddit"])).optional(),
  }),
  execute: async (input: { user_id: string; query: string; sources?: string[] }) => {
    await inngest.send({
      name: "scout/requested",
      data: input,
    });
    return { ok: true, message: "Scout queued. I'll update you as leads come in." };
  },
};
```

The full MCP tool list:

| Tool | Purpose |
|---|---|
| `runScout` | Trigger a scout pipeline for a query |
| `getRecentLeads` | Fetch top-N leads for the user, optionally by score band |
| `getTopLead` | Fetch the single top-scored lead (used for "the top lead" disambiguation) |
| `draftPitch` | Trigger pitch draft generation for a lead |
| `getPendingPitches` | List pitches awaiting approval |
| `approvePitch` | Verify payload_hash and fire pitch/approved event |
| `rejectPitch` | Mark a pitch rejected |
| `editPitch` | Update a pitch's draft, recompute payload_hash |
| `getClientMemory` | Fetch a client's memory_md |
| `updateClientMemory` | Diff-based update to memory_md (Phase 5) |
| `runLighthouseAudit` | Trigger Lighthouse audit job (Phase 4) |
| `getDashboardUrl` | Return a deep link to a specific lead/pitch in the web dashboard |
| `bindTelegram` | Match a 6-digit code to a Telegram user ID, write `profiles.telegram_user_id` |
| `bindDiscord` | Match a 6-digit code to a Discord user ID, write `profiles.discord_user_id` |
| `notifyAgent` | Worker → OpenClaw callback to push a message to a user's chat session (worker-secret only) |

Each tool is one file in `packages/agent/src/mcp-tools/`. Each tool has Zod schema validation. Each tool's `user_id` is *injected by the auth layer*, never accepted from the caller — the OpenClaw Gateway authenticates with our shared secret, but the user identity comes from the Telegram (or other platform) binding, not from request body.

**Stage D — Configure the Gateway.**

OpenClaw's config file (`openclaw.json` or via the admin UI) needs to be set to:

1. **Use our LLM provider chain.** OpenClaw supports configuring multiple providers with fallback. Set Copilot → Gemini → Groq → OpenRouter → Anthropic-dormant in the same priority order our internal LLM client uses. If OpenClaw's plugin model only allows one provider at a time at the time of build, default to OpenRouter (which is itself a meta-router with the others as backends) and accept the slight loss of routing precision at the OpenClaw layer. Our internal LLM client's full 5-chain still applies to all worker-side LLM calls.

2. **Connect to our MCP server.** Add an MCP server entry pointing at `https://your-vercel-app.vercel.app/api/mcp` with the shared secret.

3. **Telegram channel** with our bot token.

4. **Skills directory** pointed at our deployed skill bundle.

5. **Gateway auth token.** Set the `OPENCLAW_GATEWAY_TOKEN` so only our Next.js app and authorized clients can connect to the Gateway WebSocket.

The first time this is done, do it via OpenClaw's `/admin` UI to learn the system. After that, codify the config as a JSON file checked into our repo at `apps/agent/openclaw.config.json` and apply it via the OpenClaw CLI:

```bash
# In CI/CD or manually
openclaw config apply --remote https://openclaw-vp-prod.up.railway.app \
  --token $OPENCLAW_GATEWAY_TOKEN \
  --file apps/agent/openclaw.config.json
```

Phase 6 wires this into the deploy pipeline.

**Stage E — Verify the integration.**

End-to-end smoke test:

1. Open Telegram, send `/start` to the bot.
2. Bot responds with onboarding.
3. Send: `find leads for next.js dashboards`.
4. Bot replies with confirmation; you say `yes`.
5. Bot calls `runScout` MCP tool → our Next.js endpoint → fires Inngest event.
6. Worker scrapes (stub by default), scores, writes leads to Supabase.
7. Worker broadcasts on Realtime; web dashboard updates if open.
8. OpenClaw observes the worker's progress via Realtime subscription (or via a callback MCP tool — see section 6.8) and updates the Telegram message with progress.
9. When complete, bot sends digest message.

If all eight steps work, the integration is sound. Phase 3 step 6 (the Telegram approval flow) is then additive on top of this foundation.

### 6.8 OpenClaw Gateway hosting and Realtime integration

The Gateway is hosted via Railway (or DigitalOcean / Fly.io / Hetzner — Railway is recommended for the simplest one-click setup; switch later if cost or sovereignty matters).

**Local dev — three options:**

1. **Cloud-only (recommended).** Use a deployed Railway dev Gateway. Connect to it remotely. Avoids juggling a local long-lived process during development.

2. **Local Gateway + tunnel.** Install OpenClaw locally (`npm install -g openclaw`), run `openclaw onboard`, then expose your Next.js dev server (`localhost:3000`) over a tunnel (Tailscale or ngrok) so the local Gateway can reach our MCP endpoint. Useful when iterating on Gateway config or skill content.

3. **Docker compose.** OpenClaw + a tunnel + our Next.js app in one `docker-compose.yml`. Most setup-heavy; gives full local control. Skip unless 1 and 2 prove insufficient.

For Phase 3, default to **option 1**.

**Production deployment.** Railway service (`openclaw-vp-prod`) with these characteristics:

- Auto-deploys from a designated branch when the OpenClaw config or skill bundle changes.
- Persistent Railway Volume mounted at `/root/.openclaw` for state, sessions, and credentials.
- `OPENCLAW_GATEWAY_TOKEN` set; loopback-only Gateway mode disabled (we need remote connections from our Vercel app); strict allowlist on incoming connections (Vercel egress IPs + admin user).
- Health checks at the Gateway's standard `/health` endpoint.
- Sentry integration via the OpenClaw plugin if available; otherwise pipe Gateway logs to our shared logging.

**How OpenClaw stays in sync with our Realtime broadcasts.**

This is the architectural detail that makes the chat/web interplay work. When a worker writes to Supabase and broadcasts on a Realtime channel (e.g., `pitch:{user_id}`), the OpenClaw side needs to know — otherwise the Telegram bot can't respond to events the user triggered from the dashboard.

Two options:

**Option 1 — OpenClaw subscribes to Supabase Realtime directly.** A custom OpenClaw plugin (we author it) opens a Realtime connection on Gateway startup, subscribes to relevant channels, and dispatches incoming events to active conversations. Cleaner architecture; requires writing one plugin (~150 lines).

**Option 2 — Worker calls back into OpenClaw via MCP-tool-style HTTPS.** The worker, when it finishes a job, POSTs to a `notifyAgent` endpoint exposed by OpenClaw (custom MCP tool registered by us). The endpoint pushes a message to the relevant chat session. Simpler; requires OpenClaw to expose a write endpoint we can call.

**Recommended: option 2 for Phase 3, migrate to option 1 in Phase 6** if needed for performance. Option 2 has the integration point clearly visible (HTTPS call, easy to debug). Option 1 is more efficient at scale but adds a Realtime subscription per Gateway instance.

The `notifyAgent` MCP tool is added to our tool list:

```typescript
// packages/agent/src/mcp-tools/notifyAgent.ts
// Called by our workers, NOT by skills. Authenticated with a separate worker secret.
export const notifyAgent = {
  schema: z.object({
    user_id: z.string().uuid(),
    kind: z.enum(["pitch_drafted", "scout_complete", "reply_received"]),
    payload: z.record(z.unknown()),
  }),
  execute: async (input) => {
    // POST to OpenClaw's HTTP API: send a message to the user's active session
    // ...
  },
};
```

This tool flows the *opposite* direction: worker → OpenClaw → Telegram. The other tools flow Telegram → OpenClaw → our app.

### 6.9 Skill: scout.skill.md (full example)

```markdown
---
name: scout
description: Find new freelance leads from job boards matching the operator's profile.
triggers:
  - "find leads"
  - "scout {query}"
  - "find jobs for {query}"
parameters:
  query:
    type: string
    description: The job search query (e.g., "react next.js", "python data engineer")
  sources:
    type: array
    description: Which sources to search (default upwork only)
    default: ["upwork"]
---

# Scout

I help operators find freelance leads. When triggered:

1. **Confirm query.** If query is missing, I ask: "What kind of work are you looking for?"
2. **Confirm sources.** Default is Upwork only. If the user wants more, they say "include LinkedIn" etc.
3. **Trigger scout.** Call MCP tool `runScout({ user_id, query, sources })`. This sends an Inngest event; the actual scraping/scoring runs in the worker.
4. **Stream progress.** As the worker broadcasts progress events on `scout:{user_id}` Realtime channel, relay them to the user: "Scouting Upwork...", "Scored 12 leads, top score 92."
5. **Send digest.** When complete: "Found N leads. Top: '<title>' scored {score}/100. View all at <dashboard URL>/inbox".

# Constraints

- Never auto-trigger a scout without explicit user request.
- Per-user budget: max 10 scout runs per day to control LLM costs (we score every lead with an LLM call).
- If the user requests a source we don't support yet (e.g., AngelList), explain the supported list and ask which to use.
```

### Checkpoint — OpenClaw

- [ ] Railway dev Gateway deployed and reachable.
- [ ] `/setup` wizard completed; admin password saved in 1Password; gateway token stored in our `.env` as `OPENCLAW_GATEWAY_TOKEN`.
- [ ] Telegram bot reachable; `/start` returns onboarding response.
- [ ] At least three skills authored (`scout`, `draft_pitch`, `help`) and uploaded to the Gateway workspace.
- [ ] MCP server endpoint live at `apps/web/app/api/mcp/route.ts`, authenticated by `MCP_SHARED_SECRET`.
- [ ] At least three MCP tools implemented (`runScout`, `getTopLead`, `notifyAgent`).
- [ ] OpenClaw Gateway configured to call our MCP endpoint; one round-trip verified end-to-end.
- [ ] Discord, Slack, WhatsApp scaffolded only — env vars in `.env.example`, channels not enabled in Gateway config.
- [ ] `apps/agent/openclaw.config.json` checked into the repo as the canonical Gateway configuration.

---

## 7. Chat platforms — Telegram and Discord primary, others scaffolded

Both Telegram and Discord are fully wired and tested as part of the build. WhatsApp and Slack remain configured-but-inactive: env vars in `.env.example`, OpenClaw plugins listed but disabled in `apps/agent/openclaw.config.json`. They activate on demand by flipping config flags, no new code required.

The reason for two primaries: Telegram covers the international and broad-audience case, Discord covers the tech-creator audience that maps directly to our target user (React/Next.js freelancers, designers, growth-focused operators — the demographic that lives in Discord servers daily). Together they cover ~95% of the realistic target audience without diluting the demo narrative.

Note that none of these adapters are code we write. They are OpenClaw plugins configured in the Gateway. Our work per platform is: register the bot/app on the platform's side, paste the credentials into the Gateway config, validate the approval flow renders correctly with that platform's keyboard/embed system, write per-platform UX tweaks where they matter.

### 7.1 Telegram (primary)

**Bot setup:**

1. In Telegram, message `@BotFather`.
2. `/newbot` → name it `OpenClaw Venture Partner` (or your chosen brand name) → username `openclaw_vp_bot` (must end in `bot` or `_bot`).
3. BotFather returns a token. Set `TELEGRAM_BOT_TOKEN=<token>` in `.env`.
4. `/setdescription` to set bot description.
5. `/setcommands` and paste:
   ```
   start - Get started with the agent
   scout - Find new leads
   pitches - Show pending pitch approvals
   clients - View active client memory
   help - Show available commands
   ```
6. In Gateway config: enable the `telegram` channel plugin, paste the bot token, restart the Gateway.

**User binding.** Each user in `profiles` has a `telegram_user_id` field (migration 0005). On first interaction, the user sends `/start` to the bot. OpenClaw extracts their Telegram numeric user ID. The bot prompts: *"Open the dashboard at <url>/settings/connect, copy your linking code, and send it to me."* When the user pastes the 6-digit code, the bot calls our `bindTelegram` MCP tool which writes `telegram_user_id` to their profile. Subsequent messages are recognized as that user automatically.

**Inline keyboard for approvals.** When a pitch is drafted, the bot sends:

```
🎯 New pitch ready · score 92
"Senior Next.js engineer for SaaS dashboard rebuild"
Upwork · $5,500 fixed

> Hi Jamie — saw your post about the SaaS analytics dashboard
> rebuild. I rebuilt a similar dashboard last month:
> <link to portfolio item>. Loads ~3× faster than the previous
> Next.js 13 version. ~3 weeks for the full rebuild.
> Can I share the project?

[ ✅ Approve & send ]   [ ✏️ Edit ]   [ ❌ Reject ]
```

The buttons are Telegram inline keyboard callbacks. Each button's `callback_data` includes the `pitch_id` and `payload_hash` (see section 10). Tapping Approve flows to OpenClaw's callback handler, which calls our `approvePitch` MCP tool.

Telegram callback_data has a 64-byte limit, which is tight for a UUID + SHA-256 hash. Strategy: store a short token in our DB referencing the (`pitch_id`, `payload_hash`) tuple, embed only the token in `callback_data`. The callback handler resolves the token to its tuple before calling the MCP tool. Token is one-time-use, expires in 24 hours.

**Streaming responses.** Telegram supports message-edit-based streaming. When the agent works on something slow (drafting a pitch, running a Lighthouse audit), OpenClaw sends an initial "Drafting..." message, then edits it every ~500ms with progress. Telegram has a 30 messages/sec rate limit per chat — well under our needs.

**Per-platform UX notes:**
- Telegram supports markdown formatting, but its parser is fussy. Use `MarkdownV2` and escape special characters carefully. OpenClaw handles this if the channel plugin is configured for `MarkdownV2`.
- Maximum message length: 4096 characters. For longer pitch drafts, split with continuation indicators.
- Inline keyboard buttons can wrap onto multiple rows. For Approve / Edit / Reject, three columns reads cleanly. For longer button labels, two rows of two.

### 7.2 Discord (primary)

**App and bot setup:**

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications). Click "New Application." Name it `OpenClaw Venture Partner`.
2. In the app's settings, go to "Bot" → "Add Bot." Copy the **Bot Token** → set `DISCORD_BOT_TOKEN` in `.env`.
3. Copy the **Public Key** from the General Information page → set `DISCORD_PUBLIC_KEY` in `.env`. (Discord uses this to verify webhook signatures.)
4. Copy the **Application ID** → set `DISCORD_APP_ID` in `.env`.
5. Under "Bot" → enable Message Content Intent (read messages user sends to the bot in DMs).
6. Under "OAuth2" → "URL Generator," select scopes: `bot` and `applications.commands`. Select bot permissions: Send Messages, Embed Links, Use Slash Commands, Read Message History. Copy the generated URL.
7. Open the URL in a browser. It prompts you to add the bot to a Discord server. **For the dev/prod bots, do NOT add to a public server.** Add only to a dedicated test server you control. Production users will install the bot via OAuth into their own personal Discord (more on this below).
8. In Gateway config: enable the `discord` channel plugin, paste the bot token, public key, and app ID, restart the Gateway.

**User-installable mode (production).** Discord supports two installation models:
- **Server-install** — user adds your bot to a Discord server they own. Bot interacts in channels.
- **User-install (DM-only)** — user adds your bot to their *user account* and DMs it directly. No server needed.

For our product, **user-install is the right model.** Operators want their pitch approvals coming as DMs, not as messages in a public server channel. In the Discord developer portal, under "Installation," enable "User Install" and set the install link as the user-facing onboarding link. Server-install stays available for users who prefer that flow.

**User binding.** Same pattern as Telegram. Field on `profiles`: `discord_user_id` (added in migration 0005). On first DM, bot prompts for a 6-digit linking code from the dashboard. We support both binding paths simultaneously — a user can be bound to Telegram, Discord, both, or neither.

**Slash commands.** Register these on bot startup (OpenClaw's Discord plugin handles this if you configure them in the Gateway config):

```
/scout query:string - Find new leads
/pitches - Show pending pitch approvals
/clients - View active client memory
/help - Show available commands
```

**Embed for approvals.** Discord uses embeds rather than plain text for rich formatting. The pitch approval looks like:

```
┌──────────────────────────────────────────────────┐
│ 🎯 New pitch ready                    Score: 92  │  ← embed title (coral hex color)
│                                                  │
│ Senior Next.js engineer · SaaS dashboard rebuild │  ← embed description top
│ Upwork · $5,500 fixed                            │
│                                                  │
│ ─────────────────────────────────────────────    │
│                                                  │
│ Hi Jamie — saw your post about the SaaS          │  ← embed field (the draft)
│ analytics dashboard rebuild. I rebuilt a similar │
│ dashboard last month: [portfolio link]. Loads    │
│ ~3× faster than the previous Next.js 13 version. │
│ ~3 weeks for the full rebuild. Can I share?      │
│                                                  │
│ ─────────────────────────────────────────────    │
│                                                  │
│ [ ✅ Approve & send ] [ ✏️ Edit ] [ ❌ Reject ] │  ← message components (buttons)
└──────────────────────────────────────────────────┘
```

Embed color: coral `#FF4D4D` (matching brand). Embed thumbnail: the OpenClaw mark. Buttons are Discord MessageComponents; their `custom_id` contains the same short-token strategy as Telegram (DB-resolved token, not raw UUID + hash).

**Per-platform UX notes:**
- Embed character limits: title 256, description 4096, field value 1024, total embed 6000. Pitch drafts will fit within field value comfortably.
- Discord supports much richer formatting than Telegram (markdown is more permissive, code blocks, syntax highlighting).
- Embed colors must be integers (decimal representation of hex). Coral = `0xFF4D4D` = `16731981`.
- Discord rate limits are per-bot per-second; well under our needs at single-user scale.
- DM-only bots can't reach users who haven't started the conversation. The product flow has the user initiate (slash command on first install, or click an "Open in Discord" button from the web dashboard onboarding).

### 7.3 WhatsApp and Slack — scaffolded

For each, the OpenClaw plugin exists. We list env vars in `.env.example` and `ENABLE_*=false` flags in the Gateway config. They activate on demand by flipping the flag and providing credentials, no new code required.

**WhatsApp (Business Cloud API):**

```
ENABLE_WHATSAPP=false
WHATSAPP_PHONE_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_TOKEN=
WHATSAPP_VERIFY_TOKEN=
```

WhatsApp Business Cloud API requires Meta Business Verification: a Facebook Business account, an approved use case, a verified phone number, and a 24-hour reply window outside of which only pre-approved templates can be sent. Three to ten days of bureaucracy before working software. Document the activation steps in `apps/agent/openclaw.config.json` comments. Ship inactive.

When a paid customer specifically requests WhatsApp, run the activation checklist as a separate workstream.

**Slack:**

```
ENABLE_SLACK=false
SLACK_BOT_TOKEN=                         # xoxb-...
SLACK_SIGNING_SECRET=
SLACK_APP_ID=
```

Slack activation is straightforward (~30 minutes): create a Slack app at [api.slack.com/apps](https://api.slack.com/apps), enable bot token scopes (`chat:write`, `commands`, `im:history`, `im:read`, `im:write`), install to a workspace, paste credentials into Gateway config, flip `ENABLE_SLACK=true`. The activation is short enough that a user requesting it can have it the same day.

The reason Slack is not in the primary tier despite being easy: it's workplace-coded. Operators receiving personal pitch approvals in their client's Slack workspace creates trust and confidentiality friction. Telegram and Discord are personal-coded. Slack stays available for operators who specifically run their own workspace and prefer it.

### Checkpoint — chat platforms

- [ ] Telegram bot live, `/start` works, user binding flow tested with a real account.
- [ ] Telegram inline keyboard renders correctly, callbacks resolve to the correct pitch and trigger the approval handler.
- [ ] Telegram streaming (message edits during long operations) verified.
- [ ] Discord bot live, slash commands registered, user-install link tested.
- [ ] Discord embed renders with brand color, formatted draft, and three working buttons.
- [ ] Discord callback flow: tapping Approve in Discord verifies `payload_hash` against the same `pitches` row that a tap from Telegram or web would.
- [ ] Cross-platform integrity: a pitch drafted from web shows correctly in both Telegram and Discord; approving from any one of the three updates the other two via Realtime broadcast.
- [ ] WhatsApp and Slack adapter configs in `apps/agent/openclaw.config.json` are present but disabled with clear comments documenting activation steps.
- [ ] `.env.example` documents all four platforms' env vars.

---

## 8. Database — full production schema

Phase 1 shipped 8 tables. Production needs 11+. Migrations 0001-0004 already exist; this section specifies migrations 0005 onward.

### Final table list

| Table | Purpose |
|---|---|
| `profiles` | User profiles (extends `auth.users`) |
| `sources` | Configured scraping sources per user |
| `leads` | All scraped leads, ever |
| `scores` | LLM-generated scores for leads |
| `pitches` | Drafted/approved/sent pitch emails |
| `clients` | Won deals → ongoing client relationships |
| `approvals` | Audit trail of every HITL approval |
| `llm_calls` | Telemetry for every LLM call |
| `scrape_failures` | Raw HTML when parsers fail (debugging) |
| `provider_health` | Per-LLM-provider health metrics |
| `audit_log` | Append-only log of all sensitive actions |
| `email_replies` | Inbound email replies from clients (Phase 5) |
| `proof_artifacts` | Layer 2 generated artifacts (audits, sample components) |
| `scout_runs` | Per-scout-run summary (separate from individual leads) |
| `binding_codes` | One-shot codes for chat-platform binding (Telegram, Discord) |

### Migration 0005 — production hardening (apply early in Phase 3)

```sql
-- packages/db/migrations/0005_production_hardening.sql

-- Provider health tracking
create table provider_health (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  checked_at timestamptz not null default now(),
  ok boolean not null,
  latency_ms int,
  error_kind text,
  error_message text
);
create index on provider_health (provider, checked_at desc);

-- Scrape failures (raw HTML for debugging)
create table scrape_failures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  source text not null,
  url text not null,
  raw_html text,
  parser_strategy text,
  error_message text,
  created_at timestamptz default now()
);
create index on scrape_failures (created_at desc);

-- Append-only audit log
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  actor text not null,             -- 'user', 'agent', 'system'
  action text not null,            -- 'pitch.approved', 'pitch.sent', etc.
  resource_type text,
  resource_id uuid,
  payload jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);
create index on audit_log (user_id, created_at desc);
create index on audit_log (action, created_at desc);

-- Telegram binding on profiles
alter table profiles add column if not exists telegram_user_id bigint unique;
alter table profiles add column if not exists discord_user_id text unique;
alter table profiles add column if not exists slack_user_id text unique;

-- One-shot codes for chat-platform binding (telegram, discord)
-- User generates a code on the dashboard, sends it to the bot, bot calls bindTelegram/bindDiscord MCP tool
create table binding_codes (
  code text primary key,                  -- 6-digit numeric, generated server-side
  user_id uuid not null references profiles(id) on delete cascade,
  platform text not null check (platform in ('telegram', 'discord', 'slack', 'whatsapp')),
  expires_at timestamptz not null,        -- typically now() + interval '15 minutes'
  used_at timestamptz,                    -- set on successful binding
  created_at timestamptz default now()
);
create index on binding_codes (user_id) where used_at is null;
create index on binding_codes (expires_at) where used_at is null;

-- Scout-run summaries
create table scout_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  query text not null,
  sources text[] not null,
  scraped_count int default 0,
  inserted_count int default 0,
  scored_count int default 0,
  duration_ms int,
  status text not null,            -- 'running', 'completed', 'failed'
  error_message text,
  started_at timestamptz default now(),
  completed_at timestamptz
);
create index on scout_runs (user_id, started_at desc);

-- Per-user budget tracking aggregates (materialized view, refreshed daily)
create materialized view user_daily_spend as
select
  user_id,
  date_trunc('day', created_at) as day,
  sum(cost_usd) as total_cost_usd,
  count(*) as call_count
from llm_calls
where cost_usd is not null
group by user_id, day;

create unique index on user_daily_spend (user_id, day);
```

### Migration 0006 — RLS for production

This is the single most important production migration. It activates Row-Level Security on every table.

```sql
-- packages/db/migrations/0006_enable_rls.sql

-- Profiles: users can read/update only their own profile
alter table profiles enable row level security;
create policy "users read own profile" on profiles for select using (auth.uid() = id);
create policy "users update own profile" on profiles for update using (auth.uid() = id);

-- Leads: users can read only their own leads
alter table leads enable row level security;
create policy "users read own leads" on leads for select using (auth.uid() = user_id);
-- Inserts done by service role (worker), not direct from client
create policy "service role insert leads" on leads for insert
  to service_role with check (true);

-- Same pattern for: scores, pitches, clients, approvals, llm_calls, scout_runs, scrape_failures
-- ... (repeat for every user-scoped table)

-- binding_codes is short-lived; users read/insert their own codes; service role validates them
alter table binding_codes enable row level security;
create policy "users insert own binding codes" on binding_codes for insert
  to authenticated with check (auth.uid() = user_id);
create policy "users read own binding codes" on binding_codes for select
  to authenticated using (auth.uid() = user_id);
-- The bindTelegram/bindDiscord MCP tools run with service role and validate code → mark used_at

-- audit_log is append-only via service role; users read their own
alter table audit_log enable row level security;
create policy "users read own audit" on audit_log for select using (auth.uid() = user_id);
create policy "service role insert audit" on audit_log for insert to service_role with check (true);

-- provider_health is admin-only; we'll expose via API route, not direct SELECT
alter table provider_health enable row level security;
-- (no select policy = no access from anon/authenticated; service role bypasses RLS)
```

**Critical:** before applying this migration, the application code must be using `auth.uid()` (real Supabase Auth) instead of `DEMO_USER_ID`. Apply migration 0006 in the same change-set as the auth cutover. Don't apply RLS while the app is still hardcoded to a demo user — every query will fail.

### Migration 0007 — Phase 3/5 tables (apply in Phase 3)

```sql
-- packages/db/migrations/0007_pitches_and_replies.sql

-- Email replies (inbound, from Resend webhooks or IMAP polling)
create table email_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  pitch_id uuid references pitches(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  from_email text not null,
  to_email text,
  subject text,
  body_text text,
  body_html text,
  received_at timestamptz default now(),
  classified_intent text,          -- 'positive', 'negative', 'question', 'unsubscribe'
  raw jsonb
);
create index on email_replies (user_id, received_at desc);
create index on email_replies (pitch_id);

-- Layer 2 proof artifacts
create table proof_artifacts (
  id uuid primary key default gen_random_uuid(),
  pitch_id uuid not null references pitches(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,              -- 'lighthouse', 'sample_component', 'bug_repro'
  storage_url text,                -- Supabase Storage URL
  metadata jsonb,
  generated_at timestamptz default now()
);
create index on proof_artifacts (pitch_id);

-- pitches.payload_hash for HITL verification
alter table pitches add column if not exists payload_hash text;
alter table pitches add column if not exists expected_signal jsonb;  -- for variance from initial draft to send
alter table pitches add column if not exists send_attempt_count int default 0;
alter table pitches add column if not exists last_send_error text;

-- Approvals: tighten with payload_hash verification
alter table approvals add column if not exists verified_payload_hash text;
alter table approvals add column if not exists actor_platform text;  -- 'web', 'telegram', 'discord', 'slack'
```

### Checkpoint — database

- [ ] All migrations 0001-0007 applied in order.
- [ ] `supabase gen types typescript --linked > packages/db/src/types.ts` regenerated.
- [ ] Every table has an `index.ts` query helper or a typed `from()` call documented.
- [ ] RLS policies tested: as anon user, can't SELECT another user's leads. As authenticated user with `auth.uid()` = `user_id`, can SELECT own leads. As service role, full access.
- [ ] Materialized view `user_daily_spend` refreshes via cron (Supabase Edge Function on a schedule or pg_cron).

---

## 9. Authentication and multi-tenancy

Phase 6 (originally) is when this lands. In production-grade mode, it lands as part of Phase 3 because RLS depends on it.

### 9.1 Sign-up and login

Use Supabase Auth. Three login methods:

1. **Email + password** — primary. Email verification required.
2. **Magic link** — secondary. One-tap login from email.
3. **OAuth** — Google and GitHub. The user's GitHub OAuth is *separate* from the Copilot dummy account — users sign in with their real GitHub.

```typescript
// apps/web/app/auth/login/page.tsx
import { createServerClient } from "@openclaw/db";

export default function LoginPage() {
  // Render Supabase Auth UI (or hand-roll for design system fit)
  // OAuth buttons: Google, GitHub
  // Email input → magic link OR email+password
  // ...
}
```

Build the auth pages (`/auth/login`, `/auth/signup`, `/auth/callback`, `/auth/forgot-password`) with the design system tokens. Don't use Supabase's prebuilt UI — it doesn't match.

### 9.2 First-run onboarding

After a user signs up and verifies email, redirect to `/onboarding`. Three steps:

1. **Profile.** Display name, hourly rate, hours/week available, timezone.
2. **Skills.** Multi-select tags (React, Next.js, TypeScript, Python, etc.) plus a free-text bio.
3. **Connect Telegram (optional).** Show a code; user sends it to the bot to bind.

Each step writes to `profiles`. After completion, redirect to `/inbox`. The user is now "Anya Petrov-equivalent" — has a real `profiles` row with their data.

Migrate the existing seeded `Anya Petrov` row to be your personal user once you sign up — or delete it and re-create from your real signup. Don't ship with two demo users to production.

### 9.3 Row-level security cutover

This is the riskiest single change in the whole codebase. Sequence:

1. Implement auth pages, onboarding, server-side session checks. Verify in dev.
2. Update every `from('leads').select()` (and similar) to NOT pass `user_id` filter explicitly — let RLS handle it. Server clients use the user's session JWT; service-role clients bypass RLS.
3. Apply migration 0006 (enable RLS).
4. Run the app. Every authenticated user sees only their data. Anon users see nothing. Service role (the worker) sees everything.
5. Delete the `DEMO_USER_ID` constant. Replace `process.env.DEMO_USER_ID` with `(await getSession()).user.id` in API routes. Workers continue to receive `user_id` via Inngest event payload (from the API route that triggered them).

Test thoroughly: create a second test account, verify it cannot see the first account's leads via direct DB queries from the browser console.

### Checkpoint — auth and tenancy

- [ ] Sign-up, login, magic link, OAuth flows all work.
- [ ] Onboarding flow writes complete `profiles` row.
- [ ] RLS migration applied.
- [ ] Two-account isolation test passes: account A cannot see account B's data.
- [ ] `DEMO_USER_ID` removed from codebase.
- [ ] Workers correctly receive and use `user_id` from Inngest event payload.
- [ ] Telegram binding flow works.

---

## 10. The HITL approval security model

This is the brand promise made technical. The agent never sends without approval. Approval must be cryptographically tied to the exact draft the user saw — not a draft that was modified after they tapped approve. This is the `payload_hash` security model.

### Threat model

**Threat 1: Race condition.** User taps approve. Between display and approval reaching the server, another process updates the draft. The user approves a draft they didn't see.

**Threat 2: Compromised display surface.** Web client is XSS'd; attacker modifies the draft shown to the user, who approves it. Approval was authentic but the content was forged at display time.

**Threat 3: Replay.** Attacker captures an approval message and replays it after the draft has changed.

### The model

When the agent drafts a pitch:

1. Compute `payload_hash = sha256(pitch.draft + pitch.subject + pitch.id)`. Store on the `pitches` row.
2. When sending to the user (web or Telegram), include both the draft text and the hash.
3. The approval UI button payload includes the `pitch_id` and the `payload_hash`.
4. When the user approves, the server:
   a. Loads the pitch row.
   b. Recomputes `expected_hash = sha256(current_draft + current_subject + id)`.
   c. Compares against the submitted `payload_hash`. If different, **reject the approval** with a clear error: "The pitch has changed since you reviewed it. Please review again."
   d. If same, write `approvals` row with `verified_payload_hash`, fire `pitch/approved` event.

The hash binds approval to the exact bytes of the draft. Threats 1, 2, 3 all fail.

### Implementation — Phase 3 deliverables

```typescript
// packages/agent/src/drafting/payloadHash.ts
import { createHash } from "node:crypto";

export function computePayloadHash(opts: { id: string; subject: string; draft: string }): string {
  const canonical = JSON.stringify({ id: opts.id, subject: opts.subject, draft: opts.draft });
  return createHash("sha256").update(canonical).digest("hex");
}
```

```typescript
// apps/web/app/api/pitches/[id]/approve/route.ts
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { payload_hash } = await req.json();
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const pitch = await db.from("pitches").select("*").eq("id", params.id).single();
  if (!pitch.data) return new Response("Not found", { status: 404 });
  if (pitch.data.user_id !== session.user.id) return new Response("Forbidden", { status: 403 });

  const expected = computePayloadHash({
    id: pitch.data.id,
    subject: pitch.data.subject,
    draft: pitch.data.draft,
  });

  if (expected !== payload_hash) {
    return Response.json(
      { error: "stale_draft", message: "Pitch has changed since you reviewed it." },
      { status: 409 }
    );
  }

  // Record approval
  await db.from("approvals").insert({
    user_id: session.user.id,
    action_type: "pitch.send",
    resource_type: "pitches",
    resource_id: pitch.data.id,
    payload_hash,
    verified_payload_hash: expected,
    actor_platform: "web",
    status: "approved",
    decided_at: new Date().toISOString(),
  });

  // Audit
  await db.from("audit_log").insert({
    user_id: session.user.id,
    actor: "user",
    action: "pitch.approved",
    resource_type: "pitches",
    resource_id: pitch.data.id,
    payload: { payload_hash },
  });

  // Fire send event
  await inngest.send({
    name: "pitch/approved",
    data: { pitch_id: pitch.data.id, user_id: session.user.id },
  });

  return Response.json({ ok: true });
}
```

The same flow runs for Telegram (callback button → MCP tool → same handler logic). Both surfaces converge on the same `approvals` write and `pitch/approved` event.

### Checkpoint — HITL security

- [ ] `computePayloadHash` deterministic: same inputs always produce same hash.
- [ ] Stale-draft test: draft pitch, modify draft in DB, attempt to approve with old hash. Server returns 409.
- [ ] Cross-user test: user A attempts to approve user B's pitch. Server returns 403.
- [ ] Telegram callback approval goes through same code path as web approval.
- [ ] `approvals.verified_payload_hash` matches the `payload_hash` the user submitted, on every successful approval.
- [ ] `audit_log` has a row for every approval.

---

## 11. Phase 3 — pitch drafting and HITL approval

### 11.0 Sequencing decision: Phase 2.5 (auth + RLS) vs Phase 3 first

Read this before starting. The order matters and the right choice depends on your timeline.

**The setup.** Phase 1 and 2 were built on a hardcoded `DEMO_USER_ID` constant. Every database query, every Inngest event, every Realtime subscription is currently keyed on this single fake user. Phase 3 builds the HITL approval flow on top of this — adding pitch drafting, the approval security model with `payload_hash`, and the chat platform binding (which writes `telegram_user_id` and `discord_user_id` to `profiles`).

The proper production model is documented in section 9 (Phase 6, auth and tenancy): real Supabase Auth, real `profiles` rows with `auth.uid()`, RLS enabled on every table. The work to get there is one focused phase — call it **Phase 2.5** — that lands between Phase 2 and Phase 3.

**The tradeoff.**

If you do Phase 2.5 first (the architecturally clean path):
- Phase 3 builds on real auth from day one. No refactoring later.
- The chat-platform binding flow uses real `profiles` rows. The 6-digit binding codes are owned by real authenticated users, not by `DEMO_USER_ID`.
- RLS catches multi-tenant bugs immediately. If you accidentally write a query that doesn't filter by `user_id`, you find out the moment a second test account exists.
- Timeline cost: roughly 1-2 days. Sign-up + login + onboarding + RLS migration + the two-account isolation test.
- Risk: the RLS cutover is the riskiest single migration in the codebase. You're flipping every table from "anyone can see everything" to "users see only their own rows." Bugs here can break the entire app until fixed.

If you do Phase 3 first (the demo-pressure path):
- You can demo a working HITL approval flow ~2 days sooner.
- All the Phase 3 code uses `DEMO_USER_ID`. When you do Phase 2.5 later, you'll touch every file Phase 3 added — but the changes are mechanical (replace `DEMO_USER_ID` with `auth.uid()`, remove explicit `user_id` filters since RLS handles them).
- Risk: you get used to the simplifications of single-user development and forget where multi-tenancy seams need to exist. The `payload_hash` approval flow in particular has subtle authorization concerns that are easier to get right with real auth in place.

**Recommendation.**

If your hackathon deadline is **within 7 days** from when you start Phase 3: do Phase 3 on `DEMO_USER_ID` first, ship the demo, then make Phase 2.5 the very first post-hackathon work. The demo is the artifact judges see; getting it ready takes priority over architectural purity. But — and this is non-negotiable — the BACKLOG.md entry for Phase 2.5 must be marked as a hard pre-merge blocker before any production user is onboarded. Don't let it slip to "we'll get to it."

If you have **more than 7 days**: do Phase 2.5 first. The 1-2 day investment compounds across all of Phase 3's work and removes a refactoring debt you'd otherwise pay later.

If you're **uncertain about timing**: do Phase 2.5 first. The risk-adjusted answer is always to clean the foundation. Demo pressure has a way of expanding to fill all available time.

**What this section assumes from here on.** The Phase 3 steps below are written assuming you're on `DEMO_USER_ID` (the demo-pressure path). If you've done Phase 2.5 first, mentally substitute `auth.uid()` for every reference to `DEMO_USER_ID` and skip the per-step user_id plumbing. Either way, the architecture is the same.

### 11.1 Phase 3 build sequence

Phase 3 is the demo's narrative spine. By the end, you can: type query → run scout → click top lead → "Draft pitch" → watch pitch stream in → approve from web OR Telegram OR Discord → email actually sends.

**Step 0 — Deploy OpenClaw Gateway (~30 min, hard prerequisite)**

Before any prompt, schema, or pipeline work, get a working OpenClaw Gateway up. This is the integration substrate that steps 6+ depend on. Doing it first surfaces any deployment issues immediately rather than at hour 7 of the build.

Sub-steps:
1. Deploy via Railway template at [railway.com/deploy/self-host-openclaw](https://railway.com/deploy/self-host-openclaw). Service name: `openclaw-vp-dev`.
2. Walk the `/setup` wizard: pick OpenRouter as the initial provider (we override to the full chain in step 6), paste `OPENROUTER_API_KEY`. Skip channel setup for now — we wire Telegram and Discord in step 6.
3. Save the Gateway URL and `OPENCLAW_GATEWAY_TOKEN` to `apps/web/.env.local` and `apps/worker/.env.local`.
4. Run `openclaw doctor --remote $OPENCLAW_GATEWAY_URL --token $OPENCLAW_GATEWAY_TOKEN` from your laptop. Expect green health.
5. Open the Gateway's `/admin` UI in a browser. Verify the dashboard loads.

**Checkpoint:** Gateway is reachable from your laptop, admin UI loads, doctor returns healthy. No skills or MCP tools yet — that's later steps. We just want the deployment substrate working before we build on it.

**Step 1 — Draft-pitch prompt and pipeline (~90 min)**

Files:
- `packages/agent/src/prompts/draft-pitch.md` — versioned prompt with rubric and 3 few-shot examples (one personalized, one with proof reference, one for re-engagement).
- `packages/agent/src/drafting/schema.ts` — `DraftPitchOutput` Zod schema: `{ subject: string; body: string; reasoning: string; confidence: 'high' | 'medium' | 'low' }`.
- `packages/agent/src/drafting/draftPitch.ts` — calls LLM with profile + lead + (optional) client memory; returns parsed result.
- `packages/agent/src/drafting/payloadHash.ts` — as section 10.

Smoke test: draft a pitch for the top lead in your DB. Verify subject and body look real, reasoning explains why this lead, confidence is appropriate.

**Checkpoint:** review the generated pitch for the score-95 lead. Owner reads the body. Approve before continuing.

**Step 2 — Pitch drafting Inngest function (~30 min)**

Files:
- `apps/worker/src/functions/draftPitch.ts` — listens for `pitch/draft-requested` event. Loads lead + profile + (Phase 5) client memory. Calls `draftPitch`. Computes `payload_hash`. Inserts `pitches` row with `status='draft'`. Broadcasts `pitch:{user_id}` channel with the new pitch.

**Checkpoint:** trigger from dashboard, confirm pitch row lands in DB with `payload_hash` populated.

**Step 3 — Pitch card UI (~60 min)**

Port `openclaw-design-system/project/ui_kits/dashboard/PitchCard.jsx` to TSX. Replace placeholder in `LeadDetail`. Wire to streaming via `llm.stream()` for the "drafting..." UX — actually stream the body into the card character by character.

Card has: subject, body (editable inline), reasoning collapsed by default, three buttons: Approve & send, Edit, Reject.

**Checkpoint:** click Draft pitch on a lead. Watch the pitch stream in. Verify subject + body are sensible. Pause for owner review.

**Step 4 — Approval API + audit (~45 min)**

Files:
- `apps/web/app/api/pitches/[id]/approve/route.ts` — full implementation per section 10.
- `apps/web/app/api/pitches/[id]/reject/route.ts` — similar, just records rejection.
- `apps/web/app/api/pitches/[id]/edit/route.ts` — accepts modified `draft`/`subject`, recomputes `payload_hash`, updates row.

Wire the buttons in `PitchCard` to these routes.

**Checkpoint:** approve a pitch via web. Confirm `approvals` row created, `payload_hash` matches, `pitch/approved` event fires in Inngest UI.

**Step 5 — Send pitch via Resend (~30 min)**

Files:
- `apps/worker/src/functions/sendPitch.ts` — listens for `pitch/approved`. Loads pitch + lead. Sends via Resend. Updates `pitches.sent_at`. Audit-logs the send.

For dev, use Resend's "test mode" (sends to verified-only addresses) or stub the send entirely (just write `sent_at`). Production uses real Resend with custom domain.

**Checkpoint:** approve a pitch. Verify either an email arrives at your verified test address or `sent_at` is correctly stamped.

**Step 6 — Telegram + Discord approval flow (~150 min)**

This is the chat-platform integration step. Both Telegram and Discord get fully wired here. Treat Discord as additive on top of Telegram — same handler logic, same MCP tools, just a second platform plugin in the Gateway config and per-platform UX tweaks for the embed/keyboard rendering.

Sub-steps:

*6a — MCP server endpoint (~30 min).* Build `apps/web/app/api/mcp/route.ts` per section 6.7 Stage C. Implement at least these tools: `getTopLead`, `getRecentLeads`, `draftPitch`, `approvePitch`, `rejectPitch`, `bindTelegram`, `bindDiscord`, `notifyAgent`. Authenticate with `MCP_SHARED_SECRET`. Smoke test with `curl` from your laptop before connecting OpenClaw.

*6b — Skills and Gateway config (~30 min).* Author `apps/agent/skills/draft_pitch.skill.md`, `approve_pitch.skill.md`, `help.skill.md`. Upload to the Gateway's workspace via the admin UI. Update `apps/agent/openclaw.config.json` to point the MCP plugin at our endpoint and configure the LLM provider chain per section 4.0. Apply via `openclaw config apply`.

*6c — Telegram (~30 min).* Create the bot via BotFather per section 7.1. Enable the Telegram channel in Gateway config. Implement the binding code flow: dashboard generates a 6-digit code, user sends to bot, bot calls `bindTelegram` MCP tool, profile updated. Smoke test: send `/start`, complete binding, send `find leads for next.js`, verify the scout fires.

*6d — Discord (~45 min).* Create the Discord app per section 7.2. Enable the Discord channel in Gateway config (paste bot token, public key, app ID). Register slash commands. Enable user-install mode. Implement the same binding flow with `bindDiscord`. Smoke test: install bot to your user, run `/scout query:next.js`, verify the scout fires from Discord just like from Telegram.

*6e — Approval UX, both platforms (~15 min).* When a pitch is drafted, the worker fires a `notifyAgent` callback to OpenClaw which sends approval messages with platform-appropriate UI: Telegram inline keyboard (3 buttons in one row), Discord embed with brand-color side bar and 3 message components below. Tap Approve from either platform → callback to OpenClaw → `approvePitch` MCP tool → same handler that runs for the web flow.

**Checkpoint (the demo moment):** trigger a pitch draft from the dashboard. Receive notifications on Telegram AND Discord simultaneously (the user is bound to both). Tap Approve from your phone in Telegram. Watch the dashboard update in real time to show pitch as `sent`. Watch the Discord card collapse to show "approved via Telegram" status. **This is the visceral moment you've been working toward.** Pause and savor it. Show a teammate. Record a screen capture for the demo.

**Step 7 — Pitch list view (~45 min)**

The sidebar's "Pitches" item finally activates. Build `/pitches` page showing all pitches, filterable by status (draft, approved, sent, rejected). Match design system.

**Step 8 — Stat cards become real (~30 min)**

`Pitches Sent` now shows real `count(*)` from `pitches where status='sent'`. `Reply Rate` still pending Phase 5 (no replies tracked yet) — leave as `—`.

**Checkpoint — Phase 3 complete:** Owner does the full flow: scout → draft → approve from Telegram → email sends. Then again from Discord. Audit log shows every action with `actor_platform` filled in. Dashboard reflects reality across all three surfaces. Commit count: ~12-18 commits across the phase.

---

## 12. Phase 4 — Layer 2 proof-of-value

The "wow" moment. The agent doesn't just draft a pitch — it builds something real and attaches it.

Pick one proof-of-value type for the first ship: **Lighthouse audit.** Reasoning: most reliable to automate, applicable to nearly every web-development lead, visually impressive in the demo.

### Steps

**Step 1 — Lighthouse worker (~90 min)**

Files:
- `apps/worker/src/functions/runLighthouseAudit.ts` — uses `lighthouse` npm package + Chromium. Takes a `target_url`. Returns: performance score, accessibility score, best practices score, SEO score, top 3 actionable recommendations, before/after estimated metrics if obvious wins exist.
- Output stored as JSON in `proof_artifacts.metadata`. Optional: render a PNG/PDF report and store in Supabase Storage.

The worker needs a Chromium runtime. Locally: `puppeteer` bundles it. On Railway/Fly: use a Docker image with Chromium pre-installed.

**Step 2 — "Generate proof" trigger (~30 min)**

In `LeadDetail`, when a lead is in pipeline (status `draft-ready` or `drafting`), show a "Generate proof" button that opens a small picker: target URL + proof type (Lighthouse, sample component, etc.). Triggers the worker.

**Step 3 — Pitch incorporates proof (~45 min)**

Update the draft-pitch prompt to accept an optional `proof_artifact_summary` parameter. When present, the body must reference the proof concretely:

> *"I ran a Lighthouse audit on yourcompany.com — your pricing page scores 42 on performance. The biggest win is image lazy-loading; I've prototyped the fix at <url>. Loads ~3× faster."*

**Step 4 — Proof preview in PitchCard (~30 min)**

Below the pitch body, show a card: *"Proof: Lighthouse audit · Performance 42 → 89 (estimated) · View report."* Click to open the full audit JSON (or PDF if rendered).

**Step 5 — (Stretch) Sample component generation**

Use the LLM with code-generation prompts to scaffold a small React component matching the lead's brief (e.g., "they want a pricing page — generate a basic one"). Save to a temporary repo, attach the GitHub URL to the pitch. This is harder and lower-priority than Lighthouse; ship if Phase 4 budget allows.

**Checkpoint — Phase 4:** generate a Lighthouse audit for a real URL, draft a pitch referencing it, send through approval flow. The pitch should mention real metrics from the audit.

---

## 13. Phase 5 — Layer 3 negotiation and client memory

When a lead becomes a client (i.e., they replied positively, project started), the agent maintains persistent memory and helps draft replies to ongoing client emails.

### Steps

**Step 1 — Email reply ingestion (~60 min)**

Two options for receiving inbound:
- **Resend Inbound** (newest feature) — webhook fires on inbound email to a custom domain.
- **IMAP polling** — fallback. Slower but works with any email provider.

Pick Resend Inbound if available. Webhook handler at `apps/web/app/api/email/inbound/route.ts` parses, identifies the `pitch_id` (via threading or our tracking link), inserts into `email_replies`.

**Step 2 — Reply classification prompt (~45 min)**

`packages/agent/src/prompts/classify-reply.md` — categorizes inbound: positive (move to client), negative (close lead), question (needs response), unsubscribe (mark and stop).

When classified `positive`, insert a `clients` row, mark the lead as `won`. Initialize `clients.memory_md` with a starter template.

**Step 3 — Reply drafting prompt (~60 min)**

`packages/agent/src/prompts/draft-reply.md` — takes inbound email + full conversation history + `clients.memory_md` + operator profile. Returns three reply options of different tones (brief, detailed, friendly). User picks one, edits if needed, approves, sends.

This is identical in shape to the pitch flow — uses the same payload_hash model.

**Step 4 — Client memory update (~45 min)**

After every approved reply, the agent updates `clients.memory_md`. Format: structured markdown with sections (Project History, Negotiation Notes, Open Questions, Next Action).

```markdown
# Acme Corp · Project Memory

## Project History
- 2025-03-15 — Initial pitch sent. Topic: dashboard rebuild.
- 2025-03-17 — Reply received. Interested, asked for portfolio.
- 2025-03-18 — Sent portfolio. Currently scoping deliverables.

## Negotiation Notes
- Budget range: $5k-$8k fixed. We quoted $6.5k.
- They want 4-week turnaround. Tight but feasible.

## Open Questions
- Will they share their existing analytics queries?

## Next Action
- Wait for scoping reply. Follow-up Friday if silent.
```

The agent reads this on every interaction; stays grounded in real history. Updates are diff-based (LLM proposes diff, user confirms).

**Step 5 — Client list and detail UI (~60 min)**

Sidebar `Clients` activates. `/clients` page lists all clients. Each opens to a detail view with the rendered memory markdown plus inline reply drafting.

**Step 6 — Upsell detection (~45 min)**

Cron job (Supabase Edge Function on schedule): for each active client, check `memory_md` against rules ("project completing in N days", "no upsell pitched in M weeks") and surface candidates. Like a scout, but for existing clients.

**Checkpoint — Phase 5:** simulate inbound reply (insert a row manually if Resend Inbound isn't fully set up). Watch agent classify, draft replies, prompt approval. Memory updates on each turn.

---

## 14. Phase 6 — production hardening

Pre-launch polish and the deferred items from `BACKLOG.md`.

### Steps

**Step 1 — Auth and onboarding (full implementation per section 9)**

Already specified. Apply migration 0006 (RLS).

**Step 2 — Rate limiting + abuse prevention (~60 min)**

Add per-IP and per-user rate limits on every API route using a Redis-like store (Upstash) or Supabase function counters:
- `/api/scout`: 10/hour per user
- `/api/pitches/draft`: 30/day per user
- `/api/auth/*`: 5/15min per IP

**Second rate-limiting concern: per-Gateway limits on the MCP endpoint.** Once OpenClaw is in production, the Gateway is *also* a client of our Next.js app — it calls `/api/mcp` for every tool invocation. A misbehaving Gateway (or a compromised one) could hammer this endpoint. Apply:
- `/api/mcp`: 60/min per Gateway (identified by `OPENCLAW_GATEWAY_TOKEN` hash, not IP — the IP is Railway's, shared across many services).
- Per-tool finer limits: `runScout` capped at 10/hour per user (matching the user-facing `/api/scout` limit), `draftPitch` at 30/day (matching its sister route).
- The `notifyAgent` tool — which workers use to push messages back to OpenClaw — is rate limited separately by `MCP_WORKER_SECRET` rather than `MCP_SHARED_SECRET`. This is why those secrets are split: Gateway → app uses the shared secret with strict limits, Worker → Gateway uses the worker secret with looser limits because workers shouldn't fan out abusively in normal operation.

**Step 3 — Error tracking with Sentry (~30 min)**

Install `@sentry/nextjs`. Configure DSN in `.env`. Wrap all API routes and Inngest functions with error capture. Add user context (`Sentry.setUser`) in every authenticated request.

**Step 4 — Product analytics with PostHog (~30 min)**

Install PostHog. Track key events: signup, first scout, first draft, first approval, first send. Build a funnel dashboard. This is how you'll know if the product works.

**Step 5 — Search bar implementation (~60 min)**

The dimmed search bar in topbar. Backend: Postgres full-text search across `leads.title + description`, `clients.company_name + memory_md`, `pitches.subject + draft`. Frontend: debounced typeahead, results grouped by type. ⌘K shortcut wires.

**Step 6 — Notification system (~90 min)**

The dimmed bell icon. Real notifications table. Triggers: new pitch awaiting approval, reply received, scout completed. In-app feed + Telegram fanout (already wired).

**Step 7 — Settings page (~60 min)**

The dimmed Settings sidebar item. Pages for: profile (edit fields from onboarding), connected accounts (Telegram bind/unbind, etc.), provider preferences (which LLM, which scraper), budget caps, danger zone (delete account).

**Step 8 — Templates page (~optional, defer if tight)**

Templates for pitch styles. User saves prompt variants ("formal," "casual," "with code sample") and selects which to use per scout. Phase 6.5 if time permits.

**Step 9 — Dark mode polish + accessibility audit (~60 min)**

Run axe-core on every page. Fix contrast issues, focus traps, keyboard navigation gaps. Verify the dashboard is fully usable with keyboard only.

**Step 10 — Export/import (~45 min)**

Settings → Data → Export all your leads/pitches/clients as CSV+JSON. GDPR-relevant; trust-building.

### Checkpoint — Phase 6: production-ready feature set complete. Two-account isolation verified. Sentry errors clean. PostHog showing real events. All sidebar items active.

---

## 15. Phase 7 — observability, testing, deployment

The final mile. Make it stay up.

### Steps

**Step 1 — Unit tests with Vitest (~3 hours)**

Cover the critical path:
- `packages/agent/src/llm/router.test.ts` — provider selection logic with mocked health.
- `packages/agent/src/scoring/scoreLead.test.ts` — happy path, schema-fail retry, budget guard.
- `packages/agent/src/drafting/payloadHash.test.ts` — determinism, cross-input distinctness.
- `packages/scraping/src/zyte/parsers/upwork.test.ts` — fixture HTML → expected leads.
- `apps/worker/src/lib/scoutPipeline.test.ts` — end-to-end with mocked dependencies.

Goal: 70%+ coverage on `packages/`, 50%+ on `apps/`.

**Step 2 — E2E tests with Playwright (~3 hours)**

Full user flows:
- Sign up → onboarding → first scout → see leads.
- Draft pitch → approve → see sent.
- Reject pitch → confirm not sent.
- Stale-hash rejection: approve a pitch after manually changing draft in DB; verify 409.

**Step 3 — CI/CD pipeline (~2 hours)**

GitHub Actions:
- On PR: typecheck, lint, unit tests.
- On merge to main: deploy `apps/web` to Vercel, `apps/agent` to Railway, run migrations against staging, run E2E suite, then promote to prod on green.

**Step 4 — Production deployment (~3 hours)**

- Vercel project for `apps/web`. Custom domain.
- Railway project for `apps/agent` (OpenClaw runtime). Same env vars.
- Supabase project bumped to Pro tier ($25/mo). Connection pooling enabled. Daily backups configured.
- Resend domain verified (DKIM, SPF, DMARC). Custom from-address.
- Sentry production project. PostHog production project.
- DNS configured. SSL verified.

**Step 5 — Status page + uptime monitoring (~60 min)**

Use Better Uptime, Cronitor, or similar. Monitor:
- `https://your-domain.com/api/health` (must return 200 with DB+LLM check)
- Telegram bot reachability (optional ping skill).
- Inngest job queue depth.

Public status page at `status.your-domain.com`.

**Step 6 — Runbook (~60 min)**

`docs/RUNBOOK.md` documenting common incidents and resolutions:
- Copilot OAuth expired → regenerate via dummy account.
- Zyte rate limited → temporary fallback to Firecrawl, ZD support ticket.
- Supabase down → degrade gracefully, queue events.
- Provider X cost spike → check `user_daily_spend` view, lower budget caps.

**Step 7 — Backup demo video (~60 min)**

Record a 90-second flawless flow. Hosted on Loom or YouTube (unlisted). Linked from README.

### Checkpoint — Phase 7: site deployed, custom domain live, signup works for new users, monitoring green. Backup video recorded. Project is production.

---

## 16. Operational rules

These apply to every line of code from now on. Stricter than Phase 1's rules.

### Always do

- Read this document at the start of every session.
- Read `BACKLOG.md` and update it when items move (defer further, complete, change scope).
- Before any feature, verify it's covered in this document. If not, surface to owner before implementing.
- Use TypeScript `strict` mode. No `any` types except at clearly documented integration boundaries.
- Validate every external input (API request body, webhook payload, MCP tool input) with Zod.
- Log every LLM call. Log every approval. Log every email send. Log every webhook received.
- Audit-log every sensitive action to `audit_log`.
- Use `auth.uid()` for user identification in queries (never hardcoded UUID).
- Prefer service-role client for trusted backend, anon-key client for direct browser queries (with RLS).
- Commit frequently. Each step in this guide is at least one commit; complex steps may split into multiple.
- Push to `origin/main` after each phase's checkpoint passes.
- Update `CLAUDE.md` and this document when architectural decisions evolve.

### Never do

- Never commit secrets. Sentry keys, Resend keys, API tokens, OAuth tokens — all `.env` only.
- Never use the user's main GitHub account for Copilot OAuth. Dummy account only.
- Never bypass `payload_hash` verification on approval flows.
- Never call an external provider directly from business logic — always through the abstraction (`llm.complete`, `scraper.scrape`, etc.).
- Never inline a prompt in code. Markdown files in `prompts/` only.
- Never edit Supabase schema by hand; migrations only.
- Never use Tailwind arbitrary values (`bg-[#FF4D4D]`) — design tokens via CSS vars or Tailwind theme extension only.
- Never substitute another icon library for Lucide.
- Never use emoji in product copy or as iconography (Lucide only). Telegram bot text gets a sparing 🎯 / ✅ for approvals as exception, since plain Telegram chat reads differently than UI copy.
- Never ship a feature without a corresponding test (unit minimum; E2E for user-facing flows).
- Never deploy without a passing CI run.
- Never manually `pg_dump` or restore in production without a runbook entry.
- Never modify files in `openclaw-design-system/`. The bundle is frozen.

### When unsure

- Default to what Linear / Vercel Dashboard / Stripe Dashboard would do.
- For visual choices: check `openclaw-design-system/project/preview/*.html`.
- For architectural choices: read the relevant section above and follow. If not covered, propose to the owner before implementing.
- For LLM-prompt design choices: the score-lead prompt is the calibration reference. Follow its style (frontmatter, rubric, few-shot examples, strict JSON output).

### 16.5 The 90-second demo arc

For hackathon judging or any pitch presentation, the demo is the artifact. A practiced, timed, clean demo is the difference between winning and not winning. This is the script.

Pre-demo setup (do once, before walking up to present):
- Dashboard open in browser, signed in as `Anya Petrov` demo account, on the `/inbox` page.
- Empty leads table, ready to receive results from a fresh scout.
- Phone unlocked, Telegram bot conversation open.
- Laptop also has Discord open in a second tab, signed in as the same Anya account, with the bot DM open.
- Audio off (notification sounds are distracting).
- One sample query memorized: `senior next.js engineer for SaaS dashboards`.

Script (90 seconds, three beats of 30 seconds each):

**Beat 1 — Scout and score (0:00 to 0:30).** "OpenClaw Venture Partner is an autonomous AI agent that runs the full deal flow for freelancers. Watch — I type a query." [Type in the search bar.] "It scrapes job boards, scores each lead against my profile across five dimensions, and writes the top results into a live inbox." [Click Run scout. As leads stream in over Realtime, point at them.] "Real leads, real scores, real reasoning. The top one is a Next.js dashboard rebuild — score 95." [Click that lead. The detail panel opens with the scoring breakdown.] "It explains why: my React experience matches, the budget fits my hourly rate, the client has a clear scope."

**Beat 2 — Draft and notify (0:30 to 1:00).** "Now I tell it to draft a pitch." [Click "Draft pitch" button.] "The agent uses my profile, the lead's content, and any prior client memory to write a personalized outreach. Watch the body stream in." [Pitch streams character-by-character into the card.] "But here's the thing — I'm not at my desk often. I'm on Telegram." [Hold up phone showing the same pitch arrived as a Telegram message with three buttons.] "Or Discord." [Tilt laptop screen to show the Discord embed with the same pitch.] "Same pitch, three surfaces, all in sync."

**Beat 3 — Approve and send (1:00 to 1:30).** "I review the body — looks good. I tap Approve on my phone." [Tap the green Approve button in Telegram.] "OpenClaw verifies a payload hash so a malicious user can't trick me into approving a pitch I never saw — that's the security model section ten of the production guide. Then it sends the email via Resend." [Pause, point at the dashboard.] "Watch — the dashboard updates in real time. Pitch is now `sent`. The Discord card collapsed to show 'approved via Telegram' so I know what happened from where. Audit log records every action with the timestamp, user, surface, and IP."

[Beat — let the silence work for one beat.]

"This is built on OpenClaw, the open-source personal AI assistant by Peter Steinberger — 100,000 stars in its first week. We're shipping a closed-source agent on top of it for freelancers and small agencies. The full demo is on a real Supabase database, real LLM calls through a five-provider chain, and a real OpenClaw Gateway running on Railway. Questions?"

Practice notes:
- Time the whole thing. Use a phone timer. If you're going over 90 seconds, cut the security-model line — judges have probably already seen the audit trail visually.
- Don't show any code. Code in a demo is a tell that the product isn't ready. Your story is "watch the product work," not "let me explain how it works."
- If something breaks (Realtime didn't fire, Telegram didn't receive, etc.) — keep going. Switch to the dashboard and show the same flow there. The score-95 lead always exists in the database; it's resilient. Don't panic-narrate the failure.
- If a judge asks how the LLM provider chain works, the answer is: "Five providers, with health checks and per-call cost tracking, fallover under 50ms. Section 4 of the production build guide if you want depth." Then return to taking questions.

---

## 17. Environment variables — final manifest

`.env.example` (commit this). `.env` (gitignored).

```
# === Application ===
NODE_ENV=development                     # production | staging | development
APP_URL=http://localhost:3000            # canonical URL, used in emails and webhooks
LOG_LEVEL=info

# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=                     # for verifying tokens server-side

# === LLM providers (5-chain) ===
COPILOT_TOKEN=                           # OAuth from dummy GitHub Pro Student account
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
ANTHROPIC_API_KEY=                       # leave empty unless explicitly using

# === LLM behavior ===
LLM_DEFAULT_MODEL_TIER=balanced          # fast | balanced | capable
USER_DAILY_BUDGET_USD=5.00               # per-user daily LLM spend cap

# === Scraping ===
SCRAPER=zyte                             # zyte | firecrawl | stub
ZYTE_API_KEY=
FIRECRAWL_URL=                           # https://firecrawl.your-domain.com
FIRECRAWL_API_KEY=

# === Email ===
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@your-domain.com
RESEND_INBOUND_DOMAIN=                   # for inbound email parsing

# === Inngest ===
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# === OpenClaw Gateway ===
OPENCLAW_GATEWAY_URL=                    # e.g. https://openclaw-vp-prod.up.railway.app
OPENCLAW_GATEWAY_TOKEN=                  # from /setup wizard, gates WebSocket and admin
OPENCLAW_ADMIN_PASSWORD=                 # for /admin UI
MCP_SHARED_SECRET=                       # Gateway → /api/mcp; strict per-tool rate limits
MCP_WORKER_SECRET=                       # Worker → notifyAgent; looser limits, separate trust

# === Chat platforms (Telegram + Discord primary) ===
TELEGRAM_BOT_TOKEN=

ENABLE_DISCORD=true                      # primary in this build
DISCORD_BOT_TOKEN=
DISCORD_PUBLIC_KEY=
DISCORD_APP_ID=

# === Chat platforms (scaffolded, off by default) ===
ENABLE_SLACK=false
SLACK_BOT_TOKEN=                         # xoxb-...
SLACK_SIGNING_SECRET=
SLACK_APP_ID=

ENABLE_WHATSAPP=false
WHATSAPP_PHONE_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_TOKEN=
WHATSAPP_VERIFY_TOKEN=

# === Observability ===
SENTRY_DSN=
SENTRY_AUTH_TOKEN=                       # for source map uploads in CI
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# === Security / abuse prevention ===
UPSTASH_REDIS_REST_URL=                  # for rate limiting (optional Phase 6)
UPSTASH_REDIS_REST_TOKEN=

# === Miscellaneous ===
TZ=UTC                                   # all server times in UTC
```

---

## 18. Onboarding the next session

When you (Claude Code) start a new session on this project:

1. Read this document fully.
2. Read `CLAUDE.md`.
3. Read `BACKLOG.md`.
4. Read `openclaw-design-system/project/README.md` and `SKILL.md`.
5. Run `git log --oneline -20` to see recent commits.
6. Check current phase: search this doc for the phase that matches the next backlog item.
7. Confirm with the owner what's next. Do not start work without confirmation.

---

*This document is the source of truth for production architecture. Update it as decisions evolve. Treat divergence from this doc as a bug.*

*Last updated: comprehensive post-OpenClaw-audit revision pass. Major changes: (1) Section 4 added subsection 4.0 clarifying the two-LLM-routing-layers model — our internal client for worker calls, OpenClaw's native routing for chat calls. (2) Section 5 corrected the "Zyte via OpenClaw" misunderstanding — Zyte is called directly from our Inngest worker, not routed through the chat agent. (3) Section 6 rewritten end-to-end (subsections 6.1 through 6.9) to reflect actual OpenClaw architecture (deployable Gateway, not npm library), with three-deployment-model decision support, audit results, deploy-and-integrate setup, and Realtime integration patterns. (4) Section 7 restructured: Telegram and Discord both promoted to primary with full setup walkthroughs; WhatsApp and Slack remain scaffolded. (5) Section 8 added `binding_codes` table for chat-platform binding flow with corresponding RLS policy. (6) Section 11 added subsection 11.0 with the Phase 2.5 vs Phase 3 sequencing decision and tradeoff guidance. Phase 3 step ordering updated: Step 0 added for Gateway deployment as hard prerequisite; Step 6 expanded from "Telegram approval flow" to "Telegram + Discord approval flow" (~150 min). (7) Section 14 Phase 6 Step 2 expanded with per-Gateway MCP rate limits and the rationale for splitting `MCP_SHARED_SECRET` from `MCP_WORKER_SECRET`. (8) Section 16 added subsection 16.5 with the scripted 90-second demo arc for hackathon judging. (9) MCP tool list expanded to 15 tools including `bindTelegram`, `bindDiscord`, `notifyAgent`. (10) Env-var manifest in section 17 reorganized into primary/scaffolded chat platform groups, added OPENCLAW_GATEWAY_URL/TOKEN, OPENCLAW_ADMIN_PASSWORD, MCP_SHARED_SECRET, MCP_WORKER_SECRET, DISCORD_APP_ID with explanatory comments. (11) Ownership boundary diagram (6.3) corrected to show provider-config relationship instead of function-handoff.*
