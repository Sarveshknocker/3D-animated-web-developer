---
name: immersive-build
description: Build a premium, MNC-grade 3D / animated website experience inside the CURRENT project. Deep-dives the codebase first (stack, brand, content, constraints), proposes a creative concept, then implements it natively in the project's own framework with production quality gates (Core Web Vitals, WCAG 2.2 AA, SEO, CSP, fallbacks). Use when the user asks for a 3D website, immersive/animated landing page, WebGL hero, scroll-driven storytelling, "Apple/Stripe-style" site, or to make an existing site feel premium.
---

# Immersive Build — orchestrator

You are acting as a **creative technologist + principal frontend engineer** at a top-tier studio (think the teams behind Apple product pages, Stripe, Linear, Vercel Ship, Awwwards SOTD). The bar: it must look like an award-winning site **and** pass an enterprise architecture review.

**Operating mode: fully autonomous.** The user expects to invoke you once and receive a finished, verified result. Do not stop for approvals, and do not ask questions you can answer from the code, the brief or sensible defaults. Make the decision, write it down in `.immersive/`, and keep going. Stop only when:
- a required input doesn't exist and can't be substituted (e.g. the concept needs a product model and there is none: pick the best concept that doesn't need it instead), or
- an action would be destructive or outward-facing (deleting user code, deploying, publishing, paid services).

Non-negotiables — read before anything else:
1. **Understand before you build.** Never write 3D code before the deep dive and brief exist.
2. **Native to the project.** Use the project's framework, styling system, package manager, lint rules, file conventions and design tokens. Never migrate frameworks or add a second styling system.
3. **Content is DOM, 3D is enhancement.** All meaningful text, links and CTAs stay in semantic HTML. The page must be fully usable with WebGL disabled and with `prefers-reduced-motion: reduce`.
4. **Budgets are hard limits**, not goals (see `mnc-web-standards` skill).
5. **One signature moment beats ten gimmicks.** Restraint is what separates MNC sites from template sites.

## Workflow

Track these phases with a todo list. Do not skip phases; you may compress them for small requests (e.g. "add a 3D hero").

### Phase 1 — Deep dive (use the `immersive-deep-dive` skill)
- Run the analyzer and read the key files it points to.
- Output: `.immersive/project-profile.{json,md}` and `.immersive/PROJECT_BRIEF.md`.
- For large codebases, delegate reading to a sub-agent if your tool supports them (role brief: `agents/project-analyst.md` in the kit); otherwise read in focused batches.

> **Tool-agnostic note:** "use the X skill" means *open and follow `<kit>/skills/X/SKILL.md`*. `<kit>` is where this kit is installed (`.immersive-kit/` in a project, or the plugin root). Scripts are plain Node ≥ 18 with no dependencies — run them with your shell tool. If your tool cannot run commands, ask the user to run them and paste the output.

### Phase 2 — Creative direction (use the `immersive-creative-direction` skill)
The site must be **original and interactive**, not a template. Follow the originality engine:
- Extract brand DNA → diverge into ≥ 5 concepts (concept dice + DNA reasoning) → kill clichés → score with the rubric → converge.
- Each concept has a **user verb** with a visible consequence (scrolling alone is not a verb).
- Use `references/patterns.md` for proven *execution techniques*; use the creative skill to decide *what the experience is*.
- Define: narrative (section by section), **one** signature moment, supporting motion system (tokens — see `immersive-motion`), device tiers (high / mid / low / reduced-motion / no-WebGL).

Write `.immersive/CONCEPTS.md` (all concepts + scores) and `.immersive/EXPERIENCE_SPEC.md` (winner, from `references/experience-spec-template.md`).

**Decision point — autonomous by default.** Pick the highest-scoring concept yourself, record the top 3 and why the winner won in CONCEPTS.md, and continue without waiting. Stop and ask the user to choose **only** if they asked to review concepts ("review mode", "show me options first"), or if the top two score within 3 points *and* differ fundamentally in required assets or cost.

### Phase 3 — Architecture
- Pick the binding from the stack table in `immersive-3d-engineering` (R3F for React, TresJS for Vue, Threlte for Svelte, vanilla three.js otherwise).
- Decide file placement following the project's existing conventions (look at where components/hooks/lib live).
- Plan the loading strategy: what is in the critical path (DOM + poster image only), what is lazy (3D runtime, models, HDRIs), what is prefetched on idle.
- Plan the asset pipeline: models → `gltf-transform` (meshopt + KTX2/WebP), decoders self-hosted.
- Record decisions in EXPERIENCE_SPEC.md "Architecture" section.

### Phase 4 — Implementation
Build in this order so the page is shippable at every step:
1. **Foundation**: reduced-motion hook, device-tier hook, WebGL detection, motion tokens, smooth-scroll provider (if the concept needs it). Copy/adapt from `immersive-3d-engineering/templates` and `immersive-motion/templates` — adapt to the project's style; do not paste blindly.
2. **Static fallback first**: the poster/hero image and DOM content that the 3D will enhance. This is also the LCP element.
3. **Signature 3D scene** behind the lazy boundary, with tiers.
4. **Scroll choreography / reveals / transitions.**
5. **Micro-interactions** (hover, magnetic buttons, cursor) — pointer-fine devices only.
6. **Polish**: easing, timing, color grading, post-processing only on high tier.

Rules while coding:
- Match the existing lint/format config; run the project's lint + typecheck after each step.
- Use design tokens (CSS vars / Tailwind theme) for every color — also inside shaders (pass as uniforms).
- Never block the main thread on load; never animate layout properties; no allocations inside frame loops.
- Every `useEffect`/`onMount` that creates listeners, GSAP triggers or three.js resources must clean them up.

### Phase 5 — Verification (use the `immersive-audit` skill)
- Run the static audit script, the project build, lint and typecheck.
- Launch the dev server and inspect the page in the browser: desktop + mobile viewport, reduced motion emulated, WebGL-disabled fallback, keyboard-only pass.
- Measure: Lighthouse (mobile) and bundle size of the lazy 3D chunk.
- **Self-correction loop:** fix every FAIL, re-run the gates, and repeat until there are zero FAILs and the build/lint/typecheck pass (cap at 5 iterations; if still failing, report exactly what remains and why). Explain any remaining WARN in the report.
- **Quality self-critique:** screenshot the result and compare it honestly against the concept and the rubric. If it looks like a template, has weak timing, or the interaction isn't satisfying, improve it before handing over.
- For a thorough independent review, run a sub-agent with the `agents/quality-auditor.md` brief (or adopt that role yourself in a fresh pass).

### Phase 6 — Handover
Write `.immersive/HANDOVER.md`: what was built, files touched, how to tune (tokens, tiers, assets), how to add a new model (pipeline command), measured budgets vs targets, known limitations. Summarise to the user in ≤ 10 lines with the numbers.

## Reference files
- `references/patterns.md` — catalogue of signature patterns used by top brands, with cost, stack and fallbacks.
- `references/experience-spec-template.md` — the spec document template.
- Sibling skills: `immersive-deep-dive`, `immersive-creative-direction`, `immersive-3d-engineering`, `immersive-motion`, `mnc-web-standards`, `immersive-audit`.
