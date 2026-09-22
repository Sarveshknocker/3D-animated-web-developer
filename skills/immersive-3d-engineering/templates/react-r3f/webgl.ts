// Capability detection helpers. Safe to import on the server (guards on window).

let cachedWebGL2: boolean | null = null;

export function hasWebGL2(): boolean {
  if (typeof window === 'undefined') return false;
  if (cachedWebGL2 !== null) return cachedWebGL2;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    cachedWebGL2 = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedWebGL2 = false;
  }
  return cachedWebGL2;
}

/** Read a CSS custom property (design token) from :root, e.g. readToken('--brand-500'). */
export function readToken(name: string, fallback = '#ffffff'): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
