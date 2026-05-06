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
- **Phase 3 (HITL approval flow):** complete (2026-05-06). Migrations 0009 + 0010 applied. Pitch drafting, two-call streaming PitchCard, web approve/reject/edit routes, Resend send via sandbox, MCP server with shared-secret + rate-limit auth, all 6 skills + `openclaw.config.json`, `/settings/connect` binding flow, standalone Telegram webhook (Gateway free-tier OOM workaround), `notifyAgent` push with inline-keyboard approval, `/pitches` list view, real Pitches Sent stat card, sidebar Pitches link active. Discord channel + tests deferred to Phase 4 follow-up.
- **Phase 4 (Layer 2 proof-of-value):** next. See build guide.

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

*This file is intentionally thin. The room is `PRODUCTION_BUILD_GUIDE.md`. Last updated: Phase 3 complete (2026-05-06).*
