/**
 * UI fixtures + types. After Step 6 the leads and activity arrays are
 * gone -- those come from Supabase via the useLeads / useScoutActivity
 * hooks. Stats are still mocked until the dashboard counter pipeline
 * lands in a later phase.
 *
 * LeadSource mirrors @openclaw/shared exactly so toLeadRow can pass
 * normalized.source through without translation.
 */

import type { LeadSource as SharedLeadSource } from "@openclaw/shared";

export type LeadSource = SharedLeadSource;

export type LeadStatus =
  | "scored"
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
  /** null while the score is still being computed (between leads
   *  INSERT realtime push and the matching scores INSERT push). */
  score: number | null;
  layer: 1 | 2 | 3;
  source: LeadSource;
  title: string;
  budget: string;
  /** ISO 8601 -- the table component recomputes the human age string
   *  at render time so it stays accurate without polling. */
  scraped_at: string;
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
  kind: "live" | "ok" | "warn" | "" | "divider";
  text: string;
  meta: string;
}


export const SOURCE_LABEL: Record<LeadSource, string> = {
  upwork: "Upwork",
  linkedin: "LinkedIn",
  indeed: "Indeed",
  contra: "Contra",
  reddit: "Reddit",
  x: "X",
  github: "GitHub",
  other: "Other",
};

export const SOURCE_DOT: Record<LeadSource, string> = {
  upwork: "#14A800",
  linkedin: "#0A66C2",
  indeed: "#2164F3",
  contra: "#F4B400",
  reddit: "#FF4500",
  x: "#1DA1F2",
  github: "#F0F4FF",
  other: "#8892AB",
};
