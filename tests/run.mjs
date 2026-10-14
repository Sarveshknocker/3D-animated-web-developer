// End-to-end tests for the kit's scripts against throwaway fixture projects.
// Run: npm test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import zlib from 'node:zlib';
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

// ---------- helpers for the async tests ----------
const runNode = (args, opts = {}) => new Promise((resolve) => {
  const child = spawn(process.execPath, args, { cwd: opts.cwd ?? KIT, env: { ...process.env, ...(opts.env ?? {}) } });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  child.on('close', (status) => resolve({ status, stdout, stderr }));
});
const INSPECT = path.join(KIT, 'skills/immersive-inspect/scripts/inspect.mjs');
const ASSETS = path.join(KIT, 'skills/immersive-3d-engineering/scripts/assets.mjs');
const { findBrowser } = await import(new URL('../skills/immersive-inspect/scripts/lib/cdp.mjs', import.meta.url));
const { decodePng, lumaStats, diff } = await import(new URL('../skills/immersive-inspect/scripts/lib/png.mjs', import.meta.url));
const { unzip, safeJoin } = await import(new URL('../skills/immersive-3d-engineering/scripts/assets.mjs', import.meta.url));

function png(width, height, rgb) { // RGB, filter 0 per row
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const [r, g, b] = rgb(x, y); const i = y * (width * 3 + 1) + 1 + x * 3; raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function zip(entries) { // [{ name, data, deflate }]
  const locals = []; const centrals = []; let off = 0;
  for (const e of entries) {
    const body = e.deflate ? zlib.deflateRawSync(e.data) : e.data; const name = Buffer.from(e.name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(e.deflate ? 8 : 0, 8); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(e.deflate ? 8 : 0, 10); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(e.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, name, body); centrals.push(ch, name); off += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** Mock Poly Haven + ambientCG APIs and file host on 127.0.0.1. */
async function mockAssetServer() {
  const server = http.createServer((req, res) => {
    const base = `http://127.0.0.1:${server.address().port}`;
    const u = new URL(req.url, base);
    const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/ph/assets') return json({
      studio_small_09: { type: 0, name: 'Studio Small 09', tags: ['studio', 'softbox'], categories: ['indoor'], download_count: 900 },
      forest_road: { type: 0, name: 'Forest Road', tags: ['trees'], categories: ['outdoor'], download_count: 50 },
      rock_wall: { type: 1, name: 'Rock Wall', tags: ['rock', 'stone'], categories: ['wall'], download_count: 10 },
      chair: { type: 2, name: 'Wooden Chair', tags: ['wood'], categories: ['furniture'], download_count: 5 },
      evil: { type: 2, name: 'Evil', tags: [], categories: [], download_count: 1 },
    });
    if (u.pathname.startsWith('/ph/info/')) return json({ type: { studio_small_09: 0, chair: 2, evil: 2 }[u.pathname.split('/').pop()] ?? 1, name: 'Mock', authors: { 'Jane Doe': 'All' } });
    if (u.pathname === '/ph/files/studio_small_09') return json({ hdri: { '1k': { hdr: { url: `${base}/dl/studio_1k.hdr` } } } });
    if (u.pathname === '/ph/files/chair') return json({ gltf: { '1k': { gltf: { url: `${base}/dl/chair.gltf`, include: { 'textures/chair_diff.jpg': { url: `${base}/dl/chair_diff.jpg` } } } } } });
    if (u.pathname === '/ph/files/evil') return json({ gltf: { '1k': { gltf: { url: `${base}/dl/chair.gltf`, include: { '../../escape.txt': { url: `${base}/dl/chair_diff.jpg` } } } } } });
    if (u.pathname === '/acg/full_json') {
      if (u.searchParams.get('id') === 'Slip001') return json({ foundAssets: [{ assetId: 'Slip001', downloadFolders: { default: { downloadFiletypeCategories: { zip: { downloads: [{ attribute: '1K-JPG', fileName: 'Slip001.zip', downloadLink: `${base}/dl/slip.zip` }] } } } } }] });
      if (u.searchParams.get('id')) return json({ foundAssets: [{ assetId: 'Wood001', displayName: 'Wood 001', downloadFolders: { default: { downloadFiletypeCategories: { zip: { downloads: [{ attribute: '2K-JPG', fileName: 'Wood001_2K.zip', downloadLink: `${base}/dl/wood2k.zip` }, { attribute: '1K-JPG', fileName: 'Wood001_1K.zip', downloadLink: `${base}/dl/wood.zip` }] } } } } }] });
      return json({ foundAssets: [{ assetId: 'Wood001', displayName: 'Wood 001', dataType: 'Material', tags: ['wood'], downloadCount: 7 }] });
    }
    if (u.pathname === '/dl/wood.zip') { res.writeHead(200); return res.end(zip([{ name: 'Wood001_1K_Color.jpg', data: Buffer.from('color'), deflate: true }, { name: 'Wood001_1K_NormalDX.jpg', data: Buffer.from('dx') }, { name: 'Wood001_1K.blend', data: Buffer.from('blend') }, { name: 'Wood001_1K_NormalGL.jpg', data: Buffer.from('gl') }])); }
    if (u.pathname === '/dl/slip.zip') { res.writeHead(200); return res.end(zip([{ name: '../evil.jpg', data: Buffer.from('x') }])); }
    if (u.pathname.startsWith('/dl/')) { res.writeHead(200); return res.end(`file:${u.pathname}`); }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, env: { JARVIS_POLYHAVEN_API: `${base}/ph`, JARVIS_AMBIENTCG_API: `${base}/acg` } };
}

// ---------- unit tests ----------
test('png decoder, luma stats and diff measure pixels correctly', () => {
  const flat = decodePng(png(8, 8, () => [40, 40, 40]));
  assert.equal(flat.width, 8); assert.equal(flat.data[0], 40);
  assert.ok(lumaStats(flat, 1).stdev < 0.01);
  const checker = decodePng(png(8, 8, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0])));
  assert.ok(lumaStats(checker, 1).stdev > 100);
  assert.ok(diff(flat, checker, 1) > 50);
  assert.equal(diff(flat, flat, 1), 0);
});

test('unzip reads stored and deflated entries; safeJoin blocks traversal', () => {
  const files = unzip(zip([{ name: 'a.txt', data: Buffer.from('hello') }, { name: 'dir/b.txt', data: Buffer.from('world'.repeat(50)), deflate: true }]));
  assert.deepEqual(files.map((f) => f.name), ['a.txt', 'dir/b.txt']);
  assert.equal(files[1].data.toString(), 'world'.repeat(50));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-safe-'));
  assert.ok(safeJoin(dir, 'textures/x.jpg').startsWith(dir));
  for (const bad of ['../x', 'a/../../x', '/etc/passwd', 'C:/x', '..\\x']) assert.throws(() => safeJoin(dir, bad), /Unsafe path/, bad);
});

test('assets: search filters and ranks, get downloads and records credits', async () => {
  const { server, env } = await mockAssetServer();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-assets-'));
  try {
    let r = await runNode([ASSETS, 'search', 'studio', '--type', 'hdri', '--source', 'polyhaven', '--json'], { cwd, env });
    assert.equal(r.status, 0, r.stderr);
    const hits = JSON.parse(r.stdout);
    assert.deepEqual(hits.map((h) => h.id), ['studio_small_09']);
    assert.equal(hits[0].licence, 'CC0-1.0');

    r = await runNode([ASSETS, 'get', 'polyhaven:studio_small_09', '--dir', 'public/3d'], { cwd, env });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(fs.existsSync(path.join(cwd, 'public/3d/studio_small_09_1k.hdr')));

    r = await runNode([ASSETS, 'get', 'polyhaven:chair', '--dir', 'public/3d'], { cwd, env });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(fs.existsSync(path.join(cwd, 'public/3d/chair/chair_1k.gltf')));
    assert.ok(fs.existsSync(path.join(cwd, 'public/3d/chair/textures/chair_diff.jpg')));

    r = await runNode([ASSETS, 'get', 'ambientcg:Wood001', '--dir', 'public/3d'], { cwd, env });
    assert.equal(r.status, 0, r.stderr);
    const wood = fs.readdirSync(path.join(cwd, 'public/3d/Wood001')).sort();
    assert.deepEqual(wood, ['Wood001_1K_Color.jpg', 'Wood001_1K_NormalGL.jpg'], 'keeps web maps, picks 1K, drops DCC files and DirectX normals');
    assert.equal(fs.readFileSync(path.join(cwd, 'public/3d/Wood001/Wood001_1K_Color.jpg'), 'utf8'), 'color');

    const credits = JSON.parse(fs.readFileSync(path.join(cwd, '.immersive/ASSET_CREDITS.json'), 'utf8'));
    assert.deepEqual(credits.map((c) => c.id).sort(), ['Wood001', 'chair', 'studio_small_09']);
    assert.deepEqual(credits.find((c) => c.id === 'chair').authors, ['Jane Doe']);
    r = await runNode([ASSETS, 'credits'], { cwd, env });
    assert.match(r.stdout, /\| \[Mock\]\(https:\/\/polyhaven\.com\/a\/chair\) \| polyhaven \| Jane Doe \| CC0-1\.0/);
  } finally { server.close(); }
});

test('assets: refuses path traversal, zip slip and plain-http downloads', async () => {
  const { server, env } = await mockAssetServer();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-assets-'));
  try {
    let r = await runNode([ASSETS, 'get', 'polyhaven:evil', '--dir', 'out'], { cwd, env });
    assert.equal(r.status, 1); assert.match(r.stderr, /Unsafe path/);
    assert.ok(!fs.existsSync(path.join(cwd, 'escape.txt')));
    r = await runNode([ASSETS, 'get', 'ambientcg:Slip001', '--dir', 'out'], { cwd, env });
    assert.equal(r.status, 1); assert.match(r.stderr, /Unsafe path/);
    assert.ok(!fs.existsSync(path.join(cwd, 'out/evil.jpg')));
    r = await runNode([ASSETS, 'search', 'x', '--source', 'polyhaven'], { cwd, env: { JARVIS_POLYHAVEN_API: 'http://example.com/api' } });
    assert.equal(r.status, 1); assert.match(r.stderr, /non-https/);
    r = await runNode([ASSETS, 'get', 'polyhaven:../../x'], { cwd, env });
    assert.equal(r.status, 1); assert.match(r.stderr, /Bad asset id/);
  } finally { server.close(); }
});

// ---------- real-browser tests (skipped without Chrome/Edge/Chromium) ----------
const browser = findBrowser();
const inspectFixture = async (name) => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `jarvis-inspect-${name}-`));
  const r = await runNode([INSPECT, path.join(KIT, 'tests/fixtures/inspect', name), '--out', out, '--widths', '1440,390', '--wait', '700', '--json']);
  return { r, out, report: r.stdout.trim().startsWith('{') ? JSON.parse(r.stdout) : null };
};

test('inspector passes a well-built immersive page and measures it', async () => {
  if (!browser) return console.log('   (skipped: no Chrome/Edge/Chromium; set JARVIS_CHROME)');
  const { r, out, report } = await inspectFixture('good');
  assert.ok(report, r.stderr || r.stdout.slice(0, 500));
  assert.deepEqual(report.findings.filter((f) => f.level !== 'INFO'), [], JSON.stringify(report.findings));
  assert.equal(r.status, 0);
  assert.deepEqual(report.viewports.map((v) => v.name), ['desktop', 'mobile']);
  for (const v of report.viewports) {
    assert.equal(v.contexts, 1, 'one WebGL context');
    assert.ok(v.drawsPerFrame >= 1, 'draw calls counted');
    assert.ok(v.canvas.stats.stdev > 1.5, 'canvas is not blank');
    assert.equal(v.cls, 0);
  }
  assert.equal(report.passes.reducedMotion.canvas.change, 0, 'scene holds still under reduced motion');
  assert.ok(report.passes.noWebGL.textLength >= report.viewports[0].textLength * 0.9);
  assert.ok(report.passes.keyboard.stops >= 2);
  for (const f of ['desktop-fold.jpg', 'mobile-page.jpg', 'reduced-motion-fold.jpg', 'no-webgl-fold.jpg', 'report.json', 'REPORT.md']) assert.ok(fs.existsSync(path.join(out, f)), `missing ${f}`);
});

test('inspector fails every planted defect in a broken page', async () => {
  if (!browser) return console.log('   (skipped: no Chrome/Edge/Chromium; set JARVIS_CHROME)');
  const { r, report } = await inspectFixture('bad');
  assert.ok(report, r.stderr || r.stdout.slice(0, 500));
  assert.equal(r.status, 1);
  const fails = new Set(report.findings.filter((f) => f.level === 'FAIL').map((f) => f.id));
  const warns = new Set(report.findings.filter((f) => f.level === 'WARN').map((f) => f.id));
  for (const id of ['layout.overflow-x', 'a11y.img-alt', 'a11y.control-name', 'webgl.context-loss', 'reduced-motion.3d', 'fallback.exceptions', 'fallback.hidden', 'keyboard.trap']) assert.ok(fails.has(id), `expected FAIL ${id}; got ${[...fails]}`);
  for (const id of ['a11y.canvas', 'perf.dpr', 'a11y.heading-order', 'a11y.lang', 'a11y.pause-control', 'keyboard.focus-visible']) assert.ok(warns.has(id), `expected WARN ${id}; got ${[...warns]}`);
  assert.ok(!fails.has('runtime.exceptions'), 'the context-loss exception is reported once, by its own pass');
});

test('inspector reports usage errors and missing targets', async () => {
  let r = await runNode([INSPECT]);
  assert.equal(r.status, 2);
  if (!browser) return;
  r = await runNode([INSPECT, path.join(os.tmpdir(), 'does-not-exist-jarvis.html')]);
  assert.equal(r.status, 2); assert.match(r.stderr, /No such file/);
});

// ---------- kit structure ----------
test('orchestrator routes to every skill and the entry block lists them', () => {
  const build = fs.readFileSync(path.join(KIT, 'skills/immersive-build/SKILL.md'), 'utf8');
  const entry = fs.readFileSync(path.join(KIT, 'adapters/entry.md'), 'utf8');
  for (const s of fs.readdirSync(path.join(KIT, 'skills'))) {
    if (s !== 'immersive-build') assert.ok(build.includes(s), `immersive-build does not mention ${s}`);
    assert.ok(entry.includes(`skills/${s}/SKILL.md`), `adapters/entry.md does not list ${s}`);
  }
});

test('evals are well formed', () => {
  const e = JSON.parse(fs.readFileSync(path.join(KIT, 'evals/cases.json'), 'utf8'));
  assert.ok(e.how_to_run.length > 50);
  const ids = new Set();
  for (const c of e.cases) {
    assert.ok(c.id && !ids.has(c.id), `duplicate or missing id ${c.id}`); ids.add(c.id);
    assert.ok(['build', 'review', 'negative'].includes(c.kind), c.id);
    assert.ok(c.prompt.length > 20 && c.graders.length >= 2 && c.expected, c.id);
  }
  assert.ok(e.cases.some((c) => c.kind === 'negative'), 'needs at least one should-not-trigger case');
});

test('plugin manifests agree with package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(KIT, 'package.json'), 'utf8'));
  for (const f of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    const m = JSON.parse(fs.readFileSync(path.join(KIT, f), 'utf8'));
    assert.equal(m.name, pkg.name, f); assert.equal(m.version, pkg.version, f);
  }
  const codex = JSON.parse(fs.readFileSync(path.join(KIT, '.codex-plugin/plugin.json'), 'utf8'));
  assert.ok(fs.existsSync(path.join(KIT, codex.skills)));
  assert.equal(JSON.parse(fs.readFileSync(path.join(KIT, '.agents/plugins/marketplace.json'), 'utf8')).plugins[0].name, pkg.name);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`✔ ${t.name}`); }
  catch (e) { failed++; console.log(`✖ ${t.name}\n   ${e.message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
