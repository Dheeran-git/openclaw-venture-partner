import { LLMError, type ProviderName, type StreamChunk } from "./types";

/**
 * Generic OpenAI-compatible SSE chunk reader. Both OpenRouter and Groq emit
 * the same Server-Sent Event shape; consumers `for await` the chunks and we
 * yield {chunk, done}. The final iteration always has done=true.
 */
export async function* sseStream(
  body: ReadableStream<Uint8Array>,
  provider: ProviderName
): AsyncIterable<StreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by blank lines.
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";

      for (const event of events) {
        const dataLine = event
          .split(/\r?\n/)
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload || payload === "[DONE]") {
          if (payload === "[DONE]") {
            yield { chunk: "", done: true };
            return;
          }
          continue;
        }
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const piece = json.choices?.[0]?.delta?.content;
          if (piece) yield { chunk: piece, done: false };
        } catch (err) {
          throw new LLMError(
            `${provider} SSE parse error: ${(err as Error).message}`,
            provider
          );
        }
      }
    }

    // Stream ended without an explicit [DONE] — emit terminator.
    yield { chunk: "", done: true };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}
