import { createServiceRoleClient } from "@openclaw/db";
import {
  draftPitch as runDraftPitch,
  streamDraftPitch,
  computePayloadHash,
} from "@openclaw/agent/drafting";
import type { DraftingLead, DraftingProfile } from "@openclaw/agent/drafting";
import { handlers as mcpHandlers } from "@openclaw/agent/mcp-tools";

import { inngest } from "../inngest";

/**
 * Draft a pitch in three checkpointed Inngest steps:
 *
 *   1. insert-empty-pitch     — row exists with placeholder hash so the UI
 *                                can subscribe before any content arrives.
 *   2. stream-and-finalize    — call streamDraftPitch(); flush partial body
 *                                to pitches.draft via UPDATE so PitchCard's
 *                                Realtime hook renders chunks live. On
 *                                stream-unavailable, fall back to the
 *                                non-streaming runDraftPitch.
 *   3. notify-agent + insert-notification — fan-out to Telegram/Discord.
 *
 * Idempotency: pitch_id is generated upfront and persisted in step 1, so
 * Inngest replays of step 2 always update the same row. The chunked
 * UPDATEs are monotonically increasing — Realtime delivers the latest.
 */

export const draftPitch = inngest.createFunction(
  {
    id: "draft-pitch",
    name: "Pitch: draft + payload_hash + insert",
    retries: 2,
  },
  { event: "pitch/draft-requested" },
  async ({ event, step }) => {
    const { user_id, lead_id } = event.data;
    const supabase = createServiceRoleClient();

    const { lead, profile } = await step.run("load-context", async () => {
      const [leadRes, profileRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, normalized, source_id, layer, scraped_at")
          .eq("id", lead_id)
          .single(),
        supabase
          .from("profiles")
          .select(
            "display_name, skills, hourly_rate, bio, portfolio_urls, past_clients, availability, timezone"
          )
          .eq("id", user_id)
          .single(),
      ]);

      if (leadRes.error || !leadRes.data) {
        throw new Error(`Lead ${lead_id} not found: ${leadRes.error?.message}`);
      }
      if (profileRes.error || !profileRes.data) {
        throw new Error(`Profile ${user_id} not found: ${profileRes.error?.message}`);
      }

      return { lead: leadRes.data, profile: profileRes.data };
    });

    const normalized = lead.normalized as Record<string, unknown>;

    const draftingLead: DraftingLead = {
      source: (normalized.source as string) ?? "unknown",
      source_url: (normalized.source_url as string) ?? "",
      title: (normalized.title as string) ?? "",
      description: (normalized.description as string) ?? "",
      budget_text: (normalized.budget_text as string | null) ?? null,
      posted_at: (normalized.posted_at as string) ?? lead.scraped_at,
    };

    const draftingProfile: DraftingProfile = {
      display_name: profile.display_name ?? "",
      skills: Array.isArray(profile.skills) ? (profile.skills as string[]) : [],
      hourly_rate: profile.hourly_rate ?? 0,
      bio: profile.bio ?? "",
      portfolio_urls: Array.isArray(profile.portfolio_urls) ? (profile.portfolio_urls as string[]) : [],
      past_clients: Array.isArray(profile.past_clients) ? profile.past_clients : [],
      availability: profile.availability ?? null,
      timezone: profile.timezone ?? null,
    };

    const proofSummary = await step.run("load-proof-context", async () => {
      const { data: pitches } = await supabase
        .from("pitches")
        .select("id")
        .eq("lead_id", lead_id)
        .eq("user_id", user_id);
      const pitchIds = (pitches ?? []).map((p) => p.id);
      if (pitchIds.length === 0) return null;

      const { data: proofs } = await supabase
        .from("proof_artifacts")
        .select("summary, metadata")
        .in("pitch_id", pitchIds)
        .eq("status", "complete")
        .eq("artifact_type", "lighthouse")
        .order("generated_at", { ascending: false })
        .limit(1);
      const proof = proofs?.[0];
      if (!proof?.summary) return null;

      const meta = proof.metadata as
        | { performance?: number; top_recommendations?: Array<{ title: string }> }
        | null;
      const topTitles = (meta?.top_recommendations ?? [])
        .slice(0, 2)
        .map((r) => r.title)
        .filter(Boolean);
      const tail = topTitles.length > 0 ? ` Top issues to mention: ${topTitles.join("; ")}.` : "";
      return `${proof.summary}${tail}`;
    });

    // ── Step 1: insert empty pitch row ────────────────────────────────────
    const pitch_id = await step.run("insert-empty-pitch", async () => {
      const id = crypto.randomUUID();
      const placeholderHash = computePayloadHash({
        id,
        subject: "",
        draft: "",
      });
      const { error } = await supabase.from("pitches").insert({
        id,
        lead_id,
        user_id,
        draft: "",
        subject: "",
        status: "draft",
        payload_hash: placeholderHash,
        expected_signal: { reasoning: "", confidence: "medium" },
      });
      if (error) {
        throw new Error(`Failed to insert empty pitch: ${error.message}`);
      }
      return id;
    });

    // ── Step 2: stream + finalize ──────────────────────────────────────────
    const finalized = await step.run("stream-and-finalize", async () => {
      let result: { subject: string; body: string; reasoning: string; confidence: "high" | "medium" | "low" };
      try {
        result = await streamDraftPitch({
          lead: draftingLead,
          profile: draftingProfile,
          userId: user_id,
          ...(proofSummary !== null ? { proofSummary } : {}),
          onPartialBody: async (partial) => {
            const liveHash = computePayloadHash({
              id: pitch_id,
              subject: "",
              draft: partial,
            });
            await supabase
              .from("pitches")
              .update({ draft: partial, payload_hash: liveHash })
              .eq("id", pitch_id);
          },
        });
      } catch (streamErr) {
        // Streaming unavailable / failed mid-flight — fall back to the
        // structured non-streaming path. UX degrades to current behavior.
        console.warn(
          "[draftPitch] stream failed, falling back to complete():",
          (streamErr as Error).message
        );
        result = await runDraftPitch({
          lead: draftingLead,
          profile: draftingProfile,
          userId: user_id,
          ...(proofSummary !== null ? { proofSummary } : {}),
        });
      }

      const finalHash = computePayloadHash({
        id: pitch_id,
        subject: result.subject,
        draft: result.body,
      });
      const { error: updErr } = await supabase
        .from("pitches")
        .update({
          subject: result.subject,
          draft: result.body,
          payload_hash: finalHash,
          expected_signal: {
            reasoning: result.reasoning,
            confidence: result.confidence,
          },
        })
        .eq("id", pitch_id);
      if (updErr) {
        throw new Error(`Failed to finalize pitch: ${updErr.message}`);
      }
      return {
        subject: result.subject,
        body: result.body,
        payload_hash: finalHash,
      };
    });

    await step.run("notify-agent", async () => {
      await mcpHandlers.notifyAgent!({
        user_id,
        kind: "pitch_drafted",
        payload: {
          pitch_id,
          payload_hash: finalized.payload_hash,
          subject: finalized.subject,
          body: finalized.body,
        },
      });
    });

    await step.run("insert-notification", async () => {
      await supabase.from("notifications").insert({
        user_id,
        kind: "pitch_drafted",
        title: "Pitch ready for review",
        body: finalized.subject,
        resource_type: "pitches",
        resource_id: pitch_id,
        href: `/?lead=${lead_id}`,
      });
    });

    return { pitch_id };
  }
);
