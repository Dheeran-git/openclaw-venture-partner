"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { getSupabaseBrowser } from "../../lib/supabaseBrowser";

const SKILL_OPTIONS = [
  "React", "Next.js", "TypeScript", "JavaScript",
  "Node.js", "Python", "Vue.js", "Svelte",
  "UI Design", "Tailwind CSS", "GraphQL", "PostgreSQL",
  "AWS", "Docker", "Figma", "Mobile (React Native)",
];

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/London", "Europe/Berlin",
  "Europe/Paris", "Asia/Kolkata", "Asia/Tokyo", "Asia/Singapore",
  "Australia/Sydney",
];

type Step = "profile" | "skills" | "connect";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile step state
  const [displayName, setDisplayName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  // Skills step state
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [bio, setBio] = useState("");

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  async function handleProfileNext(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    setError(null);
    setStep("skills");
  }

  async function handleSkillsNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStep("connect");
  }

  async function handleFinish() {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired. Please sign in again.");
      setLoading(false);
      return;
    }

    const { error: upsertErr } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: displayName.trim(),
      hourly_rate: hourlyRate ? Number(hourlyRate) : null,
      skills: selectedSkills,
      bio: bio.trim() || null,
    });

    if (upsertErr) {
      setError(upsertErr.message);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  const steps: { id: Step; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "skills", label: "Skills" },
    { id: "connect", label: "Connect" },
  ];
  const stepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-[480px]">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Image src="/assets/openclaw-mark-flat.svg" alt="" width={24} height={24} />
          <span className="text-16 font-bold tracking-tight text-fg-primary">OpenClaw</span>
          <span className="font-mono text-12 text-fg-secondary uppercase tracking-wide">Venture Partner</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-12 font-mono font-bold transition-colors ${
                  i < stepIndex
                    ? "bg-coral text-white"
                    : i === stepIndex
                    ? "bg-coral/20 text-coral border border-coral/40"
                    : "bg-bg-card border border-border-subtle text-fg-dim"
                }`}
              >
                {i < stepIndex ? <Check size={12} /> : i + 1}
              </div>
              <span
                className={`text-12 font-mono ${
                  i === stepIndex ? "text-fg-primary" : "text-fg-dim"
                }`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className="w-8 h-px bg-border-subtle mx-1" />
              )}
            </div>
          ))}
        </div>

        <div className="bg-bg-elevated border border-border-subtle rounded-lg p-8">
          {error && (
            <div className="mb-4 px-3 py-2 rounded-md bg-error-bg border border-error/30 text-14 text-error">
              {error}
            </div>
          )}

          {step === "profile" && (
            <>
              <h1 className="text-20 font-bold text-fg-primary tracking-tight mb-1">Your profile</h1>
              <p className="text-14 text-fg-secondary mb-6">
                This helps the agent tailor leads and pitches to you.
              </p>
              <form onSubmit={handleProfileNext} className="flex flex-col gap-4">
                <div>
                  <label className="block font-mono text-12 text-fg-secondary uppercase tracking-wide mb-1">
                    Display name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full bg-bg-card border border-border-subtle rounded-md px-3 py-2 text-14 text-fg-primary placeholder:text-fg-dim outline-none focus:border-border-focus transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-12 text-fg-secondary uppercase tracking-wide mb-1">
                      Hourly rate (USD)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="120"
                      className="w-full bg-bg-card border border-border-subtle rounded-md px-3 py-2 text-14 text-fg-primary placeholder:text-fg-dim outline-none focus:border-border-focus transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-12 text-fg-secondary uppercase tracking-wide mb-1">
                      Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-bg-card border border-border-subtle rounded-md px-3 py-2 text-14 text-fg-primary outline-none focus:border-border-focus transition-colors"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="submit" className="oc-btn oc-btn-primary justify-center w-full mt-2">
                  Continue
                </button>
              </form>
            </>
          )}

          {step === "skills" && (
            <>
              <h1 className="text-20 font-bold text-fg-primary tracking-tight mb-1">Your skills</h1>
              <p className="text-14 text-fg-secondary mb-6">
                Pick the technologies you work with. The agent uses this to score lead relevance.
              </p>
              <form onSubmit={handleSkillsNext} className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {SKILL_OPTIONS.map((skill) => {
                    const selected = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`px-3 py-1 rounded-full border text-12 font-mono transition-colors ${
                          selected
                            ? "bg-coral/10 border-coral/40 text-coral"
                            : "bg-bg-card border-border-subtle text-fg-secondary hover:border-border-emphasis hover:text-fg-primary"
                        }`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="block font-mono text-12 text-fg-secondary uppercase tracking-wide mb-1">
                    Bio <span className="text-fg-dim normal-case">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Senior frontend engineer · 6 years · React/Next.js specialist"
                    className="w-full bg-bg-card border border-border-subtle rounded-md px-3 py-2 text-14 text-fg-primary placeholder:text-fg-dim outline-none focus:border-border-focus transition-colors resize-none"
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setStep("profile")}
                    className="oc-btn oc-btn-secondary flex-1 justify-center"
                  >
                    Back
                  </button>
                  <button type="submit" className="oc-btn oc-btn-primary flex-1 justify-center">
                    Continue
                  </button>
                </div>
              </form>
            </>
          )}

          {step === "connect" && (
            <>
              <h1 className="text-20 font-bold text-fg-primary tracking-tight mb-1">Connect chat</h1>
              <p className="text-14 text-fg-secondary mb-6">
                Connect Telegram or Discord to receive lead alerts and approve pitches from your phone.
              </p>

              <div className="bg-bg-card border border-border-subtle rounded-md p-4 mb-6">
                <p className="font-mono text-12 text-fg-secondary uppercase tracking-wide mb-2">Available in Phase 3</p>
                <p className="text-14 text-fg-secondary">
                  Chat platform binding (Telegram &amp; Discord) is coming in the next phase.
                  You can approve pitches from the web dashboard in the meantime.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("skills")}
                  className="oc-btn oc-btn-secondary flex-1 justify-center"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={loading}
                  className="oc-btn oc-btn-primary flex-1 justify-center"
                >
                  {loading ? "..." : "Get started"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
