# Benchmark: what the best open-source projects do, and what this kit took

Researched October 2026 from the most-starred GitHub projects related to this kit's job (agent skills for
frontend/design, React Three Fiber and three.js, web performance tooling). Star counts are from the GitHub
search API at the time of research. Only ideas were taken; all code in this kit is our own (see
[CREDITS.md](../CREDITS.md)).

| Project | Stars | Licence | Best at | Taken into this kit |
|---|---|---|---|---|
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | ~96k | MIT | Art direction from a study of 247 award sites; a real-browser inspector that measures the rendered page; a look-and-fix loop on screenshots; a "subject inventory" and a competitor test for the idea; a dated registry of generated-page tells; evals with a blind baseline | Real-browser inspector (rebuilt for 3D: WebGL rendering, FPS, draw calls, DPR, reduced-motion, no-WebGL, keyboard, context loss); screenshot critique loop; subject inventory, argument and competitor test in creative direction; generated-site tells section; with/without-kit evals |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | ~107k | MIT | Skill anatomy: "common rationalizations", "red flags", explicit verification steps; per-skill eval cases including should-not-fire cases; setup docs for many agents; Codex plugin manifest | Rationalizations / red flags / definition-of-done in the orchestrator; negative eval case; `.codex-plugin` + `.agents/plugins` manifests |
| [anthropics/skills](https://github.com/anthropics/skills) | ~181k | see repo | The reference format for SKILL.md and progressive disclosure | Kept skills short with details in `references/`; descriptions say *when* to use the skill |
| [agiwhitelist/auteur](https://github.com/agiwhitelist/auteur) | ~1k | MIT | Locks art direction before code; executable anti-slop gate and a real motion check in CI; `npx skills add` install | `npx skills add` install path in the README; the inspector as an executable gate |
| [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber) · [drei](https://github.com/pmndrs/drei) | ~33k · ~10k | MIT | Declarative three.js, `PerformanceMonitor`, `AdaptiveDpr`, `Environment` | Already the kit's React binding; the inspector now verifies DPR clamping and draw-call budgets that those helpers are meant to achieve |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | ~116k | MIT | The renderer | Context-loss pass uses the standard `WEBGL_lose_context` extension three.js handles |
| [GoogleChrome/lighthouse](https://github.com/GoogleChrome/lighthouse) · [lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci) | ~31k · ~7k | Apache-2.0 | Lab metrics and budget assertions in CI | Inspector gives pass/fail budgets with exit codes for CI; Lighthouse stays the source of truth for scores |
| [Poly Haven](https://polyhaven.com) · [ambientCG](https://ambientcg.com) (asset libraries with public APIs) | — | CC0 assets | Free HDRIs, PBR materials and models | `assets.mjs`: search, safe download, credits file |

## Where this kit is now ahead of the references
- **3D-specific runtime checks** none of the references make: the canvas really renders (pixel statistics), the
  scene stops under reduced motion (frame differencing), no crash and full content without WebGL, recovery from
  GPU context loss, draw calls per frame, render DPR, WebGL context count.
- **Node 18 support without dependencies**: the DevTools client includes its own WebSocket implementation.
- **Native-stack building** (Next, Astro, Nuxt, SvelteKit, Angular, static) remains this kit's core; the design
  references are stack-agnostic HTML.

## Not adopted, and why
- A fixed house style (bans on gradients, shadows, monospace and so on) from taste-skill: this kit builds inside an
  existing brand, so the rules became "tells to justify", not bans.
- Bundling a large library of studied sites: valuable, but it is their research; we cite the approach instead.
- Copying any code: the inspector, PNG decoder, ZIP reader and asset client were written from scratch for this kit.
