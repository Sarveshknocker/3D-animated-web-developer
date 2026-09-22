# Interaction mechanics library

Mechanics are *verbs with consequences*. Each entry: what the user does → what happens → implementation hint → accessible equivalent. Combine one mechanic with the brand metaphor to get a concept.

## Physical & tactile
| Mechanic | Consequence | Implementation | Accessible equivalent |
|---|---|---|---|
| **Drag to deform** | Pull a soft body (logo, product, fabric) that springs back | Vertex shader displacement driven by pointer + spring (maath `damp`) | Buttons that trigger preset deformations |
| **Throw & collide** | Fling objects that bounce off DOM section edges | Rapier (`@react-three/rapier`) or lightweight verlet; DOM rects as colliders | Keyboard "shake" button |
| **Pour / fill** | Fill a vessel with liquid/particles that represent a metric | GPU particles + SDF container; fill level = data | Text value + static filled image |
| **Stack & build** | Assemble a product from parts that snap together | Snap targets with tolerance; parts are GLB nodes | "Assemble" button runs the animation |
| **Stretch / elastic UI** | Headlines/cards stretch with scroll velocity | Scroll velocity → skew/scale uniform, clamped | Disabled under reduced motion |
| **Magnetic field** | Elements orbit/align to the cursor like iron filings | Instanced arrows oriented toward pointer | Static aligned field image |
| **Tear / peel** | Peel the page corner to reveal a hidden layer | Curl-deform shader on a plane | "Reveal" button |
| **Sculpt / carve** | Erase a surface to reveal the product beneath | Render-target mask painted by pointer | Toggle to show full reveal |

## Generative & creative
| Mechanic | Consequence | Implementation | Accessible equivalent |
|---|---|---|---|
| **Make your own** | Visitor generates a unique artwork/poster from inputs (name, choice) | Seeded noise/shader; export PNG via `canvas.toBlob` | Form inputs with preview image + alt text |
| **Grow** | A plant/city/network grows from user actions or live data | L-systems / space colonisation, instanced | Timelapse image sequence |
| **Paint with the brand** | Cursor paints with brand colors in a fluid sim | GPU stable-fluids (ping-pong FBOs), capped resolution | Static poster |
| **Remix the logo** | Parameter sliders reshape the brand mark | SDF/shader-based logo with uniforms | Sliders are native `<input type=range>` |
| **Sound sculpture (opt-in)** | Interactions make musical tones in the brand key | Web Audio API, off by default, visible toggle | Captions/visual only by default |
| **Seeded identity** | Each visitor gets a unique variant (color, shape) saved for return visits | Seed in localStorage | Same content, just a cosmetic variant |

## Spatial & navigational
| Mechanic | Consequence | Implementation | Accessible equivalent |
|---|---|---|---|
| **Portal navigation** | Sections are rooms entered through portals | drei `MeshPortalMaterial` + View Transitions for DOM | Normal nav links (the real mechanism) |
| **Zoom into detail** | Infinite zoom from macro to micro (planet → city → product → chip) | Scale-space camera + LOD swaps | Chaptered static images |
| **Miniature world** | Tilt-shift diorama the user orbits | OrbitControls with limits, depth-of-field on high tier | Annotated illustration |
| **X-ray / lens** | Cursor becomes a lens showing internals/data layer | Second render target composited in a circle mask | Toggle "show internals" |
| **Scroll as time** | Scrolling moves through time (history, product lifecycle, day→night) | Single progress uniform drives lighting, env, models | Timeline list with dates |
| **Map of meaning** | Content laid out on a pannable 2.5D canvas | Pan/zoom with inertia; DOM nodes positioned in 3D (CSS3D / drei Html) | Plain list view toggle |

## Data-driven & live
| Mechanic | Consequence | Implementation | Accessible equivalent |
|---|---|---|---|
| **Live pulse** | Real company data (orders, commits, users) animates the scene | Poll/SSE → instanced updates; cache & fake-smooth | Text stats with timestamp |
| **Context-aware** | Scene reacts to visitor's local time / season / weather (no permission prompt) | `Intl` time zone + time of day lighting | Same content, different mood |
| **Collective canvas** | Visitors' interactions accumulate into a shared artwork | Backend store + throttled writes | View-only gallery |
| **Personal dataset** | Visualise a user-entered value (commute, spend) against the product | Client-side only, no storage | Result sentence in text |

## Playful & game-like
| Mechanic | Consequence | Implementation | Accessible equivalent |
|---|---|---|---|
| **Easter egg hunt** | Hidden objects unlock a reward (discount, wallpaper) | State machine + subtle cues | List of "secrets" in footer |
| **Mini-game as demo** | A 20-second game *is* the product explanation (e.g. route packets, sort items) | Simple state + physics; skippable | "Skip — show me how it works" |
| **Konami / keyboard secrets** | Keyboard combos toggle alternate modes | keydown sequence | Mode toggle in settings |
| **Progression** | Scrolling "levels up" a character/product with visible stats | Progress → stage mapping | Stage list |
| **Before/after scrub** | Drag a divider comparing old vs new world | Two render targets + mask; or two images | Native range input |

## Cursor & micro
| Mechanic | Consequence | Implementation | Accessible equivalent |
|---|---|---|---|
| **Cursor as character** | Cursor is a small creature/object with personality that reacts to UI | quickTo follower + state machine; pointer: fine only | Native cursor always visible |
| **Hover reveals truth** | Hovering words shows the product doing that thing | Per-word media preview | Same media inline on touch/focus |
| **Text that listens** | Headline letters react to pointer proximity (weight axis, spacing) | Variable font axes via CSS vars | Static weight |
| **Buttons with mass** | CTAs have inertia/magnetism and a satisfying press | Springs; `:active` scale | Standard button |

## Transitions
| Mechanic | Consequence | Implementation |
|---|---|---|
| **Shared-element morph** | Clicked card becomes the next page's hero | View Transitions API with `view-transition-name` |
| **Scene continuity** | Persistent canvas across routes; the 3D object travels to its new role | Canvas in root layout, route → scene state |
| **Liquid wipe** | Brand-colored shader wipe between pages | Fullscreen plane shader, 600–900 ms |
