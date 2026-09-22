'use client';
// Example scene: token-driven gradient backdrop + hero model, tier-aware, pointer-reactive.
// Default export so it can be lazy-loaded: dynamic(() => import('./Scene.example'), { ssr: false })
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Float, useGLTF } from '@react-three/drei';
import { MathUtils, type Group } from 'three';
import { createBrandGradientMaterial } from './BrandGradientMaterial';
import type { SceneProps } from './ImmersiveStage';

const MODEL_URL = '/models/hero.glb'; // produced by optimize-assets.mjs (meshopt)

function Backdrop({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useMemo(() => createBrandGradientMaterial(), []);
  const { viewport } = useThree();
  useFrame((state, delta) => {
    material.uniforms.uTime.value += delta;
    material.uniforms.uMotion.value = MathUtils.damp(material.uniforms.uMotion.value, reducedMotion ? 0 : 1, 4, delta);
    // Reuse the existing Vector2 — no allocation per frame.
    material.uniforms.uPointer.value.lerp(state.pointer, 0.05);
  });
  return (
    <mesh position={[0, 0, -2]} scale={[viewport.width * 1.5, viewport.height * 1.5, 1]} material={material}>
      <planeGeometry />
    </mesh>
  );
}

function HeroModel({ reducedMotion }: { reducedMotion: boolean }) {
  const { scene } = useGLTF(MODEL_URL, false, true); // meshopt decoder, no Draco worker needed
  const ref = useRef<Group>(null);
  useFrame((state, delta) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y = MathUtils.damp(ref.current.rotation.y, state.pointer.x * 0.4, 3, delta);
    ref.current.rotation.x = MathUtils.damp(ref.current.rotation.x, -state.pointer.y * 0.2, 3, delta);
  });
  return (
    <Float enabled={!reducedMotion} speed={1.2} rotationIntensity={0.2} floatIntensity={0.4}>
      <primitive ref={ref} object={scene} />
    </Float>
  );
}

export default function Scene({ tier, reducedMotion }: SceneProps) {
  return (
    <>
      <Backdrop reducedMotion={reducedMotion} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} />
      {tier !== 'low' && <Environment preset="studio" environmentIntensity={0.6} />}
      <HeroModel reducedMotion={reducedMotion} />
    </>
  );
}
