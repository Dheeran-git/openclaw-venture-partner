// Fake fixtures for the dashboard. Names, projects, scores fabricated.
window.OC_DATA = {
  user: { name: "Anya Petrov", handle: "anya", initials: "AP" },
  stats: [
    { label: "Leads queued", value: "128", delta: "+18% w/w", deltaPositive: true },
    { label: "Pitches sent", value: "42",  sub: "11 awaiting reply" },
    { label: "Reply rate",   value: "31%", delta: "−4% w/w", deltaPositive: false },
    { label: "Hours saved",  value: "26.4", sub: "vs manual prospecting", accent: true },
  ],
  leads: [
    { id: "lead_8f3c", score: 94, layer: 3, source: "upwork",   title: "Senior Frontend Engineer · Vercel migration", budget: "$8–12k",  age: "4m",   status: "draft-ready" },
    { id: "lead_7d11", score: 88, layer: 3, source: "linkedin", title: "Next.js + Convex consultant for fintech",     budget: "$15–25k", age: "11m",  status: "draft-ready" },
    { id: "lead_6c92", score: 81, layer: 2, source: "contra",   title: "Headless Shopify theme rebuild",              budget: "$6k",     age: "27m",  status: "drafting" },
    { id: "lead_6b04", score: 76, layer: 2, source: "upwork",   title: "Performance audit · ecommerce 800k sessions", budget: "$2–4k",   age: "42m",  status: "draft-ready" },
    { id: "lead_5a77", score: 72, layer: 2, source: "x",        title: "Twitter post: looking for a designer-engineer", budget: "—",     age: "1h",   status: "scouting" },
    { id: "lead_5912", score: 68, layer: 2, source: "linkedin", title: "Design system lead · Series B SaaS",          budget: "$10k/mo", age: "1h",   status: "draft-ready" },
    { id: "lead_4e30", score: 58, layer: 2, source: "linkedin", title: "React dev for agency rebuild",                budget: "$4–6k",   age: "12m",  status: "drafting" },
    { id: "lead_3a18", score: 51, layer: 1, source: "reddit",   title: "Marketing site overhaul (no React preference)", budget: "$3k",   age: "2h",   status: "draft-ready" },
    { id: "lead_2d72", score: 44, layer: 1, source: "github",   title: "Open issue: nuxt 2 → 3 migration help",        budget: "—",      age: "3h",   status: "snoozed" },
    { id: "lead_2099", score: 36, layer: 1, source: "upwork",   title: "Wordpress to Webflow port",                   budget: "$1k",    age: "4h",   status: "rejected" },
    { id: "lead_1c50", score: 0,  layer: 1, source: "upwork",   title: "Looking for cheap react dev",                 budget: "$300",   age: "5h",   status: "archived" },
    { id: "lead_1188", score: 0,  layer: 1, source: "upwork",   title: "$50 fixed-price logo · low fit",              budget: "$50",    age: "5h",   status: "archived" },
  ],
  pitch: {
    id: "pitch_a921",
    leadId: "lead_8f3c",
    status: "pending",
    draftedAgo: "32s",
    body:
`Hi Sara,

Saw your post about migrating the marketing site off Webflow. I rebuilt your pricing page in Next.js as a proof: vercel-pricing-poc.vercel.app — loads 3.2× faster on Slow 4G, same visual fidelity, two days of work end-to-end.

The full migration plan I'd propose:
  • Week 1 — replicate /pricing, /blog index, /docs shell behind a feature flag
  • Week 2 — content migration via your existing CMS export, redirects locked in
  • Week 3 — perf budget, accessibility pass, hand-off

Happy to share the repo and a Loom walkthrough. Or, if you'd rather see the running site first, the link's above — feedback welcome either way.

— Anya
freelance.anya · github.com/anya`,
    pov: { kind: "url", label: "vercel-pricing-poc.vercel.app", note: "3.2× faster on Slow 4G" }
  },
  activity: [
    { kind: "live", text: "Scouting Upwork", meta: "47 PROFILES · 0:03:12" },
    { kind: "ok",   text: "Drafted pitch for Sara at Vercel", meta: "PITCH_A921 · 1m AGO" },
    { kind: "ok",   text: "Built proof-of-value · pricing page rebuild", meta: "POV_044 · 4m AGO" },
    { kind: "warn", text: "LinkedIn rate-limited · retry in 4m", meta: "12m AGO" },
    { kind: "",     text: "Scout run completed · 12 leads added", meta: "RUN_18:00 · 1h AGO" },
    { kind: "ok",   text: "Approved pitch sent to Marco at Linear", meta: "PITCH_A918 · 2h AGO" },
    { kind: "",     text: "Client memory updated · Stripe onboarding notes", meta: "3h AGO" },
  ],
};
