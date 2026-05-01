import {
  LLMError,
  MODEL_MAP,
  type ProviderAdapter,
  type ProviderRequest,
  type LLMRawResponse,
} from "../types";

/**
 * GitHub Copilot chat-completions adapter.
 *
 * Uses the dummy GitHub OAuth token from $COPILOT_TOKEN. The endpoint is
 * OpenAI-compatible but requires Copilot-specific headers. CLAUDE.md
 * acknowledges this is a ToS-questionable workaround for the hackathon
 * only -- production must use Anthropic direct.
 *
 * Token plug-in is deferred: the adapter ships shape-complete in Phase 1
 * and starts working as soon as COPILOT_TOKEN is set in .env.
 */
const ENDPOINT = "https://api.githubcopilot.com/chat/completions";

export const copilotProvider: ProviderAdapter = {
  name: "copilot",

  isConfigured() {
    return !!process.env.COPILOT_TOKEN;
  },

  async complete(req: ProviderRequest): Promise<LLMRawResponse> {
    const token = process.env.COPILOT_TOKEN;
    if (!token) throw new LLMError("COPILOT_TOKEN missing", "copilot");

    const model = MODEL_MAP.copilot[req.tier];
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: req.prompt }],
      temperature: req.temperature ?? 0.2,
      stream: false,
    };
    if (req.max_tokens) body.max_tokens = req.max_tokens;
    if (req.json) body.response_format = { type: "json_object" };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Editor-Version": "vscode/1.95.0",
        "Editor-Plugin-Version": "copilot-chat/0.22.0",
        "Copilot-Integration-Id": "vscode-chat",
        "User-Agent": "GitHubCopilotChat/0.22.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new LLMError(
        `copilot ${res.status}: ${text.slice(0, 400)}`,
        "copilot"
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new LLMError("copilot empty response", "copilot");

    return {
      text,
      model: data.model ?? model,
      input_tokens: data.usage?.prompt_tokens,
      output_tokens: data.usage?.completion_tokens,
    };
  },
};
