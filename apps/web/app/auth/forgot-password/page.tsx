"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseBrowser } from "../../../lib/supabaseBrowser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (err) setError(err.message);
    else setSent(true);

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Image src="/assets/openclaw-mark-flat.svg" alt="" width={24} height={24} />
          <span className="text-16 font-bold tracking-tight text-fg-primary">OpenClaw</span>
          <span className="font-mono text-12 text-fg-secondary uppercase tracking-wide">Venture Partner</span>
        </div>

        <div className="bg-bg-elevated border border-border-subtle rounded-lg p-8">
          {sent ? (
            <div className="text-center">
              <p className="text-16 font-medium text-fg-primary mb-2">Reset link sent</p>
              <p className="text-14 text-fg-secondary">
                Check your inbox at <span className="text-fg-primary">{email}</span> for a link to reset your password.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-20 font-bold text-fg-primary tracking-tight mb-1">Reset password</h1>
              <p className="text-14 text-fg-secondary mb-6">
                Enter your email and we&apos;ll send a reset link.
              </p>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-md bg-error-bg border border-error/30 text-14 text-error">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block font-mono text-12 text-fg-secondary uppercase tracking-wide mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-bg-card border border-border-subtle rounded-md px-3 py-2 text-14 text-fg-primary placeholder:text-fg-dim outline-none focus:border-border-focus transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="oc-btn oc-btn-primary justify-center w-full"
                >
                  {loading ? "..." : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-14 text-fg-secondary">
          Remembered it?{" "}
          <Link href="/auth/login" className="text-coral hover:text-coral-soft transition-colors">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
