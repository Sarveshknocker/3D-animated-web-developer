#!/usr/bin/env node
// Seeded divergent concept generator.
// Usage: node concept-dice.mjs "<project name or seed>" [count=5]
// Same seed → same rolls, so a team can discuss the same provocations.

const METAPHOR = [
  'the product as a living organism', 'the company as a city', 'data as weather', 'the user journey as a river',
  'features as instruments in an orchestra', 'the product as a miniature world', 'trust as architecture',
  'speed as light', 'the brand name taken literally', 'the manufacturing process', 'the product seen at microscopic scale',
  'the product seen at planetary scale', 'a museum of the problem being solved', 'a workshop / lab bench',
  'a garden that grows with usage', 'a machine with visible internals', 'a map of the customer’s world', 'time-lapse of a day in the user’s life',
];
const MECHANIC = [
  'drag to deform', 'throw & collide', 'pour / fill', 'stack & build', 'paint with the brand', 'grow', 'make-your-own artifact',
  'x-ray lens', 'scroll as time', 'zoom from macro to micro', 'portal navigation', 'live data pulse', 'before/after scrub',
  'mini-game as demo', 'tear / peel reveal', 'sculpt / carve', 'remix the logo', 'collective canvas', 'magnetic field', 'text that listens',
];
const WORLD = [
  'tactile clay / soft-body materials', 'precise engineering blueprint', 'paper craft & folds', 'liquid glass & refraction',
  'tilt-shift diorama', 'risograph / print textures', 'monochrome with one brand accent', 'natural light & real shadows',
  'data-ink minimalism', 'toy-like playful plastic', 'brutalist type-driven', 'cinematic film grade',
];
const CAMERA = [
  'single locked camera, world moves', 'orbit with limits', 'scroll-driven dolly along a spline', 'top-down map',
  'first-person walk', 'macro lens with shallow depth of field', 'split-screen dual views', 'isometric',
];
const TWIST = [
  'the visitor leaves something behind for the next visitor', 'it changes with the visitor’s local time of day',
  'there is a hidden mode unlocked by a secret', 'the scene is built from the company’s real data',
  'the ending is a shareable personalised artifact', 'failure is fun — breaking it is part of the story',
  'sound design (opt-in) makes it feel physical', 'the site remembers you on the second visit',
  'the fallback is an illustrated hand-made version', 'the CTA is the final piece of the puzzle',
];

// Mulberry32 PRNG seeded by string hash
function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedText = process.argv[2] ?? 'untitled';
const count = Math.max(1, Math.min(20, Number(process.argv[3] ?? 5)));
const rand = rng(hash(seedText));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

console.log(`Concept dice for "${seedText}" — treat as provocations, not answers.\n`);
for (let i = 1; i <= count; i++) {
  console.log(`#${i}`);
  console.log(`  Metaphor : ${pick(METAPHOR)}`);
  console.log(`  Mechanic : ${pick(MECHANIC)}`);
  console.log(`  World    : ${pick(WORLD)}`);
  console.log(`  Camera   : ${pick(CAMERA)}`);
  console.log(`  Twist    : ${pick(TWIST)}`);
  console.log(`  Pitch    : "You ___ the ___ and it ___" — fill this in from brand DNA.\n`);
}
