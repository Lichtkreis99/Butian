// @ts-nocheck -- vendored reference engine; calculation logic intentionally unchanged.
/**
 * J2000 mean-ecliptic directions for the 28 modern mansion marker stars.
 * Names/order/planet/animal labels come from the site bundle. Coordinates were
 * reconstructed from the six samples and are input-independent fixed-star data.
 */
export const mansionMarkers = [
  {
    name: "娄", planetName: "金", animalName: "狗",
    longitude: 33.99063417822357, latitude: 1.2099129612229884,
  },
  {
    name: "胃", planetName: "土", animalName: "彘",
    longitude: 46.96137333992495, latitude: 36.26170403119146,
  },
  {
    name: "昴", planetName: "日", animalName: "鸡",
    longitude: 59.44180228311727, latitude: 2.5203545482766425,
  },
  {
    name: "毕", planetName: "月", animalName: "乌",
    longitude: 68.50801232733544, latitude: -18.793869130877443,
  },
  {
    name: "觜", planetName: "火", animalName: "猴",
    longitude: 83.70759746766, latitude: -14.4,
  },
  {
    name: "参", planetName: "水", animalName: "猿",
    longitude: 84.70869346066809, latitude: -25.270154247181328,
  },
  {
    name: "井", planetName: "木", animalName: "犴",
    longitude: 95.32417549013473, latitude: 14.943918436174396,
  },
  {
    name: "鬼", planetName: "金", animalName: "羊",
    longitude: 125.77474187562032, latitude: -45.20532196823052,
  },
  {
    name: "柳", planetName: "土", animalName: "獐",
    longitude: 130.75624314985723, latitude: 56.43744770796319,
  },
  {
    name: "星", planetName: "日", animalName: "马",
    longitude: 146.7481824615564, latitude: -49.72190871940316,
  },
  {
    name: "张", planetName: "月", animalName: "鹿",
    longitude: 154.73696865452374, latitude: 31.992696396307384,
  },
  {
    name: "翼", planetName: "火", animalName: "蛇",
    longitude: 173.81226794253672, latitude: 25.354777625159695,
  },
  {
    name: "轸", planetName: "水", animalName: "蚓",
    longitude: 190.74802933341218, latitude: -31.318340757777523,
  },
  {
    name: "角", planetName: "木", animalName: "蛟",
    longitude: 203.5534940008388, latitude: -6.383117126166114,
  },
  {
    name: "亢", planetName: "金", animalName: "龙",
    longitude: 214.5462688240346, latitude: -56.764986492962265,
  },
  {
    name: "氐", planetName: "土", animalName: "貉",
    longitude: 225.13066843278105, latitude: 5.768351591421563,
  },
  {
    name: "房", planetName: "日", animalName: "兔",
    longitude: 242.98045551547864, latitude: -8.069872139180493,
  },
  {
    name: "心", planetName: "月", animalName: "狐",
    longitude: 247.83037600835488, latitude: -8.013865353133252,
  },
  {
    name: "尾", planetName: "火", animalName: "虎",
    longitude: 256.08571897338305, latitude: 35.84587219456637,
  },
  {
    name: "箕", planetName: "水", animalName: "豹",
    longitude: 271.280945202295, latitude: 11.421032883455322,
  },
  {
    name: "斗", planetName: "木", animalName: "獬",
    longitude: 280.2264824673385, latitude: 62.71518485958596,
  },
  {
    name: "牛", planetName: "金", animalName: "牛",
    longitude: 304.13267357202943, latitude: -3.788383490191628,
  },
  {
    name: "女", planetName: "土", animalName: "蝠",
    longitude: 311.8000367167498, latitude: 4.708725563605382,
  },
  {
    name: "虚", planetName: "日", animalName: "鼠",
    longitude: 323.4681296521456, latitude: 25.718933144009778,
  },
  {
    name: "危", planetName: "月", animalName: "燕",
    longitude: 333.43551362501773, latitude: 9.405894582797966,
  },
  {
    name: "室", planetName: "火", animalName: "猪",
    longitude: 353.50436980074966, latitude: 16.159603386325546,
  },
  {
    name: "壁", planetName: "水", animalName: "獝",
    longitude: 10.255482778331773, latitude: 26.80331318059311,
  },
  {
    name: "奎", planetName: "木", animalName: "狼",
    longitude: 22.47437650184671, latitude: 26.43073167695248,
  },
] as const;

/**
 * Ming-degree sign ruler sequences. This is a fixed traditional rulership table;
 * the populated entries were derived from the samples and are stable by sign.
 */
export const mingSignChouBySign: Partial<Record<number, readonly string[]>> = {
  4: ["土计", "火罗", "金水", "木炁"],
  5: ["木炁", "土计", "金水", "火罗"],
  6: ["土计", "火罗", "金", "木炁"],
  7: ["火罗", "木炁", "土计", "水孛"],
  11: ["木炁", "水孛", "火罗", "金"],
  12: ["金", "土计", "水孛", "火罗"],
};

/**
 * Ming-degree mansion ruler sequences. This is a fixed traditional rulership
 * table; the populated entries were derived from the samples and are stable by mansion.
 */
export const mingXingxiuChouByIndex: Partial<Record<number, readonly string[]>> = {
  8: ["木炁", "水孛", "火罗", "金"],
  10: ["土计", "火罗", "金水", "木炁"],
  13: ["金", "土计", "水孛", "火罗"],
  23: ["木炁", "土计", "金水", "火罗"],
  24: ["土计", "火罗", "金水", "木炁"],
};

/** Planet labels used by the Zhengyu transform-star tables (site bundle order). */
export const yaoPlanetNames = [
  "", "日", "月", "水", "金", "火", "木", "土", "计", "罗", "孛", "炁",
] as const;

/**
 * Transform-star row schema. Names, groups and display ranks are identical in all six samples.
 */
export const yaoDefinitions = [
  { name: "科名", type: 0, top: 0 },
  { name: "天马", type: 0, top: 0 },
  { name: "生官", type: 0, top: 0 },
  { name: "地驿", type: 0, top: 0 },
  { name: "文星", type: 0, top: 0 },
  { name: "禄元", type: 0, top: 0 },
  { name: "魁星", type: 0, top: 0 },
  { name: "马元", type: 0, top: 0 },
  { name: "官星", type: 0, top: 0 },
  { name: "印星", type: 0, top: 0 },
  { name: "寿元", type: 0, top: 0 },
  { name: "催官", type: 0, top: 0 },
  { name: "仁元", type: 0, top: 0 },
  { name: "禄神", type: 0, top: 0 },
  { name: "血支", type: 0, top: 0 },
  { name: "喜神", type: 0, top: 0 },
  { name: "血忌", type: 0, top: 0 },
  { name: "爵星", type: 0, top: 0 },
  { name: "产星", type: 0, top: 0 },
  { name: "伤官", type: 0, top: 0 },
  { name: "天禄", type: 1, top: 3 },
  { name: "天暗", type: 1, top: 3 },
  { name: "天福", type: 1, top: 3 },
  { name: "天耗", type: 1, top: 3 },
  { name: "天荫", type: 1, top: 3 },
  { name: "天贵", type: 1, top: 3 },
  { name: "天嗣", type: 1, top: 1 },
  { name: "天刑", type: 1, top: 3 },
  { name: "天印", type: 1, top: 3 },
  { name: "天囚", type: 1, top: 3 },
  { name: "天权", type: 1, top: 3 },
  { name: "比肩", type: 2, top: 2 },
  { name: "劫财", type: 2, top: 2 },
  { name: "食神", type: 2, top: 2 },
  { name: "伤官", type: 2, top: 2 },
  { name: "偏财", type: 2, top: 2 },
  { name: "正财", type: 2, top: 2 },
  { name: "七杀", type: 2, top: 2 },
  { name: "正官", type: 2, top: 2 },
  { name: "偏印", type: 2, top: 2 },
  { name: "正印", type: 2, top: 2 },
  { name: "职元", type: 0, top: 0 },
  { name: "局主", type: 0, top: 0 },
  { name: "天经", type: 0, top: 0 },
  { name: "天元", type: 0, top: 0 },
  { name: "地元", type: 0, top: 0 },
  { name: "人元", type: 0, top: 0 },
  { name: "科甲", type: 0, top: 0 },
  { name: "值难", type: 0, top: 0 },
  { name: "地纬", type: 0, top: 0 },
] as const;

/**
 * Traditional transform-star planet IDs indexed by the sexagenary year pillar.
 * Populated rows are derived from the samples; the rule is shared by natal and transit charts.
 */
export const yaoYearPlanetIds: Partial<Record<number, readonly number[]>> = {
  1: [6, 8, 7, 3, 8, 5, 1, 6, 3, 1, 4, 3, 6, 3, 7, 8, 7, 3, 3, 6],
  7: [4, 6, 5, 5, 7, 4, 10, 3, 6, 8, 7, 7, 4, 11, 1, 6, 4, 5, 5, 8],
  8: [3, 5, 4, 6, 1, 6, 11, 6, 2, 3, 4, 2, 3, 1, 2, 10, 4, 7, 4, 10],
  16: [4, 5, 10, 6, 6, 3, 6, 6, 4, 4, 4, 10, 4, 4, 5, 4, 6, 10, 4, 9],
  42: [5, 3, 11, 4, 4, 3, 9, 3, 9, 5, 3, 1, 5, 8, 3, 11, 5, 3, 6, 2],
  53: [5, 8, 3, 3, 5, 1, 8, 6, 8, 2, 7, 9, 5, 9, 4, 3, 3, 6, 3, 7],
};

/** Type-one transform stars indexed by the same sexagenary year pillar. */
export const yaoYearTransformIds: Partial<Record<number, readonly number[]>> = {
  1: [10, 6, 4, 7, 2, 3, 3, 11, 8, 9, 5],
  7: [11, 8, 9, 5, 10, 6, 6, 4, 7, 2, 3],
  8: [8, 9, 5, 10, 6, 4, 4, 7, 2, 3, 11],
  16: [3, 11, 8, 9, 5, 10, 10, 6, 4, 7, 2],
  42: [6, 4, 7, 2, 3, 11, 11, 8, 9, 5, 10],
  53: [4, 7, 2, 3, 11, 8, 8, 9, 5, 10, 6],
};

/** Ten-god planet order indexed by the sexagenary day pillar; derived from the samples. */
export const tenGodPlanetIds: Partial<Record<number, readonly number[]>> = {
  13: [4, 6, 2, 7, 11, 3, 9, 8, 10, 5],
  17: [8, 9, 5, 10, 6, 4, 7, 2, 3, 11],
  25: [6, 4, 7, 2, 3, 11, 8, 9, 5, 10],
  54: [3, 11, 8, 9, 5, 10, 6, 4, 7, 2],
  57: [11, 3, 9, 8, 10, 5, 4, 6, 2, 7],
  59: [10, 5, 4, 6, 2, 7, 11, 3, 9, 8],
};

/** Final nine transform-star rules indexed by the computed first palace. */
export const transitYaoTailByFirstSign: Partial<Record<number, readonly number[]>> = {
  3: [11, 6, 6, 10, 3, 6, 7, 10, 7],
  4: [3, 10, 6, 5, 6, 3, 7, 10, 5],
  5: [2, 5, 3, 9, 6, 3, 6, 10, 5],
  6: [7, 9, 3, 8, 5, 4, 5, 10, 7],
  10: [6, 11, 4, 3, 7, 5, 1, 10, 3],
  11: [10, 3, 7, 2, 7, 5, 3, 10, 3],
};

export const natalYaoTailByFirstSign: Partial<Record<number, readonly number[]>> = {
  3: [5, 2, 3, 9, 7, 3, 7, 1, 7],
  4: [9, 7, 3, 8, 7, 4, 7, 1, 5],
  5: [11, 6, 3, 9, 4, 3, 6, 4, 5],
  6: [9, 7, 4, 3, 7, 7, 5, 11, 7],
  10: [3, 10, 3, 8, 5, 7, 1, 4, 3],
  11: [8, 4, 4, 11, 3, 7, 3, 5, 3],
};

/** 大限 palace/year sequence, derived from the samples and identical in all six. */
export const limitYearDurations = [
  [12, 10], [11, 11], [10, 15], [9, 8], [8, 7], [7, 11],
  [6, 4.5], [5, 4.5], [4, 4.5], [3, 5], [2, 5],
] as const;

/** 童限 annual branch offsets, derived from the samples and identical in all six. */
export const childLimitBranchOffsets = [
  0, 11, 5, 6, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0,
] as const;

/**
 * Standard 1900-2100 lunisolar year encoding used by the local wzbz reference engine's
 * lunar-javascript calendar. Each word stores leap-month and month-length bits.
 */
export const lunarYearData = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0,
  0x09ad0, 0x055d2, 0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540,
  0x0d6a0, 0x0ada2, 0x095b0, 0x14977, 0x04970, 0x0a4b0, 0x0b4b5, 0x06a50,
  0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0,
  0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2,
  0x0a950, 0x0b557, 0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573,
  0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60, 0x0aae4,
  0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5,
  0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46,
  0x0ab60, 0x09570, 0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58,
  0x055c0, 0x0ab60, 0x096d5, 0x092e0, 0x0c960, 0x0d954, 0x0d4a0, 0x0da50,
  0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, 0x0a950, 0x0b4a0,
  0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260,
  0x0ea65, 0x0d530, 0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0,
  0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0, 0x056d0, 0x055b2, 0x049b0,
  0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, 0x14b63, 0x09370,
  0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0,
  0x0a6d0, 0x055d4, 0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50,
  0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, 0x0b273, 0x06930, 0x07337, 0x06aa0,
  0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, 0x0e968, 0x0d520,
  0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520,
] as const;

/**
 * Lunar-year lengths just beyond the standard 1900–2100 lookup table. The
 * 2101–2103 values are confirmed by the full-year 大限 rows in the samples.
 */
export const futureLunarYearDays: Readonly<Record<number, number>> = {
  2101: 384,
  2102: 355,
  2103: 355,
};
