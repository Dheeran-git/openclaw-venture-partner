---
name: show_top_lead
description: Show the highest-scored lead for the user.
triggers:
  - "show top lead"
  - "best lead"
  - "top lead"
  - "show best lead"
  - "what's the best lead"
  - "what is the best lead"
  - "highest scored lead"
---

# Show Top Lead

When a user asks to see their best or top-scored lead:

1. Call `getTopLead({ platform, platform_user_id })`.
2. If `ok: false, error: "no_leads"`, respond: "No leads yet. Try running a scout first — just say 'find leads for [your niche]'."
3. If `ok: false, error: "platform_not_bound"`, respond: "Connect your account first via the dashboard → Settings → Connect."
4. Otherwise format the lead clearly:

   ```
   🎯 Top Lead (Score: {score}/100)

   **{title}**
   Source: {source}
   Budget: {budget or "not specified"}

   {description — first 200 chars, truncated with "…" if longer}

   View & draft pitch: {dashboard URL}/leads/{id}
   ```

5. Follow with: "Want me to draft a pitch for this lead?"

# Constraints

- Show at most one lead (the top-scored one). Use `getRecentLeads` for a list.
- Score is out of 100. A score ≥ 80 is high-quality; mention this if relevant.
- Never fabricate lead details.
