import { describe, it, expect } from "vitest";
import { computePayloadHash } from "../src/drafting/payloadHash";

const SAMPLE = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  subject: "Next.js dashboard rebuild — shipped one last month",
  draft: "Hi — rebuilt a nearly identical stack last month...",
};

describe("computePayloadHash", () => {
  it("is deterministic — same inputs always produce the same hash", () => {
    const h1 = computePayloadHash(SAMPLE);
    const h2 = computePayloadHash(SAMPLE);
    expect(h1).toBe(h2);
  });

  it("produces a 64-char hex string (SHA-256)", () => {
    const h = computePayloadHash(SAMPLE);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when subject changes", () => {
    const h1 = computePayloadHash(SAMPLE);
    const h2 = computePayloadHash({ ...SAMPLE, subject: "different subject" });
    expect(h1).not.toBe(h2);
  });

  it("changes when draft changes", () => {
    const h1 = computePayloadHash(SAMPLE);
    const h2 = computePayloadHash({ ...SAMPLE, draft: "modified body text" });
    expect(h1).not.toBe(h2);
  });

  it("changes when id changes", () => {
    const h1 = computePayloadHash(SAMPLE);
    const h2 = computePayloadHash({ ...SAMPLE, id: "different-id" });
    expect(h1).not.toBe(h2);
  });

  it("is sensitive to whitespace in draft", () => {
    const h1 = computePayloadHash(SAMPLE);
    const h2 = computePayloadHash({ ...SAMPLE, draft: SAMPLE.draft + " " });
    expect(h1).not.toBe(h2);
  });

  it("canonical JSON key order is stable (id → subject → draft)", () => {
    // The hash must not depend on object property enumeration order in the caller.
    // computePayloadHash builds a fixed canonical string, so the order is always
    // {id, subject, draft} regardless of how the caller constructs the opts object.
    const h1 = computePayloadHash({ id: SAMPLE.id, subject: SAMPLE.subject, draft: SAMPLE.draft });
    const h2 = computePayloadHash({ draft: SAMPLE.draft, id: SAMPLE.id, subject: SAMPLE.subject });
    expect(h1).toBe(h2);
  });
});
