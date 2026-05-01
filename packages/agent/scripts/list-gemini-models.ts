import { config as loadEnv } from "dotenv";
loadEnv({ path: "../../.env" });

const key = process.env.GEMINI_API_KEY!;
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
);
const data = (await res.json()) as {
  models?: Array<{
    name: string;
    supportedGenerationMethods?: string[];
  }>;
};

const usable = (data.models ?? [])
  .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
  .map((m) => m.name.replace(/^models\//, ""))
  .filter((n) => n.startsWith("gemini-"))
  .sort();

console.log(`${usable.length} models support generateContent:`);
for (const n of usable) console.log(`  ${n}`);
