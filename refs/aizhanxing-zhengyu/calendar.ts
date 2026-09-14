import type {
  ZhengyuBaziData,
  ZhengyuDateParts,
  ZhengyuPillar,
} from "./types";
import { futureLunarYearDays, lunarYearData } from "./constants";

const DAY_MS = 86_400_000;

function equationOfTime(year: number, month: number, day: number, hour: number) {
  const start = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - start) / DAY_MS) + 1;
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (hour - 12) / 24);
  return 229.18 * (
    0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  );
}

function parseDateTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return { year, month, day, hour, minute };
}

export function trueSolarDate(
  date: string,
  time: string,
  longitude: number,
  eastOffset: number,
  summer = 0,
) {
  const value = parseDateTime(date, time);
  const correction = 4 * (longitude - (eastOffset + summer) * 15) +
    equationOfTime(value.year, value.month, value.day, value.hour);
  return new Date(
    Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute) +
      correction * 60_000,
  );
}

export function dateParts(date: Date): ZhengyuDateParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

export function formatDateTime(date: Date) {
  const value = dateParts(date);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${String(value.year).padStart(4, "0")}-${pad(value.month)}-${pad(value.day)} ` +
    `${pad(value.hour)}:${pad(value.minute)}:${pad(value.second)}`;
}

function pillar(index: number): ZhengyuPillar {
  const ganzhi = ((index % 60) + 60) % 60;
  return { ganzhi, gan: ganzhi % 10, zhi: ganzhi % 12 };
}

function julianDayNumber(parts: ZhengyuDateParts) {
  const value = Date.UTC(parts.year, parts.month - 1, parts.day, 12);
  return Math.floor(value / DAY_MS + 2_440_588);
}

function monthBranch(month: number, day: number) {
  const boundaries = [4, 6, 5, 5, 6, 6, 7, 8, 8, 8, 7, 7];
  let solarMonth = month;
  if (day < boundaries[month - 1]) solarMonth -= 1;
  if (solarMonth <= 0) solarMonth += 12;
  return solarMonth % 12;
}

function leapMonth(year: number) {
  return lunarYearData[year - 1900] & 0xf;
}

function leapDays(year: number) {
  if (!leapMonth(year)) return 0;
  return lunarYearData[year - 1900] & 0x10000 ? 30 : 29;
}

function lunarMonthDays(year: number, month: number) {
  return lunarYearData[year - 1900] & (0x10000 >> month) ? 30 : 29;
}

export function lunarYearDays(year: number) {
  if (year > 2100) return futureLunarYearDays[year] ?? 354;
  let days = 348;
  for (let bit = 0x8000; bit > 0x8; bit >>= 1) {
    if (lunarYearData[year - 1900] & bit) days += 1;
  }
  return days + leapDays(year);
}

/** Gregorian midnight at the first day of the requested lunar year. */
export function lunarNewYear(year: number) {
  let offset = 0;
  for (let current = 1900; current < year; current += 1) {
    offset += lunarYearDays(current);
  }
  return new Date(Date.UTC(1900, 0, 31) + offset * DAY_MS);
}

function solarToLunar(parts: ZhengyuDateParts) {
  let offset = Math.floor(
    (Date.UTC(parts.year, parts.month - 1, parts.day) - Date.UTC(1900, 0, 31)) /
      DAY_MS,
  );
  let year = 1900;
  let yearDays = 0;
  while (year <= 2100 && offset > 0) {
    yearDays = lunarYearDays(year);
    offset -= yearDays;
    year += 1;
  }
  if (offset < 0) {
    offset += yearDays;
    year -= 1;
  }
  const leap = leapMonth(year);
  let isLeap = false;
  let month = 1;
  let monthDays = 0;
  while (month < 13 && offset > 0) {
    if (leap > 0 && month === leap + 1 && !isLeap) {
      month -= 1;
      isLeap = true;
      monthDays = leapDays(year);
    } else {
      monthDays = lunarMonthDays(year, month);
    }
    if (isLeap && month === leap + 1) isLeap = false;
    offset -= monthDays;
    month += 1;
  }
  if (offset === 0 && leap > 0 && month === leap + 1) {
    if (isLeap) {
      isLeap = false;
    } else {
      isLeap = true;
      month -= 1;
    }
  }
  if (offset < 0) {
    offset += monthDays;
    month -= 1;
  }
  return { year, month, day: offset + 1, isLeap, leap };
}

export function calculateBaziData(
  date: Date,
  sex: 0 | 1 | 2,
  nextDayZiShi: boolean,
): ZhengyuBaziData {
  const original = dateParts(date);
  const pillarDate = nextDayZiShi && original.hour === 23
    ? new Date(date.getTime() + 3_600_000)
    : date;
  const parts = dateParts(pillarDate);
  const beforeLichun = parts.month === 1 || (parts.month === 2 && parts.day < 4);
  const pillarYear = beforeLichun ? parts.year - 1 : parts.year;
  const year = pillar(pillarYear - 4);
  const branch = monthBranch(parts.month, parts.day);
  const calendarYearStem = pillar(parts.year - 4).gan;
  const monthStem = ((calendarYearStem % 5) * 2 + branch) % 10;
  const monthGanzhi = Array.from({ length: 60 }, (_, index) => index)
    .find((index) => index % 10 === monthStem && index % 12 === branch) ?? 0;
  const day = pillar(julianDayNumber(parts) + 49);
  const hourBranch = Math.floor((parts.hour + 1) / 2) % 12;
  const hourStem = (day.gan * 2 + hourBranch) % 10;
  const hourGanzhi = Array.from({ length: 60 }, (_, index) => index)
    .find((index) => index % 10 === hourStem && index % 12 === hourBranch) ?? 0;
  const lunar = solarToLunar(original);
  return {
    solar_date: original,
    lunar_date: {
      year: lunar.year,
      month: lunar.month,
      leap_month: lunar.leap,
      day: lunar.day,
      hour: original.hour,
      minute: original.minute,
      second: original.second,
      is_leap: lunar.isLeap,
      conventional_month: lunar.month,
    },
    sizhu: {
      year_zhu: year,
      month_zhu: pillar(monthGanzhi),
      day_zhu: day,
      hour_zhu: pillar(hourGanzhi),
    },
  };
}

export function keZhu(data: ZhengyuBaziData) {
  const hour = data.solar_date.hour;
  const minute = data.solar_date.minute;
  const minutesIntoBranch = ((hour + 1) % 2) * 60 + minute;
  const keIndex = Math.floor(minutesIntoBranch / 10);
  const gan = (data.sizhu.hour_zhu.gan * 2 + keIndex) % 10;
  return { gan, zhi: keIndex, ke_index: keIndex };
}
