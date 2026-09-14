// @ts-nocheck -- vendored reference engine; calculation logic intentionally unchanged.
import type { HouseSystem } from "@/lib/aizhanxing-chart";

export interface ZhengyuRequest {
  transit_date: string;
  transit_time: string;
  transit_zone: number;
  transit_lat: number;
  transit_lng: number;
  next_day_zi_shi: boolean;
  jieqi_type: number;
  is_delta: boolean;
  is_mean: boolean;
  calc_type: number;
  xingxiu_fixed_star_type: number;
  rise_set_type: number;
  ming_type: number;
  ming_zhi: number;
  shen_type: number;
  day_night_type: number;
  child_limit_type: number;
  node_true: boolean;
  lilith_true: boolean;
  node_type: number;
  ziqi_type: number;
  has_arabic: boolean;
  big_limit_calc_type: number;
  small_limit_calc_type: number;
  month_limit_calc_type: number;
  ge_ju_display_mode: string;
  hsys: HouseSystem;
  ayanamsa: number;
  lat: number;
  lng: number;
  date: string;
  time: string;
  summer: 0 | 1;
  birth_zone: number;
  sex: 0 | 1 | 2;
}

export interface ZhengyuDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface ZhengyuPillar {
  ganzhi: number;
  gan: number;
  zhi: number;
}

export interface ZhengyuBaziData {
  solar_date: ZhengyuDateParts;
  lunar_date: ZhengyuDateParts & {
    leap_month?: number;
    is_leap?: boolean;
    conventional_month?: number;
  };
  sizhu: {
    year_zhu: ZhengyuPillar;
    month_zhu: ZhengyuPillar;
    day_zhu: ZhengyuPillar;
    hour_zhu: ZhengyuPillar;
  };
}

export interface ZhengyuPlanet {
  plant_type: number;
  name: string;
  lng_type: number;
  lng_origin: number;
  lng: number;
  lat: number;
  degree: number;
  degree_str: string;
  sign: number;
  speed: number;
  speed_status: number;
  status: number;
  house: number;
  house_degree: number;
  house_degree_str: string;
  shishen: number;
  xingxiu: number;
  xingxiu_degree: number;
  xingxiu_degree_str: string;
  xingxiu_degree_word: string;
  sign_status: string[];
  sign_status_str: string;
}

export interface ZhengyuHouse {
  lng_type: number;
  lng_origin: number;
  lng: number;
  lng_str: string;
  sign: number;
  degree: number;
  degree_str: string;
  arc: number;
  zhi: number;
  shensha_list: string[] | null;
  xu: boolean;
  shi: boolean;
  xingxiu: number;
  xingxiu_degree: number;
}

export interface ZhengyuXingxiu {
  name: string;
  planet_name: string;
  animal_name: string;
  lng_type: number;
  lng: number;
  sign: number;
  degree: number;
  degree_str: string;
}

export interface ZhengyuResult {
  delta_time: string;
  delta_time_transit: string;
  bazi_date: ZhengyuBaziData;
  bazi_data: ZhengyuBaziData;
  transit_data: ZhengyuBaziData;
  ke_zhu: { gan: number; zhi: number; ke_index: number };
  ke_zhu_transit: { gan: number; zhi: number; ke_index: number };
  date_time1: string;
  date_time2: string;
  planets1: ZhengyuPlanet[];
  planets2: ZhengyuPlanet[];
  houses1: Record<string, ZhengyuHouse>;
  houses2: Record<string, ZhengyuHouse>;
  xingxiu_list: ZhengyuXingxiu[];
  yaos1: Array<Record<string, unknown>>;
  yaos2: Array<Record<string, unknown>>;
  year_limit_list: Array<Record<string, unknown>>;
  transit_limit: Record<string, unknown>;
  ge_ju_display_mode: string;
  ge_ju_list: string[];
  ge_ju_items: Array<Record<string, unknown>>;
  ming_shen: Record<string, unknown>;
  rise_set: Record<string, string>;
  day_night: boolean;
  child_limit: Record<string, unknown>;
  houses_arc: Record<string, ZhengyuHouse>;
}
