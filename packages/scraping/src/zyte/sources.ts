/**
 * Per-source URL builders for Zyte (and Firecrawl, which uses the same URLs).
 * One exported function per source. Each returns a search URL that the
 * adapter feeds into the scraper. URL templates per build guide §5.2.
 *
 * If the URL stops returning useful results (sources occasionally redesign
 * their search), only this file needs editing — parsers and scout pipeline
 * are stable behind it.
 */

export function upworkSearchUrl(query: string): string {
  const params = new URLSearchParams({ q: query, sort: "recency" });
  return `https://www.upwork.com/nx/search/jobs/?${params.toString()}`;
}

export function linkedinSearchUrl(query: string): string {
  // f_TPR=r604800 = "past week"
  const params = new URLSearchParams({ keywords: query, f_TPR: "r604800" });
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

export function indeedSearchUrl(query: string): string {
  const params = new URLSearchParams({ q: query, sort: "date" });
  return `https://www.indeed.com/jobs?${params.toString()}`;
}

export function redditSearchUrl(query: string): string {
  // r/forhire is the canonical freelance subreddit.
  const params = new URLSearchParams({
    q: `[hiring] ${query}`,
    restrict_sr: "on",
    sort: "new",
  });
  return `https://www.reddit.com/r/forhire/search.json?${params.toString()}`;
}

export function contraSearchUrl(query: string): string {
  return `https://contra.com/search?query=${encodeURIComponent(query)}&type=opportunities`;
}

export function freelancerSearchUrl(query: string): string {
  return `https://www.freelancer.com/jobs/?keyword=${encodeURIComponent(query)}`;
}

export function xSearchUrl(query: string): string {
  // X/Twitter advanced search for hiring posts mentioning the query.
  const q = `("hiring" OR "looking for") ${query}`;
  return `https://twitter.com/search?q=${encodeURIComponent(q)}&f=live`;
}
