import type { NatalChartInput } from "./types";

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const DAY_MILLISECONDS = 86_400_000;

function utcMilliseconds(parts: LocalDateTimeParts) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, 0, 0);
  return date.getTime();
}

function parseLocalDateTime(date: string, time: string): LocalDateTimeParts {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) {
    throw new RangeError("Expected date YYYY-MM-DD and time HH:mm.");
  }

  const parts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  };
  const check = new Date(utcMilliseconds(parts));
  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() + 1 !== parts.month ||
    check.getUTCDate() !== parts.day ||
    parts.hour > 23 ||
    parts.minute > 59
  ) {
    throw new RangeError("The local birth date or time is not valid.");
  }
  return parts;
}

function zonedParts(timestamp: number, timeZone: string): LocalDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-GB-u-ca-iso8601-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const values = new Map(
    formatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.get("year") ?? 0,
    month: values.get("month") ?? 0,
    day: values.get("day") ?? 0,
    hour: values.get("hour") ?? 0,
    minute: values.get("minute") ?? 0,
  };
}

function sameLocalDateTime(first: LocalDateTimeParts, second: LocalDateTimeParts) {
  return (
    first.year === second.year &&
    first.month === second.month &&
    first.day === second.day &&
    first.hour === second.hour &&
    first.minute === second.minute
  );
}

function offsetMinutesAt(timestamp: number, timeZone: string) {
  const roundedTimestamp = Math.trunc(timestamp / 60_000) * 60_000;
  return (utcMilliseconds(zonedParts(roundedTimestamp, timeZone)) - roundedTimestamp) / 60_000;
}

function ianaLocalToUtc(parts: LocalDateTimeParts, timeZone: string, summer: 0 | 1) {
  const naiveTimestamp = utcMilliseconds(parts);
  const probes = [-370, -180, -2, -1, 0, 1, 2, 180, 370].map(
    (days) => naiveTimestamp + days * DAY_MILLISECONDS,
  );
  const offsets = [...new Set(probes.map((probe) => offsetMinutesAt(probe, timeZone)))];
  const candidates = offsets
    .map((offset) => ({ offset, timestamp: naiveTimestamp - offset * 60_000 }))
    .filter((candidate) => sameLocalDateTime(zonedParts(candidate.timestamp, timeZone), parts));

  if (candidates.length === 0) {
    throw new RangeError(`The local time does not exist in ${timeZone}.`);
  }
  candidates.sort((first, second) => first.offset - second.offset);
  const selected = summer === 1 ? candidates.at(-1) : candidates[0];
  return new Date(selected?.timestamp ?? candidates[0].timestamp);
}

export function localDateTimeToUtc(input: Pick<NatalChartInput, "date" | "time" | "timeZone" | "summer">) {
  const parts = parseLocalDateTime(input.date, input.time);
  if (typeof input.timeZone === "number") {
    if (!Number.isFinite(input.timeZone) || Math.abs(input.timeZone) > 24) {
      throw new RangeError("Fixed UTC offset must be a finite number of hours between -24 and 24.");
    }
    return new Date(utcMilliseconds(parts) - (input.timeZone + input.summer) * 3_600_000);
  }
  try {
    return ianaLocalToUtc(parts, input.timeZone, input.summer);
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new RangeError(`Invalid IANA time zone: ${input.timeZone}`);
  }
}

export function addLocalDays(date: string, days: number) {
  const parts = parseLocalDateTime(date, "00:00");
  const shifted = new Date(utcMilliseconds(parts) + days * DAY_MILLISECONDS);
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function localWeekday(date: string) {
  const parts = parseLocalDateTime(date, "00:00");
  return new Date(utcMilliseconds(parts)).getUTCDay();
}

export function formatLocalTime(date: Date, timeZone: NatalChartInput["timeZone"], summer: 0 | 1) {
  if (typeof timeZone === "number") {
    const local = new Date(date.getTime() + (timeZone + summer) * 3_600_000);
    return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
  }
  return new Intl.DateTimeFormat("en-GB-u-ca-iso8601-nu-latn", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
