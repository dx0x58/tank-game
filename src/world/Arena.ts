import { BoxGeometry, Color, Group, Mesh, PlaneGeometry, Scene } from 'three';
import { ARENA } from '../config';
import { makeBandedMaterial } from '../fx/bandedMaterial';
import { RAMPS } from '../fx/palette';

/** Deterministic pseudo-random so the decor layout is identical between runs. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function buildArena(scene: Scene): Group {
  const arena = new Group();
  const size = ARENA.halfSize * 2;

  // No fog: a distance gradient is exactly the kind of continuous ramp the
  // banded look exists to remove.
  scene.background = new Color(ARENA.skyColor);

  const ground = new Mesh(
    new PlaneGeometry(size, size),
    makeBandedMaterial(RAMPS.ground, { worldPattern: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  arena.add(ground);

  arena.add(buildWalls(size));
  arena.add(buildDecor());

  scene.add(arena);
  return arena;
}

function buildWalls(size: number): Group {
  const walls = new Group();
  const material = makeBandedMaterial(RAMPS.wall);
  const span = size + ARENA.wallThickness * 2;
  const longWall = new BoxGeometry(span, ARENA.wallHeight, ARENA.wallThickness);
  const sideWall = new BoxGeometry(ARENA.wallThickness, ARENA.wallHeight, span);
  const offset = ARENA.halfSize + ARENA.wallThickness / 2;

  const placements: Array<[typeof longWall, number, number]> = [
    [longWall, 0, -offset],
    [longWall, 0, offset],
    [sideWall, -offset, 0],
    [sideWall, offset, 0],
  ];

  for (const [geometry, x, z] of placements) {
    const wall = new Mesh(geometry, material);
    wall.position.set(x, ARENA.wallHeight / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    walls.add(wall);
  }

  return walls;
}

/** Flat painted plates: purely visual, they give the eye something to track while driving. */
function buildDecor(): Group {
  const decor = new Group();
  const random = seededRandom(20260816);
  const material = makeBandedMaterial(RAMPS.plate);
  const geometry = new BoxGeometry(1, 0.28, 1);
  const usable = ARENA.halfSize - 6;

  for (let i = 0; i < 46; i += 1) {
    const plate = new Mesh(geometry, material);
    plate.position.set(
      (random() * 2 - 1) * usable,
      0.14,
      (random() * 2 - 1) * usable,
    );
    plate.scale.set(3 + random() * 7, 1, 3 + random() * 7);
    plate.rotation.y = random() * Math.PI;
    plate.castShadow = true;
    plate.receiveShadow = true;
    decor.add(plate);
  }

  return decor;
}
