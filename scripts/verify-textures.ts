import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const texturePath = resolve(root, "public/data/textures.js");
const source = readFileSync(texturePath, "utf8");
const prefix = "window.__XUANYE_TEXTURES__ = ";
if (!source.startsWith(prefix)) throw new Error("textures.js global assignment is invalid.");
const textures = JSON.parse(source.slice(prefix.length).replace(/;\s*$/, "")) as
  Record<string, string>;
let decodedSize = 0;
for (const [name, uri] of Object.entries(textures)) {
  const match = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(uri);
  if (!match) throw new Error(`${name} is not a JPEG/PNG data URI.`);
  const bytes = Buffer.from(match[2]!, "base64");
  decodedSize += bytes.byteLength;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  if ((match[1] === "image/jpeg" && !jpeg) || (match[1] === "image/png" && !png)) {
    throw new Error(`${name} magic bytes do not match ${match[1]}.`);
  }
}

function directorySize(path: string): number {
  return readdirSync(path, { withFileTypes: true }).reduce((sum, entry) => {
    const child = resolve(path, entry.name);
    return sum + (entry.isDirectory() ? directorySize(child) : statSync(child).size);
  }, 0);
}

const distSize = directorySize(resolve(root, "dist"));
const limit = 20 * 1024 * 1024;
if (distSize > limit) {
  throw new Error(`dist is ${(distSize / 1024 / 1024).toFixed(2)} MiB; limit is 20 MiB.`);
}
console.log(
  `verify-textures: PASS — ${Object.keys(textures).length} JPEG/PNG entries; ` +
    `${(decodedSize / 1024).toFixed(1)} KiB decoded`,
);
console.log(
  `verify-textures: PASS — dist ${(distSize / 1024 / 1024).toFixed(2)} MiB / 20 MiB`,
);
