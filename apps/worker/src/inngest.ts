import { Inngest } from "inngest";

/**
 * The single Inngest client for the project. Both apps/web (the
 * serve handler) and apps/worker (the function definitions) import
 * from here so id-collisions can't happen.
 */
export const inngest = new Inngest({
  id: "openclaw",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/** Event payload map. Extend as new events land. */
export type Events = {
  "system/healthcheck": {
    data: { ping?: string };
  };
  "scout/requested": {
    data: { user_id: string; query: string; limit?: number };
  };
  "lead/scored": {
    data: { lead_id: string; score: number };
  };
  "pitch/draft-requested": {
    data: { user_id: string; lead_id: string };
  };
  "pitch/approved": {
    data: { pitch_id: string; user_id: string };
  };
  "proof/lighthouse-requested": {
    data: { user_id: string; pitch_id: string; artifact_id: string; target_url: string };
  };
  "email/reply-received": {
    data: { reply_id: string; user_id: string; pitch_id: string };
  };
  "reply/approved": {
    data: { reply_id: string; user_id: string };
  };
  "client/upsell-scan": {
    data: Record<string, never>;
  };
};
