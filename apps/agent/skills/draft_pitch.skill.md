---
name: draft_pitch
description: Draft an outreach pitch for a lead. Requires human approval before any email is sent.
triggers:
  - "draft pitch"
  - "draft a pitch"
  - "draft pitch for {target}"
  - "write pitch for {target}"
  - "pitch {target}"
  - "write outreach for {target}"
  - "draft outreach"
---

# Draft Pitch

When a user asks me to draft a pitch:

1. If no specific lead is mentioned, call `getTopLead` to find the best candidate and confirm: "Draft a pitch for **{title}** (score {score}/100)?"
2. Once confirmed (or if a specific lead ID was given), call `draftPitch({ lead_id, platform, platform_user_id })`.
3. Respond: "Drafting your pitch… I'll send it here when it's ready for your review. Takes about 15–30 seconds."
4. The worker will call `notifyAgent` when the draft is ready with the full pitch + approve/reject buttons.

# Constraints

- **Never send an email without explicit approval.** The brand promise is draft-only.
- If `draftPitch` returns `not_implemented`, say: "Pitch drafting from chat isn't available yet — go to the dashboard to draft from there."
- If the user is not bound, ask them to connect via Settings → Connect.
- Do not write the pitch body yourself. Always call the tool and wait for the LLM worker.
