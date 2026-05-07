"use client";

/**
 * Minimal global toast surface. One stack at top-right, auto-dismiss
 * after 4s, manual dismiss via the X. Triggered from anywhere via the
 * `pushToast()` helper, which dispatches a CustomEvent the mounted
 * <ToastStack /> picks up. Mount once at the app root.
 *
 * Tone is one of:
 *   - info    — neutral coral/blue (default)
 *   - success — green
 *   - error   — red
 */
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type Tone = "info" | "success" | "error";

interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

const TOAST_EVENT = "openclaw:toast";
const AUTO_DISMISS_MS = 4500;

interface ToastEventDetail {
  text: string;
  tone?: Tone;
}

export function pushToast(text: string, tone: Tone = "info"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>(TOAST_EVENT, {
      detail: { text, tone },
    })
  );
}

export function ToastStack() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let counter = 0;
    function onPush(e: Event) {
      const detail = (e as CustomEvent<ToastEventDetail>).detail;
      if (!detail?.text) return;
      const id = ++counter;
      const tone: Tone = detail.tone ?? "info";
      setToasts((prev) => [...prev, { id, text: detail.text, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, AUTO_DISMISS_MS);
    }
    window.addEventListener(TOAST_EVENT, onPush);
    return () => window.removeEventListener(TOAST_EVENT, onPush);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 360,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <ToastBanner
          key={t.id}
          toast={t}
          onDismiss={() =>
            setToasts((prev) => prev.filter((x) => x.id !== t.id))
          }
        />
      ))}
    </div>
  );
}

function ToastBanner({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const palette: Record<Tone, { fg: string; bg: string; border: string }> = {
    info: {
      fg: "#FF8C8C",
      bg: "rgba(255,77,77,0.10)",
      border: "rgba(255,77,77,0.40)",
    },
    success: {
      fg: "#10B981",
      bg: "rgba(16,185,129,0.10)",
      border: "rgba(16,185,129,0.40)",
    },
    error: {
      fg: "#EF4444",
      bg: "rgba(239,68,68,0.10)",
      border: "rgba(239,68,68,0.40)",
    },
  };
  const c = palette[toast.tone];
  const Icon =
    toast.tone === "success"
      ? CheckCircle2
      : toast.tone === "error"
        ? AlertCircle
        : Info;

  return (
    <div
      style={{
        pointerEvents: "auto",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 14px",
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        color: "var(--fg-primary)",
        fontSize: 13,
        lineHeight: 1.45,
        boxShadow: "0 8px 24px rgba(0,0,0,0.40)",
        backdropFilter: "blur(6px)",
      }}
    >
      <Icon size={16} strokeWidth={1.75} style={{ color: c.fg, flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1 }}>{toast.text}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--fg-dim)",
          cursor: "pointer",
          padding: 0,
          lineHeight: 0,
          flexShrink: 0,
        }}
      >
        <X size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}
