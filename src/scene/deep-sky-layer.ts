import * as THREE from "three";

import type { DeepSkyObject } from "../data/deep-sky";
import { eclipticToWorld, type Cartesian } from "../lib/coordinates";
import { deepSkyBrightness, dsoVisible, fovLimitingMagnitude } from
  "../lib/sky-appearance";
import type { PlanetariumProjection } from "../lib/settings-store";
import { estimateLabelSize, LABEL_PRIORITY } from "../lib/label-layout";
import type { SceneLabelCandidate } from "./scene-labels";
import { projectScreenPoint } from "./project-screen";
import { PLANETARIUM_PROJECTION_GLSL } from "./planetarium-shader";

const vertexShader = `
  ${PLANETARIUM_PROJECTION_GLSL}
  attribute float magnitude;
  attribute float objectType;
  uniform vec3 origin;
  uniform vec3 center;
  uniform float magnitudeLimit;
  uniform float pixelRatio;
  varying float vType;
  void main() {
    vec3 ecliptic = center + position;
    vec3 world = vec3(ecliptic.x, ecliptic.z, -ecliptic.y) - origin;
    vec3 cameraPosition = (modelViewMatrix * vec4(world, 1.0)).xyz;
    gl_Position = planetariumMode > 0.5 && planetariumProjection > 0.5
      ? planetariumProject(cameraPosition)
      : projectionMatrix * vec4(cameraPosition, 1.0);
    float known = magnitude > 0.0 ? magnitude :
      (planetariumFov <= 20.0 ? magnitudeLimit - 0.1 : magnitudeLimit + 0.8);
    gl_PointSize = known <= magnitudeLimit ? clamp(8.5 - known * 0.35, 3.0, 7.0) *
      pixelRatio : 0.0;
    vType = objectType;
  }
`;
const fragmentShader = `
  varying float vType;
  uniform float brightness;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = length(p);
    if (r > 0.48) discard;
    float edge = smoothstep(0.48, 0.32, r);
    float core = vType < 0.5 ? smoothstep(0.12, 0.0, abs(p.x)) :
      vType < 1.5 ? smoothstep(0.18, 0.08, r) :
      vType < 2.5 ? smoothstep(0.44, 0.27, r) : edge;
    vec3 color = vType < 0.5 ? vec3(0.48, 0.68, 0.88) :
      vType < 1.5 ? vec3(0.88, 0.74, 0.42) :
      vType < 2.5 ? vec3(0.60, 0.82, 0.76) : vec3(0.58, 0.70, 0.82);
    gl_FragColor = vec4(color, max(edge * 0.35, core * 0.72) * brightness);
  }
`;

function typeIndex(type: string): number {
  if (/^G|GiG/.test(type)) return 0;
  if (/GlC/.test(type)) return 1;
  if (/OpC/.test(type)) return 2;
  return 3;
}

export class DeepSkyLayer {
  readonly group = new THREE.Group();
  readonly labels = document.createElement("div");

  private readonly material: THREE.ShaderMaterial;
  private selected?: DeepSkyObject;
  private readonly marker: THREE.Sprite;
  private readonly labelEntries: Array<{
    object: DeepSkyObject;
    element: HTMLSpanElement;
    width: number;
    height: number;
  }> = [];

  constructor(readonly objects: DeepSkyObject[]) {
    this.labels.className = "dso-labels";
    const positions: number[] = [];
    const magnitudes: number[] = [];
    const types: number[] = [];
    for (const object of objects) {
      positions.push(object.direction.x, object.direction.y, object.direction.z);
      magnitudes.push(object.magnitude);
      types.push(typeIndex(object.type));
      if (!/^M \d+$/.test(object.primaryId) && object.magnitude > 5) continue;
      const element = document.createElement("span");
      const text = object.nameZh ?? object.primaryId;
      element.textContent = text;
      this.labels.append(element);
      this.labelEntries.push({ object, element, ...estimateLabelSize(text, 9, 4, 1) });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("magnitude", new THREE.Float32BufferAttribute(magnitudes, 1));
    geometry.setAttribute("objectType", new THREE.Float32BufferAttribute(types, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        origin: { value: new THREE.Vector3() }, center: { value: new THREE.Vector3() },
        magnitudeLimit: { value: 5 }, pixelRatio: { value: 1 },
        brightness: { value: 1 },
        planetariumMode: { value: 1 }, planetariumProjection: { value: 1 },
        planetariumFov: { value: 72 }, planetariumAspect: { value: 1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, this.material);
    points.frustumCulled = false;
    points.renderOrder = 2;
    this.group.add(points);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.strokeStyle = "#d5b777";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(32, 32, 22, 0, Math.PI * 2);
    context.moveTo(32, 3);
    context.lineTo(32, 10);
    context.moveTo(32, 54);
    context.lineTo(32, 61);
    context.moveTo(3, 32);
    context.lineTo(10, 32);
    context.moveTo(54, 32);
    context.lineTo(61, 32);
    context.stroke();
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false,
    }));
    this.marker.visible = false;
    this.marker.scale.setScalar(0.045);
    this.marker.renderOrder = 20;
    this.group.add(this.marker);
  }

  setSelected(object: DeepSkyObject | undefined): void {
    this.selected = object;
    this.marker.visible = Boolean(object);
  }

  update(options: {
    visible: boolean;
    origin: Cartesian;
    center: Cartesian;
    planetarium: boolean;
    projection: PlanetariumProjection;
    fov: number;
    aspect: number;
    bortle: number;
    width: number;
    height: number;
    camera: THREE.PerspectiveCamera;
    labelsDirty: boolean;
    sunAltitude?: number;
    moonAltitude?: number;
    atmosphere?: boolean;
  }): SceneLabelCandidate[] {
    const brightness = deepSkyBrightness(
      options.sunAltitude ?? -30,
      options.moonAltitude ?? -20,
      options.atmosphere ?? false,
    );
    this.group.visible = options.visible && brightness > 0.001;
    this.labels.hidden = !this.group.visible;
    if (!this.group.visible) return [];
    const mode = options.projection === "stereographic" ? 1
      : options.projection === "fisheye" ? 2 : 0;
    this.material.uniforms.origin!.value.copy(eclipticToWorld(options.origin));
    this.material.uniforms.center!.value.set(options.center.x, options.center.y, options.center.z);
    this.material.uniforms.magnitudeLimit!.value =
      fovLimitingMagnitude(options.fov, options.bortle) + 1.2;
    this.material.uniforms.brightness!.value = brightness;
    this.material.uniforms.pixelRatio!.value = Math.min(window.devicePixelRatio, 2);
    this.material.uniforms.planetariumMode!.value = options.planetarium ? 1 : 0;
    this.material.uniforms.planetariumProjection!.value = mode;
    this.material.uniforms.planetariumFov!.value = options.fov;
    this.material.uniforms.planetariumAspect!.value = options.aspect;
    if (this.selected) {
      const position = {
        x: options.center.x + this.selected.direction.x,
        y: options.center.y + this.selected.direction.y,
        z: options.center.z + this.selected.direction.z,
      };
      const world = eclipticToWorld({
        x: position.x - options.origin.x,
        y: position.y - options.origin.y,
        z: position.z - options.origin.z,
      });
      this.marker.position.set(world.x, world.y, world.z);
    }
    if (!options.labelsDirty) return [];
    return this.labelEntries.map((entry) => {
      const world = eclipticToWorld(entry.object.direction);
      const screen = projectScreenPoint(
        new THREE.Vector3(world.x, world.y, world.z),
        options.camera,
        options.width,
        options.height,
        options.planetarium,
        options.projection,
      );
      return {
        id: `dso-${entry.object.index}`,
        anchorX: screen.x,
        anchorY: screen.y,
        width: entry.width,
        height: entry.height,
        offsetX: 6,
        offsetY: -4,
        priority: this.selected === entry.object
          ? LABEL_PRIORITY.interactive : LABEL_PRIORITY.brightStar,
        order: entry.object.magnitude || 20,
        valid: screen.visible && dsoVisible(
          entry.object.magnitude,
          options.fov,
          options.bortle,
        ),
        element: entry.element,
        text: entry.element.textContent ?? entry.object.primaryId,
        selected: this.selected === entry.object,
      };
    });
  }

  pick(
    x: number,
    y: number,
    options: Parameters<DeepSkyLayer["update"]>[0],
  ): DeepSkyObject | undefined {
    let best: { object: DeepSkyObject; distance: number } | undefined;
    for (const object of this.objects) {
      if (!dsoVisible(object.magnitude, options.fov, options.bortle)) continue;
      const world = eclipticToWorld(object.direction);
      const screen = projectScreenPoint(new THREE.Vector3(world.x, world.y, world.z),
        options.camera, options.width, options.height, options.planetarium,
        options.projection);
      const distance = Math.hypot(x - screen.x, y - screen.y);
      if (screen.visible && distance < 7 && (!best || distance < best.distance)) {
        best = { object, distance };
      }
    }
    return best?.object;
  }

  visibleForSelfTest(id: string, fov: number, bortle: number): boolean {
    const object = this.objects.find((item) => item.primaryId.replace(" ", "") ===
      id.replace(" ", ""));
    return Boolean(object && this.group.visible && dsoVisible(object.magnitude, fov, bortle));
  }
}
