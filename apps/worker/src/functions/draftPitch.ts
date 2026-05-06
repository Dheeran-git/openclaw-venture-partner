import { createServiceRoleClient } from "@openclaw/db";
import { draftPitch as runDraftPitch, computePayloadHash } from "@openclaw/agent/drafting";
import type { DraftingLead, DraftingProfile } from "@openclaw/agent/drafting";
import { handlers as mcpHandlers } from "@openclaw/agent/mcp-tools";

import { inngest } from "../inngest";

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

    const output = await step.run("call-llm", () =>
      runDraftPitch({
        lead: draftingLead,
        profile: draftingProfile,
        userId: user_id,
        ...(proofSummary !== null ? { proofSummary } : {}),
      })
    );

    const inserted = await step.run("insert-pitch", async () => {
      const id = crypto.randomUUID();
      const payload_hash = computePayloadHash({
        id,
        subject: output.subject,
        draft: output.body,
      });

      const { error } = await supabase
        .from("pitches")
        .insert({
          id,
          lead_id,
          user_id,
          draft: output.body,
          subject: output.subject,
          status: "draft",
          payload_hash,
          expected_signal: {
            reasoning: output.reasoning,
            confidence: output.confidence,
          },
        });

      if (error) {
        throw new Error(`Failed to insert pitch: ${error.message}`);
      }

      return { pitch_id: id, payload_hash };
    });

    await step.run("notify-agent", async () => {
      await mcpHandlers.notifyAgent!({
        user_id,
        kind: "pitch_drafted",
        payload: {
          pitch_id: inserted.pitch_id,
          payload_hash: inserted.payload_hash,
          subject: output.subject,
          body: output.body,
        },
      });
    });

    await step.run("insert-notification", async () => {
      await supabase.from("notifications").insert({
        user_id,
        kind: "pitch_drafted",
        title: "Pitch ready for review",
        body: output.subject,
        resource_type: "pitches",
        resource_id: inserted.pitch_id,
        href: `/?lead=${lead_id}`,
      });
    });

    return { pitch_id: inserted.pitch_id };
  }
);
