import {
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  Vector3,
} from 'three';
import { ARENA, ENEMY } from '../config';
import { makeBandedMaterial } from '../fx/bandedMaterial';
import { INK, RAMPS } from '../fx/palette';
import { snapFacing } from '../fx/PixelPass';

export interface Enemy {
  readonly mesh: Mesh;
  readonly position: Vector3;
  readonly velocity: Vector3;
  health: number;
  contactCooldown: number;
  speed: number;
  bobPhase: number;
  spin: number;
  active: boolean;
}

const Y_SQUASH = ENEMY.height / (ENEMY.radius * 2);
/** How far a body shrinks as the flame consumes it. */
const BURN_SHRINK = 0.3;

const seek = new Vector3();
const separation = new Vector3();
const desired = new Vector3();
const offset = new Vector3();

/**
 * Swarm of chasers. Steering is seek-plus-separation, which keeps the pack
 * from collapsing into a single point while still converging on the tank.
 */
export class EnemySwarm {
  readonly group = new Group();

  private readonly pool: Enemy[] = [];
  private spawnTimer = 0;
  private elapsed = 0;
  private enabled = true;
  /** Facings bodies may be drawn at; 0 draws the true angle. */
  facings = 0;

  constructor() {
    // Detail 0 keeps per-face normals; PolyhedronGeometry smooths them at
    // detail 1 and up, which would defeat the banding.
    const geometry = new IcosahedronGeometry(ENEMY.radius, 0);
    const material = makeBandedMaterial(RAMPS.enemy);
    const outlineGeometry = new EdgesGeometry(geometry, 24);
    const inkMaterial = new LineBasicMaterial({ color: INK, toneMapped: false });

    for (let i = 0; i < ENEMY.maxAlive; i += 1) {
      const mesh = new Mesh(geometry, material);
      mesh.add(new LineSegments(outlineGeometry, inkMaterial));
      mesh.castShadow = true;
      mesh.visible = false;
      mesh.scale.set(1, Y_SQUASH, 1);
      this.group.add(mesh);
      this.pool.push({
        mesh,
        position: mesh.position,
        velocity: new Vector3(),
        health: ENEMY.health,
        contactCooldown: 0,
        speed: ENEMY.minSpeed,
        bobPhase: 0,
        spin: 0,
        active: false,
      });
    }
  }

  get all(): readonly Enemy[] {
    return this.pool;
  }

  /**
   * Turning the swarm off clears the arena so the tank can be driven on its
   * own. The difficulty ramp is frozen meanwhile, since `update` returns early.
   */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;

    this.enabled = enabled;
    if (enabled) {
      this.spawnTimer = 0;
      return;
    }

    for (const enemy of this.pool) this.deactivate(enemy);
  }

  update(dt: number, tankPosition: Vector3): void {
    if (!this.enabled) return;

    this.elapsed += dt;
    this.spawnTimer -= dt;

    if (this.spawnTimer <= 0) {
      this.spawn(tankPosition);
      this.spawnTimer = this.currentSpawnInterval();
    }

    const smoothing = 1 - Math.exp(-ENEMY.steerLambda * dt);

    for (const enemy of this.pool) {
      if (!enemy.active) continue;

      enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);

      seek.subVectors(tankPosition, enemy.position).setY(0);
      const distance = seek.length();
      if (distance > 0.001) seek.multiplyScalar(enemy.speed / distance);

      this.accumulateSeparation(enemy);
      desired.copy(seek).add(separation);

      enemy.velocity.x += (desired.x - enemy.velocity.x) * smoothing;
      enemy.velocity.z += (desired.z - enemy.velocity.z) * smoothing;

      enemy.position.x += enemy.velocity.x * dt;
      enemy.position.z += enemy.velocity.z * dt;
      this.clampToArena(enemy);

      enemy.bobPhase += dt * 9;
      enemy.position.y = ENEMY.height / 2 + Math.sin(enemy.bobPhase) * 0.18;
      enemy.spin += dt * 2.4;
      enemy.mesh.rotation.y = snapFacing(enemy.spin, this.facings);
      enemy.mesh.rotation.x = Math.sin(enemy.bobPhase * 0.5) * 0.25;

      // Bodies visibly shrivel as they burn down.
      const intact = 1 - BURN_SHRINK * (1 - enemy.health / ENEMY.health);
      enemy.mesh.scale.set(intact, Y_SQUASH * intact, intact);
    }
  }

  /** Returns true when this was the killing blow. */
  damage(enemy: Enemy, amount: number): boolean {
    enemy.health -= amount;
    if (enemy.health > 0) return false;

    this.deactivate(enemy);
    return true;
  }

  reset(): void {
    this.elapsed = 0;
    this.spawnTimer = 0;
    for (const enemy of this.pool) this.deactivate(enemy);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  private accumulateSeparation(enemy: Enemy): void {
    separation.set(0, 0, 0);

    for (const other of this.pool) {
      if (other === enemy || !other.active) continue;

      offset.subVectors(enemy.position, other.position).setY(0);
      const distanceSq = offset.lengthSq();
      if (distanceSq === 0 || distanceSq > ENEMY.separationRadius * ENEMY.separationRadius) continue;

      const distance = Math.sqrt(distanceSq);
      // Closer neighbours push harder.
      offset.multiplyScalar((ENEMY.separationRadius - distance) / (distance * ENEMY.separationRadius));
      separation.add(offset);
    }

    separation.multiplyScalar(ENEMY.separationStrength);
  }

  private spawn(tankPosition: Vector3): void {
    const enemy = this.pool.find((candidate) => !candidate.active);
    if (!enemy) return;

    const limit = ARENA.halfSize - ENEMY.radius - 1;
    const angle = Math.random() * Math.PI * 2;
    const distance =
      ENEMY.spawnDistanceMin + Math.random() * (ENEMY.spawnDistanceMax - ENEMY.spawnDistanceMin);

    enemy.position.set(
      clamp(tankPosition.x + Math.sin(angle) * distance, -limit, limit),
      ENEMY.height / 2,
      clamp(tankPosition.z + Math.cos(angle) * distance, -limit, limit),
    );

    enemy.velocity.set(0, 0, 0);
    enemy.health = ENEMY.health;
    enemy.contactCooldown = 0;
    enemy.speed = ENEMY.minSpeed + Math.random() * (ENEMY.maxSpeed - ENEMY.minSpeed);
    enemy.bobPhase = Math.random() * Math.PI * 2;
    enemy.spin = Math.random() * Math.PI * 2;
    enemy.active = true;
    enemy.mesh.visible = true;
    enemy.mesh.scale.set(1, Y_SQUASH, 1);
  }

  private currentSpawnInterval(): number {
    const progress = Math.min(1, this.elapsed / ENEMY.rampDuration);
    return (
      ENEMY.spawnIntervalStart +
      (ENEMY.spawnIntervalEnd - ENEMY.spawnIntervalStart) * progress
    );
  }

  private clampToArena(enemy: Enemy): void {
    const limit = ARENA.halfSize - ENEMY.radius;
    enemy.position.x = clamp(enemy.position.x, -limit, limit);
    enemy.position.z = clamp(enemy.position.z, -limit, limit);
  }

  private deactivate(enemy: Enemy): void {
    enemy.active = false;
    enemy.mesh.visible = false;
    enemy.velocity.set(0, 0, 0);
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
