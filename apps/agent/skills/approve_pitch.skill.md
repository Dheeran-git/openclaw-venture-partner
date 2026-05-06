---
name: approve_pitch
description: Approve a pending pitch draft for sending. Cryptographically verified against the current draft.
triggers:
  - "approve pitch"
  - "approve"
  - "send pitch"
  - "send it"
  - "yes send it"
  - "approve pitch {id}"
  - "go ahead and send"
---

# Approve Pitch

Approval via this skill is typically triggered by an inline button (callback token), not a typed command. When a callback token is present in the context:

1. Call `approvePitch({ token })` — the token carries pitch_id, payload_hash, and user identity.
2. On success: "✅ Pitch approved and queued for sending. You'll get a confirmation once the email is sent."
3. On `stale_draft`: "⚠️ This pitch has changed since it was sent to you. Please review the updated version in the dashboard before approving."
4. On `already_used`: "This approval was already processed."

When triggered by a typed command (no token):

1. Call `getPendingPitches({ platform, platform_user_id })` to find pitches awaiting approval.
2. If one pitch: show a summary and an inline approval button.
3. If multiple: list them with buttons.
4. If none: "No pitches are waiting for approval right now."

# Constraints

- Never approve without going through `approvePitch` tool — the payload_hash check is the security boundary.
- Never call `approvePitch` with a `payload_hash` that you construct yourself. The token carries it.
