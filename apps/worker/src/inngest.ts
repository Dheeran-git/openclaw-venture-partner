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
};
