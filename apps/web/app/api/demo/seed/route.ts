import { createServiceRoleClient } from "@openclaw/db";
import { computePayloadHash } from "@openclaw/agent/drafting";
import { handlers as mcpHandlers } from "@openclaw/agent/mcp-tools";
import { getSession } from "../../../../lib/supabaseServer";

/**
 * Demo-mode parachute (BACKLOG A9 + multi-lead expansion). Seeds a varied,
 * deterministic set of leads + scores + (where appropriate) pitches +
 * proof artifacts so the inbox tells a complete story during a live
 * demo: an immediate-pitch hero with proof attached, an in-flight
 * sent pitch, an approved pitch waiting to land, mid-tier scored leads
 * still pending the operator's judgment, and a couple of auto-filter
 * rejects to show the score band working.
 *
 * Idempotent: replaces any prior seed for the same user. Identifies
 * its rows by the constant prefix `demo-seed:` on lead.hash, so the
 * companion /api/demo/clear endpoint can wipe everything in one shot.
 */
const DEMO_HASH_PREFIX = "demo-seed:";
const HERO_LEAD_HASH = `${DEMO_HASH_PREFIX}nextjs-saas-rebuild`;
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
  // ISO posted_at offset in days ago.
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
  // ── HERO: 95, immediate-pitch, with full Lighthouse proof attached ──
  {
    hashSuffix: "nextjs-saas-rebuild",
    source: "upwork",
    source_url: "https://www.upwork.com/jobs/~demo-seed-nextjs-rebuild",
    title: "Senior Next.js engineer for SaaS analytics dashboard rebuild",
    description:
      "We're rebuilding our analytics dashboard. Stack: Next.js 14 App Router, TypeScript, Tailwind, Supabase. ~3 weeks, fixed price $6,200. Need someone who has shipped a real dashboard before — please share one example. Performance is the main concern (current LCP ~4s).",
    budget_text: "$6,200 fixed",
    posted_days_ago: 2,
    score: 95,
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

  // ── 88, APPROVED pitch (waiting to send) ──
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
        "Approved by operator on 2026-05-08. Stack and proof-of-value angle are tight; client explicitly asked for a portfolio with measurable wins.",
    },
  },

  // ── 86, SENT pitch (the one we already mailed) ──
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

  // ── 76, scored only — operator-judgment case ──
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

  // ── 71, scored only ──
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

  // ── 58, low-tier (probably-skip) ──
  {
    hashSuffix: "wordpress-elementor",
    source: "upwork",
    source_url: "https://www.upwork.com/jobs/~demo-seed-wordpress-elem",
    title: "WordPress + Elementor developer for landing page",
    description:
      "Need a WordPress/Elementor expert to build a landing page for our service. WordPress experience required. Budget $300 fixed for 3-5 days.",
    budget_text: "$300 fixed",
    posted_days_ago: 6,
    score: 32,
    reasoning:
      "Wrong stack — WordPress / Elementor is not the operator's React frontend specialty. Budget $300 is well below the floor. Auto-filter tier.",
    signals: ["WORDPRESS", "ELEMENTOR", "BELOW FLOOR", "OFF STACK"],
  },

  // ── 26, auto-filter (red flags) ──
  {
    hashSuffix: "vague-developer-needed",
    source: "reddit",
    source_url: "https://www.reddit.com/r/forhire/comments/demo-seed-vague",
    title: "[Hiring] Looking for a developer to help with our project",
    description:
      "Looking for a developer to help with our project. Long-term opportunity. Will discuss budget and details after you send your portfolio. Trial task expected (unpaid).",
    budget_text: null,
    posted_days_ago: 9,
    score: 26,
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

export async function POST() {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const supabase = createServiceRoleClient();

  // ── 1. Wipe any prior demo seed for this user (cascade-deletes
  //       attached pitches + proof_artifacts via FK constraints) ──
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

  for (const spec of SEED_LEADS) {
    const isHero = spec.hashSuffix === "nextjs-saas-rebuild";
    const postedAt = new Date(
      Date.now() - spec.posted_days_ago * 24 * 60 * 60 * 1000
    ).toISOString();

    // ── Insert lead ──
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

    // ── Insert score ──
    await supabase.from("scores").insert({
      lead_id: lead.id,
      score: spec.score,
      reasoning: spec.reasoning,
      signals: spec.signals,
      prompt_version: "score-lead@v1",
      model: "demo-seed",
    });

    // ── Insert pitch (if spec includes one) ──
    if (spec.pitch) {
      const pitchId = crypto.randomUUID();
      const payloadHash = computePayloadHash({
        id: pitchId,
        subject: spec.pitch.subject,
        draft: spec.pitch.body,
      });

      const now = new Date().toISOString();
      // Stamp transition timestamps so the audit columns reflect the
      // demo state honestly (a sent pitch should have sent_at set).
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

        // Hero gets the Lighthouse proof artifact attached.
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
    }
  }

  // ── Audit log: one row summarizing the seed ──
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
      },
    });
  }

  // ── Fan out the "pitch drafted" notification for ONLY the hero pitch.
  //     Notifying for every seeded pitch would spam Telegram/Discord
  //     during a demo; the operator wants one obvious incoming
  //     notification they can react to live. Failures are logged but
  //     don't fail the seed — chat platforms aren't always bound. ──
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
          score: 95,
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
