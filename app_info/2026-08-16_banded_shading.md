# Implementation update - banded shading (2026-08-16)

Seventh pass. Report: the sprite look "feels like just 3D with a bad picture". Research
was requested and run as a seven-agent sweep across shading, outlines, palette,
practitioner technique, and shadow/composition, followed by a critique pass and a
synthesis pass.

## The diagnosis

All five research angles converged independently: **the quantisation was being applied
to the image instead of to the lighting.**

Posterising a finished render puts the band boundaries at level sets of screen luminance.
Those boundaries land in different places on identical objects and slide across a surface
as it moves, because they track the render rather than the geometry. Low resolution and a
short palette on top of that produce a damaged photograph, not drawn art. No amount of
palette work fixes it, because the thing being quantised is wrong.

## What changed

**`src/fx/bandedMaterial.ts` (new).** Injects into `MeshStandardMaterial` via
`onBeforeCompile` at `<lights_fragment_end>` and overwrites three.js's light accumulation
with a three-step select on `N·L`, plus a fourth colour for facets in a cast shadow.
Keeping `MeshStandardMaterial` rather than switching to `MeshToonMaterial` retains
`flatShading`, shadow receiving and all the uniform plumbing.

Everything else producing a gradient went with it, since each one reappears inside the
flat regions otherwise: the `HemisphereLight` (its irradiance is a smooth
normal-dependent ramp into indirect diffuse), specular and metalness, ACES tone mapping,
and `PCFSoftShadowMap` in favour of `BasicShadowMap`.

**`src/fx/palette.ts` (new).** Per-material ramps where shadows rotate toward blue and
violet and lit faces toward yellow, rather than one colour multiplied down. The post-pass
palette is built *from* these ramps, so the snap agrees with the shading rather than
fighting it.

**Outlines.** `EdgesGeometry` + `LineSegments` on the tank and enemies. Every practitioner
source says flat shading without contours looks worse than what it replaces. Since the
scene is entirely procedural primitives the creases are known analytically, so this needs
no depth buffer, no normal buffer and no thresholds - and WebGL's one-pixel line clamp is
exactly the requirement. Surfaces carry a `polygonOffset` so lines win the depth test from
any angle; an earlier attempt nudged the lines in local space, which would have rotated
with the hull.

**Palette snap replaces per-channel posterise.** 12 levels per channel is not a palette,
it is a 1728-colour lattice, and the channels cross their thresholds independently so hue
drifts across every shaded surface. Dither dropped to near zero.

**Ground pattern.** Two frequencies of world-space hash noise, quantised to three ground
tones.

**Integer upscale factor.** The render target height is now derived from the canvas by a
whole-number scale. At a fractional ratio some source texels cover four screen pixels and
their neighbours three, which is visible as an uneven pixel grid.

## Corrections carried in from the research

Three widely repeated recommendations are wrong on current three.js, verified against our
installed r185 rather than taken on trust:

- `gradientMap` cannot carry colour - `gradientmap_pars_fragment` returns
  `vec3(texture2D(gradientMap, coord).r)`, red channel broadcast. Coloured toon ramps via
  `gradientMap` do not exist.
- `MeshToonMaterial` has no `flatShading` property; setting it is a silent no-op.
- Patching `shadowmask_pars_fragment` to binarise shadows does nothing for
  `MeshStandardMaterial`; the shadow term is applied inside `<lights_fragment_begin>`.

Verified locally before writing any shader code: `lights_fragment_end` exists, the
variable is `geometryNormal` (renamed around r155), and `getShadow()` takes six arguments
including `shadowIntensity`.

## Verification

A measurement harness was built first, because the previous pass had left a broken one:
reading the canvas back returns a blank buffer without `preserveDrawingBuffer`. Screenshots
are decoded inside the page instead, which gives real pixel values.

That harness settled two questions that eyeballing got wrong:

- The pipeline is colour-exact. The ground samples as `#5e7186`, which is precisely
  `RAMPS.ground.lit` - so the render is neither double-encoded nor brightened, and an
  earlier suspicion that it was came only from misjudging a large flat area by eye.
- The real defect was distribution: on the first banded build **one colour covered 83.6%
  of the frame**, because a plane has a single normal and therefore a single band. That
  is what motivated the ground pattern, after which the ground splits 38 / 23 / 22 across
  three tones.

Cast shadows confirmed present, covering 7.5% of a clean frame in the ground's cast
colour. All fourteen gameplay assertions and all HUD checks still pass, with no console or
page errors.

## Not done, and why

The synthesis ranked a depth+normal edge pass, contact-shadow decals, surface-ID buffers,
analytic AO, SSAO, rim lighting and sprite-sheet baking below the changes above. The
sprite-sheet idea in particular rests on a false premise: Diablo II was a fully 2D engine,
and under a fixed non-rotating orthographic camera a build-time bake produces the
identical image to rendering live, while losing cast shadows, pitch and roll, and
lighting changes. It buys only a point where a human could hand-fix pixels.

The synthesis also made a point worth keeping: a tank assembled from `BoxGeometry` and
`CylinderGeometry` is programmer art, and shading programmer art harder yields
well-shaded programmer art. If the look still falls short, the remaining gap is silhouette
design, not shaders.
