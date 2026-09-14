import * as THREE from "three";

import type { Asterism, ChineseSkyculture, StarCatalog } from "../data/catalog";
import { MANSIONS } from "../data/mansions";
import { eclipticToWorld, type Cartesian } from "../lib/coordinates";
import type { PlanetariumProjection } from "../lib/settings-store";
import { PLANETARIUM_PROJECTION_GLSL } from "./planetarium-shader";
import { projectScreenPoint } from "./project-screen";
import { estimateLabelSize, LABEL_PRIORITY } from "../lib/label-layout";
import type { SceneLabelCandidate } from "./scene-labels";

type AsterismClass = "mansions" | "enclosures" | "other";

const COLORS: Record<AsterismClass, number> = {
  mansions: 0xc75a43,
  enclosures: 0xd4a85f,
  other: 0xaeb7ba,
};

const lineVertexShader = `
  ${PLANETARIUM_PROJECTION_GLSL}
  uniform vec3 origin;
  uniform vec3 projectionCenter;
  uniform float projectionRadius;
  uniform float morph;
  attribute vec3 otherPosition;
  attribute float distanceSource;
  attribute float otherDistanceSource;
  uniform vec3 distanceCenter;
  uniform float distanceMinimum;
  uniform float distanceMaximum;
  uniform float distanceRangeFull;

  vec3 toWorld(vec3 value) { return vec3(value.x, value.z, -value.y); }

  void main() {
    float firstDistance = length(position - distanceCenter);
    float secondDistance = length(otherPosition - distanceCenter);
    bool firstVisible = firstDistance >= distanceMinimum &&
      (distanceRangeFull > 0.5 || firstDistance <= distanceMaximum) &&
      (distanceRangeFull > 0.5 || distanceSource < 1.5);
    bool secondVisible = secondDistance >= distanceMinimum &&
      (distanceRangeFull > 0.5 || secondDistance <= distanceMaximum) &&
      (distanceRangeFull > 0.5 || otherDistanceSource < 1.5);
    vec3 direction = normalize(position - projectionCenter);
    vec3 projected = projectionCenter + direction * projectionRadius;
    vec3 relative = mix(position, projected, morph) - origin;
    vec3 cameraPosition = (modelViewMatrix * vec4(toWorld(relative), 1.0)).xyz;
    gl_Position = planetariumMode > 0.5 && planetariumProjection > 0.5
      ? planetariumProject(cameraPosition)
      : projectionMatrix * vec4(cameraPosition, 1.0);
    if (!firstVisible || !secondVisible) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

const lineFragmentShader = `
  uniform vec3 color;
  uniform float opacity;
  void main() { gl_FragColor = vec4(color, opacity); }
`;

function asterismClass(asterism: Asterism): AsterismClass {
  if (MANSIONS.some((mansion) => `${mansion.name}宿` === asterism.nameZh)) return "mansions";
  if (/垣|紫微|太微|天市/.test(asterism.nameZh)) return "enclosures";
  return "other";
}

export class AsterismLayer {
  readonly group = new THREE.Group();
  readonly pickable: THREE.LineSegments[] = [];
  readonly labels: HTMLElement;

  private readonly materials = new Map<AsterismClass, THREE.ShaderMaterial>();
  private readonly labelEntries: Array<{
    asterism: Asterism;
    element: HTMLButtonElement;
    centroid: Cartesian;
    width: number;
    height: number;
  }> = [];
  private readonly depthLines: THREE.LineSegments;
  private readonly selectionMaterial: THREE.ShaderMaterial;
  private readonly selectionLines: THREE.LineSegments;
  private selected?: Asterism;
  private depthVisible = false;
  private linesVisible = true;
  private namesVisible = true;
  private readonly labelPrefix: string;
  private readonly layerVisible = new Map<AsterismClass, boolean>([
    ["mansions", true], ["enclosures", true], ["other", true],
  ]);

  constructor(
    private readonly stars: StarCatalog,
    skyculture: ChineseSkyculture,
    onSelect: (asterism: Asterism) => void,
  ) {
    this.labelPrefix = "constellations" in skyculture ? "western" : "chinese";
    this.group.name = this.labelPrefix === "western" ? "Western constellations" : "中国星官";
    this.labels = document.createElement("div");
    this.labels.className = "asterism-labels";
    for (const kind of ["mansions", "enclosures", "other"] as const) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          origin: { value: new THREE.Vector3() },
          projectionCenter: { value: new THREE.Vector3() },
          projectionRadius: { value: 1 },
          morph: { value: 0 },
          color: { value: new THREE.Color(COLORS[kind]) },
          opacity: { value: kind === "other" ? 0.25 : 0.32 },
          planetariumMode: { value: 0 },
          planetariumProjection: { value: 1 },
          planetariumFov: { value: 72 },
          planetariumAspect: { value: 1 },
          distanceCenter: { value: new THREE.Vector3() },
          distanceMinimum: { value: 1 },
          distanceMaximum: { value: 5_001 },
          distanceRangeFull: { value: 1 },
        },
        vertexShader: lineVertexShader,
        fragmentShader: lineFragmentShader,
        transparent: true,
        depthWrite: false,
      });
      this.materials.set(kind, material);
      const positions: number[] = [];
      const otherPositions: number[] = [];
      const distanceSources: number[] = [];
      const otherDistanceSources: number[] = [];
      for (const asterism of skyculture.asterisms.filter((item) =>
        asterismClass(item) === kind)) {
        for (const line of asterism.lines) {
          for (let index = 0; index < line.length - 1; index += 1) {
            const first = stars.getByHip(line[index]!);
            const second = stars.getByHip(line[index + 1]!);
            if (!first || !second) continue;
            positions.push(...first.position, ...second.position);
            otherPositions.push(...second.position, ...first.position);
            distanceSources.push(first.distanceSource === "unknown" ? 2 : 0,
              second.distanceSource === "unknown" ? 2 : 0);
            otherDistanceSources.push(second.distanceSource === "unknown" ? 2 : 0,
              first.distanceSource === "unknown" ? 2 : 0);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("otherPosition",
        new THREE.Float32BufferAttribute(otherPositions, 3));
      geometry.setAttribute("distanceSource",
        new THREE.Float32BufferAttribute(distanceSources, 1));
      geometry.setAttribute("otherDistanceSource",
        new THREE.Float32BufferAttribute(otherDistanceSources, 1));
      const lines = new THREE.LineSegments(geometry, material);
      lines.userData.asterismClass = kind;
      lines.frustumCulled = false;
      this.pickable.push(lines);
      this.group.add(lines);
    }
    this.selectionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        origin: { value: new THREE.Vector3() },
        projectionCenter: { value: new THREE.Vector3() },
        projectionRadius: { value: 1 },
        morph: { value: 0 },
        color: { value: new THREE.Color(0xffd88a) },
        opacity: { value: 0.95 },
        planetariumMode: { value: 0 },
        planetariumProjection: { value: 1 },
        planetariumFov: { value: 72 },
        planetariumAspect: { value: 1 },
        distanceCenter: { value: new THREE.Vector3() },
        distanceMinimum: { value: 1 },
        distanceMaximum: { value: 5_001 },
        distanceRangeFull: { value: 1 },
      },
      vertexShader: lineVertexShader,
      fragmentShader: lineFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    this.selectionLines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      this.selectionMaterial,
    );
    this.selectionLines.visible = false;
    this.selectionLines.frustumCulled = false;
    this.selectionLines.renderOrder = 12;
    this.group.add(this.selectionLines);
    const depthGeometry = new THREE.BufferGeometry();
    depthGeometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    this.depthLines = new THREE.LineSegments(depthGeometry, new THREE.LineDashedMaterial({
      color: 0x8d9da4,
      transparent: true,
      opacity: 0.24,
      dashSize: 0.02,
      gapSize: 0.012,
      depthWrite: false,
    }));
    this.group.add(this.depthLines);
    for (const asterism of skyculture.asterisms) {
      const members = [...new Set(asterism.lines.flat())]
        .map((hip) => stars.getByHip(hip)).filter((star) => star !== undefined);
      if (!members.length) continue;
      const centroid = members.reduce((sum, star) => ({
        x: sum.x + star.position[0] / Math.hypot(...star.position),
        y: sum.y + star.position[1] / Math.hypot(...star.position),
        z: sum.z + star.position[2] / Math.hypot(...star.position),
      }), { x: 0, y: 0, z: 0 });
      centroid.x /= members.length;
      centroid.y /= members.length;
      centroid.z /= members.length;
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = asterism.nameZh;
      element.dataset.layer = asterismClass(asterism);
      element.addEventListener("click", () => onSelect(asterism));
      this.labels.append(element);
      const size = estimateLabelSize(asterism.nameZh, 10, 3, 1);
      this.labelEntries.push({ asterism, element, centroid, ...size });
    }
  }

  setLayerVisible(kind: AsterismClass, visible: boolean): void {
    this.layerVisible.set(kind, visible);
    const object = this.pickable.find((line) => line.userData.asterismClass === kind);
    if (object) object.visible = visible && this.linesVisible;
    this.labels.querySelectorAll<HTMLElement>(`[data-layer=${kind}]`).forEach((label) => {
      label.hidden = !visible;
    });
  }

  setSelected(asterism: Asterism | undefined): void {
    this.selected = asterism;
    this.labels.querySelectorAll("button").forEach((label) => {
      label.classList.toggle("is-selected", label.textContent === asterism?.nameZh);
    });
    const positions: number[] = [];
    const otherPositions: number[] = [];
    const distanceSources: number[] = [];
    const otherDistanceSources: number[] = [];
    for (const line of asterism?.lines ?? []) {
      for (let index = 0; index < line.length - 1; index += 1) {
        const first = this.stars.getByHip(line[index]!);
        const second = this.stars.getByHip(line[index + 1]!);
        if (!first || !second) continue;
        positions.push(...first.position, ...second.position);
        otherPositions.push(...second.position, ...first.position);
        distanceSources.push(first.distanceSource === "unknown" ? 2 : 0,
          second.distanceSource === "unknown" ? 2 : 0);
        otherDistanceSources.push(second.distanceSource === "unknown" ? 2 : 0,
          first.distanceSource === "unknown" ? 2 : 0);
      }
    }
    this.selectionLines.geometry.dispose();
    this.selectionLines.geometry = new THREE.BufferGeometry();
    this.selectionLines.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    this.selectionLines.geometry.setAttribute(
      "otherPosition",
      new THREE.Float32BufferAttribute(otherPositions, 3),
    );
    this.selectionLines.geometry.setAttribute(
      "distanceSource",
      new THREE.Float32BufferAttribute(distanceSources, 1),
    );
    this.selectionLines.geometry.setAttribute(
      "otherDistanceSource",
      new THREE.Float32BufferAttribute(otherDistanceSources, 1),
    );
    this.selectionLines.visible = positions.length > 0;
  }

  setDepthVisible(visible: boolean): void {
    this.depthVisible = visible;
  }

  setEmphasized(emphasized: boolean): void {
    for (const [kind, material] of this.materials) {
      material.uniforms.opacity!.value = emphasized
        ? (kind === "other" ? 0.4 : 0.48)
        : (kind === "other" ? 0.25 : 0.32);
    }
  }

  setLinesVisible(visible: boolean): void {
    this.linesVisible = visible;
    this.pickable.forEach((lines) => {
      lines.visible = visible && Boolean(this.layerVisible.get(
        lines.userData.asterismClass as AsterismClass,
      ));
    });
  }

  setNamesVisible(visible: boolean): void {
    if (visible === this.namesVisible) return;
    this.namesVisible = visible;
    this.labels.hidden = !visible;
  }

  setDistanceRange(center: Cartesian, minimum: number, maximum: number): void {
    for (const material of [...this.materials.values(), this.selectionMaterial]) {
      material.uniforms.distanceCenter!.value.set(center.x, center.y, center.z);
      material.uniforms.distanceMinimum!.value = minimum;
      material.uniforms.distanceMaximum!.value = maximum;
      material.uniforms.distanceRangeFull!.value = minimum <= 1 && maximum > 5_000 ? 1 : 0;
    }
  }

  setPlanetariumProjection(
    enabled: boolean,
    projection: PlanetariumProjection,
    fov: number,
    aspect: number,
  ): void {
    const mode = projection === "stereographic" ? 1 : projection === "fisheye" ? 2 : 0;
    for (const material of [...this.materials.values(), this.selectionMaterial]) {
      material.uniforms.planetariumMode!.value = enabled ? 1 : 0;
      material.uniforms.planetariumProjection!.value = mode;
      material.uniforms.planetariumFov!.value = fov;
      material.uniforms.planetariumAspect!.value = aspect;
    }
  }

  update(
    origin: Cartesian,
    viewpoint: Cartesian,
    radius: number,
    morph: number,
    camera: THREE.Camera,
    width: number,
    height: number,
    planetarium = false,
    projection: PlanetariumProjection = "perspective",
    updateLabels = true,
  ): SceneLabelCandidate[] {
    for (const material of [...this.materials.values(), this.selectionMaterial]) {
      material.uniforms.origin!.value.set(origin.x, origin.y, origin.z);
      material.uniforms.projectionCenter!.value.set(viewpoint.x, viewpoint.y, viewpoint.z);
      material.uniforms.projectionRadius!.value = radius;
      material.uniforms.morph!.value = morph;
    }
    if (!updateLabels) {
      this.updateDepthLines(origin, viewpoint, radius);
      return [];
    }
    const candidates: SceneLabelCandidate[] = [];
    for (const entry of this.labelEntries) {
      const direction = new THREE.Vector3(
        entry.centroid.x - viewpoint.x,
        entry.centroid.y - viewpoint.y,
        entry.centroid.z - viewpoint.z,
      ).normalize().multiplyScalar(radius);
      const point = eclipticToWorld({
        x: viewpoint.x + direction.x - origin.x,
        y: viewpoint.y + direction.y - origin.y,
        z: viewpoint.z + direction.z - origin.z,
      });
      const screen = projectScreenPoint(
        new THREE.Vector3(point.x, point.y, point.z),
        camera as THREE.PerspectiveCamera,
        width,
        height,
        planetarium,
        projection,
      );
      const layer = asterismClass(entry.asterism);
      const selected = this.selected?.id === entry.asterism.id;
      candidates.push({
        id: `${this.labelPrefix}-${entry.asterism.id}`,
        anchorX: screen.x,
        anchorY: screen.y,
        width: entry.width,
        height: entry.height,
        offsetX: 0,
        offsetY: 0,
        priority: selected
          ? LABEL_PRIORITY.interactive : LABEL_PRIORITY.ringOrMansion,
        order: layer === "mansions" ? 0 : layer === "enclosures" ? 1 : 2,
        valid: this.namesVisible && screen.visible &&
          Boolean(this.layerVisible.get(layer)),
        element: entry.element,
        text: entry.asterism.nameZh,
        selected,
      });
    }
    this.updateDepthLines(origin, viewpoint, radius);
    return candidates;
  }

  private updateDepthLines(origin: Cartesian, viewpoint: Cartesian, radius: number): void {
    this.depthLines.visible = this.depthVisible && this.selected !== undefined;
    if (!this.depthLines.visible) return;
    const positions: number[] = [];
    for (const hip of new Set(this.selected!.lines.flat())) {
      const star = this.stars.getByHip(hip);
      if (!star) continue;
      const truePosition = { x: star.position[0], y: star.position[1], z: star.position[2] };
      const direction = new THREE.Vector3(
        truePosition.x - viewpoint.x,
        truePosition.y - viewpoint.y,
        truePosition.z - viewpoint.z,
      ).normalize().multiplyScalar(radius);
      for (const position of [{
        x: viewpoint.x + direction.x,
        y: viewpoint.y + direction.y,
        z: viewpoint.z + direction.z,
      }, truePosition]) {
        const world = eclipticToWorld({
          x: position.x - origin.x,
          y: position.y - origin.y,
          z: position.z - origin.z,
        });
        positions.push(world.x, world.y, world.z);
      }
    }
    this.depthLines.geometry.dispose();
    this.depthLines.geometry = new THREE.BufferGeometry();
    this.depthLines.geometry.setAttribute("position",
      new THREE.Float32BufferAttribute(positions, 3));
    this.depthLines.computeLineDistances();
  }
}
