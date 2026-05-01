# OpenClaw Venture Partner — Design System

> Visual + interaction system for **OpenClaw Venture Partner**, an autonomous AI agent that runs the full deal lifecycle (lead-finding → proof-of-value → pitch → negotiation) for freelancers and small digital agencies. Built on top of the open-source [OpenClaw](https://openclaw.ai) personal-AI-assistant framework.

The product targets solo operators and small agencies who waste 20+ hours a week on manual prospecting and pitch prep. Users interact through a **web dashboard** (the primary surface this system covers) and chat platforms (Telegram, Discord, WhatsApp, Slack).

---

## Personality

Modern professional with a slight technical edge. **Calm, capable, in‑the‑zone.** The reference points are Linear, Vercel Dashboard, Superhuman, and Stripe Dashboard — _not_ Salesforce or HubSpot. The product is opinionated and confident: it does the work, then asks for one tap of approval. The UI should feel the same way.

Dark by default, light mode supported. Operators spend hours triaging leads, so dark mode must read like a developer tool — not a marketing site.

## Sources

- **Brand spec** — provided directly by the team (see `README` body for verbatim guidelines).
- **Logo / OG art** — `uploads/favicon.svg`, `uploads/og-image.png` (the lobster/claw mark with coral body + teal eye-glow).
- **Typeface** — Vercel Geist Sans + Geist Mono, full weight range supplied as `.woff2`. Variable axes available.
- **Underlying framework** — [`github.com/openclaw/openclaw`](https://github.com/openclaw/openclaw) (open-source assistant). The Venture Partner product is a closed-source agent built on top of it; visual identity inherits the OpenClaw mark and coral palette.

---

## Index

| File | What's in it |
|---|---|
| `README.md` | This file — brand context, content rules, visual foundations, iconography. |
| `SKILL.md` | Cross-compatible Agent Skill manifest — load this when prototyping for OpenClaw. |
| `colors_and_type.css` | All design tokens as CSS vars (colors, type scale, spacing, radii, motion) + base element styles + light-mode overrides. |
| `fonts/` | Geist Sans + Geist Mono `.woff2` (regular, medium, semibold, bold + variable). |
| `assets/` | Logos (`openclaw-mark.svg`, `openclaw-mark-flat.svg`, `openclaw-wordmark.svg`), OG image. |
| `preview/` | Atomic design-system cards (type, color, spacing, components, brand) — each registered for the Design System tab. |
| `ui_kits/dashboard/` | Pixel-fidelity recreation of the Venture Partner web dashboard — sidebar, lead inbox, lead detail, pitch approval, client memory. |

---

## Content Fundamentals

OpenClaw copy reads like a senior engineer's commit messages: short, declarative, technical. The agent does the work and reports back; UI strings are the smallest possible label for a real action.

**Voice**
- **Direct + imperative.** "Run scout" not "Let's find some leads." "Approve & send" not "Send it!" "Generate audit" not "Create your audit now ✨".
- **Slightly technical.** It's fine — encouraged, even — to use terms like _scout, layer, signal, run, pipeline, draft, queue_. The user is a power user.
- **No exclamation marks. No emoji in product copy.** The OG art uses an exclamation as a brand wink ("EXFOLIATE! EXFOLIATE!") but that's brand surface, not UI.
- **Confident.** Don't hedge. "3 leads ready for review" — not "We think we found some leads you might like."
- **Second person, sparing.** Address the user as "you" only when needed. Most copy is impersonal action labels: "Approve", "Reject", "Snooze 24h".

**Casing**
- **Sentence case** for buttons, menus, and headings: "Approve and send", not "Approve And Send".
- **ALL CAPS in mono**, with wide tracking, for tags / eyebrow labels / system metadata: `LAYER 2`, `UPWORK`, `RUNNING`. Geist Mono at 12px, `letter-spacing: 0.08em`.
- **Numbers and IDs use Geist Mono** — IDs, scores, timestamps, counts. Numerals never use the proportional sans.

**Examples**
| Bad | Good |
|---|---|
| "Hooray! We found 12 great leads for you 🎉" | "12 leads queued. 4 ready to review." |
| "Send pitch to client?" | "Approve & send" |
| "Oops! Something went wrong." | "Pitch failed to send. Retry or open log." |
| "Let's get started!" | "Run scout" |
| "Lead Score: High" | `87` (mono, with score badge color) |
| "Are you sure you want to delete?" | "Delete pitch draft. This can't be undone." |
| "We're working on it…" | "Scouting Upwork · 2m elapsed" |

**Empty states** — one short factual line, then one action. _"No leads in queue. Run scout."_ Never "Whoops, looks like there's nothing here yet!"

**Loading states** — show what's happening, not a spinner alone. _"Scouting LinkedIn · 47 profiles checked"_. Use the teal accent only for these "AI is working" moments.

**Errors** — name the failure, give the next step. _"Upwork rate-limited. Retry in 4m."_

---

## Visual Foundations

The system is **flat, bordered, dense, and dark.** Linear is the closest visual cousin. There are no gradients, no decorative shadows, no rounded-corner-with-colored-left-border cards.

### Color
- **One accent**, the coral red `#FF4D4D`. Used for primary CTAs, focus rings, brand mark, and the eyebrow/section labels. Never used for body text. Coral has three darker shades (`#FF6B6B` hover, `#C73030` deep, `#7A1F1F` darker) plus the mark.
- **Teal `#00E5CC`** is reserved exclusively for "the agent is working / live / streaming" moments — pulse on the active lead, the activity timeline ticker, the eye-glow in the mark. Never use it as a generic accent.
- **Three background layers** that stack: `#050810` page, `#0A0F1C` sidebar/panel, `#0E1424` cards/inputs. A fourth layer `#131A2C` is only used for row hover.
- **Borders do all the heavy lifting.** Subtle `#1E2538` for default chrome, emphasised `#2A3350` for selected/focused state.
- **Semantic colors are distinct from brand.** `success #10B981`, `warning #F59E0B`, `error #EF4444` (notably _not_ the coral), `info #3B82F6`.
- **Light mode** swaps backgrounds white/near-white and inverts text, but the coral and teal stay identical. It's a true second mode, not a new palette.

### Type
- **Geist Sans** for everything that's a word — UI labels, headings, body. **Geist Mono** for everything that's data — IDs, scores, timestamps, status tags, code, file paths.
- **Three weights only: 400 / 500 / 700.** No light, no extra-bold, no italic in product copy. Italic is reserved for the very rare blockquote.
- Type scale: **12 / 14 / 16 / 18 / 20 / 24 / 32 / 48 px**. 14px is body default; 24px is the standard heading; 12px Mono is metadata.
- Tracking is tight on display sizes (`-0.02em`), normal at 14–16px, wide (`0.08em`) on uppercase mono labels.

### Spacing
- **4px base unit. Use 4, 8, 12, 16, 24, 32, 48, 64.** Anything else is wrong.
- Density target: Linear-level. A lead row is 56px tall. A sidebar item is 32px. The dashboard fits ~12 leads in a 1080p viewport without scrolling.
- Sidebar is **240–280px** wide (we use 256). Main content is capped at **1280–1440px** — generous for table-heavy views.

### Backgrounds
- **No imagery in chrome.** No background images, no patterns, no textures, no gradients. The base color is a flat dark navy. Marketing surfaces (the OG image, login screen) may use a faint star-field SVG pattern to echo the brand art, but the dashboard does not.
- Cards are flat fills (`#0E1424`) with a 1px border — never a shadow card.

### Borders + Radii
- **Borders are 1px, always.** No 2px borders. No double borders. Use `--border-subtle` for default chrome, `--border-emphasis` on hover or selection.
- **Radii: 8px** for buttons, inputs, toggles, badges. **12px** for cards, modals, popovers. **999px (pill)** only for status pills and avatars. **Never larger than 12px** outside of pills.

### Shadow / Elevation
- **No drop shadows on cards.** Elevation is signalled with the layered background colors.
- **Two shadows total** in the entire system, both reserved for floating overlays: `--shadow-popover` for menus/tooltips, `--shadow-overlay` for modals. Both are simple offset shadows — no spread, no blur halos, no inset.

### Animation
- **Nothing longer than 200ms.** Three tiers: `80ms` for tap feedback, `140ms` for hover/focus, `200ms` for panels and overlays.
- Easing is `cubic-bezier(0.22, 0.61, 0.36, 1)` (ease-out) for entrances, `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out) for state changes.
- **No bounce. No spring. No staggered entrances.** The teal "working" pulse is the only continuous animation in the app — a 1.4s opacity loop on a dot.

### Hover + Press
- **Hover** raises the row/card to `--bg-hover` and shifts the border to `--border-emphasis`. Buttons brighten by ~6% (coral → coral-soft).
- **Press** (`:active`) drops opacity to `0.85`. **No translate, no scale.** The button stays in place.
- **Focus** is a 2px coral ring with `40%` alpha — visible against any background, never replaced by `outline: none` alone.
- **Disabled** is `opacity: 0.45` + `cursor: not-allowed`.

### Transparency + Blur
- **No backdrop-filter blur on chrome.** Modals dim the page with a flat `rgba(5, 8, 16, 0.72)` scrim.
- Semantic colors are used at **10% alpha for tinted backgrounds** (e.g. success pill = `rgba(16, 185, 129, 0.10)` fill + full color text + border).

### Cards
- 1px `--border-subtle` border, `--bg-card` fill, **12px radius**, no shadow. Internal padding 16–24px.
- Hover state is _border-only_: `--border-emphasis`. Selected state adds a 1px coral inset border (`box-shadow: inset 0 0 0 1px var(--brand-coral)`).

### Layout rules
- **Sidebar is fixed-position**, full viewport height, `--bg-elevated`. The right edge is `--border-subtle`.
- **Top bar is sticky** within the content area, not the page — when you scroll a long table, the page header scrolls away but the table header (with sort + filters) sticks.
- **Two-pane detail layout** is preferred over modals. Lead detail opens in a right-hand panel, not a centered dialog.

---

## Iconography

We use **[Lucide](https://lucide.dev)** at **16px and 20px** only. Stroke width is `1.5`. No filled icons. No multi-color icons. No emoji in product copy or as iconography.

- **16px** — inline icons in tight contexts (button leading-icons, table cells, breadcrumbs, status pills).
- **20px** — sidebar nav items, panel headers, empty-state hero (when used at 32–40px the same Lucide path is fine; we just up-size).
- **Color** — icons inherit text color (`currentColor`). Active sidebar item icons are `--brand-coral`.

The codebase uses Lucide via `lucide-react` (recommended) or the CDN-hosted SVG sprite. The design system links them from the unpkg CDN. **No substitution required** — Lucide is the source of truth.

OpenClaw's brand mark (the lobster/claw) is _not_ an icon; it's a logo, used at the sidebar header and on auth screens only. Do not use it inline.

**Unicode chars** — the only acceptable ones in product copy are `·` (middle dot, used in metadata: "Upwork · 2m ago"), `→` (in CTAs like "Open detail →" — sparingly), and `↑` `↓` for sort indicators. **No `✓`, no `✗`, no `★`** — use a Lucide icon.

---

## Components covered

Sidebar nav · Buttons (primary / secondary / ghost / destructive) · Text inputs · Textareas · Selects · Search bar · Toggles · Checkboxes · Lead row · Lead detail panel · Score badge (0–100) · Layer badges (L1/L2/L3) · Source badges (Upwork/LinkedIn/etc) · Status pills (draft/approved/sent/rejected) · Pitch card with approval bar · Client row · Client memory view · Activity timeline · Stat cards · Sortable tables · Toasts · Modals · Empty states · Loading skeletons · Error states · Tooltips · Dropdown menus.

See `preview/` for atomic specimens and `ui_kits/dashboard/index.html` for them composed.

---

## File index

| Path | What's there |
|---|---|
| `README.md` | This file — brand context, content + visual fundamentals, iconography |
| `SKILL.md` | Agent-Skills compatible entrypoint; cross-compatible with Claude Code |
| `colors_and_type.css` | All design tokens as CSS vars (colors, type, spacing, radii, semantic vars) |
| `fonts/` | Geist Sans + Geist Mono + Geist Pixel `.woff2` files |
| `assets/` | Logos (`openclaw-mark-flat.svg`, `openclaw-mark-coral.svg`, wordmark), `favicon.svg`, `og-image.png` |
| `preview/` | Single-purpose specimen cards rendered in the Design System tab |
| `ui_kits/dashboard/` | Pixel-fidelity recreation of the Venture Partner web dashboard — sidebar, lead inbox, lead detail with pitch approval, activity rail, toasts |

### UI kits
- **`ui_kits/dashboard`** — the only product surface. Three views composed in `index.html`: lead inbox table, lead detail with pitch approval flow, and activity rail. Open it and click any row to swap the right pane to the detail.

