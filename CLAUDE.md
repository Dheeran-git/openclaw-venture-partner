# CLAUDE.md — OpenClaw Venture Partner

Project-root operating manual for Claude Code. Keep this short. Treat it as a door, not a room.

## What this project is

OpenClaw Venture Partner — autonomous AI deal-flow agent for freelancers and small agencies, built on the open-source [OpenClaw](https://github.com/openclaw/openclaw) personal-AI-assistant platform. Three layers of demand finding (Scout / Architect / Negotiator), with brand promise: draft-only, human approval on every outbound action.

Team: ClawGrowth (RV College of Engineering). Lead: Dheeran.

## The single source of truth

**`PRODUCTION_BUILD_GUIDE.md` (in this directory) is the authoritative document for everything: architecture, technical decisions, phase plans, env vars, operational rules.**

Read it at the start of every session. When this file and the build guide disagree, the build guide wins.

## Read order at session start

1. `PRODUCTION_BUILD_GUIDE.md` — the full guide. Especially the section relevant to the current phase (search for "Phase X" headings).
2. `BACKLOG.md` — deferred work and known debt.
3. `CHANGELOG.md` (if present) — recent commits and decisions.
4. This file — only for the orientation below.

## Current phase status

- **Phase 1 (Foundations):** complete.
- **Phase 2 (Scout pipeline):** complete.
- **Phase 2.5 (Auth + RLS cutover):** complete.
- **Phase 3 (HITL approval flow):** complete (2026-05-06).
- **Phase 4 (Layer 2 proof-of-value):** complete (2026-05-06). Migration 0012 (`proof_artifacts`). `runLighthouseAudit` worker via Google PageSpeed Insights API (no Chromium binary). `/api/pitches/[id]/generate-proof` route, ProofCard preview component, draft-pitch prompt accepts optional `proof_context` and worker auto-loads completed proofs.
- **Phase 5 (Layer 3 negotiation):** complete (2026-05-06). Migrations 0013 + 0014. `classify-reply` + `draft-reply` prompts and Zod schemas. `processInboundReply` worker (classify + create-client + draft 3 options). `sendApprovedReply` worker (Resend + memory_md append). `/api/email/inbound` (Resend webhook) + `/api/email/simulate` (free-tier sim). `/clients` list + detail with MemoryRenderer + ReplyCard. Sidebar Clients un-dimmed. `detectUpsells` daily cron + manual trigger.
- **Phase 6 (production hardening):** complete (2026-05-06). Demo-mode parachute (`/api/demo/seed`). Generalized rate limiter (Upstash + in-memory fallback) on `/api/scout` 10/hr, `/api/pitches/draft` 30/day, MCP per-tool. Sentry + PostHog SDK-free shims (env-driven). Search bar with Postgres ILIKE + `⌘K` shortcut. Migration 0015 + real notifications system (table + bell + dropdown + realtime). `/settings` index + profile editor + data export/import + danger zone. Hours-saved heuristic + activity rail dividers. Skip-to-content a11y link.
- **Phase 7 (observability/test/deploy):** complete (2026-05-06). Vitest unit tests (payloadHash, draftPitch, classifyReply — 15 passing). Playwright E2E specs (pitch-approve happy path + payload_hash 409 stale-draft guard). GitHub Actions CI workflow (typecheck + lint + Vitest). README rewrite with architecture diagram + 90-second demo arc. `docs/RUNBOOK.md` with common-incident resolutions.
- **Phase 8 (production-build-guide closeout):** complete (2026-05-06). Closed every gap from a fresh re-read of `PRODUCTION_BUILD_GUIDE.md` against shipped code. **LLM:** Groq adapter (5th provider), `pricing.ts` populating `cost_usd`, `LLMClient.stream()` on Anthropic/Groq/OpenRouter via SSE, idempotency keys + cached_response_json on `llm_calls`, `BudgetExceededError` + `USER_DAILY_BUDGET_USD` guard, `provider_health` table + `user_daily_spend` matview + nightly refresh cron. **Scraping:** `SourceType` enum, `Scraper.health()`, per-source URL builders + parsers (Upwork/LinkedIn/Indeed/Reddit/Contra/Freelancer), per-source token-bucket rate limits, exponential-backoff retry (1s/4s/16s), `scrape_failures` raw-HTML capture, Firecrawl secondary adapter with cascading fallback. **Discord:** `/api/discord/interactions` Ed25519-verified webhook, slash-command registration script (`/scout`, `/pitches`, `/clients`, `/help`), `notifyAgent` fan-out to Discord DM with coral-color embed + Approve/Reject buttons sharing the same `chat_callback_tokens` as Telegram. **Skills:** `reply_to_email`, `client_memory`, `lighthouse_audit` added (9 total). **Config:** `openclaw.config.json` lists all 5 LLM providers + 4 channels (Slack/WhatsApp scaffolded disabled). **Health:** `/api/health` route. **Migrations:** 0016 + 0017. **Env:** `.env.example` rewritten to match build-guide §17 line-for-line. Hackathon-submission-ready.

## Repo orientation

- `apps/web/` — Next.js dashboard (Vercel deploy target).
- `apps/worker/` — Inngest worker functions (Vercel deploy target via Inngest's serverless runtime).
- `apps/agent/` — OpenClaw resource bundle: skills, MCP tool implementations, Gateway config. Not a deployed Node process — these resources are consumed by the OpenClaw Gateway hosted separately on Railway.
- `packages/agent/` — shared agent code: LLM client, prompts, MCP tool handlers.
- `packages/db/` — Supabase migrations and types.
- `packages/scraping/` — Zyte / Firecrawl / stub scraper adapters.
- `packages/design-system/` — Tailwind tokens, base components.
- `openclaw-design-system/` — frozen design system bundle, do not modify.

## OpenClaw integration model — important

OpenClaw is **not an npm library we import.** It is a deployable application — a long-running Gateway process on port 18789 — that we run on Railway. We integrate via:

1. **Skills** — markdown files in `apps/agent/skills/` deployed to the Gateway's workspace.
2. **MCP tools** — HTTPS endpoint at `apps/web/app/api/mcp/route.ts`, called by the Gateway.
3. **WebSocket control plane** — for occasional admin queries from our app.

See section 6 of the build guide for the full ownership boundary diagram and integration architecture.

## When in doubt

Read the relevant section of the build guide. Don't guess. Don't infer architecture from existing code — the existing code may pre-date a decision documented in the guide.

If the build guide doesn't cover something, surface to the owner before implementing.

---

*This file is intentionally thin. The room is `PRODUCTION_BUILD_GUIDE.md`. Last updated: Phases 1–8 complete (2026-05-06). Production-build-guide gap-zero. Hackathon-submission-ready.*
