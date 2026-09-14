import { calculateBazi } from "../../lib/pcbz/bazi";
import { surroundingJieqi } from "../../lib/pcbz/jieqi";
import {
  computeRelations,
  describeShenShaRule,
  shenShaBasisIndices,
} from "../../lib/pcbz/fortune";
import {
  layoutRelations,
  RELATION_TYPE_LABELS,
} from "../../lib/bazi-relations";
import type { ChartContext, ChartRenderOptions, ChartRenderer } from "./types";
import { localParts } from "./svg";

export class BaziChart implements ChartRenderer {
  render(context: ChartContext, options: ChartRenderOptions): string {
    const local = localParts(context.date, context.timeZone);
    const chart = calculateBazi({
      name: "宣夜",
      gender: context.gender,
      calendar: "solar",
      date: local.date,
      time: local.time,
      leapMonth: false,
      place: "当前观测地",
      trueSolar: options.baziTrueSolarTime ?? true,
      longitude: context.location.longitude,
      latitude: context.location.latitude,
    });
    const jieqi = surroundingJieqi(chart.solarDate);
    const columns = chart.pillars.map((pillar, index) => {
      const x = 72 + index * 96;
      return `<g class="pillar-link" data-pillar-index="${index}">` +
        `<text x="${x}" y="44" class="pillar-title">${pillar.title}</text>` +
        `<rect x="${x - 36}" y="62" width="72" height="128"/>` +
        `<text x="${x}" y="111" class="stem">${pillar.gan}</text>` +
        `<line x1="${x - 27}" y1="125" x2="${x + 27}" y2="125"/>` +
        `<text x="${x}" y="169" class="branch">${pillar.zhi}</text></g>`;
    }).join("");
    return `
      <section class="chart-section">
        <span class="chart-eyebrow">历法 · ` +
          `${options.baziTrueSolarTime === false ? "标准时" : "真太阳时校正"}</span>` +
          `<h2>四柱八字</h2>
        <svg class="bazi-columns" viewBox="0 0 440 220" role="img" aria-label="四柱干支">
          ${columns}<text x="220" y="211" class="wheel-caption">${chart.solarDate}</text>
        </svg>
        <h3>四柱结构</h3><div class="chart-table-wrap">${this.pillarTable(chart)}</div>
        <h3>干支图示</h3><div class="bazi-relation-wrap">` +
          `${this.relationDiagram(chart)}</div>
        <h3>神煞查法</h3><div class="chart-table-wrap">${this.shenShaTable(chart)}</div>
        <h3>大运</h3><div class="luck-strip">${chart.luck.map((period) =>
          `<span><strong>${period.pillar}</strong><small>${period.ages}</small>` +
          `<small>${period.years}</small></span>`).join("")}</div>
        <h3>节气上下文</h3>
        <div class="jieqi-context"><span>前一节<strong>${jieqi.previous.name}</strong>` +
        `<time>${jieqi.previous.time}</time></span><i></i><span>后一节` +
        `<strong>${jieqi.next.name}</strong><time>${jieqi.next.time}</time></span></div>
        <p class="astronomy-note">日柱：六十甲子循环计数，无天体对应</p>
      </section>`;
  }

  private pillarTable(chart: ReturnType<typeof calculateBazi>): string {
    return `<table class="pillar-table"><thead><tr><th></th>${chart.pillars.map((pillar) =>
      `<th>${pillar.title}</th>`).join("")}</tr></thead><tbody>` +
      `<tr><th>天干</th>${chart.pillars.map((pillar, index) =>
        `<td data-pillar-index="${index}">${pillar.gan}</td>`).join("")}</tr>` +
      `<tr><th>地支</th>${chart.pillars.map((pillar, index) =>
        `<td data-pillar-index="${index}">${pillar.zhi}</td>`).join("")}</tr>` +
      `<tr><th>十神</th>${chart.pillars.map((pillar) =>
        `<td>${pillar.mainGod}</td>`).join("")}</tr>` +
      `<tr><th>藏干</th>${chart.pillars.map((pillar) =>
        `<td>${pillar.hiddenGan.join(" · ")}</td>`).join("")}</tr>` +
      `<tr><th>纳音</th>${chart.pillars.map((pillar) =>
        `<td>${pillar.naYin}</td>`).join("")}</tr></tbody></table>`;
  }

  private relationDiagram(chart: ReturnType<typeof calculateBazi>): string {
    const relations = computeRelations(chart.pillars);
    const layout = layoutRelations(chart.pillars, relations.connections);
    const rows = layout.rows.map((row) => {
      const indices = row.connection.columnIndices.join(",");
      const nodes = row.connection.columnIndices.map((index) => {
        const character = row.connection.kind === "heaven"
          ? chart.pillars[index]!.gan : chart.pillars[index]!.zhi;
        return `<g><circle cx="${layout.x[index]}" cy="${row.y}" r="10"/>` +
          `<text class="relation-node" x="${layout.x[index]}" y="${row.y + 4}">` +
          `${character}</text></g>`;
      }).join("");
      return `<g class="relation-link relation-type-${row.type}" ` +
        `data-pillar-indices="${indices}" tabindex="0">` +
        `<line x1="${row.left}" x2="${row.right}" y1="${row.y}" y2="${row.y}"/>` +
        `<text x="${(row.left + row.right) / 2}" y="${row.y - 12}">` +
        `${row.connection.relation}</text>${nodes}</g>`;
    }).join("");
    const pillars = chart.pillars.map((pillar, index) =>
      `<g class="diagram-pillar pillar-link" data-pillar-index="${index}" ` +
      `transform="translate(${layout.x[index]} ${layout.pillarTop})">` +
      `<text class="diagram-title" y="18">${pillar.title}</text>` +
      `<text class="diagram-character" y="51">${pillar.gan}</text>` +
      `<text class="diagram-character diagram-branch" y="84">${pillar.zhi}</text></g>`
    ).join("");
    const types = [...new Set(layout.rows.map((row) => row.type))];
    const legend = types.map((type) => `<span class="relation-type-${type}">` +
      `<i></i>${RELATION_TYPE_LABELS[type]}</span>`).join("");
    return `<svg class="bazi-relation-diagram" viewBox="0 0 ${layout.width} ${layout.height}" ` +
      `role="img" aria-label="干支关系连线图">${rows}${pillars}</svg>` +
      `<div class="relation-legend">${legend || "本盘未检出干支关系"}</div>`;
  }

  private shenShaTable(chart: ReturnType<typeof calculateBazi>): string {
    const rows = chart.pillars.flatMap((pillar, index) => pillar.shenSha.map((name) => {
      const indices = shenShaBasisIndices(name, index).join(",");
      return `<tr class="chart-link" data-pillar-indices="${indices}">` +
      `<td>${pillar.title}</td><td>${name}</td><td class="rule-condition">` +
      `${describeShenShaRule(chart.pillars, pillar, chart.input.gender, name)}</td>` +
      `<td>本地四柱引擎 computeShenSha</td></tr>`;
    }));
    return `<table class="rule-table"><thead><tr><th>柱</th><th>神煞名</th>` +
      `<th>查法</th><th>出处</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
  }
}
