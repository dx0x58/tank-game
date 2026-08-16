import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { EFFECTS } from '../config';

interface Debris {
  mesh: Mesh;
  velocity: Vector3;
  spin: Vector3;
  life: number;
  active: boolean;
}

export type DebrisVariant = 'enemy' | 'spark';

/** Muzzle flash plus a recycled cloud of debris cubes for kills and hits. */
export class Effects {
  readonly group = new Group();

  private readonly debris: Debris[] = [];

  /** Shared per-variant materials; pieces swap references instead of cloning. */
  private readonly debrisMaterials: Record<DebrisVariant, MeshStandardMaterial> = {
    enemy: new MeshStandardMaterial({ color: 0xd8604f, roughness: 0.8 }),
    spark: new MeshStandardMaterial({
      color: 0xffc46b,
      emissive: new Color(0xff8a2b),
      emissiveIntensity: 1.6,
      roughness: 0.5,
    }),
  };

  constructor() {
    const geometry = new BoxGeometry(0.28, 0.28, 0.28);

    for (let i = 0; i < EFFECTS.debrisPoolSize; i += 1) {
      const mesh = new Mesh(geometry, this.debrisMaterials.enemy);
      mesh.visible = false;
      mesh.castShadow = true;
      this.group.add(mesh);
      this.debris.push({
        mesh,
        velocity: new Vector3(),
        spin: new Vector3(),
        life: 0,
        active: false,
      });
    }
  }

  burst(
    position: Vector3,
    count = EFFECTS.debrisPerKill,
    variant: DebrisVariant = 'enemy',
  ): void {
    let spawned = 0;

    for (const piece of this.debris) {
      if (spawned >= count) break;
      if (piece.active) continue;

      piece.active = true;
      piece.life = EFFECTS.debrisLife;
      piece.mesh.visible = true;
      piece.mesh.position.copy(position);
      piece.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
      piece.velocity.set(
        (Math.random() - 0.5) * 11,
        3 + Math.random() * 7,
        (Math.random() - 0.5) * 11,
      );
      piece.spin.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
      );
      piece.mesh.material = this.debrisMaterials[variant];
      spawned += 1;
    }
  }

  update(dt: number): void {
    for (const piece of this.debris) {
      if (!piece.active) continue;

      piece.life -= dt;
      piece.velocity.y -= EFFECTS.debrisGravity * dt;
      piece.mesh.position.addScaledVector(piece.velocity, dt);
      piece.mesh.rotation.x += piece.spin.x * dt;
      piece.mesh.rotation.y += piece.spin.y * dt;
      piece.mesh.rotation.z += piece.spin.z * dt;

      if (piece.mesh.position.y < 0.15) {
        piece.mesh.position.y = 0.15;
        piece.velocity.y *= -0.35;
        piece.velocity.x *= 0.7;
        piece.velocity.z *= 0.7;
      }

      if (piece.life <= 0) {
        piece.active = false;
        piece.mesh.visible = false;
      }
    }
  }

  reset(): void {
    for (const piece of this.debris) {
      piece.active = false;
      piece.mesh.visible = false;
    }
  }
}
