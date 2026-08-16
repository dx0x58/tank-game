import { DirectionalLight, Object3D, Scene, Vector3 } from 'three';
import { isCoarsePointer } from '../core/renderer';

const SHADOW_EXTENT = 42;
const LIGHT_OFFSET = new Vector3(-28, 46, 20);

/**
 * Key light rides along with the tank so the shadow map stays small and sharp
 * instead of trying to cover the whole arena.
 */
export class Lighting {
  private readonly keyLight: DirectionalLight;
  private readonly lightTarget = new Object3D();

  constructor(scene: Scene) {
    // No hemisphere fill. Its irradiance is mix(ground, sky, 0.5*dotNL + 0.5),
    // a smooth normal-dependent gradient that would reappear inside every flat
    // band. The shadow entry of each ramp is the ambient now.
    this.keyLight = new DirectionalLight(0xffffff, 1);
    this.keyLight.position.copy(LIGHT_OFFSET);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(
      isCoarsePointer() ? 1024 : 2048,
      isCoarsePointer() ? 1024 : 2048,
    );
    this.keyLight.shadow.camera.left = -SHADOW_EXTENT;
    this.keyLight.shadow.camera.right = SHADOW_EXTENT;
    this.keyLight.shadow.camera.top = SHADOW_EXTENT;
    this.keyLight.shadow.camera.bottom = -SHADOW_EXTENT;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 140;
    // Retuned for BasicShadowMap, whose single tap shows acne that PCF hid.
    this.keyLight.shadow.bias = -0.0012;
    this.keyLight.shadow.normalBias = 0.08;
    this.keyLight.target = this.lightTarget;

    scene.add(this.keyLight);
    scene.add(this.lightTarget);
  }

  follow(position: Vector3): void {
    this.lightTarget.position.set(position.x, 0, position.z);
    this.lightTarget.updateMatrixWorld();
    this.keyLight.position.copy(this.lightTarget.position).add(LIGHT_OFFSET);
  }
}
