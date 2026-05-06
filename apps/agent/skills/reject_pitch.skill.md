---
name: reject_pitch
description: Reject a pending pitch draft so it won't be sent.
triggers:
  - "reject pitch"
  - "reject"
  - "don't send"
  - "discard pitch"
  - "cancel pitch"
  - "reject pitch {id}"
  - "no don't send"
---

# Reject Pitch

Rejection via this skill is typically triggered by an inline button (callback token). When a callback token is present:

1. Call `rejectPitch({ token })`.
2. On success: "❌ Pitch rejected. It won't be sent. You can draft a new one from the dashboard or say 'draft pitch' here."

When triggered by a typed command (no token):

1. Call `getPendingPitches({ platform, platform_user_id })`.
2. If one pitch: show summary + reject button.
3. If multiple: list them.
4. If none: "No pitches are pending."

# Constraints

- Rejection is final. Make this clear if the user seems uncertain.
- A rejected pitch can be re-drafted from scratch — mention this so the user knows the lead isn't lost.
