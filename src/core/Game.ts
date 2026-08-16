import { Scene, Vector3, type WebGLRenderer } from 'three';
import { CAMERA, EFFECTS, ENEMY, FLAME, TANK } from '../config';
import { EnemySwarm } from '../entities/EnemySwarm';
import { FireTrail } from '../entities/FireTrail';
import { Flamethrower } from '../entities/Flamethrower';
import { Tank } from '../entities/Tank';
import { Effects } from '../fx/Effects';
import { InputManager } from '../input/InputManager';
import { resolveCombat } from '../systems/Combat';
import { Steering } from '../systems/Steering';
import { Hud } from '../ui/Hud';
import { buildArena } from '../world/Arena';
import { Lighting } from '../world/Lighting';
import { IsometricCamera } from './IsometricCamera';
import { createRenderer, isCoarsePointer } from './renderer';

/** Longest simulated step; protects the physics when a tab regains focus. */
const MAX_STEP = 0.05;

/** The flamer needs no input, so the control hint is dismissed on a timer. */
const HINT_DURATION = 5;

export class Game {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly view: IsometricCamera;
  private readonly lighting: Lighting;
  private readonly hud = new Hud(isCoarsePointer());
  private readonly input: InputManager;

  private readonly steering = new Steering();
  private readonly tank = new Tank();
  private readonly swarm = new EnemySwarm();
  private readonly flame = new Flamethrower();
  private readonly trail = new FireTrail();
  private readonly effects = new Effects();

  private readonly nozzle = new Vector3();
  private readonly tail = new Vector3();
  private running = true;
  private fireEnabled = true;
  private score = 0;
  private elapsed = 0;
  private damageGrace = 0;
  private lastFrameTime = 0;

  constructor(canvas: HTMLCanvasElement, surface: HTMLElement) {
    this.renderer = createRenderer(canvas);
    this.view = new IsometricCamera(window.innerWidth / window.innerHeight);
    this.lighting = new Lighting(this.scene);
    this.input = new InputManager(surface);

    buildArena(this.scene);
    this.scene.add(
      this.tank.root,
      this.swarm.group,
      this.flame.group,
      this.trail.group,
      this.effects.group,
    );

    this.view.snapTo(this.tank.position);
    this.hud.onRestart(() => this.restart());
    this.hud.onToggleEnemies((enabled) => this.swarm.setEnabled(enabled));
    this.hud.onToggleFire((enabled) => {
      this.fireEnabled = enabled;
    });
    this.hud.setEnemiesEnabled(this.swarm.isEnabled);
    this.hud.setFireEnabled(this.fireEnabled);
    this.hud.onToggleSteering((screenRelative) => {
      this.steering.mode = screenRelative ? 'screen' : 'tank';
      this.steering.reset();
    });
    this.hud.setScreenSteering(this.steering.mode === 'screen');
    this.hud.configureSpeedSlider(TANK.speedScaleMin, TANK.speedScaleMax);
    this.hud.onSpeedChange((scale) => this.tank.setSpeedScale(scale));
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.refreshHud();
  }

  start(): void {
    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(MAX_STEP, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    this.input.update();
    this.hud.setStick(this.input.state.steer, this.input.state.throttle, this.input.state.stickActive);

    if (this.running) this.simulate(dt);

    // These run outside the simulation gate so the fire burns out after the
    // tank dies, or after the player switches it off, rather than vanishing.
    const burning = this.running && this.fireEnabled;
    this.tank.nozzlePosition(this.nozzle);
    this.tank.tailPosition(this.tail);
    this.flame.update(dt, this.nozzle, this.tank.forward, burning);
    this.trail.update(dt, this.tail, burning, this.tank.topSpeed);
    this.effects.update(dt);
    this.view.update(this.tank.position, dt);
    this.lighting.follow(this.tank.position);
    this.renderer.render(this.scene, this.view.camera);

    requestAnimationFrame(this.frame);
  };

  private simulate(dt: number): void {
    this.elapsed += dt;
    this.damageGrace = Math.max(0, this.damageGrace - dt);

    const command = this.steering.command(
      this.input.state,
      this.tank.heading,
      this.tank.travelSpeed,
    );
    this.tank.update(command, dt);
    this.swarm.update(dt, this.tank.position);
    if (this.fireEnabled) this.view.addShake(FLAME.shakePerSecond * dt);
    if (this.elapsed > HINT_DURATION) this.hud.dismissFireHint();

    const combat = resolveCombat({
      tank: this.tank,
      swarm: this.swarm,
      trail: this.trail,
      effects: this.effects,
      dt,
      flameActive: this.fireEnabled,
    });

    if (combat.kills > 0) {
      this.score += combat.kills * ENEMY.scorePerKill;
      this.hud.setScore(this.score);
    }

    if (combat.damageTaken > 0 && this.damageGrace === 0) {
      this.damageGrace = TANK.damageGrace;
      this.tank.takeDamage(combat.damageTaken);
      this.view.addShake(EFFECTS.shakeOnDamage);
      this.hud.setHealth(this.tank.health, TANK.maxHealth);
      this.hud.flashDamage();
      if (!this.tank.isAlive) this.endRun();
    }

    this.hud.setTime(this.elapsed);
  }

  private endRun(): void {
    this.running = false;
    this.effects.burst(this.tank.position, 14);
    this.view.addShake(CAMERA.shakeMax);
    this.hud.showGameOver(this.score, this.elapsed);
  }

  private restart(): void {
    this.score = 0;
    this.elapsed = 0;
    this.damageGrace = 0;
    this.tank.reset();
    this.swarm.reset();
    this.flame.reset();
    this.trail.reset();
    this.effects.reset();
    this.view.snapTo(this.tank.position);
    this.hud.hideGameOver();
    this.refreshHud();
    this.running = true;
  }

  private refreshHud(): void {
    this.hud.setHealth(this.tank.health, TANK.maxHealth);
    this.hud.setScore(this.score);
    this.hud.setTime(this.elapsed);
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.view.setAspect(width / height);
  }
}
