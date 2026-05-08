/**
 * Live leads hook -- single source of truth for the LeadTable.
 *
 * Sequence (req. #5 in the Step 6 spec):
 *   1. Initial fetch: leads + their latest score, sorted by score desc, limit 50
 *   2. AFTER fetch resolves, attach two postgres_changes subscriptions:
 *        - leads INSERT: prepend new lead with score=null ("scouting" placeholder)
 *        - scores INSERT: find lead by lead_id, merge in the score, resort
 *
 * This deliberately is NOT a debounced refetch. The two-subscription
 * pattern produces the "lead pops in immediately, score resolves a
 * beat later" UX -- you can watch the row change tier color when its
 * score lands.
 *
 * Race notes:
 *   - Subscribe AFTER initial fetch completes, so a Realtime push for
 *     a row that's already in the initial snapshot doesn't create a
 *     duplicate. Defensive id-already-present check still applies.
 *   - scores has no user_id column, so we can't filter the
 *     subscription server-side; the client filters by lead_id
 *     membership in the current state.
 */
"use client";

import { useEffect, useState } from "react";
import type { NormalizedLead } from "@openclaw/shared";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";
import {
  toLeadRow,
  type LeadDBRow,
  type ScoreDBRow,
  type PitchDBRow,
} from "../lib/leadAdapters";
import type { LeadRow, LeadStatus } from "../lib/fixtures";

interface FetchedLead {
  id: string;
  user_id: string;
  layer: 1 | 2 | 3;
  normalized: NormalizedLead;
  scraped_at: string;
  scores: Array<{
    score: number;
    reasoning: string | null;
    created_at: string;
  }>;
  pitches: Array<{
    status: "draft" | "approved" | "sent" | "rejected";
    created_at: string;
  }>;
}

function pickLatestPitch(
  pitches: FetchedLead["pitches"]
): PitchDBRow | null {
  if (pitches.length === 0) return null;
  let best = pitches[0]!;
  for (const p of pitches) {
    if (p.created_at > best.created_at) best = p;
  }
  return { status: best.status };
}

const INITIAL_LIMIT = 50;

function pickLatestScore(
  scores: FetchedLead["scores"]
): ScoreDBRow | null {
  if (scores.length === 0) return null;
  let best = scores[0]!;
  for (const s of scores) {
    if (s.created_at > best.created_at) best = s;
  }
  return { ...best, lead_id: "" } as ScoreDBRow;
}

function compareForList(a: LeadRow, b: LeadRow): number {
  const av = a.score;
  const bv = b.score;
  if (av === null && bv === null) {
    // Both pending: newest first by scraped_at
    return a.scraped_at < b.scraped_at ? 1 : -1;
  }
  if (av === null) return -1; // pending floats to top so it's visible
  if (bv === null) return 1;
  return bv - av; // higher score first
}

export interface UseLeadsResult {
  leads: LeadRow[];
  loading: boolean;
}

export function useLeads(userId?: string): UseLeadsResult {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const supabase = getSupabaseBrowser();
    let cleanup: (() => void) | null = null;

    (async () => {
      // ----- 1. Initial fetch ------------------------------------
      const { data, error } = await supabase
        .from("leads")
        .select(
          `id, user_id, layer, normalized, scraped_at,
           scores (score, reasoning, created_at),
           pitches (status, created_at)`
        )
        .order("scraped_at", { ascending: false })
        .limit(INITIAL_LIMIT);

      if (cancelled) return;
      if (error) {
        console.error("[useLeads] initial fetch failed:", error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as FetchedLead[];
      const initial = rows
        .map((row) => {
          const latest = pickLatestScore(row.scores);
          const latestPitch = pickLatestPitch(row.pitches);
          const dbRow: LeadDBRow = {
            id: row.id,
            user_id: row.user_id,
            layer: row.layer,
            normalized: row.normalized,
            scraped_at: row.scraped_at,
          };
          const scoreRow: ScoreDBRow | null = latest
            ? {
                lead_id: row.id,
                score: latest.score,
                reasoning: latest.reasoning,
                created_at: latest.created_at,
              }
            : null;
          return toLeadRow(dbRow, scoreRow, latestPitch);
        })
        .sort(compareForList);

      setLeads(initial);
      setLoading(false);

      if (cancelled) return;

      // ----- 2. Subscribe (only after initial fetch resolved) ----
      const channel = supabase
        .channel("leads-pipeline")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "leads",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as {
              id: string;
              user_id: string;
              layer: 1 | 2 | 3;
              normalized: NormalizedLead;
              scraped_at: string;
            };
            setLeads((prev) => {
              if (prev.some((l) => l.id === row.id)) return prev;
              const card = toLeadRow(
                {
                  id: row.id,
                  user_id: row.user_id,
                  layer: row.layer,
                  normalized: row.normalized,
                  scraped_at: row.scraped_at,
                },
                null
              );
              return [card, ...prev].sort(compareForList);
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "scores" },
          (payload) => {
            const row = payload.new as {
              lead_id: string;
              score: number;
              reasoning: string | null;
              created_at: string;
            };
            setLeads((prev) => {
              const idx = prev.findIndex((l) => l.id === row.lead_id);
              if (idx < 0) return prev; // score for an unknown lead -- ignore
              const updated = [...prev];
              // A fresh score with no pitch yet is "scored", not
              // "draft-ready" -- statusFor's three-way split. Once the
              // operator drafts a pitch, the pitches subscription below
              // promotes it to "draft-ready".
              updated[idx] = {
                ...updated[idx]!,
                score: row.score,
                status: "scored",
              };
              return updated.sort(compareForList);
            });
          }
        )
        // Pitch status changes (Approve / Reject / mark Sent) need to flow
        // back to the table row so the badge matches the right rail.
        // INSERT covers a brand-new draft pitch landing; UPDATE covers
        // status transitions on an existing pitch row.
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pitches",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as {
              lead_id: string;
              status: "draft" | "approved" | "sent" | "rejected";
            };
            if (!row?.lead_id) return;
            const nextStatus: LeadStatus =
              row.status === "rejected"
                ? "rejected"
                : row.status === "sent"
                  ? "sent"
                  : row.status === "approved"
                    ? "approved"
                    : "draft-ready";
            setLeads((prev) => {
              const idx = prev.findIndex((l) => l.id === row.lead_id);
              if (idx < 0) return prev;
              const updated = [...prev];
              updated[idx] = { ...updated[idx]!, status: nextStatus };
              return updated.sort(compareForList);
            });
          }
        )
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [userId]);

  return { leads, loading };
}
