// Scripts injected into the inspected page. They are plain strings evaluated by Chrome, so they must be
// self-contained ES2017 and must never throw into the page.

/** Runs before any page script: records WebGL contexts, context loss, vitals, long tasks and motion. */
export const INSTRUMENT = (disableWebGL) => `(() => {
  const J = window.__jarvis = { contexts: [], lost: 0, lcp: 0, cls: 0, longTasks: [], moving: new WeakSet(), movingCount: 0, errors: [] };
  const proto = HTMLCanvasElement.prototype; const orig = proto.getContext;
  proto.getContext = function (type, attrs) {
    const gl = /webgl/i.test(String(type));
    if (gl && ${disableWebGL ? 'true' : 'false'}) return null;
    const ctx = orig.call(this, type, attrs);
    if (gl && ctx && !J.contexts.some((c) => c.ctx === ctx)) {
      J.contexts.push({ ctx, canvas: this, type: String(type) });
      this.addEventListener('webglcontextlost', () => { J.lost++; }, false);
    }
    return ctx;
  };
  J.draws = 0;
  for (const P of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!P) continue;
    for (const m of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
      const f = P.prototype[m]; if (typeof f !== 'function') continue;
      P.prototype[m] = function () { J.draws++; return f.apply(this, arguments); };
    }
  }
  J.renderer = () => { const c = J.contexts[0]; if (!c) return ''; try { const e = c.ctx.getExtension('WEBGL_debug_renderer_info'); return String(c.ctx.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : c.ctx.RENDERER)); } catch (e) { return ''; } };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) J.lcp = Math.max(J.lcp, e.renderTime || e.loadTime || e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) J.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) J.longTasks.push(e.duration); }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
  const note = (t) => { if (t && t.nodeType === 1 && !J.moving.has(t)) { J.moving.add(t); J.movingCount++; } };
  addEventListener('animationstart', (e) => note(e.target), true);
  addEventListener('transitionrun', (e) => note(e.target), true);
  const watch = () => new MutationObserver((list) => { for (const m of list) { const s = (m.target.getAttribute && m.target.getAttribute('style')) || ''; if (/transform|translate|opacity|scale|rotate|clip-path/.test(s)) note(m.target); } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['style'], subtree: true });
  if (document.documentElement) watch(); else addEventListener('DOMContentLoaded', watch);
  J.sampleMotion = () => { try { for (const a of document.getAnimations()) note(a.effect && a.effect.target); } catch (e) {} return J.movingCount; };
})();`;

/** Measures frames per second over \`ms\` milliseconds with requestAnimationFrame. */
export const FPS = (ms) => `new Promise((done) => { let n = 0; const t0 = performance.now(); const J = window.__jarvis || {}; const d0 = J.draws || 0;
  const tick = (t) => { n++; if (t - t0 < ${ms}) requestAnimationFrame(tick); else done({ fps: Math.round((n * 1000) / (t - t0)), drawsPerFrame: n ? Math.round(((J.draws || 0) - d0) / n) : 0 }); };
  requestAnimationFrame(tick); })`;

/** Scrolls through the whole page in viewport steps, then back to the top. */
export const SCROLL_THROUGH = `(async () => { const h = () => document.scrollingElement.scrollHeight; const step = innerHeight * 0.8;
  for (let y = 0; y < h() && y < 40000; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  scrollTo(0, h()); await new Promise((r) => setTimeout(r, 200)); window.__jarvis && window.__jarvis.sampleMotion();
  scrollTo(0, 0); await new Promise((r) => setTimeout(r, 200)); return h(); })()`;

/** The DOM facts the rules need. Runs after load (and after a scroll-through). */
export const SNAPSHOT = `(() => {
  const J = window.__jarvis || { contexts: [], longTasks: [] };
  const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && (document.getElementById(el.getAttribute('aria-labelledby')) || {}).textContent || el.textContent || el.getAttribute('title') || (el.querySelector('img[alt]') || {}).alt || '').trim();
  const describe = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
  const canvases = [...document.querySelectorAll('canvas')].filter(vis).map((c) => { const r = c.getBoundingClientRect(); const ctx = J.contexts.find((x) => x.canvas === c);
    return { sel: describe(c), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, webgl: !!ctx, ariaHidden: c.closest('[aria-hidden="true"]') !== null, labelled: !!(c.getAttribute('aria-label') || c.getAttribute('role') === 'img'),
      dpr: c.width && r.width ? +(c.width / r.width).toFixed(2) : 0 }; });
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis).map((h) => +h.tagName[1]);
  const imgsNoAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).map(describe);
  const unnamed = [...document.querySelectorAll('a[href],button,[role="button"]')].filter(vis).filter((el) => !name(el)).map(describe);
  // Text that is in the DOM but invisible once the page has settled — usually reveal animations that never ran.
  const hidden = [...document.querySelectorAll('h1,h2,h3,p,li,a,button')].filter((el) => el.textContent.trim().length > 2 && el.getBoundingClientRect().height > 0)
    .filter((el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (+s.opacity < 0.05 || s.visibility === 'hidden') return true; } return false; }).map(describe);
  const text = (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').trim();
  return {
    title: document.title, lang: document.documentElement.lang || '', viewport: [innerWidth, innerHeight],
    overflowX: document.scrollingElement.scrollWidth - innerWidth, pageHeight: document.scrollingElement.scrollHeight,
    canvases, contexts: J.contexts.length, renderer: J.renderer ? J.renderer() : '', lostContexts: J.lost || 0,
    lcp: Math.round(J.lcp || 0), cls: +(J.cls || 0).toFixed(3), longTaskCount: J.longTasks.length, tbt: Math.round(J.longTasks.reduce((s, d) => s + Math.max(0, d - 50), 0)),
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    moving: J.sampleMotion ? J.sampleMotion() : 0,
    headings, imgsNoAlt: imgsNoAlt.slice(0, 10), imgsNoAltCount: imgsNoAlt.length, unnamed: unnamed.slice(0, 10), unnamedCount: unnamed.length,
    hidden: hidden.slice(0, 10), hiddenCount: hidden.length, textLength: text.length, textSample: text.slice(0, 160),
    focusables: [...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter(vis).length,
    pauseControl: !!document.querySelector('[data-motion-toggle],[aria-label*="pause" i],[aria-label*="motion" i]'),
  };
})()`;

/** Describes the focused element and whether it shows a focus indicator. */
export const FOCUS = `(() => { const el = document.activeElement; if (!el || el === document.body) return null;
  const s = getComputedStyle(el); const r = el.getBoundingClientRect();
  const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
  return { sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label') + ']' : '') + ':' + Math.round(r.left) + ',' + Math.round(r.top),
    ring: !!ring, onScreen: r.bottom > 0 && r.top < innerHeight && r.width > 0, inCanvas: el.tagName === 'CANVAS' }; })()`;

/** Forces every WebGL context to be lost (and restored), as the GPU process or driver may do at any time. */
export const LOSE_CONTEXT = `(async () => { const J = window.__jarvis; if (!J) return 0; let n = 0;
  for (const c of J.contexts) { const ext = c.ctx.getExtension && c.ctx.getExtension('WEBGL_lose_context'); if (ext) { ext.loseContext(); n++; setTimeout(() => { try { ext.restoreContext(); } catch (e) {} }, 400); } }
  await new Promise((r) => setTimeout(r, 1200)); return n; })()`;
