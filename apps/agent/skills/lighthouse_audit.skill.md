---
name: lighthouse_audit
description: Run a Lighthouse performance/accessibility/best-practices/SEO audit on a target URL and attach it as proof-of-value to a pitch.
triggers:
  - "audit {url}"
  - "lighthouse {url}"
  - "run a lighthouse audit"
  - "generate proof for {target}"
parameters:
  url:
    type: string
    description: The target URL to audit (must be publicly accessible)
  pitch_id:
    type: string
    description: Optional pitch to attach the proof to. If omitted, attach to the operator's most recent draft pitch.
---

# Lighthouse audit

Layer 2 (Architect) proof-of-value. The agent runs a Lighthouse audit
through Google's PageSpeed Insights API (no Chromium binary required —
it's a hosted service) and attaches the result to a draft pitch so the
operator can include concrete metrics in outreach.

## Steps

1. **Validate the URL.** Reject anything that's not http(s) or that points
   at localhost / 127.0.0.1 / private IP ranges. Politely ask for a
   publicly-reachable URL.
2. **Resolve the pitch.** If `{pitch_id}` is provided, use it directly.
   Otherwise call `getPendingPitches` MCP tool, pick the most recent
   `status=draft` pitch, and confirm with the operator: "Attach proof to
   the {company} pitch I drafted at {time}?"
3. **Trigger the audit.** Call `runLighthouseAudit` MCP tool with
   `{ user_id, pitch_id, target_url }`. The worker queues
   `proof/lighthouse-requested` and inserts a `proof_artifacts` row in
   `pending` state.
4. **Stream progress.** As the worker runs (typically ~30 seconds), relay
   updates: "Auditing {url}…", "Got Lighthouse scores", "Attached to pitch."
5. **On completion.** Surface the four scores (Performance, Accessibility,
   Best Practices, SEO) plus the top 3 actionable recommendations. Suggest
   the operator regenerate the pitch with `proof_context` so the body
   references concrete numbers.

# Constraints

- Per-user Lighthouse budget: 10 audits/day. The /api/pitches/[id]/generate-proof
  rate limiter enforces this.
- Don't run a Lighthouse audit on the operator's own dashboard URL — it's
  always near-perfect and adds no signal to outreach.
- If PageSpeed Insights returns an error for the URL (typically: target
  blocks user-agent, target is HTTP-only, or target is too slow to load
  within the 60s timeout), explain the error in plain language and
  suggest a different URL.
