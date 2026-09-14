import { calculateZhengyuFor } from "../../lib/zhengyu";
import type { ChartContext, ChartRenderOptions, ChartRenderer } from "./types";
import {
  chartGlyph,
  dataLink,
  formatLongitude,
} from "./svg";
import { bodyName, resolveNameStyle } from "../../lib/names";
import {
  chartPoint,
  chartSpoke,
  zhengyuChartAngle,
} from "../../lib/chart-orientation";
import { zhengyuYaoRuleRows } from "../../lib/zhengyu-yaos";
import { evaluateGeju } from "../../lib/zhengyu-geju";
import type { EvaluatedGeju } from "../../lib/zhengyu-geju";

export { zhengyuChartAngle } from "../../lib/chart-orientation";

const TRADITIONAL_SYMBOLS: Readonly<Record<string, string>> = {
  Sun: "日", Moon: "月", Mercury: "水", Venus: "金", Mars: "火",
  Jupiter: "木", Saturn: "土", NorthNode: "罗", SouthNode: "计",
  Lilith: "孛", Ziqi: "气",
};

export class ZhengyuChart implements ChartRenderer {
  render(context: ChartContext, options: ChartRenderOptions): string {
    const chart = calculateZhengyuFor({
      ...context,
      calcType: options.zhengyuCalcType,
      mingType: options.zhengyuMingType,
      shenType: options.zhengyuShenType,
      nodeTrue: options.zhengyuNodeTrue,
    });
    const textMode = options.textMode ?? "symbol";
    const style = resolveNameStyle(options.nameStyle ?? "auto", "zhengyu");
    const pointAt = (longitude: number, radius: number) =>
      chartPoint(zhengyuChartAngle(longitude), radius);
    const spokeAt = (longitude: number, inner: number, outer: number) =>
      chartSpoke(zhengyuChartAngle(longitude), inner, outer);
    const master = chart.ming_shen.ming_zhu as { house: number };
    const planetRows = chart.planets2.slice(0, 14);
    const mansionRing = chart.xingxiu_list.map((mansion, index) => {
      const next = chart.xingxiu_list[(index + 1) % chart.xingxiu_list.length]!;
      const arc = (next.lng - mansion.lng + 360) % 360;
      const point = pointAt(mansion.lng + arc / 2, 199);
      return `<g class="chart-link mansion-segment" ${dataLink("mansion", index)}>` +
        `<metadata data-longitude="${mansion.lng}"></metadata>` +
        `${spokeAt(mansion.lng, 176, 216)}<text x="${point[0]}" y="${point[1]}">` +
        `${mansion.name}</text></g>`;
    }).join("");
    const houses = Array.from({ length: 12 }, (_, index) => {
      const longitude = index * 30;
      const point = pointAt(longitude + 15, 151);
      const house = index + 1;
      const mark = house === master.house ? " · 命宫" : "";
      return `<g class="chart-link palace-segment" ${dataLink("house", house)}>` +
        `${spokeAt(longitude, 96, 176)}<text x="${point[0]}" y="${point[1]}">` +
        `${house}${mark}</text></g>`;
    }).join("");
    const planets = planetRows.map((planet, index) => {
      const radius = 112 + index % 3 * 16;
      const point = pointAt(planet.lng, radius);
      const selected = options.selectedBody === planet.name ? " is-linked" : "";
      return `<g class="chart-link planet-link${selected}" ` +
        `${dataLink("body", planet.name)} data-body="${planet.name}">` +
        (textMode === "text" ? `<text x="${point[0]}" y="${point[1]}" ` +
          `class="planet-name">${bodyName(planet.name, style)}</text>`
          : chartGlyph(planet.name, point[0], point[1])) + "</g>";
    }).join("");
    return `
      <section class="chart-section">
        <span class="chart-eyebrow">中法 · 七政四余</span><h2>七政四余盘</h2>
        <svg class="chart-wheel zhengyu-wheel" viewBox="0 0 440 440" role="img"
          aria-label="七政四余圆盘">
          <circle cx="220" cy="220" r="216"/><circle cx="220" cy="220" r="176"/>
          <circle cx="220" cy="220" r="96"/>${mansionRing}${houses}${planets}
          <text x="220" y="216" class="wheel-center">命宫</text>
          <text x="220" y="233" class="wheel-caption">第 ${master.house} 宫</text>
          <metadata data-alignment-longitude="0" data-alignment-angle="270"
            data-alignment-pole="south"
            data-guide-mansions="${chart.xingxiu_list.map((item) => item.lng).join(",")}">
          </metadata>
        </svg>
        <h3>诸曜宫宿位置</h3><div class="chart-table-wrap">` +
        `${this.planetTable(chart, options)}</div>
        <h3>神煞查法</h3><div class="chart-table-wrap">${this.yaoTable(chart)}</div>
        ${this.gejuSections(chart)}
        <h3>大限</h3><div class="chart-table-wrap">${this.limitTable(chart)}</div>
      </section>`;
  }

  private gejuSections(chart: ReturnType<typeof calculateZhengyuFor>): string {
    const evaluated = evaluateGeju(chart);
    const shown = evaluated.filter((item) => item.validation === "shown" && item.evidence);
    const failed = evaluated.filter((item) => item.validation === "failed");
    const pending = evaluated.filter((item) => item.validation === "pending");
    return `<h3>格局规则</h3><div class="chart-table-wrap">` +
      `${this.gejuTable(shown, "shown")}</div>` +
      `<h3 data-collapsed="true">核对未过（仅供参考）</h3>` +
      `<div class="chart-table-wrap">${this.gejuTable(failed, "failed")}</div>` +
      `<h3 data-collapsed="true">规则待考</h3><div class="chart-table-wrap">` +
      `${this.gejuTable(pending, "pending")}</div>`;
  }

  private gejuTable(
    items: EvaluatedGeju[],
    mode: "shown" | "failed" | "pending",
  ): string {
    const rows = items.map((item) => {
      const bodies = item.evidence?.bodyIds.join(",") ?? "";
      const link = item.evidence ? ` class="chart-link" data-rule-bodies="${bodies}"` :
        ` class="rule-pending"`;
      const basis = item.evidence?.text ??
        (mode === "pending" ? "规则待考" : "本盘未命中");
      const quality = item.quality
        ? `精确率 ${(item.quality.precision * 100).toFixed(1)}% · ` +
          `召回率 ${(item.quality.recall * 100).toFixed(1)}%`
        : "—";
      return `<tr${link}><td>${item.name}</td><td>${item.category}</td>` +
        `<td class="rule-condition">${item.condition}</td>` +
        `<td class="rule-condition">${basis}</td><td>${quality}</td>` +
        `<td>Aizhanxing 七政样本条件注记</td></tr>`;
    });
    const empty = rows.length === 0
      ? `<tr><td colspan="6">本盘未命中已核对规则</td></tr>` : "";
    return `<table class="rule-table"><thead><tr><th>格局名</th><th>组别</th>` +
      `<th>条件</th><th>本盘依据</th><th>样本核对</th><th>出处</th></tr>` +
      `</thead><tbody>` +
      `${rows.join("")}${empty}` +
      `</tbody></table>`;
  }

  private yaoTable(chart: ReturnType<typeof calculateZhengyuFor>): string {
    const rows = zhengyuYaoRuleRows(chart);
    return `<table class="rule-table"><thead><tr><th>神煞名</th><th>组别</th>` +
      `<th>所落曜</th><th>范围</th><th>查法</th><th>出处</th></tr></thead><tbody>` +
      rows.map((row) => `<tr class="chart-link" ` +
        (row.bodyId ? `${dataLink("body", row.bodyId)} data-body="${row.bodyId}"` : "") +
        `><td>${row.name}</td><td>${row.group}</td><td>${row.planetName}</td>` +
        `<td>${row.scope}</td><td>${row.rule}</td><td>${row.source}</td></tr>`).join("") +
      `</tbody></table>`;
  }

  private planetTable(
    chart: ReturnType<typeof calculateZhengyuFor>,
    options: ChartRenderOptions,
  ): string {
    const style = resolveNameStyle(options.nameStyle ?? "auto", "zhengyu");
    return `<table><thead><tr><th>曜</th><th>黄经</th><th>宫</th><th>宿</th>` +
      `<th>宿度</th></tr></thead><tbody>${chart.planets2.slice(0, 14).map((planet) => {
        const mansion = chart.xingxiu_list[planet.xingxiu];
        return `<tr class="chart-link" ${dataLink("body", planet.name)} ` +
          `data-body="${planet.name}"><td>${TRADITIONAL_SYMBOLS[planet.name] ?? ""} ` +
          `${bodyName(planet.name, style)}</td><td>${formatLongitude(planet.lng)}</td>` +
          `<td>${planet.house}</td><td>${mansion?.name ?? "—"}</td>` +
          `<td>${planet.xingxiu_degree_str}</td></tr>`;
      }).join("")}</tbody></table>`;
  }

  private limitTable(chart: ReturnType<typeof calculateZhengyuFor>): string {
    const rows = chart.year_limit_list.slice(0, 24) as Array<Record<string, unknown>>;
    return `<table><thead><tr><th>年</th><th>岁</th><th>大限宫</th><th>起</th>` +
      `<th>止</th></tr></thead><tbody>${rows.map((row) =>
        `<tr><td>${row.year}</td><td>${row.age}</td><td>${row.big_limit}</td>` +
        `<td>${String(row.big_limit_date_time_start).slice(0, 10)}</td>` +
        `<td>${String(row.big_limit_date_time_end).slice(0, 10)}</td></tr>`
      ).join("")}</tbody></table>`;
  }
}
