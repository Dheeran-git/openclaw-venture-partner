import { createServiceRoleClient } from "@openclaw/db";
import {
  classifyReply as runClassifyReply,
  draftReply as runDraftReply,
} from "@openclaw/agent/negotiation";

import { inngest } from "../inngest";

/**
 * Phase 5 — process an inbound email reply: classify it, optionally
 * promote the lead to a client (positive case), then draft 3 reply
 * options for operator approval (positive/question cases).
 *
 * Triggered by email/reply-received fired from /api/email/inbound or
 * /api/email/simulate.
 */
export const processInboundReply = inngest.createFunction(
  {
    id: "process-inbound-reply",
    name: "Reply: classify + (maybe) draft 3 options",
    retries: 1,
  },
  { event: "email/reply-received" },
  async ({ event, step }) => {
    const { reply_id, user_id, pitch_id } = event.data;
    const supabase = createServiceRoleClient();

    // ── Load reply + pitch + profile in parallel ─────────────────────────
    const ctx = await step.run("load-context", async () => {
      const [replyRes, pitchRes, profileRes] = await Promise.all([
        supabase
          .from("email_replies")
          .select("id, user_id, pitch_id, from_email, subject, body_text, status")
          .eq("id", reply_id)
          .single(),
        supabase
          .from("pitches")
          .select("id, user_id, lead_id, subject, draft")
          .eq("id", pitch_id)
          .single(),
        supabase
          .from("profiles")
          .select("display_name, skills, hourly_rate, bio")
          .eq("id", user_id)
          .single(),
      ]);
      if (replyRes.error || !replyRes.data) {
        throw new Error(`Reply ${reply_id} not found: ${replyRes.error?.message}`);
      }
      if (pitchRes.error || !pitchRes.data) {
        throw new Error(`Pitch ${pitch_id} not found: ${pitchRes.error?.message}`);
      }
      if (profileRes.error || !profileRes.data) {
        throw new Error(`Profile ${user_id} not found: ${profileRes.error?.message}`);
      }
      return { reply: replyRes.data, pitch: pitchRes.data, profile: profileRes.data };
    });

    if (ctx.reply.status !== "pending") {
      // already processed (replay-safe)
      return { skipped: ctx.reply.status };
    }

    const profile = {
      display_name: ctx.profile.display_name ?? "",
      skills: Array.isArray(ctx.profile.skills) ? (ctx.profile.skills as string[]) : [],
      hourly_rate: ctx.profile.hourly_rate ?? 0,
      bio: ctx.profile.bio ?? "",
    };

    // ── 1. Classify ──────────────────────────────────────────────────────
    const classification = await step.run("classify", () =>
      runClassifyReply({
        pitch: { subject: ctx.pitch.subject, body: ctx.pitch.draft },
        reply: {
          from: ctx.reply.from_email,
          subject: ctx.reply.subject ?? "",
          body: ctx.reply.body_text,
        },
        profile,
        userId: user_id,
      })
    );

    await step.run("persist-classification", async () => {
      await supabase
        .from("email_replies")
        .update({
          classification: classification.classification,
          classification_confidence: classification.confidence,
          classification_reasoning: classification.reasoning,
          classification_suggested_action: classification.suggested_action,
          status: "classified",
        })
        .eq("id", reply_id);
    });

    // ── 2. Unsubscribe → halt ────────────────────────────────────────────
    if (classification.classification === "unsubscribe") {
      await step.run("mark-unsubscribed", async () => {
        await supabase
          .from("email_replies")
          .update({ status: "unsubscribed" })
          .eq("id", reply_id);
        await supabase.from("audit_log").insert({
          user_id,
          actor: "system",
          action: "reply.unsubscribed",
          resource_type: "email_replies",
          resource_id: reply_id,
          metadata: { from_email: ctx.reply.from_email },
        });
      });
      return { classification: "unsubscribe" };
    }

    // ── 3. Negative → log, no draft ──────────────────────────────────────
    if (classification.classification === "negative") {
      await step.run("audit-negative", async () => {
        await supabase.from("audit_log").insert({
          user_id,
          actor: "system",
          action: "reply.classified.negative",
          resource_type: "email_replies",
          resource_id: reply_id,
          metadata: { confidence: classification.confidence },
        });
      });
      return { classification: "negative" };
    }

    // ── 4. Positive → promote lead to client (if not already one) ────────
    let clientId: string | null = null;
    if (classification.classification === "positive") {
      clientId = await step.run("promote-lead-to-client", async () => {
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id, memory_md")
          .eq("source_lead_id", ctx.pitch.lead_id)
          .eq("user_id", user_id)
          .maybeSingle();

        if (existingClient) return existingClient.id;

        const initialMemory = `# Project Memory

## Project History
- ${new Date().toISOString().slice(0, 10)} — Initial pitch sent. Subject: ${ctx.pitch.subject ?? "(no subject)"}.
- ${new Date().toISOString().slice(0, 10)} — Reply received from ${ctx.reply.from_email}. Classified as positive: ${classification.reasoning}

## Negotiation Notes
- (none yet)

## Open Questions
- (none yet)

## Next Action
- ${classification.suggested_action}
`;

        const { data: created, error: createErr } = await supabase
          .from("clients")
          .insert({
            user_id,
            company_name: ctx.reply.from_email.split("@")[1] ?? "Unnamed client",
            contact_email: ctx.reply.from_email,
            source_lead_id: ctx.pitch.lead_id,
            status: "active",
            memory_md: initialMemory,
          })
          .select("id")
          .single();

        if (createErr || !created) {
          throw new Error(`Failed to create client: ${createErr?.message}`);
        }

        await supabase
          .from("email_replies")
          .update({ client_id: created.id })
          .eq("id", reply_id);

        return created.id;
      });
    }

    // ── 5. Draft 3 reply options ─────────────────────────────────────────
    // Load memory_md if a client exists for context
    const memoryMd = await step.run("load-memory", async () => {
      if (!clientId) return "";
      const { data } = await supabase
        .from("clients")
        .select("memory_md")
        .eq("id", clientId)
        .single();
      return data?.memory_md ?? "";
    });

    const drafted = await step.run("draft-reply-options", () =>
      runDraftReply({
        pitch: { subject: ctx.pitch.subject, body: ctx.pitch.draft },
        reply: {
          from: ctx.reply.from_email,
          subject: ctx.reply.subject ?? "",
          body: ctx.reply.body_text,
        },
        classification,
        profile: { ...profile, bio: profile.bio },
        history: `From: ${profile.display_name}\nSubject: ${ctx.pitch.subject ?? ""}\nBody: ${ctx.pitch.draft}\n\n---\n\nFrom: ${ctx.reply.from_email}\nSubject: ${ctx.reply.subject ?? ""}\nBody: ${ctx.reply.body_text}`,
        memoryMd,
        userId: user_id,
      })
    );

    await step.run("persist-drafted-options", async () => {
      await supabase
        .from("email_replies")
        .update({
          drafted_subject: drafted.subject,
          drafted_options: drafted.options as unknown as never,
          drafted_reasoning: drafted.reasoning,
          status: "drafted",
        })
        .eq("id", reply_id);
    });

    await step.run("insert-notification", async () => {
      await supabase.from("notifications").insert({
        user_id,
        kind: "reply_received",
        title: `Reply from ${ctx.reply.from_email}`,
        body: classification.suggested_action,
        resource_type: "email_replies",
        resource_id: reply_id,
        href: clientId ? `/clients/${clientId}` : "/clients",
      });
    });

    return {
      classification: classification.classification,
      drafted_options: drafted.options.length,
      client_id: clientId,
    };
  }
);
