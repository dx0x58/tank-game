# Implementation update - reverse steering and speed slider (2026-08-16)

Fourth pass. Reported problem: at some camera angles it is not obvious which way to
steer, particularly when reversing towards the top of the screen. Plus a request for a
speed slider.

## Steering follows the direction of travel

With hull-relative tank controls, reversing swings the nose one way and the tail the
other. Since the tail is where you are going, the tank appears to turn against the
stick. From a fixed isometric camera, where the hull's facing is already hard to read,
this is the worst case.

Steering is now inverted while the tank is actually rolling backwards, so the stick
always matches the direction the tank curves on screen.

The flip keys off measured speed rather than off the stick. Braking from a forward run
therefore keeps direct steering for as long as the tank still moves forward, and only
flips once it genuinely reverses - matching what the player sees rather than what they
asked for a moment ago. `TANK.reverseThreshold` (0.5 m/s) prevents flapping around a
standstill; `TANK.invertSteerInReverse` disables the behaviour.

## Speed slider

A HUD range control scales top speed from 40% to 200% of `TANK.maxTrackSpeed`.
Acceleration is scaled by the same factor inside `Tank`, so time to reach top speed is
unchanged and a faster tank feels quick rather than mushy; the sense of weight is
preserved across the range.

Two things had to follow the slider rather than sit still:

- `Tank.topSpeed` replaced the direct reads of `TANK.maxTrackSpeed`, and
  `scaleTrackTarget` / `approachTrackSpeed` became methods because they now depend on
  instance state.
- The fire trail's patch lifetime is derived from top speed. It is now computed per
  patch at the moment it is laid, so the "ten hull lengths" invariant survives the
  slider. Left alone, the trail would have stretched to double length at 200%.

## Input scoping

`InputManager` used to call `preventDefault()` on every touch that reached the viewport.
It now does so only for touches it actually claims for the stick, and it ignores touches
that land on a HUD control.

To be accurate about this: it fixes no observed defect. Both behaviours were tested and
the toggles respond to taps either way, and the range input drags either way, because
native range dragging is driven by touch events rather than the compatibility mouse
events that `preventDefault` suppresses. The change is defensive scoping - it stops the
stick from suppressing defaults on input that was never its own - not a bug fix.

## Verification

Nine physics assertions were run against the real modules through the Vite dev server,
so module resolution matches the app:

- forward with stick right turns the nose right; reverse genuinely moves backwards
- reverse inverts the turn: heading `-1.671` forward versus `+1.155` reversing
- a light brake while still rolling forward keeps direct steering, advancing 5.02 m
- the slider scales distance covered: 4.8 m / 12.0 m / 24.0 m over two seconds at 40% /
  100% / 200%, and the scale clamps to 4.08-20.40 m/s
- the trail spans 50.6 m, 50.5 m and 50.3 m at 40%, 100% and 200% speed against a 52 m
  target, comfortably inside the 1.1 m spacing granularity

Two earlier failures in this suite were faults in the test, not the game: the tank was
driving into the arena wall, which clamped the distances being measured.

A third failure was real behaviour rather than a bug, and is now documented: slamming
from full forward to full reverse produces no steering at all, because both tracks
saturate at the same deceleration limit and the drive model yaws on the difference
between them.

HUD and touch checks, on the production bundle: slider defaults to 100% and tracks to
both ends, both toggles respond to real taps, the slider can be dragged by touch, and
the stick still drives afterwards. No console or page errors.
