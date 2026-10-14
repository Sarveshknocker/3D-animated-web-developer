#!/usr/bin/env node
// Finds and downloads free CC0 3D assets (HDRIs, PBR textures/materials, models) from Poly Haven and
// ambientCG, and records every download in .immersive/ASSET_CREDITS.json.
//
//   node assets.mjs search "<query>" [--type hdri|texture|model] [--source polyhaven|ambientcg|all] [--limit 8] [--json]
//   node assets.mjs get <polyhaven|ambientcg>:<id> [--type hdri|texture|model] [--res 1k] [--dir public/assets/3d] [--max-mb 60]
//   node assets.mjs credits                       # Markdown credit list for the handover / footer
//
// Zero dependencies, Node >= 18. Downloads only over https (or loopback in tests); file names inside
// archives and glTF bundles are sanitised so nothing can be written outside --dir.
import fs from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const UA = 'jarvis-immersive-kit (+https://github.com/Sarveshknocker/3D-animated-web-developer)';
const PH = () => process.env.JARVIS_POLYHAVEN_API ?? 'https://api.polyhaven.com';
const ACG = () => process.env.JARVIS_AMBIENTCG_API ?? 'https://ambientcg.com/api/v2';
const PH_TYPE = { hdri: 'hdris', texture: 'textures', model: 'models' };
const PH_TYPE_BACK = { 0: 'hdri', 1: 'texture', 2: 'model' };
const ACG_TYPE = { hdri: 'HDRI', texture: 'Material', model: '3DModel' };
const CREDITS = '.immersive/ASSET_CREDITS.json';

function checkUrl(u) {
  const url = new URL(u);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error(`Refusing non-https download: ${u}`);
  return url;
}
async function fetchJson(u) {
  const r = await fetch(checkUrl(u), { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${u}`);
  return r.json();
}
async function fetchBuf(u, maxBytes) {
  const r = await fetch(checkUrl(u), { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${u}`);
  const len = Number(r.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new Error(`${u} is ${(len / 1048576).toFixed(1)} MB (limit ${maxBytes / 1048576} MB; raise --max-mb or pick a lower --res)`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > maxBytes) throw new Error(`${u} exceeded ${maxBytes / 1048576} MB`);
  return buf;
}

/** Joins an untrusted relative path under dir; throws if it would escape. */
export function safeJoin(dir, rel) {
  const clean = String(rel).replace(/\\/g, '/');
  if (!clean || clean.startsWith('/') || /^[a-zA-Z]:/.test(clean) || clean.split('/').includes('..')) throw new Error(`Unsafe path in asset bundle: ${rel}`);
  const out = path.resolve(dir, clean);
  if (!out.startsWith(path.resolve(dir) + path.sep)) throw new Error(`Unsafe path in asset bundle: ${rel}`);
  return out;
}

/** Minimal ZIP reader (stored + deflate), enough for ambientCG archives. */
export function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a ZIP archive');
  const count = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16); const files = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt ZIP central directory');
    const method = buf.readUInt16LE(p + 10); const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28); const extraLen = buf.readUInt16LE(p + 30); const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42); const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error(`Unsupported ZIP compression ${method} for ${name}`);
    files.push({ name, data: method === 8 ? inflateRawSync(raw) : raw });
  }
  return files;
}

const words = (q) => String(q).toLowerCase().split(/[\s,]+/).filter(Boolean);

export async function search(query, { type, source = 'all', limit = 8 } = {}) {
  const q = words(query); const out = [];
  if (source === 'all' || source === 'polyhaven') {
    const all = await fetchJson(`${PH()}/assets?t=${type ? PH_TYPE[type] : 'all'}`);
    for (const [id, a] of Object.entries(all)) {
      const hay = [id, a.name, ...(a.tags ?? []), ...(a.categories ?? []), a.category ?? ''].join(' ').toLowerCase();
      const score = q.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
      if (!q.length || score === q.length) out.push({ source: 'polyhaven', id, name: a.name, type: PH_TYPE_BACK[a.type] ?? type ?? '?', tags: (a.tags ?? []).slice(0, 6), popularity: a.download_count ?? 0, page: `https://polyhaven.com/a/${id}`, licence: 'CC0-1.0' });
    }
  }
  if (source === 'all' || source === 'ambientcg') {
    const j = await fetchJson(`${ACG()}/full_json?q=${encodeURIComponent(q.join(' '))}&limit=${limit}&sort=popular${type ? `&type=${ACG_TYPE[type]}` : ''}`);
    for (const a of j.foundAssets ?? []) out.push({ source: 'ambientcg', id: a.assetId, name: a.displayName ?? a.assetId, type: Object.entries(ACG_TYPE).find(([, v]) => v === a.dataType)?.[0] ?? a.dataType, tags: (a.tags ?? []).slice(0, 6), popularity: a.downloadCount ?? 0, page: `https://ambientcg.com/view?id=${a.assetId}`, licence: 'CC0-1.0' });
  }
  const per = (s) => out.filter((x) => x.source === s).sort((a, b) => b.popularity - a.popularity).slice(0, limit);
  return [...per('polyhaven'), ...per('ambientcg')];
}

function record(entry) {
  fs.mkdirSync(path.dirname(CREDITS), { recursive: true });
  const list = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, 'utf8')) : [];
  fs.writeFileSync(CREDITS, JSON.stringify([...list.filter((e) => !(e.source === entry.source && e.id === entry.id)), entry], null, 2));
}

export async function get(ref, { type, res = '1k', dir = 'public/assets/3d', maxMb = 60 } = {}) {
  const [source, id] = ref.includes(':') ? ref.split(':') : ['polyhaven', ref];
  if (!/^[\w.-]+$/.test(id ?? '')) throw new Error(`Bad asset id: ${id}`);
  const max = maxMb * 1048576; const written = []; let meta = {};
  const save = async (rel, url) => { const f = safeJoin(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, await fetchBuf(url, max)); written.push(path.relative('.', f).split(path.sep).join('/')); };

  if (source === 'polyhaven') {
    const info = await fetchJson(`${PH()}/info/${id}`).catch(() => ({}));
    const files = await fetchJson(`${PH()}/files/${id}`);
    const kind = type ?? PH_TYPE_BACK[info.type] ?? (files.hdri ? 'hdri' : files.Diffuse ? 'texture' : 'model');
    meta = { name: info.name ?? id, authors: Object.keys(info.authors ?? {}) };
    if (kind === 'hdri') {
      const f = files.hdri?.[res]?.hdr ?? files.hdri?.[res]?.exr;
      if (!f) throw new Error(`No ${res} HDRI for ${id}. Available: ${Object.keys(files.hdri ?? {}).join(', ')}`);
      await save(`${id}_${res}${path.extname(new URL(f.url).pathname)}`, f.url);
    } else if (kind === 'texture') {
      for (const map of ['Diffuse', 'nor_gl', 'arm', 'Displacement']) {
        const f = files[map]?.[res]?.jpg ?? files[map]?.[res]?.png;
        if (f) await save(`${id}/${path.basename(new URL(f.url).pathname)}`, f.url);
      }
      if (!written.length) throw new Error(`No ${res} texture maps for ${id}.`);
    } else {
      const g = files.gltf?.[res]?.gltf;
      if (!g) throw new Error(`No ${res} glTF for ${id}. Available: ${Object.keys(files.gltf ?? {}).join(', ')}`);
      await save(`${id}/${id}_${res}.gltf`, g.url);
      for (const [rel, f] of Object.entries(g.include ?? {})) await save(`${id}/${rel}`, f.url);
    }
  } else if (source === 'ambientcg') {
    const j = await fetchJson(`${ACG()}/full_json?id=${encodeURIComponent(id)}&include=downloadData`);
    const a = j.foundAssets?.[0];
    if (!a) throw new Error(`ambientCG asset not found: ${id}`);
    meta = { name: a.displayName ?? id, authors: ['ambientCG (Lennart Demes)'] };
    const downloads = Object.values(a.downloadFolders ?? {}).flatMap((f) => Object.values(f.downloadFiletypeCategories ?? {}).flatMap((c) => c.downloads ?? []));
    const R = res.toUpperCase();
    const pick = downloads.find((d) => d.attribute === `${R}-JPG`) ?? downloads.find((d) => d.attribute?.startsWith(R)) ?? downloads[0];
    if (!pick) throw new Error(`No downloads listed for ${id}`);
    const buf = await fetchBuf(pick.downloadLink ?? pick.fullDownloadPath, max);
    if (/\.zip$/i.test(pick.fileName ?? '') || buf.readUInt32LE(0) === 0x04034b50) {
      // Keep what a browser can use; skip DCC files (.blend, .usdc, .mtlx, .tres) and the DirectX normal map.
      for (const f of unzip(buf).filter((x) => /.(jpe?g|png|webp|hdr|exr|gltf|glb|bin|ktx2)$/i.test(x.name) && !/NormalDX/i.test(x.name))) { const out = safeJoin(path.join(dir, id), f.name); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, f.data); written.push(path.relative('.', out).split(path.sep).join('/')); }
    } else await save(`${id}/${pick.fileName}`, pick.downloadLink);
  } else throw new Error(`Unknown source "${source}" (use polyhaven or ambientcg)`);

  const entry = { source, id, name: meta.name, authors: meta.authors, licence: 'CC0-1.0', page: source === 'polyhaven' ? `https://polyhaven.com/a/${id}` : `https://ambientcg.com/view?id=${id}`, res, files: written, downloadedAt: new Date().toISOString() };
  record(entry);
  return entry;
}

export function credits() {
  const list = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, 'utf8')) : [];
  if (!list.length) return 'No downloaded assets recorded.';
  return ['| Asset | Source | Author(s) | Licence | Files |', '|---|---|---|---|---|',
    ...list.map((e) => `| [${e.name}](${e.page}) | ${e.source} | ${e.authors?.join(', ') || '—'} | ${e.licence} | ${e.files.length} |`)].join('\n')
    + '\n\nCC0 needs no attribution, but crediting Poly Haven / ambientCG is good practice and supports them.';
}

const HINT = {
  hdri: 'three: new RGBELoader().load(url, (t) => { t.mapping = EquirectangularReflectionMapping; scene.environment = t; }) — R3F: <Environment files={url} />. Use 1k–2k for lighting; never as a visible 8k backdrop on mobile.',
  texture: 'MeshStandardMaterial: map = *_diff / *_Color (set colorSpace = SRGBColorSpace), normalMap = *_nor_gl / *_NormalGL, roughnessMap = *_Roughness, aoMap = *_AmbientOcclusion; Poly Haven *_arm packs AO/roughness/metal in R/G/B. Convert to KTX2/WebP and cap at 1024² on mobile before shipping.',
  model: 'Run optimize-assets.mjs on the folder to get a compressed GLB, then load that (never the raw glTF) in production.',
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const flag = (n, d) => { const i = args.indexOf(`--${n}`); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
  const has = (n) => { const i = args.indexOf(`--${n}`); if (i < 0) return false; args.splice(i, 1); return true; };
  const type = flag('type'); const json = has('json');
  if (type && !PH_TYPE[type]) { console.error('--type must be hdri, texture or model'); process.exit(2); }
  const [cmd, arg] = args;
  try {
    if (cmd === 'search' && arg) {
      const r = await search(arg, { type, source: flag('source', 'all'), limit: Number(flag('limit', 8)) });
      if (json) console.log(JSON.stringify(r, null, 2));
      else if (!r.length) console.log('No CC0 assets matched. Try fewer or broader words.');
      else for (const a of r) console.log(`${(a.source + ':' + a.id).padEnd(34)} ${a.type.padEnd(8)} ${a.name}  [${a.tags.join(', ')}]  ${a.page}`);
    } else if (cmd === 'get' && arg) {
      const e = await get(arg, { type, res: flag('res', '1k'), dir: flag('dir', 'public/assets/3d'), maxMb: Number(flag('max-mb', 60)) });
      console.log(`✔ ${e.name} (${e.licence}) → ${e.files.length} file(s)\n${e.files.map((f) => '  ' + f).join('\n')}`);
      const kind = type ?? (e.files.some((f) => /\.(hdr|exr)$/.test(f)) ? 'hdri' : e.files.some((f) => /\.(gltf|glb|fbx|obj)$/i.test(f)) ? 'model' : 'texture');
      console.log(`\nUse: ${HINT[kind]}\nRecorded in ${CREDITS}.`);
    } else if (cmd === 'credits') console.log(credits());
    else { console.error('usage: assets.mjs search "<query>" [--type hdri|texture|model] [--source polyhaven|ambientcg|all] | get <source>:<id> [--res 1k] [--dir public/assets/3d] | credits'); process.exit(2); }
  } catch (e) { console.error(`✖ ${e.message}`); process.exit(1); }
}
