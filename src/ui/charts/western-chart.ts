import {
  ASPECT_DEGREES,
  calculateNatalChart,
  type AspectType,
  type HouseSystem as ModernHouseSystem,
  type NatalChartResult,
} from "../../lib/aizhanxing-chart";
import {
  calculateChart,
  type ChartResult as ClassicalResult,
  type HouseSystem as ClassicalHouseSystem,
} from "../../lib/almuten/calculations";
import { zoneOffsetHours } from "../../lib/time";
import type { ChartContext, ChartRenderOptions, ChartRenderer } from "./types";
import {
  SIGNS,
  chartGlyph,
  inlineGlyph,
  dataLink,
  formatLongitude,
  localParts,
} from "./svg";
import { bodyName, resolveNameStyle } from "../../lib/names";
import {
  chartPoint,
  chartSpoke,
  westernChartAngle,
} from "../../lib/chart-orientation";
import {
  angularSeparation,
  aspectMotion,
  aspectMotionLabel,
} from "../../lib/aspects";

export { westernChartAngle } from "../../lib/chart-orientation";

const ASPECT_COLORS: Readonly<Record<number, string>> = {
  1: "#b9594c",
  2: "#b9594c",
  3: "#6e9b9b",
  4: "#b9594c",
  5: "#9672a5",
  6: "#6e9b9b",
  7: "#a77d56",
  8: "#8e746e",
  9: "#85769b",
  10: "#718b83",
};

const CLASSICAL_GLYPH_IDS: Readonly<Record<string, string>> = {
  Q: "Sun",
  W: "Moon",
  E: "Mercury",
  R: "Venus",
  T: "Mars",
  Y: "Jupiter",
  U: "Saturn",
};

const ASPECT_NAMES: Readonly<Record<number, string>> = {
  1: "合", 2: "冲", 3: "拱", 4: "刑", 5: "六合",
  6: "半六合", 7: "梅花", 8: "半刑", 9: "补八分", 10: "五分",
};

const ASPECT_MARKS: Readonly<Record<number, string>> = {
  1: "合", 2: "冲", 3: "拱", 4: "刑", 5: "六",
  6: "半六", 7: "梅", 8: "半刑", 9: "补八", 10: "五",
};

interface RenderAspect {
  first: string;
  second: string;
  name: string;
  mark: string;
  color: string;
  angle: number;
  separation: number;
  orb: number;
  motion: string;
}

export class WesternChart implements ChartRenderer {
  mode: "modern" | "classical" = "modern";
  houseSystem = "P";

  render(context: ChartContext, options: ChartRenderOptions): string {
    return this.mode === "modern"
      ? this.renderModern(context, options)
      : this.renderClassical(context, options);
  }

  private renderModern(context: ChartContext, options: ChartRenderOptions): string {
    const local = localParts(context.date, context.timeZone);
    const chart = calculateNatalChart({
      date: local.date,
      time: local.time,
      latitude: context.location.latitude,
      longitude: context.location.longitude,
      timeZone: context.timeZone,
      summer: 0,
      houseSystem: this.houseSystem as ModernHouseSystem,
    }, {
      aspectOrbs: options.aspectOrbs as Partial<Record<AspectType, number>>,
    });
    const aspects = this.modernAspectData(chart);
    return `
      <section class="chart-section">
        <span class="chart-eyebrow">西法 · 回归黄道</span>
        <h2>现代星盘</h2>
        ${this.modernWheel(chart, aspects, options)}
        <h3>相位格</h3>
        <div class="aspect-grid-wrap">${this.aspectGrid(aspects, options)}</div>
        <h3>星体位置</h3>
        <div class="chart-table-wrap">${this.modernPositions(chart, options)}</div>
        <h3>相位</h3>
        <div class="chart-table-wrap">${this.aspectTable(aspects, options)}</div>
      </section>
    `;
  }

  private modernWheel(
    chart: NatalChartResult,
    aspectData: RenderAspect[],
    options: ChartRenderOptions,
  ): string {
    const textMode = options.textMode ?? "symbol";
    const style = resolveNameStyle(options.nameStyle ?? "auto", "astrology");
    const asc = chart.ascendantLongitude;
    const pointAt = (longitude: number, radius: number) =>
      chartPoint(westernChartAngle(longitude, asc), radius);
    const spokeAt = (longitude: number, inner: number, outer: number) =>
      chartSpoke(westernChartAngle(longitude, asc), inner, outer);
    const zodiac = SIGNS.map((name, index) => {
      const point = pointAt(index * 30 + 15, 191);
      return `<g class="chart-link" ${dataLink("sign", index)}>` +
        (textMode === "text" ? `<text x="${point[0]}" y="${point[1]}" ` +
        `class="sign-name">${name}</text>` : chartGlyph(index, point[0], point[1])) +
        `<title>${name}</title></g>`;
    }).join("");
    const signSpokes = SIGNS.map((_, index) =>
      spokeAt(index * 30, 164, 210)).join("");
    const houses = chart.houses.map((house) => {
      const label = pointAt(house.longitude + 15, 139);
      return `<g class="chart-link" ${dataLink("house", house.house)}>` +
        `<metadata data-longitude="${house.longitude}"></metadata>` +
        `${spokeAt(house.longitude, 82, 164)}` +
        `<text x="${label[0]}" y="${label[1]}" class="house-label">${house.house}</text>` +
        "</g>";
    }).join("");
    const planetByName = new Map(chart.planets.map((planet) => [planet.name, planet]));
    const aspects = aspectData.map((aspect) => {
      const first = planetByName.get(aspect.first as typeof chart.planets[number]["name"]);
      const second = planetByName.get(aspect.second as typeof chart.planets[number]["name"]);
      if (!first || !second) return "";
      const a = pointAt(first.longitude, 77);
      const b = pointAt(second.longitude, 77);
      return `<line class="aspect-line aspect-link" x1="${a[0]}" y1="${a[1]}" ` +
        `x2="${b[0]}" y2="${b[1]}" stroke="${aspect.color}" ` +
        `data-aspect-bodies="${aspect.first},${aspect.second}"/>`;
    }).join("");
    const planets = chart.planets.map((planet) => {
      const point = pointAt(planet.adjustedLongitude, 112);
      const anchor = pointAt(planet.longitude, 83);
      const selected = options.selectedBody === planet.name ? " is-linked" : "";
      return `<g class="chart-link planet-link${selected}" ` +
        `${dataLink("body", planet.name)} data-body="${planet.name}">` +
        `<line x1="${anchor[0]}" y1="${anchor[1]}" x2="${point[0]}" y2="${point[1]}"/>` +
        (textMode === "text" ? `<text x="${point[0]}" y="${point[1]}" ` +
        `class="planet-name">${bodyName(planet.name, style)}</text>` :
          chartGlyph(planet.name, point[0], point[1])) +
        `<text x="${point[0]}" y="${point[1] + 13}" class="degree-label">` +
        `${formatLongitude(planet.longitude)}</text></g>`;
    }).join("");
    const mc = chart.midheavenLongitude;
    const axisLinks = ([
      ["ASC", asc], ["DSC", asc + 180], ["MC", mc], ["IC", mc + 180],
    ] as const).map(([label, longitude]) => {
      const point = pointAt(longitude, 198);
      return `<g class="chart-link axis-link" ${dataLink("sky", label)} ` +
        `data-longitude="${longitude}"><text x="${point[0]}" y="${point[1]}">` +
        `${label}</text></g>`;
    }).join("");
    return `<svg class="chart-wheel" viewBox="0 0 440 440" role="img" ` +
      `aria-label="现代西洋星盘">
      <circle cx="220" cy="220" r="210"/><circle cx="220" cy="220" r="164"/>
      <circle cx="220" cy="220" r="82"/>${signSpokes}${houses}${aspects}
      <g class="axis asc-axis chart-link" ${dataLink("sky", "ASC")}
        data-longitude="${asc}">${spokeAt(asc, 0, 210)}${spokeAt(asc + 180, 0, 210)}</g>
      <g class="axis mc-axis chart-link" ${dataLink("sky", "MC")}
        data-longitude="${mc}">${spokeAt(mc, 0, 210)}${spokeAt(mc + 180, 0, 210)}</g>
      ${zodiac}${planets}${axisLinks}<text x="220" y="217" class="wheel-center">地</text>
      <text x="220" y="233" class="wheel-caption">ASC ${formatLongitude(asc)} · ` +
      `MC ${formatLongitude(mc)}</text>` +
      `<metadata data-alignment-longitude="${asc}" data-alignment-angle="180" ` +
      `data-alignment-pole="north" data-guide-mc="${mc}" ` +
      `data-guide-cusps="${chart.houses.map((house) => house.longitude).join(",")}">` +
      `</metadata></svg>`;
  }

  private modernPositions(chart: NatalChartResult, options: ChartRenderOptions): string {
    const style = resolveNameStyle(options.nameStyle ?? "auto", "astrology");
    return `<table><thead><tr><th>星体</th><th>星座</th><th>度数</th><th>宫</th>` +
      `<th>状态</th></tr></thead><tbody>${chart.planets.map((planet) =>
        `<tr class="chart-link" ${dataLink("body", planet.name)} ` +
        `data-body="${planet.name}"><td>${inlineGlyph(planet.name)} ` +
        `${bodyName(planet.name, style)}</td><td>${SIGNS[planet.signIndex]}</td>` +
        `<td>${formatLongitude(planet.longitude)}</td><td>${planet.house}</td>` +
        `<td>${planet.status ?? "顺行"}</td></tr>`).join("")}</tbody></table>`;
  }

  private renderClassical(context: ChartContext, options: ChartRenderOptions): string {
    const local = localParts(context.date, context.timeZone);
    const [year, month, day] = local.date.split("-").map(Number) as [number, number, number];
    const [hour, minute] = local.time.split(":").map(Number) as [number, number];
    const longitudeDegrees = Math.floor(Math.abs(context.location.longitude));
    const latitudeDegrees = Math.floor(Math.abs(context.location.latitude));
    const chart = calculateChart({
      name: "宣夜",
      year,
      month,
      day,
      hour,
      minute,
      location: "当前观测地",
      longitudeDegrees,
      longitudeDirection: context.location.longitude < 0 ? "W" : "E",
      longitudeMinutes: (Math.abs(context.location.longitude) - longitudeDegrees) * 60,
      latitudeDegrees,
      latitudeDirection: context.location.latitude < 0 ? "S" : "N",
      latitudeMinutes: (Math.abs(context.location.latitude) - latitudeDegrees) * 60,
      timezoneOffset: zoneOffsetHours(context.date, context.timeZone) * 60,
      houseSystem: this.houseSystem as ClassicalHouseSystem,
    });
    const aspects = this.classicalAspectData(chart);
    return `
      <section class="chart-section">
        <span class="chart-eyebrow">西法 · 古典七曜</span><h2>古典星盘</h2>
        ${this.classicalWheel(chart, aspects, options)}
        <h3>相位格</h3><div class="aspect-grid-wrap">` +
        `${this.aspectGrid(aspects, options)}</div>` +
        `<h3>相位</h3><div class="chart-table-wrap">` +
        `${this.aspectTable(aspects, options)}</div>
        <h3>本质尊贵</h3><div class="chart-table-wrap">` +
        `${this.dignities(chart, options)}</div>
        <h3>法达</h3><div class="chart-table-wrap">${this.periods(chart)}</div>
        <h3>小限</h3><div class="chart-table-wrap">${this.profections(chart)}</div>
      </section>`;
  }

  private classicalWheel(
    chart: ClassicalResult,
    aspectData: RenderAspect[],
    options: ChartRenderOptions,
  ): string {
    const textMode = options.textMode ?? "symbol";
    const style = resolveNameStyle(options.nameStyle ?? "auto", "astrology");
    const asc = chart.houses[0] ?? 0;
    const pointAt = (longitude: number, radius: number) =>
      chartPoint(westernChartAngle(longitude, asc), radius);
    const spokeAt = (longitude: number, inner: number, outer: number) =>
      chartSpoke(westernChartAngle(longitude, asc), inner, outer);
    const spokes = chart.houses.map((longitude, index) => {
      const point = pointAt(longitude + 15, 140);
      return `<g class="chart-link" ${dataLink("house", index + 1)}>` +
        `<metadata data-longitude="${longitude}"></metadata>` +
        `${spokeAt(longitude, 80, 208)}<text x="${point[0]}" y="${point[1]}" ` +
        `class="house-label">${index + 1}</text></g>`;
    }).join("");
    const signs = SIGNS.map((_, index) => {
      const point = pointAt(index * 30 + 15, 191);
      return `${spokeAt(index * 30, 166, 208)}<g class="chart-link" ` +
        `${dataLink("sign", index)}>` + (textMode === "text"
          ? `<text x="${point[0]}" y="${point[1]}" class="sign-name">` +
            `${SIGNS[index]}</text>` : chartGlyph(index, point[0], point[1])) + "</g>";
    }).join("");
    const positions = chart.positions.slice(0, 7).map((position) => {
      const id = CLASSICAL_GLYPH_IDS[position.glyph] ?? position.id;
      const point = pointAt(position.longitude, 112);
      const selected = options.selectedBody === id ? " is-linked" : "";
      return `<g class="chart-link planet-link${selected}" ${dataLink("body", id)} ` +
        `data-body="${id}">` + (textMode === "text"
          ? `<text x="${point[0]}" y="${point[1]}" class="planet-name">` +
            `${bodyName(id, style)}</text>` : chartGlyph(id, point[0], point[1])) +
        `<text x="${point[0]}" ` +
        `y="${point[1] + 13}" class="degree-label">` +
        `${formatLongitude(position.longitude)}</text></g>`;
    }).join("");
    const positionById = new Map(chart.positions.slice(0, 7).map((position) => [
      CLASSICAL_GLYPH_IDS[position.glyph] ?? position.id,
      position,
    ]));
    const aspects = aspectData.map((aspect) => {
      const first = positionById.get(aspect.first);
      const second = positionById.get(aspect.second);
      if (!first || !second) return "";
      const a = pointAt(first.longitude, 76);
      const b = pointAt(second.longitude, 76);
      return `<line class="aspect-line aspect-link" x1="${a[0]}" y1="${a[1]}" ` +
        `x2="${b[0]}" y2="${b[1]}" stroke="${aspect.color}" ` +
        `data-aspect-bodies="${aspect.first},${aspect.second}"/>`;
    }).join("");
    const mc = chart.houses[9] ?? asc + 90;
    const axisLinks = ([
      ["ASC", asc], ["DSC", asc + 180], ["MC", mc], ["IC", mc + 180],
    ] as const).map(([label, longitude]) => {
      const point = pointAt(longitude, 196);
      return `<g class="chart-link axis-link" ${dataLink("sky", label)} ` +
        `data-longitude="${longitude}"><text x="${point[0]}" y="${point[1]}">` +
        `${label}</text></g>`;
    }).join("");
    return `<svg class="chart-wheel" viewBox="0 0 440 440" role="img" ` +
      `aria-label="古典西洋星盘"><circle cx="220" cy="220" r="208"/>` +
      `<circle cx="220" cy="220" r="166"/><circle cx="220" cy="220" r="80"/>` +
      `${signs}${spokes}${aspects}${positions}${axisLinks}` +
      `<text x="220" y="224" class="wheel-center">七曜</text>` +
      `<metadata data-alignment-longitude="${asc}" data-alignment-angle="180" ` +
      `data-alignment-pole="north" data-guide-mc="${mc}" ` +
      `data-guide-cusps="${chart.houses.join(",")}"></metadata></svg>`;
  }

  private modernAspectData(chart: NatalChartResult): RenderAspect[] {
    const planets = new Map(chart.planets.map((planet) => [planet.name, planet]));
    return chart.aspects.map((aspect) => {
      const first = planets.get(aspect.planet1)!;
      const second = planets.get(aspect.planet2)!;
      const angle = ASPECT_DEGREES[aspect.type];
      return {
        first: aspect.planet1,
        second: aspect.planet2,
        name: ASPECT_NAMES[aspect.type]!,
        mark: ASPECT_MARKS[aspect.type]!,
        color: ASPECT_COLORS[aspect.type]!,
        angle,
        separation: angularSeparation(first.longitude, second.longitude),
        orb: aspect.orb,
        motion: aspectMotionLabel(aspectMotion({
          firstLongitude: first.longitude,
          firstSpeed: first.speed,
          secondLongitude: second.longitude,
          secondSpeed: second.speed,
          angle,
        })),
      };
    });
  }

  private classicalAspectData(chart: ClassicalResult): RenderAspect[] {
    return chart.aspects.flatMap((aspect) => {
      const first = chart.positions[aspect.first];
      const second = chart.positions[aspect.second];
      if (!first || !second || aspect.first >= 7 || aspect.second >= 7) return [];
      const firstId = CLASSICAL_GLYPH_IDS[first.glyph] ?? first.id;
      const secondId = CLASSICAL_GLYPH_IDS[second.glyph] ?? second.id;
      const type = ({ 0: 1, 60: 5, 90: 4, 120: 3, 180: 2 } as const)[aspect.angle];
      return [{
        first: firstId,
        second: secondId,
        name: ASPECT_NAMES[type]!,
        mark: ASPECT_MARKS[type]!,
        color: ASPECT_COLORS[type]!,
        angle: aspect.angle,
        separation: angularSeparation(first.longitude, second.longitude),
        orb: aspect.orb,
        motion: aspect.applying ? "入相" : "出相",
      }];
    });
  }

  private aspectGrid(aspects: RenderAspect[], options: ChartRenderOptions): string {
    const style = resolveNameStyle(options.nameStyle ?? "auto", "astrology");
    const bodies = [...new Set(aspects.flatMap((aspect) => [aspect.first, aspect.second]))];
    const byPair = new Map(aspects.map((aspect) => [
      [aspect.first, aspect.second].sort().join("/"),
      aspect,
    ]));
    const rows = bodies.map((body, row) => `<tr><th>${bodyName(body, style)}</th>` +
      bodies.map((other, column) => {
        if (column >= row) return `<td class="aspect-grid-empty"></td>`;
        const aspect = byPair.get([body, other].sort().join("/"));
        return aspect ? `<td class="aspect-link" title="${aspect.name} ` +
          `${aspect.orb.toFixed(2)}°" data-aspect-bodies="${aspect.first},` +
          `${aspect.second}" style="color:${aspect.color}">${aspect.mark}</td>` : "<td>·</td>";
      }).join("") + "</tr>").join("");
    return `<table class="aspect-grid"><thead><tr><th></th>` +
      bodies.map((body) => `<th>${bodyName(body, style)}</th>`).join("") +
      `</tr></thead><tbody>${rows}</tbody></table>`;
  }

  private aspectTable(aspects: RenderAspect[], options: ChartRenderOptions): string {
    const style = resolveNameStyle(options.nameStyle ?? "auto", "astrology");
    return `<table><thead><tr><th>星体</th><th>相位</th><th>星体</th>` +
      `<th>实角</th><th>容许度</th><th>趋向</th></tr></thead><tbody>` +
      aspects.map((aspect) => `<tr class="aspect-link" ` +
        `data-aspect-bodies="${aspect.first},${aspect.second}">` +
        `<td>${bodyName(aspect.first, style)}</td><td>${aspect.name} ` +
        `${aspect.angle}°</td><td>${bodyName(aspect.second, style)}</td>` +
        `<td>${aspect.separation.toFixed(2)}°</td><td>${aspect.orb.toFixed(2)}°</td>` +
        `<td>${aspect.motion}</td></tr>`).join("") + "</tbody></table>";
  }

  private dignities(chart: ClassicalResult, options: ChartRenderOptions): string {
    const style = resolveNameStyle(options.nameStyle ?? "auto", "astrology");
    return `<table><thead><tr><th>星体</th><th>庙</th><th>旺</th><th>三分</th>` +
      `<th>界</th><th>十度</th><th>分值</th></tr></thead><tbody>` +
      chart.positions.slice(0, 7).map((position, index) => {
        const dignity = chart.dignities[index]!;
        const id = CLASSICAL_GLYPH_IDS[position.glyph] ?? position.id;
        return `<tr class="chart-link" ${dataLink("body", id)} data-body="${id}">` +
          `<td>${inlineGlyph(id)} ${bodyName(id, style)}</td>` +
          `<td>${dignity.domicile}</td>` +
          `<td>${dignity.exaltation}</td><td>${dignity.triplicity.join("/")}</td>` +
          `<td>${dignity.bound}</td><td>${dignity.face}</td>` +
          `<td>${dignity.score ?? "—"}</td></tr>`;
      }).join("") + "</tbody></table>";
  }

  private periods(chart: ClassicalResult): string {
    return `<table><thead><tr><th>主星</th><th>副主</th><th>起始</th></tr></thead><tbody>` +
      chart.firdaria.slice(0, 18).map((period) => `<tr><td>${period.ruler}</td>` +
        `<td>${period.subRuler ?? "—"}</td><td>${period.date}</td></tr>`).join("") +
      "</tbody></table>";
  }

  private profections(chart: ClassicalResult): string {
    return `<table><thead><tr><th>年份</th><th>宫位</th><th>主星</th></tr></thead><tbody>` +
      chart.profections.slice(0, 24).map((period) => `<tr><td>${period.year}</td>` +
        `<td>${period.house}</td><td>${period.ruler}</td></tr>`).join("") +
      "</tbody></table>";
  }
}
