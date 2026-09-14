import type { PillarDetail } from "./bazi";

export interface RelationSummary {
  heaven: string;
  earth: string;
  connections: RelationConnection[];
}

export interface RelationConnection {
  kind: "heaven" | "earth";
  relation: string;
  columnIndices: number[];
  pillars: string[];
}

const lookupByStem: Record<string, Record<string, string>> = {
  天乙贵人: {
    甲: "丑未", 戊: "丑未", 庚: "丑未", 乙: "子申", 己: "子申",
    丙: "亥酉", 丁: "亥酉", 壬: "卯巳", 癸: "卯巳", 辛: "寅午"
  },
  太极贵人: {
    甲: "子午", 乙: "子午", 丙: "卯酉", 丁: "卯酉", 戊: "辰戌丑未",
    己: "辰戌丑未", 庚: "寅亥", 辛: "寅亥", 壬: "巳申", 癸: "巳申"
  },
  文昌贵人: {
    甲: "巳", 乙: "午", 丙: "申", 戊: "申", 丁: "酉",
    己: "酉", 庚: "亥", 辛: "子", 壬: "寅", 癸: "卯"
  },
  羊刃: {
    甲: "卯", 乙: "寅", 丙: "午", 戊: "午", 丁: "巳",
    己: "巳", 庚: "酉", 辛: "申", 壬: "子", 癸: "亥"
  },
  禄神: {
    甲: "寅", 乙: "卯", 丙: "巳", 戊: "巳", 丁: "午",
    己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子"
  },
  金舆: {
    甲: "辰", 乙: "巳", 丙: "未", 丁: "申", 戊: "未",
    己: "申", 庚: "戌", 辛: "亥", 壬: "丑", 癸: "寅"
  },
  国印贵人: {
    甲: "戌", 乙: "亥", 丙: "丑", 丁: "寅", 戊: "丑",
    己: "寅", 庚: "辰", 辛: "巳", 壬: "未", 癸: "申"
  },
};
const lookupByBranchGroup: Record<string, Record<string, string>> = {
  驿马: { 申子辰: "寅", 寅午戌: "申", 巳酉丑: "亥", 亥卯未: "巳" },
  桃花: { 申子辰: "酉", 寅午戌: "卯", 巳酉丑: "午", 亥卯未: "子" },
  华盖: { 申子辰: "辰", 寅午戌: "戌", 巳酉丑: "丑", 亥卯未: "未" },
  将星: { 申子辰: "子", 寅午戌: "午", 巳酉丑: "酉", 亥卯未: "卯" },
  劫煞: { 申子辰: "巳", 寅午戌: "亥", 巳酉丑: "寅", 亥卯未: "申" },
  亡神: { 申子辰: "亥", 寅午戌: "巳", 巳酉丑: "申", 亥卯未: "寅" },
  灾煞: { 申子辰: "午", 寅午戌: "子", 巳酉丑: "卯", 亥卯未: "酉" },
};
const redLuan: Record<string, string> = { 子: "卯", 丑: "寅", 寅: "丑", 卯: "子", 辰: "亥", 巳: "戌", 午: "酉", 未: "申", 申: "未", 酉: "午", 戌: "巳", 亥: "辰" };
const tianXi: Record<string, string> = { 子: "酉", 丑: "申", 寅: "未", 卯: "午", 辰: "巳", 巳: "辰", 午: "卯", 未: "寅", 申: "丑", 酉: "子", 戌: "亥", 亥: "戌" };
const tianDe: Record<string, string> = { 寅: "丁", 卯: "申", 辰: "壬", 巳: "辛", 午: "亥", 未: "甲", 申: "癸", 酉: "寅", 戌: "丙", 亥: "乙", 子: "巳", 丑: "庚" };
const monthDe: Record<string, string> = { 寅: "丙", 午: "丙", 戌: "丙", 申: "壬", 子: "壬", 辰: "壬", 亥: "甲", 卯: "甲", 未: "甲", 巳: "庚", 酉: "庚", 丑: "庚" };
const solitary: Record<string, [string, string]> = {
  寅: ["巳", "丑"], 卯: ["巳", "丑"], 辰: ["巳", "丑"],
  巳: ["申", "辰"], 午: ["申", "辰"], 未: ["申", "辰"],
  申: ["亥", "未"], 酉: ["亥", "未"], 戌: ["亥", "未"],
  亥: ["寅", "戌"], 子: ["寅", "戌"], 丑: ["寅", "戌"],
};
const yinYangError = new Set([
  "丙子", "丁丑", "戊寅", "辛卯", "壬辰", "癸巳",
  "丙午", "丁未", "戊申", "辛酉", "壬戌", "癸亥"
]);
const kuiGang = new Set(["庚辰", "庚戌", "壬辰", "戊戌"]);
const tenDefeats = new Set([
  "甲辰", "乙巳", "壬申", "丙申", "丁亥",
  "庚辰", "戊戌", "癸亥", "辛巳", "己丑"
]);
const flyingBlade: Record<string, string> = {
  甲: "酉", 乙: "申", 丙: "子", 戊: "子", 丁: "亥",
  己: "亥", 庚: "卯", 辛: "寅", 壬: "午", 癸: "巳"
};
const flowingRosyCloud: Record<string, string> = {
  甲: "酉", 乙: "戌", 丙: "未", 丁: "申", 戊: "巳",
  己: "午", 庚: "辰", 辛: "卯", 壬: "亥", 癸: "寅"
};
const redBeauty: Record<string, string> = {
  甲: "午", 乙: "午", 丙: "寅", 丁: "未", 戊: "辰",
  己: "辰", 庚: "戌", 辛: "酉", 壬: "子", 癸: "申"
};
const heavenlyDoctor: Record<string, string> = {
  寅: "丑", 卯: "寅", 辰: "卯", 巳: "辰", 午: "巳", 未: "午",
  申: "未", 酉: "申", 戌: "酉", 亥: "戌", 子: "亥", 丑: "子"
};
const heavenlyKitchen: Record<string, string> = {
  甲: "巳", 乙: "午", 丙: "巳", 丁: "午", 戊: "申",
  己: "酉", 庚: "亥", 辛: "子", 壬: "寅", 癸: "卯"
};
const fortuneStar: Record<string, string> = {
  甲: "寅子", 丙: "寅子", 乙: "丑卯", 癸: "丑卯", 戊: "申",
  己: "未", 丁: "亥", 庚: "午", 辛: "巳", 壬: "辰"
};
const studyByNaYin: Record<string, [string, string, string, string]> = {
  金: ["巳", "辛巳", "申", "壬申"],
  木: ["亥", "己亥", "寅", "庚寅"],
  水: ["申", "甲申", "亥", "癸亥"],
  土: ["申", "戊申", "亥", "丁亥"],
  火: ["寅", "丙寅", "巳", "乙巳"]
};
const solitaryPhoenix = new Set([
  "乙巳", "丁巳", "辛亥", "戊申", "甲寅", "戊午", "壬子", "丙午"
]);
const tenSpiritDays = new Set([
  "甲辰", "乙亥", "丙辰", "丁酉", "戊午",
  "庚戌", "庚寅", "辛亥", "壬寅", "癸未"
]);
const sixElegantDays = new Set(["丙午", "丁未", "戊子", "戊午", "己丑", "己未"]);
const eightSpecialDays = new Set([
  "甲寅", "乙卯", "丁未", "戊戌", "己未", "庚申", "辛酉", "癸丑"
]);
const nineUglyDays = new Set([
  "丁酉", "戊子", "戊午", "己卯", "己酉", "辛卯", "辛酉", "壬子", "壬午"
]);

function groupTarget(groupTable: Record<string, string>, basis: string) {
  return Object.entries(groupTable).find(([group]) => group.includes(basis))?.[1] ?? "";
}

/**
 * Deterministic traditional 神煞 tables. Lookup bases mirror the common H5 output:
 * day stem (贵人/刃/禄/学堂/金舆/国印), year+day branch
 * (马/桃花/华盖/将星/劫煞/亡神/灾煞), year branch (红鸾/天喜/孤辰/寡宿),
 * month branch (天德/月德), and day pillar (魁罡/阴差阳错/十恶大败).
 */
export function computeShenSha(
  natal: PillarDetail[],
  target: PillarDetail,
  gender: "male" | "female"
) {
  const results: string[] = [];
  const yearGan = natal[0]?.gan ?? "";
  const yearZhi = natal[0]?.zhi ?? "";
  const monthZhi = natal[1]?.zhi ?? "";
  const dayGan = natal[2]?.gan ?? "";
  const dayZhi = natal[2]?.zhi ?? "";
  const add = (name: string, matches: boolean) => {
    if (matches && !results.includes(name)) results.push(name);
  };

  for (const [name, table] of Object.entries(lookupByStem))
    add(name, (table[dayGan] ?? "").includes(target.zhi));
  for (const [name, table] of Object.entries(lookupByBranchGroup)) {
    add(name, target.zhi === groupTarget(table, yearZhi)
      || target.zhi === groupTarget(table, dayZhi));
  }
  add("红鸾", target.zhi === redLuan[yearZhi]);
  add("天喜", target.zhi === tianXi[yearZhi]);
  add("孤辰", target.zhi === solitary[yearZhi]?.[0]);
  add("寡宿", target.zhi === solitary[yearZhi]?.[1]);
  add("天德贵人", target.gan === tianDe[monthZhi] || target.zhi === tianDe[monthZhi]);
  add("月德贵人", target.gan === monthDe[monthZhi]);
  add("天医", target.zhi === heavenlyDoctor[monthZhi]);
  add("飞刃", target.zhi === flyingBlade[dayGan]);
  add("流霞", target.zhi === flowingRosyCloud[dayGan]);
  add("红艳煞", target.zhi === redBeauty[dayGan]);
  add("天厨贵人", (heavenlyKitchen[dayGan] ?? "").includes(target.zhi)
    || (heavenlyKitchen[yearGan] ?? "").includes(target.zhi));
  add("福星贵人", (fortuneStar[dayGan] ?? "").includes(target.zhi)
    || (fortuneStar[yearGan] ?? "").includes(target.zhi));
  const study = studyByNaYin[natal[0]?.naYin.at(-1) ?? ""];
  add("学堂", Boolean(study) && target.title !== "年柱" && target.zhi === study[0]);
  add("正学堂", Boolean(study) && target.title !== "年柱" && target.pillar === study[1]);
  add("词馆", Boolean(study) && target.title !== "年柱" && target.zhi === study[2]);
  add("正词馆", Boolean(study) && target.title !== "年柱" && target.pillar === study[3]);
  const monthGroup = Object.keys(lookupByBranchGroup.驿马)
    .find((group) => group.includes(monthZhi)) ?? "";
  const virtueStems: Record<string, string> = {
    寅午戌: "丙丁戊癸",
    申子辰: "壬癸戊己丙辛甲",
    巳酉丑: "庚辛乙",
    亥卯未: "甲乙丁壬"
  };
  add("德秀贵人", (virtueStems[monthGroup] ?? "").includes(target.gan));
  const yearYang = "甲丙戊庚壬".includes(yearGan);
  const forwardYuanChen = (gender === "male" && yearYang) || (gender === "female" && !yearYang);
  const branches = "子丑寅卯辰巳午未申酉戌亥";
  const yuanChenForward = "未申酉戌亥子丑寅卯辰巳午";
  const yuanChenReverse = "巳午未申酉戌亥子丑寅卯辰";
  const yearIndex = branches.indexOf(yearZhi);
  add("元辰", yearIndex >= 0
    && target.zhi === (forwardYuanChen ? yuanChenForward : yuanChenReverse)[yearIndex]);
  if (target.title === "日柱") {
    const season = "寅卯辰".includes(monthZhi)
      ? "spring"
      : "巳午未".includes(monthZhi)
        ? "summer"
        : "申酉戌".includes(monthZhi) ? "autumn" : "winter";
    const pardonDay: Record<string, string> = {
      spring: "戊寅",
      summer: "甲午",
      autumn: "戊申",
      winter: "甲子"
    };
    const wasteDays: Record<string, string[]> = {
      spring: ["庚申", "辛酉"],
      summer: ["壬子", "癸亥"],
      autumn: ["甲寅", "乙卯"],
      winter: ["丙午", "丁巳"]
    };
    add("天赦日", target.pillar === pardonDay[season]);
    add("四废日", wasteDays[season].includes(target.pillar));
    add("魁罡日", kuiGang.has(target.pillar));
    add("阴差阳错", yinYangError.has(target.pillar));
    add("十恶大败", tenDefeats.has(target.pillar));
    add("孤鸾煞", solitaryPhoenix.has(target.pillar));
    add("十灵日", tenSpiritDays.has(target.pillar));
    add("六秀日", sixElegantDays.has(target.pillar));
    add("八专日", eightSpecialDays.has(target.pillar));
    add("九丑日", nineUglyDays.has(target.pillar));
  }
  const netBases = [yearZhi, dayZhi];
  add("天罗", (netBases.includes("戌") && target.zhi === "亥")
    || (netBases.includes("亥") && target.zhi === "戌"));
  add("地网", (netBases.includes("辰") && target.zhi === "巳")
    || (netBases.includes("巳") && target.zhi === "辰"));
  const peach = groupTarget(lookupByBranchGroup.桃花, yearZhi);
  const clashTarget: Record<string, string> = {
    子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅",
    卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳"
  };
  add("勾绞煞", target.zhi === clashTarget[peach]);
  return results;
}

const heavenCombines: Record<string, string> = {
  甲己: "甲己合化土", 乙庚: "乙庚合化金", 丙辛: "丙辛合化水",
  丁壬: "丁壬合化木", 戊癸: "戊癸合化火",
};
const heavenClashes = new Set(["甲庚", "乙辛", "丙壬", "丁癸"]);
const heavenOvercomes: Record<string, string> = {
  甲戊: "甲戊相克", 乙己: "乙己相克", 丙庚: "丙庚相克", 丁辛: "丁辛相克",
  戊壬: "戊壬相克", 己癸: "己癸相克", 甲庚: "庚甲相克", 乙辛: "辛乙相克",
  丙壬: "壬丙相克", 丁癸: "癸丁相克"
};
const branchCombines: Record<string, string> = {
  子丑: "子丑合化土", 寅亥: "寅亥合化木", 卯戌: "卯戌合化火",
  辰酉: "辰酉合化金", 巳申: "巳申合化水", 午未: "午未合化火",
};
const branchClashes = new Set(["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"]);
const branchHarms = new Set(["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"]);
const branchBreaks = new Set(["子酉", "丑辰", "寅亥", "卯午", "巳申", "未戌"]);
const halfCombines: Record<string, string> = {
  子申: "申子半合水局", 子辰: "子辰半合水局",
  卯亥: "亥卯半合木局", 卯未: "卯未半合木局",
  寅午: "寅午半合火局", 午戌: "午戌半合火局",
  巳酉: "巳酉半合金局", 丑酉: "酉丑半合金局",
};
const archCombines: Record<string, string> = {
  辰申: "申辰拱合子", 未亥: "亥未拱合卯", 寅戌: "寅戌拱合午", 丑巳: "巳丑拱合酉"
};
const archMeetings: Record<string, string> = {
  寅辰: "寅辰拱会卯", 巳未: "巳未拱会午", 申戌: "申戌拱会酉", 丑亥: "亥丑拱会子"
};
const hiddenCombines = new Set([
  "卯申", "午亥", "丑寅", "寅未", "子戌", "子辰", "巳酉", "寅午", "子巳"
]);
const tripleCombines: Array<[string, string]> = [
  ["申子辰", "申子辰三合水局"],
  ["亥卯未", "亥卯未三合木局"],
  ["寅午戌", "寅午戌三合火局"],
  ["巳酉丑", "巳酉丑三合金局"]
];
const tripleMeetings: Array<[string, string]> = [
  ["寅卯辰", "寅卯辰三会木局"],
  ["巳午未", "巳午未三会火局"],
  ["申酉戌", "申酉戌三会金局"],
  ["亥子丑", "亥子丑三会水局"],
  ["丑辰未戌", "丑辰未戌合土局"]
];

function sortedPair(first: string, second: string) {
  return [first, second].sort((a, b) =>
    "子丑寅卯辰巳午未申酉戌亥甲乙丙丁戊己庚辛壬癸".indexOf(a)
    - "子丑寅卯辰巳午未申酉戌亥甲乙丙丁戊己庚辛壬癸".indexOf(b)
  ).join("");
}

function containsGroup(values: string[], group: string) {
  return [...group].every((value) => values.includes(value));
}

function matchingIndexSets(values: string[], wanted: string[]) {
  const matches: number[][] = [];
  const walk = (wantedIndex: number, used: number[], chosen: number[]) => {
    if (wantedIndex === wanted.length) {
      matches.push(chosen);
      return;
    }
    values.forEach((value, valueIndex) => {
      if (value === wanted[wantedIndex] && !used.includes(valueIndex))
        walk(wantedIndex + 1, [...used, valueIndex], [...chosen, valueIndex]);
    });
  };
  walk(0, [], []);
  const seen = new Set<string>();
  return matches.filter((indices) => {
    const key = [...indices].sort((a, b) => a - b).join("-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function relationConnections(
  kind: "heaven" | "earth",
  labels: string[],
  values: string[],
  columns: PillarDetail[]
) {
  const alphabet = kind === "heaven" ? "甲乙丙丁戊己庚辛壬癸" : "子丑寅卯辰巳午未申酉戌亥";
  return labels.flatMap((relation) => {
    const wanted = [...relation].filter((character) => alphabet.includes(character));
    return matchingIndexSets(values, wanted).map((columnIndices) => ({
      kind,
      relation,
      columnIndices,
      pillars: columnIndices.map((index) => columns[index]?.title ?? ""),
    }));
  });
}

function branchPunishments(branches: string[]) {
  const results: string[] = [];
  if (containsGroup(branches, "寅巳申")) results.push("寅巳申三刑");
  else for (const pair of ["寅巳", "巳申", "申寅"])
    if (containsGroup(branches, pair)) results.push(`${pair}相刑`);
  if (containsGroup(branches, "丑戌未")) results.push("丑戌未三刑");
  else for (const pair of ["丑戌", "戌未", "未丑"])
    if (containsGroup(branches, pair)) results.push(`${pair}相刑`);
  if (containsGroup(branches, "子卯")) results.push("子卯相刑");
  for (const branch of ["酉", "亥", "午", "辰"])
    if (branches.filter((value) => value === branch).length > 1)
      results.push(`${branch}${branch}相刑`);
  return results;
}

/** Standard deterministic stem/branch relationship tables; selected flow columns
 * are included when supplied. */
export function computeRelations(columns: PillarDetail[]): RelationSummary {
  const heaven: string[] = [];
  const earth: string[] = [];
  const gans = columns.map((column) => column.gan).filter(Boolean);
  const branches = columns.map((column) => column.zhi).filter(Boolean);

  for (let first = 0; first < gans.length; first += 1) {
    for (let second = first + 1; second < gans.length; second += 1) {
      const pair = sortedPair(gans[first], gans[second]);
      if (heavenClashes.has(pair)) {
        const clash = `${pair}相冲`;
        if (!heaven.includes(clash)) heaven.push(clash);
      }
      const overcome = heavenOvercomes[pair];
      if (overcome && !heaven.includes(overcome)) heaven.push(overcome);
      const combination = heavenCombines[pair];
      if (combination && !heaven.includes(combination)) heaven.push(combination);
    }
  }

  for (let first = 0; first < branches.length; first += 1)
    for (let second = first + 1; second < branches.length; second += 1) {
    const pair = sortedPair(branches[first], branches[second]);
    const label = branchCombines[pair];
    if (label && !earth.includes(label)) earth.push(label);
  }
  for (const [group, label] of tripleCombines) {
    if (containsGroup(branches, group)) earth.push(label);
    else for (const [pair, halfLabel] of Object.entries(halfCombines))
      if ([...pair].every((branch) => group.includes(branch))
        && containsGroup(branches, pair) && !earth.includes(halfLabel))
        earth.push(halfLabel);
    if (!containsGroup(branches, group))
      for (const [pair, archLabel] of Object.entries(archCombines))
        if ([...pair].every((branch) => group.includes(branch))
          && containsGroup(branches, pair) && !earth.includes(archLabel))
          earth.push(archLabel);
  }
  const conditionalTriple: Array<[string, string, string]> = [
    ["辰申", "癸", "地支见申辰，天干见癸"],
    ["未亥", "乙", "地支见亥未，天干见乙"],
    ["寅戌", "丁", "地支见寅戌，天干见丁"],
    ["丑巳", "辛", "地支见巳丑，天干见辛"]
  ];
  for (const [pair, gan, label] of conditionalTriple)
    if (containsGroup(branches, pair) && gans.includes(gan)) earth.push(label);
  for (const [group, label] of tripleMeetings) {
    if (containsGroup(branches, group)) earth.push(label);
    else for (const [pair, archLabel] of Object.entries(archMeetings))
      if ([...pair].every((branch) => group.includes(branch))
        && containsGroup(branches, pair) && !earth.includes(archLabel))
        earth.push(archLabel);
  }
  const conditionalMeeting: Array<[string, string, string]> = [
    ["寅辰", "乙", "地支见寅辰，天干见乙"],
    ["巳未", "丁", "地支见巳未，天干见丁"],
    ["申戌", "辛", "地支见申戌，天干见辛"],
    ["丑亥", "癸", "地支见亥丑，天干见癸"]
  ];
  for (const [pair, gan, label] of conditionalMeeting)
    if (containsGroup(branches, pair) && gans.includes(gan)) earth.push(label);
  for (let first = 0; first < branches.length; first += 1)
    for (let second = first + 1; second < branches.length; second += 1) {
    const pair = sortedPair(branches[first], branches[second]);
    if (hiddenCombines.has(pair)) {
      const label = `${pair}暗合`;
      if (!earth.includes(label)) earth.push(label);
    }
  }
  earth.push(...branchPunishments(branches).filter((label) => !earth.includes(label)));
  for (let first = 0; first < branches.length; first += 1) {
    for (let second = first + 1; second < branches.length; second += 1) {
      const pair = sortedPair(branches[first], branches[second]);
      const labels = [
        branchClashes.has(pair) ? `${pair}相冲` : "",
        branchBreaks.has(pair) ? `${pair}相破` : "",
        branchHarms.has(pair) ? `${pair}相害` : "",
      ].filter(Boolean);
      for (const label of labels) if (!earth.includes(label)) earth.push(label);
    }
  }
  return {
    heaven: heaven.join(",") || "无合冲关系",
    earth: earth.join(",") || "无合冲关系",
    connections: [
      ...relationConnections("heaven", heaven, gans, columns),
      ...relationConnections("earth", earth, branches, columns),
    ],
  };
}
