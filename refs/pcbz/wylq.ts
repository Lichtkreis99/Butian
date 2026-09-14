import { Solar } from "lunar-javascript";

export type WylqElement = "木" | "火" | "土" | "金" | "水";

export interface WylqInput {
  date: string;
  time: string;
}

export interface WylqStep {
  index: number;
  name: string;
  start: string;
  end: string;
  primary: string;
  guest: string;
  relation?: string;
  active: boolean;
}

export interface WylqChart {
  input: WylqInput;
  starYear: number;
  yearPillar: string;
  lunar: string;
  jieQi: string;
  suiYun: string;
  suiYunShort: string;
  siTian: string;
  siTianTip: string;
  zaiQuan: string;
  zaiQuanTip: string;
  jiaoYun: string;
  activeYun: string;
  activeQi: string;
  wuyun: WylqStep[];
  liuqi: WylqStep[];
}

const stems = "甲乙丙丁戊己庚辛壬癸";
const branches = "子丑寅卯辰巳午未申酉戌亥";

const sixty = Array.from({
  length: 60,
}, (_, index) => `${stems[index % 10]}${branches[index % 12]}`);

const elementCycle: WylqElement[] = ["木", "火", "土", "金", "水"];
const guestQiCycle = [
  "厥阴风木",
  "少阴君火",
  "太阴湿土",
  "少阳相火",
  "阳明燥金",
  "太阳寒水",
];
const primaryQi = [
  "厥阴风木",
  "少阴君火",
  "少阳相火",
  "太阴湿土",
  "阳明燥金",
  "太阳寒水",
];

const qiTips: Record<string, string> = {
  厥阴风木: "（一阴）",
  少阴君火: "（二阴）",
  太阴湿土: "（三阴）",
  少阳相火: "（一阳）",
  阳明燥金: "（二阳）",
  太阳寒水: "（三阳）",
};

const stemMovement: Record<string, {
  element: WylqElement;
  strong: boolean;
  tone: string;
}> = {
  甲: {
    element: "土",
    strong: true,
    tone: "太宫",
  },

  乙: {
    element: "金",
    strong: false,
    tone: "少商",
  },

  丙: {
    element: "水",
    strong: true,
    tone: "太羽",
  },

  丁: {
    element: "木",
    strong: false,
    tone: "少角",
  },

  戊: {
    element: "火",
    strong: true,
    tone: "太徵",
  },

  己: {
    element: "土",
    strong: false,
    tone: "少宫",
  },

  庚: {
    element: "金",
    strong: true,
    tone: "太商",
  },

  辛: {
    element: "水",
    strong: false,
    tone: "少羽",
  },

  壬: {
    element: "木",
    strong: true,
    tone: "太角",
  },

  癸: {
    element: "火",
    strong: false,
    tone: "少徵",
  },
};

const siTianByBranch: Record<string, string> = {
  子: "少阴君火",
  午: "少阴君火",
  丑: "太阴湿土",
  未: "太阴湿土",
  寅: "少阳相火",
  申: "少阳相火",
  卯: "阳明燥金",
  酉: "阳明燥金",
  辰: "太阳寒水",
  戌: "太阳寒水",
  巳: "厥阴风木",
  亥: "厥阴风木",
};

const zaiQuanByBranch: Record<string, string> = {
  子: "阳明燥金",
  午: "阳明燥金",
  丑: "太阳寒水",
  未: "太阳寒水",
  寅: "厥阴风木",
  申: "厥阴风木",
  卯: "少阴君火",
  酉: "少阴君火",
  辰: "太阴湿土",
  戌: "太阴湿土",
  巳: "少阳相火",
  亥: "少阳相火",
};

// Branch-specific day/hour/minute offsets applied to 春分、芒种、处暑、立冬.
const yunOffsets: Record<string, Array<[number, number, number]>> = {
  子: [[13, 4, 15], [10, 5, 15], [7, 6, 45], [4, 8, 0]],
  辰: [[13, 4, 15], [10, 5, 15], [7, 6, 45], [4, 8, 0]],
  申: [[13, 4, 15], [10, 5, 15], [7, 6, 45], [4, 8, 0]],
  丑: [[13, 10, 15], [10, 11, 30], [7, 12, 45], [4, 14, 0]],
  巳: [[13, 10, 15], [10, 11, 30], [7, 12, 45], [4, 14, 0]],
  酉: [[13, 10, 15], [10, 11, 30], [7, 12, 45], [4, 14, 0]],
  寅: [[13, 16, 15], [10, 15, 30], [7, 18, 45], [4, 20, 0]],
  午: [[13, 16, 15], [10, 15, 30], [7, 18, 45], [4, 20, 0]],
  戌: [[13, 16, 15], [10, 15, 30], [7, 18, 45], [4, 20, 0]],
  卯: [[13, 22, 15], [10, 23, 30], [7, 0, 45], [4, 2, 0]],
  未: [[13, 22, 15], [10, 23, 30], [7, 0, 45], [4, 2, 0]],
  亥: [[13, 22, 15], [10, 23, 30], [7, 0, 45], [4, 2, 0]],
};

const guestMovement: Record<string, string[]> = {
  太木: ["木运太过", "火运不及", "土运太过", "金运不及", "水运太过"],
  少木: ["木运不及", "火运太过", "土运不及", "金运太过", "水运不及"],
  太火: ["火运太过", "土运不及", "金运太过", "水运不及", "木运不及"],
  少火: ["火运不及", "土运太过", "金运不及", "水运太过", "木运太过"],
  太土: ["土运太过", "金运不及", "水运太过", "木运太过", "火运不及"],
  少土: ["土运不及", "金运太过", "水运不及", "木运不及", "火运太过"],
  太金: ["金运太过", "水运不及", "木运不及", "火运太过", "土运不及"],
  少金: ["金运不及", "水运太过", "木运太过", "火运不及", "土运太过"],
  太水: ["水运太过", "木运太过", "火运不及", "土运太过", "金运不及"],
  少水: ["水运不及", "木运不及", "火运太过", "土运不及", "金运太过"],
};

function parseInput(input: WylqInput) {
  const [year, month, day] = input.date.split("-").map(Number);
  const [hour, minute] = input.time.split(":").map(Number);

  return {
    year,
    month,
    day,
    hour,
    minute,
    value: new Date(year, month - 1, day, hour, minute),
  };
}

function solarTerm(year: number, name: string) {
  const table = Solar.fromYmdHms(year, 7, 1, 12, 0, 0).getLunar().getJieQiTable();
  const value = table[name]?.toYmdHms();

  if (!value)
    throw new Error(`Missing solar term ${name} for ${year}`);

  return new Date(value.replace(/-/g, "/"));
}

function addOffset(date: Date, [days, hours, minutes]: [number, number, number]) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  value.setHours(value.getHours() + hours);
  value.setMinutes(value.getMinutes() + minutes);
  return value;
}

function formatDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

function yearPillar(year: number) {
  return sixty[((year - 1984) % 60 + 60) % 60];
}

function movementLabel(element: WylqElement, strong: boolean) {
  const tones: Record<WylqElement, [string, string]> = {
    木: ["太角", "少角"],
    火: ["太徵", "少徵"],
    土: ["太宫", "少宫"],
    金: ["太商", "少商"],
    水: ["太羽", "少羽"],
  };

  return `${element}运${strong ? "太过" : "不及"}|（${tones[element][strong ? 0 : 1]}）`;
}

function qiRelation(primary: string, guest: string) {
  const generates: Record<string, string> = {
    木: "火",
    火: "土",
    土: "金",
    金: "水",
    水: "木",
  };

  const controls: Record<string, string> = {
    木: "土",
    土: "水",
    水: "火",
    火: "金",
    金: "木",
  };

  const first = primary.at(-1) ?? "", second = guest.at(-1) ?? "";

  if (first === second)
    return "相得，同气";

  if (generates[first] === second)
    return "相得，小逆";

  if (generates[second] === first)
    return "相得，小顺";

  if (controls[first] === second)
    return "不相得，小逆";

  return controls[second] === first ? "不相得，小顺" : "";
}

function activeIndex(date: Date, boundaries: Date[]) {
  let result = boundaries.length - 2;

  boundaries.slice(0, -1).forEach((boundary, index) => {
    if (date >= boundary)
      result = index;
  });

  return result;
}

function movementSteps(stem: string, branch: string, year: number, date: Date) {
  const bases = [
    solarTerm(year, "春分"),
    solarTerm(year, "芒种"),
    solarTerm(year, "处暑"),
    solarTerm(year, "立冬"),
  ];

  const boundaries = [
    solarTerm(year, "大寒"),
    ...bases.map((base, index) => addOffset(base, yunOffsets[branch][index])),
    solarTerm(year + 1, "大寒"),
  ];

  const primaryStrong = "壬癸甲乙丙".includes(stem);
  const middle = stemMovement[stem];
  const active = activeIndex(date, boundaries);
  const guests = guestMovement[`${middle.strong ? "太" : "少"}${middle.element}`];

  return elementCycle.map((element, index) => ({
    index,
    name: ["初之运", "二之运", "三之运", "四之运", "五之运"][index],
    start: formatDate(boundaries[index]),
    end: formatDate(boundaries[index + 1]),
    primary: movementLabel(element, index % 2 === 0 ? primaryStrong : !primaryStrong).split("|")[0],
    guest: guests[index],
    active: index === active,
  }));
}

function qiSteps(branch: string, year: number, date: Date) {
  const boundaries = ["大寒", "春分", "小满", "大暑", "秋分", "小雪"].map(
    (name) => solarTerm(year, name),
  );
  boundaries.push(solarTerm(year + 1, "大寒"));
  const start = (
    guestQiCycle.indexOf(siTianByBranch[branch]) - 2 + guestQiCycle.length
  ) % guestQiCycle.length;
  const active = activeIndex(date, boundaries);

  return primaryQi.map((primary, index) => {
    const guest = guestQiCycle[(start + index) % guestQiCycle.length];

    return {
      index,
      name: ["初之气", "二之气", "三之气", "四之气", "五之气", "终之气"][index],
      start: formatDate(boundaries[index]),
      end: formatDate(boundaries[index + 1]),
      primary,
      guest,
      relation: qiRelation(primary, guest),
      active: index === active,
    };
  });
}

export function calculateWylq(input: WylqInput): WylqChart {
  const parsed = parseInput(input);
  const starYear = parsed.value < solarTerm(parsed.year, "大寒")
    ? parsed.year - 1
    : parsed.year;
  const pillar = yearPillar(starYear);
  const stem = pillar.at(0) ?? "";
  const branch = pillar.at(1) ?? "";
  const movement = stemMovement[stem];
  const wuyun = movementSteps(stem, branch, starYear, parsed.value);
  const liuqi = qiSteps(branch, starYear, parsed.value);
  const lunar = Solar.fromYmdHms(
    parsed.year,
    parsed.month,
    parsed.day,
    parsed.hour,
    parsed.minute,
    0,
  ).getLunar();
  const jiao = solarTerm(starYear, "大寒");
  const jiaoEight = Solar.fromYmdHms(
    jiao.getFullYear(),
    jiao.getMonth() + 1,
    jiao.getDate(),
    jiao.getHours(),
    jiao.getMinutes(),
    0,
  ).getLunar().getEightChar();
  const siTian = siTianByBranch[branch];
  const zaiQuan = zaiQuanByBranch[branch];

  return {
    input,
    starYear,
    yearPillar: pillar,
    lunar: `${lunar.toString()} ${lunar.getEightChar().getTimeZhi()}时`,
    jieQi: lunar.getPrevJieQi().getName(),
    suiYun: `${movement.element}运${movement.strong ? "太过" : "不及"}`,
    suiYunShort: `${movement.strong ? "太" : "少"}${movement.element}`,
    siTian,
    siTianTip: qiTips[siTian],
    zaiQuan,
    zaiQuanTip: qiTips[zaiQuan],
    jiaoYun: `${jiaoEight.getDay()}日、${jiaoEight.getTime()}时`,
    activeYun: wuyun.find((step) => step.active)?.name ?? "",
    activeQi: liuqi.find((step) => step.active)?.name ?? "",
    wuyun,
    liuqi,
  };
}

export function normalizeWylqInput(
  values: Record<string, string | string[] | undefined>,
): WylqInput {
  const now = new Date();
  const pick = (key: string, fallback: string) => {
    const value = values[key];
    return (Array.isArray(value) ? value[0] : value) || fallback;
  };

  const date = pick(
    "date",
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${
      String(now.getDate()).padStart(2, "0")
    }`,
  );
  const time = pick(
    "time",
    `${String(now.getHours()).padStart(2, "0")}:${
      String(now.getMinutes()).padStart(2, "0")
    }`,
  );

  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "2026-01-21",
    time: /^\d{2}:\d{2}$/.test(time) ? time : "12:00",
  };
}

export function elementOfWylq(value: string) {
  return elementCycle.find((element) => value.includes(element));
}
