import { llm } from "../llm/client";
import { loadPrompt, renderPrompt } from "../llm/promptLoader";
import { DraftPitchOutput } from "./schema";

export interface DraftingLead {
  source: string;
  source_url: string;
  title: string;
  description: string;
  budget_text: string | null;
  posted_at: string;
}

export interface DraftingProfile {
  display_name: string;
  skills: string[];
  hourly_rate: number;
  bio: string;
  portfolio_urls: string[];
  past_clients: unknown[];
  availability: string | null;
  timezone: string | null;
}

export interface DraftPitchResult extends DraftPitchOutput {
  prompt_version: string;
}

export async function draftPitch(opts: {
  lead: DraftingLead;
  profile: DraftingProfile;
  userId: string;
  /** Markdown from clients.memory_md. Pass undefined if no prior relationship. */
  clientMemoryMd?: string;
  /** One-line summary of any completed proof artifact (e.g., Lighthouse audit). */
  proofSummary?: string;
}): Promise<DraftPitchResult> {
  const { meta, body } = await loadPrompt("draft-pitch");
  const prompt_version = `draft-pitch@${meta.version}`;

  const clientContext = opts.clientMemoryMd
    ? `# Client context (prior interactions)\n\n${opts.clientMemoryMd}`
    : "";

  const proofContext = opts.proofSummary
    ? `# Proof of value (already prepared — body MUST reference it concretely)\n\n${opts.proofSummary}`
    : "";

  const prompt = renderPrompt(body, {
    profile_json: opts.profile,
    lead_json: opts.lead,
    client_context: clientContext,
    proof_context: proofContext,
  });

  const result = await llm.complete({
    user_id: opts.userId,
    purpose: "draft_pitch",
    prompt,
    prompt_version,
    schema: DraftPitchOutput,
    model: meta.model,
    max_tokens: 1024,
  });

  return { ...result, prompt_version };
}
