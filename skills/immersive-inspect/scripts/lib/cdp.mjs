// Minimal Chrome DevTools Protocol client: launches an installed Chrome / Edge / Chromium and talks to it
// over a hand-rolled WebSocket (Node 18 has no global WebSocket). Zero dependencies.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Finds a Chromium-family browser. JARVIS_CHROME overrides. Returns null when none is installed. */
export function findBrowser() {
  const env = process.env.JARVIS_CHROME || process.env.CHROME_PATH;
  if (env && existsSync(env)) return env;
  const pf = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = {
    win32: pf.flatMap((p) => [
      join(p, 'Google/Chrome/Application/chrome.exe'),
      join(p, 'Chromium/Application/chrome.exe'),
      join(p, 'Microsoft/Edge/Application/msedge.exe'),
      join(p, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
    ]),
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ],
  }[process.platform] ?? ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser']
    .flatMap((b) => ['/usr/bin/', '/usr/local/bin/', '/snap/bin/', '/opt/google/chrome/'].map((d) => d + b));
  return candidates.find((c) => existsSync(c)) ?? null;
}

// ---------- WebSocket (RFC 6455 client, text frames only) ----------
function connectWs(url) {
  const u = new URL(url);
  const key = randomBytes(16).toString('base64');
  return new Promise((resolve, reject) => {
    const req = request({ host: u.hostname, port: u.port, path: u.pathname, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13' } });
    req.on('upgrade', (_res, socket) => {
      let buf = Buffer.alloc(0); let parts = [];
      const ws = { onmessage: null, onclose: null, send, close: () => socket.destroy() };
      function send(text) {
        const data = Buffer.from(text); const mask = randomBytes(4); const len = data.length;
        const head = len < 126 ? Buffer.from([0x81, 0x80 | len]) : len < 65536 ? Buffer.from([0x81, 0xfe, len >> 8, len & 255]) : Buffer.concat([Buffer.from([0x81, 0xff, 0, 0, 0, 0]), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(len); return b; })()]);
        for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
        socket.write(Buffer.concat([head, mask, data]));
      }
      socket.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        for (;;) {
          if (buf.length < 2) return;
          const fin = buf[0] & 0x80; const op = buf[0] & 0x0f; let len = buf[1] & 0x7f; let off = 2;
          if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
          else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
          if (buf.length < off + len) return;
          const payload = buf.subarray(off, off + len); buf = buf.subarray(off + len);
          if (op === 8) { socket.destroy(); return; }
          if (op === 9) continue; // ping: Chrome does not require a pong for CDP
          if (op === 0 || op === 1) { parts.push(payload); if (fin) { const msg = Buffer.concat(parts).toString('utf8'); parts = []; ws.onmessage?.(msg); } }
        }
      });
      socket.on('close', () => ws.onclose?.());
      socket.on('error', () => {});
      resolve(ws);
    });
    req.on('response', (res) => reject(new Error(`WebSocket upgrade refused: HTTP ${res.statusCode}`)));
    req.on('error', reject);
    req.end();
  });
}

// ---------- Browser / Page ----------
export class Browser {
  static async launch({ executable = findBrowser(), extraArgs = [], timeout = 20000 } = {}) {
    if (!executable) throw new Error('No Chrome, Edge or Chromium found. Install one or set JARVIS_CHROME=/path/to/browser.');
    const profile = mkdtempSync(join(tmpdir(), 'jarvis-inspect-'));
    const args = [
      '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
      '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio', '--hide-scrollbars',
      '--disable-background-networking', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', '--disable-component-update', '--disable-sync',
      // Keep WebGL available on machines and CI runners without a GPU (software rasteriser).
      '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
      ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
      ...extraArgs, 'about:blank',
    ];
    const proc = spawn(executable, args, { stdio: 'ignore' });
    const portFile = join(profile, 'DevToolsActivePort');
    const t0 = Date.now();
    while (!existsSync(portFile) || readFileSync(portFile, 'utf8').split('\n').length < 2) {
      if (proc.exitCode !== null) throw new Error(`Browser exited early (${executable}).`);
      if (Date.now() - t0 > timeout) { proc.kill(); throw new Error('Browser did not open a debugging port in time.'); }
      await sleep(50);
    }
    const [port, wsPath] = readFileSync(portFile, 'utf8').trim().split('\n');
    const ws = await connectWs(`ws://127.0.0.1:${port}${wsPath}`);
    return new Browser(proc, ws, profile, executable);
  }

  constructor(proc, ws, profile, executable) {
    this.proc = proc; this.ws = ws; this.profile = profile; this.executable = executable;
    this.id = 0; this.pending = new Map(); this.listeners = new Map();
    ws.onmessage = (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, method } = this.pending.get(msg.id); this.pending.delete(msg.id);
        msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(`${msg.sessionId ?? ''}|${msg.method}`) ?? []) fn(msg.params);
      }
    };
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(sessionId, method, fn) {
    const k = `${sessionId ?? ''}|${method}`;
    this.listeners.set(k, [...(this.listeners.get(k) ?? []), fn]);
  }

  async newPage() {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    return new Page(this, sessionId, targetId);
  }

  async close() {
    try { await Promise.race([this.send('Browser.close'), sleep(2000)]); } catch {}
    this.ws.close();
    if (this.proc.exitCode === null) this.proc.kill();
    for (let i = 0; i < 20 && this.proc.exitCode === null; i++) await sleep(100);
    try { rmSync(this.profile, { recursive: true, force: true }); } catch {}
  }
}

export class Page {
  constructor(browser, sessionId, targetId) { this.b = browser; this.sessionId = sessionId; this.targetId = targetId; }
  send(method, params) { return this.b.send(method, params, this.sessionId); }
  on(method, fn) { this.b.on(this.sessionId, method, fn); }
  once(method, timeout = 30000) {
    return new Promise((resolve) => {
      let done = false;
      const t = setTimeout(() => { done = true; resolve(null); }, timeout);
      this.on(method, (p) => { if (!done) { done = true; clearTimeout(t); resolve(p); } });
    });
  }

  /** Evaluates an expression (string) in the page; returns the JSON value. Throws on exceptions. */
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(`page eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }

  async navigate(url, { timeout = 30000 } = {}) {
    const loaded = this.once('Page.loadEventFired', timeout);
    const r = await this.send('Page.navigate', { url });
    if (r.errorText) throw new Error(`navigation failed: ${r.errorText}`);
    return loaded;
  }

  async screenshot({ format = 'png', quality, clip, full = false } = {}) {
    const params = { format, ...(quality ? { quality } : {}), ...(clip ? { clip: { ...clip, scale: 1 } } : {}), captureBeyondViewport: full };
    const { data } = await this.send('Page.captureScreenshot', params);
    return Buffer.from(data, 'base64');
  }

  async key(key, code = key, keyCode = 9, shift = false) {
    const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers: shift ? 8 : 0 };
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }
}
