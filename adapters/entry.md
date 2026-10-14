## Jarvis Immersive — 3D / animated website kit

This project has the **Jarvis Immersive kit** installed at `{{KIT}}/`. When the user asks for a 3D website, immersive or animated landing page, WebGL hero, scroll storytelling, interactive experience, "premium / Apple / Stripe-style" site, or to make the site feel unique, **follow the kit instead of improvising**:

| Task | Open and follow |
|---|---|
| Build or redesign an immersive experience (end to end) | `{{KIT}}/skills/immersive-build/SKILL.md` |
| Understand this project first | `{{KIT}}/skills/immersive-deep-dive/SKILL.md` |
| Come up with an original, interactive concept | `{{KIT}}/skills/immersive-creative-direction/SKILL.md` |
| Implement 3D (three.js / R3F / TresJS / Threlte) | `{{KIT}}/skills/immersive-3d-engineering/SKILL.md` |
| Implement motion / scroll / transitions | `{{KIT}}/skills/immersive-motion/SKILL.md` |
| Production constraints (perf, a11y, SEO, security) | `{{KIT}}/skills/mnc-web-standards/SKILL.md` |
| Review / harden before shipping | `{{KIT}}/skills/immersive-audit/SKILL.md` |
| Watch it run in a real browser + look-and-fix loop | `{{KIT}}/skills/immersive-inspect/SKILL.md` |

Sub-agent role briefs (if your tool supports sub-agents or parallel tasks): `{{KIT}}/agents/`.
Scripts are dependency-free Node ≥ 18: run them with your terminal tool (or ask the user to run them).

**Mode: autonomous.** One request from the user should result in a finished, verified site: deep dive → concept → build → audit/fix loop → handover, without approval stops. Record decisions in `.immersive/`. Pause only for destructive/outward actions, or if the user asks for "review mode".

Hard rules, always:
1. Deep-dive before building; write findings to `.immersive/`.
2. Stay native to this project's framework, styling system and conventions.
3. Content lives in semantic HTML; 3D/motion is progressive enhancement with fallbacks.
4. Honour `prefers-reduced-motion`, keep keyboard access, never hijack scroll.
5. Meet the budgets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1, lazy 3D chunk ≤ 250 KB gz.
6. Aim for original: no template clichés; the visitor must have something satisfying to *do*.
7. Done means measured: the inspector exits 0 and you have looked at its screenshots. Never claim a check you did not run.
