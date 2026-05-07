/**
 * Shared JSON-LD JobPosting extractor for parsers that target sites
 * which embed schema.org JobPosting blocks in <script type="application/ld+json">.
 *
 * LinkedIn and Freelancer both render JSON-LD on their search pages —
 * structured data is more stable than CSS class names, so we try this
 * strategy first and fall back to DOM regex parsing only if it yields
 * zero results.
 */
import type { ScrapedLead, SourceType } from "../../types";

const JSONLD_BLOCK_RE =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

interface JobPostingNode {
  "@type"?: string | string[];
  "@graph"?: unknown;
  itemListElement?: unknown;
  title?: string;
  name?: string;
  description?: string;
  url?: string;
  datePosted?: string;
  hiringOrganization?: { name?: string } | string;
  baseSalary?: unknown;
}

function isJobPostingType(type: string | string[] | undefined): boolean {
  if (!type) return false;
  if (Array.isArray(type)) return type.includes("JobPosting");
  return type === "JobPosting";
}

function* iterJsonLdJobs(parsed: unknown): Generator<JobPostingNode> {
  if (!parsed) return;
  if (Array.isArray(parsed)) {
    for (const item of parsed) yield* iterJsonLdJobs(item);
    return;
  }
  if (typeof parsed !== "object") return;
  const node = parsed as JobPostingNode;
  if (isJobPostingType(node["@type"])) {
    yield node;
  }
  if (node["@graph"]) yield* iterJsonLdJobs(node["@graph"]);
  if (node.itemListElement) yield* iterJsonLdJobs(node.itemListElement);
}

function pickHiringOrgName(
  org: JobPostingNode["hiringOrganization"]
): string | null {
  if (!org) return null;
  if (typeof org === "string") return org;
  return org.name ?? null;
}

/**
 * Scan an HTML string for <script type="application/ld+json"> blocks and
 * pull out every JobPosting node. Returns scraped leads, capped at limit.
 */
export function parseJobPostingJsonLd(
  html: string,
  source: SourceType,
  limit: number
): ScrapedLead[] {
  const results: ScrapedLead[] = [];
  for (const match of html.matchAll(JSONLD_BLOCK_RE)) {
    if (results.length >= limit) break;
    const raw = match[1]?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    for (const node of iterJsonLdJobs(parsed)) {
      if (results.length >= limit) break;
      const title = (node.title ?? node.name ?? "").trim();
      const url = (node.url ?? "").trim();
      if (!title || !url) continue;
      const company = pickHiringOrgName(node.hiringOrganization);
      const description =
        (node.description ?? "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim() || (company ? `${company} — ${title}` : title);
      const posted_at = node.datePosted
        ? new Date(node.datePosted)
        : new Date();
      results.push({
        source,
        source_url: url.split("?")[0]!,
        title: title.replace(/\s+/g, " ").slice(0, 280),
        description: description.slice(0, 1500),
        posted_at: Number.isNaN(posted_at.getTime()) ? new Date() : posted_at,
        raw: {
          strategy: `${source}-jsonld`,
          ...(company ? { company } : {}),
        },
      });
    }
  }
  return results;
}
