import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  Object3D,
  Vector3,
} from 'three';
import { ARENA, FLAME, TANK } from '../config';
import { makeBandedMaterial } from '../fx/bandedMaterial';
import { INK, RAMPS } from '../fx/palette';
import { snapFacing } from '../fx/PixelPass';
import type { DriveCommand } from '../systems/Steering';

/**
 * Heading convention: the hull's forward axis is local +Z, so the world-space
 * forward vector is (sin(heading), 0, cos(heading)) and a growing heading turns
 * the tank left.
 */
export class Tank {
  readonly root = new Group();
  readonly position = new Vector3(0, 0, 0);
  readonly forward = new Vector3(0, 0, 1);

  heading = 0;
  health = TANK.maxHealth;
  /** Facings the hull may be drawn at; 0 draws the true heading. */
  facings = 0;

  /** Signed speed of each track in metres per second. */
  private trackLeft = 0;
  private trackRight = 0;
  private speedScale = 1;
  private speed = 0;
  private yawRate = 0;
  private lean = { pitch: 0, roll: 0 };

  private readonly body: Group;

  constructor() {
    this.body = buildHull();
    this.root.add(this.body);
    this.syncTransform();
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  /** Signed speed along the hull axis; negative means rolling backwards. */
  get travelSpeed(): number {
    return this.speed;
  }

  /** Current forward top speed, after the HUD speed slider is applied. */
  get topSpeed(): number {
    return TANK.maxTrackSpeed * this.speedScale;
  }

  /**
   * Acceleration scales along with top speed, so raising the slider makes the
   * tank quicker rather than mushier: time to reach top speed stays the same.
   */
  setSpeedScale(scale: number): void {
    this.speedScale = Math.min(
      TANK.speedScaleMax,
      Math.max(TANK.speedScaleMin, scale),
    );
  }

  /** World position of the nozzle, where the flame jet originates. */
  nozzlePosition(target: Vector3): Vector3 {
    return target
      .copy(this.forward)
      .multiplyScalar(FLAME.nozzleOffset)
      .add(this.position)
      .setY(FLAME.nozzleHeight);
  }

  /** World position just behind the hull, where the fire trail is laid. */
  tailPosition(target: Vector3): Vector3 {
    return target
      .copy(this.forward)
      .multiplyScalar(-TANK.hullLength / 2)
      .add(this.position)
      .setY(0);
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  reset(): void {
    this.position.set(0, 0, 0);
    this.heading = 0;
    this.health = TANK.maxHealth;
    this.trackLeft = 0;
    this.trackRight = 0;
    this.speed = 0;
    this.yawRate = 0;
    this.lean.pitch = 0;
    this.lean.roll = 0;
    this.syncTransform();
  }

  update(command: DriveCommand, dt: number): void {
    const [targetLeft, targetRight] = this.resolveTrackTargets(command);

    this.trackLeft = this.approachTrackSpeed(this.trackLeft, targetLeft, dt);
    this.trackRight = this.approachTrackSpeed(this.trackRight, targetRight, dt);

    const previousSpeed = this.speed;
    this.speed = (this.trackLeft + this.trackRight) / 2;

    // Yaw follows the track difference, damped so direction changes carry inertia.
    const targetYawRate = (this.trackRight - this.trackLeft) / TANK.yawSeparation;
    this.yawRate += (targetYawRate - this.yawRate) * (1 - Math.exp(-TANK.yawLambda * dt));
    this.heading += this.yawRate * dt;

    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.position.addScaledVector(this.forward, this.speed * dt);
    this.clampToArena();

    this.updateLean(previousSpeed, dt);
    this.syncTransform();
  }

  /**
   * Maps the stick to per-track targets. Pure lateral deflection makes the
   * tracks counter-rotate, which is what produces the pivot turn on the spot.
   */
  private resolveTrackTargets(command: DriveCommand): [number, number] {
    let left = command.throttle + command.steer * TANK.turnAuthority;
    let right = command.throttle - command.steer * TANK.turnAuthority;

    const peak = Math.max(Math.abs(left), Math.abs(right));
    if (peak > 1) {
      left /= peak;
      right /= peak;
    }

    return [this.scaleTrackTarget(left), this.scaleTrackTarget(right)];
  }

  private scaleTrackTarget(normalized: number): number {
    const limit = normalized >= 0 ? this.topSpeed : this.topSpeed * TANK.reverseFactor;
    return normalized * limit;
  }

  private approachTrackSpeed(current: number, target: number, dt: number): number {
    // Building up speed is slow; shedding it is quicker, which reads as mass.
    const speedingUp =
      Math.abs(target) > Math.abs(current) && Math.sign(target) === Math.sign(current);
    const rate = (speedingUp || current === 0 ? TANK.trackAccel : TANK.trackDecel) * this.speedScale;
    const maxDelta = rate * dt;
    const delta = target - current;

    return Math.abs(delta) <= maxDelta ? target : current + Math.sign(delta) * maxDelta;
  }

  private updateLean(previousSpeed: number, dt: number): void {
    const acceleration = (this.speed - previousSpeed) / Math.max(dt, 1e-4);
    const targetPitch = -acceleration * TANK.pitchPerAccel;
    const targetRoll = this.yawRate * TANK.rollPerYaw;
    const t = 1 - Math.exp(-TANK.leanLambda * dt);

    this.lean.pitch += (targetPitch - this.lean.pitch) * t;
    this.lean.roll += (targetRoll - this.lean.roll) * t;
  }

  private clampToArena(): void {
    const limit = ARENA.halfSize - TANK.radius;
    const clampedX = Math.min(limit, Math.max(-limit, this.position.x));
    const clampedZ = Math.min(limit, Math.max(-limit, this.position.z));

    // Bleed off track speed when the hull grinds against a wall.
    if (clampedX !== this.position.x || clampedZ !== this.position.z) {
      this.trackLeft *= 0.4;
      this.trackRight *= 0.4;
      this.position.x = clampedX;
      this.position.z = clampedZ;
    }
  }

  private syncTransform(): void {
    this.root.position.copy(this.position);
    this.root.rotation.y = snapFacing(this.heading, this.facings);
    this.body.rotation.x = this.lean.pitch;
    this.body.rotation.z = this.lean.roll;
  }
}

function buildHull(): Group {
  const body = new Group();

  const hullMaterial = makeBandedMaterial(RAMPS.hull);
  const trackMaterial = makeBandedMaterial(RAMPS.steel);
  const turretMaterial = makeBandedMaterial(RAMPS.deck);
  const barrelMaterial = makeBandedMaterial(RAMPS.steel);

  const hull = new Mesh(
    new BoxGeometry(TANK.hullWidth, TANK.hullHeight, TANK.hullLength),
    hullMaterial,
  );
  hull.position.y = TANK.hullHeight / 2 + 0.42;
  body.add(hull);

  // Raised superstructure the turret sits on; keeps the silhouette readable
  // from the isometric angle without floating parts.
  const deck = new Mesh(
    new BoxGeometry(TANK.hullWidth * 0.86, 0.42, TANK.hullLength * 0.55),
    hullMaterial,
  );
  deck.position.set(0, TANK.hullHeight + 0.42 + 0.21, -0.2);
  body.add(deck);

  const trackGeometry = new BoxGeometry(0.78, 0.88, TANK.hullLength + 0.5);
  for (const side of [-1, 1]) {
    const track = new Mesh(trackGeometry, trackMaterial);
    track.position.set(side * (TANK.hullWidth / 2 + 0.1), 0.44, 0);
    body.add(track);
  }

  const turret = new Mesh(new CylinderGeometry(1.05, 1.22, 0.85, 14), turretMaterial);
  turret.position.set(0, TANK.hullHeight + 0.85, -0.25);
  body.add(turret);

  // Short, thick projector rather than a cannon barrel.
  const projector = new Mesh(new CylinderGeometry(0.21, 0.25, 2.3, 10), barrelMaterial);
  projector.rotation.x = Math.PI / 2;
  projector.position.set(0, TANK.hullHeight + 0.9, 1.6);
  body.add(projector);

  const nozzle = new Mesh(new CylinderGeometry(0.42, 0.24, 0.62, 12), barrelMaterial);
  nozzle.rotation.x = -Math.PI / 2;
  nozzle.position.set(0, TANK.hullHeight + 0.9, 3.05);
  body.add(nozzle);

  // Fuel drums on the rear deck, so the silhouette reads as a flame tank.
  const drumGeometry = new CylinderGeometry(0.42, 0.42, 1.9, 10);
  for (const side of [-1, 1]) {
    const drum = new Mesh(drumGeometry, barrelMaterial);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(side * 0.72, TANK.hullHeight + 0.95, -1.85);
    body.add(drum);
  }

  finishBody(body);
  return body;
}

/**
 * Flat regions of colour with no value break between them merge into each
 * other and the silhouette dissolves, so every form gets a contour.
 *
 * Because the scene is nothing but procedural primitives, the creases are known
 * analytically: EdgesGeometry finds them once and they draw as real GL lines.
 * WebGL clamps line width to one pixel, which is exactly the requirement here -
 * always one texel, never two, never flickering, because it is geometry rather
 * than a threshold on a continuous quantity.
 */
function finishBody(root: Object3D): void {
  const inkMaterial = new LineBasicMaterial({ color: INK, toneMapped: false });
  const meshes: Mesh[] = [];

  root.traverse((child) => {
    if (child instanceof Mesh) meshes.push(child);
  });

  for (const mesh of meshes) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // The surfaces carry a polygon offset, so the lines need no nudge of their
    // own - which matters, since a local nudge would rotate with the hull.
    const outline = new LineSegments(new EdgesGeometry(mesh.geometry, 24), inkMaterial);
    outline.renderOrder = 1;
    mesh.add(outline);
  }
}
