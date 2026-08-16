import { Vector3 } from 'three';
import { ENEMY, FIRE_TRAIL, FLAME, TANK } from '../config';
import type { Enemy, EnemySwarm } from '../entities/EnemySwarm';
import type { FireTrail } from '../entities/FireTrail';
import type { Tank } from '../entities/Tank';
import type { Effects } from '../fx/Effects';

export interface CombatResult {
  kills: number;
  damageTaken: number;
}

export interface CombatStep {
  tank: Tank;
  swarm: EnemySwarm;
  trail: FireTrail;
  effects: Effects;
  dt: number;
  /** False while the player has switched the fire off to just drive around. */
  flameActive: boolean;
}

const toEnemy = new Vector3();
const push = new Vector3();

const CONTACT_RADIUS = TANK.radius + ENEMY.radius;

/**
 * Burns whatever stands in the flame cone or in the trail behind the hull, and
 * bites back on hull contact.
 */
export function resolveCombat(step: CombatStep): CombatResult {
  const { tank, swarm, trail, effects, dt, flameActive } = step;
  const result: CombatResult = { kills: 0, damageTaken: 0 };

  for (const enemy of swarm.all) {
    if (!enemy.active) continue;

    toEnemy.subVectors(enemy.position, tank.position).setY(0);
    const distance = toEnemy.length();

    let burn = 0;
    if (flameActive && burnsInCone(tank, toEnemy, distance)) {
      const falloff =
        1 - (1 - FLAME.falloffAtRange) * Math.min(1, distance / FLAME.range);
      burn += FLAME.damagePerSecond * falloff;
    }
    // Overlapping patches must not stack, so the trail contributes at most once.
    if (standsInTrail(trail, enemy)) burn += FIRE_TRAIL.damagePerSecond;

    if (burn > 0 && swarm.damage(enemy, burn * dt)) {
      effects.burst(enemy.position);
      result.kills += 1;
      continue;
    }

    if (distance >= CONTACT_RADIUS) continue;

    // Always separate the bodies so enemies never sit inside the hull.
    if (distance > 0.001) {
      push.copy(toEnemy).multiplyScalar((CONTACT_RADIUS - distance) / distance);
      enemy.position.x += push.x;
      enemy.position.z += push.z;
      enemy.velocity.multiplyScalar(0.2);
    }

    if (enemy.contactCooldown > 0) continue;

    enemy.contactCooldown = ENEMY.contactCooldown;
    result.damageTaken += ENEMY.contactDamage;
    effects.burst(enemy.position, 4, 'spark');
  }

  return result;
}

/**
 * Cone test against the hull's forward axis. The cone is widened by the angle
 * the target's own radius subtends, so a body pressed against the nozzle counts
 * as hit even though a narrow cone barely covers it at that distance.
 */
function standsInTrail(trail: FireTrail, enemy: Enemy): boolean {
  for (const patch of trail.all) {
    if (!patch.active) continue;

    const reach = patch.radius + ENEMY.radius;
    const dx = patch.position.x - enemy.position.x;
    const dz = patch.position.z - enemy.position.z;
    if (dx * dx + dz * dz <= reach * reach) return true;
  }

  return false;
}

function burnsInCone(tank: Tank, offset: Vector3, distance: number): boolean {
  if (distance > FLAME.range + ENEMY.radius || distance < 0.001) return false;

  const alignment =
    (offset.x * tank.forward.x + offset.z * tank.forward.z) / distance;
  if (alignment <= 0) return false;

  const limit = FLAME.halfAngle + Math.atan(ENEMY.radius / Math.max(distance, 0.6));
  return Math.acos(Math.min(1, alignment)) <= limit;
}
