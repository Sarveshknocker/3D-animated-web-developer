// JS mirror of motion-tokens.css + shared GSAP setup.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;
export function setupGsap() {
  if (registered || typeof window === 'undefined') return gsap;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'expo.out', duration: 0.8 });
  registered = true;
  return gsap;
}

export const dur = { xs: 0.12, sm: 0.24, md: 0.48, lg: 0.8, xl: 1.2 } as const;
export const ease = {
  outExpo: 'expo.out',
  outQuart: 'quart.out',
  inOut: 'power3.inOut',
  emphasized: 'cubic-bezier(0.2,0,0,1)', // needs CustomEase if used literally; expo.out is a close match
} as const;

/** Use with gsap.matchMedia(): every animation lives under `motion`, final states under `reduce`. */
export const mq = {
  motion: '(prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
  desktop: '(min-width: 1024px)',
  finePointer: '(hover: hover) and (pointer: fine)',
} as const;
