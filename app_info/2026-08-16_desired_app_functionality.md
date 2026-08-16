# Desired functionality - Tank Arena concept (2026-08-16)

## Goal

A playable three.js concept: an isometric arena where a heavy tank fights off a swarm
of hostile creatures, driven by a single analog stick and playable both on a phone and
on a desktop.

## Requirements

1. **Single-stick driving.** One stick controls the whole hull. Forward deflection
   drives forward, backward deflection reverses, lateral deflection pivots the tank on
   the spot.
2. **Stick visualisation.** The bottom-left corner always shows the current stick
   deflection, mirroring a real gamepad stick.
3. **Touch input.** Touching the screen on a phone deflects the stick from the point of
   contact and follows the finger.
4. **Weight.** The tank must feel heavy: acceleration and turning carry inertia rather
   than snapping to the input.
5. **Isometric camera.** Orthographic projection at a fixed Diablo II style angle -
   seen from above and to the side. The camera never rotates with the hull.
6. **Shooting.** Fire by touching the right side of the screen; on desktop, the left
   mouse button (usable on a trackpad) or the keyboard.
7. **Desktop controls.** Arrow keys drive, mouse or Space fires.
8. **Swarm and survival.** Hostile creatures converge on the tank. The tank has a hull
   integrity pool that drops on contact with them; at zero the run ends.

## Decisions taken

| Decision | Choice | Reason |
| --- | --- | --- |
| Stack | Vite + TypeScript + three.js | HMR, LAN dev server for phone testing, types for the vector math |
| Assets | three.js primitives | Zero load time, no licensing, reads clearly at the isometric angle |
| Physics | Hand-written kinematics, circle collisions | Full control over the weight of the hull; no engine needed for a swarm of ~90 bodies |
| Aiming | Gun fixed to the hull | Maximum tank feel: turning to face the target is the core tactical decision |
| Scope | Exactly the brief, through to a game over screen with restart | Playable vertical slice, no wave or upgrade systems |

## Success criteria

- Runs at interactive frame rates on a phone and on a desktop browser.
- Forward, reverse and pivot turning all work from a single stick and feel heavy.
- The stick widget tracks both touch and keyboard input.
- Shells kill swarm members; contact with them costs hull integrity.
- Reaching zero hull integrity ends the run and offers a restart.
