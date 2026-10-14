---
name: immersive-3d-engineering
description: Production engineering for real-time 3D on the web — three.js, React Three Fiber, TresJS, Threlte, shaders, GLTF asset pipelines, device tiers, fallbacks, and performance. Use when implementing or optimizing any WebGL/3D scene in a website.
---

# 3D engineering

## Stack adapter — choose by the project's UI layer
| Project | Binding | Mount strategy |
|---|---|---|
| Next.js (app router) | `@react-three/fiber` + `@react-three/drei` | `"use client"` wrapper → `next/dynamic(() => import('./Scene'), { ssr: false })` |
| Next.js (pages) / Remix / Vite React / Gatsby | R3F + drei | `React.lazy` + `<Suspense fallback={<Poster/>}>` |
| Astro | Island in its UI framework, or vanilla | `client:visible` (below the fold) / `client:idle` (hero) |
| Nuxt / Vue | `@tresjs/core` + `@tresjs/cientos` | `<ClientOnly>` + `defineAsyncComponent` |
| SvelteKit / Svelte | `@threlte/core` + `@threlte/extras` | `{#await import(...)}` in `onMount`, `ssr=false` for the component |
| Angular | vanilla three.js (or `angular-three`) | Standalone component, `ngZone.runOutsideAngular` for the loop, `@defer (on viewport)` |
| Static HTML / WordPress / Django / Laravel | vanilla three.js ES module | `<script type="module">` that `import()`s the scene after `requestIdleCallback`/IntersectionObserver |

Version guidance: use the latest stable three.js (r17x+) and R3F v9 (React 19) / v8 (React 18) — match the project's React major.

## Templates (adapt, don't paste)
- `templates/react-r3f/` — `ImmersiveStage.tsx` (lazy + tiers + fallback + pause), `Scene.example.tsx`, `useDeviceTier.ts`, `useReducedMotion.ts`, `webgl.ts`, `BrandGradientMaterial.ts` (token-driven shader).
- `templates/vanilla/immersive-stage.js` — the same guarantees without a framework.

Every scene must provide (the inspector in `immersive-inspect` checks items 1, 3, 4 and context loss in a real browser):
1. **Poster fallback** of identical size (also used while loading, for no-WebGL, reduced motion if the scene is heavy, and on context loss).
2. **Tier config** (`high | mid | low | static`) that controls DPR, particle counts, post-processing, shadows.
3. **Visibility pause**: IntersectionObserver + `visibilitychange` → `frameloop="never"`/`setAnimationLoop(null)`.
4. **Motion pause** (user toggle) and reduced-motion behaviour.
5. **Cleanup**: dispose geometries/materials/textures/render targets (R3F does this for declarative objects; you must for imperatively created ones).
6. **Error boundary** that falls back to the poster.

## Finding assets (free, CC0)
No model, HDRI or material yet? Search Poly Haven and ambientCG (both CC0: free for commercial use, no attribution required) before inventing one:
```bash
node <kit>/skills/immersive-3d-engineering/scripts/assets.mjs search "studio softbox" --type hdri
node <kit>/skills/immersive-3d-engineering/scripts/assets.mjs search "brushed metal" --type texture
node <kit>/skills/immersive-3d-engineering/scripts/assets.mjs get polyhaven:studio_small_09 --res 1k --dir public/assets/3d
node <kit>/skills/immersive-3d-engineering/scripts/assets.mjs credits      # table for HANDOVER.md
```
- HDRIs light the scene (`scene.environment` / drei `<Environment files>`); 1k is enough for reflections, 2k only if it is visible.
- Textures arrive as PBR maps; models as glTF with their textures. Run them through the pipeline below before shipping.
- Every download is recorded in `.immersive/ASSET_CREDITS.json` (source, author, licence, files). Never present a library asset as the brand's own product; the brand's real product needs its real model.
- Downloads are https-only, size-capped (`--max-mb`), and archive paths are sanitised.

## Asset pipeline
```bash
node <kit>/skills/immersive-3d-engineering/scripts/optimize-assets.mjs <input-dir> <output-dir>
```
Wraps `@gltf-transform/cli` (fetched via npx on first run): dedup, prune, weld, simplify (mild), meshopt compression, textures → WebP (or KTX2 with `--ktx2` when `toktx` is installed), max texture size 2048. Then:
- Self-host decoders: copy `three/examples/jsm/libs/draco/` and `basis/` to `/public/decoders/` if you use Draco/KTX2. Meshopt needs no worker (preferred under strict CSP).
- Preload the hero model with `useGLTF.preload` **after** first paint, never in the critical path.

## Performance rules
- Draw calls < 100 (mid tier). Merge static meshes; use `InstancedMesh` for repeats.
- Hoist temporaries: `const v = new Vector3()` outside `useFrame`.
- Animate with uniforms and matrices, not by recreating geometry.
- Use `drei/PerformanceMonitor` to step tiers down at runtime (and never step back up more than once → avoids oscillation).
- Post-processing (bloom, DOF, chromatic aberration) only on the high tier; prefer baked lighting/AO in textures.
- Shadows: baked or `ContactShadows` (frames={1}) instead of real-time shadow maps.
- Tone mapping: ACES/AgX consistent with brand colors; convert brand hex to linear (`new Color(hex)` handles sRGB→linear in r152+).
- Text: DOM overlay (drei `<Html>` sparingly, or plain positioned DOM) — not WebGL text for content.

## Shader conventions
- Brand colors enter as uniforms read from CSS variables at mount (`getComputedStyle(document.documentElement).getPropertyValue('--brand-500')`) so theme changes and dark mode propagate.
- Time uniform scaled by a `uMotion` factor (0 under reduced motion / paused).
- Keep precision `mediump` for mobile unless banding appears.

## Emerging (progressive only)
- **WebGPU** via `three/webgpu` + TSL: use only behind capability detection with WebGL2 fallback.
- **Gaussian splats** for photoreal captured scenes: heavy; treat as ❤️ cost, high tier only.
