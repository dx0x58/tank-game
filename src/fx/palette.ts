import { Color, SRGBColorSpace } from 'three';

/**
 * A material's whole appearance: three flat colours selected by which side of
 * the light a facet is on, plus a fourth for facets standing in a cast shadow.
 *
 * Shadows rotate towards blue and violet and drop hard in value; lit faces
 * rotate towards yellow and desaturate a little. That hue rotation is the
 * difference between art and a darkened render - multiplying one colour by 0.4
 * keeps the hue and always reads as 3D shading turned down.
 */
export interface Ramp {
  shadow: string;
  base: string;
  lit: string;
  cast?: string;
}

export const RAMPS = {
  ground: { shadow: '#37445c', base: '#46566d', lit: '#57697e', cast: '#252e47' },
  plate: { shadow: '#28324b', base: '#3e4d63', lit: '#4f6076', cast: '#212940' },
  wall: { shadow: '#1b2338', base: '#2f3b4f', lit: '#414f64', cast: '#161c2e' },

  hull: { shadow: '#333f42', base: '#5c7046', lit: '#87995a', cast: '#2b3540' },
  deck: { shadow: '#39463f', base: '#67794c', lit: '#93a463', cast: '#2f3a3c' },
  steel: { shadow: '#191d2b', base: '#2f3641', lit: '#4a5361', cast: '#141828' },

  enemy: { shadow: '#4a1f3d', base: '#9c3341', lit: '#c95b4a', cast: '#3d1a35' },
  debris: { shadow: '#4a1f3d', base: '#8d3a3a', lit: '#b35a45', cast: '#3d1a35' },
} as const satisfies Record<string, Ramp>;

/** Unlit colours the effects draw with, kept in the palette so fire survives the snap. */
export const EFFECT_COLORS = [
  '#fff2b0',
  '#ffd27a',
  '#ffae24',
  '#ff7a1e',
  '#ff3606',
  '#8c2415',
  '#2a0d08',
  '#0b0e14',
  '#000000',
  '#ffffff',
];

/** Ink used for outlines: near black with a cold cast, never pure black. */
export const INK = '#12172a';

/**
 * Every colour the renderer is allowed to emit, in display space, ready to be
 * uploaded as a uniform array. Building it from the ramps rather than picking
 * it separately is what makes the palette snap agree with the shading instead
 * of fighting it.
 */
export function buildPalette(): number[] {
  const hexes = new Set<string>([INK, ...EFFECT_COLORS]);

  for (const ramp of Object.values(RAMPS) as Ramp[]) {
    hexes.add(ramp.shadow);
    hexes.add(ramp.base);
    hexes.add(ramp.lit);
    if (ramp.cast) hexes.add(ramp.cast);
  }

  const colour = new Color();
  const display = { r: 0, g: 0, b: 0 };
  const flat: number[] = [];

  for (const hex of hexes) {
    colour.set(hex).getRGB(display, SRGBColorSpace);
    flat.push(display.r, display.g, display.b);
  }

  return flat;
}

export const PALETTE_MAX = 64;
