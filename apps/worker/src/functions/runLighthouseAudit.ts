import { createServiceRoleClient } from "@openclaw/db";

import { inngest } from "../inngest";

/**
 * Phase 4 Step 1 — Lighthouse audit worker.
 *
 * Architectural choice: hits Google's PageSpeed Insights API instead of
 * bundling Chromium into the serverless function. PSI returns the full
 * Lighthouse v10+ JSON for a given URL, has a generous free quota, and
 * works on Vercel Hobby without the 50MB function-size headache that
 * @sparticuz/chromium would create.
 *
 * If PAGESPEED_API_KEY is set the worker uses it for higher quota; without
 * it the public unauthenticated endpoint still works at lower limits.
 */

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface LighthouseSummary {
  performance: number;
  accessibility: number;
  best_practices: number;
  seo: number;
  top_recommendations: Array<{ id: string; title: string; description: string; impact: string }>;
  estimated_lcp_ms: number | null;
  estimated_cls: number | null;
  fetched_at: string;
}

function pickTopRecommendations(audits: Record<string, unknown>): LighthouseSummary["top_recommendations"] {
  const ranked: Array<{
    id: string;
    title: string;
    description: string;
    impact: string;
    weight: number;
  }> = [];

  for (const [id, raw] of Object.entries(audits)) {
    const audit = raw as Record<string, unknown>;
    const score = audit.score;
    if (typeof score !== "number" || score >= 0.9) continue;
    const title = audit.title as string | undefined;
    const description = audit.description as string | undefined;
    if (!title || !description) continue;
    const numericValue = (audit.numericValue as number | undefined) ?? 0;
    const impact = score < 0.5 ? "high" : score < 0.75 ? "medium" : "low";
    ranked.push({
      id,
      title,
      description: description.replace(/\[Learn more\][^)]+\)/gi, "").trim(),
      impact,
      weight: (1 - score) * (numericValue || 1),
    });
  }

  return ranked
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(({ weight: _w, ...rest }) => rest);
}

function buildOperatorSummary(s: LighthouseSummary, targetUrl: string): string {
  const parts: string[] = [];
  parts.push(`Lighthouse audit for ${targetUrl}.`);
  parts.push(`Performance ${s.performance}, Accessibility ${s.accessibility}, Best Practices ${s.best_practices}, SEO ${s.seo}.`);
  if (s.top_recommendations.length > 0) {
    const top = s.top_recommendations[0]!;
    parts.push(`Biggest win: ${top.title.toLowerCase()} (${top.impact} impact).`);
  }
  return parts.join(" ");
}

export const runLighthouseAudit = inngest.createFunction(
  {
    id: "run-lighthouse-audit",
    name: "Proof: run Lighthouse audit via PageSpeed Insights",
    retries: 1,
  },
  { event: "proof/lighthouse-requested" },
  async ({ event, step }) => {
    const { user_id, pitch_id, artifact_id, target_url } = event.data;
    const supabase = createServiceRoleClient();

    await step.run("mark-running", async () => {
      await supabase
        .from("proof_artifacts")
        .update({ status: "running" })
        .eq("id", artifact_id);
    });

    const summary = await step.run("call-psi", async () => {
      const url = new URL(PSI_ENDPOINT);
      url.searchParams.set("url", target_url);
      url.searchParams.set("strategy", "mobile");
      for (const cat of ["performance", "accessibility", "best-practices", "seo"]) {
        url.searchParams.append("category", cat);
      }
      if (process.env.PAGESPEED_API_KEY) {
        url.searchParams.set("key", process.env.PAGESPEED_API_KEY);
      }

      const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`PageSpeed Insights ${res.status}: ${errBody.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        lighthouseResult?: {
          categories?: Record<string, { score: number }>;
          audits?: Record<string, unknown>;
        };
      };

      const cats = json.lighthouseResult?.categories ?? {};
      const audits = json.lighthouseResult?.audits ?? {};

      const lcpAudit = audits["largest-contentful-paint"] as { numericValue?: number } | undefined;
      const clsAudit = audits["cumulative-layout-shift"] as { numericValue?: number } | undefined;

      const out: LighthouseSummary = {
        performance: Math.round((cats.performance?.score ?? 0) * 100),
        accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
        best_practices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
        seo: Math.round((cats.seo?.score ?? 0) * 100),
        top_recommendations: pickTopRecommendations(audits),
        estimated_lcp_ms: lcpAudit?.numericValue ?? null,
        estimated_cls: clsAudit?.numericValue ?? null,
        fetched_at: new Date().toISOString(),
      };
      return out;
    });

    await step.run("persist-result", async () => {
      const operatorSummary = buildOperatorSummary(summary, target_url);
      await supabase
        .from("proof_artifacts")
        .update({
          status: "complete",
          summary: operatorSummary,
          metadata: summary as unknown as never,
          generated_at: new Date().toISOString(),
        })
        .eq("id", artifact_id);

      await supabase.from("audit_log").insert({
        user_id,
        actor: "system",
        action: "proof.lighthouse.complete",
        resource_type: "proof_artifacts",
        resource_id: artifact_id,
        metadata: {
          pitch_id,
          target_url,
          performance: summary.performance,
        },
      });
    });

    return { artifact_id, performance: summary.performance };
  }
);
