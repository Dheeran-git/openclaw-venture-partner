import { createHash } from "node:crypto";

/**
 * Canonical hash of a lead's source URL. Used as the `leads.hash`
 * unique key so the scout function can dedupe across runs without
 * pulling full row content. Hash is over the trimmed, lowercased URL
 * so trivial casing or whitespace drift in scrapers can't reintroduce
 * duplicates.
 */
export function leadHash(sourceUrl: string): string {
  return createHash("sha256")
    .update(sourceUrl.trim().toLowerCase())
    .digest("hex");
}
