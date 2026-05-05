import { z } from "zod";

export const DraftPitchOutput = z.object({
  subject: z.string().min(5).max(100),
  body: z.string().min(50).max(1500),
  reasoning: z.string().min(20).max(500),
  confidence: z.enum(["high", "medium", "low"]),
});

export type DraftPitchOutput = z.infer<typeof DraftPitchOutput>;
