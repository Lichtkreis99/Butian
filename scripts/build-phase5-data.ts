import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { decodeStellariumDsoEph } from "./lib/stellarium-dso";

const root = new URL("../", import.meta.url).pathname;
const westernRoot = join(root, "data-src/skycultures/western");
const western = JSON.parse(readFileSync(join(westernRoot, "index.json"), "utf8"));
for (const constellation of western.constellations) {
  if (!constellation.image) continue;
  const file = join(westernRoot, constellation.image.file);
  if (!existsSync(file)) {
    delete constellation.image;
    continue;
  }
  constellation.image.dataUri = `data:image/webp;base64,${readFileSync(file).toString("base64")}`;
}
writeFileSync(
  join(root, "public/data/constellation-art.js"),
  `window.__XUANYE_WESTERN__=${JSON.stringify({
    constellations: western.constellations,
  })};\n`,
);

const landscapeRoot = join(root, "data-src/landscapes/guereins");
const tiles: Record<string, string> = {};
for (const order of [0, 1]) {
  const directory = join(landscapeRoot, `Norder${order}/Dir0`);
  for (const name of readdirSync(directory).filter((value) => extname(value) === ".webp")) {
    const id = basename(name, ".webp").replace("Npix", "");
    tiles[`${order}/${id}`] = `data:image/webp;base64,` +
      readFileSync(join(directory, name)).toString("base64");
  }
}
writeFileSync(
  join(root, "public/data/landscape-guereins.js"),
  `window.__XUANYE_LANDSCAPE_GUEREINS__=${JSON.stringify({
    title: "Guéreins", frame: "horizontal", azimuthOrigin: "south",
    tileWidth: 512, tiles,
  })};\n`,
);
console.log(
  `build-phase5-data: ${western.constellations.length} constellations; ` +
  `${Object.keys(tiles).length} landscape tiles`,
);

const milkyWayRoot = join(root, "data-src/stellarium-milkyway/Norder0/Dir0");
const milkyWayTiles: Record<string, string> = {};
for (const name of readdirSync(milkyWayRoot).filter((value) => extname(value) === ".webp")) {
  const id = basename(name, ".webp").replace("Npix", "");
  milkyWayTiles[id] = `data:image/webp;base64,` +
    readFileSync(join(milkyWayRoot, name)).toString("base64");
}
writeFileSync(
  join(root, "public/data/stellarium-milkyway.js"),
  `window.__XUANYE_MILKY_WAY__=${JSON.stringify({
    frame: "equatorial", tileWidth: 512, tiles: milkyWayTiles,
  })};\n`,
);

const dsoRoot = join(root, "data-src/stellarium-dso/Norder0/Dir0");
const dsoRecords = readdirSync(dsoRoot).filter((value) => extname(value) === ".eph")
  .flatMap((name) => decodeStellariumDsoEph(readFileSync(join(dsoRoot, name))))
  .map((record) => ({
    t: record.type,
    m: record.magnitude,
    r: record.ra,
    d: record.dec,
    a: record.majorAxis,
    b: record.minorAxis,
    p: record.angle,
    o: record.morphology,
    i: record.ids.filter((id) => /^(?:M |NGC |IC |C |NAME )/.test(id)),
  }));
writeFileSync(
  join(root, "public/data/stellarium-dso.js"),
  `window.__XUANYE_DSO__=${JSON.stringify({ frame: "equatorial", records: dsoRecords })};\n`,
);
console.log(
  `build-phase9-data: ${Object.keys(milkyWayTiles).length} Milky Way tiles; ` +
  `${dsoRecords.length} DSO records`,
);
