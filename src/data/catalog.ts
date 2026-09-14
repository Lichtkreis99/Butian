import { constellationChineseName } from "../lib/names";

export interface StarRecord {
  index: number;
  position: [number, number, number];
  velocity: [number, number, number];
  magnitude: number;
  colorIndex: number;
  hip: number;
  distanceSource: "gaia" | "stellarium-plx" | "unknown";
}

export interface Asterism {
  id: string;
  nameZh: string;
  nameEn: string;
  lines: number[][];
}

export interface ChineseStarName {
  nameZh: string;
  nameEn: string;
}

export interface ChineseSkyculture {
  asterisms: Asterism[];
  commonNames: Record<string, ChineseStarName>;
  unavailableHips: number[];
}

export interface WesternSkyculture extends ChineseSkyculture {
  constellations: XuanYeWesternConstellation[];
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export class StarCatalog {
  readonly count: number;
  readonly sourceCount: number;
  readonly epoch: number;
  readonly stride: number;
  readonly names: Readonly<Record<string, string>>;
  readonly bayerNames: Readonly<Record<string, string>>;
  readonly buffer: ArrayBuffer;
  readonly hipToIndex = new Map<number, number>();

  private readonly view: DataView;

  constructor(source: XuanYeStarGlobal) {
    this.count = source.count;
    this.sourceCount = source.sourceCount;
    this.epoch = source.epoch;
    this.stride = source.stride;
    this.names = source.names;
    this.bayerNames = source.bayerNames ?? {};
    this.buffer = decodeBase64(source.base64);
    this.view = new DataView(this.buffer);
    if (this.buffer.byteLength !== this.count * this.stride) {
      throw new Error("星表数据长度与元数据不一致。");
    }
    for (let index = 0; index < this.count; index += 1) {
      const hip = this.view.getInt32(index * this.stride + 32, true);
      if (hip) this.hipToIndex.set(hip, index);
    }
  }

  get(index: number): StarRecord {
    if (index < 0 || index >= this.count) throw new RangeError("Star index out of range.");
    const offset = index * this.stride;
    return {
      index,
      position: [
        this.view.getFloat32(offset, true),
        this.view.getFloat32(offset + 4, true),
        this.view.getFloat32(offset + 8, true),
      ],
      velocity: [
        this.view.getFloat32(offset + 12, true),
        this.view.getFloat32(offset + 16, true),
        this.view.getFloat32(offset + 20, true),
      ],
      magnitude: this.view.getFloat32(offset + 24, true),
      colorIndex: this.view.getFloat32(offset + 28, true),
      hip: this.view.getInt32(offset + 32, true),
      distanceSource: ["gaia", "stellarium-plx", "unknown"][
        this.view.getFloat32(offset + 36, true)
      ] as StarRecord["distanceSource"],
    };
  }

  getByHip(hip: number): StarRecord | undefined {
    const index = this.hipToIndex.get(hip);
    return index === undefined ? undefined : this.get(index);
  }

  positionAt(index: number, year: number): [number, number, number] {
    const star = this.get(index);
    const years = year - this.epoch;
    return [
      star.position[0] + star.velocity[0] * years,
      star.position[1] + star.velocity[1] * years,
      star.position[2] + star.velocity[2] * years,
    ];
  }
}

export function loadCatalogData(): {
  stars: StarCatalog;
  skyculture: ChineseSkyculture;
  western: WesternSkyculture;
} {
  const starSource = window.__XUANYE_STARS__;
  const skycultureSource = window.__XUANYE_SKYCULTURE_CHINESE__;
  const westernSource = window.__XUANYE_WESTERN__;
  if (!starSource || !skycultureSource || !westernSource) {
    throw new Error(
      "本地星表未加载，请确认 data/ 目录与 index.html 位于同一产物目录。",
    );
  }
  const skycultureText = new TextDecoder().decode(
    decodeBase64(skycultureSource.base64),
  );
  const westernAsterisms = westernSource.constellations.map((item) => ({
    id: item.id,
    nameZh: constellationChineseName(item.iau),
    nameEn: item.common_name.english,
    lines: item.lines,
  }));
  return {
    stars: new StarCatalog(starSource),
    skyculture: JSON.parse(skycultureText) as ChineseSkyculture,
    western: {
      asterisms: westernAsterisms,
      commonNames: {},
      unavailableHips: [],
      constellations: westernSource.constellations,
    },
  };
}
