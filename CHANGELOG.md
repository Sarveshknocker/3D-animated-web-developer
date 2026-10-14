# Changelog

## 0.2.0 — 2026-10-14
Upgrade informed by the most-starred agent-skill, three.js and web-performance projects (see `research/BENCHMARK.md`).

### Added
- **`immersive-inspect` skill and `inspect.mjs`**: zero-dependency real-browser inspector (Chrome/Edge/Chromium over
  the DevTools Protocol, Node ≥ 18). Measures every page at 1440/768/390: exceptions, console errors, failed
  requests, overflow, CLS/LCP/blocking time, WebGL actually rendering, FPS, draw calls per frame, render DPR,
  WebGL contexts, bytes, hidden text, alt text, control names, headings, canvas semantics, pause control. Resilience
  passes: reduced motion (scene must hold still), WebGL disabled (no crash, same content), keyboard only (no trap),
  forced WebGL context loss. Screenshots plus `REPORT.md` / `report.json`; exit 1 on FAIL.
- **Screenshot critique loop** (`immersive-inspect/references/critique.md`): twelve passes, jury-weighted score
  with caps, top-three fixes, up to three rounds, recorded in `.immersive/CRITIQUE.md`.
- **CC0 asset finder** (`immersive-3d-engineering/scripts/assets.mjs`): search and download HDRIs, PBR materials
  and models from Poly Haven and ambientCG; https-only, size caps, sanitised archive paths, credits file.
- **Creative direction**: subject inventory, the argument (claim → proof), idea sentence with competitor test,
  copy deck before markup; generated-site tells registry in the cliché blacklist.
- **Orchestrator**: common rationalizations, red flags and a definition of done.
- **Evals** (`evals/`): with-kit vs baseline cases, graders and a blind critique method, incl. a should-not-trigger case.
- **Codex plugin** manifests (`.codex-plugin/`, `.agents/plugins/`) and the `npx skills add` install path.
- CLI: `inspect` and `assets` commands. CI on Linux, Windows and macOS with Node 18 and 22.
- Tests: real-browser tests on good/bad fixtures, mock Poly Haven/ambientCG server, PNG/ZIP unit tests, traversal
  and zip-slip refusal, orchestrator routing, eval and manifest checks.

## 0.1.0
- Initial release: deep dive, creative direction, 3D engineering, motion, MNC standards, static audit, installer.
