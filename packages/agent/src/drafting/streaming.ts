/**
 * Helpers for streaming draftPitch's JSON output to the client a chunk
 * at a time. The LLM emits structured JSON like
 *
 *   { "subject": "...", "body": "...", "reasoning": "...", "confidence": "high" }
 *
 * but the user only cares about watching `body` fill in. extractPartialBody
 * walks the accumulated SSE text, finds the `body` field's opening quote,
 * and returns whatever's been written into it so far — JSON-escaped chars
 * decoded, dangling escape sequences truncated until the next chunk lands.
 */

const FIELD_OPEN_RE = /"body"\s*:\s*"/;

/**
 * Extract the `body` field from a partially streamed JSON response. Returns
 * the decoded body text so far, or null if the field hasn't started yet.
 *
 * Stops on the first unescaped closing `"`, which means the body field has
 * fully arrived. If the accumulator ends mid-escape (e.g. trailing "\"),
 * the partial escape is dropped and we wait for the next chunk.
 */
export function extractPartialBody(accumulated: string): string | null {
  const found = accumulated.match(FIELD_OPEN_RE);
  if (!found || found.index === undefined) return null;
  const start = found.index + found[0].length;

  let body = "";
  let i = start;
  while (i < accumulated.length) {
    const c = accumulated[i]!;
    if (c === "\\") {
      if (i + 1 >= accumulated.length) break; // dangling escape; wait
      const next = accumulated[i + 1]!;
      if (next === "n") body += "\n";
      else if (next === "t") body += "\t";
      else if (next === "r") body += "\r";
      else if (next === '"') body += '"';
      else if (next === "\\") body += "\\";
      else if (next === "/") body += "/";
      else body += next;
      i += 2;
      continue;
    }
    if (c === '"') break; // closing quote — body field complete
    body += c;
    i++;
  }
  return body;
}

/** Drop trailing whitespace + ```json fences models sometimes emit. */
export function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
  }
  return trimmed;
}
