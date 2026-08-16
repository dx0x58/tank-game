import { BasicShadowMap, NoToneMapping, SRGBColorSpace, WebGLRenderer } from 'three';

export const isCoarsePointer = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const coarse = isCoarsePointer();
  const renderer = new WebGLRenderer({
    canvas,
    antialias: !coarse,
    powerPreference: 'high-performance',
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  // The ramps are authored colours, not HDR. A filmic curve would remap them
  // before the palette could distinguish them, collapsing every lit face
  // towards a shared warm off-white.
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = true;
  // A penumbra is a sub-pixel gradient no sprite artist ever draws, and at this
  // resolution it survives as a crawling grey fringe.
  renderer.shadowMap.type = BasicShadowMap;

  return renderer;
}
