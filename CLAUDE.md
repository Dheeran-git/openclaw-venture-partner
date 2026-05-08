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
- **Phase 7 (observability/test/deploy):** complete (2026-05-07 strict pass). Vitest unit tests across 7 files / 47 passing — `payloadHash`, `draftPitch`, `classifyReply`, plus the build-guide-§15 quartet `router` (provider-selection logic), `scoreLead` (happy path + budget guard propagation), `upwork` parser (state-walk + DOM fallback fixtures), `scoutPipeline` (e2e with mocked supabase/scraper/scoreLead/dispatch). `@openclaw/scraping` and `@openclaw/worker` got vitest configs + `test` scripts. Playwright E2E (4 specs): `pitch-approve` happy path, `pitch-reject` flow, `stale-hash` 409 guard, `signup-scout` (skip-friendly via `TEST_FRESH_USER_*`) plus signup/login form smoke. GitHub Actions CI fans Vitest across all three test packages (typecheck + lint + Vitest). `/api/health` returns 200/503 with DB + LLM-provider check. `docs/RUNBOOK.md` documents common incidents. README rewrite with 90-second demo arc.
- **Phase 8 (production-build-guide closeout):** complete (2026-05-06). Closed every gap from a fresh re-read of `PRODUCTION_BUILD_GUIDE.md` against shipped code. **LLM:** Groq adapter (5th provider), `pricing.ts` populating `cost_usd`, `LLMClient.stream()` on Anthropic/Groq/OpenRouter via SSE, idempotency keys + cached_response_json on `llm_calls`, `BudgetExceededError` + `USER_DAILY_BUDGET_USD` guard, `provider_health` table + `user_daily_spend` matview + nightly refresh cron. **Scraping:** `SourceType` enum, `Scraper.health()`, per-source URL builders + parsers (Upwork/LinkedIn/Indeed/Reddit/Contra/Freelancer), per-source token-bucket rate limits, exponential-backoff retry (1s/4s/16s), `scrape_failures` raw-HTML capture, Firecrawl secondary adapter with cascading fallback. **Discord:** `/api/discord/interactions` Ed25519-verified webhook, slash-command registration script (`/scout`, `/pitches`, `/clients`, `/help`), `notifyAgent` fan-out to Discord DM with coral-color embed + Approve/Reject buttons sharing the same `chat_callback_tokens` as Telegram. **Skills:** `reply_to_email`, `client_memory`, `lighthouse_audit` added (9 total). **Config:** `openclaw.config.json` lists all 5 LLM providers + 4 channels (Slack/WhatsApp scaffolded disabled). **Health:** `/api/health` route. **Migrations:** 0016 + 0017. **Env:** `.env.example` rewritten to match build-guide §17 line-for-line. Hackathon-submission-ready.
- **Phase 9 (real scout end-to-end):** complete (2026-05-07). Multi-source scrape default (all 6 parser-supported sources, env-overridable via `SCOUT_DEFAULT_SOURCES`). Auto-pitch fan-out — top `AUTO_PITCH_MAX_PER_RUN` (default 5) leads at score ≥ `AUTO_PITCH_SCORE_THRESHOLD` (default 80) emit `pitch/draft-requested` with Inngest dedupe id `auto-pitch:{lead_id}`. `streamDraftPitch` helper streams partial body via `extractPartialBody`; worker UPDATEs `pitches.draft` + `payload_hash` every ~5 chunks; PitchCard renders chunks live via existing Realtime hook. Falls back to non-streaming `complete()` on stream failure. Global `ToastStack` for Run Scout success/error feedback; LeadTable empty-state CTA wired to Topbar `data-scout-query`. JSON-LD JobPosting fallback for LinkedIn + Freelancer parsers (shared `parseJobPostingJsonLd` helper).
- **Phase 10 (OpenClaw Gateway in runtime):** in progress (2026-05-07). Gateway deployed via `vignesh07/clawdbot-railway-template` on Railway; `OPENCLAW_GATEWAY_URL` reads in `apps/web/app/api/openclaw/status/route.ts`. New `/agent` page (`apps/web/app/agent/page.tsx`) shows Gateway connection status + Control UI link + 9 deployed skills + 11 MCP tools + ASCII runtime diagram. Sidebar gets `Agent` entry under Workspace. Operator follow-up: complete the Gateway Setup Wizard at `<gateway>/setup` (skills upload, MCP target, LLM provider keys, optional bot tokens) and add `OPENCLAW_GATEWAY_URL` + `OPENCLAW_GATEWAY_TOKEN` to Vercel env.
- **Phase 11 (Gateway-as-conversation-surface, free hosting cutover):** in progress (2026-05-07). Railway free-tier was OOMing the Gateway under the bot libraries. `docs/HOSTING_GATEWAY.md` now offers three free paths: **Path 1 = Oracle Cloud Always Free (recommended for India users — no prepayment, up to 24 GB ARM A1.Flex)**, Path 2 = GCP `e2-micro` Always Free (India users hit a ₹1,000 deposit), Path 3 = Local + Cloudflare Tunnel (truly $0, laptop-bound). Post-provisioning steps (swap, Docker, OpenClaw container, Caddy auto-HTTPS via DuckDNS/sslip.io, `/setup` wizard, Vercel env wiring, verify) are factored into a host-agnostic "After your VM is up" section. `/agent` page now embeds the Gateway Control UI as an **iframe** (new `ChatPanel` component) for in-dashboard natural-language chat — typing "find leads for nextjs" routes Gateway → skill match → MCP tool. `openclaw.config.json` channel comments rewritten to make the architecture explicit. Operator follow-up: provision per `docs/HOSTING_GATEWAY.md`, paste the new Gateway URL into Vercel env.
- **Phase 12 Stage A (full-OpenClaw cutover, code prep):** complete (2026-05-07). Env-gated Gateway-relay branch added to `notifyAgent` (`packages/agent/src/mcp-tools/index.ts`): when `OPENCLAW_GATEWAY_PRIMARY=true` and `OPENCLAW_GATEWAY_URL` is set, outbound notifications POST to `${gateway}${OPENCLAW_GATEWAY_NOTIFY_PATH ?? "/api/notify"}` with Bearer auth; on any Gateway 4xx/5xx or network error we log and fall back to the existing direct Telegram/Discord Bot API path so HITL approvals never silently drop. Default unset = current bulletproof behavior preserved.
- **Phase 12 Stage B — DEFERRED (2026-05-08).** Goal was to repoint Telegram + Discord webhooks at the Gateway, flip channel flags, delete the standalone Vercel routes, and have the Gateway own all chat I/O end-to-end. **Blocked on OpenClaw 2026.5.6's `bundle-mcp` loader.** We tried four wirings against the Gateway running on Oracle Cloud Always Free with all skills loaded (9/9 ✓ ready), `MCP_SHARED_SECRET` matching on both sides, and our `/api/mcp` endpoint verified-working via direct curl: (1) HTTP+SSE with auth on GET → `405 Not Allowed` on the SSE handshake; (2) HTTP+SSE without auth on GET (built `/api/mcp` GET handler returning `text/event-stream` + endpoint event + keepalive) → `401 Unauthorized` because bundle-mcp's HTTP path doesn't reliably attach Authorization on GET; (3) HTTP+SSE with `initialize` + `notifications/*` handlers added → `MCP server connection timed out after 30000ms` because Vercel serverless can't hold session-tracked SSE state across separate function invocations to deliver the initialize response over the SSE channel; (4) stdio command-based MCP via a Node bridge subprocess (`apps/web/public/mcp-bridge.js`, served from public/, downloaded into the Gateway container, race condition fixed for in-flight fetches before exit) → `bundle-mcp failed to start server "openclaw-vp" (node /tmp/mcp-bridge.js): McpError: MCP error -32000: Connection closed` initially, then on a fresh restart the loader went silent — no `bundle-mcp` log lines at all, no spawned `node /tmp/mcp-bridge.js` subprocess in `ps -ef`. Bridge proven correct via direct test: piping `{"jsonrpc":"2.0","method":"tools/list","id":1}` to the bridge returned the full 11-tool list cleanly. The Gateway is not invoking the bridge in this version. **Working architecture preserved:** `/api/telegram/webhook` + `/api/discord/interactions` standalone Vercel routes plus the existing `notifyAgent` direct-Bot-API path remain the production chat handler — bulletproof, Vercel-resident, demo-ready. The Gateway runs in parallel as a real OpenClaw instance with skills loaded for the conversational/web-iframe surface only; chat I/O still goes through Vercel webhooks. Revisit Phase 12 Stage B when (a) OpenClaw upstream documents the bundle-mcp stdio spawn requirements, (b) ships proper Streamable-HTTP transport support, or (c) we stand up a full SSE+session implementation backed by Upstash Redis. Until then, this is the canonical path: **Gateway = conversational surface + future Slack/cron**, **standalone webhooks = production chat I/O**, **`/api/mcp` direct = MCP tool execution from non-Gateway callers**.

## Repo orientation

- `apps/web/` — Next.js dashboard (Vercel deploy target).
- `apps/worker/` — Inngest worker functions (Vercel deploy target via Inngest's serverless runtime).
- `apps/agent/` — OpenClaw resource bundle: skills, MCP tool implementations, Gateway config. Not a deployed Node process — these resources are consumed by the OpenClaw Gateway hosted separately (Phase 11 target: GCP `e2-micro` Always Free; see `docs/HOSTING_GATEWAY.md`).
- `packages/agent/` — shared agent code: LLM client, prompts, MCP tool handlers.
- `packages/db/` — Supabase migrations and types.
- `packages/scraping/` — Zyte / Firecrawl / stub scraper adapters.
- `packages/design-system/` — Tailwind tokens, base components.
- `openclaw-design-system/` — frozen design system bundle, do not modify.

## OpenClaw integration model — important

OpenClaw is **not an npm library we import.** It is a deployable application — a long-running Gateway process. Phase 11 cutover target: GCP `e2-micro` Always Free (see `docs/HOSTING_GATEWAY.md`). We integrate via:

1. **Skills** — markdown files in `apps/agent/skills/` uploaded to the Gateway's workspace via the `/setup` wizard. They are the Gateway's brain: each defines triggers + steps that resolve natural-language requests into MCP tool calls.
2. **MCP tools** — HTTPS endpoint at `apps/web/app/api/mcp/route.ts`, called by the Gateway over JSON-RPC. Auth via `MCP_SHARED_SECRET` (Gateway → us) and `MCP_WORKER_SECRET` (worker → Gateway, for `notifyAgent`).
3. **Control UI + chat surface** — `apps/web/app/agent/page.tsx` reads `OPENCLAW_GATEWAY_URL` and embeds the Gateway Control UI as an iframe (`ChatPanel`) for in-dashboard NL chat. `/api/openclaw/status` probes `<gateway>/healthz` for connectivity.

The Gateway is the conversational surface — natural-language requests on web (via the iframe panel) and any future Slack/WhatsApp channel routes through it; **Telegram + Discord chat I/O stays in the MCP-tool path** (`/api/telegram/webhook`, `/api/discord/interactions`, `notifyAgent` direct Bot API calls) because that path is Vercel-resident and demo-bulletproof. Structured workflow steps (Run Scout button, Approve from email) hit our routes directly. This split keeps the demo path resilient even if the Gateway is sleeping.

See section 6 of the build guide for the full ownership boundary diagram and integration architecture.

## When in doubt

Read the relevant section of the build guide. Don't guess. Don't infer architecture from existing code — the existing code may pre-date a decision documented in the guide.

If the build guide doesn't cover something, surface to the owner before implementing.

---

*This file is intentionally thin. The room is `PRODUCTION_BUILD_GUIDE.md`. Last updated: Phase 11 in progress (2026-05-07). Phases 1–9 complete; Gateway cutover from Railway → GCP e2-micro Always Free with in-dashboard NL chat panel.*
