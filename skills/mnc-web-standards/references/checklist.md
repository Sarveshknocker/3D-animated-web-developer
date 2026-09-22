# MNC production checklist for immersive websites

Mark each item ✅ / ❌ / N/A in the audit report.

## 1. Performance
- [ ] LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75 on mobile (lab: Lighthouse mobile; field: web-vitals RUM)
- [ ] Lighthouse mobile: Performance ≥ 90, Accessibility 100, Best Practices 100, SEO 100
- [ ] Critical path adds ≤ 10 KB gz JS; 3D/motion runtime lazy-loaded (dynamic import / island / `client:visible`)
- [ ] Lazy 3D chunk ≤ 250 KB gz (three.js core tree-shaken ≈ 150 KB gz)
- [ ] 3D assets ≤ 3 MB per view; models via gltf-transform (meshopt or Draco), textures KTX2/WebP, ≤ 2048² (≤ 1024² on mobile)
- [ ] HDRI ≤ 1k resolution or preset; no 4k EXR in production
- [ ] DPR clamped (`[1, 2]`; `[1, 1.5]` on mid tier), adaptive quality via performance monitor
- [ ] Render loop stops when canvas offscreen or tab hidden; `frameloop="demand"` for static/configurator scenes
- [ ] No allocations in frame loops; instancing for repeated meshes; draw calls < 100 (mid tier)
- [ ] Only `transform`/`opacity`/`filter`/`clip-path` animated in DOM; `will-change` applied sparingly and removed
- [ ] Fonts: `font-display: swap`, subset, preloaded (max 2); no layout shift from font swap (size-adjust)
- [ ] Images: AVIF/WebP, responsive `srcset`, explicit dimensions, `fetchpriority="high"` on LCP image only
- [ ] Poster image for the 3D area has identical dimensions (no CLS on swap)

## 2. Accessibility (WCAG 2.2 AA)
- [ ] `prefers-reduced-motion: reduce` → no parallax, scrub, autoplay, large transforms; ≤ 200 ms fades allowed (2.3.3)
- [ ] Pause/stop control for motion lasting > 5 s (2.2.2); state persisted
- [ ] No flashing > 3 per second (2.3.1)
- [ ] Canvas: `aria-hidden="true"` when decorative; `role="img"` + descriptive `aria-label` when meaningful
- [ ] All interactive 3D functions have DOM equivalents (buttons/inputs) reachable by keyboard (2.1.1)
- [ ] Visible focus (2.4.7) and focus not obscured by sticky/pinned layers (2.4.11)
- [ ] Target size ≥ 24×24 px (2.5.8); pointer gestures have single-pointer alternatives (2.5.1); drag has non-drag alternative (2.5.7)
- [ ] Text contrast ≥ 4.5:1 including over animated backgrounds (test worst frame)
- [ ] Heading order, landmarks, `lang` attribute, skip link
- [ ] No scroll hijacking; native scroll + keyboard scroll (Space, PgDn, arrows) work
- [ ] Custom cursor never hides the system cursor; disabled on touch/coarse pointers
- [ ] Sound off by default with visible toggle; no autoplay audio (1.4.2)

## 3. SEO & content
- [ ] All copy server-rendered / statically present in HTML
- [ ] Title, meta description, canonical, Open Graph + Twitter images (can be a still of the 3D hero)
- [ ] Structured data (Organization / Product / Article as relevant)
- [ ] Text drawn in WebGL mirrored in DOM
- [ ] Sitemap and robots unaffected; no content behind interaction-only states

## 4. Security
- [ ] Works under strict CSP: no `unsafe-eval`; `unsafe-inline` avoided (nonces/hashes)
- [ ] Draco/Basis/KTX2 decoders self-hosted; `worker-src 'self' blob:` added only if needed
- [ ] No third-party embed runtimes (Spline/Sketchfab iframes) in production without security review
- [ ] Dependencies pinned via lockfile; `npm audit` has no high/critical in new deps
- [ ] User-generated content (collective canvas etc.) validated & rate-limited server-side

## 5. Privacy & compliance
- [ ] Analytics/interaction tracking gated by consent (GDPR, CCPA, India DPDP)
- [ ] No fingerprinting via WebGL renderer strings sent to analytics
- [ ] Local storage use (seeded identity, motion preference) disclosed if required

## 6. Compatibility & resilience
- [ ] Browser matrix: last 2 versions of Chrome, Edge, Safari (macOS + iOS), Firefox, Samsung Internet
- [ ] WebGL2 detection → fallback poster; WebGPU only as progressive enhancement
- [ ] `webglcontextlost` handled (switch to poster, attempt restore)
- [ ] iOS Safari: no 100vh bugs (`dvh`/`svh`), memory under ~1 GB for textures, no > 4096² textures
- [ ] Low-power tier: save-data, ≤ 4 cores, low `deviceMemory`, battery saver → static tier
- [ ] Works offline-first poster if 3D assets fail to load (error boundary)

## 7. Internationalisation
- [ ] All strings (including labels in 3D) from i18n messages
- [ ] RTL: directional animations mirrored; layout via logical properties
- [ ] Text-length expansion (German +35 %) doesn't break pinned layouts

## 8. Quality engineering
- [ ] Lint + typecheck + build clean
- [ ] Unit tests for tier detection, reduced-motion logic, state machines
- [ ] Playwright E2E: page loads with WebGL on/off, reduced motion on/off; axe scan passes
- [ ] Visual regression with animations disabled (deterministic frames)
- [ ] Lighthouse CI budget in CI pipeline

## 9. Observability
- [ ] web-vitals RUM (LCP/INP/CLS) reported with tier attribute
- [ ] Error boundary around the scene reports to the existing error tracker
- [ ] Optional: sampled FPS / tier distribution metric

## 10. Maintainability & governance
- [ ] Colors/timings from design tokens (CSS vars → shader uniforms)
- [ ] Tier thresholds and feature flags configurable in one file
- [ ] Asset pipeline script committed (`npm run optimize:3d`)
- [ ] HANDOVER.md: architecture, how to add a model/section, budgets measured
- [ ] Licenses recorded for models, textures, HDRIs, fonts, sounds (`.immersive/ASSET_LICENSES.md`)
