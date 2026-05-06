"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Edit2, Check, X, Send } from "lucide-react";
import { usePitch } from "../../hooks/usePitch";
import type { PitchStatus } from "@openclaw/db/types";

interface PitchCardProps {
  leadId: string;
}

const STATUS_STYLE: Record<PitchStatus, { color: string; label: string }> = {
  draft: { color: "#00E5CC", label: "Draft" },
  approved: { color: "#10B981", label: "Approved" },
  sent: { color: "#10B981", label: "Sent" },
  rejected: { color: "#8892AB", label: "Rejected" },
  send_failed: { color: "#EF4444", label: "Send failed" },
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "#10B981",
  medium: "#D6B82A",
  low: "#EF4444",
};

export function PitchCard({ leadId }: PitchCardProps) {
  const { pitch, loading } = usePitch(leadId);
  const [isDrafting, setIsDrafting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | "edit" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const prevPitchId = useRef<string | null>(null);
  const isNewArrival = useRef(false);

  // When pitch arrives for the first time in this session, flag for fade-in
  useEffect(() => {
    if (pitch && prevPitchId.current !== pitch.id) {
      if (prevPitchId.current === null) {
        isNewArrival.current = isDrafting;
      }
      prevPitchId.current = pitch.id;
      setIsDrafting(false);
      setEditBody(pitch.draft);
    }
  }, [pitch?.id, pitch?.draft, isDrafting]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleDraft() {
    setIsDrafting(true);
    try {
      const res = await fetch("/api/pitches/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to start draft");
      }
    } catch (err) {
      setIsDrafting(false);
      showToast((err as Error).message);
    }
  }

  async function handleApprove() {
    if (!pitch) return;
    setActionLoading("approve");
    try {
      const res = await fetch(`/api/pitches/${pitch.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload_hash: pitch.payload_hash }),
      });
      if (res.status === 409) {
        showToast("This pitch has changed since you reviewed it. Please reload.");
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Approval failed");
      }
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!pitch) return;
    setActionLoading("reject");
    try {
      const res = await fetch(`/api/pitches/${pitch.id}/reject`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Reject failed");
      }
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveEdit() {
    if (!pitch) return;
    setActionLoading("edit");
    try {
      const res = await fetch(`/api/pitches/${pitch.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: editBody }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Save failed");
      }
      setEditing(false);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  function handleCancelEdit() {
    setEditing(false);
    if (pitch) setEditBody(pitch.draft);
  }

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="oc-pitch" style={{ opacity: 0.5 }}>
        <span className="oc-mono oc-meta">Loading…</span>
      </div>
    );
  }

  // ─── No pitch, not drafting ───────────────────────────────────────────────
  if (!pitch && !isDrafting) {
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px dashed var(--border-subtle)",
          borderRadius: 12,
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          textAlign: "center",
        }}
      >
        <p className="oc-meta" style={{ margin: 0 }}>
          No pitch drafted yet.
        </p>
        <button className="oc-btn oc-btn-primary" onClick={handleDraft}>
          Draft pitch
        </button>
        {toast && <ToastBanner message={toast} />}
      </div>
    );
  }

  // ─── Drafting in progress ─────────────────────────────────────────────────
  if (!pitch && isDrafting) {
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span className="oc-dot pulse" style={{ background: "var(--brand-coral)" }} />
        <span className="oc-mono oc-meta">Drafting pitch…</span>
      </div>
    );
  }

  if (!pitch) return null;

  const statusStyle = STATUS_STYLE[pitch.status];
  const isFinal = pitch.status === "sent" || pitch.status === "rejected";
  const reasoning =
    typeof pitch.expected_signal?.reasoning === "string"
      ? pitch.expected_signal.reasoning
      : null;
  const confidence =
    typeof pitch.expected_signal?.confidence === "string"
      ? pitch.expected_signal.confidence
      : null;

  return (
    <div className="oc-pitch" style={{ animation: "fadeIn 0.35s ease-out" }}>
      {/* Head: status + subject */}
      <div className="oc-pitch-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className="oc-pill"
            style={{
              color: statusStyle.color,
              background: statusStyle.color + "1A",
              borderColor: statusStyle.color + "55",
            }}
          >
            <span className="oc-dot" style={{ background: statusStyle.color }} />
            {statusStyle.label}
          </span>
          {confidence && (
            <span
              className="oc-tag oc-mono"
              style={{
                fontSize: 11,
                color: CONFIDENCE_COLOR[confidence] ?? "var(--fg-secondary)",
                background: (CONFIDENCE_COLOR[confidence] ?? "var(--fg-secondary)") + "1A",
                borderColor: (CONFIDENCE_COLOR[confidence] ?? "var(--fg-secondary)") + "44",
              }}
            >
              {confidence}
            </span>
          )}
        </div>
        <span className="oc-mono oc-meta" style={{ fontSize: 11 }}>
          {new Date(pitch.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Subject */}
      {pitch.subject && (
        <div
          style={{
            padding: "10px 0 4px",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: 12,
          }}
        >
          <span className="oc-meta" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Subject
          </span>
          <p
            className="oc-mono"
            style={{ margin: "4px 0 0", fontSize: 13, color: "var(--fg-primary)", lineHeight: 1.4 }}
          >
            {pitch.subject}
          </p>
        </div>
      )}

      {/* Body */}
      {editing ? (
        <textarea
          className="oc-textarea"
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={14}
          style={{ width: "100%", marginBottom: 8 }}
        />
      ) : (
        <div
          className="oc-pitch-body"
          style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 13 }}
        >
          {pitch.draft}
        </div>
      )}

      {/* Reasoning disclosure */}
      {reasoning && (
        <div
          style={{
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            marginTop: 12,
            overflow: "hidden",
          }}
        >
          <button
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--fg-secondary)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
            onClick={() => setReasoningOpen((o) => !o)}
          >
            <span>Reasoning</span>
            {reasoningOpen ? (
              <ChevronUp size={13} strokeWidth={1.5} />
            ) : (
              <ChevronDown size={13} strokeWidth={1.5} />
            )}
          </button>
          {reasoningOpen && (
            <div
              style={{
                padding: "8px 12px 12px",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: 12,
                color: "var(--fg-secondary)",
                lineHeight: 1.65,
              }}
            >
              {reasoning}
            </div>
          )}
        </div>
      )}

      {/* Footer: actions */}
      {!isFinal && (
        <div className="oc-pitch-foot" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {editing ? (
              <>
                <button
                  className="oc-btn oc-btn-secondary"
                  onClick={handleSaveEdit}
                  disabled={actionLoading === "edit"}
                >
                  <Check size={13} strokeWidth={2} />
                  {actionLoading === "edit" ? "Saving…" : "Done editing"}
                </button>
                <button
                  className="oc-btn oc-btn-ghost"
                  onClick={handleCancelEdit}
                  disabled={actionLoading === "edit"}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className="oc-btn oc-btn-secondary"
                  onClick={() => setEditing(true)}
                  disabled={actionLoading !== null}
                >
                  <Edit2 size={13} strokeWidth={1.5} /> Edit
                </button>
                <button
                  className="oc-btn oc-btn-destructive"
                  onClick={handleReject}
                  disabled={actionLoading !== null}
                >
                  <X size={13} strokeWidth={2} />
                  {actionLoading === "reject" ? "Rejecting…" : "Reject"}
                </button>
              </>
            )}
          </div>
          {!editing && (
            <button
              className="oc-btn oc-btn-primary"
              onClick={handleApprove}
              disabled={actionLoading !== null}
            >
              {actionLoading === "approve" ? (
                "Approving…"
              ) : (
                <>
                  Approve &amp; send <Send size={13} strokeWidth={1.5} />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Final state banner */}
      {isFinal && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: statusStyle.color + "12",
            borderRadius: 8,
            fontSize: 12,
            color: statusStyle.color,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {pitch.status === "sent" ? (
            <>
              <Check size={14} strokeWidth={2} /> Pitch sent.
            </>
          ) : (
            <>
              <X size={14} strokeWidth={2} /> Pitch rejected.
            </>
          )}
        </div>
      )}

      {toast && <ToastBanner message={toast} />}
    </div>
  );
}

function ToastBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 14px",
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: 8,
        fontSize: 12,
        color: "#EF4444",
      }}
    >
      {message}
    </div>
  );
}
