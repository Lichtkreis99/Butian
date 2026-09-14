import { Solar } from "lunar-javascript";

export const heavenlyStems = [
  "甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"
] as const;
export const earthlyBranches = [
  "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"
] as const;

export interface ReverseBaziResult {
  date: string;
  time: string;
  label: string;
}

function matchesPillars(
  yearPillar: string,
  monthPillar: string,
  dayPillar: string,
  hourPillar: string,
  year: number,
  month: number,
  day: number,
  hour: number
) {
  const eightChar = Solar.fromYmdHms(year, month, day, hour, 0, 0).getLunar().getEightChar();
  return eightChar.getYear() === yearPillar
    && eightChar.getMonth() === monthPillar
    && eightChar.getDay() === dayPillar
    && eightChar.getTime() === hourPillar;
}

/**
 * H5's reverse picker searches 1801-2099 through an online endpoint. Start with
 * lunar-javascript's Solar.fromBaZi, then verify the remaining years locally so
 * the original future-inclusive range is preserved.
 */
export function reverseBazi(pillars: [string, string, string, string]) {
  const [yearPillar, monthPillar, dayPillar, hourPillar] = pillars;
  const found = new Map<string, ReverseBaziResult>();
  const add = (date: string, time: string) => {
    const label = `${date} ${time}`;
    found.set(label, { date, time, label });
  };

  Solar.fromBaZi(
    yearPillar,
    monthPillar,
    dayPillar,
    hourPillar,
    2,
    1801
  ).forEach((solar) => {
    const [date, rawTime] = solar.toYmdHms().split(" ");
    const year = Number(date.slice(0, 4));
    if (year >= 1801 && year <= 2099) add(date, rawTime.slice(0, 5));
  });

  const branchIndex = earthlyBranches.indexOf(
    hourPillar.slice(1) as (typeof earthlyBranches)[number]
  );
  if (branchIndex < 0) return [];
  const hours = branchIndex === 0 ? [0, 23] : [branchIndex * 2];
  for (let year = 1801; year <= 2099; year += 1) {
    if (Solar.fromYmdHms(year, 7, 1, 12, 0, 0)
      .getLunar().getEightChar().getYear() !== yearPillar) continue;
    const date = new Date(Date.UTC(year, 0, 1));
    while (date.getUTCFullYear() === year) {
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();
      for (const hour of hours) {
        if (matchesPillars(
          yearPillar,
          monthPillar,
          dayPillar,
          hourPillar,
          year,
          month,
          day,
          hour
        )) {
          add(
            `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            `${String(hour).padStart(2, "0")}:00`
          );
        }
      }
      date.setUTCDate(date.getUTCDate() + 1);
    }
  }
  return [...found.values()].sort((first, second) => first.label.localeCompare(second.label));
}
