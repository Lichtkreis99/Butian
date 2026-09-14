import type { SettingsStore, XuanYeSettings } from "../lib/settings-store";

export class SettingsPanel {
  readonly element = document.createElement("aside");

  constructor(private readonly store: SettingsStore) {
    this.element.className = "settings-panel";
    this.element.setAttribute("aria-label", "设置");
    this.element.innerHTML = `
      <header><span class="section-kicker">PREFERENCES</span><h2>设置</h2>
        <button class="settings-close" type="button" aria-label="关闭设置">×</button></header>
      <div class="settings-scroll">
        <fieldset><legend>显示与名称</legend>
          <label>名称风格<select data-setting="nameStyle">
            <option value="auto">按盘面自动</option>
            <option value="modern-zh">当代中文</option>
            <option value="ancient-zh">古代中文</option>
            <option value="english">English</option>
          </select></label>
          <label>标签密度<input data-setting="labelDensity" type="range" min="0"
            max="1" step="0.01"></label>
          <label>恒星亮度<input data-setting="starBrightness" type="range" min="0"
            max="1" step="0.01"></label>
          <label>恒星相对尺度<input data-setting="starRelativeScale" type="range" min="0"
            max="1" step="0.01"></label>
          <label>恒星绝对尺度<input data-setting="starAbsoluteScale" type="range" min="0"
            max="1" step="0.01"></label>
        </fieldset>
        <fieldset><legend>天空亮度</legend>
          <label class="bortle-setting"><span>光污染</span>
            <output class="bortle-readout"></output>
            <input data-setting="bortleClass" type="range" min="1" max="9" step="1">
          </label>
        </fieldset>
        <fieldset><legend>投影方式</legend>
          <label>投影方式<select data-setting="planetariumProjection">
            <option value="stereographic">球极投影</option>
            <option value="perspective">透视</option>
            <option value="fisheye">鱼眼 / 等距</option>
          </select></label>
        </fieldset>
        <fieldset class="aspect-orb-settings"><legend>相位容许度</legend>
          <p>现代盘按相位设置；古典盘使用七曜各自光体半径。</p>
          ${this.orb("1", "合")}${this.orb("2", "冲")}
          ${this.orb("3", "拱")}${this.orb("4", "刑")}${this.orb("5", "六合")}
          ${this.orb("6", "半六合")}${this.orb("7", "梅花")}
          ${this.orb("8", "半刑")}${this.orb("9", "补八分")}
          ${this.orb("10", "五分")}
        </fieldset>
        <fieldset><legend>默认开关</legend>
          ${this.check("involvedLabelsOnly", "只显示当前盘面涉及的天体名")}
          ${this.check("virtualRadiusDefault", "同心圆对照默认开启")}
          ${this.check("alignChartOrientation", "进入盘面时视角与盘面同向")}
          ${this.check("hideUninvolved", "隐藏未涉及天体")}
          ${this.check("orbitLines", "轨道线默认开启")}
          ${this.check("projectionLines", "投影线默认开启")}
          ${this.check("gridVisible", "网格默认开启")}
          ${this.check("milkyWay", "银河默认开启")}
          ${this.check("deepSkyObjects", "深空天体默认开启")}
        </fieldset>
        <fieldset><legend>星官图层</legend>
          ${this.check("asterismLayers.enclosures", "三垣")}
          ${this.check("asterismLayers.mansions", "二十八宿")}
          ${this.check("asterismLayers.other", "其他星官")}
        </fieldset>
      </div>
      <footer><button class="settings-reset quiet-button" type="button">恢复默认</button></footer>
    `;
    this.element.querySelector(".settings-close")!.addEventListener("click", () => {
      this.close();
    });
    this.element.querySelector(".settings-reset")!.addEventListener("click", () => {
      this.store.reset();
    });
    this.element.addEventListener("change", (event) => this.change(event));
    this.element.addEventListener("input", (event) => this.change(event));
    this.store.subscribe((settings) => this.sync(settings));
  }

  open(): void {
    this.element.classList.add("is-open");
    this.element.querySelector<HTMLElement>("select, input")?.focus();
  }

  close(): void {
    this.element.classList.remove("is-open");
  }

  private check(path: string, label: string): string {
    return `<label class="setting-check"><input data-setting="${path}" ` +
      `type="checkbox"><span>${label}</span></label>`;
  }

  private orb(type: string, label: string): string {
    return `<label>${label}<input data-setting="aspectOrbs.${type}" type="number" ` +
      `min="0" max="15" step="0.5"><span>°</span></label>`;
  }

  private change(event: Event): void {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const path = input.dataset.setting;
    if (!path) return;
    const value = input instanceof HTMLInputElement && input.type === "checkbox"
      ? input.checked
      : input instanceof HTMLInputElement && (input.type === "range" ||
          input.type === "number") ? Number(input.value) : input.value;
    if (path.startsWith("asterismLayers.")) {
      const key = path.split(".")[1] as keyof XuanYeSettings["asterismLayers"];
      this.store.update({
        asterismLayers: { ...this.store.current.asterismLayers, [key]: value },
      });
      return;
    }
    if (path.startsWith("aspectOrbs.")) {
      const key = Number(path.split(".")[1]) as keyof XuanYeSettings["aspectOrbs"];
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return;
      const orb = Math.min(15, Math.max(0, numeric));
      this.store.update({
        aspectOrbs: { ...this.store.current.aspectOrbs, [key]: orb },
      });
      return;
    }
    this.store.update({ [path]: value } as Partial<XuanYeSettings>);
  }

  private sync(settings: Readonly<XuanYeSettings>): void {
    this.element.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]")
      .forEach((input) => {
        const path = input.dataset.setting!;
        const value = path.startsWith("asterismLayers.")
          ? settings.asterismLayers[path.split(".")[1] as keyof XuanYeSettings["asterismLayers"]]
          : path.startsWith("aspectOrbs.")
            ? settings.aspectOrbs[
              Number(path.split(".")[1]) as keyof XuanYeSettings["aspectOrbs"]
            ]
            : settings[path as keyof XuanYeSettings];
        if (input instanceof HTMLInputElement && input.type === "checkbox") {
          input.checked = Boolean(value);
        } else input.value = String(value);
      });
    const bortle = settings.bortleClass;
    this.element.querySelector<HTMLOutputElement>(".bortle-readout")!.textContent =
      `Bortle ${bortle} · 极限星等 ${(8.05 - bortle * 0.45).toFixed(1)}`;
  }
}
