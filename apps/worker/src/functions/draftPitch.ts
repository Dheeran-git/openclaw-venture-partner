import { createServiceRoleClient } from "@openclaw/db";
import { draftPitch as runDraftPitch, computePayloadHash } from "@openclaw/agent/drafting";
import type { DraftingLead, DraftingProfile } from "@openclaw/agent/drafting";

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

    const output = await step.run("call-llm", () =>
      runDraftPitch({
        lead: draftingLead,
        profile: draftingProfile,
        userId: user_id,
      })
    );

    const pitchId = await step.run("insert-pitch", async () => {
      // Generate the UUID client-side so we can compute payload_hash before
      // the row exists, avoiding a two-round-trip update.
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

      return id;
    });

    return { pitch_id: pitchId };
  }
);
