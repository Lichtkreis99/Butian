import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = resolve(root, "data-src/textures");
const output = resolve(root, "public/data/textures.js");

const files = {
  Mercury: "base/mercury-low.jpg",
  Venus: "base/venus-cloud.jpg",
  EarthDayRt: "cubemap/earth-day-low/earth-day_rt.jpg",
  EarthDayLf: "cubemap/earth-day-low/earth-day_lf.jpg",
  EarthDayUp: "cubemap/earth-day-low/earth-day_up.jpg",
  EarthDayDn: "cubemap/earth-day-low/earth-day_dn.jpg",
  EarthDayFt: "cubemap/earth-day-low/earth-day_ft.jpg",
  EarthDayBk: "cubemap/earth-day-low/earth-day_bk.jpg",
  EarthCloudRt: "cubemap/earth-cloud-low/earth-cloud_rt.jpg",
  EarthCloudLf: "cubemap/earth-cloud-low/earth-cloud_lf.jpg",
  EarthCloudUp: "cubemap/earth-cloud-low/earth-cloud_up.jpg",
  EarthCloudDn: "cubemap/earth-cloud-low/earth-cloud_dn.jpg",
  EarthCloudFt: "cubemap/earth-cloud-low/earth-cloud_ft.jpg",
  EarthCloudBk: "cubemap/earth-cloud-low/earth-cloud_bk.jpg",
  EarthNightRt: "cubemap/earth-night-low/earth_night_rt.jpg",
  EarthNightLf: "cubemap/earth-night-low/earth_night_lf.jpg",
  EarthNightUp: "cubemap/earth-night-low/earth_night_up.jpg",
  EarthNightDn: "cubemap/earth-night-low/earth_night_dn.jpg",
  EarthNightFt: "cubemap/earth-night-low/earth_night_ft.jpg",
  EarthNightBk: "cubemap/earth-night-low/earth_night_bk.jpg",
  Moon: "base/moon-low.jpg",
  Mars: "base/mars-low.jpg",
  Jupiter: "base/jupiter-low.jpg",
  Saturn: "base/saturn-low.jpg",
  SaturnRing: "base/saturn-ring-low.png",
  Uranus: "base/uranus-low.jpg",
  Neptune: "base/neptune-low.jpg",
  Pluto: "base/pluto-low.jpg",
} as const;

const entries = Object.entries(files).map(([id, path]) => {
  const bytes = readFileSync(resolve(base, path));
  const mime = path.endsWith(".png") ? "image/png" : "image/jpeg";
  return `  ${JSON.stringify(id)}: "data:${mime};base64,${bytes.toString("base64")}"`;
});
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `window.__XUANYE_TEXTURES__ = {\n${entries.join(",\n")}\n};\n`);
console.log(`build-textures: ${entries.length} textures; ` +
  `${(readFileSync(output).byteLength / 1024).toFixed(1)} KiB script`);
