import * as THREE from "three";

import type { ChineseSkyculture, StarCatalog } from "../data/catalog";
import { eclipticToWorld, type Cartesian } from "../lib/coordinates";
import { resolveNameStyle, starName } from "../lib/names";
import type { NameStyle } from "../lib/settings-store";
import type { ChartTabId } from "../ui/charts/types";
import type { PlanetariumProjection } from "../lib/settings-store";
import { projectScreenPoint } from "./project-screen";
import { starDistanceVisible } from "../lib/visibility";
import { MANSIONS } from "../data/mansions";
import { estimateLabelSize, LABEL_PRIORITY } from "../lib/label-layout";
import type { SceneLabelCandidate } from "./scene-labels";
import { starLabelMagnitude } from "../lib/sky-appearance";

interface LabelEntry {
  index: number;
  magnitude: number;
  element: HTMLSpanElement;
  measuredText: string;
  width: number;
  height: number;
}

export class StarLabelLayer {
  readonly element = document.createElement("div");

  private readonly entries: LabelEntry[] = [];
  private nameStyle: NameStyle = "auto";
  private tab: ChartTabId = "observation";
  private density = 0.55;
  private minimumDistance = 1;
  private maximumDistance = 5_001;
  private distanceCenter: Cartesian = { x: 0, y: 0, z: 0 };
  private filter: "all" | "dim" | "members" | "members-and-mansions" = "all";
  private filterEnabled = false;
  private readonly members: Set<number>;
  private readonly mansionStars = new Set(MANSIONS.map((item) => item.referenceHip));

  constructor(
    private readonly stars: StarCatalog,
    private readonly skyculture: ChineseSkyculture,
  ) {
    this.members = new Set(skyculture.asterisms.flatMap((item) => item.lines.flat()));
    this.element.className = "star-labels";
    for (let index = 0; index < stars.count; index += 1) {
      const star = stars.get(index);
      if (!star.hip || star.magnitude > 4.5) continue;
      if (!skyculture.commonNames[String(star.hip)] && !stars.bayerNames[String(star.hip)]) {
        continue;
      }
      const element = document.createElement("span");
      this.element.append(element);
      this.entries.push({
        index,
        magnitude: star.magnitude,
        element,
        measuredText: "",
        width: 0,
        height: 0,
      });
    }
  }

  setVisibility(options: {
    minimum: number;
    maximum: number;
    center: Cartesian;
    filter: "all" | "dim" | "members" | "members-and-mansions";
    enabled: boolean;
  }): void {
    this.minimumDistance = options.minimum;
    this.maximumDistance = options.maximum;
    this.distanceCenter = options.center;
    this.filter = options.filter;
    this.filterEnabled = options.enabled;
  }

  setOptions(style: NameStyle, tab: ChartTabId, density: number): void {
    this.nameStyle = style;
    this.tab = tab;
    this.density = density;
  }

  candidates(
    date: Date,
    origin: Cartesian,
    viewpoint: Cartesian,
    radius: number,
    morph: number,
    camera: THREE.Camera,
    width: number,
    height: number,
    planetarium = false,
    projection: PlanetariumProjection = "perspective",
    selectedStar?: number,
  ): SceneLabelCandidate[] {
    const year = date.getUTCFullYear() + date.getUTCMonth() / 12;
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 48;
    const limit = starLabelMagnitude(fov, this.density);
    const style = resolveNameStyle(this.nameStyle, this.tab, "star");
    const candidates: SceneLabelCandidate[] = [];
    for (const entry of this.entries) {
      const star = this.stars.get(entry.index);
      const position = this.stars.positionAt(entry.index, year);
      const distance = Math.hypot(
        position[0] - this.distanceCenter.x,
        position[1] - this.distanceCenter.y,
        position[2] - this.distanceCenter.z,
      );
      const profileVisible = !this.filterEnabled || this.filter === "all" ||
        this.filter === "dim" || this.members.has(star.hip) ||
        (this.filter === "members-and-mansions" && this.mansionStars.has(star.hip));
      const distanceVisible = starDistanceVisible(
        distance,
        star.distanceSource,
        this.minimumDistance,
        this.maximumDistance,
      );
      const direction = new THREE.Vector3(
        position[0] - viewpoint.x,
        position[1] - viewpoint.y,
        position[2] - viewpoint.z,
      ).normalize().multiplyScalar(radius);
      const mixed = {
        x: THREE.MathUtils.lerp(position[0], viewpoint.x + direction.x, morph),
        y: THREE.MathUtils.lerp(position[1], viewpoint.y + direction.y, morph),
        z: THREE.MathUtils.lerp(position[2], viewpoint.z + direction.z, morph),
      };
      const world = eclipticToWorld({
        x: mixed.x - origin.x,
        y: mixed.y - origin.y,
        z: mixed.z - origin.z,
      });
      const screen = projectScreenPoint(
        new THREE.Vector3(world.x, world.y, world.z),
        camera as THREE.PerspectiveCamera,
        width,
        height,
        planetarium,
        projection,
      );
      const text = starName(
        star.hip,
        style,
        this.stars.bayerNames[String(star.hip)],
        this.skyculture,
        this.stars.names[String(star.hip)],
      );
      if (text !== entry.measuredText) {
        const size = estimateLabelSize(text, 9, 4, 1);
        entry.measuredText = text;
        entry.width = size.width;
        entry.height = size.height;
      }
      candidates.push({
        id: `star-${entry.index}`,
        anchorX: screen.x,
        anchorY: screen.y,
        width: entry.width,
        height: entry.height,
        offsetX: 5,
        offsetY: -4,
        priority: selectedStar === entry.index
          ? LABEL_PRIORITY.interactive : LABEL_PRIORITY.brightStar,
        order: entry.magnitude,
        valid: profileVisible && distanceVisible && entry.magnitude <= limit &&
          screen.visible,
        element: entry.element,
        text,
        selected: selectedStar === entry.index,
      });
    }
    return candidates;
  }
}
