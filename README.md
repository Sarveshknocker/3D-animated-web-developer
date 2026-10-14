# Jarvis Immersive

**A kit you install into any web project that makes your AI coding assistant study the project first, then build an original, interactive 3D/animated site that meets the standards big companies hold their websites to.**

Works with **Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI, Windsurf, Cline/Roo, Aider, Jules, Amp, Zed**, and chat-only AIs.

```
your project ──► 1. Deep dive ──► 2. Creative direction ──► 3. Architecture ──► 4. Build ──► 5. Audit ──► 6. Handover
                  stack, brand,     ≥5 original concepts,     native binding,     tiers,       perf, a11y,   docs +
                  tokens, content,  cliché filter, scoring,   lazy loading,       fallbacks,   SEO, CSP,     measured
                  constraints       best one auto-picked     asset pipeline      motion       fallbacks     budgets
```

## Why it's different
| Typical "3D website" AI output | With this kit |
|---|---|
| Generic floating blob hero | Concepts come from *your* brand, then are scored for novelty, interactivity and shareability; clichés are filtered out |
| Watch-only scroll animations | Every concept has something the visitor **does** (drag, build, pour, paint, reveal…), drawn from 40+ interaction mechanics |
| New stack bolted on | Built in your framework (Next, Astro, Nuxt, SvelteKit, Angular, React, static/WordPress) with your tokens and conventions |
| 5 MB bundle, blank screen on old phones | Poster-first, lazy 3D, device tiers, WebGL fallback, context-loss recovery |
| Ignores accessibility | Reduced motion, pause control, keyboard access, DOM content, WCAG 2.2 AA checklist |
| "Looks done" | A real headless browser runs the page at 3 widths, with reduced motion, without WebGL, keyboard-only and after a forced GPU context loss; screenshots are critiqued and fixed in a loop |
| Idea from the category ("a fintech site") | A subject inventory of 8–12 facts only your brand has, and an idea sentence that must fail the competitor swap |
| Stock HDRIs and textures of unknown origin | CC0 assets from Poly Haven and ambientCG, downloaded safely and recorded in a credits file |

## Install into a project

Requires Node ≥ 18.

```bash
git clone https://github.com/Sarveshknocker/3D-animated-web-developer.git
node 3D-animated-web-developer/bin/jarvis-immersive.mjs init path/to/your-project
```

Or, once this repo is on GitHub, without cloning:

```bash
npx github:Sarveshknocker/3D-animated-web-developer init
```

`init` copies the kit to `your-project/.immersive-kit/` and writes one small instruction file per AI tool. In files you already have (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Copilot instructions), it adds its section between markers and leaves your own text alone.

| File | Read by |
|---|---|
| `AGENTS.md` | Codex, Jules, Amp, Aider, Zed, OpenCode, Factory, Devin… |
| `CLAUDE.md` + `.claude/skills/*` + `.claude/agents/*` | Claude Code |
| `GEMINI.md` | Gemini CLI |
| `.github/copilot-instructions.md` | GitHub Copilot |
| `.cursor/rules/jarvis-immersive.mdc` | Cursor |
| `.windsurf/rules/jarvis-immersive.md` | Windsurf |
| `.clinerules/jarvis-immersive.md` | Cline / Roo Code |

Only some tools: `init . --tools agents,cursor,claude`. To update: `update`. To uninstall: `remove` (your `.immersive/` design docs are kept).

**Claude Code plugin** (alternative): `/plugin marketplace add Sarveshknocker/3D-animated-web-developer` then `/plugin install jarvis-immersive@jarvis-immersive`.

**Codex plugin**: the repo ships `.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`. **Any skills-compatible agent**: `npx skills add Sarveshknocker/3D-animated-web-developer` copies the skills into the agent's skills folder.

## Use it
Open your project in your AI tool and say:

> Deep-dive this project and build me a unique, interactive 3D homepage using the Jarvis Immersive kit.

That one request is enough. It runs the whole pipeline on its own: deep dive, picking the best concept, building, then auditing and fixing in a loop until the checks pass, and handover. Every decision is written to `.immersive/`. If you want to choose the concept yourself, add *"use review mode"*. More prompts are in [prompts/README.md](prompts/README.md).

## What's inside
```
skills/
  immersive-build/              orchestrator: 6-phase workflow, pattern catalogue, spec template
  immersive-deep-dive/          project analysis → PROJECT_BRIEF.md   (scripts/analyze-project.mjs)
  immersive-creative-direction/ originality engine: mechanics library, cliché blacklist, rubric (scripts/concept-dice.mjs)
  immersive-3d-engineering/     stack adapters, perf rules, R3F + vanilla templates (scripts/optimize-assets.mjs, scripts/assets.mjs)
  immersive-motion/             motion tokens, GSAP/Lenis/SplitText/pinned-story templates, CSS scroll-driven reveals
  mnc-web-standards/            the ten laws + 10-section production checklist
  immersive-audit/              static + build + runtime + lab gates   (scripts/audit.mjs)
  immersive-inspect/            real-browser gates, screenshots, critique loop (scripts/inspect.mjs)
agents/                         role briefs: project-analyst, creative-director, quality-auditor
adapters/entry.md               the instruction block written into each AI tool's file
bin/jarvis-immersive.mjs        installer + script runner
prompts/                        ready-to-paste prompts, incl. chat-only AIs
evals/                          blind with-kit vs baseline evaluation cases
research/BENCHMARK.md           what we learned from the top open-source projects
tests/run.mjs                   end-to-end tests incl. real-browser and mock-API tests (npm test)
```

## CLI
```bash
node bin/jarvis-immersive.mjs analyze  <project>          # → .immersive/project-profile.{json,md}
node bin/jarvis-immersive.mjs audit    <project> [--strict] [--json]
node bin/jarvis-immersive.mjs dice     "Brand Name" 6     # divergent concept sparks (seeded)
node bin/jarvis-immersive.mjs optimize <in> <out> [--ktx2] # GLB compression via gltf-transform
node bin/jarvis-immersive.mjs inspect  <url | dist/>      # real-browser gates + screenshots → .immersive/inspect/
node bin/jarvis-immersive.mjs assets   search "studio" --type hdri | get polyhaven:<id> | credits
```

### The inspector
Zero dependencies: it drives the Chrome, Edge or Chromium you already have over the DevTools Protocol (Node ≥ 18).

| Pass | What it proves |
|---|---|
| Desktop 1440, tablet 768, mobile 390 (touch, 2× DPR) | No exceptions, console errors, failed requests or horizontal scroll; CLS/LCP/blocking time; the WebGL canvas really renders; FPS, draw calls per frame, render DPR, bytes; alt text, control names, headings, canvas semantics |
| Reduced motion | The 3D frame holds still and every word is still visible |
| WebGL disabled | No crash, the same content, a designed poster |
| Keyboard only | No focus trap; focus visible |
| WebGL context loss | Losing and restoring the GPU context does not throw |

It saves fold and full-page screenshots for each pass, which the AI then scores with a jury-style rubric (design 40 / usability 30 / creativity 20 / content 10, with caps) and fixes in up to three rounds.
Tip: add `audit --strict` to CI to stop regressions.

## Honest limits
- The kit makes the AI far more disciplined and creative, but **3D assets are still the bottleneck**. For product reveals you need a real model (from CAD, a 3D artist, or photogrammetry). The creative engine prefers concepts that work with the assets you actually have.
- The static audit uses heuristics (pattern matching). The inspector measures the running page, but headless timing is lab data: on machines without a GPU, Chrome renders WebGL in software and FPS is not representative (the report says so). Confirm vitals with Lighthouse and field data.
- The inspector needs an installed Chromium-family browser; without one it exits with code 3 and the audit skill falls back to the manual checklist.
- Template code targets React 18/19, three r17x, R3F v8/v9, GSAP 3.13+. Check versions against your project.

## Related kits
[The-protectors-](https://github.com/Sarveshknocker/The-protectors-) (security) · [The-Ai-Maker-](https://github.com/Sarveshknocker/The-Ai-Maker-) (AI features) · [The-Hardware-engineering](https://github.com/Sarveshknocker/The-Hardware-engineering) (firmware/hardware) · [Idea Enhancer](https://github.com/Sarveshknocker/-Idea-Enhancer-and-Value-Maximiser) · [The-Reconstructor](https://github.com/Sarveshknocker/The-Reconstructor) (architecture recovery).

## Credits
Ideas adapted (re-implemented, not copied) from open-source projects are listed in [CREDITS.md](CREDITS.md); the comparison is in [research/BENCHMARK.md](research/BENCHMARK.md).

## Develop the kit
```bash
npm test        # browser tests run when Chrome/Edge/Chromium is installed (JARVIS_CHROME to point at one)
```
License: MIT.
