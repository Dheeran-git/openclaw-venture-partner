/**
 * The lead shape contract that flows from scrapers through normalization
 * into the database. Lives in @openclaw/shared so the worker, the agent,
 * and the dashboard can all reason about lead data without depending on
 * any specific scraper package.
 *
 * `ScrapedLeadInput` is intentionally structural -- it mirrors the
 * fields scrapers must provide, but doesn't import from the scraping
 * package. Any object that has these fields (the actual `ScrapedLead`
 * from @openclaw/scraping satisfies this) can be normalized.
 */

export interface ScrapedLeadInput {
  source_url: string;
  title: string;
  description: string;
  posted_at: Date;
}

export type LeadSource =
  | "upwork"
  | "linkedin"
  | "indeed"
  | "contra"
  | "reddit"
  | "x"
  | "github"
  | "other";

export interface NormalizedLead {
  source_url: string;
  source: LeadSource;
  title: string;
  description: string;
  budget_text: string | null;
  /** ISO 8601 string. Keeping it stringified makes JSON storage in
   *  `leads.normalized` round-trip cleanly without Date revival. */
  posted_at: string;
}

const SOURCE_HOSTS: ReadonlyArray<readonly [needle: string, source: LeadSource]> = [
  ["upwork.com", "upwork"],
  ["linkedin.com", "linkedin"],
  ["indeed.com", "indeed"],
  ["contra.com", "contra"],
  ["reddit.com", "reddit"],
  ["x.com", "x"],
  ["twitter.com", "x"],
  ["github.com", "github"],
];

export function detectLeadSource(url: string): LeadSource {
  const lower = url.toLowerCase();
  for (const [needle, source] of SOURCE_HOSTS) {
    if (lower.includes(needle)) return source;
  }
  return "other";
}

/**
 * Greedy regex for budget phrasing. Catches the common shapes seen in
 * job posts: fixed totals (`$5,500`, `$2k`), ranges (`$120k-160k`),
 * hourly (`$75/hr`), and explicit `fixed`/`flat` qualifiers. Returns
 * the first match verbatim so the UI can display exactly what the
 * lead said. Null when no dollar figure is present, which downstream
 * scoring treats as a budget-fit unknown.
 */
const BUDGET_RE =
  /\$\s*\d[\d,]*(?:\.\d+)?\s*[kK]?(?:\s*(?:-|to)\s*\$?\s*\d[\d,]*(?:\.\d+)?\s*[kK]?)?(?:\s*(?:fixed|flat|\/\s*(?:hr|hour|h|yr|year|month|wk|week)))?/i;

export function extractBudgetText(description: string): string | null {
  const match = description.match(BUDGET_RE);
  if (!match) return null;
  return match[0].replace(/\s+/g, " ").trim();
}

/**
 * Decode the small set of named HTML entities that show up in titles and
 * descriptions scraped from job boards (Indeed, LinkedIn, etc.). Most
 * sources hand us strings that have already been HTML-encoded once --
 * "Software Engineer, AI &amp; Product Systems" -- and we want to display
 * "AI & Product Systems" in the UI without rendering it as HTML.
 *
 * Numeric entities (&#39;, &#x27;) cover apostrophes, which Indeed's
 * mosaic JSON and LinkedIn's JSON-LD payloads both emit.
 */
const HTML_ENTITY_DECODER: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(
    /&(?:amp|lt|gt|quot|apos|nbsp|#39|#x27);/gi,
    (match) => HTML_ENTITY_DECODER[match.toLowerCase()] ?? match
  );
}

export function normalizeScrapedLead(input: ScrapedLeadInput): NormalizedLead {
  const title = decodeHtmlEntities(input.title).trim();
  const description = decodeHtmlEntities(input.description).trim();
  return {
    source_url: input.source_url,
    source: detectLeadSource(input.source_url),
    title,
    description,
    budget_text: extractBudgetText(description),
    posted_at: input.posted_at.toISOString(),
  };
}
