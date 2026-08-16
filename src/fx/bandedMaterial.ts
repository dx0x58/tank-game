import { Color, MeshStandardMaterial } from 'three';
import type { Ramp } from './palette';

/**
 * Flat, banded shading.
 *
 * The previous look quantised the *image*: a smooth Lambert render was
 * posterised in post. That cannot produce flat colour regions, because the band
 * boundaries are level sets of screen luminance - they sit in different places
 * on identical objects and slide across a surface as it moves. Quantising the
 * *lighting* instead pins each boundary to the geometry, which is what reads as
 * drawn rather than rendered.
 *
 * The result is written over three.js's own accumulation at the end of the
 * light loop, which keeps shadow receiving, flat normals and all the uniform
 * plumbing of MeshStandardMaterial while discarding its gradients.
 */

const BAND_UNIFORMS = /* glsl */ `
uniform vec3 uShadow;
uniform vec3 uBase;
uniform vec3 uLit;
uniform vec3 uCast;
uniform float uCut0;
uniform float uCut1;

#ifdef WORLD_PATTERN
varying vec3 vBandWorldPos;

float bandHash(vec2 p) {
  return fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453);
}
#endif
`;

const PATTERN_VERTEX = /* glsl */ `
#include <begin_vertex>
#ifdef WORLD_PATTERN
  vBandWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`;

const PATTERN_VERTEX_DECL = /* glsl */ `
#include <common>
#ifdef WORLD_PATTERN
varying vec3 vBandWorldPos;
#endif
`;

const BAND_BODY = /* glsl */ `
#include <lights_fragment_end>

#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
{
  vec3 bandNormal = normalize( geometryNormal );
  // directionalLights[ 0 ].direction is view space, pointing surface -> light.
  float ndl = dot( bandNormal, normalize( directionalLights[ 0 ].direction ) );

  float lit = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    lit = step( 0.5, getShadow(
      directionalShadowMap[ 0 ],
      directionalLightShadows[ 0 ].shadowMapSize,
      directionalLightShadows[ 0 ].shadowIntensity,
      directionalLightShadows[ 0 ].shadowBias,
      directionalLightShadows[ 0 ].shadowRadius,
      vDirectionalShadowCoord[ 0 ] ) );
  #endif

  vec3 banded = ( ndl > uCut1 ) ? uLit : ( ( ndl > uCut0 ) ? uBase : uShadow );

  #ifdef WORLD_PATTERN
    // A plane has one normal, so lighting alone paints it a single flat colour
    // across the whole screen: no texture, and nothing for the eye to hold on to
    // while the tank moves. Two frequencies of world-space noise break it into
    // patches. World space, not screen space, so the ground stays put.
    float patches = bandHash( vBandWorldPos.xz / 5.5 ) * 0.65
                  + bandHash( vBandWorldPos.xz / 1.7 + 31.0 ) * 0.35;
    banded = ( patches > 0.70 ) ? uLit : ( ( patches < 0.28 ) ? uShadow : uBase );
  #endif

  // A facet that faces the light but stands in a cast shadow gets its own entry
  // rather than simply reusing the unlit side.
  banded = ( lit < 0.5 && ndl > uCut0 ) ? uCast : banded;

  reflectedLight.directDiffuse = banded;
  reflectedLight.indirectDiffuse = vec3( 0.0 );
  reflectedLight.directSpecular = vec3( 0.0 );
  reflectedLight.indirectSpecular = vec3( 0.0 );
}
#endif
`;

/** A silent no-op is the usual way this technique "doesn't work". */
function replaceOrThrow(source: string, find: string, replacement: string): string {
  if (!source.includes(find)) {
    throw new Error(`bandedMaterial: shader chunk not found: ${find}`);
  }
  return source.replace(find, replacement);
}

export interface BandedOptions {
  /** Break large flat surfaces into world-space patches; for the ground. */
  worldPattern?: boolean;
}

export function makeBandedMaterial(
  ramp: Ramp,
  options: BandedOptions = {},
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    // Each facet then evaluates the band once and becomes genuinely one colour.
    flatShading: true,
    // Push filled surfaces back a hair so outline lines drawn on them win the
    // depth test from every angle, without moving the lines themselves.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  material.onBeforeCompile = (shader) => {
    if (options.worldPattern) {
      shader.vertexShader = replaceOrThrow(
        shader.vertexShader,
        '#include <common>',
        PATTERN_VERTEX_DECL,
      );
      shader.vertexShader = replaceOrThrow(
        shader.vertexShader,
        '#include <begin_vertex>',
        PATTERN_VERTEX,
      );
      shader.defines = { ...shader.defines, WORLD_PATTERN: '' };
    }

    shader.uniforms.uShadow = { value: new Color(ramp.shadow) };
    shader.uniforms.uBase = { value: new Color(ramp.base) };
    shader.uniforms.uLit = { value: new Color(ramp.lit) };
    shader.uniforms.uCast = { value: new Color(ramp.cast ?? ramp.shadow) };
    shader.uniforms.uCut0 = { value: 0.08 };
    shader.uniforms.uCut1 = { value: 0.55 };

    shader.fragmentShader = replaceOrThrow(
      shader.fragmentShader,
      '#include <common>',
      `#include <common>\n${BAND_UNIFORMS}`,
    );
    shader.fragmentShader = replaceOrThrow(
      shader.fragmentShader,
      '#include <lights_fragment_end>',
      BAND_BODY,
    );
  };

  // Without this three.js may hand these materials a program compiled for an
  // unpatched MeshStandardMaterial.
  material.customProgramCacheKey = () =>
    options.worldPattern ? 'banded-v1-pattern' : 'banded-v1';

  return material;
}
