---
name: immersive-creative-direction
description: Generate a genuinely original, highly interactive creative concept for a 3D/animated website from the project's brand DNA. Use in the concept phase of any immersive build, or when the user asks for a website that is "unique", "never seen before", "fun to use", "interactive", or "not template-looking".
---

# Creative Direction — originality engine

Goal: a site people **play with**, remember, and share — not a prettier template. The patterns in `immersive-build/references/patterns.md` are the *floor* (proven execution techniques). This skill decides *what the experience is*.

## Principles
1. **Derive, don't decorate.** Every visual and interaction must come from something true about this brand/product: what it does, how it's made, who uses it, its data, its history, its name. Floating abstract blobs are only allowed when that is honestly the brand.
2. **The user does something.** A great immersive site has at least one *verb* the visitor performs that has a visible, satisfying consequence (build, pour, stretch, sort, grow, reveal, tune, launch). Scrolling alone is not a verb.
3. **Surprise inside a familiar frame.** Navigation, reading and CTAs stay conventional and accessible; the novelty lives in the stage, the transitions and the interactions.
4. **Reward curiosity.** Hidden depth: hover states that tell a secret, an easter egg, a second-visit variation, a state the user creates and can share.
5. **One idea, fully committed.** Execute one concept obsessively (sound-off-by-default sound design, material quality, timing) rather than stacking effects.

## Process

### Step 1 — Brand DNA extraction (from PROJECT_BRIEF.md)
Write 8–12 raw facts into `.immersive/CONCEPTS.md` under "DNA": product mechanics, materials, origin story, data the company owns, user rituals, industry vocabulary, the name's literal meaning, visual assets that already exist, competitors' visual clichés (to avoid).

### Step 2 — Divergence (minimum 5 concepts)
Generate concepts with the remix matrix. Get random sparks from the dice script (seeded by project name, so it's reproducible):

```bash
node <this-skill-dir>/scripts/concept-dice.mjs "<project name>" 6
```

Each roll combines **Metaphor × Mechanic × World × Camera × Twist**. Treat rolls as provocations: keep the good tensions, rewrite the nonsense. Also write at least 2 concepts from pure DNA reasoning without dice. For each concept write:
- One-line pitch ("You ___ the ___ and it ___").
- The user verb and its consequence.
- Why it's *this* brand and could not be a competitor's.
- Signature technique (link to a pattern or mechanic from `references/interaction-mechanics.md`).
- Tier/fallback story (what reduced-motion and no-WebGL users get — must still be delightful, e.g. an illustrated static version).

### Step 3 — Kill clichés
Check every concept against `references/cliche-blacklist.md`. A concept that relies on a blacklisted item as its core idea is discarded or twisted until it's not.

### Step 4 — Score & converge
Score each 1–5 using `references/originality-rubric.md` (Novelty, Brand truth, Interactivity, Shareability, Feasibility within budgets, Accessibility of the core message). Pick the top one. Borrow at most one idea from the runner-up.

### Step 5 — Decide
Default (autonomous): choose the winner yourself, note the top 3 and the reasoning in CONCEPTS.md, and write the winner into EXPERIENCE_SPEC.md sections 1–5. Only if the user asked to review options, present the top 3 as short pitches with scores and let them choose or mix.

## References
- `references/interaction-mechanics.md` — library of 40+ interaction mechanics beyond scroll.
- `references/cliche-blacklist.md` — overused ideas to avoid as a core concept.
- `references/originality-rubric.md` — scoring rubric.
- `scripts/concept-dice.mjs` — seeded divergent concept generator.
