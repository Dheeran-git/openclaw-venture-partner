import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClassifyReplyOutput } from "../../src/negotiation/schema";

vi.mock("../../src/llm/client", () => ({
  llm: { complete: vi.fn() },
}));

vi.mock("../../src/llm/promptLoader", () => ({
  loadPrompt: vi.fn().mockResolvedValue({
    meta: { version: "v1", model: "fast", schema: "ClassifyReplyOutput" },
    body: "Pitch: {{pitch_json}} Reply: {{reply_json}} Profile: {{profile_json}}",
  }),
  renderPrompt: (body: string, vars: Record<string, unknown>) =>
    body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_: string, key: string) => {
      const v = vars[key];
      return typeof v === "string" ? v : JSON.stringify(v);
    }),
}));

const VALID: ClassifyReplyOutput = {
  classification: "question",
  confidence: "high",
  reasoning: "Asked two scoping questions before agreeing to a call.",
  suggested_action: "Reply with portfolio link and pricing model.",
};

const PITCH = { subject: "Re: Next.js dashboard", body: "Hi — would Tuesday work?" };
const REPLY = { from: "alex@example.com", subject: "Re: Next.js", body: "Can you share the case study and your pricing?" };
const PROFILE = { display_name: "Anya", skills: ["Next.js"], hourly_rate: 120 };

describe("classifyReply", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ClassifyReplyOutput with prompt_version", async () => {
    const { llm } = await import("../../src/llm/client");
    vi.mocked(llm.complete).mockResolvedValue(VALID);

    const { classifyReply } = await import("../../src/negotiation/classifyReply");
    const result = await classifyReply({
      pitch: PITCH,
      reply: REPLY,
      profile: PROFILE,
      userId: "user-1",
    });

    expect(result.classification).toBe("question");
    expect(result.confidence).toBe("high");
    expect(result.prompt_version).toBe("classify-reply@v1");
  });

  it("passes ClassifyReplyOutput schema and purpose=draft_reply to llm.complete", async () => {
    const { llm } = await import("../../src/llm/client");
    vi.mocked(llm.complete).mockResolvedValue(VALID);

    const { classifyReply } = await import("../../src/negotiation/classifyReply");
    await classifyReply({ pitch: PITCH, reply: REPLY, profile: PROFILE, userId: "user-1" });

    expect(vi.mocked(llm.complete)).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "draft_reply",
        schema: ClassifyReplyOutput,
        user_id: "user-1",
      })
    );
  });

  it("schema rejects unknown classification values", () => {
    const result = ClassifyReplyOutput.safeParse({ ...VALID, classification: "spam" });
    expect(result.success).toBe(false);
  });

  it("schema accepts all four valid classifications", () => {
    for (const cls of ["positive", "negative", "question", "unsubscribe"] as const) {
      const result = ClassifyReplyOutput.safeParse({ ...VALID, classification: cls });
      expect(result.success).toBe(true);
    }
  });
});
