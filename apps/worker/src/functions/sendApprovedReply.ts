import { Resend } from "resend";
import { createServiceRoleClient } from "@openclaw/db";

import { inngest } from "../inngest";

/**
 * Phase 5 — sends an operator-approved reply via Resend, then appends
 * a one-line entry to the linked client's memory_md so the next
 * draft round has context.
 *
 * Triggered by reply/approved fired from /api/replies/[id]/approve.
 */
export const sendApprovedReply = inngest.createFunction(
  {
    id: "send-approved-reply",
    name: "Reply: send via Resend + append client memory",
    retries: 2,
  },
  { event: "reply/approved" },
  async ({ event, step }) => {
    const { reply_id, user_id } = event.data;
    const supabase = createServiceRoleClient();

    const reply = await step.run("load-reply", async () => {
      const { data, error } = await supabase
        .from("email_replies")
        .select(
          "id, user_id, pitch_id, client_id, from_email, subject, drafted_subject, approved_body, status"
        )
        .eq("id", reply_id)
        .single();
      if (error || !data) {
        throw new Error(`Reply ${reply_id} not found: ${error?.message}`);
      }
      return data;
    });

    if (reply.status !== "approved") {
      return { skipped: reply.status };
    }
    if (!reply.approved_body) {
      throw new Error("Reply has no approved_body");
    }

    await step.run("send-email", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
        to: process.env.RESEND_TO_EMAIL ?? reply.from_email,
        subject: reply.drafted_subject ?? reply.subject ?? "Re:",
        text: reply.approved_body!,
      });
      if (sendError) {
        await supabase
          .from("email_replies")
          .update({ status: "failed", send_error: sendError.message })
          .eq("id", reply_id);
        throw new Error(`Resend error: ${sendError.message}`);
      }

      await supabase
        .from("email_replies")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          send_error: null,
        })
        .eq("id", reply_id);
    });

    await step.run("append-client-memory", async () => {
      if (!reply.client_id) return;
      const { data: client } = await supabase
        .from("clients")
        .select("memory_md")
        .eq("id", reply.client_id)
        .single();
      const today = new Date().toISOString().slice(0, 10);
      const summary = (reply.approved_body ?? "").slice(0, 100).replace(/\s+/g, " ");
      const newLine = `\n- ${today} — Sent reply to ${reply.from_email}: "${summary}${(reply.approved_body ?? "").length > 100 ? "..." : ""}"`;
      const updated = (client?.memory_md ?? "").includes("## Project History")
        ? (client?.memory_md ?? "").replace("## Project History", `## Project History${newLine}`)
        : `${client?.memory_md ?? ""}${newLine}`;

      await supabase
        .from("clients")
        .update({ memory_md: updated })
        .eq("id", reply.client_id);
    });

    await step.run("audit", async () => {
      await supabase.from("audit_log").insert({
        user_id,
        actor: "system",
        action: "reply.sent",
        resource_type: "email_replies",
        resource_id: reply_id,
        metadata: { client_id: reply.client_id, from_email: reply.from_email },
      });
    });

    return { sent: true };
  }
);
