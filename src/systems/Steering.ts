import { CAMERA, STEERING, TANK } from '../config';
import type { InputState } from '../input/InputState';

export type SteeringMode = 'screen' | 'tank';

/** What the drive model consumes: throttle and a track-difference term. */
export interface DriveCommand {
  throttle: number;
  steer: number;
}

/**
 * Ground-plane basis of the camera. Screen-up is the direction the camera looks
 * along, flattened; screen-right is that rotated a quarter turn. The camera
 * angle is fixed, so this is computed once.
 */
const camLength = Math.hypot(CAMERA.offset.x, CAMERA.offset.z);
const UP_X = -CAMERA.offset.x / camLength;
const UP_Z = -CAMERA.offset.z / camLength;
const RIGHT_X = -UP_Z;
const RIGHT_Z = UP_X;

/**
 * Turns stick deflection into a drive command.
 *
 * In `screen` mode the stick names a heading in world space and the tank picks
 * the cheaper way to satisfy it: nose first, or backing up when the target sits
 * behind it. That is what makes "push down to go down the screen" hold no
 * matter which way the hull happens to be pointing.
 */
export class Steering {
  mode: SteeringMode = STEERING.defaultMode;

  /** Latched so the forward/reverse choice cannot chatter near the beam. */
  private reversing = false;

  command(input: InputState, heading: number, speed: number): DriveCommand {
    return this.mode === 'screen'
      ? this.screenRelative(input, heading)
      : hullRelative(input, speed);
  }

  reset(): void {
    this.reversing = false;
  }

  private screenRelative(input: InputState, heading: number): DriveCommand {
    const magnitude = Math.min(1, Math.hypot(input.steer, input.throttle));
    if (magnitude < 0.001) {
      this.reversing = false;
      return { throttle: 0, steer: 0 };
    }

    const worldX = RIGHT_X * input.steer + UP_X * input.throttle;
    const worldZ = RIGHT_Z * input.steer + UP_Z * input.throttle;

    // Headings follow the hull convention: forward is (sin h, 0, cos h).
    const noseError = wrapAngle(Math.atan2(worldX, worldZ) - heading);
    const behind = Math.abs(noseError);

    if (this.reversing) {
      if (behind < STEERING.enterForwardAngle) this.reversing = false;
    } else if (behind > STEERING.enterReverseAngle) {
      this.reversing = true;
    }

    // When backing up it is the tail that must line up with the target.
    const error = this.reversing ? wrapAngle(noseError + Math.PI) : noseError;

    // A growing heading turns left, and a positive steer turns right.
    const steer = -clamp(error / STEERING.fullSteerAngle, -1, 1);
    const throttleScale = Math.max(STEERING.minThrottleWhileTurning, Math.cos(error));
    const throttle = magnitude * throttleScale * (this.reversing ? -1 : 1);

    return { throttle, steer };
  }
}

/**
 * Classic hull-relative controls: the stick pushes the hull about, with
 * steering flipped once the tank is genuinely rolling backwards so that it at
 * least follows the direction of travel.
 */
function hullRelative(input: InputState, speed: number): DriveCommand {
  const reversing = TANK.invertSteerInReverse && speed < -TANK.reverseThreshold;
  return {
    throttle: input.throttle,
    steer: reversing ? -input.steer : input.steer,
  };
}

function wrapAngle(angle: number): number {
  const wrapped = (angle + Math.PI) % (Math.PI * 2);
  return (wrapped < 0 ? wrapped + Math.PI * 2 : wrapped) - Math.PI;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
