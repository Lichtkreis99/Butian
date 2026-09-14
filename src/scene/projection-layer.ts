import * as THREE from "three";

import type { StarCatalog } from "../data/catalog";
import { MANSIONS, TROPICAL_SIGNS, type MansionDefinition } from "../data/mansions";
import {
  METERS_PER_PARSEC,
  cartesianToSpherical,
  eclipticJ2000ToEclipticOfDate,
  eclipticToWorld,
  type Cartesian,
} from "../lib/coordinates";
import {
  BODY_DEFINITIONS,
  geocentricLongitude,
  type ObserverLocation,
  type SolarBodyId,
} from "../lib/ephemeris";
import {
  projectionSnapshot,
  VIRTUAL_POINT_IDS,
  type RingPosition,
  type VirtualPointId,
} from "../lib/projection-data";
import type { ContextProfile } from "../lib/context-profiles";
import { virtualRadiusOffset } from "../lib/virtual-radius";
import { LABEL_PRIORITY } from "../lib/label-layout";
import type { PlanetariumProjection } from "../lib/settings-store";
import { projectScreenPoint } from "./project-screen";
import type { SceneLabelCandidate } from "./scene-labels";

export const PROJECTION_RING_RADIUS = 62 / 206_264.806;

function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.font = '28px "Songti SC", serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(7, 12, 20, .68)";
  context.fillRect(0, 6, 128, 52);
  context.strokeStyle = color;
  context.strokeRect(1, 7, 126, 50);
  context.fillStyle = color;
  context.fillText(text, 64, 33);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function hollowMarkerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.strokeStyle = "#d9a85e";
  context.lineWidth = 4;
  context.setLineDash([7, 5]);
  context.beginPath();
  context.arc(32, 32, 23, 0, Math.PI * 2);
  context.stroke();
  return new THREE.CanvasTexture(canvas);
}

export class ProjectionLayer {
  readonly group = new THREE.Group();
  readonly mansionLabels: THREE.Sprite[] = [];
  readonly virtualPickable: THREE.Object3D[] = [];
  readonly virtualPositions = new Map<VirtualPointId, Cartesian>();

  private readonly rayLines = new Map<string, THREE.Line>();
  private readonly virtualMarkers = new Map<VirtualPointId, THREE.Sprite>();
  private readonly signLabels: THREE.Sprite[] = [];
  private readonly ring: THREE.Line;
  private readonly highlightArc: THREE.Line;
  private readonly longitudes = new Map<string, number>();
  private readonly ringData = new Map<string, RingPosition>();
  private boundaryLongitudes: number[] = [];
  private linesEnabled = true;
  private calcType: 0 | 4 = 0;
  private calculationKey = "";
  private highlight?: { kind: "body" | "house" | "sign" | "mansion"; id: string | number };
  private comparisonMorph = 0;
  private signLabelsEnabled = false;
  private mansionLabelsEnabled = false;

  constructor(private readonly stars: StarCatalog) {
    this.group.name = "Projection ring";
    this.ring = this.createRing();
    this.highlightArc = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xf0bd65, depthWrite: false }),
    );
    this.highlightArc.visible = false;
    this.highlightArc.renderOrder = 16;
    this.group.add(this.ring, this.highlightArc);
    for (const definition of BODY_DEFINITIONS) {
      if (definition.id === "Earth") continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(new Float32Array(9), 3),
      );
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color: definition.color,
          transparent: true,
          opacity: 0.52,
          depthWrite: false,
        }),
      );
      line.userData.bodyId = definition.id;
      this.rayLines.set(definition.id, line);
      this.group.add(line);
    }
    for (const id of VIRTUAL_POINT_IDS) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(new Float32Array(9), 3),
      );
      const line = new THREE.Line(
        geometry,
        new THREE.LineDashedMaterial({
          color: 0xc99755,
          dashSize: PROJECTION_RING_RADIUS * 0.018,
          gapSize: PROJECTION_RING_RADIUS * 0.012,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        }),
      );
      line.userData.bodyId = id;
      this.rayLines.set(id, line);
      this.group.add(line);
      const marker = new THREE.Sprite(new THREE.SpriteMaterial({
        map: hollowMarkerTexture(),
        transparent: true,
        depthTest: false,
      }));
      marker.userData.bodyId = id;
      marker.renderOrder = 18;
      this.virtualMarkers.set(id, marker);
      this.virtualPickable.push(marker);
      this.group.add(marker);
    }
    TROPICAL_SIGNS.forEach((name) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: labelTexture(name, "#d6ad63"), depthTest: false }),
      );
      sprite.renderOrder = 12;
      this.signLabels.push(sprite);
      this.group.add(sprite);
    });
    MANSIONS.forEach((mansion) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: labelTexture(mansion.name, "#c65345"), depthTest: false }),
      );
      sprite.userData.mansion = mansion;
      sprite.renderOrder = 13;
      this.mansionLabels.push(sprite);
      this.group.add(sprite);
    });
  }

  update(
    date: Date,
    origin: Cartesian,
    earth: Cartesian,
    bodies: ReadonlyMap<SolarBodyId, Cartesian>,
    cameraDistance: number,
    location: ObserverLocation,
    timeZone: string,
  ): void {
    const calculationKey = `${date.getTime()}:${location.latitude}:` +
      `${location.longitude}:${timeZone}:${this.calcType}`;
    if (calculationKey !== this.calculationKey) {
      this.calculationKey = calculationKey;
      this.longitudes.clear();
      this.ringData.clear();
      const snapshot = projectionSnapshot(date, location, timeZone, this.calcType);
      for (const position of snapshot.positions) {
        this.ringData.set(position.id, position);
        this.longitudes.set(position.id, position.longitude);
      }
      for (const definition of BODY_DEFINITIONS) {
        if (definition.id !== "Earth" && !this.longitudes.has(definition.id)) {
          this.longitudes.set(
            definition.id,
            geocentricLongitude(definition.body, date),
          );
        }
      }
      this.boundaryLongitudes = snapshot.mansionLongitudes;
    }
    const relativeEarth = {
      x: earth.x - origin.x,
      y: earth.y - origin.y,
      z: earth.z - origin.z,
    };
    const center = eclipticToWorld(relativeEarth);
    this.ring.position.set(center.x, center.y, center.z);
    this.highlightArc.position.copy(this.ring.position);
    const labelScale = Math.max(cameraDistance * 0.035, 4e-6);
    this.signLabels.forEach((label, index) => {
      const angle = (index * 30 + 15) * Math.PI / 180;
      const radial = eclipticToWorld({
        x: Math.cos(angle) * PROJECTION_RING_RADIUS * 1.07,
        y: Math.sin(angle) * PROJECTION_RING_RADIUS * 1.07,
        z: 0,
      });
      label.position.set(
        center.x + radial.x,
        center.y + radial.y,
        center.z + radial.z,
      );
      label.scale.set(labelScale * 2, labelScale, 1);
    });
    this.mansionLabels.forEach((label, index) => {
      const longitude = this.boundaryLongitudes[index]!;
      const angle = longitude * Math.PI / 180;
      const radial = eclipticToWorld({
        x: Math.cos(angle) * PROJECTION_RING_RADIUS * 0.92,
        y: Math.sin(angle) * PROJECTION_RING_RADIUS * 0.92,
        z: 0,
      });
      label.position.set(
        center.x + radial.x,
        center.y + radial.y,
        center.z + radial.z,
      );
      label.scale.set(labelScale * 1.45, labelScale * 0.72, 1);
    });
    this.updateVirtualPoints(earth, origin, center, cameraDistance);
    for (const definition of BODY_DEFINITIONS) {
      const line = this.rayLines.get(definition.id);
      if (!line) continue;
      const longitude = this.longitudes.get(definition.id)! * Math.PI / 180;
      const flatRadial = eclipticToWorld(
        virtualRadiusOffset(longitude * 180 / Math.PI, PROJECTION_RING_RADIUS),
      );
      const flatEnd = new THREE.Vector3(
        center.x + flatRadial.x,
        center.y + flatRadial.y,
        center.z + flatRadial.z,
      );
      const body = bodies.get(definition.id);
      if (!body) continue;
      const direction = eclipticToWorld({
        x: body.x - earth.x,
        y: body.y - earth.y,
        z: body.z - earth.z,
      });
      const rayEnd = new THREE.Vector3(direction.x, direction.y, direction.z)
        .normalize()
        .multiplyScalar(PROJECTION_RING_RADIUS)
        .add(new THREE.Vector3(center.x, center.y, center.z));
      const attribute = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      attribute.setXYZ(0, center.x, center.y, center.z);
      attribute.setXYZ(
        1,
        THREE.MathUtils.lerp(rayEnd.x, flatEnd.x, this.comparisonMorph),
        THREE.MathUtils.lerp(rayEnd.y, flatEnd.y, this.comparisonMorph),
        THREE.MathUtils.lerp(rayEnd.z, flatEnd.z, this.comparisonMorph),
      );
      attribute.setXYZ(2, flatEnd.x, flatEnd.y, flatEnd.z);
      attribute.needsUpdate = true;
    }
    this.updateHighlightArc();
  }

  setHighlight(
    kind: "body" | "house" | "sign" | "mansion",
    id: string | number,
  ): void {
    this.highlight = { kind, id };
    for (const [bodyId, line] of this.rayLines) {
      const material = line.material as THREE.LineBasicMaterial;
      material.opacity = kind === "body" && bodyId === id ? 1 : 0.42;
    }
    this.updateHighlightArc();
  }

  clearHighlight(): void {
    this.highlight = undefined;
    this.highlightArc.visible = false;
    for (const line of this.rayLines.values()) {
      (line.material as THREE.LineBasicMaterial).opacity = 0.52;
    }
  }

  ringPosition(id: string): RingPosition | undefined {
    return this.ringData.get(id);
  }

  mansionActualLongitude(mansion: MansionDefinition, date: Date): number | undefined {
    const star = this.stars.getByHip(mansion.referenceHip);
    if (!star) return undefined;
    const year = date.getUTCFullYear() + date.getUTCMonth() / 12;
    const position = this.stars.positionAt(star.index, year);
    return cartesianToSpherical(
      eclipticJ2000ToEclipticOfDate(
        { x: position[0], y: position[1], z: position[2] },
        date,
      ),
    ).longitude;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  setContextProfile(profile: ContextProfile): void {
    this.group.visible = profile.tropicalRing || profile.mansionRing ||
      profile.projectionLines || profile.fourPoints;
    this.ring.visible = profile.tropicalRing || profile.mansionRing || profile.palaceRing;
    this.signLabelsEnabled = profile.tropicalRing;
    this.mansionLabelsEnabled = profile.mansionRing;
    for (const label of this.signLabels) label.visible = false;
    for (const label of this.mansionLabels) label.visible = false;
    for (const [id, line] of this.rayLines) {
      line.visible = this.linesEnabled && profile.projectionLines &&
        profile.involvedBodies.includes(id);
    }
    for (const marker of this.virtualMarkers.values()) marker.visible = profile.fourPoints;
  }

  setLinesEnabled(enabled: boolean): void {
    this.linesEnabled = enabled;
  }

  setCalcType(calcType: 0 | 4): void {
    if (this.calcType === calcType) return;
    this.calcType = calcType;
    this.calculationKey = "";
  }

  labelCandidates(
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    planetarium: boolean,
    projection: PlanetariumProjection,
  ): SceneLabelCandidate[] {
    const candidates: SceneLabelCandidate[] = [];
    this.signLabels.forEach((object, index) => {
      const screen = projectScreenPoint(
        object.position,
        camera,
        width,
        height,
        planetarium,
        projection,
      );
      candidates.push({
        id: `ring-sign-${index}`,
        anchorX: screen.x,
        anchorY: screen.y,
        width: 56,
        height: 25,
        offsetX: -28,
        offsetY: -12.5,
        priority: LABEL_PRIORITY.ringOrMansion,
        order: index,
        valid: this.signLabelsEnabled && screen.visible,
        object,
      });
    });
    this.mansionLabels.forEach((object, index) => {
      const screen = projectScreenPoint(
        object.position,
        camera,
        width,
        height,
        planetarium,
        projection,
      );
      candidates.push({
        id: `ring-mansion-${index}`,
        anchorX: screen.x,
        anchorY: screen.y,
        width: 42,
        height: 21,
        offsetX: -21,
        offsetY: -10.5,
        priority: LABEL_PRIORITY.ringOrMansion,
        order: 12 + index,
        valid: this.mansionLabelsEnabled && screen.visible,
        object,
      });
    });
    return candidates;
  }

  visibleLabelCount(): number {
    return [...this.signLabels, ...this.mansionLabels]
      .filter((label) => label.visible).length;
  }

  setComparisonProgress(progress: number): void {
    this.comparisonMorph = progress;
  }

  longitudeFor(id: string): number | undefined {
    return this.longitudes.get(id);
  }

  mansionBoundary(index: number): number | undefined {
    return this.boundaryLongitudes[index];
  }

  private updateVirtualPoints(
    earth: Cartesian,
    origin: Cartesian,
    center: Cartesian,
    cameraDistance: number,
  ): void {
    for (const id of VIRTUAL_POINT_IDS) {
      const data = this.ringData.get(id);
      if (!data) continue;
      const longitude = data.longitude * Math.PI / 180;
      const latitude = data.latitude * Math.PI / 180;
      const distance = (id === "Lilith" ? 405_500_000 : 384_400_000) /
        METERS_PER_PARSEC;
      const direction = {
        x: Math.cos(latitude) * Math.cos(longitude) * distance,
        y: Math.cos(latitude) * Math.sin(longitude) * distance,
        z: Math.sin(latitude) * distance,
      };
      const absolute = {
        x: earth.x + direction.x,
        y: earth.y + direction.y,
        z: earth.z + direction.z,
      };
      this.virtualPositions.set(id, absolute);
      const relative = eclipticToWorld({
        x: absolute.x - origin.x,
        y: absolute.y - origin.y,
        z: absolute.z - origin.z,
      });
      const flat = eclipticToWorld({
        x: Math.cos(longitude) * PROJECTION_RING_RADIUS,
        y: Math.sin(longitude) * PROJECTION_RING_RADIUS,
        z: 0,
      });
      const marker = this.virtualMarkers.get(id)!;
      marker.position.set(
        THREE.MathUtils.lerp(relative.x, center.x + flat.x, this.comparisonMorph),
        THREE.MathUtils.lerp(relative.y, center.y + flat.y, this.comparisonMorph),
        THREE.MathUtils.lerp(relative.z, center.z + flat.z, this.comparisonMorph),
      );
      marker.scale.setScalar(Math.max(cameraDistance * 0.021, 8e-10));
      const line = this.rayLines.get(id)!;
      const attribute = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      attribute.setXYZ(0, center.x, center.y, center.z);
      attribute.setXYZ(
        1,
        THREE.MathUtils.lerp(relative.x, center.x + flat.x, this.comparisonMorph),
        THREE.MathUtils.lerp(relative.y, center.y + flat.y, this.comparisonMorph),
        THREE.MathUtils.lerp(relative.z, center.z + flat.z, this.comparisonMorph),
      );
      attribute.setXYZ(2, center.x + flat.x, center.y + flat.y, center.z + flat.z);
      attribute.needsUpdate = true;
      line.computeLineDistances();
    }
  }

  private updateHighlightArc(): void {
    if (!this.highlight || this.boundaryLongitudes.length !== MANSIONS.length) {
      this.highlightArc.visible = false;
      return;
    }
    let start: number;
    let end: number;
    if (this.highlight.kind === "mansion") {
      const index = Number(this.highlight.id);
      start = this.boundaryLongitudes[index]!;
      end = this.boundaryLongitudes[(index + 1) % MANSIONS.length]!;
    } else if (this.highlight.kind === "body") {
      const position = this.ringData.get(String(this.highlight.id));
      if (!position) {
        this.highlightArc.visible = false;
        return;
      }
      start = this.boundaryLongitudes[position.mansion]!;
      end = this.boundaryLongitudes[(position.mansion + 1) % MANSIONS.length]!;
    } else {
      const index = Number(this.highlight.id) - (this.highlight.kind === "house" ? 1 : 0);
      start = index * 30;
      end = start + 30;
    }
    const arc = (end - start + 360) % 360;
    const points = Array.from({ length: 25 }, (_, index) => {
      const angle = (start + arc * index / 24) * Math.PI / 180;
      const world = eclipticToWorld({
        x: Math.cos(angle) * PROJECTION_RING_RADIUS * 1.012,
        y: Math.sin(angle) * PROJECTION_RING_RADIUS * 1.012,
        z: 0,
      });
      return new THREE.Vector3(world.x, world.y, world.z);
    });
    this.highlightArc.geometry.dispose();
    this.highlightArc.geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.highlightArc.visible = true;
  }

  private createRing(): THREE.Line {
    const points: THREE.Vector3[] = [];
    for (let index = 0; index <= 256; index += 1) {
      const angle = index / 256 * Math.PI * 2;
      const world = eclipticToWorld({
        x: Math.cos(angle) * PROJECTION_RING_RADIUS,
        y: Math.sin(angle) * PROJECTION_RING_RADIUS,
        z: 0,
      });
      points.push(new THREE.Vector3(world.x, world.y, world.z));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color: 0xc79e55,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      }),
    );
  }
}
