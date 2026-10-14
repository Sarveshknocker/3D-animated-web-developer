---
name: immersive-audit
description: Audit 3D / animated website code against MNC production gates — performance budgets, Core Web Vitals, WCAG 2.2 AA (reduced motion, pause controls, keyboard), SEO, CSP/security, WebGL fallbacks, resource cleanup. Use after implementing immersive features, before shipping, or when asked to review/harden an existing animated site.
---

# Immersive audit

## 1. Static gates (automated)
```bash
node <kit>/skills/immersive-audit/scripts/audit.mjs .          # human report
node <kit>/skills/immersive-audit/scripts/audit.mjs . --json   # machine-readable
node <kit>/skills/immersive-audit/scripts/audit.mjs . --strict # fail on warnings too (CI)
```
Every **FAIL** must be fixed. Every **WARN** is fixed or explicitly justified in HANDOVER.md.

## 2. Build gates
Run the project's own scripts (see `package.json`): lint, typecheck, test, build. The build must pass with zero new warnings. Report the size of the lazy 3D chunk from the build output (or a bundle analyzer).

## 3. Runtime gates (browser)
Run the real-browser inspector on the production build first; it automates most of the table below (see `immersive-inspect`):
```bash
node <kit>/skills/immersive-inspect/scripts/inspect.mjs <url | dist/>
```
Then check by hand what it cannot judge (route changes, HMR, a screen reader), and use this table when no browser can be launched:
| Check | How | Pass criteria |
|---|---|---|
| Desktop render | 1440×900 | Scene renders, no console errors, ≥ 55 fps steady |
| Mobile render | 390×844, touch emulation | Mid/low tier engages, no horizontal scroll, text readable |
| Reduced motion | emulate `prefers-reduced-motion: reduce` | No scrub/parallax/autoplay; content complete |
| No WebGL | block WebGL (Chrome flag `--disable-webgl` or force the fallback flag in code) | Poster fallback, identical DOM content |
| Keyboard | Tab through the page | Visible focus everywhere, no traps, 3D controls reachable |
| Screen reader semantics | Accessibility tree | Headings in order, canvas `aria-hidden` or labelled, CTAs are links/buttons |
| Route change / HMR | Navigate away and back ×3 | No duplicated ScrollTriggers, no memory growth |
| Console | Throughout | Zero errors and zero warnings |

## 4. Lab metrics
```bash
npx lighthouse http://localhost:3000 --preset=perf --form-factor=mobile --output=json --output-path=.immersive/lh-mobile.json
npx @axe-core/cli http://localhost:3000
```
Targets are in `<kit>/skills/mnc-web-standards/references/checklist.md`. Record results in the budgets table of EXPERIENCE_SPEC.md.

## 5. Look
Critique the inspector's screenshots with `immersive-inspect/references/critique.md` (three rounds at most). Gates prove nothing is broken; the critique decides whether it is good.

## 6. Report
Output a table: gate → status → evidence (numbers, file:line) → fix. Order by severity. For an independent review, use `<kit>/agents/quality-auditor.md` as a sub-agent brief.
