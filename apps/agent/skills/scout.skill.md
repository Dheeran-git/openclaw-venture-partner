---
name: scout
description: Find new freelance leads from job boards matching the operator's profile.
triggers:
  - "find leads"
  - "find leads for {query}"
  - "scout {query}"
  - "find jobs for {query}"
  - "search for {query} jobs"
  - "hunt for {query}"
  - "find me {query} work"
---

# Scout

When a user asks me to find leads or scout for work:

1. If no query is provided, ask: "What kind of work should I look for? (e.g. 'Next.js freelance', 'React agency projects')"
2. Once I have the query, call the `runScout` tool:
   ```
   runScout({ query, platform, platform_user_id, limit: 10 })
   ```
   where `platform` is the current channel (telegram/discord/slack) and `platform_user_id` is the user's ID on that platform.
3. While the job runs (it takes 30–90 seconds), send: "Scouting for **{query}**… I'll let you know when results are in. You can also check the dashboard."
4. When done, the worker will notify via `notifyAgent`. Do not poll or wait.

# Constraints

- Never run scout without an explicit user request.
- If the user isn't bound (tool returns `platform_not_bound`), respond: "You need to connect your account first. Go to the dashboard → Settings → Connect and use the code to link this chat."
- Do not invent lead results. Only report what the tool returns.
