# Signature pattern catalogue

Pick **one** signature pattern for the hero or centerpiece, and at most two supporting patterns. Choose based on the brand metaphor from PROJECT_BRIEF.md, not on what looks cool in isolation.

Cost key: 💚 light (< 60 KB gz JS extra) · 💛 medium (60–200 KB) · ❤️ heavy (> 200 KB or large assets)

---

## Signature (hero / centerpiece) patterns

### 1. Scroll-scrubbed product reveal (Apple product pages)
- **What**: a product model rotates, explodes or assembles as the user scrolls; copy blocks pin alongside.
- **Best for**: physical products, hardware, devices, packaging, automotive.
- **Stack**: GLB + R3F/three + GSAP ScrollTrigger (scrub) driving a single `progress` value; camera and animation clips read from it. Alternative: image-sequence on `<canvas>` (pre-rendered frames, AVIF) when real-time 3D is too heavy.
- **Cost**: ❤️ (model) — keep model ≤ 2 MB after meshopt/KTX2.
- **Low tier / reduced motion**: static hero renders + fade-in copy; no pinning.

### 2. Interactive globe / network (Stripe, GitHub, Vercel)
- **What**: a dotted or shaded Earth with arcs showing transactions, users, edges, offices.
- **Best for**: global platforms, payments, infra, logistics, SaaS with worldwide users.
- **Stack**: three.js instanced points on a sphere (from a land-mask texture), arcs as tube/line geometry with animated dash offset; data from a JSON the CMS can own.
- **Cost**: 💛. Instancing keeps 20–40k points at 60 fps.
- **Fallback**: pre-rendered looping WebM/AVIF of the globe; reduced motion → static image.

### 3. Fluid gradient mesh (Stripe homepage, Linear)
- **What**: slowly flowing multi-color gradient on a full-bleed plane, driven by noise in a fragment shader, colors from brand tokens.
- **Best for**: fintech, SaaS, abstract brands, when there is no physical product.
- **Stack**: single fullscreen plane + custom ShaderMaterial (simplex noise), or raw WebGL/OGL for minimum weight.
- **Cost**: 💚 (can be < 15 KB with OGL).
- **Fallback**: CSS `conic-/radial-gradient` layered with the same tokens.

### 4. Particle morph (brand mark ⇄ shapes)
- **What**: tens of thousands of particles morph between the logo, product silhouette and abstract forms as the story progresses.
- **Best for**: AI, data, tech brands; launches; "transformation" narratives.
- **Stack**: GPU particles — positions for each target shape baked into attributes/textures; morph via uniform in the vertex shader (no CPU per-particle work).
- **Cost**: 💛.
- **Low tier**: fewer particles (tiered counts: 60k / 20k / 6k); reduced motion → final shape, static.

### 5. Camera flythrough storytelling (Awwwards narrative sites)
- **What**: the scroll position moves the camera along a spline through a 3D world; each stop is a story chapter.
- **Best for**: brand campaigns, annual reports, events, real estate, tourism.
- **Stack**: CatmullRomCurve3 camera path + drei `ScrollControls` or GSAP ScrollTrigger; DOM chapters overlaid with `position: sticky`.
- **Cost**: ❤️. Requires strict asset budgeting and per-chapter lazy loading.
- **Fallback**: chapters become a normal vertical page with illustration stills.

### 6. 3D configurator (Nike By You, automotive, furniture)
- **What**: user changes colors/materials/parts on a real-time model; state reflected in URL.
- **Best for**: e-commerce, D2C, product customisation.
- **Stack**: GLB with named material slots, R3F, state in URL params (shareable), `frameloop="demand"` (render only on change).
- **Cost**: ❤️ but on-demand rendering keeps battery cost near zero.
- **A11y**: every control is a real `<button>`/`<input type="radio">`; the 3D view is `role="img"` with a live-updated aria-label.

### 7. Kinetic typography hero (agencies, Vercel Ship, conference sites)
- **What**: large headline letters split, stagger, mask-reveal, respond to scroll velocity.
- **Best for**: brands where the message is the product; events; when a 3D asset is unavailable.
- **Stack**: GSAP + SplitText (free since GSAP 3.13) or `split-type`; CSS `clip-path` masks; optional variable-font axis animation.
- **Cost**: 💚.
- **A11y**: keep original string in `aria-label` on the parent; split spans `aria-hidden`.

### 8. Scroll-linked image sequence (Apple AirPods)
- **What**: 60–150 pre-rendered frames drawn to a canvas as you scroll — cinematic without real-time 3D.
- **Best for**: when you have renders/video but need guaranteed visual fidelity on every device.
- **Stack**: canvas + ScrollTrigger scrub; frames as AVIF/WebP, progressively loaded (keyframes first, then fill).
- **Cost**: ❤️ in bytes (budget ≤ 4 MB total; fewer frames on mobile) but tiny JS.

---

## Supporting patterns

| Pattern | Use | Stack | Notes |
|---|---|---|---|
| Staggered section reveals | Every content section | GSAP ScrollTrigger batch / IntersectionObserver + CSS | Opacity + translateY ≤ 24px; once only; 400–700 ms |
| Pinned feature scroller | Feature lists, "how it works" | ScrollTrigger pin + scrub | Unpin on mobile if content overflows; reduced motion → plain list |
| Horizontal scroll gallery | Case studies, products | ScrollTrigger containerAnimation | Must remain keyboard scrollable; provide native fallback |
| Page transitions | Route changes | View Transitions API (native in Chrome/Safari/Edge/Firefox 2025+) | Progressive: no-op when unsupported |
| Magnetic buttons / hover tilt | CTAs, cards | pointer events + transform (GSAP quickTo) | `(hover: hover) and (pointer: fine)` only |
| Custom cursor | Creative/agency brands only | quickTo on a fixed element | Never hide the native cursor; skip on touch |
| Hover image distortion | Portfolio grids | Small R3F/OGL plane with displacement shader | Shared single canvas, not one per card |
| Number counters / stat reveals | KPIs, proof | IntersectionObserver + rAF | Final value present in DOM for SEO/SR |
| Lottie/Rive micro-animations | Icons, empty states, onboarding | dotLottie / Rive runtime | Prefer Rive for interactive; lazy-load runtime |
| Marquee / logo wall | Social proof | CSS animation (translateX) | Pause on hover + reduced motion |
| Parallax depth layers | Hero backgrounds | CSS scroll-driven animations (`animation-timeline: scroll()`) with JS fallback | Max 3 layers; small offsets |

---

## Anti-patterns (auto-reject)
- Full-page scroll hijacking (wheel `preventDefault`, snap-per-section on long content).
- Preloader screens longer than ~1 s or blocking content that is already available.
- Text only rendered in WebGL.
- Autoplaying sound.
- A different effect on every section ("demo reel syndrome").
- Particles/cursor trails on mobile.
- Using Spline/iframe embeds for the primary hero in production (heavy runtime, poor control) — fine for prototyping.
