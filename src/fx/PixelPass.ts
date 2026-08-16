import {
  LinearSRGBColorSpace,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type WebGLRenderer,
} from 'three';
import { SPRITE } from '../config';
import { buildPalette, PALETTE_MAX } from './palette';

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * The scene arrives linear and untonemapped, because three.js skips tone
 * mapping when drawing into a render target. Tone mapping and the transfer
 * function are therefore done here, before quantisation, so that the colour
 * steps land where the eye sees them rather than in linear light.
 */
const fragmentShader = /* glsl */ `
  #define PALETTE_MAX ${PALETTE_MAX}

  uniform sampler2D tScene;
  uniform vec3 uPalette[ PALETTE_MAX ];
  uniform int uPaletteCount;
  uniform float uDither;
  uniform vec2 uResolution;
  varying vec2 vUv;

  vec3 linearToSrgb(vec3 c) {
    return mix(1.055 * pow(c, vec3(0.4166667)) - 0.055, c * 12.92, step(c, vec3(0.0031308)));
  }

  // Closed-form 4x4 Bayer matrix: no array indexing, 16 evenly spaced levels.
  float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x * 0.5 + a.y * a.y * 0.75);
  }

  float bayer4(vec2 a) {
    return bayer2(0.5 * a) * 0.25 + bayer2(a);
  }

  void main() {
    vec3 colour = clamp(linearToSrgb(texture2D(tScene, vUv).rgb), 0.0, 1.0);

    // Only edge and blend pixels have anything left to dither: the shading is
    // already flat and already on-palette.
    if (uDither > 0.0) {
      colour += (bayer4(floor(vUv * uResolution)) - 0.5) * uDither;
    }

    // Nearest entry of an authored palette, not a per-channel lattice. Channels
    // crossing their own thresholds independently is what made shaded surfaces
    // drift in hue and read as a damaged photograph.
    int best = 0;
    float bestDistance = 1e9;
    for (int i = 0; i < PALETTE_MAX; i += 1) {
      if (i >= uPaletteCount) break;
      vec3 delta = (colour - uPalette[i]) * vec3(1.5, 1.0, 1.0);
      float distance = dot(delta, delta);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }

    gl_FragColor = vec4(uPalette[best], 1.0);
  }
`;

/**
 * Renders the scene into a small buffer and blows it up with nearest-neighbour
 * sampling, then snaps every pixel to the authored palette. The shading is
 * already flat by the time it gets here; this stage supplies the pixel grid and
 * keeps stray blend colours out of the palette.
 */
export class PixelPass {
  readonly target: WebGLRenderTarget;

  private readonly quadScene = new Scene();
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: ShaderMaterial;
  private width = 1;
  private height = 1;

  constructor() {
    this.target = new WebGLRenderTarget(1, 1, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
    });
    this.target.texture.colorSpace = LinearSRGBColorSpace;
    this.target.texture.generateMipmaps = false;

    const palette = buildPalette();
    const entries: Vector3[] = [];
    for (let i = 0; i < PALETTE_MAX; i += 1) {
      const at = i * 3;
      entries.push(
        at + 2 < palette.length
          ? new Vector3(palette[at], palette[at + 1], palette[at + 2])
          : new Vector3(),
      );
    }

    this.material = new ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture },
        uPalette: { value: entries },
        uPaletteCount: { value: Math.min(PALETTE_MAX, palette.length / 3) },
        uDither: { value: SPRITE.ditherStrength },
        uResolution: { value: new Vector2(1, 1) },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    // Nothing else should touch the colours after the palette has chosen them.
    this.material.toneMapped = false;

    this.quadScene.add(new Mesh(new PlaneGeometry(2, 2), this.material));
  }

  /** Buffer size in pixels; the caller needs it to align the camera to texels. */
  get resolution(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * The upscale factor has to be a whole number. At a fractional ratio some
   * source texels land on four screen pixels and their neighbours on three, so
   * the pixel grid is visibly uneven and no amount of shading work can hide it.
   */
  setSize(viewWidth: number, viewHeight: number): void {
    const scale = Math.max(1, Math.floor(viewHeight / SPRITE.renderHeight));
    this.height = Math.max(1, Math.floor(viewHeight / scale));
    this.width = Math.max(1, Math.floor(viewWidth / scale));

    this.target.setSize(this.width, this.height);
    this.material.uniforms.uResolution!.value.set(this.width, this.height);
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: Camera): void {
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCamera);
  }
}

/** Quantises a heading to the nearest of `steps` facings; 0 leaves it alone. */
export function snapFacing(angle: number, steps: number): number {
  if (steps <= 0) return angle;
  const step = (Math.PI * 2) / steps;
  return Math.round(angle / step) * step;
}
