# OpenClaw Venture Partner — Complete Project Overview

> **Audience:** team presentation slides (ClawGrowth, RV College of Engineering).
> **Source:** distilled from `PRODUCTION_BUILD_GUIDE.md` (authoritative), `CLAUDE.md` (orientation), `docs/HOSTING_GATEWAY.md` (deployment), and the 12-phase build history. Every claim here is grounded in shipped code.

---

## 1. Executive Summary

**OpenClaw Venture Partner** is an autonomous AI deal-flow agent for freelancers and small agencies. It does three things continuously, in the background, while you sleep:

1. **Scouts** new freelance leads from job boards (Upwork, LinkedIn, Indeed, Reddit, Contra, Freelancer)
2. **Drafts** personalized outreach pitches for the highest-quality leads, with optional proof-of-value artifacts (Lighthouse audits, sample components)
3. **Negotiates** by classifying inbound replies, drafting tone-variant responses, and maintaining persistent client memory

Brand promise: **draft-only.** Every outbound action — every email, every status change — requires human approval. The agent never sends anything autonomously.

The product is built on top of [**OpenClaw**](https://github.com/openclaw/openclaw), an open-source self-hosted AI agent platform (368k+ GitHub stars, daily release cadence, created by Peter Steinberger). OpenClaw provides the chat-platform adapters (Telegram, Discord, Slack, WhatsApp), skill loading, multi-LLM provider support, and the conversational reasoning loop. Our code adds the domain-specific skills, MCP tools, web dashboard, database schema, and worker pipelines.

**Team:** ClawGrowth (RV College of Engineering) · Lead: Dheeran

---

## 2. The Problem

Freelancers waste 4-8 hours per week on lead-finding scut work:

- **Manual scraping** — checking 5+ job boards every day, deduping leads they've seen
- **Cold outreach drafting** — copying templates, swapping in details, getting 1-2% response rates because pitches feel generic
- **Reply triage** — distinguishing genuine interest from polite no's, scoping questions, and unsubscribes
- **Context-switching** — jumping between Gmail, Notion, Trello, Slack just to remember what they last said to which client

The brand promise of every "AI assistant for freelancers" tool is full automation. The reality: full automation is **dangerous** — one wrong email to a real client and the relationship is gone. Operators don't want autopilot; they want a draft-everywhere, approve-on-glance partner.

## 3. The Solution

A three-layer agent that **drafts, never sends.**

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — SCOUT                                            │
│  Pull leads from 6 job-board sources every hour.            │
│  Score each with an LLM (0-100) on stack match, budget,     │
│  signal strength.  Auto-pitch the top leads at score ≥80.   │
│  ──────────────────────────────────────────────────────────  │
│  Layer 2 — ARCHITECT (proof-of-value)                       │
│  For high-confidence pitches, attach a real artifact:       │
│  Lighthouse audit, code sample, design teardown — generated │
│  by the worker, included as the pitch's hook.               │
│  ──────────────────────────────────────────────────────────  │
│  Layer 3 — NEGOTIATOR                                       │
│  Inbound reply classified (positive / negative / question / │
│  unsubscribe). Three tone-variant responses drafted for     │
│  human selection. Won deal becomes a client; client memory  │
│  (memory.md) accumulates from every interaction.            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  Every outbound = HITL gate
```

Operators interact through **two surfaces**:

1. **Web dashboard** (Next.js, deployed on Vercel) — the analytics, approval queues, client list, settings
2. **Chat** — Telegram, Discord, the Gateway's web Control UI — for "draft a pitch for the top lead", "approve pitch #3", "what do we know about Acme Corp"

Both surfaces share state through Supabase Realtime: an approval tap from Telegram updates the dashboard live, and vice versa.

---

## 4. System Architecture (high level)

```
┌───────────────────────────────────────────────────────────────┐
│                       OPERATOR                                │
│            (web dashboard + Telegram + Discord)               │
└─────┬───────────────┬────────────────────────┬────────────────┘
      │               │                        │
      ▼               ▼                        ▼
  ┌─────────┐  ┌──────────────┐        ┌──────────────────┐
  │ Web UI  │  │ Telegram     │        │ Discord          │
  │ (Vercel)│  │ Bot Webhook  │        │ Interactions     │
  └────┬────┘  └──────┬───────┘        └─────────┬────────┘
       │              │                          │
       │              └────────┬─────────────────┘
       │                       │
       │              ┌────────▼─────────┐
       │              │  OpenClaw        │
       │              │  Gateway         │
       │              │  (Oracle Cloud   │
       │              │   Always Free)   │
       │              │  - 9 skills      │
       │              │  - 5 LLMs        │
       │              │  - cron, memory  │
       │              └────────┬─────────┘
       │                       │
       └───────┬───────────────┘
               │
               ▼  HTTPS / JSON-RPC
  ┌──────────────────────────────────┐
  │   Next.js API Routes (Vercel)    │
  │   /api/mcp   — agent tool calls  │
  │   /api/scout — manual trigger    │
  │   /api/pitches/* — approval ops  │
  │   /api/email/inbound — Resend    │
  └──────────────┬───────────────────┘
                 │
                 ▼  Inngest events
  ┌──────────────────────────────────┐
  │  Worker functions (serverless)   │
  │  - scoutPipeline (scrape+score)  │
  │  - draftPitch (LLM streaming)    │
  │  - sendApprovedReply (Resend)    │
  │  - runLighthouseAudit (PSI API)  │
  │  - processInboundReply (classify │
  │    + draft 3 responses)          │
  │  - detectUpsells (daily cron)    │
  └──────────────┬───────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────┐
  │  Supabase                        │
  │  - 15 tables (RLS-locked)        │
  │  - Auth (email + RLS policies)   │
  │  - Realtime (channel broadcast)  │
  │  - Postgres + matviews           │
  └──────────────────────────────────┘
                 ▲
                 │ scrapes
  ┌──────────────────────────────────┐
  │  Zyte (primary) + Firecrawl      │
  │  (secondary) + stub for tests    │
  │  - 6 sources, per-source rate    │
  │    limits, exponential backoff   │
  │  - JSON-LD JobPosting fallback   │
  └──────────────────────────────────┘
```

The architectural payoff: **the operator's drafted pitch can be approved from any of three surfaces** (web button, Telegram inline keyboard, Discord embed button) — and all three update each other live via Supabase Realtime.

---

## 5. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) on Vercel | SSR + edge + free tier covers prototype |
| **Workers** | Inngest serverless on Vercel | Event-driven, retries, dedupe via idempotency keys |
| **Database** | Supabase (Postgres) | RLS, Auth, Realtime in one — generous free tier |
| **Email** | Resend | Modern API, generous free tier, deliverability |
| **AI Agent** | OpenClaw (self-hosted) | Open-source, multi-channel, multi-LLM, skill-based |
| **Agent host** | Oracle Cloud Always Free | $0 forever, 1-24 GB RAM, 24/7 uptime |
| **HTTPS** | Caddy + DuckDNS | Auto Let's Encrypt, free, zero-config |
| **Scraping** | Zyte (primary) + Firecrawl (secondary) | Battle-tested, anti-bot resistant, free credits |
| **LLM providers** | Copilot · Gemini · Groq · OpenRouter · Anthropic (dormant) | Free-tier-first cascade, all 5 declared in agent config |
| **Caching / KV** | Upstash Redis | Rate limiting + idempotency, generous free tier |
| **Observability** | Sentry + PostHog (SDK-free shims, env-driven) | Optional, no required spend |
| **Tests** | Vitest (47 unit) + Playwright (4 E2E) | Fast unit + real-browser flows |
| **CI** | GitHub Actions | Fans Vitest across 3 packages, runs typecheck + lint |
| **Languages** | TypeScript everywhere (strict mode) | Single language, single dependency tree |

**$0 budget, zero hidden costs.** Every service used has a free tier sized for prototype + small-scale demo. The biggest constraint is OpenRouter's 8 req/min on free models — handled by retry logic.

---

## 6. OpenClaw Integration — The AI Agent Runtime

OpenClaw is **not a library we import** — it's a **deployable application** (a long-running Gateway process). We integrate via three surfaces:

### 6.1 Skills (in `apps/agent/skills/`)

Markdown files with YAML frontmatter. The Gateway loads them on startup; each skill defines triggers and steps that resolve natural-language requests into MCP tool calls.

**The 9 production skills:**

1. **`scout`** — "find leads for {query}", "scout next.js" → calls `runScout` MCP tool
2. **`draft_pitch`** — "draft pitch for the top lead" → calls `draftPitch` MCP tool with disambiguation
3. **`approve_pitch`** — Approve a pending pitch with payload-hash verification
4. **`reject_pitch`** — Reject a draft, optional feedback note flows to client memory
5. **`show_top_lead`** — Surface the highest-scored un-actioned lead
6. **`client_memory`** — Read a client's persistent `memory.md` (past pitches, preferences, signals)
7. **`reply_to_email`** — Classify inbound reply, draft 3 tone-variant responses
8. **`lighthouse_audit`** — Run PageSpeed Insights, attach result as proof artifact
9. **`help`** — Onboarding fallback for unrecognized prompts

### 6.2 MCP Tools (in `apps/web/app/api/mcp/route.ts`)

JSON-RPC over HTTP. The Gateway calls these to actually execute work.

**The 11 production MCP tools:**

| Tool | Purpose |
|---|---|
| `runScout` | Trigger scout pipeline for a query |
| `getRecentLeads` | Top-N recent leads |
| `getTopLead` | Highest-scored lead (used for "the top lead" disambiguation) |
| `draftPitch` | Trigger pitch draft generation |
| `getPendingPitches` | Pitches awaiting approval |
| `approvePitch` | Verify payload_hash + fire `pitch/approved` event |
| `rejectPitch` | Mark pitch rejected |
| `editPitch` | Update draft + recompute payload_hash |
| `bindTelegram` | Match 6-digit code to Telegram user ID |
| `bindDiscord` | Same for Discord |
| `notifyAgent` | Worker → chat callback (push pitch_drafted notifications) |

Authentication: every call carries `Authorization: Bearer <MCP_SHARED_SECRET>`. `notifyAgent` uses a separate worker secret (`MCP_WORKER_SECRET`) so workers can push notifications without granting full tool access.

### 6.3 Control UI + Chat Surface

The Gateway hosts its own web UI (the OpenClaw Control UI). We embed it as an `<iframe>` on our `/agent` page so operators get conversational chat *inside* our dashboard. Same skills, same MCP tools, no context-switch.

### 6.4 Provider chain

`apps/agent/openclaw.config.json` declares all 5 LLM providers:

```
Copilot (primary, flat-fee)
  ↓ fallback
Gemini (free tier)
  ↓ fallback
Groq (fast inference)
  ↓ fallback
OpenRouter (meta-router, free models)
  ↓ fallback
Anthropic (dormant — only if ANTHROPIC_API_KEY set)
```

The Gateway tries them in order; our worker-side LLM client (independent of the Gateway) uses the same chain for scoring and drafting calls. **One consistent provider strategy across two execution contexts.**

---

## 7. Data Model — 15 Tables (Supabase)

Every table has Row-Level Security (RLS) policies; users only see their own rows.

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users` with operator profile, telegram_user_id, discord_user_id |
| `sources` | Configured scraping sources per user (which boards, search queries) |
| `leads` | Every scraped lead — raw, normalized, source URL, scraped_at |
| `scores` | LLM-generated scores for leads (0-100, reasoning, signals) |
| `pitches` | Drafted, approved, sent pitch emails — with `payload_hash` for HITL integrity |
| `clients` | Won deals → ongoing client relationships (with `memory_md` markdown blob) |
| `approvals` | Audit trail of every HITL approval (who, when, payload_hash verified) |
| `llm_calls` | Telemetry per LLM call: provider, model, input/output tokens, cost_usd, idempotency_key, cached_response_json |
| `scrape_failures` | Raw HTML when parsers fail — debugging gold |
| `provider_health` | Per-LLM-provider rolling health (success rate, latency, errors) |
| `audit_log` | Append-only log of all sensitive actions (auth, RLS-bypass calls, etc.) |
| `email_replies` | Inbound replies from Resend webhook |
| `proof_artifacts` | Layer 2 generated artifacts (Lighthouse audits, sample components) |
| `scout_runs` | Per-scout-run summary (separate from individual leads) |
| `binding_codes` | One-shot codes for chat-platform binding (Telegram, Discord) |

**Materialized views:**
- `user_daily_spend` — refreshed nightly via cron, drives the `USER_DAILY_BUDGET_USD` guard

**Migrations:** 17 SQL files in `packages/db/migrations/`, applied in order. Migration `0017` is the latest.

---

## 8. LLM Provider Strategy

The build guide specifies a **5-provider cascade** to balance cost, speed, and resilience.

| Provider | Role | Free-tier behavior |
|---|---|---|
| **GitHub Copilot** | Primary (flat-fee Pro account; zero per-call cost) | Best when the operator already has Copilot |
| **Gemini** | Fast + capable backup | Generous free tier (gemini-2.5-flash) |
| **Groq** | Speed-critical paths (real-time scoring) | Free tier, low TPM cap (12K-30K) |
| **OpenRouter** | Meta-router fallback | Small free credit; 8 req/min on free models |
| **Anthropic** | Dormant — high-quality fallback | Only activates if `ANTHROPIC_API_KEY` set |

**`packages/agent/src/llm/router.ts`** — provider-selection logic with budget-exceeded guard (`BudgetExceededError` + `USER_DAILY_BUDGET_USD` env var), idempotency keys (avoid double-charging on retries), `cached_response_json` (replay LLM calls in tests), and per-provider health rolling stats.

**`pricing.ts`** populates `cost_usd` on every `llm_calls` row. The nightly matview refresh aggregates this into per-user daily spend, gated by the budget guard before the next call.

---

## 9. Multi-Source Scraping

Phase 9 made scout truly multi-source. Default scrape spans **all 6 parser-supported sources**: Upwork, LinkedIn, Indeed, Reddit, Contra, Freelancer. Operator can override via `SCOUT_DEFAULT_SOURCES` env var.

**Per-source architecture:**

- **`SourceType` enum** — type-safe source identifiers
- **`Scraper.health()`** — per-adapter health check; failures route to `scrape_failures` with raw HTML
- **URL builders** — per-source query → search-results URL
- **Parsers** — DOM-walking + fallback to JSON-LD `JobPosting` schema (LinkedIn + Freelancer)
- **Per-source token-bucket rate limits** — never hammers a single source
- **Exponential-backoff retry** — 1s, 4s, 16s on transient failures
- **Cascading adapter fallback** — Zyte → Firecrawl → stub, configured per env

**Zyte vs Firecrawl:** Zyte is the primary (battle-tested, anti-bot, generous free credits). Firecrawl is the secondary (cheaper for some sources, simpler API). The cascade ensures one provider's outage doesn't kill the pipeline.

**Auto-pitch fan-out (Phase 9):** top `AUTO_PITCH_MAX_PER_RUN` (default 5) leads with score ≥ `AUTO_PITCH_SCORE_THRESHOLD` (default 80) emit `pitch/draft-requested` Inngest events with dedupe id `auto-pitch:{lead_id}`. Worker streams the pitch body via `streamDraftPitch` helper, UPDATEs `pitches.draft` + `payload_hash` every ~5 chunks, and the dashboard's PitchCard renders chunks live via Realtime. Falls back to non-streaming `complete()` on stream failure.

---

## 10. Human-in-the-Loop (HITL) Approval Flow

The cornerstone of the brand promise. Every outbound email goes through this.

```
1. Worker drafts pitch → INSERT into `pitches` (status='draft')
                          + computes `payload_hash` (SHA-256 of subject+body+lead_id)
                          + Realtime broadcast on `pitch:{user_id}`

2. Operator sees the pitch on the dashboard OR in Telegram (inline keyboard).
   Each surface includes the `payload_hash` in its callback data.

3. Operator taps Approve.
   - Web: POST to /api/pitches/[id]/approve with payload_hash
   - Telegram/Discord: Bot callback → MCP tool `approvePitch` with payload_hash

4. Server-side approval handler:
   - Loads the current pitch row
   - Recomputes the expected hash from CURRENT subject+body
   - If hashes match → write to `approvals` table, fire `pitch/approved` event
   - If hashes DIFFER → 409 Conflict ("pitch has changed since you reviewed it")

5. Send worker handles `pitch/approved`:
   - Loads pitch + lead
   - Calls Resend to send the email
   - Updates `pitches.sent_at`
   - Audit-logs the action
   - Realtime broadcast → all surfaces flip to 'sent'
```

**Why payload_hash matters:** if the operator approves on Telegram, then someone (another operator? an AI agent? an attacker?) edits the pitch in the dashboard before the worker sends, the hash mismatch catches it and refuses to send. **The approval is bound to the exact content the operator saw.**

**Test coverage:** `pitch-approve` happy path, `pitch-reject` flow, **`stale-hash` 409 guard** — all in `apps/web/e2e/`. Plus unit tests for `payloadHash` in `packages/agent/__tests__/`.

---

## 11. Security & Privacy

- **Row-Level Security** on every Supabase table. Users only see their own rows. Service-role key only used server-side; never exposed to browser.
- **Auth via Supabase Auth** (email + magic link). Sessions stored in cookies, validated by Next.js middleware (Phase 2.5 cutover).
- **Rate limiting** — Upstash Redis with in-memory fallback. `/api/scout` 10/hr per user; `/api/pitches/draft` 30/day per user; per-MCP-tool limits.
- **Audit log** — every sensitive action (auth, RLS-bypass, manual data export) is appended to `audit_log` with actor, action, target, and timestamp.
- **Skip-to-content a11y link** — keyboard navigation respected.
- **`MCP_SHARED_SECRET` + `MCP_WORKER_SECRET`** — separate trust tiers for Gateway vs worker callbacks.
- **`payload_hash` integrity check** — every outbound email is cryptographically bound to what the operator saw at approval time.
- **No emoji in product copy** — chat-platform carve-out only (Telegram/Discord), per build-guide §16 ops rules.
- **`openclaw-design-system/` is frozen** — third-party design system, never modified.

---

## 12. Operational Architecture (Hosting, $0 Budget)

| Component | Where | Cost |
|---|---|---|
| Web dashboard | Vercel (free tier) | $0 |
| Inngest workers | Vercel serverless (free tier) | $0 |
| Database | Supabase (free tier — 500 MB, 50K rows OK) | $0 |
| Email | Resend (free tier — 3K emails/mo) | $0 |
| LLM (primary) | Copilot Pro (operator's existing) | $0 marginal |
| LLM (free fallbacks) | Gemini, Groq, OpenRouter free models | $0 |
| Scraping | Zyte free credits + Firecrawl free | $0 |
| OpenClaw Gateway | **Oracle Cloud Always Free** (1 OCPU, 1-24 GB RAM, 24/7) | $0 forever |
| HTTPS | Caddy + Let's Encrypt (auto cert renew) | $0 |
| Hostname | DuckDNS | $0 |
| Cache / rate limit | Upstash Redis (free tier) | $0 |

**Setup walkthrough:** `docs/HOSTING_GATEWAY.md` (this repo) — three documented hosting paths:
- **Path 1:** Oracle Cloud Always Free (recommended for India users — no prepayment)
- **Path 2:** GCP `e2-micro` Always Free (India hits ₹1,000 prepayment)
- **Path 3:** Local laptop + Cloudflare Tunnel (laptop-bound, truly card-free)

Total provisioning time, end-to-end: ~45 min for a new operator.

---

## 13. Phase-by-Phase Build Timeline

The project shipped in 12 phases (10 complete, 11+12 in progress). Each phase has a definition-of-done in `PRODUCTION_BUILD_GUIDE.md`.

| Phase | Status | What shipped |
|---|---|---|
| **1 — Foundations** | ✅ complete | Next.js + Supabase + design system; auth scaffolded |
| **2 — Scout pipeline** | ✅ | Single-source (Upwork) scrape → score → leads table |
| **2.5 — Auth + RLS** | ✅ | Real auth cutover; RLS policies on every table |
| **3 — HITL approval flow** | ✅ (2026-05-06) | `payload_hash` integrity check; Telegram inline-keyboard callbacks |
| **4 — Layer 2 (proof-of-value)** | ✅ (2026-05-06) | Migration 0012 (`proof_artifacts`); `runLighthouseAudit` via PageSpeed Insights API (no Chromium); ProofCard preview |
| **5 — Layer 3 (negotiation)** | ✅ (2026-05-06) | Migrations 0013+0014; `classify-reply` + `draft-reply` prompts; inbound webhook + simulator; `/clients` list with MemoryRenderer; daily upsell-detector cron |
| **6 — Production hardening** | ✅ (2026-05-06) | Demo-mode parachute; rate limiter; Sentry/PostHog shims; search bar; notifications system; `/settings` profile + data export/import + danger zone; hours-saved heuristic |
| **7 — Observability/test/deploy** | ✅ (2026-05-07) | 47 Vitest tests across 7 files; 4 Playwright E2E; CI fans tests across 3 packages; `/api/health` route; `docs/RUNBOOK.md`; README rewrite with 90s demo arc |
| **8 — Build-guide gap-zero** | ✅ (2026-05-06) | Groq adapter; pricing.ts; LLM streaming; provider_health; user_daily_spend matview; SourceType enum + 6 parsers; per-source rate limits; exponential backoff; scrape_failures; Discord webhook + slash commands; 9 skills total; openclaw.config.json with 5 LLMs + 4 channels |
| **9 — Real scout end-to-end** | ✅ (2026-05-07) | Multi-source scrape default; auto-pitch fan-out (top 5 leads at score ≥80); streaming draft helper; PitchCard live updates; LeadTable empty-state CTA; JSON-LD JobPosting fallback for LinkedIn + Freelancer |
| **10 — Gateway in runtime** | ⏳ (2026-05-07) | Gateway deployed (Railway template); `/agent` page with status card + Control UI link + 9 skills + 11 MCP tools + ASCII runtime diagram; sidebar entry |
| **11 — Free hosting cutover** | ⏳ (2026-05-08) | Railway → **Oracle Cloud Always Free**; Caddy + DuckDNS + Let's Encrypt auto-HTTPS; `/setup` wizard; 9 workspace skills loaded; ChatPanel iframe on `/agent`; `docs/HOSTING_GATEWAY.md` with 3 hosting paths |
| **12 — Full OpenClaw cutover** | ⏳ Stage A done, Stage B in progress | Stage A: env-gated `OPENCLAW_GATEWAY_PRIMARY` for notifyAgent relay. Stage B: MCP server connected via stdio bridge (`/mcp-bridge.js`); Telegram/Discord webhooks repointed to Gateway; standalone routes deleted; Slack activated |

**Cumulative repo size:** monorepo with `apps/web`, `apps/worker`, `apps/agent`, plus 5 shared packages (`packages/agent`, `packages/db`, `packages/scraping`, `packages/design-system`, `packages/shared`). Strict TypeScript, ~25K LOC project total.

---

## 14. Test & Quality Engineering (Phase 7)

**Vitest unit tests — 47 passing across 7 files:**

| Package | Tests | What's covered |
|---|---|---|
| `packages/agent` | 33 | `payloadHash`, `draftPitch`, `classifyReply`, `router` (provider-selection logic), `scoreLead` (happy path + budget guard) |
| `packages/scraping` | 9 | `upwork` parser (state-walk + DOM fallback fixtures) |
| `apps/worker` | 5 | `scoutPipeline` (e2e with mocked supabase/scraper/scoreLead/dispatch) |

**Playwright E2E — 4 specs:**

- `pitch-approve.spec.ts` — happy path: draft → approve → sent
- `pitch-reject.spec.ts` — reject flow with optional feedback
- `stale-hash.spec.ts` — 409 Conflict guard when content changes between draft and approval
- `signup-scout.spec.ts` — signup → first scout → first lead (skip-friendly via `TEST_FRESH_USER_*`)

**CI:** GitHub Actions fans Vitest across all three test packages in parallel — `pnpm -r --filter @openclaw/agent --filter @openclaw/scraping --filter @openclaw/worker run test`. Plus typecheck + lint on every push.

**`/api/health`** — returns 200/503 with database + LLM-provider checks. Documented in `docs/RUNBOOK.md` for incident response.

---

## 15. Demo Flow (90 seconds)

What a judge sees when they pick up the keyboard:

1. **Open `/agent`** — green "Gateway connected" card, `<iframe>` loads the OpenClaw Control UI
2. **Type "find leads for next.js"** in chat — Gateway matches `scout` skill, calls `runScout` MCP tool, fires Inngest event
3. **Switch to `/inbox`** in another tab — leads stream in live via Realtime as they're scraped + scored
4. **Top lead at score 92** — auto-pitch worker has already drafted a body using the streaming helper
5. **Open the lead's pitch** — see the body, the proof artifact (Lighthouse score 85 → 95), the reasoning
6. **Approve from web** — instant flip to "sent"; check Resend dashboard for the actual email
7. **Or — approve from Telegram** — inline keyboard, one tap, dashboard updates simultaneously
8. **Inbound reply arrives** (simulated via `/api/email/simulate`) — classifier runs, three drafts appear
9. **Pick the best draft, approve** — Resend sends, `clients.memory_md` gets the new entry appended

**The point of the demo:** every action that touches the outside world has a green button gate. The agent works around the clock; the operator approves in 30 seconds per pitch.

---

## 16. Brand Identity

- **Mascot:** Molty the lobster (OpenClaw's official mark — affectionate brand promise of "your space lobster does the busywork")
- **Primary color:** Coral `#FF4D4D` (`0xFF4D4D` = 16731981 for Discord embeds)
- **Typography:** Lucide-only icons (per build-guide §16 ops rules), no Tailwind arbitrary values
- **Voice:** terse, builder-y, no emoji in product copy (chat-platform carve-out for Telegram/Discord MarkdownV2)
- **Design system:** `openclaw-design-system/` — third-party, frozen; we never modify it
- **Tagline ideas:** *"Drafts everything. Sends nothing. Until you say yes."*

---

## 17. Team — ClawGrowth

- **Lead:** Dheeran (RV College of Engineering, Bangalore)
- **Affiliation:** RVCE
- **Built:** during the *(hackathon name TBD)*, 2026-05-06 → 2026-05-08

**Project repo:** https://github.com/Dheeran-git/openclaw-venture-partner
**Live demo:** `<your-vercel-url>` (e.g. `https://openclaw-venture-partner-web.vercel.app`)
**Gateway:** `https://openclaw-vp.duckdns.org` (DuckDNS-backed, Oracle Cloud Always Free)

---

## 18. Roadmap (Post-Hackathon)

**Near-term (Phase 12 completion):**
- Telegram + Discord webhooks fully migrated onto Gateway (currently MCP-tool-direct fallback active)
- Slack channel activated (~30 min, Gateway-only)
- Standalone `/api/telegram/webhook` and `/api/discord/interactions` routes deleted (~700 LOC removal)
- `notifyAgent` stripped down to pure Gateway-relay (env-gated today)

**Medium-term:**
- WhatsApp Business activation (3-10 days of Meta Business Verification bureaucracy first)
- Daily scout cron migrated from Vercel cron to OpenClaw's cron tool
- Browser tool re-enabled (requires VM upgrade from 1 GB → 4 GB)
- iOS / macOS companion apps bound to Gateway URL (built-in OpenClaw feature)

**Long-term:**
- Multi-tenant per-user Gateway provisioning (Hosted-by-us model from build-guide §6.2)
- Real customers, billing, paid Groq/Anthropic credits
- ClawHub skill marketplace integration (publish our 9 skills)

---

## 19. Selected Technical Achievements (for slide call-outs)

- **Zero-budget production deployment** — every service used has a free tier sufficient for this prototype, including 24/7 always-on agent runtime
- **Provider-agnostic LLM router** — 5 providers in cascade, automatic failover on rate limits, budget guard, idempotency keys, response caching
- **47 unit tests + 4 E2E** — including the bespoke `stale-hash` 409 guard that's the security heart of HITL
- **Multi-source scraping with parser-level fallbacks** — JSON-LD `JobPosting` schema fallback specifically built for LinkedIn + Freelancer's anti-bot DOM scrambling
- **Streaming pitch drafts** — server streams chunks via SSE, worker UPDATEs `pitches.draft` + `payload_hash` every 5 chunks, dashboard renders live via Realtime
- **payload_hash content integrity** — SHA-256 binds approval to exact content; mismatched hashes return 409
- **Two surfaces, one state** — web button and Telegram inline keyboard tap the same approval handler, hit the same RLS-protected table, broadcast the same Realtime event
- **9 workspace skills + 11 MCP tools** — fully wired Gateway integration; Gateway runs on Oracle Cloud Always Free
- **Stdio MCP bridge** — sidesteps Vercel serverless's incompatibility with long-lived SSE streams by tunneling stdio MCP through the Gateway container to our HTTP-based `/api/mcp` endpoint

---

## 20. References

- **Build guide (authoritative):** `PRODUCTION_BUILD_GUIDE.md`
- **Operator orientation:** `CLAUDE.md`
- **Hosting walkthrough:** `docs/HOSTING_GATEWAY.md`
- **Incident response:** `docs/RUNBOOK.md`
- **Backlog / known debt:** `BACKLOG.md`
- **Repo:** https://github.com/Dheeran-git/openclaw-venture-partner
- **OpenClaw upstream:** https://github.com/openclaw/openclaw

---

*Last updated: 2026-05-08, end of Phase 11 / Phase 12 Stage A. Phase 12 Stage B in progress (MCP stdio bridge wiring).*
