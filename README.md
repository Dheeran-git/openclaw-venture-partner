# OpenClaw Venture Partner

> Autonomous AI deal-flow agent for freelancers and small agencies. Drafts every outbound email, never sends without explicit human approval.

Live demo: **[openclaw-venture-partner-web.vercel.app](https://openclaw-venture-partner-web.vercel.app/)**

Built by **ClawGrowth** at RV College of Engineering on top of [OpenClaw](https://github.com/openclaw/openclaw), the open-source personal-AI-assistant platform.

---

## What it does

OpenClaw VP runs the full deal flow for solo freelancers and 2–5 person agencies. Three layers, all gated by human approval:

| Layer | Action | Approve from |
|---|---|---|
| **Scout** | Scrapes Upwork / LinkedIn / Reddit, dedups, scores each lead 0–100 against the operator's profile | – |
| **Architect** | Drafts personalized outreach with a Lighthouse audit attached as proof-of-value | Telegram or Web |
| **Negotiator** | Classifies inbound replies, drafts 3 reply options, maintains diff-based client memory, flags upsell candidates | Telegram or Web |

The brand promise: **draft-only, never sends without explicit approval.** Every approval is cryptographically verified — a `payload_hash` of the pitch content is computed at draft time and recomputed at approve time; mismatch returns a `409 stale_draft` and refuses to send.

---

## The 90-second demo

1. **Scout & score (0:00–0:30)** — operator types `senior next.js engineer for SaaS dashboards`, scout pipeline runs in real time, leads stream into the inbox with scores and reasoning. Top lead is a $6,200 Next.js dashboard rebuild — score 95.
2. **Draft & notify (0:30–1:00)** — operator clicks **Draft pitch**. Pitch body streams in. The same pitch arrives on the operator's phone in Telegram with **Approve / Reject** buttons.
3. **Approve & send (1:00–1:30)** — operator taps **Approve** in Telegram. Webhook verifies the `payload_hash`, fires `pitch/approved`, the worker sends via Resend. The dashboard flips to **Sent** in real time. Audit log records `actor_platform: 'telegram'`.

Everything above is real: real Supabase database, real LLM calls through a 5-provider chain, real OpenClaw Gateway running on Railway, real Telegram bot, real email sent via Resend.

---

## Architecture

```
                  ┌──────────────────────────────┐
                  │   Operator (web + Telegram)  │
                  └──────────────┬───────────────┘
                                 │
            ┌────────────────────┴────────────────────┐
            │                                          │
      ┌─────▼──────┐                            ┌─────▼─────┐
      │ Next.js 15 │                            │ Telegram  │
      │ on Vercel  │◀──── webhooks (signed) ────│ webhook   │
      └─────┬──────┘                            └─────┬─────┘
            │ /api/inngest                             │
      ┌─────▼─────────────────────────────────────────▼─────┐
      │  Inngest worker functions (run on Vercel)
      │  scout · draftPitch · sendPitch · runLighthouseAudit
      │  processInboundReply · sendApprovedReply · detectUpsells
      └─────────────────────────┬───────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
      ┌─────▼─────┐       ┌─────▼──────┐     ┌──────▼──────┐
      │ Supabase  │       │ 5-provider │     │ OpenClaw    │
      │ Postgres  │       │ LLM chain  │     │ Gateway     │
      │ (RLS)     │       │ + Resend   │     │ on Railway  │
      └───────────┘       └────────────┘     └─────────────┘
```

The OpenClaw Gateway hosts the chat-side skills + MCP routing for Discord/Slack/WhatsApp expansion. Telegram is owned by a thin Vercel webhook that calls the same MCP handlers directly (Railway free-tier OOMs the bot library, so we split the contract — see [decision log in BACKLOG.md](./BACKLOG.md#decision-log)).

---

## Tech stack

- **Frontend:** Next.js 15.5, React 19, TypeScript strict, Tailwind 3, Lucide icons
- **Backend:** Supabase (Postgres + Auth + Realtime + RLS) · Inngest (serverless workflow) · Resend (transactional email)
- **LLM:** 5-provider chain — Copilot → Gemini → Groq → OpenRouter → Anthropic-dormant — with health checks and per-call cost tracking
- **Scraping:** Stub by default for the demo; Zyte adapter and Firecrawl adapter ship behind env-var flags
- **Proof-of-value:** Lighthouse via Google PageSpeed Insights API (no Chromium binary needed)
- **Chat surfaces:** Telegram (live) + Discord (configured, awaiting bot creds) — both go through the same MCP `notifyAgent` + `chat_callback_tokens` flow
- **Observability:** Sentry + PostHog SDK-free integrations (env-driven, no-op without creds)
- **Rate limiting:** Upstash Redis with per-process in-memory fallback

---

## Repository layout

```
apps/
  web/            Next.js dashboard + all API routes (Vercel deploy)
  worker/         Inngest function definitions (served via apps/web/api/inngest)
  agent/          OpenClaw Gateway resources — skills + MCP config
packages/
  agent/          Shared LLM client, prompts, drafting/scoring/negotiation, MCP tool handlers
  db/             Supabase migrations + types
  scraping/       Zyte / Firecrawl / stub adapters
  shared/         Cross-package types
  design-system/  Tailwind tokens + base components
openclaw-design-system/  Frozen design bundle (do not modify)
```

---

## Implemented vs deferred

### Phase 1 → 5 (complete)
- Auth + RLS cutover (Supabase Auth, three-step onboarding, two-account isolation test)
- Scout pipeline (scrape → dedup → score → insert with realtime activity rail)
- HITL approval flow (pitch drafting, payload-hash verification, Telegram inline keyboard, Resend send)
- Lighthouse proof-of-value (PageSpeed Insights API → JSON metrics in PitchCard)
- Reply ingestion + drafting (classify → 3 tone options → approve → memory_md update → upsell cron)

### Phase 6 (complete on free tier)
- Demo mode parachute (`/api/demo/seed` → guaranteed live-demo data)
- Rate limiting (Upstash + in-memory fallback) on /api/scout, /api/pitches/draft, /api/mcp per-tool
- Sentry + PostHog (env-driven, no SDK weight)
- Postgres-backed full-text search via `/api/search` + `⌘K` shortcut
- Real notifications system (table + bell + dropdown, realtime)
- /settings page (profile editor, connected accounts, data export/import, danger zone)
- Hours-saved heuristic + activity rail dividers
- Skip-to-content a11y link

### Phase 7 (in this submission)
- Vitest unit tests + Playwright E2E suite + GitHub Actions CI
- README + Runbook
- 90-second demo arc

### Deferred to post-hackathon
- Custom domain + Resend domain verification (uses sandbox `onboarding@resend.dev`)
- Supabase Pro tier upgrade ($25/mo)
- WhatsApp / Slack chat surfaces (scaffolded, not activated)
- Stripe billing
- Marketing site

See [`BACKLOG.md`](./BACKLOG.md) for the full ledger and rationale.

---

## Running locally

Prereqs: Node 20+, pnpm 10+, a Supabase project, an Inngest account, a Resend API key, at least one LLM provider key.

```bash
git clone https://github.com/Dheeran-git/openclaw-venture-partner.git
cd openclaw-venture-partner
pnpm install

cp .env.example .env
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY,
# RESEND_API_KEY, OPENROUTER_API_KEY (or another LLM provider key),
# TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET

# Apply all 15 migrations to your Supabase project via the SQL editor
# (in order: 0001 → 0015). Or use the Supabase CLI if linked.

pnpm dev                          # starts apps/web on :3000
pnpm --filter web typecheck       # tsc --noEmit across the workspace
pnpm --filter web build           # production build sanity check
pnpm --filter web test:isolation  # two-account RLS isolation test
pnpm --filter @openclaw/agent test  # Vitest suite
```

Register the Telegram webhook against a public URL (ngrok or similar):

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-public-url/api/telegram/webhook","secret_token":"'"$TELEGRAM_WEBHOOK_SECRET"'","allowed_updates":["message","callback_query"]}'
```

---

## Documentation

- [`PRODUCTION_BUILD_GUIDE.md`](./PRODUCTION_BUILD_GUIDE.md) — the source of truth: architecture, technical decisions, phase plans, env vars, operational rules
- [`CLAUDE.md`](./CLAUDE.md) — orientation for AI coding sessions
- [`BACKLOG.md`](./BACKLOG.md) — deferred work, decisions, and audit trail
- [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) — common incidents and resolutions

---

## Credits

Built by **Dheeran S** (lead) and ClawGrowth at RV College of Engineering. Standing on the shoulders of [Peter Steinberger's OpenClaw](https://github.com/openclaw/openclaw) (the open-source personal-AI-assistant platform that does the chat-surface heavy lifting).

License: source-available; commercial use restricted pending the post-hackathon licensing decision.
