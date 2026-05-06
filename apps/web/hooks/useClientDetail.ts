"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";

export interface ClientDetail {
  id: string;
  company_name: string;
  contact_email: string | null;
  source_lead_id: string | null;
  status: string | null;
  memory_md: string | null;
  created_at: string;
}

export interface EmailReplyRow {
  id: string;
  pitch_id: string;
  client_id: string | null;
  from_email: string;
  subject: string | null;
  body_text: string;
  received_at: string;
  classification: "positive" | "negative" | "question" | "unsubscribe" | null;
  classification_confidence: "high" | "medium" | "low" | null;
  classification_reasoning: string | null;
  drafted_subject: string | null;
  drafted_options: Array<{ tone: string; body: string }> | null;
  drafted_reasoning: string | null;
  selected_option_index: number | null;
  approved_body: string | null;
  payload_hash: string | null;
  status:
    | "pending"
    | "classified"
    | "drafted"
    | "approved"
    | "sent"
    | "rejected"
    | "failed"
    | "unsubscribed";
  sent_at: string | null;
  created_at: string;
}

export function useClientDetail(clientId: string | undefined) {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [replies, setReplies] = useState<EmailReplyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    const cid = clientId;
    const supabase = getSupabaseBrowser();

    async function load() {
      const [clientRes, replyRes] = await Promise.all([
        supabase.from("clients").select("*").eq("id", cid).single(),
        supabase
          .from("email_replies")
          .select("*")
          .eq("client_id", cid)
          .order("received_at", { ascending: true }),
      ]);
      setClient((clientRes.data as ClientDetail | null) ?? null);
      setReplies((replyRes.data as EmailReplyRow[] | null) ?? []);
      setLoading(false);
    }
    load();

    const ch = supabase
      .channel(`client-${cid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients", filter: `id=eq.${cid}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_replies", filter: `client_id=eq.${cid}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [clientId]);

  return { client, replies, loading };
}
