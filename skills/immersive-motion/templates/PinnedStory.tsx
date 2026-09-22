'use client';
// Pinned chapter scroller. Emits a 0..1 progress you can pass to a 3D scene (camera path, morph, explode).
// Reduced motion / mobile: no pin — chapters render as a normal vertical list; onProgress is not called.
import { type ReactNode, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { mq, setupGsap } from './motion';

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface Chapter { id: string; title: string; body: ReactNode }
interface Props {
  chapters: Chapter[];
  /** Called with 0..1 as the user scrolls through the section — keep it cheap (write to a ref/uniform, not React state). */
  onProgress?: (p: number) => void;
  stage?: ReactNode; // e.g. <ImmersiveStage …/>
}

export function PinnedStory({ chapters, onProgress, stage }: Props) {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    setupGsap();
    const mm = gsap.matchMedia();
    mm.add(`${mq.motion} and ${mq.desktop}`, () => {
      const items = gsap.utils.toArray<HTMLElement>('[data-chapter]');
      // Stack chapters in one grid cell only while pinned; mm.revert() restores the normal list.
      gsap.set(items, { gridArea: '1 / 1' });
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: `+=${chapters.length * 80}%`,
          pin: true,
          scrub: 0.8,
          onUpdate: (self) => onProgress?.(self.progress),
        },
      });
      items.forEach((el, i) => {
        if (i > 0) tl.from(el, { autoAlpha: 0, y: 24 }, i);
        if (i < items.length - 1) tl.to(el, { autoAlpha: 0, y: -24 }, i + 0.8);
      });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [chapters.length] });

  return (
    <section ref={root} className="pinned-story" style={{ position: 'relative', minHeight: '100svh', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', alignItems: 'center' }}>
      <div style={{ position: 'relative', height: '100svh' }}>{stage}</div>
      <ol style={{ display: 'grid', listStyle: 'none', margin: 0, padding: 0 }}>
        {chapters.map((c) => (
          // All chapters are real DOM, readable without JS.
          <li key={c.id} data-chapter>
            <h3>{c.title}</h3>
            <div>{c.body}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
