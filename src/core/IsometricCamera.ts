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

  constructor(aspect: number) {
    this.camera = new OrthographicCamera(-1, 1, 1, -1, CAMERA.near, CAMERA.far);
    this.setAspect(aspect);
    this.camera.position.copy(this.offset);
    this.camera.lookAt(0, 0, 0);
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
    this.camera.position.copy(this.focus).add(this.offset).add(this.shakeOffset);
    this.camera.lookAt(this.focus.x + this.shakeOffset.x, 0, this.focus.z + this.shakeOffset.z);
  }
}
