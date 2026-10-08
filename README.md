# SeeYourself

A dark, mobile-first video studio built with React, TypeScript, and Vite. The finished static site is in **`dist/`**; deploy that directory as-is. All fonts, icons, thumbnails, and 15 five-second sample clips are local. No wallet, blockchain, external font requests, or public gallery.

## What works

- Home with a looping, pausable sample; autoplay stops under reduced motion.
- Selfie file validation and local preview; five-second camera recording; optional twenty-second microphone recording; explicit consent.
- Fifteen categorized clips, search, empty states, keyboard-accessible preview dialogs.
- A clearly labeled sample generation flow with loading, playback, watermarked MP4 downloads, and file-sharing/fallback controls for WhatsApp, X, and Instagram.
- Browser-local sample history, video deletion with confirmation, face/voice deletion, a three-sample allowance, and a credit-pack page after that allowance.
- A backend reference adapter with server-side verification gates, private session-scoped video access, three-credit enforcement, deletion forwarding, and a provider watermark gate.

**The export runs in studio preview mode. It does not perform face swaps, voice cloning, or biometric verification.** Those services are not configured. A camera recording is explicitly labeled captured, not verified. Original footage is never presented as a successful face swap. Checkout is unavailable; prices are proposed examples and no payment is taken. The four Driving/Sports templates are original illustrations with camera motion, not live-action sports/driving footage.

No owner credentials or provider account were supplied. Operator-settable configuration and the backend boundary are included; there are no fabricated credentials, recipient accounts, or provider success responses. See [server/README.md](server/README.md) for the provider contract and the work required for a real launch.

## Install and run

Use Node.js 22.12+ (validated with **Node 24.9.0**, npm 11.6.0).

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Camera/microphone access needs HTTPS or localhost and browser permission.

```sh
npm run typecheck
npm run build
npm run preview
```

Preview defaults to `http://127.0.0.1:4173`. The build uses Vite `base: './'`, local assets, and hash routes, so no rewrite server is needed. Serve over HTTP(S), not `file://`; the app fetches its runtime configuration.

For restricted workspaces, dependencies may be installed in a separate directory and its absolute path supplied as `SEEYOURSELF_DEPS`. The build/typecheck/browser scripts resolve tools from that directory. That option was used during this assignment to keep **all** `node_modules` and package/browser caches under `/tmp`; no ignore file was changed.

## Publish

1. Run the typecheck, build, and tests below.
2. Upload **the complete contents of `dist/`** to any static web host, including its `assets/`, `fonts/`, and `media/` folders, text notices, and `runtime-config.json`.
3. Preserve relative URLs. The site was exercised under `/preview/`, including direct hash URLs such as `/preview/#/clips`.
4. Keep `apiBase` empty for the publicly deployable sample mode. A pure static host cannot execute the optional backend. Never place provider keys or server code in the export.

`dist/` and `public/media/` are required deliverables. Do not remove the export because it can be rebuilt: the publisher serves it without rebuilding. Do not submit dependencies, caches, browser installations, original source-movie downloads, or archives. `npm run audit:bundle` checks the local deliverable content against the 8 MiB budget. The provided workflow did not modify Git metadata or create a submodule.

## Validation

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run audit:bundle
```

The browser test starts an ephemeral HTTP server, serves the **production export at `/preview/`**, runs Chromium and axe, and closes both in the same foreground process. Browser binaries are not part of the export. For a writable temporary installation use `PLAYWRIGHT_BROWSERS_PATH=/tmp/seeyourself-browsers` during install and testing.

Recorded results and limitations are in [artifacts/validation.md](artifacts/validation.md), with machine-readable browser/bundle reports and screenshots in `artifacts/`. The backend tests use an explicitly injected synthetic provider; they validate enforcement logic, not an external AI service. Browser camera and microphone tests use simulated devices and do not establish liveness accuracy.

Final recorded results (2026-10-08): production build **passed**, TypeScript **passed**, **5/5 backend tests passed**, browser interaction suite **passed**, **9 axe scans with 0 violations**, and **28 route/viewport reflow checks without horizontal overflow**. No browser page errors, failed assets, or third-party requests were observed in that final flow. The complete deliverable content is under **8 MiB**; the exact measured bound is in `artifacts/bundle-report.json`.

The supplied browser MCP could not launch because its fixed Chrome installation was missing. Actual rendered verification used the temporary Playwright Chromium installation instead. No external API, payment checkout, physical phone, native share sheet, or screen reader was tested. Worker results are not independent certification.

## Project map

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Hash routes, setup, library, result, history, pricing, privacy |
| `src/ui.tsx` | Brand, scene cards, accessible dialogs, sample player |
| `src/Capture.tsx` | Timed camera/microphone capture and cleanup |
| `src/api.ts` | Same-origin backend client; no provider credentials |
| `src/storage.ts` | Sample metadata only; no biometric persistence |
| `src/styles.css` | Tokens, components, responsive rules |
| `src/catalog.ts` | Fifteen licensed/original templates |
| `public/` | Complete local media, font, notices, runtime settings |
| `server/` | Optional backend reference, separate from the static export |
| `tests/` | Reproducible backend and production-browser checks |
| `DESIGN.md` | Final implemented design system |

## Media and privacy

Eleven silent excerpts and their thumbnails are adapted from **Tears of Steel**, CC BY 3.0, `(CC) Blender Foundation | mango.blender.org`. Four vector-based scenes were created for this implementation and dedicated under CC0. Samples are cropped, muted, compressed, and visibly labeled to demonstrate the AI export disclosure. The source soundtrack is excluded. These are royalty-free source scenes, not licensed clips from popular commercial movies. See [public/media-credits.txt](public/media-credits.txt) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The clips are included; normal builds do not download or re-encode media. To reproduce them, download the attributed movie **outside the repository** and run `node scripts/prepare-media.mjs /tmp/tears-of-steel.mov` with `ffmpeg` available. Sharp is a development dependency. The script writes only the final assets to `public/media/`; intermediary SVG/PNG files go to the system temp directory. It generates MP4 downloads and WebM playback fallbacks.

In sample mode, selfies and recordings stay in page memory and disappear on refresh/close. Only sample IDs, clip IDs, creation dates, and used sample count enter localStorage. People sharing a browser profile can see that history; it is not account-level authentication. Clearing browser storage resets the sample allowance. Deleting individual samples does not reset it. The real backend needs durable authenticated accounts and billing before production use; its current opaque cookie sessions are an integration reference.

Design review used the supplied Better Interface guide across accessibility, layout, writing, typography, color, and UI. Both reference license notices are retained. See the validation record for evidence, fixes, and unperformed checks.
