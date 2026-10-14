// Tiny PNG decoder (8-bit RGB / RGBA, non-interlaced: what Chrome's screenshots produce) and pixel statistics.
import { inflateSync } from 'node:zlib';

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8; let width = 0; let height = 0; let colorType = 0; let depth = 0; let interlace = 0; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off); const type = buf.toString('ascii', off + 4, off + 8); const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace || ![2, 6].includes(colorType)) throw new Error(`unsupported PNG (depth ${depth}, colour ${colorType}, interlace ${interlace})`);
  const bpp = colorType === 6 ? 4 : 3; const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]; const src = y * (stride + 1) + 1; const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0; const b = y ? out[dst - stride + x] : 0; const c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return { width, height, bpp, data: out };
}

/** Luminance statistics, sampled on a grid so large screenshots stay cheap. */
export function lumaStats(img, step = 4) {
  let n = 0; let sum = 0; let sq = 0; const hist = new Map();
  for (let y = 0; y < img.height; y += step) for (let x = 0; x < img.width; x += step) {
    const i = (y * img.width + x) * img.bpp;
    const l = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
    n++; sum += l; sq += l * l; const q = l >> 3; hist.set(q, (hist.get(q) ?? 0) + 1);
  }
  const mean = n ? sum / n : 0;
  return { mean, stdev: n ? Math.sqrt(Math.max(0, sq / n - mean * mean)) : 0, levels: hist.size, samples: n };
}

/** Mean absolute per-channel difference (0–255) between two same-sized images. */
export function diff(a, b, step = 4) {
  if (a.width !== b.width || a.height !== b.height) return 255;
  let n = 0; let d = 0;
  for (let y = 0; y < a.height; y += step) for (let x = 0; x < a.width; x += step) {
    const i = (y * a.width + x) * a.bpp; const j = (y * b.width + x) * b.bpp;
    d += Math.abs(a.data[i] - b.data[j]) + Math.abs(a.data[i + 1] - b.data[j + 1]) + Math.abs(a.data[i + 2] - b.data[j + 2]); n += 3;
  }
  return n ? d / n : 0;
}
