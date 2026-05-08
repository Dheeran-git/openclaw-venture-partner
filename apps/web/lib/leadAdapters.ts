/**
 * DB-row to UI-row adapter. Intentionally does NOT compute the "age"
 * string -- age stays as scraped_at (ISO) on the LeadRow so the
 * component can recompute the human label at render time and stay
 * accurate as time passes without forcing full state updates.
 */
import { decodeHtmlEntities, type NormalizedLead } from "@openclaw/shared";
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

export interface PitchDBRow {
  status: "draft" | "approved" | "sent" | "rejected";
}

/**
 * Compute the lead row's pipeline status. Pitch state, when present,
 * dominates the score-only signal: a rejected pitch outranks the fact
 * that the lead has a score, and a sent pitch outranks "draft-ready".
 * This keeps the table in sync with the right-rail PitchCard.
 */
function statusFor(
  score: ScoreDBRow | null,
  pitch: PitchDBRow | null
): LeadStatus {
  if (pitch) {
    if (pitch.status === "rejected") return "rejected";
    if (pitch.status === "sent") return "sent";
    if (pitch.status === "approved") return "approved";
    // draft -> falls through to "draft-ready" since the lead has a
    // pitch in flight; further differentiation lives in the right rail.
  }
  return score === null ? "scouting" : "draft-ready";
}

export function toLeadRow(
  lead: LeadDBRow,
  score: ScoreDBRow | null,
  pitch: PitchDBRow | null = null
): LeadRow {
  return {
    id: lead.id,
    score: score?.score ?? null,
    layer: lead.layer,
    source: lead.normalized.source,
    // Defensive render-time decode: leads scraped before the
    // normalize-time decoder shipped (commit cbf43f5) still have
    // raw entities like "&amp;" in their persisted title. Cheap to
    // apply on every read; idempotent on already-decoded strings.
    title: decodeHtmlEntities(lead.normalized.title),
    budget: lead.normalized.budget_text ?? "—",
    scraped_at: lead.scraped_at,
    status: statusFor(score, pitch),
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
