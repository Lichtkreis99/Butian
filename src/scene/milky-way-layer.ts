import * as THREE from "three";

import { eclipticToWorld, equatorialToEclipticJ2000, type Cartesian } from
  "../lib/coordinates";
import { healpixLandscapeTileCoordinates, healpixTileDirection } from "../lib/healpix";
import { milkyWayBrightness } from "../lib/sky-appearance";
import type { PlanetariumProjection } from "../lib/settings-store";
import { PLANETARIUM_PROJECTION_GLSL } from "./planetarium-shader";

const GRID = 20;
const vertexShader = `
  ${PLANETARIUM_PROJECTION_GLSL}
  uniform vec3 origin;
  uniform vec3 center;
  varying vec2 vUv;
  void main() {
    vec3 world = vec3(center.x + position.x, center.z + position.z,
      -center.y - position.y) - origin;
    vec3 cameraPosition = (modelViewMatrix * vec4(world, 1.0)).xyz;
    gl_Position = planetariumMode > 0.5 && planetariumProjection > 0.5
      ? planetariumProject(cameraPosition)
      : projectionMatrix * vec4(cameraPosition, 1.0);
    vUv = uv;
  }
`;
const fragmentShader = `
  uniform sampler2D image;
  uniform float brightness;
  varying vec2 vUv;
  void main() {
    vec4 sample = texture2D(image, vUv);
    float luminance = dot(sample.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 color = mix(vec3(0.22, 0.30, 0.40), sample.rgb, 0.55);
    gl_FragColor = vec4(color, luminance * brightness * sample.a);
  }
`;

export class MilkyWayLayer {
  readonly group = new THREE.Group();
  private readonly materials: THREE.ShaderMaterial[] = [];
  private brightness = 0;
  private readonly ready: Promise<void>;

  constructor(source = window.__XUANYE_MILKY_WAY__) {
    if (!source) {
      this.ready = Promise.resolve();
      return;
    }
    const loader = new THREE.TextureLoader();
    const loads: Array<Promise<void>> = [];
    for (const [pixelText, uri] of Object.entries(source.tiles)) {
      const pixel = Number(pixelText);
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let row = 0; row <= GRID; row += 1) {
        for (let column = 0; column <= GRID; column += 1) {
          const u = column / GRID;
          const v = row / GRID;
          const directionU = healpixLandscapeTileCoordinates(u, source.tileWidth);
          const directionV = healpixLandscapeTileCoordinates(v, source.tileWidth);
          const eq = healpixTileDirection(
            0,
            pixel,
            directionU.direction,
            directionV.direction,
          );
          const direction = equatorialToEclipticJ2000(eq);
          positions.push(direction.x, direction.y, direction.z);
          uvs.push(directionU.texture, directionV.texture);
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
      let resolveLoad: () => void = () => undefined;
      const load = new Promise<void>((resolve) => { resolveLoad = resolve; });
      const texture = loader.load(uri, resolveLoad, undefined, resolveLoad);
      loads.push(load);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      const material = new THREE.ShaderMaterial({
        uniforms: {
          image: { value: texture }, brightness: { value: 0 },
          origin: { value: new THREE.Vector3() }, center: { value: new THREE.Vector3() },
          planetariumMode: { value: 1 }, planetariumProjection: { value: 1 },
          planetariumFov: { value: 72 }, planetariumAspect: { value: 1 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      this.materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = -20;
      this.group.add(mesh);
    }
    this.ready = Promise.all(loads).then(() => undefined);
  }

  update(options: {
    visible: boolean;
    origin: Cartesian;
    center: Cartesian;
    projection: PlanetariumProjection;
    fov: number;
    aspect: number;
    bortle: number;
    sunAltitude: number;
    moonAltitude: number;
    atmosphere: boolean;
  }): void {
    const brightness = milkyWayBrightness(options);
    this.brightness = options.visible ? brightness : 0;
    this.group.visible = options.visible && brightness > 0.001;
    const projection = options.projection === "stereographic" ? 1
      : options.projection === "fisheye" ? 2 : 0;
    for (const material of this.materials) {
      material.uniforms.origin!.value.copy(eclipticToWorld(options.origin));
      material.uniforms.center!.value.set(options.center.x, options.center.y, options.center.z);
      material.uniforms.planetariumProjection!.value = projection;
      material.uniforms.planetariumFov!.value = options.fov;
      material.uniforms.planetariumAspect!.value = options.aspect;
      material.uniforms.brightness!.value = brightness;
    }
  }

  brightnessForSelfTest(): number {
    return this.brightness;
  }

  async waitUntilReadyForSelfTest(timeoutMs: number): Promise<void> {
    let timeout = 0;
    try {
      await Promise.race([
        this.ready,
        new Promise<void>((_resolve, reject) => {
          timeout = window.setTimeout(
            () => reject(new Error("timeout while loading Milky Way textures")),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      window.clearTimeout(timeout);
    }
  }
}
