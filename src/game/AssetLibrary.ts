import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type AssetName =
  | 'nix-alien'
  | 'ari-scout'
  | 'guardian-drone'
  | 'mars-crawler'
  | 'signal-beacon'
  | 'frontier-outpost'
  | 'crash-portal'
  | 'xenite-cluster'
  | 'martian-rock'
  | 'wrecked-shuttle';

const ASSET_NAMES: readonly AssetName[] = [
  'nix-alien',
  'ari-scout',
  'guardian-drone',
  'mars-crawler',
  'signal-beacon',
  'frontier-outpost',
  'crash-portal',
  'xenite-cluster',
  'martian-rock',
  'wrecked-shuttle',
];

/** Loads the complete pack early, then provides cheap geometry-sharing clones. */
export class AssetLibrary {
  private readonly loader = new GLTFLoader();
  private readonly sources = new Map<AssetName, THREE.Group>();
  private loading: Promise<void> | null = null;

  public preload(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = Promise.allSettled(
      ASSET_NAMES.map(async (name) => {
        const gltf = await this.loader.loadAsync(`/models/${name}.glb`);
        gltf.scene.name = `${name}-source`;
        this.sources.set(name, gltf.scene);
      }),
    ).then(() => undefined);
    return this.loading;
  }

  public instantiate(name: AssetName, cloneMaterials = false): THREE.Group | null {
    const source = this.sources.get(name);
    if (!source) return null;
    const clone = source.clone(true);
    clone.name = `${name}-detail`;
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (cloneMaterials) {
        object.material = Array.isArray(object.material)
          ? object.material.map((material) => material.clone())
          : object.material.clone();
      }
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = true;
    });
    return clone;
  }
}
