'use client';
import { useEffect, useState } from 'react';
import { hasWebGL2 } from './webgl';

export type Tier = 'high' | 'mid' | 'low' | 'static';

export interface TierConfig {
  dpr: [number, number];
  particles: number;
  postprocessing: boolean;
  shadows: boolean;
}

// Single source of truth for tier budgets — tune per project.
export const TIERS: Record<Exclude<Tier, 'static'>, TierConfig> = {
  high: { dpr: [1, 2], particles: 60_000, postprocessing: true, shadows: true },
  mid: { dpr: [1, 1.5], particles: 20_000, postprocessing: false, shadows: false },
  low: { dpr: [1, 1], particles: 6_000, postprocessing: false, shadows: false },
};

type NavigatorExt = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
  getBattery?: () => Promise<{ level: number; charging: boolean }>;
};

async function detect(): Promise<Tier> {
  if (!hasWebGL2()) return 'static';
  const nav = navigator as NavigatorExt;
  if (nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType ?? '')) return 'static';

  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  try {
    const battery = await nav.getBattery?.();
    if (battery && !battery.charging && battery.level < 0.2) return 'low';
  } catch {}

  if (cores <= 4 || memory <= 2) return 'low';
  if (coarse || cores < 8 || memory < 8) return 'mid';
  return 'high';
}

/** Returns null until detected (render the poster meanwhile). Runtime downgrades come from PerformanceMonitor. */
export function useDeviceTier(): Tier | null {
  const [tier, setTier] = useState<Tier | null>(null);
  useEffect(() => {
    let alive = true;
    detect().then((t) => alive && setTier(t));
    return () => { alive = false; };
  }, []);
  return tier;
}
