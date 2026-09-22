---
name: mnc-web-standards
description: The enterprise (MNC-grade) constraint set every immersive website must satisfy — performance budgets, Core Web Vitals, WCAG 2.2 AA, SEO, security/CSP, privacy/consent, i18n, browser support, observability, testing, legal/licensing, maintainability. Use when planning, building or reviewing any 3D/animated site, or when the user asks what "production-ready" or "MNC standard" means.
---

# MNC web standards

Large companies ship immersive sites that still load fast, rank, pass accessibility audits and legal review. That is the difference between an Awwwards demo and a Fortune-500 launch page. Full checklist: `references/checklist.md`.

## The ten laws
1. **Progressive enhancement.** HTML content first, CSS second, JS motion third, WebGL last. Each layer optional.
2. **The LCP element is never the canvas.** It's a server-rendered heading or poster image.
3. **Budgets are gates** — LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (p75, mobile). Lazy 3D chunk ≤ 250 KB gz; 3D assets ≤ 3 MB per view.
4. **Motion is a preference.** `prefers-reduced-motion` honoured everywhere; pause control for anything > 5 s (WCAG 2.2.2).
5. **Semantic DOM is the source of truth** for text, links, CTAs, headings — search engines and assistive tech never read WebGL.
6. **Tiered experiences.** Detect capability (GPU, cores, memory, save-data, battery) and serve high/mid/low/static tiers.
7. **Strict-CSP compatible.** No `eval`, self-hosted decoders/fonts, `worker-src blob:` only when required.
8. **Privacy-first.** No tracking before consent; no third-party runtime (e.g. hosted 3D embeds) that phones home without review.
9. **Everything cleans up.** Listeners, observers, GSAP contexts, render loops, GPU resources — on unmount and route change.
10. **Owned and documented.** Tokens, tiers and assets are configurable; pipeline and decisions written down; licenses recorded.
