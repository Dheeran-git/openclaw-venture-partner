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

export async function scoreLead(opts: {
  lead: ScoringLead;
  profile: ScoringProfile;
  userId: string;
}): Promise<ScoreLeadOutput> {
  const { meta, body } = await loadPrompt("score-lead");

  const prompt = renderPrompt(body, {
    profile_json: opts.profile,
    lead_json: opts.lead,
  });

  return llm.complete({
    user_id: opts.userId,
    purpose: "score_lead",
    prompt,
    prompt_version: `score-lead@${meta.version}`,
    schema: ScoreLeadOutput,
    model: meta.model,
    max_tokens: 1024,
  });
}
