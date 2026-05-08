import { createServiceRoleClient } from "@openclaw/db";
import { computePayloadHash } from "@openclaw/agent/drafting";
import { handlers as mcpHandlers } from "@openclaw/agent/mcp-tools";
import { getSession } from "../../../../lib/supabaseServer";

/**
 * Demo-mode parachute. Seeds a deterministic, opinionated dataset that
 * walks a viewer through every meaningful state of the OpenClaw pipeline
 * in a single dashboard load:
 *
 *   - Inbox: 10 scored leads spread across the score bands so the
 *            color tiers and signal pills speak for themselves.
 *   - Pitches: a draft hero (with full Lighthouse proof attached), an
 *              approved pitch, and a sent pitch that's already received
 *              a positive client reply.
 *   - Clients: an active conversation auto-created from the positive
 *              reply, plus a historical client to show the memory log.
 *   - Email replies: one classified-positive reply with three drafted
 *                    response options the operator can pick from.
 *
 * Idempotent: replaces any prior demo seed for the same user. Identifies
 * its rows by the constant prefix `demo-seed:` on lead.hash and the
 * `@demo.openclaw.dev` email domain on clients/replies, so the
 * companion /api/demo/clear endpoint can wipe everything in one shot.
 */
const DEMO_HASH_PREFIX = "demo-seed:";
const DEMO_EMAIL_DOMAIN = "demo.openclaw.dev";
const DEMO_TARGET_URL = "https://demo.openclaw.dev";

type Source = "upwork" | "linkedin" | "indeed" | "contra" | "reddit";
type PitchStatus = "draft" | "approved" | "sent" | "rejected";

interface SeedLead {
  hashSuffix: string;
  source: Source;
  source_url: string;
  title: string;
  description: string;
  budget_text: string | null;
  posted_days_ago: number;
  score: number;
  reasoning: string;
  signals: string[];
  pitch?: {
    subject: string;
    body: string;
    status: PitchStatus;
    confidence: "high" | "medium" | "low";
    reasoning: string;
  };
}

const HERO_PITCH_SUBJECT =
  "Next.js dashboard rebuild — Lighthouse audit attached, perf 42 → 89 plan";

const HERO_PITCH_BODY = `Hi — ran a Lighthouse audit on demo.openclaw.dev before reaching out. Performance scores 42 today; the dominant issue is image lazy-loading (the hero asset is 1.8MB unoptimized) and an uncached query in the dashboard data layer.

Rebuilt a near-identical stack last month for a B2B analytics product: Next.js 14 App Router, Supabase, Tailwind. We took LCP from 4.2s to 1.1s in two focused sessions by reworking the data-fetching layer and shipping responsive image presets. Case study: [portfolio]

For your rebuild I'd start with a query-pattern audit before touching the UI — that's where the 3× gain typically hides. Three weeks is realistic for the full scope you described.

Are you available for a 20-minute call this week to align on approach?`;

const SEED_LEADS: SeedLead[] = [
  // 1 ── HERO 96, immediate-pitch, Lighthouse proof attached ───────────────
  {
    hashSuffix: "nextjs-saas-rebuild",
    source: "upwork",
    source_url: "https://www.upwork.com/jobs/~demo-seed-nextjs-rebuild",
    title: "Senior Next.js engineer for SaaS analytics dashboard rebuild",
    description:
      "We're rebuilding our analytics dashboard. Stack: Next.js 14 App Router, TypeScript, Tailwind, Supabase. ~3 weeks, fixed price $6,200. Need someone who has shipped a real dashboard before — please share one example. Performance is the main concern (current LCP ~4s).",
    budget_text: "$6,200 fixed",
    posted_days_ago: 2,
    score: 96,
    reasoning:
      "Bullseye stack match (Next.js 14 + TS + Tailwind + Supabase) for an operator who specializes in exactly that. Budget $6,200 is comfortably above effective rate for a 3-week project. Posted 2 days ago. Specific deliverable, clear timeline, asks for a portfolio. Performance concern stated explicitly — perfect proof-of-value opportunity. No red flags — immediate-pitch tier.",
    signals: [
      "NEXT.JS 14",
      "TYPESCRIPT",
      "SUPABASE",
      "FIXED $6.2K",
      "3 WEEK SCOPE",
      "PERF FOCUS",
    ],
    pitch: {
      subject: HERO_PITCH_SUBJECT,
      body: HERO_PITCH_BODY,
      status: "draft",
      confidence: "high",
      reasoning:
        "Demo seed pitch. Stack-match perfect. Cited proof concretely (LCP, image lazy-loading) since lead explicitly mentioned performance. Closing question is low-friction.",
    },
  },

  // 2 ── 92, draft pitch, fintech onboarding ──────────────────────────────
  {
    hashSuffix: "fintech-onboarding-flow",
    source: "upwork",
    source_url: "https://www.upwork.com/jobs/~demo-seed-fintech-onboarding",
    title: "Tailwind + Next.js onboarding flow rebuild — fintech",
    description:
      "Series-B fintech, our 7-step onboarding has a 38% drop-off. Looking for a Next.js + Tailwind engineer to rebuild the flow with proper validation, progress persistence, and a unified design system. Budget $4,800 fixed for 2.5 weeks. Need before/after Hotjar comparable. SOC 2 means clean code matters.",
    budget_text: "$4,800 fixed",
    posted_days_ago: 1,
    score: 92,
    reasoning:
      "Strong match: Next.js + Tailwind core stack, with a measurable conversion problem the operator can pitch a concrete win against. $4,800 over 2.5 weeks is comfortable. Series-B fintech signals real budget headroom for follow-on work. Posted yesterday.",
    signals: [
      "NEXT.JS",
      "TAILWIND",
      "FIXED $4.8K",
      "FINTECH",
      "2.5 WEEK",
      "CONVERSION FOCUS",
    ],
    pitch: {
      subject: "Onboarding rebuild — 38% drop-off → ~18% in 2.5 weeks",
      body: `Hi — your post is exactly the shape of work I shipped last quarter. A B2B fintech we worked with had a 41% drop-off across a 6-step onboarding; rebuild took 2 weeks and brought it to 19%, holding steady three months later.

The two biggest wins: (1) progress persistence so refresh/email-bounce doesn't restart, (2) inline validation that doesn't punish the user until they leave a field. Both are quick to ship and visible immediately in Hotjar.

For your scope I'd plan: day 1-2 instrument and reproduce the drop-off step-by-step, days 3-9 rebuild the flow, days 10-13 polish and a SOC-2-friendly code review. Happy to send a redacted code walk-through.

Want to hop on a 20-min call this week?`,
      status: "draft",
      confidence: "high",
      reasoning:
        "Good match on stack + measurable problem framing. Cited a closely comparable past win to anchor credibility. Closing ask is low-friction.",
    },
  },

  // 3 ── 88, APPROVED pitch (waiting to send) ─────────────────────────────
  {
    hashSuffix: "perf-consultant-ecom",
    source: "contra",
    source_url: "https://contra.com/projects/demo-seed-perf-ecom",
    title: "Performance optimization consultant for headless e-commerce",
    description:
      "We're a Shopify Hydrogen + Next.js team and our checkout LCP regressed to 3.6s after the holiday push. Looking for someone to audit and ship perf fixes over 2 weeks. Hourly $90-120. Show us a Lighthouse before/after if you have one.",
    budget_text: "$90-120 / hr",
    posted_days_ago: 1,
    score: 88,
    reasoning:
      "Strong stack overlap on the Next.js side, with the perf-audit angle the operator has shipped proof for. Hourly $90-120 maps comfortably above the $80 floor. Posted yesterday, asks specifically for a portfolio with measurable wins.",
    signals: [
      "NEXT.JS",
      "HYDROGEN",
      "PERF AUDIT",
      "HOURLY $90-120",
      "PORTFOLIO ASK",
      "RECENT POST",
    ],
    pitch: {
      subject: "Hydrogen perf audit — LCP 3.6s → 1.8s in 2 weeks",
      body: `Hi — saw your post about the post-holiday LCP regression. Last quarter I cut a Hydrogen storefront's checkout LCP from 3.4s to 1.6s in 9 working days. The dominant wins were query collapsing on the product node fetch and shipping image presets through next/image's responsive sizing.

For your timeline: I'd spend day 1 on a Lighthouse + WebPageTest baseline + a query graph trace, days 2-4 on the data layer, days 5-9 on render-path/CLS work, day 10 on a regression dashboard so the team can hold the line.

Hourly is fine. Quick 20-min call this week to align scope?`,
      status: "approved",
      confidence: "high",
      reasoning:
        "Approved by operator. Stack and proof-of-value angle are tight; client explicitly asked for a portfolio with measurable wins.",
    },
  },

  // 4 ── 86, SENT pitch (has client + email reply) ────────────────────────
  {
    hashSuffix: "fullstack-b2b-dashboard",
    source: "upwork",
    source_url: "https://www.upwork.com/jobs/~demo-seed-fullstack-b2b",
    title: "Full-stack engineer for B2B SaaS dashboard (Next.js + Postgres)",
    description:
      "Series A SaaS, looking for a senior full-stack engineer to ship a customer-facing analytics dashboard. Next.js 14, Postgres, Tailwind. Multi-tenant. ~5 week scope, fixed $9,000. Send a link to a similar dashboard you've shipped.",
    budget_text: "$9,000 fixed",
    posted_days_ago: 3,
    score: 86,
    reasoning:
      "Stack matches the operator's specialty almost entirely (Next.js, Postgres, Tailwind). Budget $9,000 over 5 weeks is comfortable. Multi-tenant adds depth. Asks for a portfolio link, which the operator has. Strong, will-pitch tier.",
    signals: [
      "NEXT.JS",
      "POSTGRES",
      "MULTI-TENANT",
      "FIXED $9K",
      "5 WEEK SCOPE",
      "SERIES A",
    ],
    pitch: {
      subject: "Series-A B2B dashboard — multi-tenant Next.js, 5-week plan",
      body: `Hi — your post lined up with a project I shipped last month: multi-tenant analytics dashboard, Next.js 14 App Router, Postgres with row-level security, Tailwind. 5 active tenants on day one, ~40 today.

For your scope I'd plan it as: week 1 schema + tenant scoping, weeks 2-3 the dashboards proper, week 4 polish + perf, week 5 buffer + handoff. Happy to share the case study and a redacted code walk-through.

Available to start in the next 7 days. Want to set up a call?`,
      status: "sent",
      confidence: "high",
      reasoning: "Sent on 2026-05-07. Awaiting client reply.",
    },
  },

  // 5 ── 84, draft pitch, headless CMS migration ──────────────────────────
  {
    hashSuffix: "sanity-cms-migration",
    source: "linkedin",
    source_url: "https://www.linkedin.com/jobs/view/demo-seed-sanity",
    title: "Headless CMS migration — Wordpress → Next.js + Sanity",
    description:
      "Mid-stage SaaS, ~80 marketing pages currently on a custom Wordpress theme. Migrating to a Next.js storefront with Sanity as the editorial layer. Budget $7,500 fixed for 3 weeks. Editorial team needs a clean composable studio. SEO must not regress.",
    budget_text: "$7,500 fixed",
    posted_days_ago: 2,
    score: 84,
    reasoning:
      "Next.js core stack matches the operator. Sanity is adjacent — operator hasn't shipped Sanity specifically but the migration shape is well-known. Budget $7,500 over 3 weeks is comfortable. Strong, will-pitch tier with a soft mismatch on Sanity that's worth flagging in the pitch.",
    signals: [
      "NEXT.JS",
      "SANITY",
      "CMS MIGRATION",
      "FIXED $7.5K",
      "3 WEEK SCOPE",
      "SEO CARE",
    ],
    pitch: {
      subject: "WP → Next.js + Sanity migration — clean studio, SEO held",
      body: `Hi — Wordpress-to-headless migrations are most of what I shipped Q1. Last one was a 110-page editorial site that moved from a custom WP theme to Next.js + a composable headless CMS in 3.5 weeks, with zero SEO regression (we ran a full sitemap diff + 301 audit pre-cutover).

I haven't shipped Sanity specifically — closest experience is Contentful with similar editorial shape — but Sanity Studio is a quick onboard and I can have a working instance to show you within 48 hours of a green light.

Plan for your scope: week 1 Studio + content model + first 10 pages, week 2 the bulk migration with redirect plan, week 3 polish + a 30-page editorial dry-run with your team. Happy to chat?`,
      status: "draft",
      confidence: "medium",
      reasoning:
        "Honest about the Sanity gap rather than glossing over it; operator's WP→headless track record carries. Soft confidence reflects the stack mismatch.",
    },
  },

  // 6 ── 80, draft pitch, real-time data viz ──────────────────────────────
  {
    hashSuffix: "realtime-supabase-viz",
    source: "upwork",
    source_url: "https://www.upwork.com/jobs/~demo-seed-realtime-viz",
    title: "Real-time data viz dashboard — Next.js + Supabase Realtime",
    description:
      "Logistics startup, need a real-time fleet-tracking dashboard. Next.js, Supabase (Postgres + Realtime), Tailwind. ~10 active vehicles to start, scaling to 200. Map-based UI with status pills + filters. Fixed $5,200 for 2 weeks.",
    budget_text: "$5,200 fixed",
    posted_days_ago: 3,
    score: 80,
    reasoning:
      "Next.js + Supabase + Tailwind = full operator-stack match. Real-time UI is a slight specialty stretch but Supabase Realtime is straightforward. $5,200 over 2 weeks is right in the band. Strong tier.",
    signals: [
      "NEXT.JS",
      "SUPABASE REALTIME",
      "FIXED $5.2K",
      "2 WEEK",
      "MAP UI",
      "LOGISTICS",
    ],
    pitch: {
      subject: "Real-time fleet dashboard — Supabase Realtime, 2-week plan",
      body: `Hi — Supabase Realtime + Next.js is exactly the stack I work in daily. Last month I shipped a near-identical real-time UI for a marketplace ops team: ~30 simultaneous channels, sub-200ms update latency, no flicker on rapid bursts.

For 10→200 vehicle scale you'll want to think about channel topology early: per-vehicle channels are simpler to reason about under 50, beyond that you'll want a single fleet broadcast filtered client-side. I can sketch both options in the kickoff call.

Plan: week 1 schema + channel topology + map base UI, week 2 status pills + filters + load testing to your scale target.

Available next week — set up a 20-min call?`,
      status: "draft",
      confidence: "high",
      reasoning:
        "Stack-perfect, with a concrete same-shape past project. Surfaced the scaling design decision proactively to demonstrate seniority.",
    },
  },

  // 7 ── 76, scored only — operator-judgment territory ────────────────────
  {
    hashSuffix: "react-marketing-rebuild",
    source: "upwork",
    source_url: "https://www.upwork.com/jobs/~demo-seed-react-marketing",
    title: "React + Tailwind marketing site rebuild — 1 week",
    description:
      "Need a React/Tailwind dev to rebuild our 8-page marketing site. Existing site is on a stale Bootstrap theme. Budget $1,800 fixed for 1 week. Mobile-responsive is non-negotiable. Send a marketing site you've built.",
    budget_text: "$1,800 fixed",
    posted_days_ago: 4,
    score: 76,
    reasoning:
      "Stack overlaps (React + Tailwind) but no Next.js or Supabase angle to lean on. Budget $1,800 for 1 week is right at the operator's floor. Marketing rebuilds are commodity work; will-pitch only if pipeline allows. Review-carefully tier.",
    signals: [
      "REACT",
      "TAILWIND",
      "MARKETING SITE",
      "FIXED $1.8K",
      "1 WEEK",
      "8 PAGES",
    ],
  },

  // 8 ── 71, scored only ──────────────────────────────────────────────────
  {
    hashSuffix: "ts-startup-analytics",
    source: "linkedin",
    source_url: "https://www.linkedin.com/jobs/view/demo-seed-ts-analytics",
    title: "TypeScript engineer (contract) — analytics startup",
    description:
      "We're a small analytics startup and we need a TypeScript engineer to ship a few features over the next month. Stack: Node, Postgres, some React. Hourly $70-95. Remote, contract.",
    budget_text: "$70-95 / hr",
    posted_days_ago: 5,
    score: 71,
    reasoning:
      "Stack overlap is partial — TS + React match but Node-heavy backend isn't the operator's specialty. Hourly $70-95 sits right on the floor. Vague scope ('a few features over a month'). Review-carefully tier.",
    signals: ["TYPESCRIPT", "NODE", "HOURLY $70-95", "VAGUE SCOPE", "5D OLD"],
  },

  // 9 ── 38, auto-filter (off-stack) ──────────────────────────────────────
  {
    hashSuffix: "wordpress-elementor",
    source: "upwork",
    source_url: "https://www.upwork.com/jobs/~demo-seed-wordpress-elem",
    title: "WordPress + Elementor developer for landing page",
    description:
      "Need a WordPress/Elementor expert to build a landing page for our service. WordPress experience required. Budget $300 fixed for 3-5 days.",
    budget_text: "$300 fixed",
    posted_days_ago: 6,
    score: 38,
    reasoning:
      "Wrong stack — WordPress / Elementor is not the operator's React frontend specialty. Budget $300 is well below the floor. Auto-filter tier.",
    signals: ["WORDPRESS", "ELEMENTOR", "BELOW FLOOR", "OFF STACK"],
  },

  // 10 ── 24, auto-filter (red flags) ─────────────────────────────────────
  {
    hashSuffix: "vague-developer-needed",
    source: "reddit",
    source_url: "https://www.reddit.com/r/forhire/comments/demo-seed-vague",
    title: "[Hiring] Looking for a developer to help with our project",
    description:
      "Looking for a developer to help with our project. Long-term opportunity. Will discuss budget and details after you send your portfolio. Trial task expected (unpaid).",
    budget_text: null,
    posted_days_ago: 9,
    score: 24,
    reasoning:
      "No stack mentioned. No budget stated. Vague scope ('our project'). Unpaid trial task is a clear red flag. Posted 9 days ago — almost certainly stale or filled. Auto-filter tier.",
    signals: [
      "NO STACK",
      "NO BUDGET",
      "VAGUE SCOPE",
      "UNPAID TRIAL",
      "STALE 9D",
    ],
  },
];

const HERO_PROOF_METADATA = {
  performance: 42,
  accessibility: 91,
  best_practices: 83,
  seo: 89,
  top_recommendations: [
    {
      id: "uses-optimized-images",
      title: "Properly size images",
      description:
        "Hero asset is 1.8MB unoptimized; 12% of total page weight. Switch to next/image with responsive sizes.",
      impact: "high",
    },
    {
      id: "render-blocking-resources",
      title: "Eliminate render-blocking resources",
      description:
        "Two third-party fonts load before first paint. Self-host with font-display:swap to recover ~640ms.",
      impact: "high",
    },
    {
      id: "uses-text-compression",
      title: "Enable text compression",
      description:
        "Server returns 412KB of uncompressed JS. Brotli would shave 73%.",
      impact: "medium",
    },
  ],
  estimated_lcp_ms: 4200,
  estimated_cls: 0.18,
  fetched_at: new Date().toISOString(),
};

const HERO_PROOF_SUMMARY =
  "Lighthouse audit for https://demo.openclaw.dev. Performance 42, Accessibility 91, Best Practices 83, SEO 89. Biggest win: properly size images (high impact).";

// Memory_md for the active client (the one with a positive reply on the
// SENT pitch). Markdown so the right-rail MemoryRenderer formats it nicely.
const ACTIVE_CLIENT_MEMORY = `## Acme Insights, Inc.

**Stage:** Series A B2B SaaS
**Found via:** Upwork — full-stack engineer for B2B dashboard
**Budget:** $9,000 fixed, 5 weeks
**Stack match:** Next.js 14 + Postgres + Tailwind (full match)

### Conversation log

- **Day 0** — Sent pitch citing my multi-tenant dashboard case study; closed with a 20-min call ask.
- **Day 1** — Sarah (founder) replied positively: liked the staged plan, wants to chat Wednesday 2pm PT. Mentioned they're also considering an in-house hire so timeline matters.

### Working notes

- Their product hits ~40 tenants — RLS pattern from the past project applies cleanly.
- Sarah's a non-technical founder — explanations should anchor in business outcomes, not framework names.
- Wednesday call: lead with the 5-week timeline + a sketched week-1 schema deliverable.`;

const HISTORICAL_CLIENT_MEMORY = `## Northwind Commerce

**Stage:** Closed (delivered Q1 2026)
**Engagement:** 4 weeks, $7,200 fixed
**Outcome:** Conversion-rate-optimization rebuild. LCP from 3.4s → 1.6s; checkout drop-off 18% → 11%.

### Highlights

- Rebuilt the checkout flow on Next.js 14 from a stale Hydrogen v1 template.
- Sold a follow-on perf retainer ($1,800/mo, ongoing) on the back of the post-launch report.
- Founder (Marcus) is happy to be a reference; mentioned his network during the wrap-up call.

### Notes for next outreach

- Marcus said his sister-in-law runs ops at a series-B logistics firm and they'd been talking about a fleet dashboard. Worth a warm intro ping in 4-6 weeks once their internal RFP closes.
- Retainer renews 2026-08-01 — schedule a check-in 2 weeks before.`;

const POSITIVE_REPLY_BODY = `Hi —

Thanks for reaching out. I really liked the case study and the week-by-week plan made it easy to picture how this would land. We're also considering an in-house hire, so timeline is on my mind.

Could we hop on a call Wednesday at 2pm PT? Happy to walk you through our existing schema and the customer feedback that's driving this rebuild.

Best,
Sarah Chen
Founder & CEO, Acme Insights`;

const REPLY_DRAFT_OPTIONS = [
  {
    tone: "warm",
    body: `Hi Sarah —

Wednesday 2pm PT works on my end. I'll send a Google Meet link this evening. To make the time go far, would it be useful if I came prepped with a sketch of the week-1 schema based on the feedback you mentioned? Happy to keep it lightweight — 15 min walk-through, 30 min open discussion, room to course-correct.

Looking forward to it.

Best,
Dheeran`,
  },
  {
    tone: "concise",
    body: `Hi Sarah —

Wednesday 2pm PT works. I'll send a Meet link tonight. Would a sketched week-1 schema be useful to anchor the call? If yes, send over the customer feedback and I'll have a draft ready.

Best,
Dheeran`,
  },
  {
    tone: "consultative",
    body: `Hi Sarah —

Wednesday 2pm PT confirmed; meeting link to follow. A few thoughts ahead of the call to keep us on the same page:

1. The in-house vs. contract decision usually hinges on how quickly you need v1 in customer hands. If "before end of quarter" is on the table, I'd lean contract for the rebuild and hire for the steady-state team.
2. The feedback driving this rebuild matters more than the framework choice. If you can send 2-3 representative quotes I'll come with a sketch of which ones the rebuild structurally addresses.

See you Wednesday.

Best,
Dheeran`,
  },
];

export async function POST() {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const supabase = createServiceRoleClient();

  // ── 1. Wipe any prior demo seed for this user.
  //       Order matters: clients first (they don't auto-cascade), then
  //       leads (which cascade into pitches, scores, proof_artifacts,
  //       and email_replies via FK on delete cascade). ─────────────────
  await supabase
    .from("clients")
    .delete()
    .eq("user_id", userId)
    .ilike("contact_email", `%@${DEMO_EMAIL_DOMAIN}`);

  const { data: priorLeads } = await supabase
    .from("leads")
    .select("id")
    .like("hash", `${DEMO_HASH_PREFIX}%`)
    .eq("user_id", userId);
  const priorIds = ((priorLeads ?? []) as Array<{ id: string }>).map(
    (r) => r.id
  );
  if (priorIds.length > 0) {
    await supabase.from("leads").delete().in("id", priorIds);
  }

  let heroLeadId: string | null = null;
  let heroPitchId: string | null = null;
  let heroPayloadHash: string | null = null;

  // For the "sent + replied" lead we need to remember the pitch id so
  // we can attach an email_reply + auto-create a client from it.
  let sentPitchId: string | null = null;
  let sentLeadId: string | null = null;

  for (const spec of SEED_LEADS) {
    const isHero = spec.hashSuffix === "nextjs-saas-rebuild";
    const isSent = spec.pitch?.status === "sent";
    const postedAt = new Date(
      Date.now() - spec.posted_days_ago * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .insert({
        user_id: userId,
        source_id: null,
        layer: 1,
        raw: { demo: true, source: "demo-seed", hash_suffix: spec.hashSuffix },
        normalized: {
          source: spec.source,
          source_url: spec.source_url,
          title: spec.title,
          description: spec.description,
          budget_text: spec.budget_text,
          posted_at: postedAt,
        },
        hash: `${DEMO_HASH_PREFIX}${spec.hashSuffix}`,
      })
      .select("id")
      .single();
    if (leadErr || !lead) {
      return Response.json(
        { ok: false, error: leadErr?.message ?? "lead insert failed" },
        { status: 500 }
      );
    }

    await supabase.from("scores").insert({
      lead_id: lead.id,
      score: spec.score,
      reasoning: spec.reasoning,
      signals: spec.signals,
      prompt_version: "score-lead@v1",
      model: "demo-seed",
    });

    if (spec.pitch) {
      const pitchId = crypto.randomUUID();
      const payloadHash = computePayloadHash({
        id: pitchId,
        subject: spec.pitch.subject,
        draft: spec.pitch.body,
      });

      const now = new Date().toISOString();
      await supabase.from("pitches").insert({
        id: pitchId,
        lead_id: lead.id,
        user_id: userId,
        draft: spec.pitch.body,
        subject: spec.pitch.subject,
        status: spec.pitch.status,
        payload_hash: payloadHash,
        expected_signal: {
          reasoning: spec.pitch.reasoning,
          confidence: spec.pitch.confidence,
        },
        approved_at:
          spec.pitch.status === "approved" || spec.pitch.status === "sent"
            ? now
            : null,
        sent_at: spec.pitch.status === "sent" ? now : null,
      });

      if (isHero) {
        heroLeadId = lead.id;
        heroPitchId = pitchId;
        heroPayloadHash = payloadHash;

        await supabase.from("proof_artifacts").insert({
          user_id: userId,
          pitch_id: pitchId,
          artifact_type: "lighthouse",
          target_url: DEMO_TARGET_URL,
          summary: HERO_PROOF_SUMMARY,
          metadata: HERO_PROOF_METADATA as unknown as never,
          status: "complete",
          generated_at: new Date().toISOString(),
        });
      }

      if (isSent) {
        sentPitchId = pitchId;
        sentLeadId = lead.id;
      }
    }
  }

  // ── 2. Active client from the sent pitch + positive reply ──────────
  if (sentPitchId && sentLeadId) {
    const { data: activeClient } = await supabase
      .from("clients")
      .insert({
        user_id: userId,
        company_name: "Acme Insights, Inc.",
        contact_email: `sarah@acme-insights.${DEMO_EMAIL_DOMAIN}`,
        source_lead_id: sentLeadId,
        status: "active",
        memory_md: ACTIVE_CLIENT_MEMORY,
      })
      .select("id")
      .single();

    if (activeClient) {
      // Email reply tied to the sent pitch + this client. Status
      // "drafted" so the operator's right-rail ReplyCard shows three
      // options and the Approve & send action.
      await supabase.from("email_replies").insert({
        user_id: userId,
        pitch_id: sentPitchId,
        client_id: activeClient.id,
        from_email: `sarah@acme-insights.${DEMO_EMAIL_DOMAIN}`,
        subject: "Re: Series-A B2B dashboard — multi-tenant Next.js",
        body_text: POSITIVE_REPLY_BODY,
        body_html: null,
        received_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        classification: "positive",
        classification_confidence: "high",
        classification_reasoning:
          "Reply explicitly accepts the call ask, surfaces a real concern (in-house alternative + timeline), and offers a concrete next step. Strong positive signal.",
        classification_suggested_action: "draft_reply",
        drafted_subject: "Re: Series-A B2B dashboard — multi-tenant Next.js",
        drafted_options: REPLY_DRAFT_OPTIONS as unknown as never,
        drafted_reasoning:
          "Three tones offered: warm (default; the client's reply was personable), concise (if the operator prefers a tight ack), and consultative (the strongest if the operator wants to position seniority pre-call).",
        status: "drafted",
      });
    }
  }

  // ── 3. Historical client (closed deal, memory only) ─────────────────
  await supabase.from("clients").insert({
    user_id: userId,
    company_name: "Northwind Commerce",
    contact_email: `marcus@northwind.${DEMO_EMAIL_DOMAIN}`,
    source_lead_id: null,
    status: "active",
    memory_md: HISTORICAL_CLIENT_MEMORY,
  });

  // ── 4. Audit log: one row summarizing the seed ──────────────────────
  if (heroLeadId) {
    await supabase.from("audit_log").insert({
      user_id: userId,
      actor: "user",
      action: "demo.seed",
      resource_type: "leads",
      resource_id: heroLeadId,
      metadata: {
        seeded_count: SEED_LEADS.length,
        hero_lead_id: heroLeadId,
        hero_pitch_id: heroPitchId,
        sent_pitch_id: sentPitchId,
      },
    });
  }

  // ── 5. Fan out the "pitch drafted" notification for the hero only ──
  if (heroPitchId && heroPayloadHash) {
    try {
      await mcpHandlers.notifyAgent!({
        user_id: userId,
        kind: "pitch_drafted",
        payload: {
          pitch_id: heroPitchId,
          payload_hash: heroPayloadHash,
          subject: HERO_PITCH_SUBJECT,
          body: HERO_PITCH_BODY,
          score: 96,
        },
      });
    } catch (err) {
      console.warn("[demo/seed] notifyAgent threw:", (err as Error).message);
    }
  }

  return Response.json({
    ok: true,
    seeded_count: SEED_LEADS.length,
    lead_id: heroLeadId,
    pitch_id: heroPitchId,
    redirect: heroLeadId ? `/?lead=${heroLeadId}` : "/",
  });
}
