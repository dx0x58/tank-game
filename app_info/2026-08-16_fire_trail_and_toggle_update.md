# Implementation update - fire trail, enemy toggle, deployment (2026-08-16)

Third pass. Two gameplay requests plus publication to GitHub Pages.

## Fire trail

The flamer covers only the front, which left the tank defenceless against whatever
chased it. The tank now lays burning patches behind the hull, reaching back ten hull
lengths, so pursuers have to cross fire.

`src/entities/FireTrail.ts` owns both the look and the state; `Combat` reads it for
damage.

- Patches are laid **by distance travelled** (`FIRE_TRAIL.spacing`), so density does not
  change with speed.
- Patch lifetime is **derived**, not tuned:
  `hullLength * lengthInHulls / maxTrackSpeed`. At top speed the oldest patch dies
  exactly as the trail reaches the requested length, so there is no second constant to
  keep in sync. Driving slower leaves a shorter trail, which is what fire does anyway.
- Storage is a ring buffer sized comfortably above the patch count needed at top speed.
- Each patch carries one `radius` that shrinks as it cools. The drawn blob and the
  damage test read the same value, so the visible fire is exactly the dangerous fire.
- Overlapping patches do not stack: an enemy takes trail damage at most once per frame.
  Flame cone and trail damage are summed once and applied in a single call.

Damage is 5/s against the jet's 10/s: this is area denial, not the main weapon.

## Toggles

Two HUD buttons sit under the score panel, top right. The HUD has
`pointer-events: none`, so they opt back in explicitly.

**ENEMIES** enables and disables the swarm so the driving model can be tried on its own.
`EnemySwarm.setEnabled` clears every active body and returns early from `update`, which
also freezes the difficulty ramp while off.

**FIRE** shuts down the jet and the trail together, along with the continuous camera
rumble they add. `Game` holds one `fireEnabled` flag that gates the `emitting` argument
of both fire systems and the `flameActive` field of the combat step, so nothing is
emitted, nothing is drawn and nothing takes damage. Patches already on the ground burn
out on their own instead of blinking away, since the systems were already written to
keep decaying while not emitting.

Neither switch is reset by Redeploy: a tuning session should survive dying.

`resolveCombat` would have reached six positional parameters, past the project's limit,
so it now takes a single `CombatStep` object.

## Bug found and fixed during review

The first version of the trail rendered as pale, separated hexagons. Cause: the blob
geometry has radius 0.5, and the instance scale was set to the patch radius rather than
its diameter, so every patch drew at half the size its damage radius claimed. Fixed by
scaling to `radius * 2` and by giving the patch a single radius that both systems read.
The palette was also desaturated by additive blending over the light ground, so it was
moved to a hotter, more saturated set, and blob geometry detail was raised from 0 to 1
for both the trail and the jet.

## Verification

Typecheck and build clean. Playwright against the production bundle in Chromium, no
console or page errors:

- **Enemy toggle:** label switches to `ENEMIES: OFF`, and a stationary tank took no
  damage and gained no score over 8 seconds with the swarm off; toggling back on
  restored spawning.
- **Fire toggle:** with fire off and the swarm on, 12 seconds of spinning scored exactly
  0 - all damage output really is gone, not merely hidden. Switching fire back on scored
  90 over the next 14 seconds. With both switches off the arena is empty and the tank
  drives clean, with only the tail of the earlier trail still cooling on the ground.
  Noted while testing: the game over card covers the whole screen, so the toggles are
  unreachable until Redeploy is pressed. Left as is - you restart first anyway.
- **Trail:** a long curving drive shows a continuous burning ribbon behind the hull,
  bright at the stern and cooling to dark red at the tail, running off the edge of a
  screen that covers about 51 world units - consistent with the 52-unit target.
- **Crowd control works:** the spin-in-place run, which previously died at 25 seconds
  with 90 points, now survives past 30 seconds and reaches 140-160 points. A full run
  ended at 90 points against 30 before the trail.
- **Mobile touch:** unchanged, stick still tracks and recentres.

## Deployment

`.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist` to
GitHub Pages. Action versions were resolved against the live registry rather than
assumed: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5,
deploy-pages v5. `npm run build` typechecks first, so a type error fails the deploy.

Pages serves from `/tank-game/`, so the workflow passes `VITE_BASE=/tank-game/` and
`vite.config.ts` reads it, leaving local dev and preview at the root.
