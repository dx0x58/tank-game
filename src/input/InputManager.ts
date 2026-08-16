import { createInputState, type InputState } from './InputState';

/** Pixels of travel that correspond to full stick deflection. */
const STICK_RADIUS = 58;
const DEADZONE = 0.12;

const FORWARD_KEYS = new Set(['ArrowUp', 'KeyW']);
const BACKWARD_KEYS = new Set(['ArrowDown', 'KeyS']);
const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);

/** HUD controls that must keep their native touch behaviour. */
const INTERACTIVE = 'button, input, select, textarea, a';

/**
 * Merges the two driving schemes into one InputState: a touch stick anywhere on
 * the left half of the screen, and the keyboard on desktop. The flamethrower
 * needs no input of its own.
 */
export class InputManager {
  readonly state: InputState = createInputState();

  private readonly pressedKeys = new Set<string>();
  private stickPointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private rawSteer = 0;
  private rawThrottle = 0;
  private readonly disposers: Array<() => void> = [];

  constructor(private readonly surface: HTMLElement) {
    this.listen(surface, 'pointerdown', this.onPointerDown as EventListener);
    this.listen(surface, 'pointermove', this.onPointerMove as EventListener);
    this.listen(surface, 'pointerup', this.onPointerEnd as EventListener);
    this.listen(surface, 'pointercancel', this.onPointerEnd as EventListener);
    this.listen(window, 'keydown', this.onKeyDown as EventListener);
    this.listen(window, 'keyup', this.onKeyUp as EventListener);
    this.listen(window, 'blur', this.reset as EventListener);
    this.listen(surface, 'contextmenu', (event) => event.preventDefault());
  }

  /** Recomputes the merged state; call once per frame before reading it. */
  update(): void {
    const touchDriving = this.stickPointerId !== null;

    if (touchDriving) {
      this.state.steer = applyDeadzone(this.rawSteer);
      this.state.throttle = applyDeadzone(this.rawThrottle);
    } else {
      this.state.steer = this.axisFromKeys(RIGHT_KEYS, LEFT_KEYS);
      this.state.throttle = this.axisFromKeys(FORWARD_KEYS, BACKWARD_KEYS);
    }

    this.state.stickActive = touchDriving;
  }

  dispose(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') return;

    // Touches that land on a HUD control belong to it. Calling preventDefault
    // here would suppress the compatibility click and break those controls.
    if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;

    const onLeftHalf = event.clientX < this.surface.clientWidth / 2;
    if (!onLeftHalf || this.stickPointerId !== null) return;

    event.preventDefault();
    this.stickPointerId = event.pointerId;
    this.originX = event.clientX;
    this.originY = event.clientY;
    this.rawSteer = 0;
    this.rawThrottle = 0;
    this.surface.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.stickPointerId) return;

    event.preventDefault();
    let dx = (event.clientX - this.originX) / STICK_RADIUS;
    let dy = (event.clientY - this.originY) / STICK_RADIUS;

    // Clamp to a circle so diagonals are not stronger than the cardinals.
    const magnitude = Math.hypot(dx, dy);
    if (magnitude > 1) {
      dx /= magnitude;
      dy /= magnitude;
    }

    this.rawSteer = dx;
    this.rawThrottle = -dy;
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.stickPointerId) return;

    this.stickPointerId = null;
    this.rawSteer = 0;
    this.rawThrottle = 0;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isGameKey(event.code)) event.preventDefault();
    this.pressedKeys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private readonly reset = (): void => {
    this.pressedKeys.clear();
    this.stickPointerId = null;
    this.rawSteer = 0;
    this.rawThrottle = 0;
  };

  private axisFromKeys(positive: Set<string>, negative: Set<string>): number {
    return (this.hasAnyKey(positive) ? 1 : 0) - (this.hasAnyKey(negative) ? 1 : 0);
  }

  private hasAnyKey(codes: Set<string>): boolean {
    for (const code of codes) {
      if (this.pressedKeys.has(code)) return true;
    }
    return false;
  }

  private listen(
    target: HTMLElement | Window,
    type: string,
    handler: EventListener,
  ): void {
    const options: AddEventListenerOptions = { passive: false };
    target.addEventListener(type, handler, options);
    this.disposers.push(() => target.removeEventListener(type, handler, options));
  }
}

function applyDeadzone(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude < DEADZONE) return 0;
  // Rescale so the axis still reaches 1 at full deflection.
  return Math.sign(value) * ((magnitude - DEADZONE) / (1 - DEADZONE));
}

function isGameKey(code: string): boolean {
  return (
    FORWARD_KEYS.has(code) ||
    BACKWARD_KEYS.has(code) ||
    LEFT_KEYS.has(code) ||
    RIGHT_KEYS.has(code)
  );
}
