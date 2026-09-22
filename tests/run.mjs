// End-to-end tests for the kit's scripts against throwaway fixture projects.
// Run: npm test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(KIT, 'bin', 'jarvis-immersive.mjs');
const run = (args, cwd = KIT) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-fixture-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

const nextApp = {
  'package.json': JSON.stringify({ name: 'acme-site', dependencies: { next: '15.0.0', react: '19.0.0', three: '0.170.0', '@react-three/fiber': '9.0.0', gsap: '3.13.0' }, devDependencies: { tailwindcss: '4.0.0', typescript: '5.6.0' } }),
  'tsconfig.json': '{}',
  'app/layout.tsx': "import { Inter } from 'next/font/google';\nexport default function L({children}){return children}",
  'app/page.tsx': 'export default function P(){return <h1>Hi</h1>}',
  'app/about/page.tsx': 'export default function A(){return null}',
  'app/globals.css': ':root{--brand-500:#ff3366;--bg:#0b0b0f}\nbody{font-family: Inter, sans-serif; color:#ff3366}',
  'next.config.mjs': "export default { async headers(){ return [{source:'/(.*)',headers:[{key:'Content-Security-Policy',value:\"default-src 'self'\"}]}] } }",
  // Deliberately bad immersive code: static import, no reduced motion, no dpr clamp, no fallback, GSAP w/o cleanup
  'components/Hero.tsx': "import { Canvas } from '@react-three/fiber';\nimport { gsap } from 'gsap';\nexport function Hero(){ gsap.to('.x',{left:100}); return <Canvas><mesh/></Canvas> }",
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('analyzer profiles a Next.js app-router project', () => {
  const dir = fixture(nextApp);
  const r = spawnSync(process.execPath, [path.join(KIT, 'skills/immersive-deep-dive/scripts/analyze-project.mjs'), dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(fs.readFileSync(path.join(dir, '.immersive/project-profile.json'), 'utf8'));
  assert.equal(p.framework.id, 'next');
  assert.match(p.framework.router, /^app/);
  assert.match(p.recommended3DBinding, /react-three\/fiber/);
  assert.equal(p.designTokens.cssVariables['--brand-500'], '#ff3366');
  assert.ok(p.designTokens.topHexColors.includes('#ff3366'));
  assert.ok(p.fonts.families.some((f) => f.startsWith('Inter')));
  assert.ok(p.quality.cspFiles.includes('next.config.mjs'));
  assert.ok(p.routes.includes('app/about/page.tsx'));
  assert.ok(fs.existsSync(path.join(dir, '.immersive/project-profile.md')));
});

test('analyzer handles a plain static HTML site', () => {
  const dir = fixture({ 'index.html': '<html><head><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk"></head></html>', 'about.html': '<html></html>' });
  const r = spawnSync(process.execPath, [path.join(KIT, 'skills/immersive-deep-dive/scripts/analyze-project.mjs'), dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(fs.readFileSync(path.join(dir, '.immersive/project-profile.json'), 'utf8'));
  assert.equal(p.framework.id, 'static');
  assert.match(p.recommended3DBinding, /vanilla/);
  assert.equal(p.routes.length, 2);
});

test('audit fails bad immersive code and reports the right gates', () => {
  const dir = fixture(nextApp);
  const r = spawnSync(process.execPath, [path.join(KIT, 'skills/immersive-audit/scripts/audit.mjs'), dir, '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 1, 'should exit 1 on FAIL');
  const out = JSON.parse(r.stdout);
  const failed = out.results.filter((x) => x.level === 'FAIL').map((x) => x.id);
  for (const id of ['a11y.reduced-motion', 'perf.lazy-3d', 'perf.dpr-clamp', 'reliability.webgl-fallback', 'reliability.gsap-cleanup']) assert.ok(failed.includes(id), `expected FAIL ${id}, got ${failed}`);
  assert.ok(out.results.some((x) => x.id === 'perf.layout-animation'));
});

test('audit passes the kit’s own React templates', () => {
  const dir = fixture({ 'package.json': JSON.stringify({ dependencies: { three: '1', gsap: '3' } }) });
  for (const sub of ['immersive-3d-engineering/templates/react-r3f', 'immersive-motion/templates']) {
    fs.cpSync(path.join(KIT, 'skills', sub), path.join(dir, 'src', path.basename(sub)), { recursive: true });
  }
  // A page that lazy-loads the scene, the way the SKILL tells users to.
  fs.writeFileSync(path.join(dir, 'src/page.tsx'), "import dynamic from 'next/dynamic';\nconst Scene = dynamic(() => import('./react-r3f/Scene.example'), { ssr: false });\n<button aria-label=\"Pause motion\" />");
  const r = spawnSync(process.execPath, [path.join(KIT, 'skills/immersive-audit/scripts/audit.mjs'), dir, '--json'], { encoding: 'utf8' });
  const out = JSON.parse(r.stdout);
  const failed = out.results.filter((x) => x.level === 'FAIL');
  assert.equal(failed.length, 0, `templates should pass all gates, failed: ${failed.map((f) => f.id)}`);
});

test('vanilla template passes the audit', () => {
  const dir = fixture({ 'package.json': JSON.stringify({ dependencies: { three: '1' } }) });
  fs.cpSync(path.join(KIT, 'skills/immersive-3d-engineering/templates/vanilla'), path.join(dir, 'js'), { recursive: true });
  const r = spawnSync(process.execPath, [path.join(KIT, 'skills/immersive-audit/scripts/audit.mjs'), dir, '--json'], { encoding: 'utf8' });
  const failed = JSON.parse(r.stdout).results.filter((x) => x.level === 'FAIL');
  assert.equal(failed.length, 0, `failed: ${failed.map((f) => f.id)}`);
});

test('concept dice is deterministic per seed and varies across seeds', () => {
  const a = run(['dice', 'Acme Rockets', '3']).stdout;
  const b = run(['dice', 'Acme Rockets', '3']).stdout;
  const c = run(['dice', 'Zen Tea Co', '3']).stdout;
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal((a.match(/Metaphor/g) ?? []).length, 3);
});

test('init → update → remove round-trip keeps user content intact', () => {
  const dir = fixture({ 'AGENTS.md': '# My project rules\nUse pnpm.\n', 'package.json': '{}' });
  let r = run(['init', dir]);
  assert.equal(r.status, 0, r.stderr);
  const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Use pnpm\./);
  assert.match(agents, /\.immersive-kit\/skills\/immersive-build\/SKILL\.md/);
  for (const f of ['CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md', '.cursor/rules/jarvis-immersive.mdc', '.windsurf/rules/jarvis-immersive.md', '.clinerules/jarvis-immersive.md', '.claude/skills/immersive-build/SKILL.md', '.claude/agents/quality-auditor.md', '.immersive-kit/skills/immersive-audit/scripts/audit.mjs']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `missing ${f}`);
  }
  assert.match(fs.readFileSync(path.join(dir, '.cursor/rules/jarvis-immersive.mdc'), 'utf8'), /^---\ndescription:/);

  r = run(['update', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal((fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8').match(/jarvis-immersive:start/g) ?? []).length, 1, 'update must not duplicate blocks');

  fs.mkdirSync(path.join(dir, '.immersive'));
  fs.writeFileSync(path.join(dir, '.immersive/PROJECT_BRIEF.md'), 'keep me');
  r = run(['remove', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), '# My project rules\nUse pnpm.\n');
  assert.ok(!fs.existsSync(path.join(dir, 'CLAUDE.md')));
  assert.ok(!fs.existsSync(path.join(dir, '.immersive-kit')));
  assert.ok(!fs.existsSync(path.join(dir, '.claude/skills/immersive-build')));
  assert.ok(fs.existsSync(path.join(dir, '.immersive/PROJECT_BRIEF.md')));
});

test('init with --tools subset only writes those files', () => {
  const dir = fixture({ 'package.json': '{}' });
  const r = run(['init', dir, '--tools', 'cursor,agents']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(dir, '.cursor/rules/jarvis-immersive.mdc')));
  assert.ok(!fs.existsSync(path.join(dir, 'CLAUDE.md')));
  assert.ok(!fs.existsSync(path.join(dir, '.claude')));
});

test('every skill has valid frontmatter and referenced files exist', () => {
  for (const s of fs.readdirSync(path.join(KIT, 'skills'))) {
    const md = fs.readFileSync(path.join(KIT, 'skills', s, 'SKILL.md'), 'utf8');
    const fm = md.match(/^---\nname: ([\w-]+)\ndescription: (.+)\n---/);
    assert.ok(fm, `${s}: bad frontmatter`);
    assert.equal(fm[1], s, `${s}: name must match folder`);
    for (const ref of md.matchAll(/`((?:references|templates|scripts)\/[\w./-]+\.\w+)`/g)) {
      assert.ok(fs.existsSync(path.join(KIT, 'skills', s, ref[1])), `${s}: missing ${ref[1]}`);
    }
  }
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`✔ ${t.name}`); }
  catch (e) { failed++; console.log(`✖ ${t.name}\n   ${e.message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
