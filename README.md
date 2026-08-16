# Tank Arena

Isometric tank-versus-swarm concept built with three.js. One analog stick drives the
hull, a flamethrower fixed to the hull burns continuously, a trail of fire covers your
back, and the swarm never stops arriving.

Play it: <https://dx0x58.github.io/tank-game/>

## Running it

```bash
npm install
npm run dev      # http://localhost:5173, also served on the LAN for phone testing
npm run build    # typecheck + production bundle into dist/
npm run preview  # serve the production bundle
```

`npm run dev` binds to every interface, so open `http://<your-machine-ip>:5173` on a
phone that shares the network to test the touch controls.

## Controls

| Action | Touch | Desktop |
| --- | --- | --- |
| Drive | Drag anywhere on the left half of the screen | Arrows or WASD |
| Fire | Always on, no input | Always on, no input |
| Enemies on/off | ENEMIES button, top right | ENEMIES button, top right |
| Fire on/off | FIRE button, top right | FIRE button, top right |
| Steering scheme | STEER button, top right | STEER button, top right |
| Sprite look on/off | LOOK button, top right | LOOK button, top right |
| Speed | SPEED slider, top right | SPEED slider, top right |
| Restart | Redeploy button | Redeploy button |

Two switches turn the game back into a test drive. ENEMIES clears the arena and stops
spawning, freezing the difficulty ramp while it is off. FIRE shuts down both the jet and
the trail, along with the rumble they add to the camera, leaving a bare tank to drive.
Fire already on the ground burns out on its own rather than blinking away. Both switches
survive a restart, so a tuning session is not interrupted by dying.

The flamer burns constantly out of the hull's nose, so aiming means pointing the whole
tank. Its reach is short, which sets the shape of the game: you cannot outrange the
swarm, you have to drive into it and sweep, then pull out before too many bodies reach
the hull.

The stick widget in the bottom-left corner always mirrors the current deflection,
including when the input came from the keyboard.

## How the tank drives

The hull uses a differential-drive model rather than a speed-plus-turn-rate model.
The stick is mixed into two track targets:

```
left  = throttle + steer * turnAuthority
right = throttle - steer * turnAuthority
```

Each track then chases its target under an acceleration limit, and the hull's yaw
follows the difference between the two tracks. Three behaviours fall out of this
for free rather than being special-cased:

- pure lateral stick counter-rotates the tracks, so the tank pivots on the spot;
- pulling the stick back drives in reverse, capped at `reverseFactor` of forward speed;
- turning while moving requires slowing one track, and the acceleration limit is what
  makes that feel heavy.

## Two steering schemes

The STEER button switches between them. Whichever is selected only changes how the stick
becomes a throttle and a track difference; the drive model underneath is the same, so
the tank keeps its weight either way.

### SCREEN (default)

The stick names a direction **on screen**, and the tank works out how to get going that
way. Push up and the tank travels up the screen no matter which way its hull is pointing:
if the target is ahead it drives at it nose first, and if it is behind it backs up
towards it instead of grinding through a slow 180. Throttle eases off while the hull is
still swinging round, so a hard turn becomes a pivot rather than a wide arc.

This is the camera-relative scheme that fixed-camera games settled on. The stick vector
is projected onto the camera's ground-plane basis - screen-up is the camera's own forward
direction flattened, screen-right is that rotated a quarter turn - which is the change of
basis an isometric game needs so that pushing a diagonal means the diagonal you can see.
The forward-or-reverse choice is latched with hysteresis (`enterReverseAngle` /
`enterForwardAngle`) so it cannot chatter when the stick sits near a right angle to the
hull.

### TANK

The classic hull-relative scheme: forward on the stick drives the hull forward, lateral
pivots it. Authentic, and the reason tank controls exist at all, but from a fixed
isometric camera the hull's facing is the very thing that is hard to read, so a reverse
towards the top of the screen needs the stick held *down*. Kept for comparison.

In this mode steering still flips once the tank is genuinely rolling backwards, so the
stick at least follows the direction of travel. That flip keys off measured speed rather
than the stick, so braking from a forward run stays direct while the tank still moves
forward. `TANK.reverseThreshold` keeps it from flapping at a standstill and
`TANK.invertSteerInReverse` disables it.

### A quirk of the drive model

Slam from full forward to full reverse and the tank briefly ignores steering. Both tracks
are pinned at the same deceleration limit, so there is no difference between them to yaw
with. Ease off the throttle and steering returns. SCREEN mode rarely provokes it, since
it never commands full reverse against full forward motion.

### Speed slider

The SPEED slider scales top speed between 40% and 200%. Acceleration scales with it, so
a faster tank is genuinely quicker rather than mushy: time to reach top speed stays put,
and so does the sense of weight. The fire trail follows too - see below.

## Layout

```
src/
  config.ts              every tuning constant, in one table
  main.ts                entry point
  core/
    Game.ts              frame loop and system wiring
    IsometricCamera.ts   orthographic camera, fixed angle, lagging follow
    renderer.ts          WebGL renderer setup and pointer-type probe
  entities/
    Tank.ts              differential drive, hull model, lean
    EnemySwarm.ts        pooled chasers with seek-plus-separation steering
    Flamethrower.ts      the flame jet: instanced particles and its light
    FireTrail.ts         burning patches laid behind the hull
  input/
    InputManager.ts      touch stick, keyboard and mouse merged into one state
    InputState.ts        the shared control surface
  systems/
    Combat.ts            flame cone damage and enemy/hull collision resolution
    Steering.ts          stick to drive command, screen-relative or hull-relative
  fx/Effects.ts          pooled debris
  fx/bandedMaterial.ts   flat banded shading injected into MeshStandardMaterial
  fx/palette.ts          per-material colour ramps and the palette built from them
  fx/PixelPass.ts        low-res render target and palette snap
  ui/Hud.ts              HP, score, timer, stick widget, game over overlay
  world/
    Arena.ts             ground, grid, walls, decor
    Lighting.ts          hemisphere fill plus a key light that rides with the tank
```

Nothing allocates during a frame: flame particles, enemies and debris all come from
fixed pools built at startup.

## How the flamethrower works

The jet and the damage are two separate things that are tuned to agree with each other.

`Flamethrower` only draws: it emits particles from the nozzle into a narrow spread as
one `InstancedMesh` with additive blending, each particle growing, slowing under drag,
drifting upward and cooling from white through orange to ember black over its life.
Speed, drag and lifetime are picked so a particle dies out right at `FLAME.range` -
a particle covers `speed * (1 - e^(-drag * life)) / drag` metres, so the visible jet
ends where the damage does.

`Combat` does the hurting: every frame, each enemy inside a cone around the hull's
forward axis takes `damagePerSecond * falloff * dt`, with damage tapering towards the
tip. The cone is widened by the angle the target's own radius subtends, so a body
pressed against the nozzle still counts as hit even though a narrow cone barely covers
it at that distance. Bodies visibly shrivel as their health drains.

## The sprite look

The scene is shaded as flat 2D art rather than rendered in 3D and filtered afterwards.
LOOK: SPRITE adds the pixel grid on top; LOOK: SMOOTH shows the same art at full
resolution.

### Quantise the lighting, not the image

The first attempt at this posterised the finished picture: a smooth Lambert render, low
resolution, colours crushed per channel. It did not read as 2D, and the reason is
structural. Posterising an image puts the band boundaries at level sets of *screen
luminance*, so they sit in different places on identical objects and slide across a
surface as it moves. That is a rendered gradient with damage, not a drawn shape.

Quantising the lighting pins each boundary to the geometry instead. `bandedMaterial.ts`
injects into `MeshStandardMaterial` at `<lights_fragment_end>` and overwrites three.js's
accumulation with a three-step choice on `N·L`, plus a fourth colour for facets standing
in a cast shadow:

```glsl
vec3 banded = (ndl > uCut1) ? uLit : ((ndl > uCut0) ? uBase : uShadow);
banded = (shadow < 0.5 && ndl > uCut0) ? uCast : banded;
reflectedLight.directDiffuse = banded;
```

Everything else that produces a gradient had to go with it, or it reappears inside the
flat regions at lower contrast:

- **No hemisphere light.** Its irradiance is `mix(ground, sky, 0.5*dotNL + 0.5)` - a
  smooth normal-dependent ramp fed into indirect diffuse, which no banding touches. The
  shadow entry of each ramp is the ambient now.
- **No specular, no metalness.** A view-dependent lobe slides across curved surfaces and
  survives quantisation as crawling noise.
- **No tone mapping.** The ramps are authored colours, not HDR. A filmic curve would
  remap them before the palette could tell them apart.
- **`flatShading`, and hard shadows.** `BasicShadowMap` instead of PCF: a penumbra is a
  sub-pixel gradient that survives downsampling as a fuzzy grey fringe.

Colours are chosen, not multiplied. Each ramp rotates its shadow toward blue and violet
and its lit face toward yellow. Multiplying one colour by 0.4 keeps the hue and always
reads as a render turned down.

### Outlines

Flat regions with no value break between them merge, and the silhouette dissolves - so
banded shading without contours looks worse than what it replaced. Because the scene is
nothing but procedural primitives, the creases are known analytically: `EdgesGeometry`
finds them once per primitive and they draw as real GL lines. WebGL clamps line width to
one pixel, which is exactly right here - always one texel, never two, never flickering,
because it is geometry rather than a threshold on a continuous quantity. The surfaces
carry a `polygonOffset` so the lines win the depth test from any angle.

### An authored palette, not a lattice

Per-channel posterisation to N levels does not give N colours, it gives N³ on a regular
lattice that has nothing to do with the image. Red, green and blue cross their thresholds
at different moments, so hue drifts across a shaded surface - the same artefact class as
JPEG chroma damage, which is why it read as a damaged photograph.

The palette is built *from* the ramps (`palette.ts`), so the snap agrees with the shading
instead of fighting it: on a correctly shaded pixel it is a no-op, and it only cleans up
edge and blend colours. Dither is near zero, because flat regions are the goal and there
is almost no quantisation error left to scatter.

### Ground pattern

A plane has one normal, so lighting alone paints it a single flat colour across the whole
screen. Measured on the first banded build, one colour covered 84% of the frame. Two
frequencies of world-space hash noise break it into patches quantised to three ground
tones. World space rather than screen space, so the ground stays put as the camera moves.

### Pixel grid

The scene renders into a `WebGLRenderTarget` with `NearestFilter` both ways and is blown
up to the canvas at a **whole-number** scale - at a fractional ratio some source texels
land on four screen pixels and their neighbours on three, and no amount of shading work
hides that. The camera rounds its focus to whole texels along the two screen axes, which
is the fix for the pixel crawl that otherwise makes the scene shimmer as it moves.
Sliding along the view axis is left alone, since under an orthographic projection it
moves nothing on screen.

### Why rotation is not stepped

`SPRITE.facings` can snap bodies to a fixed set of angles, the way a pre-rendered sprite
set only existed at 8 or 16 directions. It is off by default, and that is deliberate.

Discretising rotation while position, camera, flame and everything else stay continuous
quantises exactly one channel, and it reads as the frame rate collapsing during turns
rather than as a style. Sprite games got away with it because their entire presentation
ran at one low cadence, so nothing looked out of step with anything else. Matching that
here would mean driving the whole render at, say, 20 Hz, which would put visible latency
on steering the player is doing by hand. Between one coherent look and the other, smooth
rotation is the one that costs nothing. Set `facings` to 8 or 16 to see the alternative.

## The fire trail

The flamer only covers the front, so the tank also lays burning patches behind itself,
reaching back ten hull lengths. Anything chasing you has to cross them.

Patches are laid by distance travelled rather than by time, so their density does not
depend on speed. Their lifetime is derived, not tuned: at top speed the oldest patch
burns out exactly when the trail has reached `FIRE_TRAIL.lengthInHulls` hull lengths,
which keeps the requested length true without a second constant to maintain. Slower
driving simply leaves a shorter trail, because fire burns out.

That lifetime is computed per patch, at the moment it is laid, because the speed slider
moves top speed underneath the trail. Without that the trail would stretch to twice its
length at 200% and shrink to a stub at 40%.

Each patch carries a single `radius` that shrinks as it cools, and both the drawn blob
and the damage test read that same value, so what you see burning is exactly what
burns. Overlapping patches never stack: an enemy takes trail damage at most once per
frame.

## Tuning

`src/config.ts` holds everything that shapes game feel. The knobs worth reaching for
first:

- `TANK.trackAccel` / `TANK.trackDecel` - how much mass the hull seems to have.
- `TANK.yawSeparation` - larger values make turning more sluggish.
- `TANK.turnAuthority` - how much of the stick's lateral axis reaches the tracks.
- `src/fx/palette.ts` - every colour in the game. Ramps here are the art direction; the
  post-pass palette is derived from them, so editing a ramp is enough.
- `SPRITE.renderHeight` - pixel size of the sprite look; lower is chunkier.
- `SPRITE.ditherStrength` - keep near zero unless you want visible crosshatch.
- `SPRITE.facings` - distinct angles bodies may be drawn at, 0 for smooth. 8 is the
  Diablo II monster count, 16 what its player characters used. See above for why it
  ships off.
- `STEERING.fullSteerAngle` - how sharply SCREEN mode corrects a heading error.
- `STEERING.enterReverseAngle` - how far behind a target must be before backing up.
- `ENEMY.spawnIntervalStart` / `spawnIntervalEnd` / `rampDuration` - pressure curve.
- `FLAME.range` / `halfAngle` / `damagePerSecond` - reach, width and bite of the jet.
  If you change `range`, re-derive `particleSpeed` from the formula above so the visible
  flame still ends where the damage does.
- `FIRE_TRAIL.lengthInHulls` / `spacing` / `damagePerSecond` - how far the trail reaches,
  how dense it is, and how hard it bites. Raising `lengthInHulls` may need a larger
  `poolSize`: the trail needs about `lengthInHulls * TANK.hullLength / spacing` patches.

## Deployment

Pushing to `main` builds the site and publishes it to GitHub Pages via
`.github/workflows/deploy.yml`. Pages serves from a subpath, so the workflow sets
`VITE_BASE=/tank-game/`; local dev and preview stay at the root.
- `TANK.damageGrace` - caps incoming damage regardless of how many bodies touch the hull.
