---
name: openclaw-design
description: Use this skill to generate well-branded interfaces and assets for OpenClaw Venture Partner, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

Key entry points:
- `README.md` — brand context, content fundamentals, visual foundations, iconography
- `colors_and_type.css` — design tokens (CSS vars for colors, type, spacing, radii)
- `fonts/` — Geist Sans, Geist Mono, Geist Pixel webfonts
- `assets/` — logos, favicon, OG image, Lucide icon set
- `preview/` — single-purpose cards demonstrating each token / component
- `ui_kits/dashboard/` — pixel-fidelity recreation of the Venture Partner web app (sidebar + lead table + detail pane + activity rail)

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Non-negotiable rules
- Dark by default; coral `#FF4D4D` is the only accent that drives action. Teal `#00E5CC` is reserved for "agent is working" live states — do not use for buttons or links.
- No gradients. No drop shadows beyond very subtle elevation. No rounded corners > 12px. No emoji as iconography (Lucide only, 16/20px, stroke 1.5).
- Geist Sans for UI; Geist Mono for IDs, scores, timestamps, code. Weights 400/500/700 only.
- Spacing on a 4px grid: 4 8 12 16 24 32 48 64. Density is Linear-tier, not consumer-app.
- Voice: direct, technically precise. "Run scout" not "Let's find some leads!" No exclamation marks. No emoji in product copy.
