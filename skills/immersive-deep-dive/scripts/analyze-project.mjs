#!/usr/bin/env node
// Zero-dependency project analyzer for the Jarvis Immersive kit.
// Usage: node analyze-project.mjs [projectRoot] [--out .immersive]
// Writes <out>/project-profile.json and <out>/project-profile.md
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
const outIdx = args.indexOf('--out');
const outDir = path.resolve(root, outIdx >= 0 ? args[outIdx + 1] : '.immersive');

const IGNORE = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro', 'dist', 'build', 'out',
  '.output', '.vercel', '.netlify', 'coverage', '.turbo', '.cache', '.immersive', '.claude', 'vendor',
]);
const MAX_FILES = 20000;

// ---------- helpers ----------
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => {
  try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { return null; }
};
const readJSON = (p) => {
  const t = read(p);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
};

function walk(dir = root, acc = []) {
  if (acc.length >= MAX_FILES) return acc;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else {
      let size = 0;
      try { size = fs.statSync(full).size; } catch {}
      acc.push({ rel: path.relative(root, full).split(path.sep).join('/'), size });
    }
    if (acc.length >= MAX_FILES) break;
  }
  return acc;
}

const files = walk();
const byExt = (...exts) => files.filter((f) => exts.some((x) => f.rel.toLowerCase().endsWith(x)));
const kb = (n) => Math.round(n / 1024);

// ---------- package / deps ----------
const pkg = readJSON('package.json') ?? {};
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
const has = (name) => Object.prototype.hasOwnProperty.call(deps, name);
const ver = (name) => deps[name] ?? null;
const pick = (list) => list.filter(has).map((n) => ({ name: n, version: ver(n) }));

const packageManager =
  exists('pnpm-lock.yaml') ? 'pnpm' :
  exists('yarn.lock') ? 'yarn' :
  exists('bun.lockb') || exists('bun.lock') ? 'bun' :
  exists('package-lock.json') ? 'npm' :
  exists('package.json') ? 'npm (no lockfile)' : 'none';

// ---------- framework detection ----------
function detectFramework() {
  if (has('next')) {
    const appDir = ['app', 'src/app'].find((d) => files.some((f) => f.rel.startsWith(d + '/') && /\/(page|layout)\.(t|j)sx?$/.test(f.rel)));
    const pagesDir = ['pages', 'src/pages'].find((d) => files.some((f) => f.rel.startsWith(d + '/')));
    return { id: 'next', label: 'Next.js', version: ver('next'), router: appDir ? `app (${appDir})` : pagesDir ? `pages (${pagesDir})` : 'unknown', ui: 'react' };
  }
  if (has('nuxt')) return { id: 'nuxt', label: 'Nuxt', version: ver('nuxt'), ui: 'vue' };
  if (has('@remix-run/react') || has('@react-router/dev')) return { id: 'remix', label: 'Remix / React Router', ui: 'react' };
  if (has('astro')) {
    const islands = ['@astrojs/react', '@astrojs/vue', '@astrojs/svelte', '@astrojs/solid-js'].filter(has);
    return { id: 'astro', label: 'Astro', version: ver('astro'), islands, ui: islands[0]?.split('/')[1] ?? 'none' };
  }
  if (has('@sveltejs/kit')) return { id: 'sveltekit', label: 'SvelteKit', ui: 'svelte' };
  if (has('@angular/core')) return { id: 'angular', label: 'Angular', version: ver('@angular/core'), ui: 'angular' };
  if (has('gatsby')) return { id: 'gatsby', label: 'Gatsby', ui: 'react' };
  if (has('vue')) return { id: 'vue', label: has('vite') ? 'Vue + Vite' : 'Vue', ui: 'vue' };
  if (has('svelte')) return { id: 'svelte', label: 'Svelte', ui: 'svelte' };
  if (has('solid-js')) return { id: 'solid', label: 'SolidJS', ui: 'solid' };
  if (has('react')) return { id: 'react', label: has('vite') ? 'React + Vite' : has('react-scripts') ? 'Create React App' : 'React', ui: 'react' };
  if (byExt('.html').length) return { id: 'static', label: 'Static HTML/CSS/JS', ui: 'vanilla' };
  if (exists('manage.py') || exists('requirements.txt') || exists('pyproject.toml')) return { id: 'python-templates', label: 'Python server templates (Django/Flask?)', ui: 'vanilla' };
  if (exists('composer.json')) return { id: 'php', label: 'PHP (Laravel/WordPress?)', ui: 'vanilla' };
  return { id: 'unknown', label: 'Unknown', ui: 'vanilla' };
}
const framework = detectFramework();

// Recommended 3D binding per UI layer
const bindingFor = {
  react: '@react-three/fiber + @react-three/drei (+ @react-three/postprocessing)',
  vue: '@tresjs/core + @tresjs/cientos',
  svelte: '@threlte/core + @threlte/extras',
  solid: 'solid-three or vanilla three.js in onMount',
  angular: 'angular-three or vanilla three.js in a standalone component (runOutsideAngular)',
  vanilla: 'vanilla three.js ES module (lazy-loaded)',
  none: 'vanilla three.js inside an Astro island (client:visible)',
};

// ---------- styling / design system ----------
const styling = {
  tailwind: has('tailwindcss') ? ver('tailwindcss') : null,
  tailwindConfig: ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.cjs'].find(exists) ?? null,
  cssInJs: pick(['styled-components', '@emotion/react', '@stitches/react', '@vanilla-extract/css', '@pandacss/dev']),
  preprocessors: pick(['sass', 'less', 'postcss']),
  cssModules: files.some((f) => /\.module\.(s?css|less)$/.test(f.rel)),
  componentLibs: pick(['@radix-ui/react-slot', '@mui/material', '@chakra-ui/react', 'antd', '@mantine/core', '@headlessui/react', 'vuetify', '@nextui-org/react', 'shadcn', 'daisyui']),
  shadcn: exists('components.json'),
};

// Extract brand tokens: CSS custom properties and hex colors from global styles + tailwind config
function extractTokens() {
  const cssFiles = byExt('.css', '.scss').filter((f) => /(global|globals|index|main|app|theme|tokens|variables|base|style)s?\.(s?css)$/i.test(f.rel)).slice(0, 12);
  const vars = {};
  const hexCount = {};
  const fontFamilies = new Set();
  const sources = [...cssFiles.map((f) => f.rel), styling.tailwindConfig].filter(Boolean);
  for (const rel of sources) {
    const t = read(rel);
    if (!t) continue;
    for (const m of t.matchAll(/(--[\w-]+)\s*:\s*([^;}\n]+)/g)) {
      if (Object.keys(vars).length < 120 && !vars[m[1]]) vars[m[1]] = m[2].trim();
    }
    for (const m of t.matchAll(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
      const h = m[0].toLowerCase();
      hexCount[h] = (hexCount[h] ?? 0) + 1;
    }
    for (const m of t.matchAll(/font-family\s*:\s*([^;}\n]+)/g)) fontFamilies.add(m[1].trim());
  }
  const topColors = Object.entries(hexCount).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c]) => c);
  return { sources, cssVariables: vars, topHexColors: topColors, fontFamilies: [...fontFamilies].slice(0, 8) };
}
const tokens = extractTokens();

// Fonts via next/font, @fontsource, or <link> google fonts
function detectFonts() {
  const out = new Set();
  for (const d of Object.keys(deps)) if (d.startsWith('@fontsource')) out.add(d.replace(/^@fontsource(-variable)?\//, '') + ' (@fontsource)');
  const candidates = files.filter((f) => /(layout|_app|_document|app|index|root)\.(t|j)sx?$|\.html$|\.astro$|\.vue$/.test(f.rel)).slice(0, 40);
  for (const f of candidates) {
    const t = read(f.rel) ?? '';
    for (const m of t.matchAll(/from\s+['"]next\/font\/google['"]/g)) {
      for (const n of t.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/g)) n[1].split(',').forEach((x) => out.add(x.trim() + ' (next/font)'));
      void m;
    }
    for (const m of t.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/g)) out.add(decodeURIComponent(m[1]).replace(/\+/g, ' ') + ' (Google Fonts link)');
  }
  const fontFiles = byExt('.woff2', '.woff', '.ttf', '.otf').map((f) => f.rel).slice(0, 10);
  return { families: [...out], selfHostedFiles: fontFiles };
}
const fonts = detectFonts();

// ---------- motion / 3D already present ----------
const motion = {
  threeD: pick(['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', '@tresjs/core', '@threlte/core', 'babylonjs', '@babylonjs/core', '@splinetool/react-spline', '@splinetool/runtime', 'ogl', 'pixi.js', 'postprocessing', 'detect-gpu', 'r3f-perf', 'leva', 'maath', 'three-stdlib']),
  animation: pick(['gsap', '@gsap/react', 'framer-motion', 'motion', 'animejs', 'lottie-web', 'lottie-react', '@lottiefiles/dotlottie-react', 'react-spring', '@react-spring/web', '@react-spring/three', 'popmotion', 'theatre', '@theatre/core', 'rive-react', '@rive-app/react-canvas', '@vueuse/motion', 'aos', 'split-type']),
  scroll: pick(['lenis', '@studio-freight/lenis', 'locomotive-scroll', '@studio-freight/react-lenis', 'lenis/react']),
};

// ---------- assets ----------
const assets = {
  models: byExt('.glb', '.gltf', '.fbx', '.obj', '.usdz').map((f) => ({ file: f.rel, kb: kb(f.size) })),
  environmentMaps: byExt('.hdr', '.exr').map((f) => ({ file: f.rel, kb: kb(f.size) })),
  compressedTextures: byExt('.ktx2', '.basis').length,
  largeImages: byExt('.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif').filter((f) => f.size > 500 * 1024).map((f) => ({ file: f.rel, kb: kb(f.size) })).slice(0, 25),
  videos: byExt('.mp4', '.webm', '.mov').map((f) => ({ file: f.rel, kb: kb(f.size) })).slice(0, 25),
  lottie: files.filter((f) => /\.(lottie)$/.test(f.rel) || (/\.json$/.test(f.rel) && /lottie|anim/i.test(f.rel))).map((f) => f.rel).slice(0, 20),
  svgCount: byExt('.svg').length,
  logos: files.filter((f) => /logo/i.test(f.rel) && /\.(svg|png|webp)$/i.test(f.rel)).map((f) => f.rel).slice(0, 10),
};

// ---------- routes / content ----------
function detectRoutes() {
  const routeFiles = files.filter((f) =>
    /(^|\/)(app|src\/app)\/.*page\.(t|j)sx?$/.test(f.rel) ||
    /(^|\/)(pages|src\/pages)\/(?!api\/|_).*\.(t|j)sx?$|\.astro$|\.vue$|\.md$|\.mdx$/.test(f.rel) && /(^|\/)(pages|src\/pages)\//.test(f.rel) ||
    /(^|\/)src\/routes\/.*\+page\.svelte$/.test(f.rel) ||
    (framework.id === 'static' && f.rel.endsWith('.html')) ||
    (framework.id === 'nuxt' && /^(src\/)?pages\//.test(f.rel)),
  );
  return routeFiles.map((f) => f.rel).slice(0, 80);
}
const routes = detectRoutes();

const content = {
  markdown: byExt('.md', '.mdx').filter((f) => !/(^|\/)(readme|changelog|license|contributing|claude)\.md$/i.test(f.rel)).length,
  cms: pick(['@sanity/client', 'next-sanity', 'contentful', '@contentful/rich-text-react-renderer', '@prismicio/client', '@storyblok/react', '@strapi/strapi', '@payloadcms/next', 'payload', '@builder.io/react', 'contentlayer', '@keystatic/core', '@tinacms/cli', 'graphql-request', '@apollo/client']),
  i18n: pick(['next-intl', 'next-i18next', 'react-i18next', 'i18next', '@nuxtjs/i18n', 'vue-i18n', '@angular/localize', 'svelte-i18n', 'paraglide-js', '@inlang/paraglide-js']),
  rtlHints: files.some((f) => /(^|\/)(ar|he|fa|ur)(\.json|\/)/.test(f.rel)),
};

// ---------- quality / ops constraints ----------
function detectCSP() {
  const sources = ['next.config.js', 'next.config.mjs', 'next.config.ts', 'middleware.ts', 'middleware.js', 'src/middleware.ts', 'vercel.json', 'netlify.toml', '_headers', 'public/_headers', 'nginx.conf', 'firebase.json', 'staticwebapp.config.json'];
  const hits = [];
  for (const s of sources) {
    const t = read(s);
    if (t && /content-security-policy/i.test(t)) hits.push(s);
  }
  for (const f of byExt('.html').slice(0, 30)) {
    const t = read(f.rel);
    if (t && /http-equiv=["']content-security-policy/i.test(t)) hits.push(f.rel);
  }
  return hits;
}

const quality = {
  typescript: has('typescript') || exists('tsconfig.json'),
  lint: pick(['eslint', 'biome', '@biomejs/biome', 'prettier', 'stylelint']),
  unitTests: pick(['vitest', 'jest', '@testing-library/react', 'mocha', 'karma']),
  e2e: pick(['@playwright/test', 'playwright', 'cypress', 'puppeteer']),
  a11yTooling: pick(['@axe-core/playwright', 'axe-core', 'jest-axe', 'eslint-plugin-jsx-a11y', 'pa11y', '@axe-core/react']),
  perfTooling: pick(['@lhci/cli', 'lighthouse', 'web-vitals', '@next/bundle-analyzer', 'rollup-plugin-visualizer', 'size-limit', '@vercel/speed-insights']),
  analytics: pick(['@vercel/analytics', 'posthog-js', '@segment/analytics-next', 'react-ga4', '@next/third-parties', 'mixpanel-browser', '@amplitude/analytics-browser', 'plausible-tracker']),
  consent: pick(['@cookiehub/react', 'react-cookie-consent', 'vanilla-cookieconsent', '@osano/cookieconsent', 'klaro']),
  seo: pick(['next-seo', 'next-sitemap', '@astrojs/sitemap', '@nuxtjs/seo', 'react-helmet', 'react-helmet-async', 'schema-dts']),
  cspFiles: detectCSP(),
  browserslist: pkg.browserslist ?? (exists('.browserslistrc') ? read('.browserslistrc').trim() : null),
  ci: ['.github/workflows', '.gitlab-ci.yml', 'azure-pipelines.yml', 'bitbucket-pipelines.yml', '.circleci'].filter(exists),
  deploy: [['vercel.json', 'Vercel'], ['netlify.toml', 'Netlify'], ['Dockerfile', 'Docker'], ['firebase.json', 'Firebase'], ['wrangler.toml', 'Cloudflare'], ['amplify.yml', 'AWS Amplify'], ['staticwebapp.config.json', 'Azure SWA']].filter(([f]) => exists(f)).map(([, n]) => n),
};

const identity = {
  name: pkg.name ?? path.basename(root),
  description: pkg.description ?? null,
  readme: (() => {
    const r = ['README.md', 'readme.md', 'Readme.md'].map(read).find(Boolean);
    return r ? r.replace(/\r/g, '').split('\n').filter((l) => l.trim()).slice(0, 25).join('\n') : null;
  })(),
  scripts: pkg.scripts ?? {},
  monorepo: exists('pnpm-workspace.yaml') || exists('turbo.json') || exists('nx.json') || Array.isArray(pkg.workspaces) || !!pkg.workspaces?.packages,
};

// ---------- recommendations ----------
const risks = [];
const recs = [];
if (framework.id === 'next') recs.push('Load the 3D scene with next/dynamic({ ssr: false }) inside a "use client" boundary; keep hero text server-rendered for LCP/SEO.');
if (framework.id === 'astro') recs.push('Mount 3D as an island with client:visible (or client:idle for above-the-fold) so the rest of the page ships zero JS.');
if (framework.id === 'static') recs.push('Use a single ES-module entry with dynamic import("three") after first paint; no bundler required via import maps, but prefer Vite for tree-shaking.');
if (quality.cspFiles.length) risks.push(`CSP detected in ${quality.cspFiles.join(', ')}: Draco/Basis decoders need worker-src blob: and self-hosted decoder files; avoid unsafe-eval.`);
if (assets.models.some((m) => m.kb > 3000)) risks.push('Some 3D models exceed 3 MB — run the gltf-transform pipeline (meshopt + KTX2/WebP) before shipping.');
if (assets.environmentMaps.some((m) => m.kb > 2000)) risks.push('HDR environment maps > 2 MB — downscale to 1k and/or convert to prefiltered .env/.ktx2.');
if (assets.largeImages.length) risks.push(`${assets.largeImages.length} images > 500 KB — convert to AVIF/WebP with responsive sizes.`);
if (motion.animation.length > 2) risks.push(`Multiple animation libraries (${motion.animation.map((a) => a.name).join(', ')}) — consolidate to avoid duplicate runtime cost.`);
if (motion.scroll.some((s) => s.name === 'locomotive-scroll')) risks.push('locomotive-scroll found — consider migrating to Lenis (smaller, native-scroll based, better a11y).');
if (content.i18n.length || content.rtlHints) recs.push('Text in 3D/motion must come from i18n messages; mirror directional animations for RTL locales.');
if (!quality.e2e.length) recs.push('No E2E runner: add Playwright for visual regression (with reduced motion forced) and axe checks.');
if (!quality.perfTooling.some((p) => ['@lhci/cli', 'web-vitals', 'lighthouse'].includes(p.name))) recs.push('No perf budget tooling: add Lighthouse CI + web-vitals RUM reporting.');
if (quality.analytics.length && !quality.consent.length) risks.push('Analytics without a consent library detected — verify GDPR/DPDP consent gating before adding interaction tracking.');
if (identity.monorepo) recs.push('Monorepo detected — confirm which app/package is the website before editing.');

const profile = {
  generatedAt: new Date().toISOString(),
  root,
  identity,
  packageManager,
  framework,
  recommended3DBinding: bindingFor[framework.ui] ?? bindingFor.vanilla,
  styling,
  designTokens: tokens,
  fonts,
  existingMotion: motion,
  assets,
  routes,
  content,
  quality,
  risks,
  recommendations: recs,
  stats: { filesScanned: files.length, truncated: files.length >= MAX_FILES },
};

// ---------- output ----------
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'project-profile.json'), JSON.stringify(profile, null, 2));

const list = (arr) => (arr.length ? arr.map((x) => (typeof x === 'string' ? x : `${x.name ?? x.file}${x.version ? '@' + x.version : ''}${x.kb != null ? ` (${x.kb} KB)` : ''}`)).join(', ') : '—');
const md = `# Project profile — ${identity.name}

_Generated ${profile.generatedAt} by jarvis-immersive analyzer. Facts only; interpretation belongs in PROJECT_BRIEF.md._

| Area | Finding |
|---|---|
| Framework | ${framework.label}${framework.version ? ' ' + framework.version : ''}${framework.router ? ' — router: ' + framework.router : ''} |
| Package manager | ${packageManager}${identity.monorepo ? ' (monorepo)' : ''} |
| Recommended 3D binding | ${profile.recommended3DBinding} |
| TypeScript | ${quality.typescript ? 'yes' : 'no'} |
| Styling | ${[styling.tailwind && 'Tailwind ' + styling.tailwind, styling.cssModules && 'CSS Modules', ...styling.cssInJs.map((x) => x.name), ...styling.preprocessors.map((x) => x.name)].filter(Boolean).join(', ') || '—'} |
| Component libs | ${list(styling.componentLibs)}${styling.shadcn ? ' + shadcn/ui' : ''} |
| Existing 3D | ${list(motion.threeD)} |
| Existing animation | ${list(motion.animation)} |
| Smooth scroll | ${list(motion.scroll)} |
| Fonts | ${fonts.families.join(', ') || '—'} ${fonts.selfHostedFiles.length ? `(+${fonts.selfHostedFiles.length} self-hosted files)` : ''} |
| Top brand colors | ${tokens.topHexColors.join(' ') || '—'} |
| CSS variables found | ${Object.keys(tokens.cssVariables).length} |
| Routes/pages | ${routes.length} |
| CMS / content | ${list(content.cms)}; ${content.markdown} markdown files |
| i18n | ${list(content.i18n)}${content.rtlHints ? ' (RTL locale hints)' : ''} |
| Tests | unit: ${list(quality.unitTests)}; e2e: ${list(quality.e2e)}; a11y: ${list(quality.a11yTooling)} |
| Perf tooling | ${list(quality.perfTooling)} |
| Analytics / consent | ${list(quality.analytics)} / ${list(quality.consent)} |
| CSP | ${quality.cspFiles.join(', ') || 'none found'} |
| Deploy / CI | ${quality.deploy.join(', ') || '—'} / ${quality.ci.join(', ') || '—'} |
| 3D models | ${list(assets.models)} |
| HDR/EXR | ${list(assets.environmentMaps)} |
| Large images | ${assets.largeImages.length} |

## Routes
${routes.map((r) => `- ${r}`).join('\n') || '- (none detected)'}

## CSS variables (first 40)
${Object.entries(tokens.cssVariables).slice(0, 40).map(([k, v]) => `- \`${k}\`: \`${v}\``).join('\n') || '- (none)'}

## Risks
${risks.map((r) => `- ⚠️ ${r}`).join('\n') || '- none detected'}

## Recommendations
${recs.map((r) => `- ${r}`).join('\n') || '- none'}

## package.json scripts
${Object.entries(identity.scripts).map(([k, v]) => `- \`${k}\`: \`${v}\``).join('\n') || '- (none)'}
`;
fs.writeFileSync(path.join(outDir, 'project-profile.md'), md);

console.log(`✔ Profiled ${files.length} files → ${path.relative(process.cwd(), outDir) || outDir}`);
console.log(`  Framework: ${framework.label} | 3D binding: ${profile.recommended3DBinding}`);
console.log(`  Risks: ${risks.length} | Recommendations: ${recs.length}`);
