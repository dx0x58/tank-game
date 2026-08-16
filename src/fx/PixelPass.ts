import {
  LinearSRGBColorSpace,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type WebGLRenderer,
} from 'three';
import { SPRITE } from '../config';

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
  uniform sampler2D tScene;
  uniform vec2 uResolution;
  uniform float uLevels;
  uniform float uDither;
  uniform float uExposure;
  varying vec2 vUv;

  // three.js's own ACES filmic curve, matrices and exposure scaling included,
  // so the sprite look grades identically to the unfiltered render.
  vec3 rrtAndOdtFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }

  vec3 tonemap(vec3 colour) {
    const mat3 inputMat = mat3(
      vec3(0.59719, 0.07600, 0.02840),
      vec3(0.35458, 0.90834, 0.13383),
      vec3(0.04823, 0.01566, 0.83777)
    );
    const mat3 outputMat = mat3(
      vec3( 1.60475, -0.10208, -0.00327),
      vec3(-0.53108,  1.10813, -0.07276),
      vec3(-0.07367, -0.00605,  1.07602)
    );

    colour *= uExposure / 0.6;
    colour = inputMat * colour;
    colour = rrtAndOdtFit(colour);
    colour = outputMat * colour;
    return clamp(colour, 0.0, 1.0);
  }

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
    vec3 colour = linearToSrgb(tonemap(texture2D(tScene, vUv).rgb));

    // Nudge each pixel up or down by a fraction of one colour step before
    // snapping, so gradients break into a pattern instead of hard bands.
    float threshold = bayer4(floor(vUv * uResolution)) - 0.5;
    colour += threshold * uDither / uLevels;

    colour = floor(colour * uLevels + 0.5) / uLevels;
    gl_FragColor = vec4(clamp(colour, 0.0, 1.0), 1.0);
  }
`;

/**
 * Renders the scene into a small buffer and blows it up with nearest-neighbour
 * sampling, then quantises the colours with an ordered dither. Low resolution
 * plus a short palette is what reads as sprite work rather than 3D.
 */
export class PixelPass {
  readonly target: WebGLRenderTarget;

  private readonly quadScene = new Scene();
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: ShaderMaterial;
  private width = 1;
  private height = 1;

  constructor(exposure: number) {
    this.target = new WebGLRenderTarget(1, 1, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.target.texture.colorSpace = LinearSRGBColorSpace;
    this.target.texture.generateMipmaps = false;

    this.material = new ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture },
        uResolution: { value: new Vector2(1, 1) },
        uLevels: { value: SPRITE.colorLevels },
        uDither: { value: SPRITE.ditherStrength },
        uExposure: { value: exposure },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });

    this.quadScene.add(new Mesh(new PlaneGeometry(2, 2), this.material));
  }

  /** Buffer size in pixels; the caller needs it to align the camera to texels. */
  get resolution(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  setSize(viewWidth: number, viewHeight: number): void {
    this.height = Math.max(1, Math.round(SPRITE.renderHeight));
    // Keep pixels square by deriving the width from the view's aspect ratio.
    this.width = Math.max(1, Math.round(this.height * (viewWidth / viewHeight)));

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
