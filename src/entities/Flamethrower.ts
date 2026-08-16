import {
  AdditiveBlending,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  PointLight,
  Vector3,
} from 'three';
import { FLAME } from '../config';

interface Particle {
  position: Vector3;
  velocity: Vector3;
  life: number;
  spin: number;
  active: boolean;
}

const UP = new Vector3(0, 1, 0);

const HOT = new Color(0xfff2b0);
const MID = new Color(0xff7a1e);
const COLD = new Color(0x140302);

const dummy = new Object3D();
const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);
const perpendicular = new Vector3();
const particleColor = new Color();

/**
 * Continuous flame jet. Damage is resolved separately as a cone test in
 * Combat; this class owns only the look of the jet and its light.
 */
export class Flamethrower {
  readonly group = new Group();

  private readonly mesh: InstancedMesh;
  private readonly light: PointLight;
  private readonly pool: Particle[] = [];
  private emitCredit = 0;
  private flicker = 0;

  constructor() {
    const geometry = new IcosahedronGeometry(0.5, 1);
    const material = new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      opacity: 0.55,
    });

    this.mesh = new InstancedMesh(geometry, material, FLAME.poolSize);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    for (let i = 0; i < FLAME.poolSize; i += 1) {
      this.mesh.setMatrixAt(i, hiddenMatrix);
      this.mesh.setColorAt(i, COLD);
      this.pool.push({
        position: new Vector3(),
        velocity: new Vector3(),
        life: 0,
        spin: 0,
        active: false,
      });
    }

    this.light = new PointLight(0xff7a2a, 0, FLAME.range * 1.6, 2);
    this.group.add(this.light);
  }

  update(dt: number, nozzle: Vector3, forward: Vector3, emitting: boolean): void {
    if (emitting) this.emit(dt, nozzle, forward);
    this.advance(dt);
    this.updateLight(dt, nozzle, emitting);
    this.writeInstances();
  }

  reset(): void {
    for (const particle of this.pool) {
      particle.active = false;
      particle.life = 0;
    }
    this.emitCredit = 0;
    this.light.intensity = 0;
    this.writeInstances();
  }

  private emit(dt: number, nozzle: Vector3, forward: Vector3): void {
    this.emitCredit += FLAME.particlesPerSecond * dt;

    // Perpendicular to the jet in the ground plane, used to scatter the cone.
    perpendicular.set(forward.z, 0, -forward.x);

    while (this.emitCredit >= 1) {
      this.emitCredit -= 1;
      const particle = this.pool.find((candidate) => !candidate.active);
      if (!particle) {
        this.emitCredit = 0;
        return;
      }

      particle.active = true;
      particle.life = FLAME.particleLife;
      particle.spin = (Math.random() - 0.5) * 9;
      particle.position.copy(nozzle);

      particle.velocity
        .copy(forward)
        .addScaledVector(perpendicular, (Math.random() * 2 - 1) * FLAME.spread)
        .addScaledVector(UP, (Math.random() * 2 - 1) * FLAME.spread * 0.7)
        .normalize()
        .multiplyScalar(FLAME.particleSpeed * (0.75 + Math.random() * 0.5));
    }
  }

  private advance(dt: number): void {
    const drag = Math.max(0, 1 - FLAME.drag * dt);

    for (const particle of this.pool) {
      if (!particle.active) continue;

      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }

      particle.velocity.multiplyScalar(drag);
      particle.velocity.y += FLAME.buoyancy * dt;
      particle.position.addScaledVector(particle.velocity, dt);
    }
  }

  private updateLight(dt: number, nozzle: Vector3, emitting: boolean): void {
    if (!emitting) {
      this.light.intensity = 0;
      return;
    }

    this.flicker += dt * 27;
    const wobble = 0.82 + 0.18 * Math.sin(this.flicker) + Math.random() * 0.08;
    this.light.position.copy(nozzle);
    this.light.intensity = FLAME.lightIntensity * wobble;
  }

  private writeInstances(): void {
    for (let i = 0; i < this.pool.length; i += 1) {
      const particle = this.pool[i]!;

      if (!particle.active) {
        this.mesh.setMatrixAt(i, hiddenMatrix);
        continue;
      }

      // age runs 0 at the nozzle to 1 where the particle burns out.
      const age = 1 - particle.life / FLAME.particleLife;
      const scale = FLAME.startScale + (FLAME.endScale - FLAME.startScale) * age;

      dummy.position.copy(particle.position);
      dummy.rotation.set(age * particle.spin, age * particle.spin * 0.7, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);

      // White hot at the nozzle, orange through the middle, embers at the tip.
      if (age < 0.35) {
        particleColor.copy(HOT).lerp(MID, age / 0.35);
      } else {
        particleColor.copy(MID).lerp(COLD, (age - 0.35) / 0.65);
      }
      this.mesh.setColorAt(i, particleColor);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
