---
name: immersive-inspect
description: Open a 3D / animated page in a real headless Chrome, Edge or Chromium and measure it — WebGL actually rendering, FPS and draw calls, LCP/CLS/blocking time, bytes, overflow, hidden content — then re-run it with reduced motion, with WebGL disabled, keyboard-only and after a forced WebGL context loss, save screenshots at three widths, and drive a look-and-fix loop on those screenshots. Use after building or changing any immersive page, before handover, or when asked to review how an existing 3D site really behaves.
---

# Real-browser inspection and the look-and-fix loop

Static checks read code; this skill watches the page run. A scene that throws without WebGL, keeps spinning
under `prefers-reduced-motion`, traps keyboard focus or leaves headings at `opacity: 0` passes code review
all the time. It does not pass this.

## 1. Run the inspector
Serve the build the way users get it (a production build is better than a dev server), then:

```bash
node <kit>/skills/immersive-inspect/scripts/inspect.mjs http://localhost:4321          # running server
node <kit>/skills/immersive-inspect/scripts/inspect.mjs dist/                          # static build folder
node <kit>/skills/immersive-inspect/scripts/inspect.mjs index.html --min-fps 50        # enforce a frame-rate floor
```

Options: `--widths 1440,768,390` · `--skip reduced,nowebgl,keyboard,contextloss` · `--wait 1500` (ms to settle
after load) · `--out .immersive/inspect` · `--json`. Exit code 1 means at least one FAIL; 3 means no browser
was found (set `JARVIS_CHROME=/path/to/chrome`).

What it does, per width (desktop 1440, tablet 768, mobile 390 with touch and 2× DPR):

| Measures | Fails on | Warns on |
|---|---|---|
| Uncaught exceptions, console errors, failed requests | any | console warnings |
| Horizontal overflow | > 1px | |
| CLS, LCP, total blocking time | CLS > 0.25 | CLS > 0.1, LCP > 2.5 s, TBT > 300 ms |
| Text still invisible after a full scroll (reveals that never fire) | any | |
| `<img>` without alt, links/buttons without a name | any | |
| WebGL canvas: blank frame, render DPR, contexts per page | | blank, DPR > 2, > 1 context |
| FPS (rAF) and draw calls per frame | below `--min-fps` on a real GPU | < 30 fps; > 100 draws (mobile/tablet), > 200 (desktop) |
| JS and total bytes during load | | JS > 400 KB, total > 3.5 MB |
| Headings, `lang`, canvas semantics, pause control for a continuously animating scene | | missing / out of order |

Then four resilience passes at the first width:

| Pass | How | Fails on |
|---|---|---|
| Reduced motion | `prefers-reduced-motion: reduce` emulated | the 3D frame keeps changing; text hidden or missing vs normal (warns when most DOM animations still run) |
| WebGL disabled | `getContext('webgl*')` returns null before any page script | exceptions; < 90% of the normal text; hidden text (warns on a blank first screen: show the poster) |
| Keyboard only | 40 × Tab | a focus trap (warns on focus stops without outline/box-shadow) |
| Context loss | `WEBGL_lose_context` lose + restore | exceptions while losing/restoring |

Outputs in `.immersive/inspect/`: `REPORT.md`, `report.json`, `desktop|tablet|mobile-fold.jpg`,
`*-page.jpg` (full page, capped at 8000px), `reduced-motion-fold.jpg`, `no-webgl-fold.jpg`.

Lab honesty: headless numbers are not field numbers. On machines without a GPU, Chrome uses a software
renderer (the report says so) and FPS is not meaningful; LCP and blocking time vary with the machine.
Treat CLS, overflow, exceptions, hidden content, the resilience passes and keyboard results as exact;
treat timing as indicative and confirm with Lighthouse and field data (`immersive-audit`).

## 2. Fix every FAIL, then justify or fix every WARN
Re-run until the exit code is 0. Never weaken a page to satisfy the meter (for example by deleting the
pause button's label to dodge a check, or hiding content from the inspector). If a WARN is deliberate,
write one sentence in HANDOVER.md that a reviewer would accept.

## 3. Look at the screenshots
Passing the meter means nothing measurable is broken. It does not mean the page is good. Open every
screenshot the report lists and critique them with `references/critique.md`: write the scores in its format,
fix the top three problems, run the inspector again, look again. Three rounds at most; report what still
falls short instead of claiming it does not.

Judge the pictures, not the code: if a problem is visible in a screenshot, it is real.

## 4. Record
Copy the measurements table and the final critique scores into `.immersive/HANDOVER.md`, list any WARN you
accepted with its reason, and say which checks could not run (no browser, no GPU, no network).

## Files
- `scripts/inspect.mjs` — the inspector (CLI and importable `inspect()`).
- `scripts/lib/cdp.mjs` — zero-dependency DevTools Protocol client (launch, WebSocket, pages).
- `scripts/lib/probe.mjs` — the scripts injected into the page (instrumentation and snapshots).
- `scripts/lib/png.mjs` — PNG decoding and pixel statistics for the blank/animating checks.
- `references/critique.md` — the screenshot critique rubric and loop.
