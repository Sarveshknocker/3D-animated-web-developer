# Screenshot critique

Use after the inspector passes. You judge the screenshots in `.immersive/inspect/`, the way a jury judges a
site it has never seen: no access to the code, the spec or your intentions.

## How to look
Open the screenshots in this order and give each one a few seconds before reading details:
1. `desktop-fold.jpg` — the first impression. What is this, for whom, what can I do?
2. `mobile-fold.jpg` — the same three questions with a thumb.
3. `desktop-page.jpg`, `mobile-page.jpg` — the whole story. Does every section carry the idea, or does it
   stop after the hero?
4. `reduced-motion-fold.jpg`, `no-webgl-fold.jpg` — would these visitors feel short-changed?

## The twelve passes
Write one line per pass: what you see, and whether it holds.

1. **Five-second test.** From the desktop fold alone, can a stranger say what this is and what to do next?
2. **Idea.** Is the concept from EXPERIENCE_SPEC.md visible without explanation? Put the nearest competitor's
   name on the page in your head: if it still works, the idea is the category's, not this brand's.
3. **Hierarchy.** One dominant thing per screen; two or three type sizes doing the work; the action is the
   most obvious control.
4. **The 3D earns its place.** Does the scene show something true (product, material, data, place) or is it
   decoration? Is it sharp (no blur from low DPR, no aliasing staircases on the hero object, no banding)?
5. **Text over the stage.** Every word readable over the scene at every width; nothing important behind the
   canvas or a moving object.
6. **Colour.** The palette is the brand's, applied as fields, not sprinkled; the scene's lighting and tone
   mapping agree with the page colours (no grey-washed brand colour from a missing colour space).
7. **Composition across widths.** Mobile is its own composition, not the desktop squeezed; the canvas is
   cropped with intent; no orphan words in headings.
8. **Rhythm.** Neighbouring sections differ in composition; the gaps between sections are clearly larger than
   the gaps inside them; no stretch of empty screens.
9. **Craft details.** Alignment to one grid, consistent corner radii, image crops and treatments, focus
   styles visible and designed.
10. **Fallbacks.** The no-WebGL and reduced-motion screenshots look designed (poster, still frame), not broken.
11. **Clichés.** Anything from `immersive-creative-direction/references/cliche-blacklist.md`, including the
    generated-site tells, used as decoration rather than meaning?
12. **Would someone share it?** Name the exact moment a visitor would screen-record. If you cannot, the
    interaction is not strong enough yet.

## Score
Score each category 1–10, then combine with the weights award juries use (Awwwards: design 40%, usability
30%, creativity 20%, content 10%).

| Category | What it covers | Score |
|---|---|---|
| Design | passes 3, 4, 6, 7, 8, 9 | |
| Usability | passes 1, 5, 10 and the inspector results | |
| Creativity | passes 2, 11, 12 | |
| Content | real, complete, specific copy and media; nothing invented as proof | |
| **Weighted total** | 0.4 D + 0.3 U + 0.2 Cr + 0.1 Co | |

Caps (apply before weighting, and say which applied):
- Any inspector FAIL still open → Usability ≤ 5.
- No user verb with a visible consequence (the concept's interaction is missing or broken) → Creativity ≤ 5.
- The competitor test fails (pass 2) → Creativity ≤ 4.
- The first screen does not say what this is (pass 1) → Content ≤ 5.
- Text over the scene unreadable anywhere (pass 5) → Design ≤ 5.
- Fallback screenshots look broken (pass 10) → Usability ≤ 6.

Targets: weighted total ≥ 7.5 with no category under 7. Below that, the work is not finished.

## Write it down
Append to `.immersive/CRITIQUE.md`:

```
## Round N — <date>
Scores: Design x · Usability x · Creativity x · Content x → weighted x.x (caps: …)
Top three problems, most damaging first:
1. <what is visible in which screenshot> → <the fix>
2. …
3. …
```

Fix the three, re-run the inspector, look again. Stop after three rounds and report honestly what remains.
