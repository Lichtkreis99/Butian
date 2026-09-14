import * as THREE from "three";

import type { Cartesian } from "../lib/coordinates";
import { ECLIPTIC_TO_WORLD_GLSL, eclipticToWorld } from "../lib/coordinates";
import { healpixLandscapeTileCoordinates, healpixTileDirection } from "../lib/healpix";
import type { PlanetariumProjection } from "../lib/settings-store";
import { PLANETARIUM_PROJECTION_GLSL } from "./planetarium-shader";
import { landscapeDaylightForSunAltitude } from "../lib/ground-shading";

const GRID = 32;
const TILE_SIZE = 512;
const vertexShader = `
  ${ECLIPTIC_TO_WORLD_GLSL}
  ${PLANETARIUM_PROJECTION_GLSL}
  uniform vec3 origin;
  uniform vec3 center;
  uniform mat3 horizontalToEcliptic;
  varying vec2 vUv;
  void main() {
    vec3 direction = normalize(horizontalToEcliptic * position);
    vec3 world = eclipticToWorld(center + direction) - origin;
    vec4 cameraPosition = modelViewMatrix * vec4(world, 1.0);
    gl_Position = planetariumMode > 0.5 && planetariumProjection > 0.5
      ? planetariumProject(cameraPosition.xyz)
      : projectionMatrix * cameraPosition;
    vUv = uv;
  }
`;

const fragmentShader = `
  uniform sampler2D image;
  uniform float daylight;
  varying vec2 vUv;
  void main() {
    vec4 value = texture2D(image, vUv);
    if (value.a < 0.02) discard;
    gl_FragColor = vec4(value.rgb * daylight, value.a);
  }
`;

export class LandscapeLayer {
  readonly group = new THREE.Group();
  private readonly materials: THREE.ShaderMaterial[] = [];
  private readonly ready: Promise<void>;

  constructor(source = window.__XUANYE_LANDSCAPE_GUEREINS__) {
    if (!source) {
      this.ready = Promise.resolve();
      return;
    }
    const loader = new THREE.TextureLoader();
    const loads: Array<Promise<void>> = [];
    for (const [key, dataUri] of Object.entries(source.tiles)) {
      const [orderText, pixelText] = key.split("/");
      const order = Number(orderText);
      if (order !== 1) continue;
      const pixel = Number(pixelText);
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let row = 0; row <= GRID; row += 1) {
        for (let column = 0; column <= GRID; column += 1) {
          const gridU = column / GRID;
          const gridV = row / GRID;
          const u = healpixLandscapeTileCoordinates(gridU, TILE_SIZE);
          const v = healpixLandscapeTileCoordinates(gridV, TILE_SIZE);
          const direction = healpixTileDirection(order, pixel, u.direction, v.direction);
          positions.push(direction.x, direction.y, direction.z);
          uvs.push(u.texture, v.texture);
        }
      }
      for (let row = 0; row < GRID; row += 1) {
        for (let column = 0; column < GRID; column += 1) {
          const a = row * (GRID + 1) + column;
          const b = a + 1;
          const c = a + GRID + 1;
          indices.push(a, c, b, b, c, c + 1);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      const fallback = source.tiles[`0/${pixel >> 2}`];
      const material = new THREE.ShaderMaterial({
        uniforms: {
          image: { value: null },
          daylight: { value: 0.25 },
          origin: { value: new THREE.Vector3() },
          center: { value: new THREE.Vector3() },
          horizontalToEcliptic: { value: new THREE.Matrix3() },
          planetariumMode: { value: 1 },
          planetariumProjection: { value: 1 },
          planetariumFov: { value: 72 },
          planetariumAspect: { value: 1 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      loads.push(new Promise<void>((resolve) => {
        const configure = (texture: THREE.Texture) => {
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.needsUpdate = true;
        };
        material.uniforms.image!.value = loader.load(dataUri, (texture) => {
          configure(texture);
          resolve();
        }, undefined, () => {
          if (!fallback) {
            resolve();
            return;
          }
          material.uniforms.image!.value = loader.load(
            fallback,
            (texture) => {
              configure(texture);
              resolve();
            },
            undefined,
            () => resolve(),
          );
        });
      }));
      this.materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 9_000;
      this.group.add(mesh);
    }
    this.group.visible = false;
    this.ready = Promise.all(loads).then(() => undefined);
  }

  waitUntilReadyForSelfTest(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("timeout while loading landscape textures")),
        Math.max(1, timeoutMs),
      );
      this.ready.then(() => {
        window.clearTimeout(timeout);
        resolve();
      }, (error) => {
        window.clearTimeout(timeout);
        reject(error);
      });
    });
  }

  update(options: {
    visible: boolean;
    origin: Cartesian;
    center: Cartesian;
    south: Cartesian;
    west: Cartesian;
    zenith: Cartesian;
    projection: PlanetariumProjection;
    fov: number;
    aspect: number;
    sunAltitude: number;
  }): void {
    this.group.visible = options.visible;
    if (!options.visible) return;
    const matrix = new THREE.Matrix3().set(
      options.south.x, options.west.x, options.zenith.x,
      options.south.y, options.west.y, options.zenith.y,
      options.south.z, options.west.z, options.zenith.z,
    );
    const mode = options.projection === "stereographic" ? 1
      : options.projection === "fisheye" ? 2 : 0;
    const daylight = landscapeDaylightForSunAltitude(options.sunAltitude);
    for (const material of this.materials) {
      material.uniforms.origin!.value.copy(eclipticToWorld(options.origin));
      material.uniforms.center!.value.set(options.center.x, options.center.y, options.center.z);
      material.uniforms.horizontalToEcliptic!.value.copy(matrix);
      material.uniforms.planetariumProjection!.value = mode;
      material.uniforms.planetariumFov!.value = options.fov;
      material.uniforms.planetariumAspect!.value = options.aspect;
      material.uniforms.daylight!.value = daylight;
    }
  }
}
