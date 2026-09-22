'use client';
/**
 * ImmersiveStage — the production wrapper every 3D scene mounts inside.
 * Guarantees: poster-first (LCP-safe), lazy 3D runtime, device tiers, reduced motion,
 * offscreen/tab-hidden pause, WebGL context-loss fallback, error boundary.
 *
 * Next.js app router usage:
 *   const Scene = dynamic(() => import('./Scene'), { ssr: false });
 *   <ImmersiveStage poster={{ src: '/hero-poster.avif', alt: '' }} label="…">
 *     {(p) => <Scene {...p} />}
 *   </ImmersiveStage>
 * Other React setups: use React.lazy for Scene; the stage already wraps children in <Suspense>.
 */
import { Component, type ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { TIERS, type Tier, useDeviceTier } from './useDeviceTier';
import { useReducedMotion } from './useReducedMotion';

export interface SceneProps {
  tier: Exclude<Tier, 'static'>;
  reducedMotion: boolean;
}

interface Props {
  poster: { src: string; alt: string };
  /** Accessible description when the scene conveys meaning; omit for decorative scenes. */
  label?: string;
  className?: string;
  /** Render the scene in reduced-motion mode instead of the poster (only for scenes with a calm static state). */
  keepSceneWhenReduced?: boolean;
  children: (props: SceneProps) => ReactNode;
}

class SceneErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    // Hook into the project's existing error tracker here (Sentry, Datadog, …).
    console.error('[ImmersiveStage] scene failed, showing poster', error);
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const ORDER: SceneProps['tier'][] = ['high', 'mid', 'low'];

export function ImmersiveStage({ poster, label, className, keepSceneWhenReduced = false, children }: Props) {
  const detected = useDeviceTier();
  const reducedMotion = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [ready, setReady] = useState(false);
  const [tier, setTier] = useState<SceneProps['tier'] | null>(null);

  useEffect(() => {
    if (detected && detected !== 'static') setTier(detected);
  }, [detected]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px' });
    io.observe(el);
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const posterEl = (
    // Poster is the LCP candidate: same box as the canvas, eager + high priority.
    <img src={poster.src} alt={poster.alt} fetchPriority="high" decoding="async"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
  );

  const showScene = tier && !contextLost && (!reducedMotion || keepSceneWhenReduced) && detected !== 'static';
  const cfg = tier ? TIERS[tier] : null;

  return (
    <div ref={hostRef} className={className} style={{ position: 'relative' }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      {(!showScene || !ready) && posterEl}
      {showScene && cfg && (
        <SceneErrorBoundary fallback={posterEl}>
          <Canvas
            dpr={cfg.dpr}
            shadows={cfg.shadows}
            frameloop={visible && pageVisible && !reducedMotion ? 'always' : 'demand'}
            gl={{ antialias: tier !== 'low', powerPreference: 'high-performance', alpha: true }}
            style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity 600ms ease' }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setContextLost(true); });
              requestAnimationFrame(() => setReady(true));
            }}
          >
            {/* Step down one tier when FPS drops; never step back up (prevents oscillation). */}
            <PerformanceMonitor onDecline={() => setTier((t) => (t ? ORDER[Math.min(ORDER.indexOf(t) + 1, 2)] : t))} flipflops={1}>
              <Suspense fallback={null}>{children({ tier: tier!, reducedMotion })}</Suspense>
            </PerformanceMonitor>
          </Canvas>
        </SceneErrorBoundary>
      )}
    </div>
  );
}
