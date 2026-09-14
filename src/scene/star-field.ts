import * as THREE from "three";

import type { ChineseSkyculture, StarCatalog } from "../data/catalog";
import { MANSIONS } from "../data/mansions";
import {
  ECLIPTIC_TO_WORLD_GLSL,
  eclipticToWorld,
  type Cartesian,
} from "../lib/coordinates";
import type { PlanetariumProjection } from "../lib/settings-store";
import { allFinite } from "../lib/finite-state";
import { fovLimitingMagnitude } from "../lib/sky-appearance";
import { PLANETARIUM_PROJECTION_GLSL } from "./planetarium-shader";

export const STAR_VISIBILITY_LIMIT = 8.5;

const vertexShader = `
  ${ECLIPTIC_TO_WORLD_GLSL}
  ${PLANETARIUM_PROJECTION_GLSL}
  attribute vec3 velocity;
  attribute float magnitude;
  attribute float colorIndex;
  attribute float distanceSource;
  attribute float asterismMember;
  attribute float mansionStar;
  uniform float yearOffset;
  uniform float pixelRatio;
  uniform vec3 origin;
  uniform float visibilityLimit;
  uniform vec3 projectionCenter;
  uniform float projectionRadius;
  uniform float morph;
  uniform float profileFilter;
  uniform vec3 distanceCenter;
  uniform float distanceMinimum;
  uniform float distanceMaximum;
  uniform float distanceRangeFull;
  uniform float relativeScale;
  uniform float absoluteScale;
  uniform float extinctionEnabled;
  uniform vec3 zenithDirection;
  varying float vColorIndex;
  varying float vBrightness;
  varying float vDistanceSource;
  varying float vProfileScale;
  varying float vExtinction;

  void main() {
    vec3 ecliptic = position + velocity * yearOffset;
    float distancePc = length(ecliptic - distanceCenter);
    float distanceVisible = step(distanceMinimum, distancePc) *
      (distanceRangeFull > 0.5 ? 1.0 : step(distancePc, distanceMaximum));
    if (distanceSource > 1.5 && distanceRangeFull < 0.5) distanceVisible = 0.0;
    float keep = profileFilter < 1.5 ? 1.0
      : profileFilter < 2.5 ? asterismMember
      : max(asterismMember, mansionStar);
    vProfileScale = profileFilter > 0.5 && profileFilter < 1.5 ? 0.2 : keep;
    vec3 projectionDelta = ecliptic - projectionCenter;
    float projectionLength = max(length(projectionDelta), 1e-20);
    vec3 skyDirection = projectionDelta / projectionLength;
    float altitude = degrees(asin(clamp(dot(skyDirection, zenithDirection), -1.0, 1.0)));
    float refraction = 0.0;
    if (extinctionEnabled > 0.5 && altitude > -1.0 && altitude < 90.0) {
      refraction = 1.02 / tan(radians(altitude + 10.3 / (altitude + 5.11))) / 60.0;
      vec3 horizontal = skyDirection - zenithDirection * sin(radians(altitude));
      if (length(horizontal) > 1e-8) {
        skyDirection = normalize(normalize(horizontal) * cos(radians(altitude + refraction)) +
          zenithDirection * sin(radians(altitude + refraction)));
      }
    }
    float airmass = altitude <= -1.0 ? 40.0 : 1.0 / (sin(radians(altitude)) +
      0.50572 * pow(altitude + 6.07995, -1.6364));
    vExtinction = extinctionEnabled > 0.5 ? min(8.0, 0.2 * min(40.0, airmass)) : 0.0;
    float apparentMagnitude = magnitude + vExtinction;
    vec3 projected = projectionCenter + projectionDelta / projectionLength * projectionRadius;
    if (planetariumMode > 0.5) projected = projectionCenter + skyDirection * projectionRadius;
    vec3 world = eclipticToWorld(mix(ecliptic, projected, morph)) - origin;
    vec4 cameraPosition = modelViewMatrix * vec4(world, 1.0);
    gl_Position = planetariumMode > 0.5 && planetariumProjection > 0.5
      ? planetariumProject(cameraPosition.xyz)
      : projectionMatrix * cameraPosition;
    float relativeSize = max(0.7, (visibilityLimit - apparentMagnitude + 0.8) *
      (0.45 + relativeScale * 0.7));
    float absoluteSize = exp2(clamp((2.0 - apparentMagnitude) * 0.22, -1.0, 2.2)) *
      (0.45 + absoluteScale * 0.8);
    gl_PointSize = apparentMagnitude <= visibilityLimit && distanceVisible > 0.5 && keep > 0.5
      ? clamp(relativeSize + absoluteSize, 1.0, 9.5) * pixelRatio
      : 0.0;
    vColorIndex = colorIndex;
    vBrightness = clamp((visibilityLimit + 0.8 - apparentMagnitude) / 6.0, 0.12, 1.0);
    vDistanceSource = distanceSource;
  }
`;

const fragmentShader = `
  varying float vColorIndex;
  varying float vBrightness;
  varying float vDistanceSource;
  varying float vProfileScale;
  varying float vExtinction;
  uniform float brightnessScale;
  uniform float atmosphereScale;

  void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    float radius = length(point);
    if (radius > 0.5) discard;
    if (vDistanceSource > 1.5 && radius < 0.26) discard;
    float core = smoothstep(0.34, 0.05, radius);
    float halo = exp(-radius * radius * 18.0) * smoothstep(0.38, 0.72, vBrightness);
    float glow = max(core, halo * 0.72);
    vec3 cool = vec3(0.60, 0.76, 1.0);
    vec3 neutral = vec3(1.0, 0.96, 0.86);
    vec3 warm = vec3(1.0, 0.56, 0.29);
    vec3 color = vColorIndex < 0.0
      ? mix(neutral, cool, clamp(-vColorIndex * 2.0, 0.0, 1.0))
      : mix(neutral, warm, clamp(vColorIndex * 2.0, 0.0, 1.0));
    color = mix(color, vec3(1.0, 0.46, 0.24), clamp(vExtinction / 5.0, 0.0, 0.42));
    float extinctionLight = exp2(-1.32877 * vExtinction);
    gl_FragColor = vec4(color, glow * vBrightness * brightnessScale * atmosphereScale *
      vProfileScale * extinctionLight);
  }
`;

export class StarField {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly material: THREE.ShaderMaterial;
  private readonly marker: THREE.Sprite;
  private readonly lastGoodUniforms = new Map<string, number | number[]>();

  constructor(readonly catalog: StarCatalog, skyculture: ChineseSkyculture) {
    const interleaved = new THREE.InterleavedBuffer(
      new Float32Array(catalog.buffer),
      catalog.stride / 4,
    );
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.InterleavedBufferAttribute(interleaved, 3, 0));
    geometry.setAttribute("velocity", new THREE.InterleavedBufferAttribute(interleaved, 3, 3));
    geometry.setAttribute("magnitude", new THREE.InterleavedBufferAttribute(interleaved, 1, 6));
    geometry.setAttribute("colorIndex", new THREE.InterleavedBufferAttribute(interleaved, 1, 7));
    geometry.setAttribute("distanceSource",
      new THREE.InterleavedBufferAttribute(interleaved, 1, 9));
    const members = new Set(skyculture.asterisms.flatMap((item) => item.lines.flat()));
    const mansionStars = new Set(MANSIONS.map((item) => item.referenceHip));
    const memberFlags = new Float32Array(catalog.count);
    const mansionFlags = new Float32Array(catalog.count);
    for (let index = 0; index < catalog.count; index += 1) {
      const hip = catalog.get(index).hip;
      memberFlags[index] = members.has(hip) ? 1 : 0;
      mansionFlags[index] = mansionStars.has(hip) ? 1 : 0;
    }
    geometry.setAttribute("asterismMember", new THREE.BufferAttribute(memberFlags, 1));
    geometry.setAttribute("mansionStar", new THREE.BufferAttribute(mansionFlags, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        yearOffset: { value: 0 },
        pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        origin: { value: new THREE.Vector3() },
        visibilityLimit: { value: STAR_VISIBILITY_LIMIT },
        projectionCenter: { value: new THREE.Vector3() },
        projectionRadius: { value: 1 },
        morph: { value: 0 },
        profileFilter: { value: 0 },
        distanceCenter: { value: new THREE.Vector3() },
        distanceMinimum: { value: 1 },
        distanceMaximum: { value: 5_001 },
        distanceRangeFull: { value: 1 },
        relativeScale: { value: 0.65 },
        absoluteScale: { value: 0.55 },
        extinctionEnabled: { value: 0 },
        zenithDirection: { value: new THREE.Vector3(0, 0, 1) },
        brightnessScale: { value: 1 },
        atmosphereScale: { value: 1 },
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
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.name = "Gaia DR3 star field";

    const markerCanvas = document.createElement("canvas");
    markerCanvas.width = 64;
    markerCanvas.height = 64;
    const markerContext = markerCanvas.getContext("2d")!;
    markerContext.strokeStyle = "#f2d28f";
    markerContext.lineWidth = 3;
    markerContext.beginPath();
    markerContext.arc(32, 32, 23, 0, Math.PI * 2);
    markerContext.stroke();
    const markerTexture = new THREE.CanvasTexture(markerCanvas);
    this.marker = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: markerTexture,
        color: 0xd9ab62,
        opacity: 0.9,
        transparent: true,
        depthTest: false,
      }),
    );
    this.marker.visible = false;
    this.marker.renderOrder = 20;
    this.points.add(this.marker);
    this.rememberUniforms();
  }

  setBrightness(value: number): void {
    this.material.uniforms.brightnessScale!.value = 0.25 + value * 1.25;
  }

  setAtmosphereVisibility(value: number): void {
    this.material.uniforms.atmosphereScale!.value = value;
  }

  setSkyAppearance(options: {
    fov: number;
    bortle: number;
    relativeScale: number;
    absoluteScale: number;
    extinction: boolean;
    zenith: Cartesian;
  }): void {
    this.material.uniforms.visibilityLimit!.value = fovLimitingMagnitude(
      options.fov,
      options.bortle,
    );
    this.material.uniforms.relativeScale!.value = options.relativeScale;
    this.material.uniforms.absoluteScale!.value = options.absoluteScale;
    this.material.uniforms.extinctionEnabled!.value = options.extinction ? 1 : 0;
    this.material.uniforms.zenithDirection!.value.set(
      options.zenith.x,
      options.zenith.y,
      options.zenith.z,
    );
  }

  setPlanetariumProjection(
    enabled: boolean,
    projection: PlanetariumProjection,
    fov: number,
    aspect: number,
  ): void {
    this.material.uniforms.planetariumMode!.value = enabled ? 1 : 0;
    this.material.uniforms.planetariumProjection!.value =
      projection === "stereographic" ? 1 : projection === "fisheye" ? 2 : 0;
    this.material.uniforms.planetariumFov!.value = fov;
    this.material.uniforms.planetariumAspect!.value = aspect;
  }

  update(date: Date, origin: Cartesian): void {
    const year = date.getUTCFullYear() + date.getUTCMonth() / 12;
    this.material.uniforms.yearOffset!.value = year - this.catalog.epoch;
    this.material.uniforms.origin!.value.copy(eclipticToWorld(origin));
  }

  setPixelRatio(value: number): void {
    this.material.uniforms.pixelRatio!.value = Math.min(value, 2);
  }

  setProjection(viewpoint: Cartesian, radius: number, morph: number): void {
    this.material.uniforms.projectionCenter!.value.set(
      viewpoint.x,
      viewpoint.y,
      viewpoint.z,
    );
    this.material.uniforms.projectionRadius!.value = radius;
    this.material.uniforms.morph!.value = morph;
  }

  setVisibility(options: {
    profile: "all" | "dim" | "members" | "members-and-mansions";
    enabled: boolean;
    center: Cartesian;
    minimum: number;
    maximum: number;
  }): void {
    const modes = { all: 0, dim: 1, members: 2, "members-and-mansions": 3 } as const;
    this.material.uniforms.profileFilter!.value = options.enabled
      ? modes[options.profile] : 0;
    this.material.uniforms.distanceCenter!.value.set(
      options.center.x,
      options.center.y,
      options.center.z,
    );
    this.material.uniforms.distanceMinimum!.value = options.minimum;
    this.material.uniforms.distanceMaximum!.value = options.maximum;
    this.material.uniforms.distanceRangeFull!.value =
      options.minimum <= 1 && options.maximum > 5_000 ? 1 : 0;
  }

  showSelection(index: number, date: Date, origin: Cartesian, cameraDistance: number): void {
    const year = date.getUTCFullYear() + date.getUTCMonth() / 12;
    const position = this.catalog.positionAt(index, year);
    const world = eclipticToWorld({ x: position[0], y: position[1], z: position[2] });
    const worldOrigin = eclipticToWorld(origin);
    this.marker.position.set(
      world.x - worldOrigin.x,
      world.y - worldOrigin.y,
      world.z - worldOrigin.z,
    );
    const scale = Math.max(cameraDistance * 0.022, 2e-9);
    this.marker.scale.setScalar(scale);
    this.marker.visible = true;
  }

  clearSelection(): void {
    this.marker.visible = false;
  }

  ensureFinite(): boolean {
    if (this.uniformsFinite()) {
      this.rememberUniforms();
      return true;
    }
    for (const [name, value] of this.lastGoodUniforms) {
      const uniform = this.material.uniforms[name];
      if (!uniform) continue;
      if (typeof value === "number") uniform.value = value;
      else if (uniform.value?.fromArray) uniform.value.fromArray(value);
    }
    return false;
  }

  finiteStateForSelfTest(): boolean {
    return this.uniformsFinite();
  }

  diagnosticsForSelfTest(): Record<string, number | number[]> {
    const diagnostics: Record<string, number | number[]> = {};
    for (const [name, uniform] of Object.entries(this.material.uniforms)) {
      const value = uniform.value;
      if (typeof value === "number") diagnostics[name] = value;
      else if (value?.toArray) diagnostics[name] = value.toArray();
    }
    diagnostics.pointSize = [
      diagnostics.pixelRatio as number,
      9.5 * (diagnostics.pixelRatio as number),
    ];
    return diagnostics;
  }

  private uniformsFinite(): boolean {
    for (const uniform of Object.values(this.material.uniforms)) {
      const value = uniform.value;
      if (typeof value === "number" && !Number.isFinite(value)) return false;
      if (value?.toArray && !allFinite(value.toArray())) return false;
    }
    return true;
  }

  private rememberUniforms(): void {
    for (const [name, uniform] of Object.entries(this.material.uniforms)) {
      const value = uniform.value;
      if (typeof value === "number") this.lastGoodUniforms.set(name, value);
      else if (value?.toArray) this.lastGoodUniforms.set(name, value.toArray());
    }
  }
}
