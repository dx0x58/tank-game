# Implementation update - sprite look (2026-08-16)

Sixth pass. Request: make the 3D models read as 2D sprites, Diablo II style, using
shaders, and look up how the effect is achieved.

## What the research said

The effect is a stack of four techniques, not one shader:

1. **Render small, upscale with nearest-neighbour.** This is the whole basis - three.js
   even ships a `RenderPixelatedPass` for it. Without it, "pixel art" filters only
   imitate pixels at full resolution.
2. **Quantise the palette, dither the result.** The standard formula is
   `floor(c * n + 0.5) / n`, with an ordered Bayer threshold map indexed by
   `mod(pixelPosition, n)` added first. Ordered dithering is what gives the era its
   characteristic crosshatch, and it is what pre-rendered sprite artists used to fake
   colours the palette did not contain.
3. **Fix the pixel crawl.** David Holland's write-up on 3D pixel art rendering flags the
   problem that only shows up in motion: at low resolution a moving camera makes the
   scene swim and shimmer, because every surface resamples slightly differently each
   frame. The fix is to snap the camera to a view-aligned, texel-sized grid.
4. **Limited facings.** Diablo II's models were baked to 8 directions for monsters and
   16 for player characters, which is why its units visibly click between angles.

## What was built

`src/fx/PixelPass.ts`. The scene renders into a `WebGLRenderTarget` of
`SPRITE.renderHeight` pixels, `NearestFilter` both ways, then a fullscreen quad blows it
up through a shader that tone maps, applies the transfer function, dithers and quantises.

The colour management deserves a note, because it is the part that went wrong first.
three.js skips tone mapping when rendering into a render target, so the pass has to do
it. The first version used the usual cheap ACES approximation, and the sprite mode came
out visibly brighter and flatter than the unfiltered render - caught by comparing
screenshots of the two modes. Replacing it with three's own curve, ACEScg matrices and
`exposure / 0.6` scaling made them match. Quantisation happens after the transfer
function, so the colour steps land where the eye sees them rather than in linear light.

`IsometricCamera.setTexelGrid` rounds the camera's focus to whole texels along the two
screen axes. Movement along the view axis is deliberately left unrounded, since an
orthographic projection does not move a single pixel when the camera slides along it.
The consequence is that the world scrolls in whole pixels, which is what sprite games did
anyway; the alternative from the article - snapping and then shifting the output back by
the sub-texel error - was not worth the extra pass here.

Bodies can snap to `SPRITE.facings` angles via `snapFacing`, applied to the tank's hull
and to the enemies' spin.

**Shipped at 16 facings, then turned off after review.** Snapping rotation while
position, camera, flame and debris all stayed continuous discretised exactly one channel,
and it read as the frame rate collapsing during turns rather than as a style. The
authentic version of this is a whole presentation running at one low cadence, which would
have put visible latency on hand-driven steering. Of the two coherent options, smooth
rotation is the one that costs nothing, so `facings` now defaults to 0 with the knob kept
and documented.

A `LOOK: SPRITE / SMOOTH` toggle switches all of it, including the facings and the camera
alignment, since they are part of the look rather than of the simulation.

## Verification

Twelve assertions against the real modules through the dev server, all passing. The new
one covers the camera alignment directly: over sixty tiny camera moves, the grid produces
**4** distinct on-screen positions against **60** ungridded - it steps rather than slides,
which is exactly the property that removes the shimmer.

That check failed on its first run, but the fault was in the measurement: it sampled
`camera.position.x`, which mixes in the slide along the view axis that is expected and
invisible under an orthographic projection. Projecting onto the two screen axes measures
the thing that matters.

An attempt to count distinct colours by reading the canvas back returned a single colour,
because the context is not created with `preserveDrawingBuffer`. That measurement was
abandoned rather than trusted; the palette reduction was judged from screenshots instead.

HUD checks still pass on the production bundle, and the LOOK toggle switches both ways
with no console or page errors.
