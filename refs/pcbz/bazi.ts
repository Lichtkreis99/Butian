import {
  Lunar,
  LunarUtil,
  Solar,
  type EightCharValue,
  type LunarValue,
  type SolarValue
} from "lunar-javascript";
import { computeShenSha } from "./fortune";

export type CalendarKind = "solar" | "lunar";
export type Gender = "male" | "female";

export interface BirthInput {
  name: string;
  gender: Gender;
  calendar: CalendarKind;
  date: string;
  time: string;
  leapMonth: boolean;
  place: string;
  trueSolar: boolean;
  longitude: number;
  latitude: number;
}

export interface PillarDetail {
  title: string;
  pillar: string;
  gan: string;
  zhi: string;
  mainGod: string;
  hiddenGan: string[];
  hiddenGod: string[];
  stage: string;
  selfStage: string;
  void: string;
  naYin: string;
  shenSha: string[];
}

export interface LuckPeriod {
  pillar: string;
  ages: string;
  years: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
  detail: PillarDetail;
  annual: AnnualPeriod[];
}

export interface MonthPeriod {
  name: string;
  pillar: string;
  detail: PillarDetail;
}

export interface AnnualPeriod {
  year: number;
  age: number;
  pillar: string;
  detail: PillarDetail;
  months: MonthPeriod[];
}

export interface BaziChart {
  input: BirthInput;
  solarDate: string;
  lunarDate: string;
  zodiac: string;
  constellation: string;
  xiu: string;
  taiXi: string;
  taiYuan: string;
  shenGong: string;
  mingGong: string;
  previousJie: string;
  nextJie: string;
  pillars: PillarDetail[];
  supplementalPillars: PillarDetail[];
  wuXingSeason: string[];
  luckStart: string;
  luckStartSolar: string;
  commander: string;
  luck: LuckPeriod[];
}

const defaultInput: BirthInput = {
  name: "命主",
  gender: "male",
  calendar: "solar",
  date: "1990-05-15",
  time: "08:00",
  leapMonth: false,
  place: "未知地 北京时间 --",
  trueSolar: true,
  longitude: 120,
  latitude: 39,
};

function safePart(value: string | undefined, fallback: string) {
  return value && value.trim() ? value.trim() : fallback;
}

export function normalizeBirthInput(
  values: Record<string, string | string[] | undefined>
): BirthInput {
  const one = (key: string) => {
    const value = values[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const calendar = one("calendar") === "lunar" ? "lunar" : "solar";
  const gender = one("gender") === "female" ? "female" : "male";
  const coordinate = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(one(key));
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  };

  return {
    name: safePart(one("name"), defaultInput.name).slice(0, 20),
    gender,
    calendar,
    date: /^\d{4}-\d{2}-\d{2}$/.test(one("date") ?? "")
      ? (one("date") as string)
      : defaultInput.date,
    time: /^\d{2}:\d{2}$/.test(one("time") ?? "")
      ? (one("time") as string)
      : defaultInput.time,
    leapMonth: calendar === "lunar" && one("leap") === "1",
    place: safePart(one("place"), defaultInput.place).slice(0, 60),
    trueSolar: one("trueSolar") !== "0",
    longitude: coordinate("lng", defaultInput.longitude, -180, 180),
    latitude: coordinate("lat", defaultInput.latitude, -90, 90),
  };
}

function equationOfTime(year: number, month: number, day: number, hour: number) {
  const start = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - start) / 86_400_000) + 1;
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (hour - 12) / 24);
  return 229.18 * (0.000075 + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma)
    - 0.040849 * Math.sin(2 * gamma));
}

function correctedSolar(solar: SolarValue, hour: number, minute: number, longitude: number) {
  const year = solar.getYear();
  const month = solar.getMonth();
  const day = solar.getDay();
  // H5 module 0xDb: 4 minutes per degree from the China standard meridian,
  // then equation-of-time correction.
  const correction = 4 * (longitude - 120) + equationOfTime(year, month, day, hour);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute + Math.round(correction), 0));
  return Solar.fromYmdHms(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    0
  );
}

export function trueSolarDateTime(date: string, time: string, longitude: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return `${date} ${time}`.trim();
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return correctedSolar(
    Solar.fromYmdHms(year, month, day, hour, minute, 0),
    hour,
    minute,
    longitude
  ).toYmdHms().slice(0, 16);
}

function calendarValues(input: BirthInput): { solar: SolarValue; lunar: LunarValue } {
  const [year, month, day] = input.date.split("-").map(Number);
  const [hour, minute] = input.time.split(":").map(Number);

  if (input.calendar === "lunar") {
    const lunar = Lunar.fromYmdHms(year, input.leapMonth ? -month : month, day, hour, minute, 0);
    const solar = lunar.getSolar();
    if (!input.trueSolar) return { lunar, solar };
    const corrected = correctedSolar(solar, hour, minute, input.longitude);
    return { solar: corrected, lunar: corrected.getLunar() };
  }

  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  if (!input.trueSolar) return { solar, lunar: solar.getLunar() };
  const corrected = correctedSolar(solar, hour, minute, input.longitude);
  return { solar: corrected, lunar: corrected.getLunar() };
}

type PillarPrefix = "Year" | "Month" | "Day" | "Time";

const growthStages = [
  "长生", "沐浴", "冠带", "临官", "帝旺", "衰",
  "病", "死", "墓", "绝", "胎", "养"
];
const selfStageBranches: Record<string, string> = {
  甲: "亥子丑寅卯辰巳午未申酉戌",
  乙: "午巳辰卯寅丑子亥戌酉申未",
  丙: "寅卯辰巳午未申酉戌亥子丑",
  丁: "酉申未午巳辰卯寅丑子亥戌",
  戊: "寅卯辰巳午未申酉戌亥子丑",
  己: "酉申未午巳辰卯寅丑子亥戌",
  庚: "巳午未申酉戌亥子丑寅卯辰",
  辛: "子亥戌酉申未午巳辰卯寅丑",
  壬: "申酉戌亥子丑寅卯辰巳午未",
  癸: "卯寅丑子亥戌酉申未午巳辰",
};

function getSelfStage(gan: string, zhi: string) {
  const index = selfStageBranches[gan]?.indexOf(zhi) ?? -1;
  return index >= 0 ? growthStages[index] : "—";
}

function detailFromGanZhi(ganZhi: string, title: string, dayGan: string): PillarDetail {
  const gan = ganZhi.at(0) ?? "";
  const zhi = ganZhi.at(1) ?? "";
  const hiddenGan = LunarUtil.ZHI_HIDE_GAN[zhi] ?? [];
  return {
    title,
    pillar: ganZhi,
    gan,
    zhi,
    mainGod: LunarUtil.SHI_SHEN[`${dayGan}${gan}`] ?? "",
    hiddenGan,
    hiddenGod: hiddenGan.map((item) => LunarUtil.SHI_SHEN[`${dayGan}${item}`] ?? ""),
    stage: getSelfStage(dayGan, zhi),
    selfStage: getSelfStage(gan, zhi),
    void: LunarUtil.getXunKong(ganZhi),
    naYin: LunarUtil.NAYIN[ganZhi] ?? "",
    shenSha: [],
  };
}

function seasonStrength(monthZhi: string) {
  if ("寅卯".includes(monthZhi)) return ["木旺", "火相", "水休", "金囚", "土死"];
  if ("巳午".includes(monthZhi)) return ["火旺", "土相", "木休", "水囚", "金死"];
  if ("申酉".includes(monthZhi)) return ["金旺", "水相", "土休", "火囚", "木死"];
  if ("亥子".includes(monthZhi)) return ["水旺", "木相", "金休", "土囚", "火死"];
  return ["土旺", "金相", "火休", "木囚", "水死"];
}

const commanderPeriods: Record<string, Array<[string, number]>> = {
  寅: [["戊", 7], ["丙", 7], ["甲", 16]],
  卯: [["甲", 10], ["乙", 20]],
  辰: [["乙", 9], ["癸", 3], ["戊", 18]],
  巳: [["戊", 5], ["庚", 9], ["丙", 16]],
  午: [["丙", 10], ["己", 9], ["丁", 11]],
  未: [["丁", 9], ["乙", 3], ["己", 18]],
  申: [["戊己", 10], ["壬", 3], ["庚", 17]],
  酉: [["庚", 10], ["辛", 20]],
  戌: [["辛", 9], ["丁", 3], ["戊", 18]],
  亥: [["戊", 7], ["甲", 5], ["壬", 18]],
  子: [["壬", 10], ["癸", 20]],
  丑: [["癸", 9], ["辛", 3], ["己", 18]],
};
const commanderElements: Record<string, string> = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  戊己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水"
};

/** Uses the H5 default 《子平真诠》人元司令分野 table, measured from the preceding
 * month Jie. */
function calculateCommander(solar: SolarValue, lunar: LunarValue, monthZhi: string) {
  const periods = commanderPeriods[monthZhi] ?? [];
  const elapsedMinutes = Math.max(0, solar.subtractMinute(lunar.getPrevJie().getSolar()));
  let boundary = 0;
  let stem = periods.at(-1)?.[0] ?? "";
  for (const [candidate, days] of periods) {
    boundary += days * 24 * 60;
    if (elapsedMinutes < boundary)
      { stem = candidate; break; }
  }
  return stem ? `${stem}${commanderElements[stem]}司令` : "";
}

function pillar(eightChar: EightCharValue, prefix: PillarPrefix, title: string): PillarDetail {
  const call = <T>(suffix: string) => {
    const method = eightChar[`get${prefix}${suffix}` as keyof EightCharValue] as (() => T);
    return method.call(eightChar);
  };

  const gan = call<string>("Gan");
  const zhi = call<string>("Zhi");

  return {
    title,
    pillar: call<string>(""),
    gan,
    zhi,
    mainGod: prefix === "Day" ? "日主" : call<string>("ShiShenGan"),
    hiddenGan: call<string[]>("HideGan"),
    hiddenGod: call<string[]>("ShiShenZhi"),
    stage: call<string>("DiShi"),
    selfStage: getSelfStage(gan, zhi),
    void: call<string>("XunKong"),
    naYin: call<string>("NaYin"),
    shenSha: [],
  };
}

export function calculateBazi(input: BirthInput): BaziChart {
  let values: { solar: SolarValue; lunar: LunarValue };
  try {
    values = calendarValues(input);
  } catch {
    values = calendarValues(defaultInput);
    input = defaultInput;
  }

  const eightChar = values.lunar.getEightChar();
  const yun = eightChar.getYun(input.gender === "male" ? 1 : 0, 2);
  const dayGan = eightChar.getDayGan();
  const natalPillars = [
    pillar(eightChar, "Year", "年柱"),
    pillar(eightChar, "Month", "月柱"),
    pillar(eightChar, "Day", "日柱"),
    pillar(eightChar, "Time", "时柱"),
  ];
  const withShenSha = (detail: PillarDetail) => ({
    ...detail,
    shenSha: computeShenSha(natalPillars, detail, input.gender)
  });
  const luck = yun
    .getDaYun(10)
    .filter((period) => period.getIndex() > 0)
    .slice(0, 9)
    .map((period) => {
      const ganZhi = period.getGanZhi();
      return {
        pillar: ganZhi,
        ages: `${period.getStartAge()}-${period.getEndAge()}岁`,
        years: `${period.getStartYear()}-${period.getEndYear()}`,
        startAge: period.getStartAge(),
        endAge: period.getEndAge(),
        startYear: period.getStartYear(),
        endYear: period.getEndYear(),
        detail: withShenSha(detailFromGanZhi(ganZhi, "大运", dayGan)),
        annual: period.getLiuNian(10).map((annual) => {
          const annualGanZhi = annual.getGanZhi();
          return {
            year: annual.getYear(),
            age: annual.getAge(),
            pillar: annualGanZhi,
            detail: withShenSha(detailFromGanZhi(annualGanZhi, "流年", dayGan)),
            months: annual.getLiuYue().map((month) => {
              const monthGanZhi = month.getGanZhi();
              return {
                name: `${month.getMonthInChinese()}月`,
                pillar: monthGanZhi,
                detail: withShenSha(detailFromGanZhi(monthGanZhi, "流月", dayGan)),
              };
            }),
          };
        }),
      };
    });

  const formatJie = (jie: ReturnType<LunarValue["getPrevJie"]>) => {
    const solar = jie.getSolar();
    return `${jie.getName()} ${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日`;
  };

  return {
    input,
    solarDate: values.solar.toYmdHms().slice(0, 16),
    lunarDate: `${values.lunar.toString()} ${eightChar.getTimeZhi()}时`,
    zodiac: values.lunar.getYearShengXiao(),
    constellation: values.solar.getXingZuo(),
    xiu: values.lunar.getXiu(),
    taiXi: `${eightChar.getTaiXi()} (${eightChar.getTaiXiNaYin()})`,
    taiYuan: `${eightChar.getTaiYuan()} (${eightChar.getTaiYuanNaYin()})`,
    shenGong: `${eightChar.getShenGong()} (${eightChar.getShenGongNaYin()})`,
    mingGong: `${eightChar.getMingGong()} (${eightChar.getMingGongNaYin()})`,
    previousJie: formatJie(values.lunar.getPrevJie()),
    nextJie: formatJie(values.lunar.getNextJie()),
    pillars: natalPillars.map(withShenSha),
    supplementalPillars: [
      withShenSha(detailFromGanZhi(eightChar.getShenGong(), "身宫", dayGan)),
      withShenSha(detailFromGanZhi(eightChar.getMingGong(), "命宫", dayGan)),
      withShenSha(detailFromGanZhi(eightChar.getTaiYuan(), "胎元", dayGan)),
    ],
    wuXingSeason: seasonStrength(eightChar.getMonthZhi()),
    luckStart: `出生后${yun.getStartYear()}年${yun.getStartMonth()}个月${yun.getStartDay()}天起运`,
    luckStartSolar: yun.getStartSolar().toYmdHms(),
    commander: calculateCommander(values.solar, values.lunar, eightChar.getMonthZhi()),
    luck,
  };
}
