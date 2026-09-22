---
name: immersive-motion
description: Motion design system and scroll choreography for premium websites — motion tokens, GSAP + ScrollTrigger, Lenis smooth scroll, text reveals, pinned sections, page transitions (View Transitions API), CSS scroll-driven animations, micro-interactions — all with reduced-motion and cleanup built in. Use when adding animation, scroll effects or transitions to a site.
---

# Motion engineering

## 1. Motion tokens first
Add `templates/motion-tokens.css` (adapt names to the project's token convention; with Tailwind, extend `transitionDuration` / `transitionTimingFunction` from the same values). JS reads the same tokens (`templates/motion.ts`) so CSS and GSAP agree.

Timing guidance (from top product sites):
- Micro (hover, press): 120–240 ms, ease-out.
- Reveals: 480–800 ms, expo-out, stagger 40–80 ms, distance ≤ 24 px.
- Hero/choreography: 800–1400 ms; scrubbed scroll has no duration — tune with `scrub: 0.6–1`.
- Exits are ~30 % faster than entrances.

## 2. Engine choice (use what the project has; otherwise)
| Need | Choose |
|---|---|
| Scroll choreography, timelines, pinning, SVG, text splitting | **GSAP 3.13+** (all plugins incl. SplitText/ScrollSmoother are free) + `@gsap/react` `useGSAP` |
| React component state/layout animation | **Motion** (`motion/react`, formerly framer-motion) |
| Smooth scroll | **Lenis** (native-scroll based; keep keyboard & a11y) — optional, only if the concept benefits |
| Simple reveals / parallax, zero JS | **CSS scroll-driven animations** (`animation-timeline: view()`) with `@supports` guard |
| Route transitions | **View Transitions API** (`document.startViewTransition`, Next.js `unstable_ViewTransition` / Astro `<ClientRouter />`) |
| Designer-authored vector animation | **Rive** (interactive) or **dotLottie** |

Never install a second engine that duplicates one already present.

## 3. Templates
- `templates/motion-tokens.css` — duration/easing tokens + global reduced-motion safety net.
- `templates/motion.ts` — tokens for JS, `gsap.matchMedia` breakpoints incl. reduced motion.
- `templates/SmoothScroll.tsx` — Lenis ⇄ GSAP ScrollTrigger sync, disabled under reduced motion.
- `templates/RevealText.tsx` — accessible split-text reveal.
- `templates/PinnedStory.tsx` — pinned, scrubbed chapter scroller driving a `progress` value (feed it to a 3D scene).
- `templates/reveal.css` — zero-JS scroll-driven reveal with fallback.

## 4. Rules
- Animate `transform`, `opacity`, `clip-path`, `filter` only.
- Scope every GSAP animation with `useGSAP` (React) or `gsap.context()` and revert on unmount.
- Wrap all motion in `gsap.matchMedia()` with a `(prefers-reduced-motion: no-preference)` condition; reduced branch sets final states.
- `ScrollTrigger.refresh()` after fonts/images load and after layout-affecting content changes; never in a loop.
- No scroll-jacking; pinned sections must not exceed ~3 viewport heights of scroll on mobile.
- Hover effects only under `(hover: hover) and (pointer: fine)`.
- Text: keep the real string for assistive tech (`aria-label` on parent, split spans `aria-hidden`).
- One shared `requestAnimationFrame`/ticker (GSAP ticker drives Lenis and optionally R3F with `frameloop="never"` + `advance`).
