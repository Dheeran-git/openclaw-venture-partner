import { serve } from "inngest/next";
import { inngest, functions } from "@openclaw/worker";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
