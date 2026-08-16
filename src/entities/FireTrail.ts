import {
  AdditiveBlending,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from 'three';
import { FIRE_TRAIL, TANK } from '../config';

export interface FirePatch {
  readonly position: Vector3;
  life: number;
  /** Lifetime this patch was born with; see `patchLife`. */
  maxLife: number;
  /** Current burn radius. Damage and the drawn blob share this exact value. */
  radius: number;
  seed: number;
  active: boolean;
}

/**
 * Patch lifetime is derived rather than tuned: at top speed the oldest patch
 * dies exactly when the trail has reached `lengthInHulls` hull lengths, so the
 * requested length holds without a second constant to keep in sync. It is
 * computed per patch because the speed slider moves the top speed underneath us.
 */
const patchLife = (topSpeed: number): number =>
  (TANK.hullLength * FIRE_TRAIL.lengthInHulls) / Math.max(topSpeed, 0.1);

const HOT = new Color(0xffae24);
const MID = new Color(0xff3606);
const COLD = new Color(0x120200);

/** The blob geometry has radius 0.5, so a scale of 2r draws a radius of r. */
const GEOMETRY_TO_RADIUS = 2;

const dummy = new Object3D();
const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);
const patchColor = new Color();

/** Ground fire the tank leaves behind itself. */
export class FireTrail {
  readonly group = new Group();

  private readonly mesh: InstancedMesh;
  private readonly patches: FirePatch[] = [];
  private readonly lastEmission = new Vector3();
  private next = 0;
  private travelled = 0;
  private seeded = false;
  private clock = 0;

  constructor() {
    const geometry = new IcosahedronGeometry(0.5, 1);
    const material = new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      opacity: 0.5,
    });

    this.mesh = new InstancedMesh(geometry, material, FIRE_TRAIL.poolSize);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    for (let i = 0; i < FIRE_TRAIL.poolSize; i += 1) {
      this.mesh.setMatrixAt(i, hiddenMatrix);
      this.mesh.setColorAt(i, COLD);
      this.patches.push({
        position: new Vector3(),
        life: 0,
        maxLife: 1,
        radius: 0,
        seed: 0,
        active: false,
      });
    }
  }

  get all(): readonly FirePatch[] {
    return this.patches;
  }

  update(dt: number, tail: Vector3, emitting: boolean, topSpeed: number): void {
    this.clock += dt;

    if (emitting) this.emit(tail, topSpeed);
    else this.seeded = false;

    for (const patch of this.patches) {
      if (!patch.active) continue;

      patch.life -= dt;
      if (patch.life <= 0) {
        patch.active = false;
        continue;
      }

      patch.radius = FIRE_TRAIL.radius * scaleAt(this.ageOf(patch));
    }

    this.writeInstances();
  }

  reset(): void {
    for (const patch of this.patches) {
      patch.active = false;
      patch.life = 0;
    }
    this.next = 0;
    this.travelled = 0;
    this.seeded = false;
    this.writeInstances();
  }

  /** Patches are laid by distance travelled, so density does not depend on speed. */
  private emit(tail: Vector3, topSpeed: number): void {
    if (!this.seeded) {
      this.seeded = true;
      this.lastEmission.copy(tail);
      this.travelled = FIRE_TRAIL.spacing;
    } else {
      this.travelled += this.lastEmission.distanceTo(tail);
      this.lastEmission.copy(tail);
    }

    while (this.travelled >= FIRE_TRAIL.spacing) {
      this.travelled -= FIRE_TRAIL.spacing;

      // Ring buffer: the pool is sized so the oldest patch has already burned
      // out by the time its slot comes round again.
      const patch = this.patches[this.next]!;
      this.next = (this.next + 1) % this.patches.length;

      patch.active = true;
      patch.maxLife = patchLife(topSpeed);
      patch.life = patch.maxLife;
      patch.radius = FIRE_TRAIL.radius * FIRE_TRAIL.startScale;
      patch.seed = Math.random() * Math.PI * 2;
      patch.position.set(tail.x, FIRE_TRAIL.hoverHeight, tail.z);
    }
  }

  private writeInstances(): void {
    for (let i = 0; i < this.patches.length; i += 1) {
      const patch = this.patches[i]!;

      if (!patch.active) {
        this.mesh.setMatrixAt(i, hiddenMatrix);
        continue;
      }

      const age = this.ageOf(patch);
      const flicker = 0.85 + 0.15 * Math.sin(this.clock * 11 + patch.seed);
      const width = patch.radius * GEOMETRY_TO_RADIUS;

      dummy.position.copy(patch.position);
      dummy.rotation.set(0, patch.seed, 0);
      dummy.scale.set(width, width * FIRE_TRAIL.flatness * flicker, width);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);

      if (age < 0.4) {
        patchColor.copy(HOT).lerp(MID, age / 0.4);
      } else {
        patchColor.copy(MID).lerp(COLD, (age - 0.4) / 0.6);
      }
      patchColor.multiplyScalar(flicker);
      this.mesh.setColorAt(i, patchColor);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** 0 when the patch is laid, 1 when it burns out. */
  private ageOf(patch: FirePatch): number {
    return 1 - patch.life / patch.maxLife;
  }
}

const scaleAt = (age: number): number =>
  FIRE_TRAIL.startScale + (FIRE_TRAIL.endScale - FIRE_TRAIL.startScale) * age;
