# OpenClaw Backlog

Running list of deferred work after Phase 2. Update this file as items land or get reprioritised. Do not let it become stale.

---

## Hackathon-blocking (Phase 3–7)

Must land before submission to make the demo coherent.

- **Telegram digest + HITL approval flow** — Phase 3. Bot setup, inline approve/reject keyboards, `payload_hash` verification on approval, round-trip from "Approve in Telegram" → "Pitch sent."
- **Pitch drafting prompt and pipeline** — Phase 3. Versioned `.md` prompt, Zod schema, few-shot examples, wired through the LLM client.
- **Pitch card with approval bar in dashboard** — Phase 3. Port from `openclaw-design-system/project/ui_kits/dashboard/PitchCard.jsx`. Replaces the current "Pitch drafting in Phase 3." placeholder in LeadDetail.
- **Layer 2 proof-of-value (Lighthouse audit)** — Phase 4. Agent runs Lighthouse on a prospect's site, generates summary, attaches to pitch. The demo's "wow" moment.
- **Layer 3 negotiation (reply drafting + client memory)** — Phase 5. `clients.memory_md` write loop, three-reply-options pattern, upsell trigger.
- **Demo mode button** — Phase 6. Single click runs a canned end-to-end scenario with predictable data. Critical for live-demo safety. Do not skip.

---

## Phase 2 leftover (Phase 6 polish)

Not blocking Phase 3. Addressable in the final polish pass.

- **Search bar** — stubbed at 45% opacity. Full-text search across leads/clients/pitches. Reasonable Phase 6 work; possibly post-hackathon.
- **Bell icon (notifications)** — stubbed. Probably skip for the hackathon entirely. Real implementation needs a notifications table, per-user feed, read/unread state.
- **Sidebar nav items beyond Inbox** — Scout, Pitches, Clients, Templates, Settings are all dimmed. Pitches and Clients become real pages in Phase 3 and Phase 5 respectively. Templates and Settings probably stay dimmed through the hackathon.
- **Stat cards real values** — Pitches Sent, Reply Rate, Hours Saved show "—". The hook wiring exists; data starts flowing in Phase 3+.
- **Week-over-week deltas on stat cards** — dropped entirely. Requires a snapshot job or daily counts table. Phase 6 if at all.
- **Activity rail multi-run UX** — buffer accumulates events from multiple scout runs without a visual divider. Could add a "— new run —" separator. Polish.
- **"Scoring..." placeholder visibility** — the window is ~3–5s at concurrency 5 and barely visible. Drop concurrency to 1 if you want more visible demo theatrics. Optional.
- **Empty signals on pre-migration score rows** — the 10 leads scored before migration 0004 added `signals` have `null` signals. Cosmetic; their pills just don't render. Either re-score or accept.

---

## Production-migration (post-hackathon)

Architectural decisions made deliberately for hackathon speed. Track them so they don't get lost.

- **RLS policies** — currently disabled on `leads`, `scores`, `profiles`. Production needs Row-Level Security on every table. `0005_enable_rls.sql` plus per-table policies.
- **Real authentication** — Supabase Auth wired into Next.js. Replaces `DEMO_USER_ID`. Login flow, session management, protected routes.
- **Zyte adapter activation** — ships in Phase 2 but inactive. Production requires `ZYTE_API_KEY` + `SCRAPER=zyte`, plus hardening the parser against Upwork HTML drift (the two-strategy fallback was conservative).
- **Anthropic API as primary LLM** — currently Copilot → OpenRouter → Gemini → Anthropic. Production flips to Anthropic-first. The adapter is already built; one-line router change.
- **Stripe billing** — subscription management for production SaaS.
- **Onboarding flow** — signup → profile setup → first scout. Phase 6 for demo (probably skipped); production-mandatory.
- **Marketing site** — separate `apps/marketing` or a `(marketing)` route group. Out of hackathon scope.
- **Custom domain** — `vercel.app` fine for hackathon. Production needs a real domain and a matching `from` address for Resend.
- **Privacy policy + terms of service** — required for production; optional for hackathon unless judges ask.

---

## Operational commitments

Not features, but commitments worth tracking.

- **Verify Zyte free-tier 24h before submission** — the GitHub Student perk depends on the dummy account staying valid.
- **Verify Copilot OAuth token 24h before submission** — same concern. Test the dummy account token the day before.
- **Check OpenRouter free credit** — if heavily used during dev, you may be near the cap. Check before demo day.
- **Record backup demo video** — Phase 7. Record a flawless run-through after final rehearsal so a live-demo failure doesn't kill submission.
- **README architecture diagram** — before submission: system architecture diagram, tech stack, "how to run locally," "what's implemented vs stubbed," screenshots. Judges read READMEs.
- **Keep CLAUDE.md current** — new architectural decisions land in CLAUDE.md before the session that introduces them ends.
