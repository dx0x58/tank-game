# Implementation update - Tank Arena concept (2026-08-16)

## Status

All requirements from `2026-08-16_desired_app_functionality.md` are implemented and
verified in a real browser. Typecheck and production build are clean.

## Files created

| File | Purpose |
| --- | --- |
| `package.json`, `tsconfig.json`, `vite.config.ts` | Scaffold. Strict TypeScript, ES2022 target, dev server bound to the LAN |
| `index.html`, `src/styles.css` | DOM overlay: HUD, stick widget, damage vignette, game over card. Mobile viewport meta, `touch-action: none`, safe-area padding |
| `src/config.ts` | Single tuning table for camera, tank, weapon, enemy and effect constants |
| `src/main.ts` | Entry point |
| `src/core/renderer.ts` | WebGL renderer setup, ACES tone mapping, soft shadows, coarse-pointer probe used for pixel-ratio and shadow-map sizing |
| `src/core/IsometricCamera.ts` | Orthographic camera at a fixed angle with lagging follow and decaying shake |
| `src/core/Game.ts` | Frame loop, system wiring, weapon cooldown, damage grace, run lifecycle |
| `src/entities/Tank.ts` | Differential-drive physics, hull model, recoil, cosmetic lean |
| `src/entities/EnemySwarm.ts` | Pooled chasers, seek-plus-separation steering, ramped spawning |
| `src/entities/Projectiles.ts` | Pooled shells |
| `src/systems/Combat.ts` | Shell/enemy hits, enemy/hull contact damage and overlap separation |
| `src/fx/Effects.ts` | Muzzle flash with a point light, pooled debris cubes |
| `src/input/InputState.ts`, `src/input/InputManager.ts` | Touch stick, keyboard and mouse merged into one control surface |
| `src/ui/Hud.ts` | HP bar, score, timer, stick widget, damage flash, game over overlay |
| `src/world/Arena.ts`, `src/world/Lighting.ts` | Ground, grid, walls, deterministic decor; hemisphere fill plus a key light that rides with the tank |

## Technical notes

**Driving model.** The stick is mixed into per-track speed targets
(`left = throttle + steer * turnAuthority`, `right = throttle - steer * turnAuthority`),
each track chases its target under an acceleration limit, and yaw follows the track
difference divided by `yawSeparation`. Forward, reverse and pivot-on-the-spot all emerge
from this one model instead of being separate code paths, and the acceleration limit is
what produces the sense of mass. Heading convention: hull forward is local +Z, so world
forward is `(sin(heading), 0, cos(heading))` and a growing heading turns left.

**Camera.** The orthographic frustum is driven from the *shorter* screen axis
(`CAMERA.minSpan`), so a phone held upright shows a sensible amount of world instead of
zooming hard into the tank.

**Allocation.** Shells, enemies and debris come from fixed pools built at startup;
steering uses module-level scratch vectors. Nothing allocates inside the frame loop.

**Damage grace.** Contact damage is per-enemy, but a shared `TANK.damageGrace` window
caps the rate. Without it, damage scaled with how many bodies happened to touch the hull
at once and a dense swarm killed the tank in seconds.

## Verification

Typecheck (`tsc --noEmit`) and `vite build` are clean. A Playwright smoke test drove the
production bundle in Chromium in two contexts:

- **Desktop 1280x800:** keyboard driving, mouse firing, pivoting under fire. Result:
  score 20, hull 72% after the combat phase; standing still afterwards ended the run;
  the game over card showed the final score; Redeploy restored hull to 100%, reset the
  score and hid the overlay.
- **Mobile 390x844 with touch:** a touch drag on the left half moved the stick knob by
  the expected offset and drove the tank; the knob returned to centre on release.

No console errors or page errors in either context. Screenshots were reviewed and drove
four fixes: the scene was too dark (light intensities and ground colour raised), the
portrait camera was over-zoomed (frustum now driven from the short axis), the hull's
front plate rendered detached (replaced with a flush deck), and the swarm was slower
than the tank so it could never engage (enemy speed raised, spawn distance widened).

## Known gaps

- No audio.
- The destroyed tank stays on screen rather than becoming a wreck.
- Decor plates are visual only; there are no obstacles with collision, which was an
  explicit scope decision.
- Bundle is a single 550 kB chunk (three.js itself); code splitting buys nothing here.
