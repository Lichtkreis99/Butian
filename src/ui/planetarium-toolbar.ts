import { contextProfile, type WesternMode } from "../lib/context-profiles";
import type { SettingsStore, XuanYeSettings } from "../lib/settings-store";
import type { ChartTabId } from "./charts/types";

const TOGGLES: Array<[keyof XuanYeSettings, string, string, boolean?]> = [
  ["constellationLines", "⌁", "星座连线"],
  ["constellationNames", "名", "星座名"],
  ["constellationArt", "象", "星座星象"],
  ["milkyWay", "河", "银河"],
  ["deepSkyObjects", "深", "深空天体"],
  ["planetLabels", "曜", "行星名"],
  ["orbitLines", "轨", "轨道线"],
  ["projectionLines", "投", "投影线 / 与中心天体连线"],
  ["gridVisible", "网", "网格"],
  ["atmosphere", "气", "大气", true],
  ["cardinalPoints", "方", "方位点", true],
  ["horizonGrid", "地", "地平网格", true],
  ["equatorialGrid", "赤", "赤道网格", true],
];

export class PlanetariumToolbar {
  readonly element = document.createElement("section");

  private tab: ChartTabId = "observation";
  private westernMode: WesternMode = "modern";

  constructor(private readonly store: SettingsStore) {
    this.element.className = "planetarium-toolbar layer-toolbar dock-panel";
    this.element.dataset.dockPanel = "layers";
    this.element.setAttribute("aria-label", "图层工具栏");
    this.element.innerHTML = `<span class="dock-title">图层</span>` +
      TOGGLES.map(([key, icon, label, inner]) =>
        `<button type="button" data-toggle="${key}" title="${label}" ` +
        `aria-label="${label}"${inner ? " data-inner-only" : ""}>${icon}</button>`,
      ).join("") + `
        <label title="星空文化"><span>文化</span><select data-quick="skyCulture">
          <option value="chinese">中国星官</option><option value="western">西方星座</option>
        </select></label>
        <label data-inner-only title="地景"><span>地景</span>
          <select data-quick="landscape"><option value="flat">纯色</option>
            <option value="photo">实景</option><option value="off">关</option>
          </select></label>`;
    this.element.addEventListener("click", (event) => this.toggle(event));
    this.element.addEventListener("change", (event) => this.change(event));
    store.subscribe((settings) => this.sync(settings));
  }

  setContext(tab: ChartTabId, westernMode: WesternMode, inner: boolean): void {
    this.tab = tab;
    this.westernMode = westernMode;
    this.element.classList.toggle("is-inner", inner);
    this.sync(this.store.current);
  }

  private toggle(event: Event): void {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-toggle]");
    if (!button || button.disabled) return;
    const key = button.dataset.toggle as keyof XuanYeSettings;
    this.store.update({ [key]: !this.store.current[key] } as Partial<XuanYeSettings>);
  }

  private change(event: Event): void {
    const select = (event.target as Element).closest<HTMLSelectElement>("[data-quick]");
    if (!select) return;
    if (select.dataset.quick === "landscape") {
      this.store.update({
        landscape: select.value as XuanYeSettings["landscape"],
        ground: select.value === "flat",
      });
      return;
    }
    this.store.update({ [select.dataset.quick!]: select.value } as Partial<XuanYeSettings>);
  }

  private sync(settings: Readonly<XuanYeSettings>): void {
    const profile = contextProfile(this.tab, this.westernMode);
    this.element.querySelectorAll<HTMLButtonElement>("[data-toggle]").forEach((button) => {
      const key = button.dataset.toggle as keyof XuanYeSettings;
      button.classList.toggle("is-active", Boolean(settings[key]));
      button.setAttribute("aria-pressed", String(Boolean(settings[key])));
      if (key === "projectionLines") button.disabled = !profile.projectionLines;
    });
    const art = this.element.querySelector<HTMLButtonElement>(
      "[data-toggle=constellationArt]",
    )!;
    art.disabled = settings.skyCulture === "chinese";
    art.title = art.disabled ? "中国星官无插图" : "星座星象";
    this.element.querySelectorAll<HTMLSelectElement>("[data-quick]").forEach((select) => {
      select.value = String(settings[select.dataset.quick! as keyof XuanYeSettings]);
    });
  }
}
