/**
 * Streaming variant of draftPitch. Returns the same final result as
 * `draftPitch()` but invokes `onPartialBody(text)` whenever the streamed
 * `body` field grows. The caller is responsible for persisting the partial
 * body wherever it wants — typically a `pitches.draft` UPDATE that fans
 * out to the UI via Supabase Realtime.
 *
 * If streaming isn't available (no streaming-capable provider healthy, or
 * the stream errors mid-flight), this throws a `LLMError` and the caller
 * should fall back to the non-streaming `draftPitch()`.
 */
import { llm } from "../llm/client";
import { loadPrompt, renderPrompt } from "../llm/promptLoader";
import { LLMError } from "../llm/types";
import { DraftPitchOutput } from "./schema";
import { extractPartialBody, stripJsonFence } from "./streaming";
import type { DraftingLead, DraftingProfile } from "./draftPitch";
import type { DraftPitchResult } from "./draftPitch";

const FLUSH_EVERY_N_CHUNKS = 5;

export interface StreamDraftPitchOpts {
  lead: DraftingLead;
  profile: DraftingProfile;
  userId: string;
  clientMemoryMd?: string;
  proofSummary?: string;
  onPartialBody: (partial: string) => Promise<void>;
}

export async function streamDraftPitch(
  opts: StreamDraftPitchOpts
): Promise<DraftPitchResult> {
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

  let accumulated = "";
  let chunkCount = 0;
  let lastWrittenLen = 0;

  for await (const piece of llm.stream({
    user_id: opts.userId,
    purpose: "draft_pitch",
    prompt,
    prompt_version,
    model: meta.model,
    max_tokens: 1024,
  })) {
    if (piece.chunk) accumulated += piece.chunk;
    chunkCount++;

    if (chunkCount % FLUSH_EVERY_N_CHUNKS === 0 || piece.done) {
      const partial = extractPartialBody(accumulated);
      if (partial && partial.length > lastWrittenLen) {
        lastWrittenLen = partial.length;
        await opts.onPartialBody(partial);
      }
    }
    if (piece.done) break;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(accumulated));
  } catch (err) {
    throw new LLMError(
      `streamed pitch was not valid JSON: ${(err as Error).message}`,
      "router"
    );
  }
  const validated = DraftPitchOutput.safeParse(parsed);
  if (!validated.success) {
    throw new LLMError(
      `streamed pitch failed schema validation: ${validated.error.message}`,
      "router"
    );
  }

  return { ...validated.data, prompt_version };
}
