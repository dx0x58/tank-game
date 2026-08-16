import { DirectionalLight, HemisphereLight, Object3D, Scene, Vector3 } from 'three';
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
    scene.add(new HemisphereLight(0xbcd8ff, 0x2c3648, 2.6));

    this.keyLight = new DirectionalLight(0xfff0d8, 3.4);
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
    this.keyLight.shadow.bias = -0.0006;
    this.keyLight.shadow.normalBias = 0.03;
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
