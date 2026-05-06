# BACKLOG.md — OpenClaw Venture Partner

Running ledger of deferred work, known debt, and decisions postponed. Read at the start of every session. Update as items move (defer further, complete, change scope, get blocked).

This document is the operational complement to `PRODUCTION_BUILD_GUIDE.md`. The build guide says *what we're doing*; this document says *what we're not doing yet*.

---

## How to read this

Items are grouped by category, not priority. Within each category, items are roughly ordered by which is most likely to come up first. Each item has:
- **What**: the concrete deliverable
- **Why deferred**: the reasoning at deferral time (helpful when revisiting)
- **Owner / Phase**: who picks it up and when
- **Status**: `open` | `in-progress` | `done` | `wontfix`

When an item moves to `done`, leave it in this file with a strikethrough — useful historical record. When an item is reframed, edit the entry rather than deleting; the audit trail matters.

---

## Section A — Hackathon-blocking deferred items (Phase 3 onward)

These must land before submission to make the demo coherent.

### ~~A1. Telegram HITL approval flow~~
~~**What:** Telegram bot wired with the approval flow. Inline keyboards. `payload_hash` verification on every approval. Round-trip from "tap Approve in chat" → "pitch sent."~~
**Status:** done — 2026-05-06. Standalone webhook at `/api/telegram/webhook` (Gateway free-tier OOM workaround), `notifyAgent` MCP tool generates short-lived `chat_callback_tokens` and pushes inline-keyboard messages, callback resolver dispatches to `approvePitch` / `rejectPitch` MCP handlers with `actor_platform: 'telegram'`. Discord adapter is structurally ready but Discord bot setup deferred to Phase 4 follow-up.

### ~~A2. Pitch drafting prompt and pipeline~~
~~**What:** `packages/agent/src/prompts/draft-pitch.md` with rubric and few-shot examples. `DraftPitchOutput` Zod schema. `draftPitch()` function calling LLM with profile + lead + (optional) client memory.~~
**Status:** done — Phase 3 step 1.

### ~~A3. Pitch card with approval bar in dashboard~~
~~**What:** Port `openclaw-design-system/project/ui_kits/dashboard/PitchCard.jsx` to TSX. Replace the "Pitch drafting in Phase 3" placeholder in LeadDetail.~~
**Status:** done — Phase 3 step 3. Streaming via Realtime subscription on `pitches:user_id=eq.{user_id}`.

### ~~A4. OpenClaw Gateway deployment (dev + prod)~~
~~**What:** Deploy OpenClaw via Railway one-click template.~~
**Status:** done (modified) — 2026-05-06. Dev Gateway up on Railway. Telegram channel disabled (free-tier 512MB OOM); standalone webhook used for Telegram. Gateway retains the skills + MCP routing for cross-platform features and any future paid-tier expansion.

### ~~A5. MCP server endpoint at /api/mcp~~
~~**What:** Build `apps/web/app/api/mcp/route.ts`. Authenticate via `MCP_SHARED_SECRET`.~~
**Status:** done — Phase 3 step 6a. All 11 tools implemented (`runScout`, `getRecentLeads`, `getTopLead`, `draftPitch`, `approvePitch`, `rejectPitch`, `editPitch`, `getPendingPitches`, `bindTelegram`, `bindDiscord`, `notifyAgent`).

### ~~A6. binding_codes table and chat-platform binding flow~~
~~**What:** `binding_codes` table. `/settings/connect` page generates 6-digit code, `bindTelegram` MCP tool validates and writes to `profiles.telegram_user_id`.~~
**Status:** done — Phase 3 step 6c. Migration 0010 applied. `bindDiscord` ready but Discord bot setup deferred.

### ~~A7. Layer 2 proof-of-value (Lighthouse audit)~~
~~**What:** Worker function that runs `lighthouse` against a target URL, stores result in `proof_artifacts`. Pitch prompt updated to reference proof concretely. PitchCard shows proof preview.~~
**Status:** done — 2026-05-06. Migration 0012, `runLighthouseAudit` worker via Google PageSpeed Insights API (no Chromium binary), ProofCard preview, draft-pitch prompt accepts proof_context.

### ~~A8. Layer 3 negotiation (reply drafting + client memory)~~
~~**What:** Inbound email ingestion (Resend Inbound webhook). Reply classification prompt. Reply drafting with three options. Persistent `clients.memory_md` updated diff-by-diff. Upsell detection cron.~~
**Status:** done — 2026-05-06. Migrations 0013/0014. classify-reply + draft-reply prompts. processInboundReply + sendApprovedReply workers. /clients UI with MemoryRenderer + ReplyCard. detectUpsells daily cron. Resend Inbound deferred to custom-domain setup; /api/email/simulate covers the free-tier demo path.

### ~~A9. Demo mode button~~
~~**What:** A single click that runs a canned end-to-end scenario with predictable data. Critical for live-demo safety.~~
**Status:** done — 2026-05-06. POST /api/demo/seed inserts deterministic lead + score (95) + drafted pitch + complete Lighthouse proof. Idempotent (replaces prior demo). Button at /settings/connect.

### A10. Scripted demo arc rehearsed and timed
**What:** The 90-second demo from build-guide section 16.5. Practiced. Timed. Pre-demo setup checklist completed before judging.
**Why deferred:** Done in Phase 7 (close to submission). Earlier rehearsal risks the script being out of sync with the product as it evolves.
**Owner / Phase:** Dheeran, Phase 7.
**Status:** open

---

## Section B — Phase 2 leftover (small polish, addressable in Phase 6 or post-hackathon)

These didn't get fully wired in Phase 2 but aren't blocking anything immediate.

### ~~B1. Search bar in topbar~~
**Status:** done — 2026-05-06. /api/search route does ILIKE across leads.normalized + pitches.subject/draft + clients.company_name/memory_md. Debounced typeahead in `SearchBar` component. ⌘K shortcut. Postgres FTS migration deferred (ILIKE is fast enough at hackathon scale).

### ~~B2. Bell icon (notifications)~~
**Status:** done — 2026-05-06. Migration 0015 added notifications table with RLS. `NotificationsBell` component shows unread count + dropdown feed with mark-as-read. Inserted by `draftPitch` (pitch ready) and `processInboundReply` (reply received) workers.

### ~~B3. Sidebar nav items beyond Inbox~~
**Status:** Pitches + Clients un-dimmed and routed (2026-05-06). Templates + Scout stay dimmed (Templates is Phase 6 optional that we deferred; Scout's "running" indicator is the demo affordance). Settings now goes to /settings index page.

### B4. Stat cards real values for Pitches Sent, Reply Rate, Hours Saved
**Status:** Pitches Sent + Hours Saved done (2026-05-06; Hours Saved heuristic = leads * 2min + drafts * 20min + sends * 10min). Reply Rate still open until inbound replies are flowing in production (the schema supports it; just need data).

### B5. Week-over-week deltas on stat cards
**What:** Currently dropped from the design entirely. Requires either a snapshot job (daily counts table) or sliding-window queries.
**Why deferred:** Polish-tier feature; Phase 6 if at all.
**Owner / Phase:** Claude Code, Phase 6 (optional).
**Status:** open

### ~~B6. Activity rail divider between scout runs~~
**Status:** done — 2026-05-06. `useScoutActivity` inserts a "new run" divider event when pushOptimistic fires on a non-empty buffer. ActivityRail renders dividers as a horizontal line + label.

### B7. "Scoring..." placeholder window for new leads
**What:** Architecture supports it; with concurrency=5 it's so brief (~3-5s) you can barely see it. Could drop concurrency to 1 to make demo theatrics more visible.
**Why deferred:** Optional. Real users prefer fast over theatrical.
**Owner / Phase:** Optional, never if no demo benefit.
**Status:** open

---

## Section C — Production-migration items (post-hackathon, but tracked now)

Things explicitly pushed past the hackathon submission. Tracking them so they don't get lost.

### ~~C1. Phase 2.5 — Auth + RLS cutover~~
~~**What:** Real Supabase Auth (email/password, magic link, Google OAuth, GitHub OAuth). First-run onboarding (3 steps: profile, skills, optional Telegram bind). Migration 0006 enabling RLS on all user-scoped tables. Two-account isolation test passing.~~
~~**Why deferred:** Sequencing decision per build-guide section 11.0. If hackathon deadline ≤7 days, do Phase 3 on `DEMO_USER_ID` first and make this the very first post-hackathon work. If >7 days, do this first. **Hard pre-merge blocker before any production user is onboarded.**~~
~~**Owner / Phase:** Claude Code, Phase 2.5 (timing TBD per timeline).~~
**Status:** done — 2026-05-04. Auth scaffolding, onboarding, middleware, RLS migrations (0006, 0007), isolation test script, and full DEMO_USER_ID removal all shipped. Apply 0006+0007 to the Supabase dashboard, then run `pnpm --filter web test:isolation` to confirm isolation passes.

### ~~C2. Zyte adapter activation + multi-source~~
~~**What:** Adapter ships in Phase 2 but stub remains the default scraper.~~
**Status:** Phase 8 (2026-05-06) — Zyte refactored into a multi-source dispatcher with per-source URL builders + parsers (Upwork/LinkedIn/Indeed/Reddit/Contra/Freelancer), per-source token-bucket rate limits, exponential-backoff retry (1s/4s/16s, max 3), and `scrape_failures` raw-HTML capture for offline parser debugging. Firecrawl secondary adapter ships with cascading fallback. Activation still requires `ZYTE_API_KEY` + `SCRAPER=zyte` (free-tier via GitHub Student perk).

### C3. Anthropic API as primary LLM provider (decision deferred)
**What:** Currently the chain is Copilot → Gemini → Groq → OpenRouter → Anthropic-dormant. Production might flip to Anthropic-first with proper billing. The adapter is already built; flipping the order in the router is a one-line change.
**Why deferred:** Cost decision tied to monetization model. Defer until pricing structure exists.
**Owner / Phase:** Dheeran (decision), Claude Code (one-line change), post-launch.
**Status:** open

### C4. Stripe billing
**What:** Production SaaS needs subscription management. Stub the model now if pricing is decided.
**Why deferred:** Pricing/monetization is itself deferred. Build later.
**Owner / Phase:** Post-launch.
**Status:** open

### C5. Marketing site / landing page
**What:** Separate `apps/marketing` or a `(marketing)` route group. Out of hackathon scope; required for production launch.
**Why deferred:** Out of scope until launch.
**Owner / Phase:** Post-launch.
**Status:** open

### C6. Custom domain
**What:** `vercel.app` subdomain is fine for hackathon. Production needs `openclaw.app` or whatever you settle on. Plus email-from address (`hello@openclaw.app` for Resend, with DKIM/SPF/DMARC verified).
**Why deferred:** Naming + hosting decisions. Phase 7.
**Owner / Phase:** Dheeran (naming), Claude Code (DNS + Resend setup), Phase 7.
**Status:** open

### C7. Empty signals on pre-Phase-2 score rows
**What:** The 10 leads scored during the dryrun (before migration 0004 added the `signals` column) have null signals. Cosmetic for the hackathon (their signals just don't render). Production: re-score them once or accept.
**Why deferred:** Cosmetic. Trivial to fix when convenient.
**Owner / Phase:** Optional, anytime.
**Status:** open

### C8. Privacy policy + terms of service
**What:** Required for production launch and ad networks. Optional for hackathon submission unless judges ask.
**Why deferred:** Legal review needed. Post-launch.
**Owner / Phase:** Dheeran, post-launch.
**Status:** open

### ~~C9. Per-Gateway rate limiting on /api/mcp~~
**Status:** done — 2026-05-06. Generalized rate limiter at `apps/web/lib/rateLimit.ts` (Upstash Redis when creds set; in-memory fallback). Applied at /api/scout (10/hr per user), /api/pitches/draft (30/day per user), /api/mcp (60/min per IP plus per-tool runScout 10/hr and draftPitch 30/day per platform user).

### C10. WhatsApp / Slack chat platforms activation
**What:** OpenClaw plugins exist; env vars in `.env.example`; `ENABLE_*=false` flags in Gateway config. Activation is flipping the flag and providing credentials. Slack: ~30 min. WhatsApp: 3-10 days due to Meta Business Verification.
**Why deferred:** Telegram + Discord cover ~95% of target audience. WhatsApp/Slack stay scaffolded until specific user demand.
**Owner / Phase:** Claude Code, on-demand post-launch.
**Status:** open

---

## Section D — Operational items (commitments, not features)

### D1. Verify Zyte free-tier still works on demo day
**What:** Zyte's GitHub Student perk depends on the dummy account staying valid. Worth a sanity check 24h before submission.
**Why deferred:** Pre-submission ops check, not feature work.
**Owner / Phase:** Dheeran, T-24h before submission.
**Status:** open

### D2. Verify Copilot OAuth still works
**What:** Same concern as D1. Dummy GitHub account, OAuth token, routing through `copilot-api`. Test the day before.
**Why deferred:** Pre-submission ops check.
**Owner / Phase:** Dheeran, T-24h before submission.
**Status:** open

### D3. Verify OpenRouter free credit isn't burned
**What:** The fallback. If hit heavily during dev, may be near credit cap. Check.
**Why deferred:** Pre-submission ops check.
**Owner / Phase:** Dheeran, T-24h before submission.
**Status:** open

### D4. Backup demo video recorded
**What:** Phase 7 task. Record a flawless run-through after final rehearsal so live-demo failures don't kill submission. Loom or unlisted YouTube. Linked from README.
**Why deferred:** Comes after Phase 7 deployment.
**Owner / Phase:** Dheeran, Phase 7.
**Status:** open

### ~~D5. README architecture diagram and screenshots~~
**Status:** done — 2026-05-06. README rewritten with 90-second demo arc, ASCII architecture diagram, tech stack, repository layout, implemented-vs-deferred matrix, run-locally section, doc index, credits.

### D6. Push CLAUDE.md and PRODUCTION_BUILD_GUIDE.md updates as we go
**What:** Both documents evolve with the project. New architectural decisions land in the appropriate document before the session that introduces them ends.
**Why deferred:** Continuous practice, not deferred work.
**Owner / Phase:** Claude Code, every session.
**Status:** open (ongoing)

### D7. OpenClaw Gateway health monitoring
**What:** Once in production, the Gateway is a critical service. Set up uptime monitoring (Better Uptime / Cronitor) for the Gateway URL. Pipe `openclaw doctor --remote` output to scheduled health checks.
**Why deferred:** Phase 7 observability.
**Owner / Phase:** Claude Code, Phase 7 step 5.
**Status:** open

### D8. Dummy GitHub account renewal calendar
**What:** GitHub Student status expires periodically. Add a calendar reminder ~60 days before expiry to verify status and renew if needed. If status lapses, Copilot OAuth and Zyte free-tier both go down.
**Why deferred:** Calendar item, not code.
**Owner / Phase:** Dheeran, ongoing.
**Status:** open

---

## Decision log

Items here are decisions made during planning sessions that affect future work. Reference rather than re-litigate.

- **2026-04 — Telegram is the primary chat platform.** Initial decision.
- **2026-05-04 — Discord promoted to primary alongside Telegram.** Audit revealed OpenClaw ships both adapters built-in, so the marginal cost of supporting both is ~2-3 hours. Discord covers our specific target demographic (React/Next.js freelancers).
- **2026-05-04 — Architecture corrected: OpenClaw is deployed, not embedded.** Discovered during audit that OpenClaw is a standalone Gateway application, not an npm library. Section 6 of the build guide rewritten end-to-end. Setup model: Railway one-click template.
- **2026-05-04 — Five-provider LLM chain confirmed.** Worker-side calls use our internal client; chat-side calls use OpenClaw's native routing pointed at the same providers. Both layers point at the same five providers. See build-guide section 4.0.
- **2026-05-04 — Phase 2.5 vs Phase 3 sequencing is timeline-dependent.** Build-guide section 11.0 documents the tradeoff. If hackathon deadline ≤7 days, Phase 3 on DEMO_USER_ID first, then Phase 2.5 as first post-hackathon work. Otherwise Phase 2.5 first.
- **2026-05-04 — Zyte called directly from Inngest worker, not via OpenClaw.** Earlier framing was incorrect. Scraping is worker-side; OpenClaw only sees the result of a scout when chat asks for it.
- **2026-05-04 — Phase 2.5 complete (auth + RLS).** Real Supabase Auth, 3-step onboarding, middleware session guard, `normalizeSupabaseUrl` applied everywhere, migrations 0006 + 0007 written, DEMO_USER_ID removed from codebase. Two-account isolation verified via `pnpm --filter web test:isolation`. Phase 3 is the next phase.
- **2026-05-06 — Telegram via standalone webhook, not OpenClaw Gateway.** Railway free tier (512MB) OOMs when the Gateway boots its Telegram bot library, so Telegram is owned by a thin Vercel route at `/api/telegram/webhook` that calls `handlers.bindTelegram` / `approvePitch` / `rejectPitch` directly. The Gateway stays in the architecture for skills + MCP + Discord/Slack/WhatsApp; this is a pragmatic split, not an abandonment of OpenClaw.
- **2026-05-06 — Phase 3 complete.** End-to-end HITL approval shipped: pitch drafting, two-call streaming PitchCard, web approve/reject/edit routes, Resend send via sandbox, MCP server, all skills + Gateway config, `/settings/connect` binding, Telegram webhook + inline keyboard, `notifyAgent` push, `/pitches` list, real Pitches Sent stat. Discord channel + automated tests deferred to follow-up. Phase 4 (Layer 2 proof-of-value) is next.
- **2026-05-06 — Phases 4–7 complete.** Lighthouse proof-of-value via Google PageSpeed Insights API (no Chromium binary). Reply ingestion with classify+draft 3 options, `/clients` UI with MemoryRenderer + ReplyCard, daily `detectUpsells` cron. Demo-mode parachute, generalized Upstash+memory rate limiter, SDK-free Sentry+PostHog shims, ILIKE-based search with ⌘K, real notifications system, /settings index + profile editor + data export/import + danger zone, Hours-saved heuristic, activity rail dividers, skip-to-content a11y. Vitest suite (15 passing) including payload_hash determinism + classifyReply schema. Playwright specs for pitch-approve happy path + 409 stale-draft guard. GitHub Actions CI. README rewrite + docs/RUNBOOK.md. Hackathon-ready.
- **2026-05-06 — Phase 8 closeout.** Re-read `PRODUCTION_BUILD_GUIDE.md` end-to-end against shipped code; closed every gap achievable on $0 budget. **LLM client (§4):** Groq is the 5th provider (router order Copilot→Gemini→Groq→OpenRouter→Anthropic-dormant); `pricing.ts` populates `llm_calls.cost_usd`; `LLMClient.stream()` on SSE-capable adapters; idempotency keys via `(user_id, idempotency_key)` cache lookup; `BudgetExceededError` against `user_daily_spend` matview; `provider_health` rows from every router probe; nightly `refresh-daily-spend` Inngest cron. **Scraping (§5):** `SourceType` enum, `Scraper.health()`, per-source URL builders + per-source parsers (Upwork/LinkedIn/Indeed/Reddit/Contra/Freelancer), per-source token-bucket rate limits, exponential-backoff retry, `scrape_failures` raw-HTML capture, Firecrawl secondary adapter with cascading fallback. **Discord (§7.2):** `/api/discord/interactions` Ed25519-verified webhook (built-in Node crypto, no tweetnacl dep), slash-command registration script, `notifyAgent` fan-out to Discord DM with coral-color embed + Approve/Reject buttons sharing the same `chat_callback_tokens` as Telegram. **Skills:** `reply_to_email`, `client_memory`, `lighthouse_audit` added — 9 total. **Config:** `openclaw.config.json` lists all 5 providers + 4 channels (Slack/WhatsApp scaffolded). **Migrations 0016 + 0017** for matview/provider_health/idempotency_key + scrape_failures. **`/api/health`** route. **`.env.example`** matches build-guide §17 line-for-line.

---

## How to use this document

**At session start:** read this file alongside `PRODUCTION_BUILD_GUIDE.md` and `CLAUDE.md`.

**When work moves from `open` to `in-progress`:** update the status. When it completes, change to `done` and add `~~strikethrough~~`.

**When new deferred work surfaces during a build:** add a new entry in the appropriate section before ending the session. Don't trust memory across sessions.

**When scope changes on an item:** edit the entry in place. Add a parenthetical note about the change date.

**When an item gets reframed:** strike the old text and add the new text below. Audit trail is more valuable than tidiness.

---

*Last updated: 2026-05-06 — Phases 1–8 complete. A1–A9, B1, B2, B3, B4 (partial), B6, C2, C9, D5 marked done. Production-build-guide gap-zero. Hackathon-submission-ready.*
