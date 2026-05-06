"use client";

import { useState, useMemo } from "react";
import { Check, X, Send, Edit2 } from "lucide-react";
import type { EmailReplyRow } from "../../hooks/useClientDetail";

const CLASSIFICATION_COLOR: Record<string, string> = {
  positive: "#10B981",
  negative: "#8892AB",
  question: "#00E5CC",
  unsubscribe: "#EF4444",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Classifying…",
  classified: "Classified",
  drafted: "Awaiting approval",
  approved: "Sending",
  sent: "Sent",
  rejected: "Rejected",
  failed: "Send failed",
  unsubscribed: "Unsubscribed",
};

async function computeBrowserPayloadHash(input: { id: string; subject: string; draft: string }): Promise<string> {
  // Mirror the canonical-JSON hash from packages/agent/src/drafting/payloadHash.
  // We re-implement here in the browser to avoid bundling the agent package
  // into the client just for this. Order: id, subject, draft.
  const canonical = JSON.stringify({ id: input.id, subject: input.subject, draft: input.draft });
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ReplyCard({ reply }: { reply: EmailReplyRow }) {
  const [selectedIdx, setSelectedIdx] = useState<number>(reply.selected_option_index ?? 0);
  const [editedBody, setEditedBody] = useState<string>(
    reply.approved_body ?? reply.drafted_options?.[selectedIdx]?.body ?? ""
  );
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"select" | "approve" | "reject" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const cls = reply.classification;
  const status = reply.status;
  const isFinal = status === "sent" || status === "rejected" || status === "unsubscribed" || status === "failed";

  function show(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function pickOption(i: number) {
    setSelectedIdx(i);
    if (!editing) {
      setEditedBody(reply.drafted_options?.[i]?.body ?? "");
    }
  }

  async function handleSelect() {
    setBusy("select");
    try {
      const res = await fetch(`/api/replies/${reply.id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_option_index: selectedIdx, edited_body: editedBody }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Save failed");
      }
      setEditing(false);
    } catch (e) {
      show((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleApprove() {
    if (!reply.drafted_subject) return;
    setBusy("approve");
    try {
      // Save selection first if needed, then compute hash from server-stored value.
      if (reply.approved_body !== editedBody || reply.selected_option_index !== selectedIdx) {
        await handleSelect();
      }
      const hash = await computeBrowserPayloadHash({
        id: reply.id,
        subject: reply.drafted_subject ?? "",
        draft: editedBody,
      });
      const res = await fetch(`/api/replies/${reply.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload_hash: hash }),
      });
      if (res.status === 409) {
        show("This reply changed since you reviewed it. Please reload.");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Approve failed");
      }
    } catch (e) {
      show((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    setBusy("reject");
    try {
      const res = await fetch(`/api/replies/${reply.id}/reject`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Reject failed");
      }
    } catch (e) {
      show((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const headerColor = useMemo(
    () => (cls && CLASSIFICATION_COLOR[cls]) ?? "#8892AB",
    [cls]
  );

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Inbound header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="oc-mono" style={{ fontSize: 12, color: "var(--fg-primary)" }}>
            ↩ {reply.from_email}
          </div>
          {reply.subject && (
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-primary)", marginTop: 2 }}>
              {reply.subject}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {cls && (
            <span
              className="oc-pill"
              style={{
                color: headerColor,
                background: headerColor + "1A",
                borderColor: headerColor + "55",
                fontSize: 11,
              }}
            >
              <span className="oc-dot" style={{ background: headerColor }} />
              {cls}
            </span>
          )}
          <span className="oc-mono oc-meta" style={{ fontSize: 11 }}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      {/* Inbound body */}
      <div
        style={{
          fontSize: 13,
          color: "var(--fg-secondary)",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          paddingBottom: 8,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {reply.body_text}
      </div>

      {/* Drafted options (only when status='drafted' or 'approved' and not final) */}
      {(status === "drafted" || status === "approved") && reply.drafted_options && (
        <>
          <div className="oc-mono oc-meta" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Drafted reply — pick a tone, edit if needed, approve to send
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {reply.drafted_options.map((opt, i) => (
              <button
                key={i}
                onClick={() => pickOption(i)}
                className="oc-pill"
                style={{
                  cursor: "pointer",
                  background: selectedIdx === i ? "var(--brand-coral)" : "var(--bg-base)",
                  color: selectedIdx === i ? "#0B0F19" : "var(--fg-secondary)",
                  border: `1px solid ${selectedIdx === i ? "var(--brand-coral)" : "var(--border-subtle)"}`,
                  fontSize: 11,
                  fontWeight: selectedIdx === i ? 600 : 400,
                }}
              >
                {opt.tone}
              </button>
            ))}
          </div>
          {editing ? (
            <textarea
              className="oc-textarea"
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              rows={10}
              style={{ width: "100%" }}
            />
          ) : (
            <div
              style={{
                fontSize: 13,
                color: "var(--fg-primary)",
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
              }}
            >
              {editedBody}
            </div>
          )}
          {!isFinal && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {editing ? (
                  <>
                    <button
                      className="oc-btn oc-btn-secondary"
                      onClick={handleSelect}
                      disabled={busy === "select"}
                    >
                      <Check size={13} strokeWidth={2} />
                      {busy === "select" ? "Saving…" : "Done editing"}
                    </button>
                    <button
                      className="oc-btn oc-btn-ghost"
                      onClick={() => {
                        setEditing(false);
                        setEditedBody(reply.drafted_options?.[selectedIdx]?.body ?? "");
                      }}
                      disabled={busy !== null}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="oc-btn oc-btn-secondary"
                      onClick={() => setEditing(true)}
                      disabled={busy !== null}
                    >
                      <Edit2 size={13} strokeWidth={1.5} /> Edit
                    </button>
                    <button
                      className="oc-btn oc-btn-destructive"
                      onClick={handleReject}
                      disabled={busy !== null}
                    >
                      <X size={13} strokeWidth={2} />
                      {busy === "reject" ? "Rejecting…" : "Reject"}
                    </button>
                  </>
                )}
              </div>
              {!editing && (
                <button
                  className="oc-btn oc-btn-primary"
                  onClick={handleApprove}
                  disabled={busy !== null}
                >
                  {busy === "approve" ? "Sending…" : (
                    <>Approve & send <Send size={13} strokeWidth={1.5} /></>
                  )}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Final state banner */}
      {status === "sent" && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(16,185,129,0.10)",
            borderRadius: 8,
            fontSize: 12,
            color: "#10B981",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Check size={13} strokeWidth={2} /> Reply sent {reply.sent_at && `· ${new Date(reply.sent_at).toLocaleString()}`}
        </div>
      )}
      {status === "rejected" && (
        <div style={{ padding: "8px 12px", background: "rgba(136,146,171,0.10)", borderRadius: 8, fontSize: 12, color: "#8892AB" }}>
          Reply rejected — won&apos;t send.
        </div>
      )}

      {toast && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(239,68,68,0.10)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            fontSize: 12,
            color: "#EF4444",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
