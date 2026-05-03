import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ModelTier } from "./types";

const PROMPTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "prompts"
);

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
  const path = join(PROMPTS_DIR, `${name}.md`);
  const raw = await readFile(path, "utf8");
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
