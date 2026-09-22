'use client';
// Accessible masked line/word reveal. Screen readers get the original string once.
import { useRef } from 'react';
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import { mq, setupGsap } from './motion';

gsap.registerPlugin(SplitText, useGSAP);

interface Props {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
  className?: string;
  by?: 'lines' | 'words' | 'chars';
}

export function RevealText({ text, as = 'h2', className, by = 'lines' }: Props) {
  // Narrowed to one intrinsic tag for typing only; the rendered tag is whatever `as` says.
  const Tag = as as 'div';
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    setupGsap();
    const el = ref.current!;
    const mm = gsap.matchMedia();
    mm.add(mq.motion, () => {
      const split = SplitText.create(el, { type: by, mask: by, aria: 'auto', autoSplit: true, onSplit: (self) =>
        gsap.from(self[by], {
          yPercent: 110,
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.06,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        }),
      });
      return () => split.revert();
    });
    return () => mm.revert();
  }, { scope: ref, dependencies: [text, by] });

  return <Tag ref={ref} className={className}>{text}</Tag>;
}
