# RUNBOOK — OpenClaw Venture Partner

Common incidents and resolutions. Read top-to-bottom; matching by symptom is intentional.

---

## Telegram bot is silent

**Symptom:** /start or 6-digit code messages get no reply.

**Diagnosis:**
```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" | jq
```

Check `last_error_message`. Most common values:

| Error | Fix |
|---|---|
| `Wrong response from the webhook: 307 Temporary Redirect` | The auth middleware is redirecting `/api/telegram/webhook`. Make sure `apps/web/middleware.ts` includes `/api/telegram/` in `PUBLIC_PATHS`. Redeploy. |
| `Wrong response from the webhook: 401 Unauthorized` | `TELEGRAM_WEBHOOK_SECRET` on Vercel doesn't match the secret you registered with Telegram. Re-call `setWebhook` with the matching secret. |
| `Wrong response from the webhook: 500 Internal Server Error` | Look at the latest `/api/telegram/webhook` deployment logs in Vercel. Usually `TELEGRAM_BOT_TOKEN` or `SUPABASE_SERVICE_ROLE_KEY` is missing. |

If `pending_update_count > 0` but `last_error_date` is recent, fix the underlying error and Telegram will auto-redeliver.

## Pitch draft hangs forever (status stays "Drafting…")

**Most common cause:** missing prompt files in the bundled function. Symptom in Inngest run logs:
```
ENOENT: no such file or directory, open '/vercel/path0/packages/agent/src/prompts/draft-pitch.md'
```
Fix: prompts must be inlined as TS string exports (`packages/agent/src/prompts/*.ts`). The `promptLoader` reads from the in-memory `PROMPTS` registry, NOT `fs.readFile`. If you add a new prompt, also add to the registry.

**Second most common cause:** LLM provider chain exhausted. Symptom: Inngest run shows `call-llm` step taking 25+ seconds and failing. Check at least one of `COPILOT_TOKEN`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` is set on the Vercel project. The chain falls through providers; if all fail, the worker reports `LLM router exhausted`.

## "duplicate key value violates unique constraint leads_hash_key"

The `leads.hash` column was originally globally unique, which blocks any new account from scraping a URL the first account already scraped. Apply migration 0011 (`packages/db/migrations/0011_leads_hash_per_user.sql`):

```sql
alter table public.leads drop constraint if exists leads_hash_key;
create unique index if not exists leads_user_hash_unique
  on public.leads (user_id, hash);
```

## Inngest sync fails with "Signature verification failed"

The `INNGEST_SIGNING_KEY` env var on Vercel doesn't match what Inngest's production environment expects. Fix:

1. Inngest dashboard → Apps → Sync new app → reveal the signing key
2. Vercel → Project → Settings → Environment Variables → edit `INNGEST_SIGNING_KEY` → paste
3. **Redeploy** (env-var changes don't apply until a new build runs)
4. Retry Sync app

## Rate-limit returning 429 unexpectedly

Two possible causes:

1. **Upstash quota exhausted.** Free tier is 10k commands/day. Check your Upstash dashboard. If exhausted, either upgrade or unset `UPSTASH_REDIS_REST_URL` to fall back to in-memory.
2. **Misconfigured limit.** The defaults are `/api/scout` 10/hr, `/api/pitches/draft` 30/day, `/api/mcp` 60/min per Gateway. Tweak in `apps/web/lib/rateLimit.ts` or in the route file.

## Resend send fails with "domain not verified"

You're trying to send from a custom domain that hasn't been verified in Resend. Until DNS is set up, set `RESEND_FROM_EMAIL=onboarding@resend.dev` (the sandbox address) and `RESEND_TO_EMAIL` to a single verified test recipient. Sandbox can only send to verified recipients, but it's free and works for the demo.

## Realtime subscriptions not firing

Check that the table is in the realtime publication:
```sql
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public';
```
Should include `pitches`, `proof_artifacts`, `email_replies`, `clients`, `notifications`. If missing, re-run the migration that adds it (`alter publication supabase_realtime add table public.<name>`).

## Vercel CVE scanner blocks deployment ("Vulnerable version of Next.js")

Vercel scans every dependency, not just the top-level `next`. If `apps/web/package.json` declares a separate `@next/env` at a different major version (e.g., `^16.x` while `next` is `15.x`), the scanner flags the older version of `@next/env` as a CVE. Fix: remove `@next/env` from direct dependencies entirely — `next` ships its own matching `@next/env` as a transitive dep.

If `@next/env` is gone but the scan still fails, upgrade `next` to the `backport` dist-tag (`pnpm add next@npm:next@backport`) which carries the latest security patches for the 15.x line.

## /api/inngest returns 401 Unauthorized

Working as intended. The endpoint requires Inngest's signed request format. Your browser hitting it gets 401; that's fine. Curl it with `getWebhookInfo` semantics or just trust the Inngest dashboard "Sync" status.

## Scout pipeline keeps retrying / never completes

Inngest functions retry on failure. Check the run's failed step in the Inngest dashboard. Common failures:

- **dedup-and-insert-leads** — see "duplicate key" runbook entry
- **score-leads** — see "draft hangs" runbook entry (LLM chain)
- **scrape** — Zyte API key invalid or quota exhausted; switch to `SCRAPER=stub` in env

After fixing, click "Rerun" in Inngest, OR cancel the run and re-trigger by clicking "Run scout" in the dashboard.

## Demo mode (parachute)

If anything breaks live, fire `/api/demo/seed` (button at `/settings/connect`). It deterministically creates a high-quality lead, score, drafted pitch, and complete Lighthouse audit — bypassing scout, scoring, drafting, and audit pipelines. The only paths still going through real services are the approval flow (Telegram or web) and the Resend send.

---

## Discord interactions endpoint isn't accepting

**Symptom:** Discord developer portal won't accept the "Interactions Endpoint URL" save (gives "validation error" or hangs).

Discord pings the URL on save. Our verifier requires `DISCORD_PUBLIC_KEY` to be set on Vercel and to match what Discord expects.

```bash
# Confirm the route is reachable
curl -i https://<vercel-url>/api/discord/interactions
# Expect 401 (no signature) — that means the route exists.
```

If `DISCORD_PUBLIC_KEY` is missing or wrong: copy from discord.com/developers/applications → your app → General Information → "PUBLIC KEY", paste into Vercel env, redeploy, retry the developer-portal save.

If the redeploy hasn't propagated, Discord retries up to 30s. If it still fails, the endpoint isn't returning the PONG correctly — check `apps/web/app/api/discord/interactions/route.ts` returns `{ type: 1 }` for `body.type === 1`.

## Discord slash commands aren't visible

After running `pnpm --filter web exec tsx --env-file=../../.env scripts/registerDiscordCommands.ts` once, Discord's UI may take up to 1 hour to refresh global commands. For testing, register them as guild-scoped (per-server) commands by changing the URL to `/applications/{APP_ID}/guilds/{GUILD_ID}/commands` — those propagate within seconds.

## Groq quota exhausted

**Symptom:** `groq 429: Rate limit exceeded` in `llm_calls`.

Groq's free tier is generous (~30 rpm + 14k tokens/min) but bursty scout pipelines can hit it. The router automatically fails over to OpenRouter or Anthropic if either is configured. To verify the chain is actually falling through, check `provider_health` in Supabase:

```sql
select provider, ok, error_message, latency_ms
from provider_health
order by checked_at desc
limit 20;
```

If only Groq rows appear and they're all `ok=false`, the chain is single-provider — set `OPENROUTER_API_KEY` on Vercel.

## Daily AI quota reached / BudgetExceededError

**Symptom:** Notification "Daily AI quota reached. Resets at midnight UTC."

Per-user `USER_DAILY_BUDGET_USD` (default $5) is enforced via the `user_daily_spend` materialized view. Resets at UTC midnight when the `refresh-daily-spend` cron runs. To override for the current day:

```sql
-- Find the user's UTC-day row
select * from user_daily_spend where user_id = '<uuid>' and day = current_date;

-- Either bump USER_DAILY_BUDGET_USD on Vercel (affects all users), or
-- temporarily clear today's row to give them headroom (re-runs on next refresh):
delete from llm_calls where user_id = '<uuid>' and created_at >= current_date;
refresh materialized view concurrently user_daily_spend;
```

## Materialized view refresh failing

**Symptom:** Inngest `refresh-daily-spend` cron logs `rpc failed: function public.refresh_user_daily_spend() does not exist`.

Migration 0016 hasn't been applied. Apply it via Supabase SQL Editor (paste the contents of `packages/db/migrations/0016_llm_production.sql`). The function and matview are bundled in that migration.

## scrape_failures shows raw HTML I need to debug

```sql
select source, url, parser_strategy, error_message,
       length(raw_html) as html_size,
       created_at
from scrape_failures
where source = 'linkedin'
order by created_at desc
limit 5;

-- Inspect specific HTML for selector drift:
select raw_html from scrape_failures where id = '<uuid>';
```

When LinkedIn or Indeed redesigns, fix the parser in `packages/scraping/src/zyte/parsers/<source>.ts`, ship a commit, and confirm the next scout run produces zero new `scrape_failures` rows.

---

## Pre-submission ops checks (T-24h)

- [ ] `getWebhookInfo` returns no `last_error_message`
- [ ] Inngest sync is green; all 10 functions visible (incl. `refresh-daily-spend`)
- [ ] At least one LLM provider key is valid (`pnpm --filter @openclaw/agent smoke`)
- [ ] Resend has quota remaining
- [ ] Demo seed runs end-to-end with `/api/demo/seed`
- [ ] Migrations 0016 + 0017 applied to Supabase
- [ ] `provider_health` writes appear after a fresh scout run
- [ ] `/api/health` returns `{ok:true}` in <2s; Better Uptime monitor green
- [ ] Discord bot bound to your account (if Discord enabled); slash commands visible in DM
- [ ] Backup demo video is recorded and linked in README

---

*Last updated: 2026-05-06 — Phase 8 closeout. Add new entries above this line.*
