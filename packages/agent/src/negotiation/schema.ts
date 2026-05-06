import { z } from "zod";

export const ClassifyReplyOutput = z.object({
  classification: z.enum(["positive", "negative", "question", "unsubscribe"]),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string().min(5).max(500),
  suggested_action: z.string().min(5).max(300),
});

export type ClassifyReplyOutput = z.infer<typeof ClassifyReplyOutput>;

export const DraftReplyOption = z.object({
  tone: z.enum(["brief", "detailed", "friendly"]),
  body: z.string().min(20).max(2000),
});

export const DraftReplyOutput = z.object({
  subject: z.string().min(3).max(120),
  options: z.array(DraftReplyOption).length(3),
  reasoning: z.string().min(10).max(500),
  confidence: z.enum(["high", "medium", "low"]),
});

export type DraftReplyOutput = z.infer<typeof DraftReplyOutput>;
