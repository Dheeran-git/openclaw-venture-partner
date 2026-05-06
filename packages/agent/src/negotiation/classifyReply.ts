import { llm } from "../llm/client";
import { loadPrompt, renderPrompt } from "../llm/promptLoader";
import { ClassifyReplyOutput } from "./schema";

export interface ClassifyReplyInput {
  pitch: { subject: string | null; body: string };
  reply: { from: string; subject: string; body: string };
  profile: { display_name: string; skills: string[]; hourly_rate: number };
  userId: string;
}

export interface ClassifyReplyResult extends ClassifyReplyOutput {
  prompt_version: string;
}

export async function classifyReply(opts: ClassifyReplyInput): Promise<ClassifyReplyResult> {
  const { meta, body } = await loadPrompt("classify-reply");
  const prompt_version = `classify-reply@${meta.version}`;

  const prompt = renderPrompt(body, {
    pitch_json: opts.pitch,
    reply_json: opts.reply,
    profile_json: opts.profile,
  });

  const result = await llm.complete({
    user_id: opts.userId,
    purpose: "draft_reply",
    prompt,
    prompt_version,
    schema: ClassifyReplyOutput,
    model: meta.model,
    max_tokens: 256,
  });

  return { ...result, prompt_version };
}
