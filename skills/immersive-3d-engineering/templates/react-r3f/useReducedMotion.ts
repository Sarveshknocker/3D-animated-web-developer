'use client';
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
const STORAGE_KEY = 'motion-paused';

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  window.addEventListener('motion-preference', cb);
  return () => {
    mq.removeEventListener('change', cb);
    window.removeEventListener('motion-preference', cb);
  };
}

function getSnapshot() {
  let userPaused = false;
  try { userPaused = localStorage.getItem(STORAGE_KEY) === '1'; } catch {}
  return window.matchMedia(QUERY).matches || userPaused;
}

/** true when the OS asks for reduced motion OR the user pressed the site's pause-motion toggle. */
export function useReducedMotion(): boolean {
  // Server snapshot = true: render the calm version first, enhance after hydration.
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

/** Wire this to a visible <button aria-pressed> — WCAG 2.2.2 pause control. */
export function setMotionPaused(paused: boolean) {
  try { localStorage.setItem(STORAGE_KEY, paused ? '1' : '0'); } catch {}
  window.dispatchEvent(new Event('motion-preference'));
}
