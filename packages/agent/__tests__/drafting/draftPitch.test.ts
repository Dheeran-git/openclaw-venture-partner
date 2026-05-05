import { describe, it, expect, vi, beforeEach } from "vitest";
import { DraftPitchOutput } from "../../src/drafting/schema";

// Mock the LLM client before importing draftPitch so the import resolves to the mock.
vi.mock("../../src/llm/client", () => ({
  llm: {
    complete: vi.fn(),
  },
}));

// Mock the prompt loader to avoid real filesystem reads in unit tests.
vi.mock("../../src/llm/promptLoader", () => ({
  loadPrompt: vi.fn().mockResolvedValue({
    meta: { version: "v1", model: "balanced", schema: "DraftPitchOutput" },
    body: "You are a pitch drafter. Profile: {{profile_json}} Lead: {{lead_json}} {{client_context}}",
  }),
  renderPrompt: (body: string, vars: Record<string, unknown>) =>
    body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_: string, key: string) => {
      const value = vars[key];
      return typeof value === "string" ? value : JSON.stringify(value);
    }),
}));

const VALID_OUTPUT: DraftPitchOutput = {
  subject: "Next.js dashboard — shipped one for SaaS analytics",
  body: "Hi — rebuilt a similar stack last month for a B2B analytics product. Here is the case study: https://example.com/case. Are you available for a 20-minute call this week?",
  reasoning: "Strong stack match. Lead asked for a dashboard example so I opened with one.",
  confidence: "high",
};

const PROFILE = {
  display_name: "Anya Petrov",
  skills: ["React", "Next.js", "TypeScript"],
  hourly_rate: 120,
  bio: "I build dashboards.",
  portfolio_urls: ["https://anya.dev"],
  past_clients: [],
  availability: "part-time",
  timezone: "UTC",
};

const LEAD = {
  source: "upwork",
  source_url: "https://www.upwork.com/jobs/~01",
  title: "Senior Next.js engineer for SaaS dashboard rebuild",
  description: "Rebuilding analytics dashboard. Stack: Next.js 14, Supabase.",
  budget_text: "$5,500 fixed",
  posted_at: "2026-05-01T10:00:00Z",
};

describe("draftPitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid DraftPitchOutput with prompt_version", async () => {
    const { llm } = await import("../../src/llm/client");
    vi.mocked(llm.complete).mockResolvedValue(VALID_OUTPUT);

    const { draftPitch } = await import("../../src/drafting/draftPitch");
    const result = await draftPitch({ lead: LEAD, profile: PROFILE, userId: "user-123" });

    expect(result.subject).toBe(VALID_OUTPUT.subject);
    expect(result.body).toBe(VALID_OUTPUT.body);
    expect(result.reasoning).toBe(VALID_OUTPUT.reasoning);
    expect(result.confidence).toBe("high");
    expect(result.prompt_version).toBe("draft-pitch@v1");
  });

  it("passes DraftPitchOutput schema to llm.complete", async () => {
    const { llm } = await import("../../src/llm/client");
    vi.mocked(llm.complete).mockResolvedValue(VALID_OUTPUT);

    const { draftPitch } = await import("../../src/drafting/draftPitch");
    await draftPitch({ lead: LEAD, profile: PROFILE, userId: "user-123" });

    expect(vi.mocked(llm.complete)).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "draft_pitch",
        schema: DraftPitchOutput,
        user_id: "user-123",
      })
    );
  });

  it("includes client context in prompt when clientMemoryMd is provided", async () => {
    const { llm } = await import("../../src/llm/client");
    vi.mocked(llm.complete).mockResolvedValue(VALID_OUTPUT);

    const { draftPitch } = await import("../../src/drafting/draftPitch");
    await draftPitch({
      lead: LEAD,
      profile: PROFILE,
      userId: "user-123",
      clientMemoryMd: "# Prior interactions\nSent pitch 2026-04-01, no reply.",
    });

    const callArg = vi.mocked(llm.complete).mock.calls[0]?.[0];
    expect(callArg?.prompt).toContain("# Client context (prior interactions)");
    expect(callArg?.prompt).toContain("Prior interactions");
  });

  it("omits client context section when clientMemoryMd is undefined", async () => {
    const { llm } = await import("../../src/llm/client");
    vi.mocked(llm.complete).mockResolvedValue(VALID_OUTPUT);

    const { draftPitch } = await import("../../src/drafting/draftPitch");
    await draftPitch({ lead: LEAD, profile: PROFILE, userId: "user-123" });

    const callArg = vi.mocked(llm.complete).mock.calls[0]?.[0];
    expect(callArg?.prompt).not.toContain("# Client context");
  });
});
