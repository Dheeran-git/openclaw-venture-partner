import { llm } from "../llm/client";
import { loadPrompt, renderPrompt } from "../llm/promptLoader";
import { DraftReplyOutput, type ClassifyReplyOutput } from "./schema";

export interface DraftReplyInput {
  pitch: { subject: string | null; body: string };
  reply: { from: string; subject: string; body: string };
  classification: ClassifyReplyOutput;
  profile: { display_name: string; skills: string[]; hourly_rate: number; bio: string };
  history: string;        // formatted "From: ... \n Body: ..." blocks oldest→newest
  memoryMd: string;       // empty string for no memory
  userId: string;
}

export interface DraftReplyResult extends DraftReplyOutput {
  prompt_version: string;
}

export async function draftReply(opts: DraftReplyInput): Promise<DraftReplyResult> {
  const { meta, body } = await loadPrompt("draft-reply");
  const prompt_version = `draft-reply@${meta.version}`;

  const prompt = renderPrompt(body, {
    pitch_json: opts.pitch,
    reply_json: opts.reply,
    classification_json: opts.classification,
    profile_json: opts.profile,
    history: opts.history,
    memory_md: opts.memoryMd,
  });

  const result = await llm.complete({
    user_id: opts.userId,
    purpose: "draft_reply",
    prompt,
    prompt_version,
    schema: DraftReplyOutput,
    model: meta.model,
    max_tokens: 1500,
  });

  return { ...result, prompt_version };
}
