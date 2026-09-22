# Working on the Jarvis Immersive kit itself

This repo is a tool-agnostic kit, not a website. Rules for changing it:
- Skills live in `skills/<name>/SKILL.md` with frontmatter `name` (must equal the folder) and `description`. Bundled files go in `references/`, `templates/`, `scripts/` inside the skill, and must be referenced with those relative paths.
- Content must work for **any** AI tool: use plain Markdown, no tool-specific syntax in skills. Refer to other kit files as `<kit>/…`.
- Scripts are zero-dependency Node ≥ 18 ESM (`.mjs`) and must run on Windows, macOS and Linux.
- Templates must pass `skills/immersive-audit/scripts/audit.mjs` and type-check against current three / R3F / GSAP.
- Run `npm test` before committing; add a test for every script behaviour you change.
- `CLAUDE.md` just points here.
