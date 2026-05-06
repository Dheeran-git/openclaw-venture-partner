import type { ScrapedLead, Scraper, ScrapeHealth, SourceType } from "./types";
import { inferSourceType } from "./types";

interface StubFixture {
  source_url: string;
  title: string;
  description: string;
  posted_days_ago: number;
}

const FIXTURES: StubFixture[] = [
  {
    source_url: "https://www.upwork.com/jobs/~stub-nextjs-saas-rebuild",
    title: "Senior Next.js engineer for SaaS analytics rebuild",
    description:
      "Migrating a CRA dashboard to Next.js 15 App Router. Stack: TypeScript, Tailwind, Supabase, Recharts. Fixed price $6,200 over 3-4 weeks. Looking for someone who has shipped a real production dashboard -- please link one. Async-friendly with daily standups.",
    posted_days_ago: 1,
  },
  {
    source_url: "https://www.linkedin.com/jobs/view/stub-fintech-frontend-lead",
    title: "Frontend Lead -- Series B fintech (React/TS/Tailwind)",
    description:
      "We are hiring a frontend lead to own our customer dashboard. React + TypeScript + Tailwind + tRPC. 5+ years experience required. $135k-160k base + equity, fully remote. Permanent role; we are not hiring contractors for this position.",
    posted_days_ago: 3,
  },
  {
    source_url: "https://www.upwork.com/jobs/~stub-tailwind-component-polish",
    title: "Tailwind component library polish + accessibility audit",
    description:
      "We have a 40-component Tailwind library that needs a polish pass: consistent spacing, focus states, ARIA labels, dark-mode parity. Fixed price $3,800 over ~2 weeks. Existing Storybook to extend, Figma file provided.",
    posted_days_ago: 2,
  },
  {
    source_url: "https://www.upwork.com/jobs/~stub-react-redux-mid-rewrite",
    title: "React/Redux dashboard rewrite for mid-size SaaS",
    description:
      "Our internal admin dashboard is on React 17 + Redux Toolkit. We want it migrated to React 18 + modern patterns (server components where it makes sense). Budget $4,200 fixed for 2 weeks. Code review by our staff engineer.",
    posted_days_ago: 4,
  },
  {
    source_url: "https://contra.com/opportunities/stub-nextjs-sanity-portfolio",
    title: "Next.js + Sanity portfolio site for design studio",
    description:
      "We are a small design studio launching a new portfolio site. Need Next.js + Sanity CMS with smooth Framer Motion transitions. ~10 days, fixed $2,800. Designer will provide finished Figma. References to past portfolio work strongly preferred.",
    posted_days_ago: 5,
  },
  {
    source_url: "https://www.indeed.com/job/stub-shopify-hydrogen-contract",
    title: "Shopify Hydrogen migration contractor (8 weeks)",
    description:
      "Migrating an existing Liquid storefront to Shopify Hydrogen (React-based). $75/hr, ~30 hrs/week for 8 weeks. Hydrogen experience required; ecommerce experience strongly preferred.",
    posted_days_ago: 6,
  },
  {
    source_url: "https://www.linkedin.com/jobs/view/stub-vague-engineers-needed",
    title: "Looking for engineers to help build something exciting",
    description:
      "We are an early-stage startup looking for talented engineers. Long-term opportunity. Send your CV and rate.",
    posted_days_ago: 11,
  },
  {
    source_url: "https://www.reddit.com/r/forhire/comments/stub-react-native-mvp",
    title: "[Hiring] React Native dev for MVP mobile app, $2k flat",
    description:
      "Building an MVP for a B2C app. React Native + Expo + Firebase. Need someone to ship a working iOS/Android build in ~10 days. $2,000 flat. Designs ready, scope is locked.",
    posted_days_ago: 3,
  },
  {
    source_url: "https://www.upwork.com/jobs/~stub-wordpress-woocommerce-cheap",
    title: "WordPress + WooCommerce theme customization (urgent)",
    description:
      "Need PHP developer to customize a WooCommerce theme. WordPress experience required. Budget $300 fixed for 2 weeks of work. Will provide unpaid trial task to evaluate skills.",
    posted_days_ago: 22,
  },
  {
    source_url: "https://www.upwork.com/jobs/~stub-junior-react-low-rate",
    title: "Junior React developer wanted, 10 hrs/week",
    description:
      "Looking for a junior-level React developer for ongoing maintenance. $15/hr, 10 hrs/week. Long-term. No frameworks beyond React itself; we use class components.",
    posted_days_ago: 15,
  },
  {
    source_url: "https://www.indeed.com/job/stub-php-laravel-legacy",
    title: "PHP / Laravel developer for legacy CMS",
    description:
      "Maintaining a Laravel 6 CMS for a publishing client. PHP 7.4. $40/hr contract, 20 hrs/week. Strong Laravel and MySQL experience required.",
    posted_days_ago: 18,
  },
  {
    source_url: "https://www.linkedin.com/jobs/view/stub-exposure-pay-vibes",
    title: "Help us build something amazing -- equity + exposure",
    description:
      "Pre-revenue startup with great vibes. Looking for a frontend developer to join us. Equity-only for the first 3 months, then we will discuss compensation. Must be passionate.",
    posted_days_ago: 30,
  },
];

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function relevance(fixture: StubFixture, query: string): number {
  const tokens = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const haystack = `${fixture.title} ${fixture.description}`.toLowerCase();
  return tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
}

export const stubScraper: Scraper = {
  name: "stub",

  async health(): Promise<ScrapeHealth> {
    return { ok: true, latency_ms: 0 };
  },

  async scrape(
    query: string,
    limit: number,
    sources?: SourceType[]
  ): Promise<ScrapedLead[]> {
    await sleep(450);

    const ranked = FIXTURES.map((fixture, idx) => ({
      fixture,
      relevance: relevance(fixture, query),
      idx,
    })).sort(
      (a, b) =>
        b.relevance - a.relevance ||
        a.fixture.posted_days_ago - b.fixture.posted_days_ago ||
        a.idx - b.idx
    );

    const sourceFilter = sources && sources.length > 0 ? new Set(sources) : null;
    const now = Date.now();
    return ranked
      .map(({ fixture }) => ({
        source: inferSourceType(fixture.source_url),
        source_url: fixture.source_url,
        title: fixture.title,
        description: fixture.description,
        posted_at: new Date(now - fixture.posted_days_ago * 86_400_000),
        raw: { ...fixture, scraper: "stub" },
      }))
      .filter((lead) => !sourceFilter || sourceFilter.has(lead.source))
      .slice(0, Math.max(0, limit));
  },
};
