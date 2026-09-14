import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const indexPath = resolve(dist, "index.html");
if (!existsSync(indexPath)) throw new Error("dist/index.html does not exist; run the build first.");
const html = readFileSync(indexPath, "utf8");

const moduleTags = [...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*>/gi)];
const externalModules = moduleTags.filter((match) => /\bsrc\s*=/.test(match[0]));
if (externalModules.length) throw new Error("dist/index.html contains an external module script.");

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const outputFiles = filesUnder(dist);
for (const file of outputFiles) {
  const source = readFileSync(file, "utf8");
  if (/\bfetch\s*\(/.test(source)) throw new Error(`${file} contains fetch().`);
}
const references = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)]
  .map((match) => match[1]!)
  .filter((value) => !value.startsWith("#") && !value.startsWith("data:"));
for (const reference of references) {
  const path = resolve(dirname(indexPath), reference.replace(/^\.\//, ""));
  if (!existsSync(path)) throw new Error(`Missing file referenced by index.html: ${reference}`);
}

console.log(
  `verify-file-protocol: PASS — ${externalModules.length} external modules, ` +
    `0 fetch calls, ${references.length} local references resolved`,
);
