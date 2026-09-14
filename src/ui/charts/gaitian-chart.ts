import {
  EquatorFromVector,
  MakeTime,
  RotateVector,
  Rotation_EQJ_EQD,
  Vector,
} from "astronomy-engine";

import type { Asterism, ChineseSkyculture, StarCatalog } from "../../data/catalog";
import { MANSIONS } from "../../data/mansions";
import { eclipticToEquatorialJ2000 } from "../../lib/coordinates";
import {
  circumpolarRadius,
  gaitianPoint,
  southernVisibilityRadius,
} from "../../lib/projections";
import type { ChartContext, ChartRenderer } from "./types";
import { dataLink } from "./svg";
import { gaitianStarRadius, gaitianStarVisible } from "../../lib/gaitian-stars";

const CENTER = 220;
const EQUATOR_RADIUS = 120;

function point(ra: number, dec: number): { x: number; y: number } {
  const projected = gaitianPoint(ra, dec);
  return {
    x: CENTER + projected.x * EQUATOR_RADIUS,
    y: CENTER + projected.y * EQUATOR_RADIUS,
  };
}

function asterismClass(asterism: Asterism): "mansion" | "enclosure" | "other" {
  if (MANSIONS.some((mansion) => `${mansion.name}宿` === asterism.nameZh)) {
    return "mansion";
  }
  if (/垣|紫微|太微|天市/.test(asterism.nameZh)) return "enclosure";
  return "other";
}

export class GaitianChart implements ChartRenderer {
  constructor(
    private readonly stars: StarCatalog,
    private readonly skyculture: ChineseSkyculture,
  ) {}

  render(context: ChartContext): string {
    const year = context.date.getUTCFullYear() + context.date.getUTCMonth() / 12;
    const rotation = Rotation_EQJ_EQD(context.date);
    const positions = new Map<number, { x: number; y: number; dec: number; magnitude: number }>();
    const required = new Set(this.skyculture.asterisms.flatMap((item) => item.lines.flat()));
    for (const hip of required) {
      const star = this.stars.getByHip(hip);
      if (!star) continue;
      const [x, y, z] = this.stars.positionAt(star.index, year);
      const equatorial = eclipticToEquatorialJ2000({ x, y, z });
      const ofDate = RotateVector(rotation,
        new Vector(equatorial.x, equatorial.y, equatorial.z, MakeTime(context.date)));
      const angles = EquatorFromVector(ofDate);
      positions.set(hip, { ...point(angles.ra * 15, angles.dec),
        dec: angles.dec, magnitude: star.magnitude });
    }
    const latitude = Math.abs(context.location.latitude);
    const inner = circumpolarRadius(latitude) * EQUATOR_RADIUS;
    const outer = southernVisibilityRadius(latitude) * EQUATOR_RADIUS;
    const eclipticPoleJ2000 = eclipticToEquatorialJ2000({ x: 0, y: 0, z: 1 });
    const eclipticPole = EquatorFromVector(RotateVector(
      rotation,
      new Vector(
        eclipticPoleJ2000.x,
        eclipticPoleJ2000.y,
        eclipticPoleJ2000.z,
        MakeTime(context.date),
      ),
    ));
    const eclipticOffset = EQUATOR_RADIUS * (90 - eclipticPole.dec) / 90;
    const eclipticCenterAngle = (eclipticPole.ra * 15 + 90) * Math.PI / 180;
    const eclipticCenter = {
      x: CENTER + Math.cos(eclipticCenterAngle) * eclipticOffset,
      y: CENTER + Math.sin(eclipticCenterAngle) * eclipticOffset,
    };
    const mansionSpokes = MANSIONS.map((mansion, index) => {
      const star = positions.get(mansion.referenceHip);
      if (!star) return "";
      const angle = Math.atan2(star.y - CENTER, star.x - CENTER);
      const end = {
        x: CENTER + Math.cos(angle) * outer,
        y: CENTER + Math.sin(angle) * outer,
      };
      const label = {
        x: CENTER + Math.cos(angle) * (outer - 9),
        y: CENTER + Math.sin(angle) * (outer - 9),
      };
      const asterism = this.skyculture.asterisms.find((item) =>
        item.nameZh === `${mansion.name}宿`);
      const link = asterism ? dataLink("asterism", asterism.id) :
        dataLink("mansion", index);
      return `<g class="gaitian-mansion chart-link" ${link}>` +
        `<line x1="${CENTER}" y1="${CENTER}" x2="${end.x}" y2="${end.y}"/>` +
        `<text x="${label.x}" y="${label.y}">${mansion.name}</text></g>`;
    }).join("");
    const asterisms = this.skyculture.asterisms.map((asterism) =>
      this.renderAsterism(asterism, positions, outer)).join("");
    return `
      <section class="gaitian-card">
        <header><span>盖天图 · POLAR PLANISPHERE</span>
          <strong>北极平视 · ${context.location.latitude.toFixed(2)}°</strong></header>
        <svg class="gaitian-svg" viewBox="0 0 440 440" role="img"
          aria-label="北天极等距方位星图">
          <defs><clipPath id="gaitian-visible"><circle cx="${CENTER}" cy="${CENTER}"
            r="${outer}"/></clipPath></defs>
          <circle class="gaitian-field" cx="${CENTER}" cy="${CENTER}" r="${outer}"/>
          <g class="gaitian-rules">
            <circle cx="${CENTER}" cy="${CENTER}" r="${inner}"/>
            <circle cx="${CENTER}" cy="${CENTER}" r="${EQUATOR_RADIUS}"/>
            <circle cx="${CENTER}" cy="${CENTER}" r="${outer}"/>
            <circle class="gaitian-ecliptic" cx="${eclipticCenter.x}"
              cy="${eclipticCenter.y}" r="${EQUATOR_RADIUS}"/>
          </g>
          <g class="gaitian-rule-labels">
            <text x="${CENTER}" y="${CENTER - inner - 3}">内规</text>
            <text x="${CENTER}" y="${CENTER - EQUATOR_RADIUS - 3}">赤道</text>
            <text x="${CENTER}" y="${CENTER - outer - 3}">外规</text>
            <text x="${eclipticCenter.x + EQUATOR_RADIUS - 22}"
              y="${eclipticCenter.y - 4}">黄道</text>
          </g>
          <g class="gaitian-spokes">${mansionSpokes}</g>
          <g clip-path="url(#gaitian-visible)">${asterisms}</g>
          <circle class="gaitian-pole" cx="${CENTER}" cy="${CENTER}" r="3"/>
        </svg>
        <footer>方位角沿赤经递增 · 半径与距北天极角距成正比</footer>
      </section>`;
  }

  private renderAsterism(
    asterism: Asterism,
    positions: ReadonlyMap<number, { x: number; y: number; dec: number; magnitude: number }>,
    outer: number,
  ): string {
    const kind = asterismClass(asterism);
    const visibleMembers = [...new Set(asterism.lines.flat())]
      .map((hip) => ({ hip, point: positions.get(hip) }))
      .filter((entry) => entry.point !== undefined && entry.point.dec >= -90);
    if (!visibleMembers.length) return "";
    const lines = asterism.lines.flatMap((line) => line.slice(0, -1).map((hip, index) => {
      const first = positions.get(hip);
      const second = positions.get(line[index + 1]!);
      if (!first || !second) return "";
      return `<line x1="${first.x}" y1="${first.y}" ` +
        `x2="${second.x}" y2="${second.y}"/>`;
    })).join("");
    const dots = visibleMembers.map(({ hip, point: star }) =>
      gaitianStarVisible(star!.magnitude, true)
        ? `<circle cx="${star!.x}" cy="${star!.y}" ` +
          `r="${gaitianStarRadius(star!.magnitude)}" data-hip="${hip}"/>`
        : "").join("");
    const label = kind === "other" ? "" : this.label(asterism, visibleMembers, outer);
    return `<g class="gaitian-asterism gaitian-${kind} chart-link" ` +
      `${dataLink("asterism", asterism.id)}>${lines}${dots}${label}</g>`;
  }

  private label(
    asterism: Asterism,
    members: Array<{ point: { x: number; y: number } | undefined }>,
    outer: number,
  ): string {
    const x = members.reduce((sum, entry) => sum + entry.point!.x, 0) / members.length;
    const y = members.reduce((sum, entry) => sum + entry.point!.y, 0) / members.length;
    if (Math.hypot(x - CENTER, y - CENTER) > outer) return "";
    return `<text x="${x + 4}" y="${y - 4}">${asterism.nameZh}</text>`;
  }
}
