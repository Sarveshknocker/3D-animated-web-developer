#!/usr/bin/env node
// Jarvis Immersive — real-browser inspector for 3D / animated pages.
//
//   node inspect.mjs <url | file.html | folder> [--out .immersive/inspect] [--widths 1440,768,390]
//                    [--skip reduced,nowebgl,keyboard,contextloss] [--min-fps 50] [--wait 1500] [--json]
//
// Opens the page in an installed Chrome / Edge / Chromium (headless), measures it at each width, runs the
// accessibility and resilience passes (reduced motion, WebGL disabled, keyboard only, WebGL context loss),
// saves screenshots and writes report.json + REPORT.md. Exit 1 when any FAIL is found, 2 on usage errors,
// 3 when no browser is installed. Zero dependencies, Node >= 18.
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Browser, findBrowser, sleep } from './lib/cdp.mjs';
import { decodePng, diff, lumaStats } from './lib/png.mjs';
import { FOCUS, FPS, INSTRUMENT, LOSE_CONTEXT, SCROLL_THROUGH, SNAPSHOT } from './lib/probe.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.hdr': 'image/vnd.radiance', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };
const HEIGHT = { 1920: 1080, 1440: 900, 1280: 800, 1024: 768, 768: 1024, 414: 896, 390: 844, 375: 812, 360: 780 };
const label = (w) => (w >= 1100 ? 'desktop' : w >= 600 ? 'tablet' : 'mobile');
// Console noise from software GL and the browser itself, not from the page.
const NOISE = /GL Driver Message|GPU stall due to ReadPixels|swiftshader|Automatic fallback to software WebGL|favicon\.ico|DevTools/i;

/** Serves a local file or folder on 127.0.0.1 so module scripts, fetch() and relative assets behave as hosted. */
export async function serve(target) {
  const abs = resolve(target);
  const isDir = statSync(abs).isDirectory();
  const root = isDir ? abs : dirname(abs);
  const server = createServer((req, res) => {
    try {
      let f = resolve(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
      if (f !== root && !f.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
      if (statSync(f).isDirectory()) f = join(f, 'index.html');
      res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', 'content-length': statSync(f).size, 'cache-control': 'no-store' });
      createReadStream(f).pipe(res);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const page = isDir ? '' : relative(root, abs).split(sep).map(encodeURIComponent).join('/');
  return { server, url: `http://127.0.0.1:${server.address().port}/${page}` };
}

/** Opens a page with instrumentation and listeners. Returns the page plus its live event log. */
async function open(browser, url, { width, disableWebGL = false, reducedMotion = false, wait }) {
  const page = await browser.newPage();
  const log = { exceptions: [], consoleErrors: [], consoleWarnings: [], failed: [], bytes: 0, jsBytes: 0, requests: 0 };
  const types = new Map();
  page.on('Runtime.exceptionThrown', (p) => log.exceptions.push((p.exceptionDetails.exception?.description ?? p.exceptionDetails.text ?? '').split('\n')[0]));
  page.on('Runtime.consoleAPICalled', (p) => {
    const text = p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300);
    if (NOISE.test(text)) return;
    if (p.type === 'error' || p.type === 'assert') log.consoleErrors.push(text);
    else if (p.type === 'warning') log.consoleWarnings.push(text);
  });
  page.on('Log.entryAdded', (p) => { const e = p.entry; if (e.level === 'error' && !NOISE.test(`${e.text} ${e.url ?? ''}`) && e.source !== 'network') log.consoleErrors.push(e.text.slice(0, 300)); });
  page.on('Network.responseReceived', (p) => {
    types.set(p.requestId, p.type);
    if (p.response.status >= 400 && !NOISE.test(p.response.url)) log.failed.push(`${p.response.status} ${p.response.url}`);
  });
  page.on('Network.loadingFailed', (p) => { if (!p.canceled && !NOISE.test(p.errorText)) log.failed.push(`${p.errorText} (${p.type})`); });
  page.on('Network.loadingFinished', (p) => { log.requests++; log.bytes += p.encodedDataLength; if (types.get(p.requestId) === 'Script') log.jsBytes += p.encodedDataLength; });

  await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable'].map((m) => page.send(m)));
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  const mobile = width < 600;
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: HEIGHT[width] ?? Math.round(width * (mobile ? 2.16 : 0.625)), deviceScaleFactor: mobile ? 2 : 1, mobile });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }] });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT(disableWebGL) });
  await page.navigate(url);
  await sleep(wait);
  return { page, log };
}

const canvasClip = (snap) => {
  const c = [...snap.canvases].filter((x) => x.webgl).sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (!c) return null;
  const [vw, vh] = snap.viewport;
  const x = Math.max(0, c.x); const y = Math.max(0, c.y);
  const w = Math.min(c.w, vw - x); const h = Math.min(c.h, vh - y);
  return w > 8 && h > 8 ? { x, y, width: Math.floor(w), height: Math.floor(h) } : null;
};

async function canvasFrames(page, clip, gap = 900) {
  if (!clip) return null;
  const a = decodePng(await page.screenshot({ clip }));
  await sleep(gap);
  const b = decodePng(await page.screenshot({ clip }));
  return { stats: lumaStats(b), change: +diff(a, b).toFixed(2) };
}

export async function inspect(target, opts = {}) {
  const o = { out: '.immersive/inspect', widths: [1440, 768, 390], skip: [], minFps: 0, wait: 1500, ...opts };
  let url = target; let server = null;
  if (!/^https?:\/\//i.test(target)) {
    if (!existsSync(target)) throw Object.assign(new Error(`No such file or folder: ${target}`), { code: 2 });
    ({ server, url } = await serve(target));
  }
  const outDir = resolve(o.out);
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) if (/\.(jpg|png)$/.test(f)) unlinkSync(join(outDir, f));

  const browser = await Browser.launch();
  const findings = [];
  const add = (level, id, msg, where = '') => findings.push({ level, id, msg, where });
  const report = { target, url: server ? `(served) ${url}` : url, browser: browser.executable, at: new Date().toISOString(), viewports: [], passes: {}, findings, screenshots: [] };
  const shot = (name, buf) => { writeFileSync(join(outDir, name), buf); report.screenshots.push(name); };

  try {
    let base = null;
    for (const width of o.widths) {
      const name = label(width);
      const { page, log } = await open(browser, url, { width, wait: o.wait });
      const pre = await page.eval(SNAPSHOT);
      const clip = canvasClip(pre);
      const frames = await canvasFrames(page, clip);
      const perf = await page.eval(FPS(1500));
      shot(`${name}-fold.jpg`, await page.screenshot({ format: 'jpeg', quality: 70 }));
      await page.eval(SCROLL_THROUGH);
      const snap = await page.eval(SNAPSHOT);
      const fullH = Math.min(snap.pageHeight, 8000);
      shot(`${name}-page.jpg`, await page.screenshot({ format: 'jpeg', quality: 60, full: true, clip: { x: 0, y: 0, width, height: fullH } }));
      const vp = { width, name, ...snap, fps: perf.fps, drawsPerFrame: perf.drawsPerFrame, canvas: frames, log: { ...log, exceptions: [...log.exceptions], consoleErrors: [...log.consoleErrors], consoleWarnings: [...log.consoleWarnings], failed: [...log.failed] } };
      report.viewports.push(vp);
      if (name === 'desktop' || !base) base = vp;

      if (width === o.widths[0] && !o.skip.includes('contextloss') && snap.contexts) {
        const before = log.exceptions.length;
        const lost = await page.eval(LOSE_CONTEXT);
        report.passes.contextLoss = { contextsLost: lost, newExceptions: log.exceptions.slice(before) };
      }
      await page.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {});
    }

    const w0 = o.widths[0];
    if (!o.skip.includes('reduced')) {
      const { page, log } = await open(browser, url, { width: w0, wait: o.wait, reducedMotion: true });
      const pre = await page.eval(SNAPSHOT);
      const frames = await canvasFrames(page, canvasClip(pre));
      await page.eval(SCROLL_THROUGH);
      const snap = await page.eval(SNAPSHOT);
      shot('reduced-motion-fold.jpg', await page.screenshot({ format: 'jpeg', quality: 70 }));
      report.passes.reducedMotion = { moving: snap.moving, hiddenCount: snap.hiddenCount, hidden: snap.hidden, textLength: snap.textLength, canvas: frames, exceptions: log.exceptions };
      await page.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {});
    }
    if (!o.skip.includes('nowebgl')) {
      const { page, log } = await open(browser, url, { width: w0, wait: o.wait, disableWebGL: true });
      await page.eval(SCROLL_THROUGH);
      const snap = await page.eval(SNAPSHOT);
      const fold = decodePng(await page.screenshot());
      shot('no-webgl-fold.jpg', await page.screenshot({ format: 'jpeg', quality: 70 }));
      report.passes.noWebGL = { textLength: snap.textLength, hiddenCount: snap.hiddenCount, fold: lumaStats(fold), exceptions: log.exceptions, consoleErrors: log.consoleErrors };
      await page.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {});
    }
    if (!o.skip.includes('keyboard')) {
      const { page } = await open(browser, url, { width: w0, wait: o.wait });
      const stops = [];
      for (let i = 0; i < 40; i++) { await page.key('Tab'); stops.push(await page.eval(FOCUS)); }
      const reached = stops.filter(Boolean);
      const tail = reached.slice(-6).map((s) => s.sel);
      report.passes.keyboard = {
        stops: reached.length, distinct: new Set(reached.map((s) => s.sel)).size,
        // One focusable element legitimately cycles to itself; a trap holds focus while others exist.
        trapped: reached.length >= 10 && new Set(tail).size === 1 && (report.viewports[0]?.focusables ?? 0) > 1 ? tail[0] : null,
        noRing: [...new Set(reached.filter((s) => !s.ring && s.onScreen).map((s) => s.sel))].slice(0, 10),
        offScreen: [...new Set(reached.filter((s) => !s.onScreen).map((s) => s.sel))].slice(0, 10),
      };
      await page.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {});
    }
    judge(report, base, o, add);
  } finally {
    await browser.close();
    server?.close();
  }

  report.summary = { fail: findings.filter((f) => f.level === 'FAIL').length, warn: findings.filter((f) => f.level === 'WARN').length };
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(outDir, 'REPORT.md'), markdown(report));
  return report;
}

/** Turns measurements into PASS / WARN / FAIL findings. Thresholds follow mnc-web-standards. */
export function judge(r, base, o, add) {
  const kb = (b) => `${Math.round(b / 1024)} KB`;
  for (const v of r.viewports) {
    const at = `${v.name} ${v.width}px`;
    if (v.log.exceptions.length) add('FAIL', 'runtime.exceptions', `${v.log.exceptions.length} uncaught exception(s): ${v.log.exceptions[0]}`, at);
    if (v.log.consoleErrors.length) add('FAIL', 'runtime.console-errors', `${v.log.consoleErrors.length} console error(s): ${v.log.consoleErrors[0]}`, at);
    if (v.log.consoleWarnings.length) add('WARN', 'runtime.console-warnings', `${v.log.consoleWarnings.length} console warning(s): ${v.log.consoleWarnings[0]}`, at);
    if (v.log.failed.length) add('FAIL', 'network.failed', `${v.log.failed.length} failed request(s): ${v.log.failed[0]}`, at);
    if (v.overflowX > 1) add('FAIL', 'layout.overflow-x', `Page is ${v.overflowX}px wider than the viewport (horizontal scroll).`, at);
    if (v.cls > 0.25) add('FAIL', 'vitals.cls', `CLS ${v.cls} (> 0.25; budget 0.1). Reserve the canvas/poster box.`, at);
    else if (v.cls > 0.1) add('WARN', 'vitals.cls', `CLS ${v.cls} (budget 0.1).`, at);
    if (v.lcp > 2500) add('WARN', 'vitals.lcp', `LCP ${v.lcp} ms in the lab (budget 2500 ms). Make the poster/heading the LCP element.`, at);
    if (v.tbt > 300) add('WARN', 'vitals.tbt', `Total blocking time ${v.tbt} ms from ${v.longTaskCount} long task(s). Split or defer scene setup.`, at);
    if (v.hiddenCount) add('FAIL', 'content.hidden', `${v.hiddenCount} text element(s) still invisible after scrolling the whole page (reveal never ran?): ${v.hidden.slice(0, 3).join(', ')}`, at);
    if (v.imgsNoAltCount) add('FAIL', 'a11y.img-alt', `${v.imgsNoAltCount} <img> without alt: ${v.imgsNoAlt.slice(0, 3).join(', ')}`, at);
    if (v.unnamedCount) add('FAIL', 'a11y.control-name', `${v.unnamedCount} link/button(s) without an accessible name: ${v.unnamed.slice(0, 3).join(', ')}`, at);
    for (const c of v.canvases) {
      if (!c.ariaHidden && !c.labelled) add('WARN', 'a11y.canvas', `Canvas ${c.sel} is neither aria-hidden nor role="img" with a label.`, at);
      if (c.dpr > 2.01) add('WARN', 'perf.dpr', `Canvas ${c.sel} renders at ${c.dpr}x device pixels; clamp DPR to ≤ 2 (≤ 1.5 mid tier).`, at);
    }
    if (v.canvas && v.canvas.stats.stdev < 1.5 && v.canvas.stats.levels <= 2) add('WARN', 'webgl.blank', 'The WebGL canvas looks blank (one flat colour). Check the scene actually renders.', at);
    if (v.contexts > 1) add('WARN', 'webgl.contexts', `${v.contexts} WebGL contexts on one page; browsers cap them (~16) and each costs memory. Share one renderer.`, at);
    const software = /swiftshader|llvmpipe|software/i.test(v.renderer);
    if (v.contexts && o.minFps && v.fps < o.minFps) add(software ? 'WARN' : 'FAIL', 'perf.fps', `${v.fps} fps (minimum ${o.minFps})${software ? ' on a software renderer, so not conclusive' : ''}.`, at);
    else if (v.contexts && v.fps < 30 && !software) add('WARN', 'perf.fps', `${v.fps} fps while idle on ${v.renderer || 'this GPU'}.`, at);
    const drawBudget = v.name === 'desktop' ? 200 : 100;
    if (v.drawsPerFrame > drawBudget) add('WARN', 'perf.draw-calls', `${v.drawsPerFrame} draw calls per frame (budget ${drawBudget}). Merge or instance meshes.`, at);
    if (v.log.jsBytes > 400 * 1024) add('WARN', 'weight.js', `${kb(v.log.jsBytes)} of JavaScript transferred during load (budget ≈ 260 KB gz: 10 KB critical + 250 KB lazy 3D).`, at);
    if (v.log.bytes > 3.5 * 1024 * 1024) add('WARN', 'weight.total', `${kb(v.log.bytes)} transferred during load (3D assets budget 3 MB per view).`, at);
  }
  if (base) {
    if (!base.headings.includes(1)) add('WARN', 'a11y.h1', 'No visible <h1>.', 'desktop');
    else if (base.headings.filter((h) => h === 1).length > 1) add('WARN', 'a11y.h1', 'More than one visible <h1>.', 'desktop');
    const skip = base.headings.findIndex((h, i) => i && h > base.headings[i - 1] + 1);
    if (skip > 0) add('WARN', 'a11y.heading-order', `Heading level jumps from h${base.headings[skip - 1]} to h${base.headings[skip]}.`, 'desktop');
    if (!base.lang) add('WARN', 'a11y.lang', '<html> has no lang attribute.', 'desktop');
    if (base.canvas && base.canvas.change > 0.5 && !base.pauseControl) add('WARN', 'a11y.pause-control', 'The 3D scene animates continuously but no pause control was found (WCAG 2.2.2). Add a button with data-motion-toggle or an aria-label mentioning pause/motion.', 'desktop');
    if (!base.contexts && base.canvases.length) add('INFO', 'webgl.none', 'Canvas present but no WebGL context was created (2D canvas or lazy scene not reached).', 'desktop');
  }
  const p = r.passes;
  if (p.contextLoss?.newExceptions?.length) add('FAIL', 'webgl.context-loss', `Losing the WebGL context threw: ${p.contextLoss.newExceptions[0]}. Handle webglcontextlost/restored and show the poster.`, 'desktop');
  if (p.reducedMotion) {
    const rm = p.reducedMotion;
    if (rm.exceptions.length) add('FAIL', 'reduced-motion.exceptions', `Uncaught exception with reduced motion: ${rm.exceptions[0]}`, 'desktop');
    if (rm.canvas && rm.canvas.change > 0.5) add('FAIL', 'reduced-motion.3d', `The 3D scene keeps animating under prefers-reduced-motion: reduce (frame change ${rm.canvas.change}). Render a still frame or slow ambient motion only on request.`, 'desktop');
    if (base && rm.moving > Math.max(4, base.moving * 0.5)) add('WARN', 'reduced-motion.dom', `${rm.moving} elements still animate under reduced motion (vs ${base.moving} normally). Drop travel; keep opacity-only fades.`, 'desktop');
    if (rm.hiddenCount) add('FAIL', 'reduced-motion.hidden', `${rm.hiddenCount} text element(s) never become visible under reduced motion: ${rm.hidden.slice(0, 3).join(', ')}`, 'desktop');
    if (base && rm.textLength < base.textLength * 0.9) add('FAIL', 'reduced-motion.content', `Reduced-motion page shows ${rm.textLength} characters of text vs ${base.textLength} normally.`, 'desktop');
  }
  if (p.noWebGL) {
    const nw = p.noWebGL;
    if (nw.exceptions.length) add('FAIL', 'fallback.exceptions', `With WebGL unavailable the page throws: ${nw.exceptions[0]}`, 'desktop');
    if (base && nw.textLength < base.textLength * 0.9) add('FAIL', 'fallback.content', `Without WebGL the page shows ${nw.textLength} characters of text vs ${base.textLength}. Content must not depend on 3D.`, 'desktop');
    if (nw.hiddenCount) add('FAIL', 'fallback.hidden', `${nw.hiddenCount} text element(s) stay invisible without WebGL.`, 'desktop');
    if (nw.fold.stdev < 3) add('WARN', 'fallback.blank', 'The first screen is nearly blank without WebGL. Show the poster image.', 'desktop');
  }
  if (p.keyboard) {
    const k = p.keyboard;
    if (k.trapped) add('FAIL', 'keyboard.trap', `Keyboard focus is trapped on ${k.trapped} (WCAG 2.1.2).`, 'desktop');
    if (!k.stops) add('WARN', 'keyboard.none', 'Tab never reached a focusable element.', 'desktop');
    if (k.noRing.length) add('WARN', 'keyboard.focus-visible', `${k.noRing.length} focus stop(s) show no outline or box-shadow (check for another visible indicator): ${k.noRing.slice(0, 3).join(', ')}`, 'desktop');
  }
}

function markdown(r) {
  const rows = r.viewports.map((v) => `| ${v.name} ${v.width} | ${v.fps} | ${v.drawsPerFrame} | ${v.lcp} | ${v.cls} | ${v.tbt} | ${Math.round(v.log.jsBytes / 1024)} / ${Math.round(v.log.bytes / 1024)} | ${v.contexts} | ${v.moving} | ${v.overflowX > 1 ? v.overflowX + 'px' : 'no'} |`).join('\n');
  const f = r.findings.length ? r.findings.map((x) => `| ${x.level} | \`${x.id}\` | ${x.where} | ${x.msg.replace(/\|/g, '\\|')} |`).join('\n') : '| PASS | — | — | No findings. |';
  const p = r.passes;
  return `# Inspection report

- Target: ${r.target}
- Browser: ${r.browser}
- WebGL renderer: ${r.viewports[0]?.renderer || 'none'}
- Date: ${r.at}
- Result: **${r.summary.fail} FAIL, ${r.summary.warn} WARN**

## Measurements
| Viewport | FPS idle | Draws/frame | LCP ms | CLS | TBT ms | JS / total KB | GL contexts | Moving els | H-scroll |
|---|---|---|---|---|---|---|---|---|---|
${rows}

Lab numbers from a headless browser${/swiftshader|software|llvmpipe/i.test(r.viewports[0]?.renderer ?? '') ? ' on a **software** WebGL renderer: FPS is not representative of real devices' : ''}. Confirm vitals with Lighthouse and field data.

## Passes
- Reduced motion: ${p.reducedMotion ? `canvas change ${p.reducedMotion.canvas?.change ?? 'n/a'}, ${p.reducedMotion.moving} moving elements, ${p.reducedMotion.hiddenCount} hidden text` : 'skipped'}
- WebGL disabled: ${p.noWebGL ? `${p.noWebGL.textLength} chars of text, ${p.noWebGL.exceptions.length} exceptions, fold contrast ${p.noWebGL.fold.stdev.toFixed(1)}` : 'skipped'}
- Keyboard: ${p.keyboard ? `${p.keyboard.stops} stops (${p.keyboard.distinct} distinct)${p.keyboard.trapped ? `, TRAPPED on ${p.keyboard.trapped}` : ''}` : 'skipped'}
- Context loss: ${p.contextLoss ? `${p.contextLoss.contextsLost} context(s) lost and restored, ${p.contextLoss.newExceptions.length} exceptions` : 'skipped or no WebGL'}

## Findings
| Level | Rule | Where | Detail |
|---|---|---|---|
${f}

## Screenshots
${r.screenshots.map((s) => `- \`${s}\``).join('\n')}

Look at every screenshot before calling the work done (see \`immersive-audit/references/critique.md\`).
`;
}

// ---------- CLI ----------
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const flag = (n, d) => { const i = args.indexOf(`--${n}`); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
  const has = (n) => { const i = args.indexOf(`--${n}`); if (i < 0) return false; args.splice(i, 1); return true; };
  const opts = {
    out: flag('out', '.immersive/inspect'),
    widths: flag('widths', '1440,768,390').split(',').map(Number).filter(Boolean),
    skip: flag('skip', '').split(',').filter(Boolean),
    minFps: Number(flag('min-fps', 0)),
    wait: Number(flag('wait', 1500)),
  };
  const asJson = has('json');
  const target = args[0];
  if (!target || target.startsWith('-')) {
    console.error('usage: node inspect.mjs <url | file.html | folder> [--out DIR] [--widths 1440,768,390] [--skip reduced,nowebgl,keyboard,contextloss] [--min-fps N] [--wait ms] [--json]');
    process.exit(2);
  }
  if (!findBrowser()) { console.error('No Chrome, Edge or Chromium found. Install one or set JARVIS_CHROME. Fall back to the manual runtime checklist in immersive-audit.'); process.exit(3); }
  try {
    const r = await inspect(target, opts);
    if (asJson) console.log(JSON.stringify(r, null, 2));
    else {
      for (const v of r.viewports) console.log(`${v.name.padEnd(7)} ${String(v.width).padStart(4)}px  fps ${v.fps}  draws/frame ${v.drawsPerFrame}  LCP ${v.lcp}ms  CLS ${v.cls}  JS ${Math.round(v.log.jsBytes / 1024)}KB`);
      for (const f of r.findings) console.log(`${f.level.padEnd(4)} ${f.id}  [${f.where}]  ${f.msg}`);
      console.log(`\n${r.summary.fail} FAIL, ${r.summary.warn} WARN. Report and screenshots: ${relative(process.cwd(), resolve(opts.out)) || '.'}/`);
    }
    process.exit(r.summary.fail ? 1 : 0);
  } catch (e) { console.error(e.message); process.exit(e.code === 2 ? 2 : 1); }
}
