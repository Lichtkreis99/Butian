import {
  calculateZhengyu,
  type ZhengyuRequest,
  type ZhengyuResult,
} from "./aizhanxing-zhengyu";
import type { ObserverLocation } from "./ephemeris";
import { formatDateTimeInput, zoneOffsetHours } from "./time";

export type ZhengyuGender = "male" | "female";

export interface ZhengyuContext {
  date: Date;
  timeZone: string;
  location: ObserverLocation;
  gender: ZhengyuGender;
  houseSystem?: "P" | "W";
  calcType?: 0 | 4;
  mingType?: 0 | 2;
  shenType?: 0 | 1;
  nodeTrue?: boolean;
}

export function makeZhengyuRequest(context: ZhengyuContext): ZhengyuRequest {
  const local = formatDateTimeInput(context.date, context.timeZone);
  const [date, timeWithSeconds] = local.split("T") as [string, string];
  const time = timeWithSeconds.slice(0, 5);
  const westPositiveZone = -zoneOffsetHours(context.date, context.timeZone);
  return {
    transit_date: date,
    transit_time: time,
    transit_zone: westPositiveZone,
    transit_lat: context.location.latitude,
    transit_lng: context.location.longitude,
    next_day_zi_shi: false,
    jieqi_type: 0,
    is_delta: false,
    is_mean: false,
    calc_type: context.calcType ?? 0,
    xingxiu_fixed_star_type: 0,
    rise_set_type: 0,
    ming_type: context.mingType ?? 0,
    ming_zhi: 0,
    shen_type: context.shenType ?? 0,
    day_night_type: 0,
    child_limit_type: 0,
    node_true: context.nodeTrue ?? false,
    lilith_true: false,
    node_type: 0,
    ziqi_type: 0,
    has_arabic: false,
    big_limit_calc_type: 0,
    small_limit_calc_type: 0,
    month_limit_calc_type: 0,
    ge_ju_display_mode: "none",
    hsys: context.houseSystem ?? "W",
    ayanamsa: 0,
    lat: context.location.latitude,
    lng: context.location.longitude,
    date,
    time,
    summer: 0,
    birth_zone: westPositiveZone,
    sex: context.gender === "male" ? 1 : 0,
  };
}

export function calculateZhengyuFor(context: ZhengyuContext): ZhengyuResult {
  return calculateZhengyu(makeZhengyuRequest(context));
}
