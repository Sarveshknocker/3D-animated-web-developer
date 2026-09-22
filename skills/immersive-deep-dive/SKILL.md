---
name: immersive-deep-dive
description: Deeply analyze the current project (framework, routing, design tokens, fonts, content, assets, existing motion libs, CSP, i18n, tests, deploy) and produce a PROJECT_BRIEF before any 3D/animation work. Use at the start of every immersive build, or when asked to "understand this project" for a redesign.
---

# Deep dive — understand the project before touching it

## Step 1 — Automated profile
Run from the project root (Node ≥ 18, no install needed):

```bash
node <kit>/skills/immersive-deep-dive/scripts/analyze-project.mjs . --out .immersive
```

Read `.immersive/project-profile.md`. It is *facts*, not conclusions. If Node is unavailable, gather the same facts manually using the checklist in Step 2.

## Step 2 — Human-grade reading
Open and actually read (don't skim filenames):
1. `package.json`, framework config (`next.config.*`, `astro.config.*`, `vite.config.*`, `nuxt.config.*`, `angular.json`, `svelte.config.*`), `tsconfig.json`.
2. Root layout / app shell (`app/layout.tsx`, `_app.tsx`, `src/App.*`, `index.html`, `+layout.svelte`, `app.vue`) — providers, fonts, global CSS, metadata.
3. Global styles + Tailwind config / theme files → the **real** design tokens (colors, radii, spacing, type scale). Note light/dark mode handling.
4. The home page and 2 other representative pages — section structure, copy tone, CTA hierarchy.
5. Shared UI components (buttons, cards, nav) — how they are styled and composed; naming and folder conventions.
6. Existing animation code — what patterns are already used; do not introduce a competing system without reason.
7. Security & ops: CSP headers, middleware, image config (`next/image` domains), deploy config, CI workflows.
8. Content sources: CMS client, MDX, i18n message files — anything the 3D scene's text/data must come from.
9. `README`, `CONTRIBUTING`, any `docs/` — stated product purpose and audience.

Large repo? Work in focused batches, or delegate to a sub-agent using `<kit>/agents/project-analyst.md` as its brief.

## Step 3 — Write `.immersive/PROJECT_BRIEF.md`
Use this structure; keep it under ~150 lines; cite file paths for every claim.

```markdown
# PROJECT_BRIEF — <name>
## 1. What this is
Product, audience, business goal of the site, primary conversion (CTA).
## 2. Brand DNA
Personality, tone of copy, color tokens (name → value), type (families, scale), imagery style,
existing logos/assets usable in 3D, what the product physically/conceptually *is*.
## 3. Technical landscape
Framework + version + router, rendering mode (SSR/SSG/SPA), styling system, component conventions
(folder, naming, client/server boundaries), package manager, TS strictness, lint/format rules.
## 4. Existing motion & 3D
What exists, quality, what to keep/replace.
## 5. Constraints
CSP, browser support, i18n/RTL, analytics/consent, performance baseline if measurable,
hosting limits (e.g. edge bundle size), accessibility commitments, legal (asset licenses).
## 6. Integration points
Exactly where an immersive layer would mount (file + component), what data it can consume.
## 7. Risks & unknowns
Questions to ask the user; things the analyzer flagged.
```

## Step 4 — Infer, don't ask
If brand intent, audience or conversion goal is unclear, infer the most plausible answer from the code, copy and README, record it under "Assumptions" in the brief, and proceed. Ask the user only if they requested review mode.

## Rules
- Never modify project files during the deep dive (only write inside `.immersive/`).
- Suggest adding `.immersive/` to version control — it documents design decisions for the team.
