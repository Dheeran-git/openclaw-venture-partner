/**
 * DB-row to UI-row adapter. Intentionally does NOT compute the "age"
 * string -- age stays as scraped_at (ISO) on the LeadRow so the
 * component can recompute the human label at render time and stay
 * accurate as time passes without forcing full state updates.
 */
import type { NormalizedLead } from "@openclaw/shared";
import type { LeadRow, LeadStatus } from "./fixtures";

export interface LeadDBRow {
  id: string;
  user_id: string;
  layer: 1 | 2 | 3;
  normalized: NormalizedLead;
  scraped_at: string;
}

export interface ScoreDBRow {
  lead_id: string;
  score: number;
  reasoning: string | null;
  created_at: string;
}

export function toLeadRow(
  lead: LeadDBRow,
  score: ScoreDBRow | null
): LeadRow {
  const status: LeadStatus = score === null ? "scouting" : "draft-ready";
  return {
    id: lead.id,
    score: score?.score ?? null,
    layer: lead.layer,
    source: lead.normalized.source,
    title: lead.normalized.title,
    budget: lead.normalized.budget_text ?? "—",
    scraped_at: lead.scraped_at,
    status,
  };
}

/** Computes a short human age string (now / 4m / 2h / 3d) from an
 *  ISO timestamp. Cheap; safe to call at every render. */
export function ageFromIso(iso: string): string {
  const ms = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
