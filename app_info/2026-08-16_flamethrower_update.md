# Implementation update - flamethrower and speed pass (2026-08-16)

Follow-up to `2026-08-16_implementation_update.md`. Two requests, in order: make the
gun fire automatically and raise speed by 20%, then replace single projectiles with an
always-on flamethrower.

## Changes

**Tank speed.** `TANK.maxTrackSpeed` 8.5 to 10.2 (+20%). Acceleration limits were left
alone, so the hull now takes slightly longer to reach top speed - it reads as heavier,
not twitchier.

**Weapon replaced.** The projectile pool is gone. `src/entities/Projectiles.ts` was
deleted and `src/entities/Flamethrower.ts` took its place.

- *Visuals.* One `InstancedMesh` of low-poly blobs with additive blending. Particles
  leave the nozzle into a narrow spread, grow, slow under drag, drift upward and cool
  from white through orange to ember black. A flickering `PointLight` sits at the
  nozzle.
- *Damage.* `Combat.resolveCombat` now takes `dt` and applies
  `damagePerSecond * falloff * dt` to every enemy inside a cone around the hull's
  forward axis, tapering to `falloffAtRange` at the tip. The cone is widened by the
  angle the target's radius subtends so point-blank bodies count as hit.
- *Agreement between the two.* `particleSpeed`, `drag` and `particleLife` are chosen so
  a particle covers exactly `FLAME.range`: `speed * (1 - e^(-drag * life)) / drag`. The
  first tuning pass got this wrong - the jet died out at about 6 metres while the cone
  reached 11 - and it was visible in a screenshot.

**Knock-on changes.**

- `ENEMY.health` 1 to 3: burned down continuously rather than shot, roughly half a
  second per body.
- Enemies now shrivel as they burn (scale tracks health) instead of the old
  squash-on-hit reaction, which fired every frame under continuous damage.
- `Tank.applyRecoil` and `TANK.recoilImpulse` removed - a flamer has no recoil.
- `Effects.muzzleFlash` removed; the flame owns its own light.
- Tank model: the cannon barrel became a short projector with a flared nozzle, plus
  fuel drums on the rear deck so the silhouette reads as a flame tank.
- `TANK.radius` 2.5 to 2.8, reducing how far enemy bodies visually overlapped the hull.
- Fire input removed as dead code: `InputState.firing`, the mouse buttons, the fire keys
  and the right-half touch handler are gone. The left-half stick and the keyboard remain.
- HUD hint now reads "THE FLAMER IS ALWAYS ON" and is dismissed on a timer rather than
  on the first shot.
- The jet keeps burning out after the tank dies: `Flamethrower.update` runs outside the
  simulation gate with an `emitting` flag.

## Verification

Typecheck and build clean. Playwright, production bundle, Chromium, three contexts, no
console or page errors in any of them:

- **Desktop, driving and sweeping:** score 20, hull 23% after the combat phase, run
  ended, Redeploy reset hull to 100% and score to 0.
- **Spin in place** (added specifically to prove cone damage lands, since a bot that
  drives forward runs *away* from a swarm that chases it, and a forward-facing flamer
  then never touches anything): score climbed 0, 20, 50, 80, 90 over 25 seconds while
  hull drained 100% to 0%. Roughly three kills per five seconds with the cone sweeping
  a full circle.
- **Mobile 390x844 with touch:** stick knob tracks the drag and recentres on release.

Screenshots were reviewed: the jet is a proper cone with a white-hot core widening into
orange billows, and it ends at about twice the hull length, matching `FLAME.range`.

## Design note

Short range is now the defining constraint. The old cannon had effectively unlimited
reach, so facing roughly the right way was enough. The flamer reaches 11 metres against
a swarm that chases at 4.6-6.4 m/s while the tank does 10.2, which means you cannot
outrange the swarm - you have to drive into it, sweep, and pull out before too many
bodies reach the hull. That is a deliberate consequence, and it is why a bot that simply
drives forward scores badly.
