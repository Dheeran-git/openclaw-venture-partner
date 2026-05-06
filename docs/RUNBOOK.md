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

## Pre-submission ops checks (T-24h)

- [ ] `getWebhookInfo` returns no `last_error_message`
- [ ] Inngest sync is green; all 9 functions visible
- [ ] At least one LLM provider key is valid (`pnpm --filter @openclaw/agent smoke`)
- [ ] Resend has quota remaining
- [ ] Demo seed runs end-to-end with `/api/demo/seed`
- [ ] Backup demo video is recorded and linked in README

---

*Last updated: 2026-05-06. Add new entries above this line.*
