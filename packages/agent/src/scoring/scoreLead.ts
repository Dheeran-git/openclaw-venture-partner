import type { ModelTier } from "../llm/types";
import { llm } from "../llm/client";
import { loadPrompt, renderPrompt } from "../llm/promptLoader";
import { ScoreLeadOutput } from "./schema";

export interface ScoringLead {
  source: string;
  source_url: string;
  title: string;
  description: string;
  budget_text: string | null;
  posted_at: string;
}

export interface ScoringProfile {
  display_name: string;
  skills: string[];
  hourly_rate: number;
  bio: string;
}

export interface ScoreLeadResult extends ScoreLeadOutput {
  /** Model tier requested for this scoring run, e.g. "balanced".
   *  The actual concrete model id is captured in llm_calls telemetry. */
  tier: ModelTier;
  /** prompt_version recorded in scores rows for traceability. */
  prompt_version: string;
}

export async function scoreLead(opts: {
  lead: ScoringLead;
  profile: ScoringProfile;
  userId: string;
}): Promise<ScoreLeadResult> {
  const { meta, body } = await loadPrompt("score-lead");
  const prompt_version = `score-lead@${meta.version}`;

  const prompt = renderPrompt(body, {
    profile_json: opts.profile,
    lead_json: opts.lead,
  });

  const result = await llm.complete({
    user_id: opts.userId,
    purpose: "score_lead",
    prompt,
    prompt_version,
    schema: ScoreLeadOutput,
    model: meta.model,
    max_tokens: 1024,
  });

  return { ...result, tier: meta.model, prompt_version };
}
