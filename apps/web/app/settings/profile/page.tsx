"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "../../../components/Sidebar";
import { useSession } from "../../../lib/auth";
import { useStats } from "../../../hooks/useStats";
import { getSupabaseBrowser } from "../../../lib/supabaseBrowser";

interface ProfileForm {
  display_name: string;
  bio: string;
  hourly_rate: number;
  skills: string;
  portfolio: string;
}

export default function ProfileSettingsPage() {
  const session = useSession();
  const userId = session?.user.id;
  const { leadsQueued, pitchesSent } = useStats(userId);

  const [form, setForm] = useState<ProfileForm>({
    display_name: "",
    bio: "",
    hourly_rate: 0,
    skills: "",
    portfolio: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    const supabase = getSupabaseBrowser();
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, bio, hourly_rate, skills, portfolio_urls")
        .eq("id", uid)
        .single();
      if (data) {
        setForm({
          display_name: data.display_name ?? "",
          bio: data.bio ?? "",
          hourly_rate: data.hourly_rate ?? 0,
          skills: Array.isArray(data.skills) ? (data.skills as string[]).join(", ") : "",
          portfolio: Array.isArray(data.portfolio_urls) ? data.portfolio_urls.join("\n") : "",
        });
      }
      setLoading(false);
    })();
  }, [userId]);

  async function handleSave() {
    if (!userId) return;
    setError(null);
    setSaving(true);
    try {
      const supabase = getSupabaseBrowser();
      const skills = form.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const portfolio_urls = form.portfolio
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const { error: e } = await supabase
        .from("profiles")
        .update({
          display_name: form.display_name,
          bio: form.bio,
          hourly_rate: form.hourly_rate,
          skills: skills as never,
          portfolio_urls,
        })
        .eq("id", userId);
      if (e) throw new Error(e.message);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const userMeta = session?.user
    ? {
        userName:
          (session.user.user_metadata?.full_name as string | undefined) ??
          session.user.email?.split("@")[0] ??
          "You",
        userHandle: session.user.email ?? "",
        userInitials: (
          (session.user.user_metadata?.full_name as string | undefined) ??
          session.user.email ??
          "?"
        )
          .slice(0, 2)
          .toUpperCase(),
      }
    : undefined;

  return (
    <div className="oc-app">
      <Sidebar
        {...userMeta}
        inboxCount={leadsQueued}
        pitchesCount={pitchesSent}
        initialActive="settings"
      />
      <main className="oc-main">
        <div className="oc-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href={"/settings" as never} style={{ color: "var(--fg-secondary)", display: "flex", alignItems: "center", textDecoration: "none" }}>
              <ArrowLeft size={16} strokeWidth={1.5} />
            </Link>
            <div>
              <h1 className="oc-h1">Profile</h1>
              <div className="oc-h1-sub">Used by the LLM when scoring leads and drafting pitches.</div>
            </div>
          </div>
          <div className="oc-topbar-actions">
            <button className="oc-btn oc-btn-primary" onClick={handleSave} disabled={saving || loading}>
              <Save size={13} strokeWidth={1.5} />
              {saving ? "Saving…" : savedAt ? "Saved" : "Save"}
            </button>
          </div>
        </div>
        <div className="oc-content" style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
          {loading ? (
            <div className="oc-meta">Loading…</div>
          ) : (
            <>
              <Field label="Display name">
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="oc-input"
                />
              </Field>
              <Field label="Hourly rate (USD)">
                <input
                  type="number"
                  value={form.hourly_rate}
                  onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })}
                  className="oc-input"
                />
              </Field>
              <Field label="Skills (comma-separated)">
                <input
                  type="text"
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="Next.js, React, TypeScript, Tailwind, Supabase"
                  className="oc-input"
                />
              </Field>
              <Field label="Bio">
                <textarea
                  rows={5}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="oc-textarea"
                  placeholder="Two-paragraph self-description: what you build, how you work, signature wins."
                />
              </Field>
              <Field label="Portfolio URLs (one per line)">
                <textarea
                  rows={4}
                  value={form.portfolio}
                  onChange={(e) => setForm({ ...form, portfolio: e.target.value })}
                  className="oc-textarea"
                  placeholder="https://example.com/case-study-1&#10;https://example.com/case-study-2"
                />
              </Field>

              {error && (
                <div style={{ color: "#EF4444", fontSize: 12, padding: "10px 14px", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        className="oc-mono"
        style={{
          fontSize: 11,
          color: "var(--fg-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
