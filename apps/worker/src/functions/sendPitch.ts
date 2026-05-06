import { Resend } from "resend";
import { createServiceRoleClient } from "@openclaw/db";
import { inngest } from "../inngest";

export const sendPitch = inngest.createFunction(
  {
    id: "send-pitch",
    name: "Pitch: send via Resend",
    retries: 2,
  },
  { event: "pitch/approved" },
  async ({ event, step }) => {
    const { pitch_id, user_id } = event.data;
    const supabase = createServiceRoleClient();

    const pitch = await step.run("load-pitch", async () => {
      const { data, error } = await supabase
        .from("pitches")
        .select("id, user_id, draft, subject, send_attempt_count")
        .eq("id", pitch_id)
        .single();
      if (error || !data) {
        throw new Error(`Pitch ${pitch_id} not found: ${error?.message}`);
      }
      return data;
    });

    await step.run("send-email", async () => {
      // Re-fetch count so retries see the incremented value, not the cached one.
      const { data: fresh } = await supabase
        .from("pitches")
        .select("send_attempt_count")
        .eq("id", pitch.id)
        .single();
      const currentCount = fresh?.send_attempt_count ?? 0;
      const newCount = currentCount + 1;
      const now = new Date().toISOString();

      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
        to: process.env.RESEND_TO_EMAIL ?? "delivered@resend.dev",
        subject: pitch.subject ?? "OpenClaw pitch",
        text: pitch.draft,
      });

      if (sendError) {
        await supabase
          .from("pitches")
          .update({
            send_attempt_count: newCount,
            last_send_error: sendError.message,
            ...(newCount >= 3 ? { status: "send_failed" as const } : {}),
          })
          .eq("id", pitch_id);

        if (newCount < 3) {
          throw new Error(`Resend error (attempt ${newCount}): ${sendError.message}`);
        }
        return { sent: false };
      }

      await supabase
        .from("pitches")
        .update({
          status: "sent",
          sent_at: now,
          send_attempt_count: newCount,
          last_send_error: null,
        })
        .eq("id", pitch_id);

      await supabase.from("audit_log").insert({
        user_id,
        actor: "system",
        action: "pitch.sent",
        resource_type: "pitches",
        resource_id: pitch_id,
        metadata: { attempt: newCount },
      });

      return { sent: true };
    });
  }
);
