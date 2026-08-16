import { MathUtils, OrthographicCamera, Vector3 } from 'three';
import { CAMERA } from '../config';

const tmpTarget = new Vector3();

/**
 * Orthographic camera locked to a fixed isometric angle, Diablo II style:
 * it follows the tank with a slight lag and never rotates with it, so the
 * player always reads the world from the same viewpoint.
 */
export class IsometricCamera {
  readonly camera: OrthographicCamera;

  private readonly offset = new Vector3(CAMERA.offset.x, CAMERA.offset.y, CAMERA.offset.z);
  private readonly focus = new Vector3();
  private readonly shakeOffset = new Vector3();
  private shake = 0;

  /** Screen axes of this fixed camera, used to align the view to whole texels. */
  private readonly viewForward = new Vector3();
  private readonly viewRight = new Vector3();
  private readonly viewUp = new Vector3();
  private readonly aligned = new Vector3();
  private texelsWide = 0;
  private texelsHigh = 0;
  private unitsPerTexelX = 0;
  private unitsPerTexelY = 0;

  constructor(aspect: number) {
    this.camera = new OrthographicCamera(-1, 1, 1, -1, CAMERA.near, CAMERA.far);

    this.viewForward.copy(this.offset).negate().normalize();
    this.viewRight.crossVectors(this.viewForward, new Vector3(0, 1, 0)).normalize();
    this.viewUp.crossVectors(this.viewRight, this.viewForward).normalize();

    this.setAspect(aspect);
    this.camera.position.copy(this.offset);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Aligns the view to a grid of `width` by `height` texels. At sprite
   * resolutions an unaligned camera makes the whole scene crawl and shimmer as
   * it moves, because every surface resamples slightly differently each frame.
   * Pass zeroes to turn the alignment off.
   */
  setTexelGrid(width: number, height: number): void {
    this.texelsWide = width;
    this.texelsHigh = height;
    this.refreshTexelSize();
  }

  setAspect(aspect: number): void {
    const half = CAMERA.minSpan / 2;
    const halfWidth = aspect >= 1 ? half * aspect : half;
    const halfHeight = aspect >= 1 ? half : half / aspect;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.refreshTexelSize();
  }

  private refreshTexelSize(): void {
    const { left, right, top, bottom } = this.camera;
    this.unitsPerTexelX = this.texelsWide > 0 ? (right - left) / this.texelsWide : 0;
    this.unitsPerTexelY = this.texelsHigh > 0 ? (top - bottom) / this.texelsHigh : 0;
  }

  snapTo(target: Vector3): void {
    this.focus.copy(target);
    this.applyTransform();
  }

  addShake(amount: number): void {
    this.shake = Math.min(CAMERA.shakeMax, this.shake + amount);
  }

  update(target: Vector3, dt: number): void {
    // Frame-rate independent exponential smoothing.
    const t = 1 - Math.exp(-CAMERA.followLambda * dt);
    tmpTarget.copy(target);
    this.focus.lerp(tmpTarget, t);

    if (this.shake > 0.0001) {
      const s = this.shake;
      this.shakeOffset.set(
        MathUtils.randFloatSpread(s),
        MathUtils.randFloatSpread(s * 0.6),
        MathUtils.randFloatSpread(s),
      );
      this.shake = Math.max(0, this.shake - CAMERA.shakeDecay * this.shake * dt);
    } else {
      this.shakeOffset.set(0, 0, 0);
      this.shake = 0;
    }

    this.applyTransform();
  }

  private applyTransform(): void {
    this.aligned.copy(this.focus).add(this.shakeOffset);
    this.alignToTexelGrid();

    this.camera.position.copy(this.aligned).add(this.offset);
    this.camera.lookAt(this.aligned);
  }

  /** Rounds the focus along the two screen axes to whole texels. */
  private alignToTexelGrid(): void {
    if (this.unitsPerTexelX <= 0 || this.unitsPerTexelY <= 0) return;

    const right = this.aligned.dot(this.viewRight);
    const up = this.aligned.dot(this.viewUp);
    const depth = this.aligned.dot(this.viewForward);

    const snappedRight = Math.round(right / this.unitsPerTexelX) * this.unitsPerTexelX;
    const snappedUp = Math.round(up / this.unitsPerTexelY) * this.unitsPerTexelY;

    this.aligned
      .copy(this.viewRight)
      .multiplyScalar(snappedRight)
      .addScaledVector(this.viewUp, snappedUp)
      .addScaledVector(this.viewForward, depth);
  }
}
