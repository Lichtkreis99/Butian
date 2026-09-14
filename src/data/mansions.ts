export interface MansionDefinition {
  name: string;
  planet: string;
  animal: string;
  longitudeJ2000: number;
  latitudeJ2000: number;
  referenceHip: number;
}

// Values and order are the fixed-star boundary definition in aizhanxing-zhengyu.
// referenceHip is the closest retained Gaia/Hipparcos direction to that definition.
export const MANSIONS: readonly MansionDefinition[] = [
  { name: "娄", planet: "金", animal: "狗", longitudeJ2000: 33.990634, latitudeJ2000: 1.209913,
    referenceHip: 9643 },
  { name: "胃", planet: "土", animal: "彘", longitudeJ2000: 46.961373, latitudeJ2000: 36.261704,
    referenceHip: 9089 },
  { name: "昴", planet: "日", animal: "鸡", longitudeJ2000: 59.441802, latitudeJ2000: 2.520355,
    referenceHip: 17694 },
  { name: "毕", planet: "月", animal: "乌", longitudeJ2000: 68.508012, latitudeJ2000: -18.793869,
    referenceHip: 21744 },
  { name: "觜", planet: "火", animal: "猴", longitudeJ2000: 83.707597, latitudeJ2000: -14.4,
    referenceHip: 26223 },
  { name: "参", planet: "水", animal: "猿", longitudeJ2000: 84.708693, latitudeJ2000: -25.270154,
    referenceHip: 26727 },
  { name: "井", planet: "木", animal: "犴", longitudeJ2000: 95.324175, latitudeJ2000: 14.943918,
    referenceHip: 30589 },
  { name: "鬼", planet: "金", animal: "羊", longitudeJ2000: 125.774742, latitudeJ2000: -45.205322,
    referenceHip: 38134 },
  { name: "柳", planet: "土", animal: "獐", longitudeJ2000: 130.756243, latitudeJ2000: 56.437448,
    referenceHip: 55919 },
  { name: "星", planet: "日", animal: "马", longitudeJ2000: 146.748182, latitudeJ2000: -49.721909,
    referenceHip: 42802 },
  { name: "张", planet: "月", animal: "鹿", longitudeJ2000: 154.736969, latitudeJ2000: 31.992696,
    referenceHip: 55613 },
  { name: "翼", planet: "火", animal: "蛇", longitudeJ2000: 173.812268, latitudeJ2000: 25.354777,
    referenceHip: 60233 },
  { name: "轸", planet: "水", animal: "蚓", longitudeJ2000: 190.748029, latitudeJ2000: -31.318341,
    referenceHip: 57047 },
  { name: "角", planet: "木", animal: "蛟", longitudeJ2000: 203.553494, latitudeJ2000: -6.383117,
    referenceHip: 64895 },
  { name: "亢", planet: "金", animal: "龙", longitudeJ2000: 214.546269, latitudeJ2000: -56.764986,
    referenceHip: 56561 },
  { name: "氐", planet: "土", animal: "貉", longitudeJ2000: 225.130668, latitudeJ2000: 5.768352,
    referenceHip: 73249 },
  { name: "房", planet: "日", animal: "兔", longitudeJ2000: 242.980456, latitudeJ2000: -8.069872,
    referenceHip: 78006 },
  { name: "心", planet: "月", animal: "狐", longitudeJ2000: 247.830376, latitudeJ2000: -8.013865,
    referenceHip: 79833 },
  { name: "尾", planet: "火", animal: "虎", longitudeJ2000: 256.085719, latitudeJ2000: 35.845872,
    referenceHip: 84376 },
  { name: "箕", planet: "水", animal: "豹", longitudeJ2000: 271.280945, latitudeJ2000: 11.421033,
    referenceHip: 88668 },
  { name: "斗", planet: "木", animal: "獬", longitudeJ2000: 280.226482, latitudeJ2000: 62.715184,
    referenceHip: 90191 },
  { name: "牛", planet: "金", animal: "牛", longitudeJ2000: 304.132674, latitudeJ2000: -3.788383,
    referenceHip: 101100 },
  { name: "女", planet: "土", animal: "蝠", longitudeJ2000: 311.800037, latitudeJ2000: 4.708726,
    referenceHip: 102891 },
  { name: "虚", planet: "日", animal: "鼠", longitudeJ2000: 323.46813, latitudeJ2000: 25.718933,
    referenceHip: 104513 },
  { name: "危", planet: "月", animal: "燕", longitudeJ2000: 333.435514, latitudeJ2000: 9.405895,
    referenceHip: 109141 },
  { name: "室", planet: "火", animal: "猪", longitudeJ2000: 353.50437, latitudeJ2000: 16.159603,
    referenceHip: 114326 },
  { name: "壁", planet: "水", animal: "獝", longitudeJ2000: 10.255483, latitudeJ2000: 26.803313,
    referenceHip: 117500 },
  { name: "奎", planet: "木", animal: "狼", longitudeJ2000: 22.474377, latitudeJ2000: 26.430732,
    referenceHip: 3062 },
];

export const TROPICAL_SIGNS = [
  "白羊", "金牛", "双子", "巨蟹", "狮子", "处女",
  "天秤", "天蝎", "射手", "摩羯", "水瓶", "双鱼",
] as const;
