"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Github } from "lucide-react";
import { getSupabaseBrowser } from "../../../lib/supabaseBrowser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicMode, setMagicMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const supabase = getSupabaseBrowser();

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (magicMode) {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (err) setError(err.message);
      else setMagicSent(true);
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) {
        setError(err.message);
      } else if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.user.id)
          .single();
        router.push(profile?.display_name ? "/" : "/onboarding");
      }
    }

    setLoading(false);
  }

  async function handleOAuth(provider: "github" | "google") {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
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
          {magicSent ? (
            <div className="text-center">
              <p className="text-16 font-medium text-fg-primary mb-2">Check your email</p>
              <p className="text-14 text-fg-secondary">
                We sent a link to <span className="text-fg-primary">{email}</span>. Click it to sign in.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-20 font-bold text-fg-primary tracking-tight mb-1">Sign in</h1>
              <p className="text-14 text-fg-secondary mb-6">Continue to Venture Partner</p>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-md bg-error-bg border border-error/30 text-14 text-error">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => handleOAuth("github")}
                  className="oc-btn oc-btn-secondary justify-center w-full"
                >
                  <Github size={15} />
                  Continue with GitHub
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth("google")}
                  className="oc-btn oc-btn-secondary justify-center w-full"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-border-subtle" />
                <span className="font-mono text-12 text-fg-dim">or</span>
                <div className="flex-1 h-px bg-border-subtle" />
              </div>

              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
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

                {!magicMode && (
                  <div>
                    <label className="block font-mono text-12 text-fg-secondary uppercase tracking-wide mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-bg-card border border-border-subtle rounded-md px-3 py-2 text-14 text-fg-primary placeholder:text-fg-dim outline-none focus:border-border-focus transition-colors"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="oc-btn oc-btn-primary justify-center w-full"
                >
                  {loading ? "..." : magicMode ? "Send magic link" : "Sign in"}
                </button>
              </form>

              <div className="flex items-center justify-between mt-4 text-14">
                <button
                  type="button"
                  onClick={() => { setMagicMode((m) => !m); setError(null); }}
                  className="text-fg-secondary hover:text-fg-primary transition-colors"
                >
                  {magicMode ? "Use password instead" : "Use magic link"}
                </button>
                {!magicMode && (
                  <Link href="/auth/forgot-password" className="text-fg-secondary hover:text-coral transition-colors">
                    Forgot password?
                  </Link>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-14 text-fg-secondary">
          No account?{" "}
          <Link href="/auth/signup" className="text-coral hover:text-coral-soft transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
