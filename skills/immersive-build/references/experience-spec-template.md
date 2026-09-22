# EXPERIENCE_SPEC — <project name>

> Living document. Written in Phase 2, extended in Phase 3, referenced during build and audit.

## 1. Intent
- **Business goal**: (e.g. increase demo requests; launch product X)
- **Primary audience & devices**: (from analytics if available; assume ≥ 60 % mobile if unknown)
- **Brand personality (3 words)**:
- **Emotional arc**: (e.g. curiosity → awe → trust → action)

## 2. Narrative (section by section)
| # | Section | Message | Motion / 3D | DOM content (always present) |
|---|---|---|---|---|
| 1 | Hero | | Signature moment | H1, sub, primary CTA |
| 2 | | | | |

## 3. Signature moment
- **Pattern** (from patterns.md):
- **Brand metaphor it expresses**:
- **Interaction** (scroll / pointer / idle):
- **Assets needed** (models, textures, HDRI, fonts) + source + license:

## 4. Motion system
- Duration tokens: `--dur-xs 120ms`, `--dur-sm 240ms`, `--dur-md 480ms`, `--dur-lg 800ms`, `--dur-xl 1200ms`
- Easing tokens: `--ease-out-expo cubic-bezier(0.16,1,0.3,1)`, `--ease-in-out cubic-bezier(0.65,0,0.35,1)`, `--ease-emphasized cubic-bezier(0.2,0,0,1)`
- Reveal rule: (distance, stagger, trigger point)
- Transition rule: (route changes)

## 5. Device tiers
| Tier | Detection | Experience |
|---|---|---|
| High | desktop GPU, ≥ 8 cores, no save-data | Full scene, post-processing, DPR up to 2 |
| Mid | typical laptop / modern phone | Scene without post-fx, DPR ≤ 1.5, reduced particle count |
| Low | low-end GPU, ≤ 4 cores, save-data, low battery | Poster image or 2D CSS version |
| Reduced motion | `prefers-reduced-motion: reduce` | Static composition, fades ≤ 200 ms, no scrub/parallax |
| No WebGL | detection failed / context lost | Poster image, identical DOM content |

## 6. Architecture
- Binding & versions:
- New dependencies (+ gzip size each):
- File placement:
- Loading strategy (critical / lazy / idle-prefetch):
- Asset pipeline commands:
- CSP changes required:

## 7. Budgets (targets → measured)
| Metric | Target | Measured |
|---|---|---|
| LCP (mobile, 4G) | ≤ 2.5 s | |
| INP | ≤ 200 ms | |
| CLS | ≤ 0.1 | |
| Initial JS added to critical path | ≤ 10 KB gz | |
| Lazy 3D chunk | ≤ 250 KB gz | |
| 3D assets per view | ≤ 3 MB | |
| Steady-state FPS (mid tier) | ≥ 55 | |
| Lighthouse perf / a11y / SEO / best practices | ≥ 90 / 100 / 100 / 100 | |

## 8. Open questions / risks
-
