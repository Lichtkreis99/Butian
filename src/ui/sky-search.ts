import type { ChineseSkyculture, StarCatalog } from "../data/catalog";
import type { DeepSkyObject } from "../data/deep-sky";
import { BODY_DEFINITIONS } from "../lib/ephemeris";
import { searchSkyEntries, type SkySearchEntry } from "../lib/sky-search";

const GREEK_BY_BAYER: Readonly<Record<string, string>> = {
  alf: "α", bet: "β", gam: "γ", del: "δ", eps: "ε", zet: "ζ", eta: "η",
  the: "θ", iot: "ι", kap: "κ", lam: "λ", mu: "μ", nu: "ν", ksi: "ξ",
  omi: "ο", pi: "π", rho: "ρ", sig: "σ", tau: "τ", ups: "υ", phi: "φ",
  chi: "χ", psi: "ψ", ome: "ω",
};

export class SkySearch {
  readonly element = document.createElement("section");
  private readonly input: HTMLInputElement;
  private readonly results: HTMLElement;
  private readonly entries: SkySearchEntry[];

  constructor(
    stars: StarCatalog,
    skyculture: ChineseSkyculture,
    dsos: readonly DeepSkyObject[],
    onSelect: (entry: SkySearchEntry) => void,
  ) {
    this.element.className = "sky-search dock-panel";
    this.element.innerHTML = `<input type="search" placeholder="搜索天体、HIP、星官…" ` +
      `aria-label="搜索天空"><div class="sky-search-results" role="listbox"></div>`;
    this.input = this.element.querySelector("input")!;
    this.results = this.element.querySelector(".sky-search-results")!;
    this.entries = this.makeEntries(stars, skyculture, dsos);
    this.input.addEventListener("input", () => this.renderResults(onSelect));
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.results.querySelector<HTMLButtonElement>("button")?.click();
      }
      if (event.key === "Escape") this.close();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!this.element.contains(event.target as Node)) this.results.replaceChildren();
    });
  }

  focus(): void {
    this.element.classList.add("is-open");
    this.input.focus();
    this.input.select();
  }

  resolve(query: string): SkySearchEntry | undefined {
    return searchSkyEntries(this.entries, query, 1)[0];
  }

  private close(): void {
    this.element.classList.remove("is-open");
    this.results.replaceChildren();
    this.input.blur();
  }

  private renderResults(onSelect: (entry: SkySearchEntry) => void): void {
    const matches = searchSkyEntries(this.entries, this.input.value);
    this.results.replaceChildren(...matches.map((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "option";
      button.textContent = entry.label;
      button.addEventListener("click", () => {
        onSelect(entry);
        this.close();
      });
      return button;
    }));
  }

  private makeEntries(
    stars: StarCatalog,
    skyculture: ChineseSkyculture,
    dsos: readonly DeepSkyObject[],
  ): SkySearchEntry[] {
    const entries: SkySearchEntry[] = [];
    for (const [hipText, index] of stars.hipToIndex) {
      const hip = Number(hipText);
      const common = skyculture.commonNames[String(hip)];
      const english = stars.names[String(hip)];
      const bayer = stars.bayerNames[String(hip)];
      if (!common && !english && !bayer) continue;
      const aliases = [english, common?.nameEn, bayer, `HIP ${hip}`].filter(
        (value): value is string => Boolean(value),
      );
      const bayerMatch = bayer?.match(/^([a-z]{2,3}) ([A-Z][a-z]{2})$/);
      if (bayerMatch && GREEK_BY_BAYER[bayerMatch[1]!]) {
        const western = bayerMatch[2] === "Ori" ? "猎户座" : "";
        if (western) aliases.push(`${western} ${GREEK_BY_BAYER[bayerMatch[1]!]}`);
      }
      entries.push({
        kind: "star", id: index, label: common?.nameZh || english || `HIP ${hip}`, aliases,
      });
    }
    for (const body of BODY_DEFINITIONS) {
      entries.push({ kind: "body", id: body.id, label: body.nameZh,
        aliases: [body.id] });
    }
    for (const asterism of skyculture.asterisms) {
      entries.push({ kind: "asterism", id: asterism.id, label: asterism.nameZh,
        aliases: [asterism.nameEn] });
    }
    for (const object of dsos) {
      entries.push({ kind: "dso", id: object.index,
        label: object.nameZh ?? object.primaryId,
        aliases: [object.name, object.primaryId, ...object.ids] });
    }
    return entries;
  }
}
