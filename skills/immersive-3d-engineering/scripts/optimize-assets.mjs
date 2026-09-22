#!/usr/bin/env node
// Optimize every .glb/.gltf in a folder for the web using @gltf-transform/cli (via npx).
// Usage: node optimize-assets.mjs <inputDir> <outputDir> [--ktx2] [--texture-size 2048]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [inDir, outDir, ...rest] = process.argv.slice(2);
if (!inDir || !outDir) {
  console.error('Usage: node optimize-assets.mjs <inputDir> <outputDir> [--ktx2] [--texture-size 2048]');
  process.exit(2);
}
const ktx2 = rest.includes('--ktx2');
const sizeIdx = rest.indexOf('--texture-size');
const texSize = sizeIdx >= 0 ? rest[sizeIdx + 1] : '2048';

fs.mkdirSync(outDir, { recursive: true });
const models = fs.readdirSync(inDir).filter((f) => /\.(glb|gltf)$/i.test(f));
if (!models.length) { console.log('No .glb/.gltf files found in', inDir); process.exit(0); }

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
let failed = 0;
for (const file of models) {
  const input = path.join(inDir, file);
  const output = path.join(outDir, file.replace(/\.gltf$/i, '.glb'));
  const args = ['--yes', '@gltf-transform/cli', 'optimize', input, output,
    '--compress', 'meshopt',
    '--texture-compress', ktx2 ? 'ktx2' : 'webp',
    '--texture-size', texSize,
    '--simplify', 'true', '--simplify-error', '0.0005'];
  console.log(`→ ${file}`);
  const r = spawnSync(npx, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) { failed++; continue; }
  const before = fs.statSync(input).size, after = fs.statSync(output).size;
  console.log(`  ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (${((1 - after / before) * 100).toFixed(0)}% smaller)${after > 3 * 1048576 ? '  ⚠ still > 3 MB budget' : ''}`);
}
process.exit(failed ? 1 : 0);
