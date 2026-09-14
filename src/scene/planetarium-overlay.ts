import * as THREE from "three";

import {
  eclipticToWorld,
  equatorialToEclipticJ2000,
  type Cartesian,
} from "../lib/coordinates";
import {
  eclipticPointHorizontal,
  horizontalDirectionEcliptic,
} from "../lib/planetarium";
import type { ObserverLocation } from "../lib/ephemeris";
import type { PlanetariumProjection, XuanYeSettings } from "../lib/settings-store";
import type { ChartTabId } from "../ui/charts/types";
import {
  equatorialGridCoordinates,
  horizontalGridCoordinates,
} from "../lib/sky-grid";
import {
  estimateLabelSize,
  labelCap,
  LABEL_PRIORITY,
  layoutLabels,
  type LabelCandidate,
} from "../lib/label-layout";

const CARDINALS = [
  [0, "北"], [45, "东北"], [90, "东"], [135, "东南"],
  [180, "南"], [225, "西南"], [270, "西"], [315, "西北"],
] as const;

export class PlanetariumOverlay {
  readonly element = document.createElement("div");
  private updateKey = "";
  private labelCount = 0;

  constructor() {
    this.element.className = "planetarium-overlay";
    this.element.innerHTML = `<div class="atmosphere-sky"></div>
      <svg aria-hidden="true"><path class="planetarium-ground"/>
        <g class="planetarium-grid"></g><g class="planetarium-guides"></g>
        <g class="cardinal-marks"></g></svg>`;
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle("is-visible", visible);
    if (!visible) this.labelCount = 0;
    this.updateKey = "";
  }

  get visibleLabelCount(): number {
    return this.labelCount;
  }

  update(
    date: Date,
    location: ObserverLocation,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    settings: Readonly<XuanYeSettings>,
    _sunAltitude: number,
    tab: ChartTabId,
    guide?: { longitude: number; mc?: number; cusps?: number[]; mansions?: number[] },
    highlightLongitude?: number,
  ): void {
    if (!this.element.classList.contains("is-visible")) return;
    const key = [
      date.getTime(), location.latitude, location.longitude, width, height,
      camera.fov, ...camera.quaternion.toArray(), settings.planetariumProjection,
      Number(settings.horizonGrid), Number(settings.equatorialGrid),
      Number(settings.eclipticLine), Number(settings.meridianLine),
      Number(settings.cardinalPoints), settings.labelDensity, tab,
      guide?.longitude, guide?.mc, guide?.cusps?.join(","), guide?.mansions?.join(","),
      highlightLongitude,
    ].join(":");
    if (key === this.updateKey) return;
    this.updateKey = key;
    const project = (direction: Cartesian) => this.project(
      direction,
      camera,
      width,
      height,
      settings.planetariumProjection,
    );
    const ground = this.element.querySelector<SVGPathElement>(".planetarium-ground")!;
    ground.setAttribute("d", "");
    const grid = this.element.querySelector<SVGGElement>(".planetarium-grid")!;
    const paths: string[] = [];
    const zenith = horizontalDirectionEcliptic(date, location, 0, 90);
    if (settings.horizonGrid) {
      for (const coordinates of horizontalGridCoordinates()) {
        const line = coordinates.map((point) => horizontalDirectionEcliptic(
          date,
          location,
          point.azimuth,
          point.altitude,
        ));
        paths.push(...this.segmentedPaths(line, project, zenith, "horizontal"));
      }
    }
    if (settings.equatorialGrid) {
      for (const coordinates of equatorialGridCoordinates()) {
        const line = coordinates.map((point) => {
          const ra = point.rightAscension * Math.PI / 180;
          const dec = point.declination * Math.PI / 180;
          return equatorialToEclipticJ2000({
            x: Math.cos(dec) * Math.cos(ra),
            y: Math.cos(dec) * Math.sin(ra),
            z: Math.sin(dec),
          });
        });
        paths.push(...this.segmentedPaths(line, project, zenith, "equatorial"));
      }
    }
    if (settings.eclipticLine) {
      const line = Array.from({ length: 145 }, (_, index) => {
        const angle = index * 2.5 * Math.PI / 180;
        return { x: Math.cos(angle), y: Math.sin(angle), z: 0 };
      });
      paths.push(`<path class="ecliptic" d="${this.path(line, project)}"/>`);
    }
    if (settings.meridianLine) {
      const meridian = Array.from({ length: 37 }, (_, index) =>
        horizontalDirectionEcliptic(date, location, index < 19 ? 180 : 0,
          index < 19 ? index * 5 : (36 - index) * 5));
      paths.push(`<path class="meridian" d="${this.path(meridian, project)}"/>`);
    }
    if (settings.horizonGrid) {
      const horizon = Array.from({ length: 145 }, (_, index) =>
        horizontalDirectionEcliptic(date, location, index * 2.5, 0));
      paths.push(`<path class="horizon" d="${this.path(horizon, project)}"/>`);
    }
    grid.innerHTML = paths.join("");
    const marks = this.element.querySelector<SVGGElement>(".cardinal-marks")!;
    const cardinalCandidates = settings.cardinalPoints
      ? CARDINALS.flatMap(([azimuth, label], order) => {
        const point = project(horizontalDirectionEcliptic(date, location, azimuth, 0));
        if (!point) return [];
        const size = estimateLabelSize(label, 11, 0, 0);
        return [{
          id: `cardinal-${azimuth}`,
          anchorX: point.x,
          anchorY: point.y,
          width: size.width,
          height: size.height,
          offsetX: -size.width / 2,
          offsetY: -size.height,
          priority: LABEL_PRIORITY.ringOrMansion,
          order,
          valid: true,
        } satisfies LabelCandidate];
      }) : [];
    const cardinalPlacements = layoutLabels(
      cardinalCandidates,
      { width, height },
      labelCap(settings.labelDensity),
    );
    marks.innerHTML = cardinalPlacements.map((placement) => {
      const label = CARDINALS.find(([azimuth]) => placement.id === `cardinal-${azimuth}`)![1];
      const x = (placement.rect.left + placement.rect.right) / 2;
      return `<text x="${x}" ` +
        `y="${placement.rect.bottom}">${label}</text>`;
    }).join("");
    const guides = this.element.querySelector<SVGGElement>(".planetarium-guides")!;
    const guideResult = this.guides(
      date,
      location,
      tab,
      guide,
      project,
      highlightLongitude,
      width,
      height,
      settings.labelDensity,
    );
    guides.innerHTML = guideResult.html;
    this.labelCount = cardinalPlacements.length + guideResult.labelCount;
    const atmosphere = this.element.querySelector<HTMLElement>(".atmosphere-sky")!;
    atmosphere.style.opacity = "0";
  }

  private guides(
    date: Date,
    location: ObserverLocation,
    tab: ChartTabId,
    guide: { longitude: number; mc?: number; cusps?: number[]; mansions?: number[] } |
      undefined,
    project: (direction: Cartesian) => { x: number; y: number } | undefined,
    highlightLongitude?: number,
    width = 1,
    height = 1,
    density = 0.55,
  ): { html: string; labelCount: number } {
    if (!guide) return { html: "", labelCount: 0 };
    const pointAt = (longitude: number) => {
      const horizontal = eclipticPointHorizontal(longitude, 0, date, location);
      return project(horizontalDirectionEcliptic(
        date,
        location,
        horizontal.azimuth,
        horizontal.altitude,
      ));
    };
    if (tab === "astrology") {
      const axes: Array<[string, number]> = [
        ["ASC", guide.longitude], ["DSC", guide.longitude + 180],
        ["MC", guide.mc ?? guide.longitude + 90],
        ["IC", (guide.mc ?? guide.longitude + 90) + 180],
      ];
      const specs = axes.flatMap(([label, longitude], order) => {
        const point = pointAt(longitude);
        if (!point) return [];
        const size = estimateLabelSize(label, 9, 0, 0);
        return [{ label, point, candidate: {
          id: `axis-${label}`,
          anchorX: point.x,
          anchorY: point.y,
          width: size.width,
          height: size.height,
          offsetX: 7,
          offsetY: -size.height,
          priority: LABEL_PRIORITY.involvedBody,
          order,
          valid: true,
        } satisfies LabelCandidate }];
      });
      const placements = layoutLabels(
        specs.map((spec) => spec.candidate),
        { width, height },
        labelCap(density),
      );
      const visible = new Map(placements.map((placement) => [placement.id, placement]));
      const labels = specs.flatMap((spec) => {
        const placement = visible.get(spec.candidate.id);
        if (!placement) return [];
        return [`<g class="sky-axis"><circle cx="${spec.point.x}" ` +
          `cy="${spec.point.y}" r="4"/><text x="${placement.left}" ` +
          `y="${placement.rect.bottom}">${spec.label}</text></g>`];
      });
      const cusps = (guide.cusps ?? []).map((longitude) => {
        const point = pointAt(longitude);
        return point ? `<circle class="cusp-mark" cx="${point.x}" cy="${point.y}" r="2"/>`
          : "";
      });
      return {
        html: [...labels, ...cusps, this.highlight(pointAt, highlightLongitude)].join(""),
        labelCount: labels.length,
      };
    }
    if (tab === "zhengyu") {
      const ticks = (guide.mansions ?? []).map((longitude, index) => {
        const point = pointAt(longitude);
        return point ? `<g class="mansion-tick"><circle cx="${point.x}" ` +
          `cy="${point.y}" r="2.4"/><title>第 ${index + 1} 宿距星界</title></g>` : "";
      }).join("");
      return {
        html: ticks + this.highlight(pointAt, highlightLongitude),
        labelCount: 0,
      };
    }
    return { html: "", labelCount: 0 };
  }

  private highlight(
    pointAt: (longitude: number) => { x: number; y: number } | undefined,
    longitude: number | undefined,
  ): string {
    if (longitude === undefined) return "";
    const point = pointAt(longitude);
    return point ? `<circle class="sky-highlight" cx="${point.x}" ` +
      `cy="${point.y}" r="9"/>` : "";
  }

  private path(
    directions: Cartesian[],
    project: (direction: Cartesian) => { x: number; y: number } | undefined,
  ): string {
    let drawing = false;
    return directions.map((direction) => {
      const point = project(direction);
      if (!point) {
        drawing = false;
        return "";
      }
      const command = drawing ? "L" : "M";
      drawing = true;
      return `${command}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    }).join(" ");
  }

  private segmentedPaths(
    directions: Cartesian[],
    project: (direction: Cartesian) => { x: number; y: number } | undefined,
    zenith: Cartesian,
    className: string,
  ): string[] {
    const commands = { above: [] as string[], below: [] as string[] };
    for (let index = 0; index < directions.length - 1; index += 1) {
      const firstDirection = directions[index]!;
      const secondDirection = directions[index + 1]!;
      const first = project(firstDirection);
      const second = project(secondDirection);
      if (!first || !second) continue;
      const midpoint = {
        x: firstDirection.x + secondDirection.x,
        y: firstDirection.y + secondDirection.y,
        z: firstDirection.z + secondDirection.z,
      };
      const below = midpoint.x * zenith.x + midpoint.y * zenith.y +
        midpoint.z * zenith.z < 0;
      commands[below ? "below" : "above"].push(
        `M${first.x.toFixed(1)},${first.y.toFixed(1)}` +
        `L${second.x.toFixed(1)},${second.y.toFixed(1)}`,
      );
    }
    return (["above", "below"] as const).flatMap((side) => {
      if (!commands[side].length) return [];
      const lowerClass = side === "below" ? " below-horizon" : "";
      return [`<path class="${className}${lowerClass}" ` +
        `d="${commands[side].join(" ")}"/>`];
    });
  }

  private project(
    ecliptic: Cartesian,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    mode: PlanetariumProjection,
  ): { x: number; y: number } | undefined {
    const world = eclipticToWorld(ecliptic);
    const direction = new THREE.Vector3(world.x, world.y, world.z).normalize()
      .applyQuaternion(camera.quaternion.clone().invert());
    const forward = -direction.z;
    if (forward <= -0.999) return undefined;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    let x: number;
    let y: number;
    if (mode === "perspective") {
      if (forward <= 0) return undefined;
      x = direction.x / forward / Math.tan(halfFov) / camera.aspect;
      y = direction.y / forward / Math.tan(halfFov);
    } else if (mode === "stereographic") {
      const scale = Math.tan(halfFov / 2);
      x = direction.x / (1 + forward) / scale / camera.aspect;
      y = direction.y / (1 + forward) / scale;
    } else {
      const theta = Math.acos(Math.min(1, Math.max(-1, forward)));
      const radial = Math.hypot(direction.x, direction.y) || 1;
      x = direction.x / radial * theta / halfFov / camera.aspect;
      y = direction.y / radial * theta / halfFov;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) ||
      Math.abs(x) > 1 || Math.abs(y) > 1) return undefined;
    return { x: (x + 1) * width / 2, y: (1 - y) * height / 2 };
  }
}
