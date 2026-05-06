"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";

export interface LighthouseSummary {
  performance: number;
  accessibility: number;
  best_practices: number;
  seo: number;
  top_recommendations: Array<{ id: string; title: string; description: string; impact: string }>;
  estimated_lcp_ms: number | null;
  estimated_cls: number | null;
  fetched_at: string;
}

export interface ProofArtifactRow {
  id: string;
  pitch_id: string;
  artifact_type: "lighthouse" | "sample_component" | "video" | "custom";
  target_url: string;
  summary: string | null;
  metadata: LighthouseSummary | Record<string, unknown> | null;
  status: "pending" | "running" | "complete" | "failed";
  error: string | null;
  generated_at: string | null;
  created_at: string;
}

export function useProofArtifacts(pitchId: string | undefined) {
  const [artifacts, setArtifacts] = useState<ProofArtifactRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pitchId) {
      setLoading(false);
      return;
    }
    const pid = pitchId;
    const supabase = getSupabaseBrowser();

    async function load() {
      const { data } = await supabase
        .from("proof_artifacts")
        .select("*")
        .eq("pitch_id", pid)
        .order("created_at", { ascending: false });
      setArtifacts((data as ProofArtifactRow[] | null) ?? []);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`proof-${pid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "proof_artifacts", filter: `pitch_id=eq.${pid}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pitchId]);

  return { artifacts, loading };
}
