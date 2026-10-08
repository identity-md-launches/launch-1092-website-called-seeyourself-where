# SeeYourself design system

## Overview

SeeYourself is a small private video studio for people making a main-character moment from a selfie. The implemented direction is warm, dark, and cinematic: an almost-black canvas, warm white type, restrained orange actions, licensed film stills, and a contrasting serif phrase in the home headline. Layout is spacious on the home page and task-focused inside the studio. It is a single dark theme; no alternate theme is implemented.

The home hero is a two-column introduction with a cropped looping sample, a small tilted ticket, and a short pitch. Interior pages reuse the shared container, header, progress steps, forms, cards, and footer; they do not repeat the hero arrangement. Source of truth: `src/styles.css`, reusable components in `src/ui.tsx`, recorder in `src/Capture.tsx`, and page patterns in `src/App.tsx`.

## Colors

Canonical source values are hexadecimal sRGB. Components use semantic properties that reference the primitive neutral/orange/status colors in `:root` (`src/styles.css:8`).

| Semantic token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#111110` | Page canvas; dark text on orange |
| `--color-surface` | `#191918` | Cards, dialogs, upload surface |
| `--color-raised` | `#20201e` | Selected filters, icons, notices |
| `--color-hover` | `#292927` | Neutral hover state |
| `--color-border` | `#41413d` | Form, button, and panel boundaries |
| `--color-number` | `#77776e` | Large numbered process steps |
| `--color-muted` | `#aaa9a2` | Secondary copy and metadata |
| `--color-soft` | `#d9d7cf` | Softer primary details; hero ticket fill |
| `--color-text` | `#f5f3ec` | Primary copy and headings |
| `--color-accent` | `#fa9360` | Primary actions, logo, deliberate headline emphasis |
| `--color-accent-hover` / `--color-focus` | `#ffac82` | Primary hover and focus perimeter |
| `--color-on-accent` | `#111110` | Primary button label |
| `--color-success` | `#a8d5b4` | Captured/verified success text with an icon |
| `--color-error` | `#ffaba3` | Errors and destructive action emphasis |

Measured from rendered computed styles: primary text/page **17.02:1**, secondary text/page **8.01:1**, large step numbers/page **4.18:1**, and primary button text/orange **8.46:1**. Exact pairs and thresholds are in `artifacts/browser-results.json`. These measurements do not certify all text over every moving-video frame. Badges have dark backgrounds; media captions also use a dark gradient and text shadow.

## Typography

- **Manrope** is bundled as a Latin variable WOFF2 (`public/fonts/manrope-latin.woff2`), weights 400–800, normal style, `font-display: swap`. Fallback: Arial, sans-serif. Browser font loading was checked. Body uses 400; action labels generally 650; headings 500–600; logo 750. Synthesis is disabled.
- The italic home phrase uses **Georgia**, then Times New Roman, serif; this intentionally contrasts with Manrope. Georgia is a system font, not bundled. The system fallback can vary by platform.
- Base size: 16px. Named roles: `--text-xs: .75rem`, `--text-sm: .8125rem`, `--text-body: .9375rem`, `--text-lg: 1.125rem`, `--text-title: 2.25rem`. Local small editorial labels and metadata are separate from body text.
- Interior h1: `clamp(2.35rem, 4vw, 3.4rem)`, line height 1.12, tracking `-.055em`. At the small layout it is 2.3rem, with page-specific variants for results and pricing.
- Home h1: `clamp(3.6rem, 5.5vw, 5.1rem)`, 1.075 line height, `-.07em` tracking. It steps down through 4.25rem, 3.6rem, and the mobile clamp, reaching 3.15rem below 23rem.
- General h2: 2.25rem, 1.2 line height, `-.045em`; home section titles intentionally use 1.7rem, then 1.5rem. Card h3 is subordinate, around .78–.95rem according to its grid.
- Paragraph line height is 1.7; longer interior copy is limited to about 65ch. Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`. Price, credit, duration, and recorder values use tabular numerals.
- Final mobile scene metadata is `.6875rem` (11px), with `.625rem` (10px) duration/category badges. Form inputs use 1rem where text is entered. No essential title is truncated.

## Layout

The spacing vocabulary is 4, 8, 12, 16, 24, 32, 48, and 64px, declared as `--space-1` through `--space-8`; components also use deliberate optical/local insets. `.container` is at most 1200px with 48px side margins in the expanded layout. At 70rem margins become 32px, at 56rem 24px, at 42rem 20px, and below 23rem 16px. Most inline spacing uses logical properties.

| Breakpoint | Implemented behavior |
| --- | --- |
| Above 1450px | Slightly taller home hero and sample |
| At 70rem (1120px) | Compact navigation and hero gaps; reduced outer margins |
| At 56rem (896px) | Two-column home cards; hide credit pill; toolbar stacks; result becomes one column |
| At 42rem (672px) | Header menu replaces navigation; hero and setup become one column; decorative setup aside disappears; steps and pricing stack; library remains two columns |
| At 23rem (368px) | Tighter headline/card/step sizing and dialog actions stack |

The expanded home grid has four columns. The clip library has three columns, reducing to two at 42rem. Setup is a form plus supporting aside; its form controls stay in normal document flow. Results use a wide video with an adjacent action area above 56rem. Pricing uses three equal cards above 42rem. Long filter sets wrap instead of requiring an invisible horizontal scroll area.

The browser checked 320, 390, 768, and 1440 CSS-pixel widths across home, setup, library, history, pricing, privacy, and the empty result route: no document overflow. Populated result playback was exercised at desktop width. A separate 200% root-font enlargement check of the library at 768px passed; this is not a browser-native zoom test. Mobile/full-page screenshots were inspected at 390px. Physical phones and all intermediate widths were not tested.

## Elevation & Depth

Most of the interface is flat. Tonal surface changes group content. Low-opacity white lines separate header/footer and major sections; media uses a one-pixel white outline at 10% opacity. Form/button borders remain explicit. The hero ticket uses `0 8px 30px #0002` and a -3-degree rotation; this is a home-specific flourish, not a card rule.

Native dialogs sit in the top layer with `#000c` backdrop and 6px blur, a 16px radius, and `0 24px 90px #0006` shadow. The persistent dismissible status toast uses a raised surface, a `0 6px 30px #0004` shadow, and z-index 50. Decorative hero layers ignore pointer input. The toast respects the bottom safe area on small screens.

## Shapes

- Actions: 8px radius; neutral actions are bordered, the primary action is filled orange.
- Image cards: 10px radius, 8px in the small layout; hero media: 16px.
- General panels/upload: 12px; supporting aside: 14px.
- Dialogs: 16px, reducing to 12px on small screens, inset at least 16px from viewport edges.
- Small badges: 4–7px; circular record/status marks and icon frames retain their geometric roles.

## Components

| Component/pattern | Source and reuse |
| --- | --- |
| `Brand` | `src/ui.tsx`; home link with Lucide ScanFace in the orange mark |
| `ClipCard` | `src/ui.tsx`; whole native button, decorative thumbnail, title, category, duration, optional tag; hover/focus shows play affordance |
| `SamplePlayer` | `src/ui.tsx`; local WebM + MP4 sources, honest sample label; hero variant loops muted and has an explicit play/pause button |
| `Modal` | `src/ui.tsx`; native `dialog.showModal()`, labeled title, initial close-button focus, Tab boundary handling, Escape cancellation, previous-focus restoration, scroll locking |
| `Capture` | `src/Capture.tsx`; face/voice modes, permission/error/pending/recording states, visible countdown, stop action, track cleanup on exit |
| Buttons | `.button.primary`, `.secondary`, `.large`, `.small`, `.full`, `.danger`, `.danger-fill`; only relevant primary action gets orange. Icon buttons have accessible labels |
| `FlowSteps` | `src/App.tsx`; ordered three-stage indicator; active/completed text and icons, not color alone |
| Upload and consent | `src/App.tsx`; native labeled file input, keyboard-visible upload focus, drag/drop, bound consent checkbox, alert errors and invalid-state metadata |
| Filters/search | Native buttons with `aria-pressed`, visible selected surface, labeled search field, clear-filters recovery |
| Result/history | Watermarked samples, download/share fallback, confirmations before deletion, stable metadata-only storage |
| Notices | Persistent live-region toast with dismissal; inline alert for errors; no disappearing action/error message |

Custom focus perimeter is 2px solid `--color-focus`, offset 4–5px. Forced colors preserve system-color outlines and visible control borders. Regular actions are at least 44–46px high, with 40px compact actions separated by gaps. Press scale is .96 and hover transitions are 150ms with `cubic-bezier(.2,0,0,1)`. All CSS animation/scale transitions live inside the no-reduced-motion media query; reduced motion also pauses hero autoplay. The generation state keeps descriptive text when motion is disabled.

## Do’s and Don’ts

- Start a new interior page with `.container.page`, one h1, `.page-heading`, and the existing navigation/footer. Preserve the hash-route model and relative local asset paths.
- Use the orange primary style for the principal task; use neutral secondary buttons for alternatives and explicit destructive wording for deletion.
- Keep essential labels visible, use real buttons/links, reuse native dialog semantics, and retain focus/recording cleanup behavior.
- Add tokens for new semantic roles; do not use border colors as secondary text colors. Keep the implemented dark palette rather than introducing unrelated gradients or an unrequested theme.
- Keep sample and live behavior distinguishable. Never mark a capture verified locally or present source footage as a face-swapped result. Provider secrets belong only in the backend host.
- Preserve local fonts, complete media formats, export assets, source notices, and real validation records. Do not add dependency archives to meet offline preview needs.

The six-domain review, corrections, exact test results, and remaining live-service/accessibility limitations are recorded in `artifacts/validation.md`.
