export default function Page() {
  return (
    <main className="min-h-screen p-8">
      <p className="eyebrow">PHASE 1 SCAFFOLD</p>
      <h1 className="mt-2">OpenClaw Venture Partner</h1>
      <p className="text-fg-secondary mt-3 max-w-prose">
        Design tokens wired. Geist Sans + Geist Mono loading. Ready for the
        dashboard shell.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          className="rounded-md bg-coral px-4 py-2 text-fg-on-coral font-medium transition-colors duration-base ease-out hover:bg-coral-soft focus:outline-none focus:shadow-ring-coral"
        >
          Run scout
        </button>
        <button
          type="button"
          className="rounded-md border border-border-subtle bg-bg-card px-4 py-2 text-fg-primary font-medium transition-colors duration-base ease-out hover:border-border-emphasis"
        >
          View leads
        </button>
        <span className="font-mono text-12 tracking-tag uppercase text-fg-secondary">
          LAYER 1
        </span>
        <span className="font-mono text-fg-primary">87</span>
      </div>
    </main>
  );
}
