'use client';
// Lenis smooth scroll synced with GSAP ScrollTrigger. Mount once in the root layout.
// Disabled for reduced motion or when the user paused motion; native scroll is used instead.
import { type ReactNode, useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setupGsap } from './motion';
import { useReducedMotion } from '../3d/useReducedMotion'; // adjust path to where you placed the hook

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    setupGsap();
    if (reduced) return;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // Refresh once fonts are ready so pinned sections measure correctly.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [reduced]);

  return <>{children}</>;
}
