import * as THREE from "three";

import type { Cartesian } from "../lib/coordinates";
import { eclipticToWorld } from "../lib/coordinates";
import type { PlanetariumProjection } from "../lib/settings-store";
import { groundColorForSunAltitude, type Rgb } from "../lib/ground-shading";

const vertexShader = `
  void main() { gl_Position = vec4(position.xy, 0.999999, 1.0); }
`;

const fragmentShader = `
  uniform vec2 viewport;
  uniform float projection;
  uniform float fov;
  uniform vec3 horizontalUp;
  uniform vec3 groundShade;
  uniform float groundEnabled;
  uniform float atmosphereEnabled;
  uniform float twilight;
  uniform float pollution;

  vec3 inverseProjection(vec2 ndc) {
    float halfFov = radians(fov * 0.5);
    vec2 point = vec2(ndc.x * viewport.x / viewport.y, ndc.y);
    if (projection < 0.5) {
      point *= tan(halfFov);
      return normalize(vec3(point, -1.0));
    }
    if (projection < 1.5) {
      point *= 2.0 * tan(halfFov * 0.5);
      float r2 = dot(point, point);
      return vec3(4.0 * point / (4.0 + r2), -(4.0 - r2) / (4.0 + r2));
    }
    point *= halfFov;
    float theta = length(point);
    if (theta < 0.000001) return vec3(0.0, 0.0, -1.0);
    return vec3(point / theta * sin(theta), -cos(theta));
  }

  void main() {
    vec2 ndc = gl_FragCoord.xy / viewport * 2.0 - 1.0;
    vec3 direction = inverseProjection(ndc);
    float altitudeSine = dot(direction, normalize(horizontalUp));
    if (altitudeSine < 0.0 && groundEnabled > 0.5) {
      gl_FragColor = vec4(groundShade, 1.0);
      return;
    }
    if (atmosphereEnabled > 0.5) {
      float horizon = pow(1.0 - abs(altitudeSine), 2.0);
      vec3 night = mix(vec3(0.008, 0.012, 0.019), vec3(0.055, 0.060, 0.065), pollution);
      vec3 sky = mix(night, vec3(0.18, 0.32, 0.45), twilight);
      float alpha = max(pollution * (0.12 + 0.22 * horizon),
        (0.08 + 0.38 * horizon) * twilight);
      gl_FragColor = vec4(sky, alpha);
      return;
    }
    discard;
  }
`;

export class PlanetariumBackdrop {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        viewport: { value: new THREE.Vector2(1, 1) },
        projection: { value: 1 },
        fov: { value: 120 },
        horizontalUp: { value: new THREE.Vector3(0, 1, 0) },
        groundShade: { value: new THREE.Vector3() },
        groundEnabled: { value: 0 },
        atmosphereEnabled: { value: 0 },
        twilight: { value: 0 },
        pollution: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8_900;
  }

  update(options: {
    enabled: boolean;
    projection: PlanetariumProjection;
    fov: number;
    width: number;
    height: number;
    camera: THREE.PerspectiveCamera;
    zenith: Cartesian;
    ground: boolean;
    atmosphere: boolean;
    sunAltitude: number;
    bortle?: number;
    groundColor?: Rgb;
  }): void {
    this.mesh.visible = options.enabled && (options.ground || options.atmosphere);
    if (!this.mesh.visible) return;
    const projection = options.projection === "perspective" ? 0
      : options.projection === "stereographic" ? 1 : 2;
    const world = eclipticToWorld(options.zenith);
    const cameraUp = new THREE.Vector3(world.x, world.y, world.z).normalize()
      .applyQuaternion(options.camera.quaternion.clone().invert());
    this.material.uniforms.viewport!.value.set(options.width, options.height);
    this.material.uniforms.projection!.value = projection;
    this.material.uniforms.fov!.value = options.fov;
    this.material.uniforms.horizontalUp!.value.copy(cameraUp);
    this.material.uniforms.groundEnabled!.value = options.ground ? 1 : 0;
    this.material.uniforms.atmosphereEnabled!.value = options.atmosphere ? 1 : 0;
    const ground = options.groundColor ?? groundColorForSunAltitude(options.sunAltitude);
    this.material.uniforms.groundShade!.value.set(
      ground[0] / 255,
      ground[1] / 255,
      ground[2] / 255,
    );
    this.material.uniforms.twilight!.value = Math.min(1, Math.max(0,
      (options.sunAltitude + 18) / 24,
    ));
    this.material.uniforms.pollution!.value = options.atmosphere
      ? Math.max(0, Math.min(1, ((options.bortle ?? 3) - 1) / 8)) : 0;
  }
}
