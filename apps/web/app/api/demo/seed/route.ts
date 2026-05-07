import { createServiceRoleClient } from "@openclaw/db";
import { computePayloadHash } from "@openclaw/agent/drafting";
import { handlers as mcpHandlers } from "@openclaw/agent/mcp-tools";
import { getSession } from "../../../../lib/supabaseServer";

/**
 * Demo-mode parachute (BACKLOG A9). Inserts a deterministic, predictable
 * lead → score → pitch → proof_artifact set for the calling user. After
 * seeding, the operator can demo "approve via Telegram → email send" even
 * if the scout pipeline / LLM providers / PageSpeed API are misbehaving.
 *
 * Idempotent: replaces any prior demo seed for the same user. Identifies
 * its own rows by the constant lead.hash 'demo-seed:nextjs-saas-rebuild'.
 */
const DEMO_LEAD_HASH = "demo-seed:nextjs-saas-rebuild";
const DEMO_TARGET_URL = "https://demo.openclaw.dev";

const DEMO_LEAD_NORMALIZED = {
  source: "upwork",
  source_url: "https://www.upwork.com/jobs/~demo-seed-nextjs-rebuild",
  title: "Senior Next.js engineer for SaaS analytics dashboard rebuild",
  description:
    "We're rebuilding our analytics dashboard. Stack: Next.js 14 App Router, TypeScript, Tailwind, Supabase. ~3 weeks, fixed price $6,200. Need someone who has shipped a real dashboard before — please share one example. Performance is the main concern (current LCP ~4s).",
  budget_text: "$6,200 fixed",
  posted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

const DEMO_PITCH_SUBJECT =
  "Next.js dashboard rebuild — Lighthouse audit attached, perf 42 → 89 plan";
const DEMO_PITCH_BODY = `Hi — ran a Lighthouse audit on demo.openclaw.dev before reaching out. Performance scores 42 today; the dominant issue is image lazy-loading (the hero asset is 1.8MB unoptimized) and an uncached query in the dashboard data layer.

Rebuilt a near-identical stack last month for a B2B analytics product: Next.js 14 App Router, Supabase, Tailwind. We took LCP from 4.2s to 1.1s in two focused sessions by reworking the data-fetching layer and shipping responsive image presets. Case study: [portfolio]

For your rebuild I'd start with a query-pattern audit before touching the UI — that's where the 3× gain typically hides. Three weeks is realistic for the full scope you described.

Are you available for a 20-minute call this week to align on approach?`;

const DEMO_PROOF_METADATA = {
  performance: 42,
  accessibility: 91,
  best_practices: 83,
  seo: 89,
  top_recommendations: [
    {
      id: "uses-optimized-images",
      title: "Properly size images",
      description: "Hero asset is 1.8MB unoptimized; 12% of total page weight. Switch to next/image with responsive sizes.",
      impact: "high",
    },
    {
      id: "render-blocking-resources",
      title: "Eliminate render-blocking resources",
      description: "Two third-party fonts load before first paint. Self-host with font-display:swap to recover ~640ms.",
      impact: "high",
    },
    {
      id: "uses-text-compression",
      title: "Enable text compression",
      description: "Server returns 412KB of uncompressed JS. Brotli would shave 73%.",
      impact: "medium",
    },
  ],
  estimated_lcp_ms: 4200,
  estimated_cls: 0.18,
  fetched_at: new Date().toISOString(),
};

const DEMO_PROOF_SUMMARY =
  "Lighthouse audit for https://demo.openclaw.dev. Performance 42, Accessibility 91, Best Practices 83, SEO 89. Biggest win: properly size images (high impact).";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const supabase = createServiceRoleClient();

  // ── 1. Wipe any prior demo seed for this user ─────────────────────────────
  const { data: priorLead } = await supabase
    .from("leads")
    .select("id")
    .eq("hash", DEMO_LEAD_HASH)
    .eq("user_id", userId)
    .maybeSingle();

  if (priorLead) {
    await supabase.from("leads").delete().eq("id", priorLead.id);
  }

  // ── 2. Insert lead ────────────────────────────────────────────────────────
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      user_id: userId,
      source_id: null,
      layer: 1,
      raw: { demo: true, source: "demo-seed" },
      normalized: DEMO_LEAD_NORMALIZED,
      hash: DEMO_LEAD_HASH,
    })
    .select("id")
    .single();
  if (leadErr || !lead) {
    return Response.json({ ok: false, error: leadErr?.message ?? "lead insert failed" }, { status: 500 });
  }

  // ── 3. Insert score ───────────────────────────────────────────────────────
  await supabase.from("scores").insert({
    lead_id: lead.id,
    score: 95,
    reasoning:
      "Bullseye stack match (Next.js 14 + TS + Tailwind + Supabase) for an operator who specializes in exactly that. Budget $6,200 is comfortably above effective rate for a 3-week project. Posted 2 days ago. Specific deliverable, clear timeline, asks for a portfolio. Performance concern stated explicitly — perfect proof-of-value opportunity. No red flags — immediate-pitch tier.",
    signals: ["NEXT.JS 14", "TYPESCRIPT", "SUPABASE", "FIXED $6.2K", "3 WEEK SCOPE", "PERF FOCUS"],
    prompt_version: "score-lead@v1",
    model: "demo-seed",
  });

  // ── 4. Insert pitch (with payload_hash so approval works) ─────────────────
  const pitchId = crypto.randomUUID();
  const payloadHash = computePayloadHash({
    id: pitchId,
    subject: DEMO_PITCH_SUBJECT,
    draft: DEMO_PITCH_BODY,
  });

  await supabase.from("pitches").insert({
    id: pitchId,
    lead_id: lead.id,
    user_id: userId,
    draft: DEMO_PITCH_BODY,
    subject: DEMO_PITCH_SUBJECT,
    status: "draft",
    payload_hash: payloadHash,
    expected_signal: {
      reasoning:
        "Demo seed pitch. Stack-match perfect. Cited proof concretely (LCP, image lazy-loading) since lead explicitly mentioned performance. Closing question is low-friction.",
      confidence: "high",
    },
  });

  // ── 5. Insert proof_artifact in 'complete' state ──────────────────────────
  await supabase.from("proof_artifacts").insert({
    user_id: userId,
    pitch_id: pitchId,
    artifact_type: "lighthouse",
    target_url: DEMO_TARGET_URL,
    summary: DEMO_PROOF_SUMMARY,
    metadata: DEMO_PROOF_METADATA as unknown as never,
    status: "complete",
    generated_at: new Date().toISOString(),
  });

  // ── 6. Audit log ──────────────────────────────────────────────────────────
  await supabase.from("audit_log").insert({
    user_id: userId,
    actor: "user",
    action: "demo.seed",
    resource_type: "leads",
    resource_id: lead.id,
    metadata: { lead_id: lead.id, pitch_id: pitchId },
  });

  // ── 7. Fan out the "pitch drafted" notification to every bound chat
  //       platform (Telegram + Discord) — the worker path normally does this
  //       at draftPitch completion, but the seed bypasses the worker so we
  //       fire it manually. Awaited inline because Vercel serverless tears
  //       the function down the instant we return; fire-and-forget would
  //       not survive that. Failures are caught so they never break the seed.
  try {
    await mcpHandlers.notifyAgent!({
      user_id: userId,
      kind: "pitch_drafted",
      payload: {
        pitch_id: pitchId,
        payload_hash: payloadHash,
        subject: DEMO_PITCH_SUBJECT,
        body: DEMO_PITCH_BODY,
        score: 95,
      },
    });
  } catch (err) {
    console.warn("[demo/seed] notifyAgent threw:", (err as Error).message);
  }

  return Response.json({
    ok: true,
    lead_id: lead.id,
    pitch_id: pitchId,
    redirect: `/?lead=${lead.id}`,
  });
}
