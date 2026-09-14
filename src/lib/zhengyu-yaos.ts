import type { ZhengyuBaziData, ZhengyuResult } from "./aizhanxing-zhengyu";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

const BODY_IDS: Readonly<Record<string, string>> = {
  日: "Sun",
  月: "Moon",
  水: "Mercury",
  金: "Venus",
  火: "Mars",
  木: "Jupiter",
  土: "Saturn",
  罗: "NorthNode",
  计: "SouthNode",
  孛: "Lilith",
  炁: "Ziqi",
};

export interface YaoRuleRow {
  name: string;
  group: string;
  planetName: string;
  bodyId?: string;
  scope: "本命" | "流年";
  rule: string;
  source: string;
}

export function sexagenaryName(index: number): string {
  return `${STEMS[index % 10]}${BRANCHES[index % 12]}`;
}

function selector(index: number): { group: string; pillar: "year" | "day" | "palace" } {
  if (index < 20) return { group: "年柱诸曜", pillar: "year" };
  if (index < 31) return { group: "年柱变曜", pillar: "year" };
  if (index < 41) return { group: "日柱十神", pillar: "day" };
  return { group: "命宫序曜", pillar: "palace" };
}

function rowsFor(
  values: Array<Record<string, unknown>>,
  bazi: ZhengyuBaziData,
  firstSign: number,
  scope: YaoRuleRow["scope"],
): YaoRuleRow[] {
  return values.map((value, index) => {
    const name = String(value.name ?? "");
    const planetName = String(value.planet_name ?? "");
    const lookup = selector(index);
    const prefix = scope === "本命" ? "本命" : "流年";
    let rule: string;
    if (lookup.pillar === "year") {
      const pillar = bazi.sizhu.year_zhu.ganzhi;
      rule = `以${prefix}年柱查：${sexagenaryName(pillar)}（第 ${pillar} 序）` +
        `→ ${name}落${planetName}曜`;
    } else if (lookup.pillar === "day") {
      const pillar = bazi.sizhu.day_zhu.ganzhi;
      rule = `以${prefix}日柱查：${sexagenaryName(pillar)}（第 ${pillar} 序）` +
        `→ ${name}落${planetName}曜`;
    } else {
      rule = `以命宫首宫查：黄道第 ${firstSign + 1} 宫起序` +
        `→ ${prefix}${name}落${planetName}曜`;
    }
    return {
      name,
      group: lookup.group,
      planetName,
      bodyId: BODY_IDS[planetName],
      scope,
      rule,
      source: "本地七政引擎 makeYaos 查表",
    };
  });
}

export function zhengyuYaoRuleRows(chart: ZhengyuResult): YaoRuleRow[] {
  const master = chart.ming_shen.ming_zhu as { sign?: number };
  const firstSign = Math.max(0, (master.sign ?? 1) - 1);
  return [
    ...rowsFor(chart.yaos2, chart.bazi_data, firstSign, "本命"),
    ...rowsFor(chart.yaos1, chart.transit_data, firstSign, "流年"),
  ];
}
