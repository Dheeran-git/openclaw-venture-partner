/**
 * Contra parser. Contra uses Next.js with SSR'd opportunity cards. This
 * parser walks the embedded Next data; if Contra changes its data shape,
 * fall back to DOM regex on /opportunities/<slug> hrefs.
 */
import type { ScrapedLead } from "../../types";

export function parseContra(html: string, limit: number): ScrapedLead[] {
  const stateM = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/
  );
  const results: ScrapedLead[] = [];
  if (stateM) {
    try {
      const state = JSON.parse(stateM[1]!) as unknown;
      walkContra(state, results, limit);
      if (results.length > 0) return results;
    } catch {
      /* fall through */
    }
  }

  // DOM fallback: match /opportunities/<slug> hrefs.
  const seen = new Set<string>();
  const matches = html.matchAll(
    /href="(\/opportunities\/[A-Za-z0-9-]{4,80})"[^>]*>([\s\S]{4,200}?)<\//gi
  );
  for (const m of matches) {
    if (results.length >= limit) break;
    const slug = m[1]!;
    if (seen.has(slug)) continue;
    seen.add(slug);
    const title = m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!title) continue;
    results.push({
      source: "contra",
      source_url: `https://contra.com${slug}`,
      title,
      description: `Contra opportunity: ${title}`,
      posted_at: new Date(),
      raw: { strategy: "contra-dom" },
    });
  }
  return results;
}

function walkContra(
  node: unknown,
  out: ScrapedLead[],
  limit: number
): void {
  if (out.length >= limit) return;
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (
    typeof obj["slug"] === "string" &&
    typeof obj["title"] === "string" &&
    (obj["__typename"] === "Opportunity" || obj["type"] === "OPPORTUNITY")
  ) {
    out.push({
      source: "contra",
      source_url: `https://contra.com/opportunities/${obj["slug"]}`,
      title: (obj["title"] as string).trim(),
      description:
        typeof obj["description"] === "string"
          ? (obj["description"] as string).slice(0, 800)
          : `Contra opportunity: ${obj["title"]}`,
      posted_at:
        typeof obj["createdAt"] === "string"
          ? new Date(obj["createdAt"] as string)
          : new Date(),
      raw: { strategy: "contra-state" },
    });
    return;
  }
  for (const v of Object.values(obj)) {
    if (out.length >= limit) return;
    if (Array.isArray(v)) for (const x of v) walkContra(x, out, limit);
    else walkContra(v, out, limit);
  }
}
