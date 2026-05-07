import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScoreLeadOutput } from "../../src/scoring/schema";

// Mocks must be declared before importing the SUT so the import resolves to the mock.
vi.mock("../../src/llm/client", () => ({
  llm: {
    complete: vi.fn(),
  },
}));

vi.mock("../../src/llm/promptLoader", () => ({
  loadPrompt: vi.fn().mockResolvedValue({
    meta: { version: "v1", model: "balanced", schema: "ScoreLeadOutput" },
    body: "Score this lead. profile={{profile_json}} lead={{lead_json}}",
  }),
  renderPrompt: (body: string, vars: Record<string, unknown>) =>
    body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const v = vars[key];
      return typeof v === "string" ? v : JSON.stringify(v);
    }),
}));

import { scoreLead } from "../../src/scoring/scoreLead";
import { llm } from "../../src/llm/client";
import { BudgetExceededError } from "../../src/llm/budget";

const VALID_OUTPUT: ScoreLeadOutput = {
  score: 92,
  reasoning: "Strong stack match: Next.js + TypeScript directly listed in the post and budget aligns with operator's hourly rate over the stated 3-week scope.",
  signals: ["nextjs-stack", "typescript", "fixed-budget", "scope-clear"],
};

const LEAD = {
  source: "upwork",
  source_url: "https://www.upwork.com/jobs/~abc123",
  title: "Senior Next.js engineer for SaaS dashboard rebuild",
  description: "Stack: Next.js 14, TypeScript, Tailwind, Supabase. ~3 weeks fixed.",
  budget_text: "$5,500 fixed",
  posted_at: "2026-05-01T00:00:00.000Z",
};

const PROFILE = {
  display_name: "Anya Petrov",
  skills: ["React", "Next.js", "TypeScript"],
  hourly_rate: 120,
  bio: "I build dashboards.",
};

describe("scoreLead", () => {
  beforeEach(() => {
    vi.mocked(llm.complete).mockReset();
  });

  it("happy path: returns ScoreLeadOutput plus tier + prompt_version", async () => {
    vi.mocked(llm.complete).mockResolvedValue(VALID_OUTPUT);

    const result = await scoreLead({
      lead: LEAD,
      profile: PROFILE,
      userId: "user-1",
    });

    expect(result.score).toBe(92);
    expect(result.signals).toContain("nextjs-stack");
    expect(result.tier).toBe("balanced");
    expect(result.prompt_version).toBe("score-lead@v1");
  });

  it("forwards user_id, purpose, schema, and tier to the LLM client", async () => {
    vi.mocked(llm.complete).mockResolvedValue(VALID_OUTPUT);

    await scoreLead({ lead: LEAD, profile: PROFILE, userId: "user-7" });

    expect(llm.complete).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(llm.complete).mock.calls[0]![0];
    expect(arg.user_id).toBe("user-7");
    expect(arg.purpose).toBe("score_lead");
    expect(arg.model).toBe("balanced");
    expect(arg.prompt_version).toBe("score-lead@v1");
    expect(arg.schema).toBe(ScoreLeadOutput);
    // Prompt body should contain the rendered profile + lead JSON.
    expect(arg.prompt).toContain("Anya Petrov");
    expect(arg.prompt).toContain("Senior Next.js engineer");
  });

  it("propagates schema-validation failures from the LLM client", async () => {
    // The router/client retries once on schema fail and then throws — we verify
    // scoreLead doesn't swallow the error.
    vi.mocked(llm.complete).mockRejectedValue(
      new Error("LLM response failed schema validation")
    );

    await expect(
      scoreLead({ lead: LEAD, profile: PROFILE, userId: "u" })
    ).rejects.toThrow(/schema validation/);
  });

  it("propagates BudgetExceededError so the caller can surface friendly UI copy", async () => {
    vi.mocked(llm.complete).mockRejectedValue(
      new BudgetExceededError("u", 5.0, 5.01)
    );

    await expect(
      scoreLead({ lead: LEAD, profile: PROFILE, userId: "u" })
    ).rejects.toBeInstanceOf(BudgetExceededError);
  });
});
