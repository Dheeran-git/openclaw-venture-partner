# @openclaw/db

Supabase Postgres schema, migrations, and typed clients.

## Apply migrations

```sh
# Link to your Supabase project (run once)
supabase login
supabase link --project-ref <your-project-ref>

# Apply both migrations
supabase db push

# Regenerate types from the live schema
pnpm --filter @openclaw/db db:gen-types
```

`src/types.ts` is a hand-written stub matching `migrations/0001_init.sql` so
TypeScript compiles before a project is linked. Once `db:gen-types` runs, the
generated file overwrites the stub.

## Tables

| Table     | Purpose                                                         |
|-----------|-----------------------------------------------------------------|
| profiles  | Per-user profile (skills, rate, bio). FK to `auth.users(id)`.   |
| sources   | Per-user scrape source configs (upwork, linkedin, ...).         |
| leads     | Discovered opportunities (layer 1/2/3).                          |
| scores    | LLM-produced score per lead, with prompt version + model.       |
| pitches   | Drafted outreach with status (draft → approved → sent).         |
| clients   | Won/engaged clients with persistent `memory_md`.                |
| approvals | HITL audit log keyed by `payload_hash`.                         |
| llm_calls | Telemetry for every LLM invocation.                             |

Every business table carries `user_id`. RLS policies are deferred until real
auth lands; the application layer enforces filtering for the hackathon.
