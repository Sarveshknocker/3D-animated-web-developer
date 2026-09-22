#!/usr/bin/env node
// Static quality-gate audit for immersive (3D / motion) web code.
// Usage: node audit.mjs [projectRoot] [--json] [--strict]
// Exit code 1 when any FAIL is found (or any WARN with --strict).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
const asJson = args.includes('--json');
const strict = args.includes('--strict');

const IGNORE = new Set(['node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro', 'dist', 'build', 'out', '.output', 'coverage', '.turbo', '.immersive', '.claude', 'vendor', 'public/draco', 'public/basis']);
function walk(dir, acc = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (IGNORE.has(e.name) || IGNORE.has(rel)) continue;
    if (e.isDirectory()) walk(full, acc);
    else acc.push({ rel, full, size: fs.statSync(full).size });
  }
  return acc;
}
const files = walk(root);
const src = files.filter((f) => /\.(m?[jt]sx?|vue|svelte|astro|html)$/.test(f.rel) && f.size < 800_000);
const text = new Map(src.map((f) => [f.rel, fs.readFileSync(f.full, 'utf8')]));
const grepFiles = (re) => [...text].filter(([, t]) => re.test(t)).map(([rel]) => rel);
const anyMatch = (re) => [...text.values()].some((t) => re.test(t));

const pkg = (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); } catch { return {}; } })();
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

const results = [];
const add = (level, id, msg, where = []) => results.push({ level, id, msg, where: where.slice(0, 8) });

// Which files are "immersive"?
const threeFiles = grepFiles(/from\s+['"](three|@react-three\/fiber|@tresjs\/core|@threlte\/core|ogl)['"]|new\s+THREE\.|<Canvas[\s>]/);
const motionFiles = grepFiles(/from\s+['"](gsap|framer-motion|motion|motion\/react|lenis|@studio-freight\/lenis|animejs)['"]|gsap\.(to|from|timeline)/);

if (!threeFiles.length && !motionFiles.length) {
  add('INFO', 'scope', 'No 3D or motion code detected — nothing to audit yet.');
}

// ---------- ACCESSIBILITY ----------
if (threeFiles.length || motionFiles.length) {
  const rm = anyMatch(/prefers-reduced-motion|useReducedMotion|reducedMotion|matchMedia\(\s*['"]\(prefers-reduced-motion/);
  add(rm ? 'PASS' : 'FAIL', 'a11y.reduced-motion', rm ? 'prefers-reduced-motion is honoured.' : 'No prefers-reduced-motion handling found (WCAG 2.3.3). Motion must degrade to static/fade.');

  const pause = anyMatch(/aria-label=["'][^"']*(pause|stop|play)[^"']*["']|pauseMotion|toggleMotion|MotionToggle|data-motion-toggle/i);
  add(pause ? 'PASS' : 'WARN', 'a11y.pause-control', pause ? 'Pause/stop motion control present.' : 'No pause control found. Auto-playing motion > 5s needs a pause mechanism (WCAG 2.2.2).');
}
if (threeFiles.length) {
  const labelled = anyMatch(/<Canvas[^>]*(aria-label|aria-hidden|role=)|canvas[^>]*(aria-label|aria-hidden|role=)|setAttribute\(\s*['"](aria-label|aria-hidden|role)['"]/);
  add(labelled ? 'PASS' : 'WARN', 'a11y.canvas-semantics', labelled ? 'Canvas has ARIA semantics.' : 'Canvas lacks aria-hidden (decorative) or role="img"+aria-label (meaningful).', threeFiles);
}
const cursorNone = grepFiles(/cursor\s*:\s*none|cursor-none/);
if (cursorNone.length) add('WARN', 'a11y.cursor', 'cursor: none found — custom cursors must keep the native cursor for keyboard/touch users and not hide focus.', cursorNone);

const outlineNone = grepFiles(/outline\s*:\s*(none|0)(?![^}]*focus-visible)/);
if (outlineNone.length) add('WARN', 'a11y.focus', 'outline: none found — verify a visible :focus-visible style replaces it.', outlineNone);

// ---------- PERFORMANCE ----------
if (threeFiles.length) {
  const lazy = anyMatch(/dynamic\(\s*\(\)\s*=>\s*import\(|React\.lazy\(|lazy\(\s*\(\)\s*=>\s*import\(|import\(\s*['"]three['"]\)|defineAsyncComponent|client:(visible|idle)|import\(\s*['"][^'"]*(Scene|Canvas|Experience|Hero3D|webgl)[^'"]*['"]\)/i);
  add(lazy ? 'PASS' : 'FAIL', 'perf.lazy-3d', lazy ? '3D code is lazy-loaded.' : '3D runtime appears to be statically imported into the main bundle — lazy-load it so LCP is not blocked.');

  const dpr = anyMatch(/dpr=\{?\s*\[|setPixelRatio\(\s*Math\.min|AdaptiveDpr|PerformanceMonitor/);
  add(dpr ? 'PASS' : 'FAIL', 'perf.dpr-clamp', dpr ? 'Device pixel ratio is clamped/adaptive.' : 'DPR not clamped — 3x mobile screens will render 9x pixels. Use dpr={[1, 2]} or Math.min(devicePixelRatio, 2).');

  const offscreen = anyMatch(/frameloop=|IntersectionObserver|useInView|setAnimationLoop\(\s*null|visibilitychange|document\.hidden/);
  add(offscreen ? 'PASS' : 'WARN', 'perf.offscreen-pause', offscreen ? 'Render loop pauses when offscreen/hidden.' : 'Render loop never pauses — stop rendering when canvas is offscreen or tab hidden (battery/thermals).');

  const dispose = anyMatch(/\.dispose\(\)|useGLTF|useTexture|<Canvas/); // R3F auto-disposes
  add(dispose ? 'PASS' : 'WARN', 'perf.dispose', dispose ? 'Resources disposed (or managed by R3F).' : 'No .dispose() calls — geometries/materials/textures leak on route change.');

  const ctxLoss = anyMatch(/webglcontextlost|contextlost|onContextLost/i);
  add(ctxLoss ? 'PASS' : 'WARN', 'reliability.context-loss', ctxLoss ? 'WebGL context loss handled.' : 'No webglcontextlost handler — show the fallback poster if the GPU context is lost.');

  const fallback = anyMatch(/WebGL2RenderingContext|getContext\(\s*['"]webgl2?['"]|isWebGLAvailable|WebGL\.isWebGL|hasWebGL|webglSupported|fallback=/);
  add(fallback ? 'PASS' : 'FAIL', 'reliability.webgl-fallback', fallback ? 'WebGL capability check / fallback present.' : 'No WebGL detection or fallback — users on blocked/old GPUs get a blank area.');

  const newInFrame = [...text].filter(([, t]) => /useFrame\([\s\S]{0,400}?new\s+(THREE\.)?(Vector[234]|Color|Matrix4|Quaternion|Euler|Object3D)\(/.test(t)).map(([r]) => r);
  if (newInFrame.length) add('WARN', 'perf.gc-in-frame', 'Allocations inside useFrame create GC pressure — hoist temp vectors outside the loop.', newInFrame);
}

// Asset budgets
const models = files.filter((f) => /\.(glb|gltf)$/i.test(f.rel));
const bigModels = models.filter((f) => f.size > 3 * 1024 * 1024);
if (models.length) add(bigModels.length ? 'FAIL' : 'PASS', 'perf.model-budget', bigModels.length ? 'Models over 3 MB — compress with meshopt/Draco + KTX2 textures.' : `All ${models.length} models ≤ 3 MB.`, bigModels.map((f) => `${f.rel} (${Math.round(f.size / 1024)} KB)`));
const totalModelMB = models.reduce((s, f) => s + f.size, 0) / 1048576;
if (totalModelMB > 6) add('WARN', 'perf.model-total', `Total 3D model payload is ${totalModelMB.toFixed(1)} MB — load per-section, not all upfront.`);
const hdr = files.filter((f) => /\.(hdr|exr)$/i.test(f.rel) && f.size > 2 * 1024 * 1024);
if (hdr.length) add('WARN', 'perf.hdr-budget', 'HDR/EXR > 2 MB — use 1k maps or drei <Environment preset> / prefiltered KTX2.', hdr.map((f) => f.rel));
const bigImg = files.filter((f) => /\.(png|jpe?g)$/i.test(f.rel) && f.size > 400 * 1024 && /public|static|assets/.test(f.rel));
if (bigImg.length) add('WARN', 'perf.image-budget', 'Large PNG/JPG textures/images — convert to WebP/AVIF (images) or KTX2 (textures).', bigImg.map((f) => `${f.rel} (${Math.round(f.size / 1024)} KB)`));

const decoderRemote = grepFiles(/setDecoderPath\(\s*['"]https?:|gstatic\.com\/draco|useGLTF\.setDecoderPath\(\s*['"]https?:/);
if (decoderRemote.length) add('WARN', 'security.remote-decoder', 'Draco/Basis decoder loaded from a third-party CDN — self-host under /public for CSP, privacy and availability.', decoderRemote);

// Animation hygiene
if (motionFiles.length) {
  const layoutAnim = grepFiles(/gsap\.(to|from|fromTo)\([^)]*\{[^}]*\b(top|left|width|height|margin|padding)\s*:/);
  if (layoutAnim.length) add('WARN', 'perf.layout-animation', 'Animating layout properties (top/left/width/height/margin) causes reflow — animate transform/opacity instead.', layoutAnim);

  const usesST = anyMatch(/ScrollTrigger/);
  const cleaned = anyMatch(/useGSAP|gsap\.context|ctx\.revert\(\)|\.kill\(\)|ScrollTrigger\.killAll|mm\.revert|gsap\.matchMedia/);
  if (usesST || anyMatch(/from\s+['"]gsap['"]/)) add(cleaned ? 'PASS' : 'FAIL', 'reliability.gsap-cleanup', cleaned ? 'GSAP animations are scoped and cleaned up.' : 'GSAP used without useGSAP/gsap.context cleanup — leaks triggers on route change / HMR.');

  const scrollHijack = grepFiles(/wheel['"]\s*,[^)]*preventDefault|addEventListener\(\s*['"]wheel['"][\s\S]{0,200}preventDefault/);
  if (scrollHijack.length) add('WARN', 'a11y.scroll-hijack', 'Wheel events are preventDefault-ed — scroll hijacking breaks keyboard, assistive tech and trackpads. Use Lenis or native scroll + ScrollTrigger.', scrollHijack);
}

// SEO: content must not live only inside canvas
const textInCanvas = grepFiles(/<Text[\s>]|<Text3D|TextGeometry|troika-three-text/);
if (textInCanvas.length) add('WARN', 'seo.text-in-webgl', 'Text rendered inside WebGL is invisible to search & screen readers — mirror it in DOM (visually-hidden if needed).', textInCanvas);

// Security
const evalUse = grepFiles(/\beval\(|new Function\(/);
if (evalUse.length) add('WARN', 'security.eval', 'eval/new Function found — breaks strict CSP (unsafe-eval).', evalUse);

// Dependency hygiene
const animLibs = ['gsap', 'framer-motion', 'motion', 'animejs', 'react-spring', '@react-spring/web', 'popmotion'].filter((d) => deps[d]);
if (animLibs.length > 2) add('WARN', 'deps.animation-sprawl', `Multiple animation engines installed (${animLibs.join(', ')}) — standardise on one or two.`);
if (deps['locomotive-scroll']) add('WARN', 'deps.locomotive', 'locomotive-scroll is heavy and hijacks scroll — prefer Lenis.');
if (deps.three && !deps['@types/three'] && (deps.typescript || fs.existsSync(path.join(root, 'tsconfig.json')))) add('WARN', 'deps.types', 'TypeScript project without @types/three.');

// ---------- REPORT ----------
const order = { FAIL: 0, WARN: 1, PASS: 2, INFO: 3 };
results.sort((a, b) => order[a.level] - order[b.level]);
const counts = results.reduce((c, r) => ((c[r.level] = (c[r.level] ?? 0) + 1), c), {});

if (asJson) {
  console.log(JSON.stringify({ root, counts, threeFiles, motionFiles, results }, null, 2));
} else {
  const icon = { FAIL: '✖', WARN: '▲', PASS: '✔', INFO: 'ℹ' };
  console.log(`\nJarvis Immersive audit — ${root}`);
  console.log(`3D files: ${threeFiles.length} | motion files: ${motionFiles.length}\n`);
  for (const r of results) {
    console.log(`${icon[r.level]} [${r.level}] ${r.id}: ${r.msg}`);
    for (const w of r.where) console.log(`      ↳ ${w}`);
  }
  console.log(`\nSummary: ${counts.FAIL ?? 0} fail, ${counts.WARN ?? 0} warn, ${counts.PASS ?? 0} pass`);
  console.log('Static checks only — also run Lighthouse, axe and a manual reduced-motion + keyboard pass.\n');
}
process.exit((counts.FAIL ?? 0) > 0 || (strict && (counts.WARN ?? 0) > 0) ? 1 : 0);
