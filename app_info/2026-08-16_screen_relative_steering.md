# Implementation update - screen-relative steering (2026-08-16)

Fifth pass. Reported problem, with a screenshot: the tank was travelling up the screen
while the stick had to be held *down*, and at some camera angles it was not obvious
which way to turn at all. Request: make it intuitive, and look up how other games solve
this.

## What the research said

The previous pass treated this as a reverse-steering problem and inverted the steering
while backing up. That helped but did not address the cause. What we had is what the
literature calls **tank controls**: movement relative to the character rather than to the
camera. Wikipedia's entry defines them that way, and the retrospectives are consistent -
they were a workaround for fixed cameras in the 1990s, kept usable because the camera
often sat behind the player, and they were abandoned once analog sticks made
camera-relative movement practical.

The replacement is standard: project the stick onto the camera's ground-plane basis and
treat the result as a desired direction in the world. Unity, Godot and Roblox
documentation all describe the same recipe - take the camera's forward and right vectors,
flatten out the vertical component, renormalise, and combine them with the stick axes. A
post specifically about isometric controls ("Fix Your Isometric Controls!") makes the
point that matters here: in an isometric view the screen axes are not the world axes, so
the stick has to go through a change of basis or the player ends up 45 degrees off from
what they pushed.

## What was built

`src/systems/Steering.ts` turns stick deflection into a `DriveCommand` of throttle plus
track difference. `Tank.update` now consumes that command instead of raw input, so the
differential drive model is untouched and the tank keeps its weight under either scheme.

**SCREEN mode (new default).** The stick names a heading in the world:

```
world = cameraRight * stick.x + cameraForwardFlat * stick.y
```

The camera angle is fixed, so that basis is computed once from `CAMERA.offset`. The model
then compares the desired heading against the hull's and picks the cheaper way to satisfy
it: drive at it nose first, or back towards it when it sits behind. Steering is
proportional to the remaining heading error, and throttle is scaled by its cosine, so a
hard turn becomes a pivot instead of a wide arc. The forward-or-reverse choice is latched
with hysteresis - reverse above 110 degrees, forward again only below 70 - so it cannot
chatter when the stick sits near a right angle to the hull.

**TANK mode.** The old hull-relative scheme, including the reverse-steer inversion added
last pass, kept behind the STEER toggle for comparison.

## Verification

Eleven assertions run against the real modules through the Vite dev server:

- The headline promise, checked from **all eight hull headings** for each of the four
  stick directions: stick up moves the tank up the screen, down moves it down, left
  moves it left, right moves it right. 32 cases, all passing. Displacement is projected
  back onto the camera's screen axes to judge it, so this measures what the player sees
  rather than what the code intended.
- A target directly behind is reached in reverse (`travelSpeed` goes negative) rather
  than by spinning round, and still ends up 5.3 m up the screen.
- A target dead ahead is driven at nose first, with no spurious reverse.
- TANK mode still inverts steering when rolling backwards: heading `-1.671` forward
  versus `+1.155` in reverse.
- The speed slider and the fire trail invariants from the previous pass still hold:
  4.8 / 12.0 / 24.0 m covered at 40 / 100 / 200 percent, trail spanning 50.3-50.6 m
  against a 52 m target across the whole slider range.

HUD checks on the production bundle: STEER defaults to SCREEN, toggles to TANK and back,
both other toggles still respond to real taps, the speed slider still drags by touch, and
the stick still drives afterwards. No console or page errors.

A screenshot confirms the reported case is inverted: stick held up, hull pointing down
the screen, tank travelling up the screen in reverse with its trail left below it.
