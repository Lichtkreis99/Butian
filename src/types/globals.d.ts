interface XuanYeStarGlobal {
  version: number;
  count: number;
  sourceCount: number;
  stride: number;
  epoch: number;
  frame: string;
  units: { position: string; velocity: string };
  fields: string[];
  names: Record<string, string>;
  bayerNames: Record<string, string>;
  base64: string;
}

interface XuanYeSkycultureGlobal {
  version: number;
  encoding: string;
  base64: string;
}

interface Window {
  __XUANYE_STARS__?: XuanYeStarGlobal;
  __XUANYE_SKYCULTURE_CHINESE__?: XuanYeSkycultureGlobal;
  __XUANYE_TEXTURES__?: Record<string, string>;
  __XUANYE_WESTERN__?: XuanYeWesternGlobal;
  __XUANYE_LANDSCAPE_GUEREINS__?: XuanYeLandscapeGlobal;
  __XUANYE_MILKY_WAY__?: XuanYeMilkyWayGlobal;
  __XUANYE_DSO__?: XuanYeDsoGlobal;
}

interface XuanYeMilkyWayGlobal {
  frame: "equatorial";
  tileWidth: number;
  tiles: Record<string, string>;
}

interface XuanYeDsoRecord {
  t: string;
  m: number;
  r: number;
  d: number;
  a: number;
  b: number;
  p: number;
  o: string;
  i: string[];
}

interface XuanYeDsoGlobal {
  frame: "equatorial";
  records: XuanYeDsoRecord[];
}

interface XuanYeWesternImage {
  size: [number, number];
  anchors: Array<{ pos: [number, number]; hip: number }>;
  dataUri: string;
}

interface XuanYeWesternConstellation {
  id: string;
  iau: string;
  lines: number[][];
  common_name: { english: string; native: string };
  image?: XuanYeWesternImage;
}

interface XuanYeWesternGlobal {
  constellations: XuanYeWesternConstellation[];
}

interface XuanYeLandscapeGlobal {
  title: string;
  frame: "horizontal";
  azimuthOrigin: "south";
  tileWidth: number;
  tiles: Record<string, string>;
}
