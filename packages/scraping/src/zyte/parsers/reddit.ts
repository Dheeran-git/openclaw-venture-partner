/**
 * Reddit parser. Uses the .json suffix on the search URL — Reddit returns
 * structured JSON, not HTML, so this parser eats the raw body directly.
 *
 * If this breaks: Reddit occasionally rate-limits unauthenticated JSON
 * access. Authenticated OAuth requests are documented in build guide §5.4
 * deferred work.
 */
import type { ScrapedLead } from "../../types";

interface RedditListing {
  data?: {
    children?: Array<{
      data?: {
        permalink?: string;
        title?: string;
        selftext?: string;
        created_utc?: number;
      };
    }>;
  };
}

export function parseReddit(body: string, limit: number): ScrapedLead[] {
  let json: RedditListing;
  try {
    json = JSON.parse(body) as RedditListing;
  } catch {
    return [];
  }
  const children = json.data?.children ?? [];
  const results: ScrapedLead[] = [];
  for (const c of children) {
    if (results.length >= limit) break;
    const post = c.data;
    if (!post?.permalink || !post.title) continue;
    if (!/\bhiring\b|\[hiring\]/i.test(post.title)) continue;
    results.push({
      source: "reddit",
      source_url: `https://www.reddit.com${post.permalink}`,
      title: post.title.trim(),
      description: (post.selftext ?? `r/forhire — ${post.title}`).slice(0, 800),
      posted_at: post.created_utc
        ? new Date(post.created_utc * 1000)
        : new Date(),
      raw: { strategy: "reddit-json" },
    });
  }
  return results;
}
