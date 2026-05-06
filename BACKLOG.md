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

### A7. Layer 2 proof-of-value (Lighthouse audit)
**What:** Worker function that runs `lighthouse` against a target URL, stores result in `proof_artifacts`. Pitch prompt updated to reference proof concretely. PitchCard shows proof preview.
**Why deferred:** Phase 4. The "wow" moment of the demo where the agent builds something real and attaches it to outreach.
**Owner / Phase:** Claude Code, Phase 4.
**Status:** open

### A8. Layer 3 negotiation (reply drafting + client memory)
**What:** Inbound email ingestion (Resend Inbound webhook). Reply classification prompt. Reply drafting with three options. Persistent `clients.memory_md` updated diff-by-diff. Upsell detection cron.
**Why deferred:** Phase 5. The full deal lifecycle closes here.
**Owner / Phase:** Claude Code, Phase 5.
**Status:** open

### A9. Demo mode button
**What:** A single click that runs a canned end-to-end scenario with predictable data. Critical for live-demo safety.
**Why deferred:** Phase 6. **Don't skip this.** Live demos break; demo mode is the parachute.
**Owner / Phase:** Claude Code, Phase 6 polish step.
**Status:** open

### A10. Scripted demo arc rehearsed and timed
**What:** The 90-second demo from build-guide section 16.5. Practiced. Timed. Pre-demo setup checklist completed before judging.
**Why deferred:** Done in Phase 7 (close to submission). Earlier rehearsal risks the script being out of sync with the product as it evolves.
**Owner / Phase:** Dheeran, Phase 7.
**Status:** open

---

## Section B — Phase 2 leftover (small polish, addressable in Phase 6 or post-hackathon)

These didn't get fully wired in Phase 2 but aren't blocking anything immediate.

### B1. Search bar in topbar
**What:** Currently stubbed at 45% opacity. Wiring means full-text search across leads, clients, pitches. Postgres FTS backend, debounced typeahead frontend, `⌘K` shortcut.
**Why deferred:** Real product feature; Phase 6 polish.
**Owner / Phase:** Claude Code, Phase 6 step 5.
**Status:** open

### B2. Bell icon (notifications)
**What:** Currently stubbed. Wiring means a notifications table, per-user feed, read/unread state, in-app feed, plus chat fanout (already wired structurally).
**Why deferred:** Phase 6 step 6 if shipped at all. Probably skip for hackathon — there's no compelling demo value over the existing chat-platform notifications.
**Owner / Phase:** Claude Code, Phase 6 step 6 (consider skipping).
**Status:** open

### B3. Sidebar nav items beyond Inbox
**What:** Scout, Pitches, Clients, Templates, Settings are dimmed. ~~Pitches activates in Phase 3.~~ Clients activates in Phase 5. Templates and Scout stay dimmed unless explicitly built. Settings already navigates to `/settings/connect`.
**Status:** Pitches done (2026-05-06) — un-dimmed and routes to `/pitches`. Clients/Templates/Scout still open.
**Owner / Phase:** Claude Code, by phase as data appears.

### B4. Stat cards real values for Pitches Sent, Reply Rate, Hours Saved
**What:** ~~Currently `—`.~~ Pitches Sent now real (live count via `useStats` hook with realtime subscription). Reply Rate stays `—` until Phase 5. Hours Saved stays `—` until heuristic decided in Phase 6.
**Status:** Pitches Sent done (Phase 3). Reply Rate / Hours Saved still open.
**Owner / Phase:** Phase 5 (Reply Rate); Phase 6 (Hours Saved formula).

### B5. Week-over-week deltas on stat cards
**What:** Currently dropped from the design entirely. Requires either a snapshot job (daily counts table) or sliding-window queries.
**Why deferred:** Polish-tier feature; Phase 6 if at all.
**Owner / Phase:** Claude Code, Phase 6 (optional).
**Status:** open

### B6. Activity rail divider between scout runs
**What:** Currently the buffer accumulates events from multiple runs without a visual divider. Add a subtle separator or `── new run ──` marker between runs.
**Why deferred:** UX polish, not a bug.
**Owner / Phase:** Claude Code, Phase 6 polish.
**Status:** open

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

### C2. Zyte adapter activation
**What:** Adapter ships in Phase 2 but stub remains the default scraper. Activating means setting `ZYTE_API_KEY` + `SCRAPER=zyte` in production. Production also requires the parser to be hardened against Upwork's HTML drift (Phase 2's two-strategy fallback was conservative; production needs real-world calibration).
**Why deferred:** Stub is fine for demo (deterministic). Real scraping costs real Zyte credits.
**Owner / Phase:** Claude Code, Phase 6 / Phase 7.
**Status:** open

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

### C9. Per-Gateway rate limiting on /api/mcp
**What:** Once OpenClaw is in production, the Gateway is also a client of our Next.js app. Apply rate limits per Gateway token: `/api/mcp` 60/min global, `runScout` 10/hour matching user-facing limits, `draftPitch` 30/day matching its sister route. Worker → notifyAgent uses separate `MCP_WORKER_SECRET` with looser limits.
**Why deferred:** New requirement from the architectural revision. Phase 6 production hardening.
**Owner / Phase:** Claude Code, Phase 6 step 2.
**Status:** open

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

### D5. README architecture diagram and screenshots
**What:** The repo's README is currently a one-paragraph blurb. Before submission, expand with: system architecture diagram, technology stack, "how to run locally," "what's implemented vs stubbed," and screenshots. Judges read READMEs.
**Why deferred:** Pre-submission polish.
**Owner / Phase:** Claude Code + Dheeran review, Phase 7.
**Status:** open

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

---

## How to use this document

**At session start:** read this file alongside `PRODUCTION_BUILD_GUIDE.md` and `CLAUDE.md`.

**When work moves from `open` to `in-progress`:** update the status. When it completes, change to `done` and add `~~strikethrough~~`.

**When new deferred work surfaces during a build:** add a new entry in the appropriate section before ending the session. Don't trust memory across sessions.

**When scope changes on an item:** edit the entry in place. Add a parenthetical note about the change date.

**When an item gets reframed:** strike the old text and add the new text below. Audit trail is more valuable than tidiness.

---

*Last updated: 2026-05-06 — Phase 3 complete. A1–A6 marked done. B3/B4 partially done.*
