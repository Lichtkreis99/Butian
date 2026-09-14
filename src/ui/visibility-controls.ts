import type { ChineseSkyculture, StarCatalog } from "../data/catalog";
import type { SettingsStore, XuanYeSettings } from "../lib/settings-store";
import {
  PLANET_ORBIT_RADII_AU,
  distanceSliderValue,
  parsecsFromSlider,
  planetThreshold,
  starDistanceVisible,
} from "../lib/visibility";

export class VisibilityControls {
  readonly element = document.createElement("div");

  constructor(
    private readonly store: SettingsStore,
    private readonly stars: StarCatalog,
    private readonly skyculture: ChineseSkyculture,
    compact = false,
  ) {
    this.element.className = compact ? "visibility-controls is-compact" : "visibility-controls";
    this.element.innerHTML = `
      <section class="visibility-control" data-visibility-section="planet">
        <div class="visibility-heading"><span class="visibility-title">行星可见度</span>
          <output data-readout="planet"></output></div>
        <div class="visibility-slider-row"><input data-visibility="planet" type="range"
          min="0" max="1" step="0.001"></div>
        <div class="visibility-ticks planet-distance-ticks">${PLANET_ORBIT_RADII_AU.map(
          ([name, radius]) => `<i style="left:${Math.log(radius / 0.1) / Math.log(600) * 100}%" ` +
            `title="${name} ${radius} AU"><b><span>${name}</span>` +
            `<em>${name[0]}</em></b></i>`,
        ).join("")}</div>
      </section>
      <section class="visibility-control" data-visibility-section="stars">
        <div class="visibility-heading"><span class="visibility-title">恒星距离范围</span>
          <output data-readout="stars"></output></div>
        <div class="visibility-slider-row double-range"><input data-visibility="star-min"
          type="range" min="0" max="1" step="0.001"><input data-visibility="star-max"
          type="range" min="0" max="1" step="0.001"></div>
        <div class="visibility-ticks star-distance-ticks">
          ${[1, 10, 100, 1_000, 5_001].map((distance) => {
            const value = distanceSliderValue(distance) * 100;
            const label = distance > 5_000 ? "∞" : distance >= 1_000 ? "1k" : distance;
            return `<i style="left:${value}%"><b>${label}</b></i>`;
          }).join("")}
        </div>
      </section>`;
    this.element.addEventListener("input", (event) => this.change(event));
    store.subscribe((settings) => this.sync(settings));
    window.addEventListener("xuanye-planet-visibility", (event) => {
      const detail = (event as CustomEvent<{ count: number }>).detail;
      this.livePlanetCount = detail.count;
      this.sync(this.store.current);
    });
  }

  private livePlanetCount = 10;

  private change(event: Event): void {
    const input = event.target as HTMLInputElement;
    const kind = input.dataset.visibility;
    if (kind === "planet") this.store.update({ planetVisibility: Number(input.value) });
    if (kind === "star-min") {
      const value = Math.min(parsecsFromSlider(Number(input.value)),
        this.store.current.starDistanceMax);
      this.store.update({ starDistanceMin: value });
    }
    if (kind === "star-max") {
      const value = Math.max(parsecsFromSlider(Number(input.value)),
        this.store.current.starDistanceMin);
      this.store.update({ starDistanceMax: value });
    }
  }

  private sync(settings: Readonly<XuanYeSettings>): void {
    const planet = this.element.querySelector<HTMLInputElement>("[data-visibility=planet]")!;
    planet.value = String(settings.planetVisibility);
    const threshold = planetThreshold(settings.planetVisibility);
    const orbit = PLANET_ORBIT_RADII_AU.filter(([, radius]) => radius <= threshold).at(-1);
    this.element.querySelector<HTMLOutputElement>("[data-readout=planet]")!.value =
      `显示到：${orbit?.[0] ?? "月球"}轨道 · 可见 ${this.livePlanetCount}/10`;
    this.element.querySelector<HTMLInputElement>("[data-visibility=star-min]")!.value =
      String(distanceSliderValue(settings.starDistanceMin));
    this.element.querySelector<HTMLInputElement>("[data-visibility=star-max]")!.value =
      String(distanceSliderValue(settings.starDistanceMax));
    let visible = 0;
    for (let index = 0; index < this.stars.count; index += 1) {
      const star = this.stars.get(index);
      const distance = Math.hypot(...star.position);
      if (starDistanceVisible(distance, star.distanceSource,
        settings.starDistanceMin, settings.starDistanceMax)) visible += 1;
    }
    const complete = this.skyculture.asterisms.filter((asterism) =>
      [...new Set(asterism.lines.flat())].every((hip) => {
        const star = this.stars.getByHip(hip);
        return Boolean(star && starDistanceVisible(Math.hypot(...star.position),
          star.distanceSource, settings.starDistanceMin, settings.starDistanceMax));
      })).length;
    const maximum = settings.starDistanceMax > 5_000 ? "∞" :
      `${settings.starDistanceMax.toFixed(0)} pc`;
    const range = `${settings.starDistanceMin.toFixed(0)}–${maximum}`;
    this.element.querySelector<HTMLOutputElement>("[data-readout=stars]")!.value =
      `${range} · ${visible} 颗 · 完整星官 ${complete}`;
  }
}
