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

Reverse is deliberately authentic: with the stick back, steering input moves the
hull's nose the opposite way, exactly as tracked vehicles behave.

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
  fx/Effects.ts          muzzle flash and pooled debris
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

## The fire trail

The flamer only covers the front, so the tank also lays burning patches behind itself,
reaching back ten hull lengths. Anything chasing you has to cross them.

Patches are laid by distance travelled rather than by time, so their density does not
depend on speed. Their lifetime is derived, not tuned: at top speed the oldest patch
burns out exactly when the trail has reached `FIRE_TRAIL.lengthInHulls` hull lengths,
which keeps the requested length true without a second constant to maintain. Slower
driving simply leaves a shorter trail, because fire burns out.

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
