import { z } from "zod";

export const ScoreLeadOutput = z.object({
  score: z.number().int().min(0).max(100),
  reasoning: z.string().min(10).max(800),
  signals: z.array(z.string().min(1).max(40)).min(3).max(8),
});

export type ScoreLeadOutput = z.infer<typeof ScoreLeadOutput>;
