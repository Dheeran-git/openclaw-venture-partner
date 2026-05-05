import { createHash } from "node:crypto";

export function computePayloadHash(opts: {
  id: string;
  subject: string;
  draft: string;
}): string {
  const canonical = JSON.stringify({
    id: opts.id,
    subject: opts.subject,
    draft: opts.draft,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
