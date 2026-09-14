import * as THREE from "three";

import type { StarCatalog, WesternSkyculture } from "../data/catalog";
import type { Cartesian } from "../lib/coordinates";
import { ECLIPTIC_TO_WORLD_GLSL, eclipticToWorld } from "../lib/coordinates";
import type { PlanetariumProjection } from "../lib/settings-store";
import { PLANETARIUM_PROJECTION_GLSL } from "./planetarium-shader";

const GRID = 16;
const vertexShader = `
  ${ECLIPTIC_TO_WORLD_GLSL}
  ${PLANETARIUM_PROJECTION_GLSL}
  uniform vec3 origin;
  uniform vec3 center;
  varying vec2 vUv;
  void main() {
    vec3 sky = center + normalize(position) * 1.02;
    vec3 world = eclipticToWorld(sky) - origin;
    vec4 cameraPosition = modelViewMatrix * vec4(world, 1.0);
    gl_Position = planetariumMode > 0.5 && planetariumProjection > 0.5
      ? planetariumProject(cameraPosition.xyz)
      : projectionMatrix * cameraPosition;
    vUv = uv;
  }
`;

const fragmentShader = `
  uniform sampler2D image;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    vec4 value = texture2D(image, vUv);
    gl_FragColor = vec4(value.rgb, value.a * opacity);
  }
`;

function weights(
  point: [number, number],
  anchors: Array<{ pos: [number, number] }>,
): [number, number, number] {
  const [a, b, c] = anchors;
  const denominator = (b!.pos[1] - c!.pos[1]) * (a!.pos[0] - c!.pos[0]) +
    (c!.pos[0] - b!.pos[0]) * (a!.pos[1] - c!.pos[1]);
  const first = ((b!.pos[1] - c!.pos[1]) * (point[0] - c!.pos[0]) +
    (c!.pos[0] - b!.pos[0]) * (point[1] - c!.pos[1])) / denominator;
  const second = ((c!.pos[1] - a!.pos[1]) * (point[0] - c!.pos[0]) +
    (a!.pos[0] - c!.pos[0]) * (point[1] - c!.pos[1])) / denominator;
  return [first, second, 1 - first - second];
}

export class ConstellationArtLayer {
  readonly group = new THREE.Group();
  private readonly materials: THREE.ShaderMaterial[] = [];

  constructor(stars: StarCatalog, culture: WesternSkyculture) {
    const loader = new THREE.TextureLoader();
    for (const constellation of culture.constellations) {
      const image = constellation.image;
      if (!image || image.anchors.length !== 3) continue;
      const anchorDirections = image.anchors.map((anchor) => {
        const star = stars.getByHip(anchor.hip);
        return star ? new THREE.Vector3(...star.position).normalize() : undefined;
      });
      if (anchorDirections.some((value) => !value)) continue;
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let row = 0; row <= GRID; row += 1) {
        for (let column = 0; column <= GRID; column += 1) {
          const u = column / GRID;
          const v = row / GRID;
          const blend = weights([u * image.size[0], (1 - v) * image.size[1]], image.anchors);
          const direction = new THREE.Vector3();
          for (let index = 0; index < 3; index += 1) {
            direction.addScaledVector(anchorDirections[index]!, blend[index]!);
          }
          direction.normalize();
          positions.push(direction.x, direction.y, direction.z);
          uvs.push(u, v);
        }
      }
      for (let row = 0; row < GRID; row += 1) {
        for (let column = 0; column < GRID; column += 1) {
          const a = row * (GRID + 1) + column;
          const b = a + 1;
          const c = a + GRID + 1;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          image: { value: loader.load(image.dataUri) },
          opacity: { value: 0 },
          origin: { value: new THREE.Vector3() },
          center: { value: new THREE.Vector3() },
          planetariumMode: { value: 0 },
          planetariumProjection: { value: 1 },
          planetariumFov: { value: 72 },
          planetariumAspect: { value: 1 },
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
      mesh.renderOrder = 2;
      this.group.add(mesh);
    }
    this.group.visible = false;
  }

  update(options: {
    visible: boolean;
    origin: Cartesian;
    center: Cartesian;
    planetarium: boolean;
    projection: PlanetariumProjection;
    fov: number;
    aspect: number;
  }): void {
    this.group.visible = options.visible;
    if (!options.visible) return;
    const opacity = 0.25 * Math.min(1, Math.max(0, (110 - options.fov) / 70));
    const mode = options.projection === "stereographic" ? 1
      : options.projection === "fisheye" ? 2 : 0;
    for (const material of this.materials) {
      material.uniforms.opacity!.value = opacity;
      material.uniforms.origin!.value.copy(eclipticToWorld(options.origin));
      material.uniforms.center!.value.set(options.center.x, options.center.y, options.center.z);
      material.uniforms.planetariumMode!.value = options.planetarium ? 1 : 0;
      material.uniforms.planetariumProjection!.value = mode;
      material.uniforms.planetariumFov!.value = options.fov;
      material.uniforms.planetariumAspect!.value = options.aspect;
    }
  }
}
