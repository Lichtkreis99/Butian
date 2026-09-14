import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { readdirSync } from "node:fs";

const forbidden = [
  "吉凶", "吉神", "凶煞", "断语", "解读", "主贵", "主富", "主凶", "大吉", "大凶",
  "有利", "不利", "利好", "利空", "喜用", "忌用", "宜：", "忌：",
] as const;
const properNameAllowList = new Set<string>([]);
const root = new URL("../src/ui/", import.meta.url);

function sourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) return sourceFiles(child);
    return [".ts", ".html"].includes(extname(entry.name)) ? [child] : [];
  });
}

let checked = 0;
for (const file of sourceFiles(root)) {
  const source = readFileSync(file, "utf8");
  for (const term of forbidden) {
    if (source.includes(term) && !properNameAllowList.has(term)) {
      throw new Error(`${file.pathname}: forbidden rendered-text boundary term found`);
    }
  }
  if (/\.(plus|level)\b|\[['"](?:plus|level)['"]\]/.test(source)) {
    throw new Error(`${file.pathname}: forbidden favourable/level field rendered`);
  }
  checked += 1;
}

console.log(
  `verify-boundary: PASS — ${checked} UI/chart files; rule knowledge allowed; ` +
    `${forbidden.length} interpretation/classification terms absent`,
);
