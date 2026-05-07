import { createServiceRoleClient } from "@openclaw/db";

import { inngest } from "../inngest";
import { makePublisher } from "../lib/broadcast";
import {
  runScoutPipeline,
  type PipelineStep,
} from "../lib/scoutPipeline";

/**
 * Inngest shell around runScoutPipeline. The pipeline owns all phase
 * logic (scrape / dedup / score / insert); this file just wires
 * Inngest's event + step into it. Keeping the shell thin makes the
 * pipeline directly runnable from the dryrun smoke without spinning
 * up the Inngest dev server.
 *
 * The PipelineStep adapter exists because Inngest types step.run as
 * returning `Promise<Jsonify<T>>` (since Inngest serializes step
 * output for replay). All our step outputs are already JSON-clean
 * (only string/number/null/array primitives in the returned shapes),
 * so the cast is structurally accurate; the assertion is needed only
 * because TS can't see that Jsonify<T> equals T for these specific
 * shapes.
 */
export const scout = inngest.createFunction(
  {
    id: "scout",
    name: "Scout: scrape -> dedup -> score -> insert",
    retries: 2,
  },
  { event: "scout/requested" },
  async ({ event, step }) => {
    const supabase = createServiceRoleClient();
    const publish = makePublisher(event.data.user_id);
    const adapted: PipelineStep = {
      run: async <T>(name: string, fn: () => Promise<T>): Promise<T> =>
        (await step.run(name, fn)) as unknown as T,
    };
    return runScoutPipeline(
      adapted,
      supabase,
      publish,
      {
        user_id: event.data.user_id,
        query: event.data.query,
        ...(event.data.limit !== undefined && { limit: event.data.limit }),
        ...(event.data.sources !== undefined && { sources: event.data.sources }),
      },
      async (ev) => {
        await inngest.send({
          name: ev.name,
          data: ev.data,
          ...(ev.id !== undefined && { id: ev.id }),
        });
      }
    );
  }
);
