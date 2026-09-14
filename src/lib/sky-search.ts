export type SkySearchKind = "star" | "body" | "dso" | "asterism";

export interface SkySearchEntry {
  kind: SkySearchKind;
  id: string | number;
  label: string;
  aliases: string[];
}

const GREEK: Readonly<Record<string, string>> = {
  "α": "alf", "β": "bet", "γ": "gam", "δ": "del", "ε": "eps",
  "ζ": "zet", "η": "eta", "θ": "the", "ι": "iot", "κ": "kap",
  "λ": "lam", "μ": "mu", "ν": "nu", "ξ": "ksi", "ο": "omi",
  "π": "pi", "ρ": "rho", "σ": "sig", "τ": "tau", "υ": "ups",
  "φ": "phi", "χ": "chi", "ψ": "psi", "ω": "ome",
};

export function normalizeSkyQuery(value: string): string {
  let normalized = value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  for (const [symbol, latin] of Object.entries(GREEK)) {
    normalized = normalized.replaceAll(symbol, latin);
  }
  return normalized.replace(/^hip\s*/, "hip ").replace(/^(m|ngc|ic)\s*(\d+)$/, "$1 $2");
}

export function searchSkyEntries(
  entries: readonly SkySearchEntry[],
  query: string,
  limit = 12,
): SkySearchEntry[] {
  const wanted = normalizeSkyQuery(query);
  if (!wanted) return [];
  return entries.map((entry) => {
    const values = [entry.label, ...entry.aliases].map(normalizeSkyQuery);
    const exact = values.some((value) => value === wanted);
    const prefix = values.some((value) => value.startsWith(wanted));
    const contains = values.some((value) => value.includes(wanted));
    return { entry, score: exact ? 0 : prefix ? 1 : contains ? 2 : 3 };
  }).filter((item) => item.score < 3)
    .sort((first, second) => first.score - second.score ||
      first.entry.label.localeCompare(second.entry.label, "zh-CN"))
    .slice(0, limit).map((item) => item.entry);
}
