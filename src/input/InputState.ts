/** Single control surface every driving system reads from. */
export interface InputState {
  /** -1 (full left) .. 1 (full right). */
  steer: number;
  /** -1 (full reverse) .. 1 (full forward). */
  throttle: number;
  /** True while a touch is actively driving the stick, used by the HUD widget. */
  stickActive: boolean;
}

export const createInputState = (): InputState => ({
  steer: 0,
  throttle: 0,
  stickActive: false,
});
