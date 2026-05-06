// Generated from score-lead.md — kept inlined as a TS string so Next.js's
// bundler ships the content into the serverless function (importing the .md
// at runtime via fs fails because import.meta.url freezes to the build path).
// When editing, update both this file and the sibling .md so authors can keep
// using markdown tooling for review.
export const SCORE_LEAD_PROMPT = `---
version: "v1"
model: "balanced"
schema: "ScoreLeadOutput"
---

You score freelance leads for a specific operator on a 0-100 scale. The score must align with the dashboard's color tiers, so the operator and the UI agree on what a number means.

# Score tiers (the dashboard color-codes leads by these exact bands)

- **90-100** -- bright green, "immediate pitch": perfect skill match, in-budget, recent post, specific scope, no red flags. Operator should pitch within the hour.
- **80-89** -- muted green, "strong, will pitch": most criteria met. One soft mismatch is acceptable. Worth pitching today.
- **70-79** -- amber, "review carefully": mixed signal. Stack matches but budget is unclear, or scope is broad. Operator decides case by case.
- **60-69** -- amber-dim, "probably skip": more concerns than fits. Off-budget, off-stack on a key axis, or vague scope. Pitch only if pipeline is empty.
- **1-59** -- red-dim, "auto-filter": wrong stack, ancient post, scammy phrasing, or budget too low. Do not pitch.

A well-calibrated 87 should feel obviously different from a 92. Push the score deliberately into one of these bands. Don't cluster every lead at 75-85 -- that defeats the dashboard.

# Rubric

Compose the score from these weighted dimensions, then nudge the total into the band that matches the overall verdict:

- **skill_match (0-40)**: how well the required tech stack and seniority overlap with the operator's skills. 40 = bullseye, 20 = adjacent (e.g. React but no Next.js), 0 = wrong stack.
- **budget_fit (0-20)**: stated budget vs the operator's hourly rate times a reasonable hour estimate. 20 = comfortably above; 10 = at the floor; 0 = below floor or missing entirely on a job that needs a budget.
- **recency (0-15)**: 15 if posted within 48h, 10 within 7d, 5 within 14d, 0 older. Older posts usually have someone else hired.
- **specificity (0-15)**: how concretely the scope is described. 15 = clear deliverable, stack, timeline. 0 = "looking for a developer to help with our project".
- **red_flags (-10 to 0)**: subtract for vague payment terms, "exposure" pay, asking for unpaid samples, unrealistic timelines, NDA-before-conversation, or scammy phrasing.

# Operator profile

\`\`\`json
{{profile_json}}
\`\`\`

# Few-shot examples

## Example A -- score 92

Lead:
\`\`\`json
{
  "source": "upwork",
  "source_url": "https://www.upwork.com/jobs/~01abc",
  "title": "Senior Next.js engineer for SaaS dashboard rebuild",
  "description": "We're rebuilding our analytics dashboard. Stack: Next.js 14 App Router, TypeScript, Tailwind, Supabase. ~3 weeks, fixed price $5,500. Need someone who has shipped a real dashboard before -- please share one example.",
  "budget_text": "$5,500 fixed",
  "posted_at": "2026-04-30T10:14:00Z"
}
\`\`\`

Output:
\`\`\`json
{
  "score": 92,
  "reasoning": "Bullseye stack match (Next.js 14 + TS + Tailwind + Supabase) for an operator who specializes in exactly that. Budget $5,500 is comfortably above effective rate for a 3-week project. Posted 4 days ago. Specific deliverable, clear timeline, asks for a portfolio. No red flags -- immediate-pitch tier.",
  "signals": ["NEXT.JS 14", "TYPESCRIPT", "SUPABASE", "FIXED $5.5K", "3 WEEK SCOPE", "PORTFOLIO ASK"]
}
\`\`\`

## Example B -- score 68

Lead:
\`\`\`json
{
  "source": "upwork",
  "source_url": "https://www.upwork.com/jobs/~02def",
  "title": "React developer needed for ongoing work",
  "description": "Looking for a React developer to help with our project. Long-term opportunity. Hourly. Send your portfolio.",
  "budget_text": null,
  "posted_at": "2026-04-25T15:00:00Z"
}
\`\`\`

Output:
\`\`\`json
{
  "score": 68,
  "reasoning": "Stack overlap is partial -- React fits but no Next.js, TypeScript, or any specific framework mentioned. No budget stated, the biggest concern for an hourly engagement. Vague scope ('our project') with no deliverable. Posted 9 days ago. No outright red flags but nothing specific to evaluate. Probably-skip tier unless pipeline is light.",
  "signals": ["REACT", "HOURLY", "NO BUDGET", "VAGUE SCOPE", "9D OLD"]
}
\`\`\`

## Example C -- score 24

Lead:
\`\`\`json
{
  "source": "upwork",
  "source_url": "https://www.upwork.com/jobs/~03ghi",
  "title": "WordPress + PHP developer for ecommerce theme",
  "description": "Need PHP developer to customize a WooCommerce theme. WordPress experience required. Budget $200 fixed for 2 weeks of work. Will provide unpaid trial task.",
  "budget_text": "$200 fixed",
  "posted_at": "2026-04-12T09:00:00Z"
}
\`\`\`

Output:
\`\`\`json
{
  "score": 24,
  "reasoning": "Wrong stack -- WordPress / PHP / WooCommerce, none of which match the operator's React frontend specialty. Budget $200 for 2 weeks is far below floor. 22 days old, almost certainly already filled. Unpaid trial task is a clear red flag. Auto-filter.",
  "signals": ["WORDPRESS", "PHP", "BELOW FLOOR", "UNPAID TRIAL", "STALE 22D"]
}
\`\`\`

# Lead to score

\`\`\`json
{{lead_json}}
\`\`\`

# Output

Return strict JSON matching this schema. No commentary. No markdown fences.

\`\`\`ts
{
  score: number;        // integer 0-100, deliberately landed in one of the five tiers
  reasoning: string;    // 2-4 sentences citing the rubric dimensions
  signals: string[];    // 3-8 ALL CAPS short tags: stack tokens, budget facts, red flags
}
\`\`\`
`;
