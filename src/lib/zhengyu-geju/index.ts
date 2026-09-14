import type { ZhengyuPlanet, ZhengyuResult } from "../aizhanxing-zhengyu";
import {
  GEJU_CATALOGUE,
  GEJU_GROUP_LABELS,
  type GejuCatalogueEntry,
} from "./catalogue";
import { GEJU_QUALITY } from "./quality";

const BODY_BY_MARK: Readonly<Record<string, string>> = {
  日: "Sun", 月: "Moon", 水: "Mercury", 金: "Venus", 火: "Mars",
  木: "Jupiter", 土: "Saturn", 罗: "SouthNode", 计: "NorthNode",
  孛: "Lilith", 炁: "Ziqi",
};
const BODY_ELEMENTS: Readonly<Record<string, string>> = {
  日: "火", 月: "水", 水: "水", 金: "金", 火: "火", 木: "木",
  土: "土", 罗: "火", 计: "土", 孛: "水", 炁: "木",
};
const SIGN_RULERS = [
  "", "火", "金", "水", "月", "日", "水", "金", "火", "木", "土", "土", "木",
] as const;
const BRANCH_BY_SIGN = [
  "", "戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥",
] as const;
const BRANCH_ELEMENTS: Readonly<Record<string, string>> = {
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
};
const CONTROLS: Readonly<Record<string, string>> = {
  木: "土", 土: "水", 水: "火", 火: "金", 金: "木",
};
const PALACE_HOUSES: Readonly<Record<string, number>> = {
  财帛: 2, 田宅: 4, 男女: 5, 夫妻: 7, 官禄: 10, 福德: 11,
};
const DIRECT_MARKS = "日月水金火木土罗计孛炁";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";

export interface GejuEvidence {
  bodyIds: string[];
  palaces: number[];
  text: string;
}

export interface EvaluatedGeju extends GejuCatalogueEntry {
  category: string;
  condition: string;
  implemented: boolean;
  validation: "shown" | "failed" | "pending";
  quality?: {
    truePositive: number;
    falsePositive: number;
    falseNegative: number;
    precision: number;
    recall: number;
  };
  evidence?: GejuEvidence;
}

type Predicate = (chart: ZhengyuResult) => GejuEvidence | undefined;

const QUALITY_BY_NAME = new Map(GEJU_QUALITY.map((tuple) => [tuple[0], tuple]));

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

function planet(chart: ZhengyuResult, mark: string): ZhengyuPlanet | undefined {
  return chart.planets2.find((item) => item.name === BODY_BY_MARK[mark]);
}

function evidence(bodies: string[], palaces: number[], text: string): GejuEvidence {
  return {
    bodyIds: bodies.map((mark) => BODY_BY_MARK[mark]).filter(
      (id): id is string => Boolean(id),
    ),
    palaces,
    text,
  };
}

function sameHouse(chart: ZhengyuResult, marks: string[]): GejuEvidence | undefined {
  const bodies = marks.map((mark) => planet(chart, mark));
  if (bodies.some((item) => !item) || !bodies.every((item) => item!.sign === bodies[0]!.sign)) {
    return undefined;
  }
  const branch = BRANCH_BY_SIGN[bodies[0]!.sign];
  return evidence(marks, [...new Set(bodies.map((item) => item!.house))],
    `${marks.join("、")}同在${branch}宫`);
}

function opposite(chart: ZhengyuResult, first: string, second: string): GejuEvidence | undefined {
  const a = planet(chart, first);
  const b = planet(chart, second);
  if (!a || !b || Math.abs(a.sign - b.sign) !== 6) return undefined;
  return evidence([first, second], [a.house, b.house],
    `${first}在${BRANCH_BY_SIGN[a.sign]}宫，${second}在对宫` +
      `${BRANCH_BY_SIGN[b.sign]}宫`);
}

function signRuler(item: ZhengyuPlanet): string | undefined {
  return SIGN_RULERS[item.sign];
}

function mansionRuler(chart: ZhengyuResult, item: ZhengyuPlanet): string | undefined {
  return chart.xingxiu_list[item.xingxiu]?.planet_name;
}

function hasStatus(
  chart: ZhengyuResult,
  mark: string,
  status: "垣" | "殿" | "失垣" | "失躔",
): GejuEvidence | undefined {
  const item = planet(chart, mark);
  if (!item) return undefined;
  const mansion = mansionRuler(chart, item);
  const branch = BRANCH_BY_SIGN[item.sign];
  const branchElement = branch ? BRANCH_ELEMENTS[branch] : undefined;
  const matched = status === "垣" ? signRuler(item) === mark
    : status === "殿" ? mansion === mark
      : status === "失垣"
        ? Boolean(branchElement && CONTROLS[branchElement] === BODY_ELEMENTS[mark])
        : Boolean(mansion && CONTROLS[BODY_ELEMENTS[mansion]!] === BODY_ELEMENTS[mark]);
  if (!matched) return undefined;
  const where = status.endsWith("垣") ? `${branch}宫` :
    `${chart.xingxiu_list[item.xingxiu]?.name ?? "未知"}宿`;
  return evidence([mark], [item.house], `${mark}在${where}，符合${status}条件`);
}

function palaceLord(chart: ZhengyuResult, label: string): string | undefined {
  const house = PALACE_HOUSES[label];
  const sign = house ? chart.houses1[String(house)]?.sign : undefined;
  return sign ? SIGN_RULERS[sign] : undefined;
}

function palaceStatus(
  chart: ZhengyuResult,
  label: string,
  status: "垣" | "殿" | "失垣" | "失躔",
): GejuEvidence | undefined {
  const lord = palaceLord(chart, label);
  const house = PALACE_HOUSES[label];
  const found = lord ? hasStatus(chart, lord, status) : undefined;
  if (!found || !house) return undefined;
  return evidence([lord!], [house, ...found.palaces],
    `${label}宫在第 ${house} 宫，宫主${lord}；${found.text}`);
}

function branchIs(chart: ZhengyuResult, mark: string, branches: string): GejuEvidence | undefined {
  const item = planet(chart, mark);
  const branch = item ? BRANCH_BY_SIGN[item.sign] : undefined;
  if (!item || !branch || !branches.includes(branch)) return undefined;
  return evidence([mark], [item.house], `${mark}在${branch}宫（第 ${item.house} 宫）`);
}

function signElementLoss(chart: ZhengyuResult, mark: string): GejuEvidence | undefined {
  const item = planet(chart, mark);
  const ruler = item ? signRuler(item) : undefined;
  if (!item || !ruler || CONTROLS[BODY_ELEMENTS[ruler]!] !== BODY_ELEMENTS[mark]) {
    return undefined;
  }
  return evidence([mark], [item.house],
    `${mark}所在${BRANCH_BY_SIGN[item.sign]}宫之主${ruler}五行克${mark}`);
}

function aloneInSign(chart: ZhengyuResult, mark: string): GejuEvidence | undefined {
  const item = planet(chart, mark);
  if (!item) return undefined;
  const knownBodies = new Set(Object.values(BODY_BY_MARK));
  const companions = chart.planets2.filter((other) =>
    knownBodies.has(other.name) && other.name !== item.name && other.sign === item.sign);
  return companions.length === 0
    ? evidence([mark], [item.house], `${mark}独守${BRANCH_BY_SIGN[item.sign]}宫`)
    : undefined;
}

function monthBranch(chart: ZhengyuResult): string {
  return BRANCHES[chart.bazi_data.sizhu.month_zhu.zhi] ?? "";
}

function season(chart: ZhengyuResult): "spring" | "summer" | "autumn" | "winter" {
  const branch = monthBranch(chart);
  if ("寅卯辰".includes(branch)) return "spring";
  if ("巳午未".includes(branch)) return "summer";
  if ("申酉戌".includes(branch)) return "autumn";
  return "winter";
}

function combineEvidence(parts: GejuEvidence[]): GejuEvidence {
  return {
    bodyIds: [...new Set(parts.flatMap((item) => item.bodyIds))],
    palaces: [...new Set(parts.flatMap((item) => item.palaces))],
    text: parts.map((item) => item.text).join("；"),
  };
}

function allStatuses(
  chart: ZhengyuResult,
  marks: string[],
  status: "垣" | "殿" | "失垣" | "失躔",
): GejuEvidence | undefined {
  const parts = marks.map((mark) => hasStatus(chart, mark, status));
  return parts.every(Boolean) ? combineEvidence(parts as GejuEvidence[]) : undefined;
}

function sameAtBranch(
  chart: ZhengyuResult,
  marks: string[],
  branch: string,
): GejuEvidence | undefined {
  const same = sameHouse(chart, marks);
  const located = branchIs(chart, marks[0]!, branch);
  return same && located ? combineEvidence([same, located]) : undefined;
}

function allAloneInSigns(chart: ZhengyuResult, marks: string[]): GejuEvidence | undefined {
  const parts = marks.map((mark) => aloneInSign(chart, mark));
  const signs = marks.map((mark) => planet(chart, mark)?.sign);
  return parts.every(Boolean) && new Set(signs).size === marks.length
    ? combineEvidence(parts as GejuEvidence[]) : undefined;
}

function bothStatus(
  chart: ZhengyuResult,
  mark: string,
  first: "垣" | "殿" | "失垣" | "失躔",
  second: "垣" | "殿" | "失垣" | "失躔",
): GejuEvidence | undefined {
  const one = hasStatus(chart, mark, first);
  const two = hasStatus(chart, mark, second);
  return one && two ? combineEvidence([one, two]) : undefined;
}

function seasonalSameHouse(
  chart: ZhengyuResult,
  marks: string[],
  seasons: Array<ReturnType<typeof season>>,
): GejuEvidence | undefined {
  const same = sameHouse(chart, marks);
  if (!same || !seasons.includes(season(chart))) return undefined;
  return combineEvidence([same, evidence([], [], `${monthBranch(chart)}月属${season(chart)}`)]);
}

function specialPredicate(entry: GejuCatalogueEntry): Predicate | undefined {
  const signLoss: Readonly<Record<string, string>> = {
    木入金乡: "木", 土在木宫: "土", 水居土室: "水",
    火居水地: "火", 金乘火位: "金",
  };
  if (signLoss[entry.name]) {
    const mark = signLoss[entry.name]!;
    return (chart) => signElementLoss(chart, mark);
  }
  const branchRules: Readonly<Record<string, [string, string]>> = {
    日出扶桑: ["日", "卯"], 月在沧海: ["月", "酉"], 土埋双女: ["土", "巳"],
    水泛白羊: ["水", "戌"], 木入土室: ["木", "丑"], 土居水地: ["土", "申"],
  };
  const branchRule = branchRules[entry.name];
  if (branchRule) return (chart) => branchIs(chart, branchRule[0], branchRule[1]);
  const fixedBranchRules: Readonly<Record<string, [string[], string]>> = {
    水润金明: [["金", "水"], "辰"], 泉枯牛壑: [["水", "孛"], "丑"],
    水孛逢楚: [["水", "孛"], "巳"], 木计逢鱼: [["木", "计"], "亥"],
    金水辅阴: [["月", "金", "水"], "申酉戌"],
  };
  const fixed = fixedBranchRules[entry.name];
  if (fixed) return (chart) => sameAtBranch(chart, fixed[0], fixed[1]);
  if (entry.name === "日居日位") return (chart) => hasStatus(chart, "日", "垣");
  if (entry.name === "岁星居垣") return (chart) => hasStatus(chart, "木", "垣");
  if (entry.name === "荧惑居垣") return (chart) => hasStatus(chart, "火", "垣");
  if (entry.name === "月升月殿") return (chart) => hasStatus(chart, "月", "殿");
  if (entry.name === "日居月位") return (chart) => branchIs(chart, "日", "未");
  if (entry.name === "月到日宫") return (chart) => branchIs(chart, "月", "午");
  if (entry.name === "日躔月度") {
    return (chart) => mansionRuler(chart, planet(chart, "日")!) === "月"
      ? evidence(["日"], [planet(chart, "日")!.house], "太阳所躔宿由月所主") : undefined;
  }
  if (entry.name === "月躔日宿") {
    return (chart) => mansionRuler(chart, planet(chart, "月")!) === "日"
      ? evidence(["月"], [planet(chart, "月")!.house], "太阴所躔宿由日所主") : undefined;
  }
  if (entry.name === "孤阳无辅") return (chart) => aloneInSign(chart, "日");
  if (entry.name === "孤月独明") {
    return (chart) => !chart.day_night ? aloneInSign(chart, "月") : undefined;
  }
  if (entry.name === "寒月单行") {
    return (chart) => season(chart) === "winter" ? aloneInSign(chart, "月") : undefined;
  }
  if (entry.name === "四余独步") {
    return (chart) => allAloneInSigns(chart, ["计", "罗", "炁", "孛"]);
  }
  if (entry.name === "阴阳俱晦") {
    return (chart) => !chart.day_night ? sameHouse(chart, ["日", "月"]) : undefined;
  }
  const seasonal: Readonly<Record<string, [string[], Array<ReturnType<typeof season>>]>> = {
    木火文明: [["木", "火"], ["winter", "spring"]],
    土金坚实: [["土", "金"], ["spring", "summer"]],
    金水相涵: [["金", "水"], ["spring", "summer", "autumn"]],
    火土高强: [["火", "土"], ["autumn", "winter", "spring"]],
  };
  const seasonalRule = seasonal[entry.name];
  if (seasonalRule) {
    return (chart) => seasonalSameHouse(chart, seasonalRule[0], seasonalRule[1]);
  }
  if (entry.name === "火月同宵") {
    return (chart) => !chart.day_night ? sameHouse(chart, ["火", "月"]) : undefined;
  }
  if (entry.name === "金助月华") {
    return (chart) => chart.day_night && season(chart) === "winter"
      ? undefined : sameHouse(chart, ["金", "月"]);
  }
  if (entry.name === "木月清贵") {
    return (chart) => season(chart) === "winter" && sameHouse(chart, ["日", "月"])
      ? undefined : sameHouse(chart, ["木", "月"]);
  }
  const monthSame: Readonly<Record<string, [string, string]>> = {
    白虎从驾: ["申酉", "金"], 玄武持旗: ["亥子", "水"],
    青龙扶砚: ["寅卯", "木"], 勾陈镇殿: ["辰戌丑未", "土"],
  };
  const monthRule = monthSame[entry.name];
  if (monthRule) {
    return (chart) => monthRule[0].includes(monthBranch(chart))
      ? sameHouse(chart, [monthRule[1], "日"]) : undefined;
  }
  if (entry.name === "水附阳光") return (chart) => sameHouse(chart, ["日", "月", "水"]);
  if (entry.name === "火罗犯日") return (chart) => sameHouse(chart, ["日", "火", "罗"]);
  if (entry.name === "罗月交辉") {
    return (chart) => !chart.day_night ? sameHouse(chart, ["日", "月", "罗"])
      : undefined;
  }
  if (entry.name === "日南月北") {
    return (chart) => {
      const sun = branchIs(chart, "日", "巳午未");
      const moon = branchIs(chart, "月", "亥子丑");
      return sun && moon ? combineEvidence([sun, moon]) : undefined;
    };
  }
  if (entry.name === "日北月南") {
    return (chart) => {
      const sun = branchIs(chart, "日", "亥子丑");
      const moon = branchIs(chart, "月", "巳午未");
      return sun && moon ? combineEvidence([sun, moon]) : undefined;
    };
  }
  if (entry.name === "山泽沉埋") {
    return (chart) => {
      const metal = branchIs(chart, "金", "寅");
      const wood = branchIs(chart, "木", "酉");
      return metal && wood ? combineEvidence([metal, wood]) : undefined;
    };
  }
  return undefined;
}

function flankSign(chart: ZhengyuResult, targetSign: number): GejuEvidence | undefined {
  const sun = planet(chart, "日");
  const moon = planet(chart, "月");
  if (!sun || !moon) return undefined;
  const previous = targetSign === 1 ? 12 : targetSign - 1;
  const next = targetSign === 12 ? 1 : targetSign + 1;
  if (new Set([sun.sign, moon.sign]).size !== 2 ||
      ![sun.sign, moon.sign].every((sign) => sign === previous || sign === next)) {
    return undefined;
  }
  return evidence(["日", "月"], [sun.house, moon.house],
    `日、月分居${BRANCH_BY_SIGN[previous]}、${BRANCH_BY_SIGN[next]}，` +
      `夹${BRANCH_BY_SIGN[targetSign]}宫`);
}

function trineSign(chart: ZhengyuResult, targetSign: number): GejuEvidence | undefined {
  const sun = planet(chart, "日");
  const moon = planet(chart, "月");
  if (!sun || !moon) return undefined;
  const signs = [((targetSign + 3) % 12) + 1, ((targetSign + 7) % 12) + 1];
  if (new Set([sun.sign, moon.sign]).size !== 2 ||
      ![sun.sign, moon.sign].every((sign) => signs.includes(sign))) return undefined;
  return evidence(["日", "月"], [sun.house, moon.house],
    `日、月分居${signs.map((sign) => BRANCH_BY_SIGN[sign]).join("、")}，` +
      `三合${BRANCH_BY_SIGN[targetSign]}宫`);
}

function palaceSign(chart: ZhengyuResult, label: string): number | undefined {
  const house = PALACE_HOUSES[label];
  return house ? chart.houses1[String(house)]?.sign : undefined;
}

function flankPalace(chart: ZhengyuResult, label: string): GejuEvidence | undefined {
  const sign = palaceSign(chart, label);
  return sign ? flankSign(chart, sign) : undefined;
}

function trinePalace(chart: ZhengyuResult, label: string): GejuEvidence | undefined {
  const sign = palaceSign(chart, label);
  return sign ? trineSign(chart, sign) : undefined;
}

function directStatusRule(note: string): { mark: string; status: "垣" | "殿" | "失垣" |
  "失躔" } | undefined {
  const lost = note.match(new RegExp(
    `^([${DIRECT_MARKS}])所在(星宿|地支)五行克\\1$`,
  ));
  if (lost) return { mark: lost[1]!, status: lost[2] === "星宿" ? "失躔" : "失垣" };
  const match = note.match(new RegExp(`^([${DIRECT_MARKS}])(?:星|所在星宿|所在地支)?` +
    `(入本垣|入本殿|入垣|升殿|失垣|失躔)$`));
  if (!match) return undefined;
  const raw = match[2]!;
  return {
    mark: match[1]!,
    status: raw.includes("殿") ? "殿" : raw.includes("失垣") ? "失垣" :
      raw.includes("失躔") ? "失躔" : "垣",
  };
}

function predicateFor(entry: GejuCatalogueEntry): Predicate | undefined {
  const note = entry.note;
  const special = specialPredicate(entry);
  if (special) return special;
  const status = directStatusRule(note);
  if (status) return (chart) => hasStatus(chart, status.mark, status.status);

  const palace = note.match(
    /^(男女|田宅|财帛|官禄|福德|夫妻)宫主(入垣|失垣|失躔|人庙升殿)$/,
  );
  if (palace) {
    const raw = palace[2]!;
    const kind = raw.includes("升殿") ? "殿" : raw as "垣" | "失垣" | "失躔";
    return (chart) => palaceStatus(chart, palace[1]!, kind);
  }
  const bothPalaces = note.match(
    /^(官禄、福德|田宅、财帛|夫妻、男女)宫主皆(失垣|失躔)$/,
  );
  if (bothPalaces) {
    const labels = bothPalaces[1]!.split("、");
    const kind = bothPalaces[2]! as "失垣" | "失躔";
    return (chart) => {
      const matches = labels.map((label) => palaceStatus(chart, label, kind));
      if (matches.some((item) => !item)) return undefined;
      return {
        bodyIds: matches.flatMap((item) => item!.bodyIds),
        palaces: matches.flatMap((item) => item!.palaces),
        text: matches.map((item) => item!.text).join("；"),
      };
    };
  }
  const pairStatus = note.match(new RegExp(
    `^([${DIRECT_MARKS}])、([${DIRECT_MARKS}])皆(失垣|失躔)$`,
  ));
  if (pairStatus) {
    return (chart) => allStatuses(chart, [pairStatus[1]!, pairStatus[2]!],
      pairStatus[3]! as "失垣" | "失躔");
  }
  const doubleStatus = note.match(new RegExp(
    `^([${DIRECT_MARKS}])同时(失垣)、(失躔)$`,
  ));
  if (doubleStatus) {
    return (chart) => bothStatus(chart, doubleStatus[1]!, "失垣", "失躔");
  }
  const same = note.match(new RegExp(
    `^([${DIRECT_MARKS}])(?:星)?[与、]([${DIRECT_MARKS}])同宫`,
  ));
  if (same) return (chart) => sameHouse(chart, [same[1]!, same[2]!]);
  const adjacent = note.match(new RegExp(`^([${DIRECT_MARKS}])([${DIRECT_MARKS}])同宫`));
  if (adjacent) return (chart) => sameHouse(chart, [adjacent[1]!, adjacent[2]!]);
  const opposed = note.match(new RegExp(`^([${DIRECT_MARKS}])的对宫见([${DIRECT_MARKS}])$`));
  if (opposed) return (chart) => opposite(chart, opposed[1]!, opposed[2]!);
  const located = note.match(new RegExp(
    `^([${DIRECT_MARKS}])(?:星)?落入([子丑寅卯辰巳午未申酉戌亥])宫$`,
  ));
  if (located) return (chart) => branchIs(chart, located[1]!, located[2]!);

  if (entry.name === "金水从阳") {
    return (chart) => sameHouse(chart, ["日", "金", "水"]);
  }
  if (entry.name === "阴阳得地") {
    return (chart) => {
      const sun = branchIs(chart, "日", "寅卯辰巳午未");
      const moon = branchIs(chart, "月", "申酉戌亥子丑");
      return sun && moon ? evidence(["日", "月"], [...sun.palaces, ...moon.palaces],
        `${sun.text}；${moon.text}`) : undefined;
    };
  }
  if (entry.name === "日月失所") {
    return (chart) => {
      const sun = branchIs(chart, "日", "申酉戌亥子丑");
      const moon = branchIs(chart, "月", "寅卯辰巳午未");
      return sun && moon ? evidence(["日", "月"], [...sun.palaces, ...moon.palaces],
        `${sun.text}；${moon.text}`) : undefined;
    };
  }
  if (entry.name === "日西月东") {
    return (chart) => {
      const sun = branchIs(chart, "日", "申酉戌");
      const moon = branchIs(chart, "月", "寅卯辰");
      return sun && moon ? evidence(["日", "月"], [...sun.palaces, ...moon.palaces],
        `${sun.text}；${moon.text}`) : undefined;
    };
  }
  if (entry.name === "日东月西") {
    return (chart) => {
      const sun = branchIs(chart, "日", "寅卯辰");
      const moon = branchIs(chart, "月", "申酉戌");
      return sun && moon ? evidence(["日", "月"], [...sun.palaces, ...moon.palaces],
        `${sun.text}；${moon.text}`) : undefined;
    };
  }
  if (entry.name === "罗计中分") {
    return (chart) => {
      const north = branchIs(chart, "罗", "午");
      const opposed = opposite(chart, "罗", "计");
      return north && opposed ? evidence(["罗", "计"], opposed.palaces,
        `${north.text}；罗、计分居对宫`) : undefined;
    };
  }
  if (entry.name === "水火相射") {
    return (chart) => {
      const first = branchIs(chart, "水", "午");
      const second = branchIs(chart, "火", "子");
      return first && second ? evidence(["水", "火"], [...first.palaces, ...second.palaces],
        `${first.text}；${second.text}`) : undefined;
    };
  }
  if (entry.name === "火照天门") {
    return (chart) => {
      const fire = branchIs(chart, "火", "亥");
      const item = planet(chart, "火");
      return fire && item && chart.xingxiu_list[item.xingxiu]?.name === "室"
        ? evidence(["火"], fire.palaces, `${fire.text}，并躔室宿`)
        : undefined;
    };
  }
  if (entry.name === "土好宝瓶") {
    return (chart) => {
      const earth = branchIs(chart, "土", "子");
      const item = planet(chart, "土");
      return earth && item && chart.xingxiu_list[item.xingxiu]?.name === "虚"
        ? evidence(["土"], earth.palaces, `${earth.text}，并躔虚宿`)
        : undefined;
    };
  }
  if (entry.name === "太阴朝斗") {
    return (chart) => {
      const moon = branchIs(chart, "月", "丑");
      const item = planet(chart, "月");
      return moon && item && chart.xingxiu_list[item.xingxiu]?.name === "斗"
        ? evidence(["月"], moon.palaces, `${moon.text}，并躔斗宿`)
        : undefined;
    };
  }
  if (entry.name === "日陷奴宫") {
    return (chart) => planet(chart, "日")?.house === 6
      ? evidence(["日"], [6], "太阳落在奴仆宫（第 6 宫）") : undefined;
  }
  if (entry.name === "日月夹妻") return (chart) => flankPalace(chart, "夫妻");
  if (entry.name === "日月夹嗣") return (chart) => flankPalace(chart, "男女");
  if (entry.name === "日月拱官") return (chart) => trinePalace(chart, "官禄");
  if (entry.name === "日月拱嗣") return (chart) => trinePalace(chart, "男女");
  if (entry.name === "日月拱妻") return (chart) => trinePalace(chart, "夫妻");
  if (entry.name === "日月拱财") return (chart) => trinePalace(chart, "财帛");
  if (entry.name === "命坐两歧" || entry.name === "身坐两歧") {
    const key = entry.name.startsWith("命") ? "ming_zhu" : "shen_zhu";
    return (chart) => {
      const master = chart.ming_shen[key] as { house?: number; degree?: number;
        xingxiu_degree?: number } | undefined;
      if (!master?.house) return undefined;
      const near = Math.min(master.degree ?? 30, master.xingxiu_degree ?? 30) < 1;
      return near ? evidence([], [master.house],
        `${entry.name[0]}度距宫界或宿界不足 1°，落第 ${master.house} 宫`) : undefined;
    };
  }
  return undefined;
}

export function displayGejuCondition(entry: GejuCatalogueEntry): string {
  if (entry.name === "寒月单行") return "冬季孤月独行";
  return entry.note;
}

export function evaluateGeju(chart: ZhengyuResult): EvaluatedGeju[] {
  return GEJU_CATALOGUE.map((entry) => {
    const predicate = predicateFor(entry);
    const counts = QUALITY_BY_NAME.get(entry.name);
    const quality = counts ? {
      truePositive: counts[1],
      falsePositive: counts[2],
      falseNegative: counts[3],
      precision: ratio(counts[1], counts[1] + counts[2]),
      recall: ratio(counts[1], counts[1] + counts[3]),
    } : undefined;
    const shown = Boolean(quality && quality.truePositive >= 3 &&
      quality.precision >= 0.9 && quality.recall >= 0.8);
    return {
      ...entry,
      category: GEJU_GROUP_LABELS[entry.group],
      condition: displayGejuCondition(entry),
      implemented: Boolean(predicate),
      validation: !predicate ? "pending" : shown ? "shown" : "failed",
      quality,
      evidence: predicate?.(chart),
    };
  });
}

export function gejuImplementationCount(): { implemented: number; pending: number; total: number } {
  const implemented = GEJU_CATALOGUE.filter((entry) => Boolean(predicateFor(entry))).length;
  return { implemented, pending: GEJU_CATALOGUE.length - implemented,
    total: GEJU_CATALOGUE.length };
}
