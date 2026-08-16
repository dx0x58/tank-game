/**
 * Central tuning table. One unit equals roughly one metre.
 * Everything that shapes game feel lives here so it can be tuned in one place.
 */

export const ARENA = {
  /** Half-extent of the playable square. */
  halfSize: 58,
  wallHeight: 2.6,
  wallThickness: 1.4,
  groundColor: 0x3c4759,
  gridColor: 0x6a87a8,
};

/**
 * Makes the 3D scene read as pre-rendered 2D sprite art, the way Diablo II's
 * models were baked down to a low resolution indexed palette.
 */
export const SPRITE = {
  enabledByDefault: true,
  /** Vertical resolution the scene is rendered at before being upscaled. */
  renderHeight: 288,
  /** Colour steps per channel after quantisation. */
  colorLevels: 12,
  /** Ordered dither strength, in units of one colour step. */
  ditherStrength: 0.7,
  /** Distinct facings a body may show, as a pre-rendered sprite set had. */
  facings: 16,
};

export const CAMERA = {
  /**
   * World units covered by the shorter screen axis. Driving the frustum from
   * the short side keeps the tank the same relative size in landscape and in
   * portrait instead of zooming in hard on a phone held upright.
   */
  minSpan: 32,
  /** Direction the camera sits in, relative to its target. Diablo II style pitch. */
  offset: { x: 26, y: 30, z: 26 },
  near: 0.1,
  far: 260,
  /** Higher means the camera catches up with the tank faster. */
  followLambda: 6,
  shakeDecay: 7.5,
  shakeMax: 0.85,
};

export const TANK = {
  maxHealth: 100,
  hullLength: 5.2,
  hullWidth: 3.0,
  hullHeight: 1.15,
  /** Collision radius used against enemies and walls. */
  radius: 2.8,

  /** Top speed of a single track when driving forward. */
  maxTrackSpeed: 10.2,
  /** Reverse is slower, as on a real tank. */
  reverseFactor: 0.55,
  /** How much of the stick's lateral axis is mixed into the track difference. */
  turnAuthority: 0.62,

  /**
   * Steering follows the direction of travel, so it flips once the tank is
   * actually rolling backwards: pushing the stick right curves the tank right
   * on screen instead of swinging the nose right and the tail left. From an
   * isometric camera the hull-relative alternative is close to unreadable.
   */
  invertSteerInReverse: true,
  /** Reverse speed below which steering stays direct, to avoid flapping at a standstill. */
  reverseThreshold: 0.5,

  /** Bounds of the HUD speed slider, as a multiplier of maxTrackSpeed. */
  speedScaleMin: 0.4,
  speedScaleMax: 2,

  /** Track speed change limits. Low values are what make the hull feel heavy. */
  trackAccel: 6.0,
  trackDecel: 11.0,

  /**
   * Effective track separation for yaw. Larger than the physical width because
   * tracks slip sideways when the hull pivots; this is the main knob for how
   * sluggish turning feels.
   */
  yawSeparation: 8.6,
  /** Yaw rate is damped towards the differential target instead of snapping. */
  yawLambda: 7.0,

  /** Cosmetic body lean under acceleration and turning. */
  pitchPerAccel: 0.012,
  rollPerYaw: 0.10,
  leanLambda: 6,

  /**
   * Seconds of immunity after a hit. Without it, damage scales with how many
   * bodies happen to touch the hull at once and a dense swarm kills instantly.
   */
  damageGrace: 0.5,
};

/** Hull-mounted flamethrower. It is always burning; there is no fire input. */
export const FLAME = {
  /** Reach of the jet, in metres. */
  range: 11,
  /** Half-angle of the damage cone at the nozzle, in radians. */
  halfAngle: 0.4,
  damagePerSecond: 10,
  /** Damage multiplier at maximum range; full damage up close. */
  falloffAtRange: 0.6,

  nozzleOffset: 3.5,
  nozzleHeight: 1.35,

  particlesPerSecond: 130,
  particleLife: 0.7,
  /**
   * Speed and drag are chosen together so the jet dies out right at `range`:
   * a particle covers `speed * (1 - e^(-drag * life)) / drag` metres.
   */
  particleSpeed: 26,
  /** Lateral scatter of the jet, in radians. */
  spread: 0.2,
  /** Air drag and buoyancy applied to the flame cloud. */
  drag: 1.6,
  buoyancy: 3.4,
  poolSize: 240,
  startScale: 0.35,
  endScale: 2.2,

  lightIntensity: 30,
  /** Continuous rumble while the flamer runs, per second. */
  shakePerSecond: 0.9,
};

/**
 * How the stick is interpreted. In `screen` mode the stick names a direction on
 * screen and the tank works out whether to drive at it or back towards it,
 * which is the camera-relative scheme modern fixed-camera games settled on.
 * `tank` mode is the classic hull-relative scheme kept for comparison.
 */
export const STEERING = {
  defaultMode: 'screen' as 'screen' | 'tank',
  /** Heading error at which steering is already hard over. */
  fullSteerAngle: 0.6,
  /** Switch to reverse once the target is this far behind the nose... */
  enterReverseAngle: 1.92,
  /** ...and back to forward only below this, so the choice cannot chatter. */
  enterForwardAngle: 1.22,
  /** Throttle floor when the tank is turning hard, so it pivots rather than stalls. */
  minThrottleWhileTurning: 0.15,
};

/**
 * Burning trail the tank lays behind itself. It exists to deal with the part of
 * the swarm the forward-facing flamer cannot reach: whatever chases the hull
 * has to cross the fire.
 */
export const FIRE_TRAIL = {
  /** How far the trail reaches back, measured in hull lengths. */
  lengthInHulls: 10,
  /** Distance the tank travels between two patches. */
  spacing: 1.1,
  radius: 1.6,
  /** Weaker than the jet: this is area denial, not the main weapon. */
  damagePerSecond: 5,
  /** Comfortably above the count needed to cover the trail at top speed. */
  poolSize: 72,
  startScale: 1.15,
  endScale: 0.4,
  flatness: 0.34,
  hoverHeight: 0.22,
};

export const ENEMY = {
  radius: 0.95,
  height: 1.9,
  // Burned down continuously rather than shot, so health is a small pool that
  // the flame drains in about half a second.
  health: 3,
  // Slower than the tank at full throttle, but fast enough that a clumsy turn
  // lets the swarm close the gap.
  minSpeed: 4.6,
  maxSpeed: 6.4,
  /** Acceleration towards the desired heading; keeps the swarm from snapping. */
  steerLambda: 3.4,
  separationRadius: 2.4,
  separationStrength: 6.0,
  contactDamage: 7,
  /** Per-enemy cooldown between contact hits. */
  contactCooldown: 1.1,
  maxAlive: 90,
  spawnDistanceMin: 38,
  spawnDistanceMax: 50,
  /** Spawn interval eases from the first value to the second over rampDuration. */
  spawnIntervalStart: 1.5,
  spawnIntervalEnd: 0.34,
  rampDuration: 150,
  scorePerKill: 10,
};

export const EFFECTS = {
  debrisPoolSize: 120,
  debrisPerKill: 6,
  debrisLife: 0.9,
  debrisGravity: 22,
  shakeOnDamage: 0.5,
};
