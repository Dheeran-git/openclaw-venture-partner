/**
 * Phase 1 fixtures. Mirrors the shape of `data.js` from
 * openclaw-design-system/project/ui_kits/dashboard/, ported to TS.
 *
 * Phase 2 swaps these for live Supabase queries — the table component
 * already accepts the data via props, so the swap is a one-file change
 * in app/page.tsx.
 */

export type LeadSource =
  | "upwork"
  | "linkedin"
  | "contra"
  | "reddit"
  | "x"
  | "github";

export type LeadStatus =
  | "draft-ready"
  | "drafting"
  | "scouting"
  | "approved"
  | "sent"
  | "rejected"
  | "archived"
  | "snoozed"
  | "pending";

export interface LeadRow {
  id: string;
  score: number;
  layer: 1 | 2 | 3;
  source: LeadSource;
  title: string;
  budget: string;
  age: string;
  status: LeadStatus;
}

export interface StatCard {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  sub?: string;
  accent?: boolean;
}

export interface ActivityEvent {
  kind: "live" | "ok" | "warn" | "";
  text: string;
  meta: string;
}

export const stats: StatCard[] = [
  { label: "Leads queued", value: "128", delta: "+18% w/w", deltaPositive: true },
  { label: "Pitches sent", value: "42", sub: "11 awaiting reply" },
  { label: "Reply rate", value: "31%", delta: "-4% w/w", deltaPositive: false },
  { label: "Hours saved", value: "26.4", sub: "vs manual prospecting", accent: true },
];

export const leads: LeadRow[] = [
  { id: "lead_8f3c", score: 94, layer: 3, source: "upwork", title: "Senior Frontend Engineer - Vercel migration", budget: "$8-12k", age: "4m", status: "draft-ready" },
  { id: "lead_7d11", score: 88, layer: 3, source: "linkedin", title: "Next.js + Convex consultant for fintech", budget: "$15-25k", age: "11m", status: "draft-ready" },
  { id: "lead_6c92", score: 81, layer: 2, source: "contra", title: "Headless Shopify theme rebuild", budget: "$6k", age: "27m", status: "drafting" },
  { id: "lead_6b04", score: 76, layer: 2, source: "upwork", title: "Performance audit - ecommerce 800k sessions", budget: "$2-4k", age: "42m", status: "draft-ready" },
  { id: "lead_5a77", score: 72, layer: 2, source: "x", title: "Twitter post: looking for a designer-engineer", budget: "-", age: "1h", status: "scouting" },
  { id: "lead_5912", score: 68, layer: 2, source: "linkedin", title: "Design system lead - Series B SaaS", budget: "$10k/mo", age: "1h", status: "draft-ready" },
  { id: "lead_4e30", score: 58, layer: 2, source: "linkedin", title: "React dev for agency rebuild", budget: "$4-6k", age: "12m", status: "drafting" },
  { id: "lead_3a18", score: 51, layer: 1, source: "reddit", title: "Marketing site overhaul (no React preference)", budget: "$3k", age: "2h", status: "draft-ready" },
  { id: "lead_2d72", score: 44, layer: 1, source: "github", title: "Open issue: nuxt 2 to 3 migration help", budget: "-", age: "3h", status: "snoozed" },
  { id: "lead_2099", score: 36, layer: 1, source: "upwork", title: "Wordpress to Webflow port", budget: "$1k", age: "4h", status: "rejected" },
  { id: "lead_1c50", score: 0, layer: 1, source: "upwork", title: "Looking for cheap react dev", budget: "$300", age: "5h", status: "archived" },
  { id: "lead_1188", score: 0, layer: 1, source: "upwork", title: "$50 fixed-price logo - low fit", budget: "$50", age: "5h", status: "archived" },
];

export const activity: ActivityEvent[] = [
  { kind: "live", text: "Scouting Upwork", meta: "47 PROFILES - 0:03:12" },
  { kind: "ok", text: "Drafted pitch for Sara at Vercel", meta: "PITCH_A921 - 1m AGO" },
  { kind: "ok", text: "Built proof-of-value - pricing page rebuild", meta: "POV_044 - 4m AGO" },
  { kind: "warn", text: "LinkedIn rate-limited - retry in 4m", meta: "12m AGO" },
  { kind: "", text: "Scout run completed - 12 leads added", meta: "RUN_18:00 - 1h AGO" },
  { kind: "ok", text: "Approved pitch sent to Marco at Linear", meta: "PITCH_A918 - 2h AGO" },
  { kind: "", text: "Client memory updated - Stripe onboarding notes", meta: "3h AGO" },
];

export const SOURCE_LABEL: Record<LeadSource, string> = {
  upwork: "Upwork",
  linkedin: "LinkedIn",
  contra: "Contra",
  reddit: "Reddit",
  x: "X",
  github: "GitHub",
};

export const SOURCE_DOT: Record<LeadSource, string> = {
  upwork: "#14A800",
  linkedin: "#0A66C2",
  contra: "#F4B400",
  reddit: "#FF4500",
  x: "#1DA1F2",
  github: "#F0F4FF",
};
