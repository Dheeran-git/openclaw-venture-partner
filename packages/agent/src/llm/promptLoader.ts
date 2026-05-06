import type { ModelTier } from "./types";
import { SCORE_LEAD_PROMPT } from "../prompts/score-lead";
import { DRAFT_PITCH_PROMPT } from "../prompts/draft-pitch";

// Prompts are inlined as TS string exports rather than read from .md files
// at runtime: import.meta.url resolves to the build path inside Next.js's
// bundler output, so fs.readFile would target a directory that doesn't
// exist on Vercel. The matching .md siblings stay in source for review.
const PROMPTS: Record<string, string> = {
  "score-lead": SCORE_LEAD_PROMPT,
  "draft-pitch": DRAFT_PITCH_PROMPT,
};

export interface PromptFrontmatter {
  version: string;
  model: ModelTier;
  schema: string;
}

export interface LoadedPrompt {
  meta: PromptFrontmatter;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const TIERS: ReadonlySet<ModelTier> = new Set(["fast", "balanced", "capable"]);

export async function loadPrompt(name: string): Promise<LoadedPrompt> {
  const raw = PROMPTS[name];
  if (!raw) {
    throw new Error(`Prompt ${name} not found in PROMPTS registry.`);
  }
  return parsePrompt(name, raw);
}

export function parsePrompt(name: string, raw: string): LoadedPrompt {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    throw new Error(
      `Prompt ${name} is missing the --- frontmatter --- block at the top of the file.`
    );
  }
  const [, header = "", body = ""] = match;
  const meta = parseHeader(name, header);
  return { meta, body: body.trim() };
}

function parseHeader(name: string, header: string): PromptFrontmatter {
  const out: Record<string, string> = {};
  for (const line of header.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) {
      throw new Error(`Prompt ${name} has invalid frontmatter line: "${line}"`);
    }
    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }

  for (const required of ["version", "model", "schema"] as const) {
    if (!out[required]) {
      throw new Error(`Prompt ${name} frontmatter is missing key: ${required}`);
    }
  }
  if (!TIERS.has(out.model as ModelTier)) {
    throw new Error(
      `Prompt ${name} has invalid model tier "${out.model}" (expected fast | balanced | capable).`
    );
  }
  return {
    version: out.version!,
    model: out.model as ModelTier,
    schema: out.schema!,
  };
}

export function renderPrompt(
  body: string,
  vars: Record<string, unknown>
): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Prompt template references unknown variable: ${key}`);
    }
    const value = vars[key];
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  });
}
