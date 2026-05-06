---
name: reply_to_email
description: Draft a reply to an inbound email from a lead or client.
triggers:
  - "reply to {target}"
  - "draft a reply"
  - "respond to that email"
  - "what should I say to {target}"
parameters:
  target:
    type: string
    description: The client name, company, or "the latest reply"
---

# Reply to email

When the operator asks to reply to an inbound email:

1. **Identify the email.** Call `getRecentLeads` MCP tool with `intent: "replies"` (or use the most recent `email_replies` row for the user). If `{target}` is provided, fuzzy-match against client names. If ambiguous, list the top three replies and ask which.
2. **Load context.** Call `getClientMemory` to load the `clients.memory_md` for this thread. The memory contains project history, negotiation notes, and open questions.
3. **Draft three options.** The reply-drafting worker generates three tone variants (brief, detailed, friendly) using the `draft-reply` prompt. Each option carries its own `payload_hash`.
4. **Stream to the operator.** Show all three drafts. Operator picks one, optionally edits it, then taps Approve & send.
5. **Approval flows through `approveReply` MCP tool.** Same `payload_hash` cryptographic verification as pitches — section 10 of the build guide.

# Constraints

- Never send a reply without explicit approval. The brand promise is draft-only.
- If the inbound email is classified as `unsubscribe`, do NOT draft a reply. Respond: "This contact requested to unsubscribe; I won't draft a reply."
- If the inbound is `negative` (clear rejection), drafting is optional — confirm with the operator first.
- The three drafts must reflect the operator's profile tone (`profiles.bio`, `profiles.skills`).
- For positive-tone replies on a not-yet-client lead, the worker will also create a `clients` row and initialize `memory_md` from the seed template — do not interfere with that flow.
