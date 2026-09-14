import type { ObserverLocation } from "../lib/ephemeris";
import type { ChineseSkyculture, StarCatalog } from "../data/catalog";
import type { ViewPreset } from "../scene/camera-controller";
import { BaziChart } from "./charts/bazi-chart";
import type {
  ChartContext,
  ChartGender,
  ChartLink,
  ChartLinkWithLongitude,
  ChartTabId,
} from "./charts/types";
import { WesternChart } from "./charts/western-chart";
import { ZhengyuChart } from "./charts/zhengyu-chart";
import { GaitianChart } from "./charts/gaitian-chart";
import type { SettingsStore } from "../lib/settings-store";
import type { EclipticViewPole } from "../lib/chart-orientation";

interface ChartTab {
  id: ChartTabId;
  label: string;
  preset: ViewPreset;
}

export interface ChartPanelEvents {
  onPreset(preset: ViewPreset): void;
  onTab(tab: ChartTabId, westernMode: "modern" | "classical"): void;
  onActivate(link: ChartLinkWithLongitude): void;
  onHover(link: ChartLink | undefined): void;
  onVirtualRadius(enabled: boolean): void;
  onOrientation(alignment: {
    longitude: number;
    screenAngle: number;
    pole: EclipticViewPole;
    mc?: number;
    cusps?: number[];
    mansions?: number[];
  } | undefined, align?: boolean): void;
}

const TABS: readonly ChartTab[] = [
  { id: "observation", label: "观星", preset: "earth-view" },
  { id: "astrology", label: "星盘", preset: "geocentric" },
  { id: "zhengyu", label: "七政四余", preset: "geocentric" },
  { id: "bazi", label: "四柱八字", preset: "heliocentric" },
  { id: "gaitian", label: "盖天图", preset: "earth-view" },
];

const MODERN_HOUSE_SYSTEMS = [
  ["P", "普拉西德"],
  ["K", "Koch"],
  ["W", "整宫"],
  ["A", "等宫（ASC）"],
  ["O", "Porphyry"],
  ["R", "Regiomontanus"],
  ["C", "Campanus"],
  ["B", "Alcabitius"],
  ["D", "等宫（MC）"],
  ["M", "Morinus"],
  ["S", "Sripati"],
  ["T", "Topocentric"],
  ["X", "Meridian"],
  ["L", "Gauquelin"],
  ["U", "Krusinski"],
] as const;

const CLASSICAL_HOUSE_SYSTEMS = [
  ["P", "普拉西德"], ["K", "Koch"], ["O", "Porphyry"],
  ["R", "Regiomontanus"], ["C", "Campanus"], ["E", "等宫"],
  ["W", "整宫"], ["B", "Alcabitius"], ["M", "Morinus"],
  ["U", "Krusinski"], ["Y", "APC"],
] as const;

const ZHENGYU_ZODIACS = [
  ["0", "回归黄道", false],
  ["4", "恒星黄道", false],
  ["u1", "回归黄道 / 古宿无岁差", true],
  ["u2", "回归黄道 / 古宿+岁差", true],
  ["u3", "郑案制 / 古宿+岁差", true],
  ["u10", "星海词林制 / 原版", true],
  ["u11", "星海词林制 / 改版", true],
  ["u8", "郑案古宿 / 用今宿微调", true],
  ["u7", "郑案制 / 纯今宿", true],
  ["u5", "恒星黄道 / 古宿无岁差", true],
  ["u6", "恒星黄道 / 古宿+岁差", true],
  ["u9", "赤道回归 / 今宿", true],
  ["u12", "赤道郑案 / 今宿", true],
  ["u13", "赤道果老 / 授时", true],
  ["u14", "黄道果老 / 授时", true],
  ["u15", "黄道果老 / Moira", true],
  ["u16", "黄道古宿 / 开禧", true],
  ["u17", "黄道古宿 / 授时", true],
  ["u18", "赤道回归 / 古宿", true],
  ["u19", "赤道回归 / 古宿+岁差", true],
  ["u20", "赤道今宿 / 子中虚六", true],
  ["u21", "极黄今宿 / 子中虚六", true],
] as const;

const ZHENGYU_MANSIONS = [
  ["current", "今宿", false],
  ["ancient", "古宿无岁差", true],
  ["precession", "古宿＋岁差", true],
  ["shoushi", "授时", true],
  ["kaixi", "开禧", true],
  ["moira", "Moira", true],
  ["zi", "子中虚六", true],
] as const;

const ZHENGYU_MING = [
  ["0", "太阳起生时顺数至日出", false],
  ["2", "地平上升宫", false],
  ["1", "遇卯安命", true],
  ["3", "地平上升宫+与日同络", true],
  ["4", "自定义命宫地支", true],
] as const;

const ZHENGYU_SHEN = [
  ["0", "太阴为身", false],
  ["1", "太阴起生日逆数至日落", false],
  ["2", "太阴起生时逆数至月出", true],
] as const;

export class ChartPanel {
  readonly element: HTMLElement;

  private readonly western = new WesternChart();
  private readonly zhengyu = new ZhengyuChart();
  private readonly bazi = new BaziChart();
  private readonly gaitian: GaitianChart;
  private readonly content: HTMLElement;
  private readonly houseSelect: HTMLSelectElement;
  private activeTab: ChartTabId;
  private selectedBody?: string;
  private selectedAsterism?: string;
  private throttle?: number;
  private virtualRadius: boolean;
  private alignOnNextRender = false;
  private context: ChartContext = {
    date: new Date(),
    timeZone: "Asia/Shanghai",
    location: { latitude: 39.9316, longitude: 116.41 },
    gender: "male",
  };

  constructor(
    private readonly events: ChartPanelEvents,
    stars: StarCatalog,
    skyculture: ChineseSkyculture,
    private readonly settings: SettingsStore,
  ) {
    this.activeTab = settings.current.lastTab;
    this.virtualRadius = settings.current.virtualRadiusDefault;
    this.gaitian = new GaitianChart(stars, skyculture);
    this.element = document.createElement("aside");
    this.element.className = "chart-panel";
    this.element.innerHTML = `
      <button class="collapse-chart" type="button" aria-label="折叠盘面">›</button>
      <div class="chart-tabs" role="tablist"></div>
      <div class="chart-inputs" data-chart-toolbar>
        <div class="toolbar-group astrology-controls">
          <label>体例<select class="western-mode"><option value="modern">现代</option>
            <option value="classical">古典</option></select></label>
          <label>宫制<select class="house-system"></select></label>
        </div>
        <div class="toolbar-group zhengyu-controls">
          <label>黄道制<select class="zhengyu-zodiac"></select></label>
          <label>宿制<select class="zhengyu-mansion"></select></label>
          <label>命宫算法<select class="zhengyu-ming"></select></label>
          <label>身宫算法<select class="zhengyu-shen"></select></label>
          <label>交点<select class="zhengyu-node"><option value="false">平均</option>
            <option value="true">真</option></select></label>
        </div>
        <div class="toolbar-group bazi-controls">
          <label>性别<select class="chart-gender"><option value="male">男</option>
            <option value="female">女</option></select></label>
          <label class="toolbar-check"><input class="bazi-true-solar" type="checkbox">
            真太阳时</label>
        </div>
        <div class="chart-text-toggle" role="group" aria-label="盘面标注方式">
          <button type="button" data-chart-text="text">文字</button>
          <button type="button" data-chart-text="symbol">符号</button>
        </div>
        <div class="toolbar-group shared-chart-controls">
          <label class="context-visibility-toggle"><input type="checkbox">
            隐藏未涉及天体</label>
          <button class="virtual-radius-toggle" type="button">同心圆对照</button>
          <button class="return-chart-orientation" type="button">回到盘面朝向</button>
        </div>
      </div>
      <div class="chart-content"></div>
    `;
    this.content = this.query(".chart-content");
    this.houseSelect = this.query(".house-system");
    this.populateHouseSystems();
    this.populateZhengyuOptions();
    this.buildTabs();
    this.bindControls();
    this.bindLinkage();
    this.render();
    this.settings.subscribe(() => this.render());
  }

  setContext(
    date: Date,
    timeZone: string,
    location: ObserverLocation,
    playing = false,
  ): void {
    this.context = { ...this.context, date, timeZone, location };
    if (!playing) {
      if (this.throttle !== undefined) window.clearTimeout(this.throttle);
      this.throttle = undefined;
      this.render();
      return;
    }
    if (this.throttle !== undefined) return;
    this.throttle = window.setTimeout(() => {
      this.throttle = undefined;
      this.render();
    }, 240);
  }

  setSelectedBody(id: string | undefined): void {
    this.selectedBody = id;
    this.applySelection();
  }

  setHoveredBody(id: string | undefined): void {
    this.content.querySelectorAll<HTMLElement>("[data-body]").forEach((element) => {
      element.classList.toggle("is-hovered", element.dataset.body === id);
    });
  }

  setSelectedAsterism(id: string | undefined): void {
    this.selectedAsterism = id;
    this.applySelection();
  }

  activateTab(tab: string): void {
    const definition = TABS.find((item) => item.id === tab);
    if (!definition) return;
    this.activateDefinition(definition);
  }

  activateForSelfTest(tab: ChartTabId, mode: "modern" | "classical"): void {
    this.western.mode = mode;
    this.query<HTMLSelectElement>(".western-mode").value = mode;
    this.populateHouseSystems();
    this.activateTab(tab);
  }

  private buildTabs(): void {
    const tabs = this.query<HTMLElement>(".chart-tabs");
    TABS.forEach((tab) => {
      const button = document.createElement("button");
      button.type = "button";
      button.role = "tab";
      button.textContent = tab.label;
      button.dataset.tab = tab.id;
      button.addEventListener("click", () => {
        this.activateDefinition(tab);
      });
      tabs.append(button);
    });
    this.activateTabs();
  }

  private bindControls(): void {
    this.query<HTMLSelectElement>(".chart-gender").addEventListener("change", (event) => {
      this.context.gender = (event.currentTarget as HTMLSelectElement).value as ChartGender;
      this.render();
    });
    this.query<HTMLSelectElement>(".western-mode").addEventListener("change", (event) => {
      this.western.mode = (event.currentTarget as HTMLSelectElement).value as
        "modern" | "classical";
      this.populateHouseSystems();
      this.events.onTab(this.activeTab, this.western.mode);
      this.render();
    });
    this.houseSelect.addEventListener("change", () => {
      this.western.houseSystem = this.houseSelect.value;
      this.render();
    });
    this.query<HTMLSelectElement>(".zhengyu-zodiac").addEventListener(
      "change",
      (event) => this.settings.update({
        zhengyuCalcType: Number((event.currentTarget as HTMLSelectElement).value) as 0 | 4,
      }),
    );
    this.query<HTMLSelectElement>(".zhengyu-ming").addEventListener(
      "change",
      (event) => this.settings.update({
        zhengyuMingType: Number((event.currentTarget as HTMLSelectElement).value) as 0 | 2,
      }),
    );
    this.query<HTMLSelectElement>(".zhengyu-shen").addEventListener(
      "change",
      (event) => this.settings.update({
        zhengyuShenType: Number((event.currentTarget as HTMLSelectElement).value) as 0 | 1,
      }),
    );
    this.query<HTMLSelectElement>(".zhengyu-node").addEventListener("change", (event) => {
      this.settings.update({
        zhengyuNodeTrue: (event.currentTarget as HTMLSelectElement).value === "true",
      });
    });
    this.query<HTMLInputElement>(".bazi-true-solar").addEventListener("change", (event) => {
      this.settings.update({
        baziTrueSolarTime: (event.currentTarget as HTMLInputElement).checked,
      });
    });
    this.element.querySelectorAll<HTMLButtonElement>("[data-chart-text]").forEach((button) => {
      button.addEventListener("click", () => {
        this.settings.update({
          chartTextMode: button.dataset.chartText as "text" | "symbol",
        });
      });
    });
    this.query<HTMLButtonElement>(".virtual-radius-toggle").addEventListener("click", () => {
      this.virtualRadius = !this.virtualRadius;
      this.events.onVirtualRadius(this.virtualRadius);
      this.render();
    });
    this.query<HTMLButtonElement>(".return-chart-orientation").addEventListener(
      "click",
      () => this.emitOrientation(true),
    );
    const collapse = this.query<HTMLButtonElement>(".collapse-chart");
    collapse.addEventListener("click", () => {
      const collapsed = this.element.classList.toggle("is-collapsed");
      collapse.textContent = collapsed ? "‹" : "›";
      collapse.setAttribute("aria-label", collapsed ? "展开盘面" : "折叠盘面");
      this.element.dispatchEvent(new CustomEvent("chart-layout-change"));
    });
    this.query<HTMLInputElement>(".context-visibility-toggle input").addEventListener(
      "change",
      (event) => this.settings.update({
        hideUninvolved: (event.currentTarget as HTMLInputElement).checked,
      }),
    );
  }

  private bindLinkage(): void {
    this.content.addEventListener("click", (event) => {
      const aspect = (event.target as Element).closest<HTMLElement>("[data-aspect-bodies]");
      if (aspect) {
        this.highlightAspect(aspect.dataset.aspectBodies!);
        return;
      }
      const rule = (event.target as Element).closest<HTMLElement>("[data-rule-bodies]");
      if (rule) {
        this.highlightBodies(rule.dataset.ruleBodies!);
        return;
      }
      const pillars = (event.target as Element).closest<HTMLElement>("[data-pillar-indices]");
      if (pillars) {
        this.highlightPillars(pillars.dataset.pillarIndices!);
        return;
      }
      const target = (event.target as Element).closest<HTMLElement>("[data-link-kind]");
      if (target) this.events.onActivate(this.readLink(target));
    });
    this.content.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const pillars = (event.target as Element).closest<HTMLElement>("[data-pillar-indices]");
      if (pillars) {
        this.highlightPillars(pillars.dataset.pillarIndices!);
        return;
      }
      const target = (event.target as Element).closest<HTMLElement>("[data-link-kind]");
      if (target) this.events.onActivate(this.readLink(target));
    });
    this.content.addEventListener("pointerover", (event) => {
      const target = (event.target as Element).closest<HTMLElement>("[data-link-kind]");
      this.events.onHover(target ? this.readLink(target) : undefined);
    });
    this.content.addEventListener("pointerout", (event) => {
      if (!this.element.contains(event.relatedTarget as Node)) this.events.onHover(undefined);
    });
  }

  private highlightAspect(value: string): void {
    this.highlightBodies(value);
    this.content.querySelectorAll<HTMLElement>("[data-aspect-bodies]").forEach((element) => {
      element.classList.toggle("is-aspect-linked", element.dataset.aspectBodies === value);
    });
  }

  private highlightBodies(value: string): void {
    const bodies = new Set(value.split(","));
    this.content.querySelectorAll<HTMLElement>("[data-body]").forEach((element) => {
      element.classList.toggle("is-aspect-linked", bodies.has(element.dataset.body!));
    });
    this.content.querySelectorAll<HTMLElement>("[data-rule-bodies]").forEach((element) => {
      element.classList.toggle("is-aspect-linked", element.dataset.ruleBodies === value);
    });
  }

  private highlightPillars(value: string): void {
    const indices = new Set(value.split(","));
    this.content.querySelectorAll<HTMLElement>("[data-pillar-index]").forEach((element) => {
      element.classList.toggle("is-rule-linked", indices.has(element.dataset.pillarIndex!));
    });
    this.content.querySelectorAll<HTMLElement>("[data-pillar-indices]").forEach((element) => {
      element.classList.toggle("is-rule-linked", element.dataset.pillarIndices === value);
    });
  }

  private readLink(element: HTMLElement): ChartLinkWithLongitude {
    const kind = element.dataset.linkKind as ChartLink["kind"];
    const id = element.dataset.linkId!;
    const longitudeSource = element.dataset.longitude !== undefined
      ? element : element.querySelector<HTMLElement>("[data-longitude]");
    const longitude = longitudeSource?.dataset.longitude === undefined
      ? undefined : Number(longitudeSource.dataset.longitude);
    const link = kind === "body" || kind === "asterism" || kind === "sky"
      ? { kind, id }
      : { kind, id: Number(id) };
    return { ...link, longitude } as ChartLinkWithLongitude;
  }

  private render(): void {
    const visibility = this.query<HTMLElement>(".context-visibility-toggle");
    visibility.hidden = this.activeTab === "observation";
    visibility.querySelector("input")!.checked = this.settings.current.hideUninvolved;
    this.query<HTMLElement>(".chart-inputs").hidden = this.activeTab === "observation";
    this.query<HTMLElement>(".astrology-controls").hidden =
      this.activeTab !== "astrology";
    this.query<HTMLElement>(".zhengyu-controls").hidden = this.activeTab !== "zhengyu";
    this.query<HTMLElement>(".bazi-controls").hidden = this.activeTab !== "bazi";
    this.query<HTMLElement>(".chart-text-toggle").hidden =
      this.activeTab !== "astrology" && this.activeTab !== "zhengyu";
    const comparison = this.query<HTMLButtonElement>(".virtual-radius-toggle");
    comparison.disabled = !this.isComparisonTab();
    comparison.classList.toggle("is-active", this.virtualRadius);
    comparison.setAttribute("aria-pressed", String(this.virtualRadius));
    this.query<HTMLButtonElement>(".return-chart-orientation").disabled =
      this.activeTab === "bazi";
    this.query<HTMLSelectElement>(".zhengyu-zodiac").value =
      String(this.settings.current.zhengyuCalcType);
    this.query<HTMLSelectElement>(".zhengyu-mansion").value = "current";
    this.query<HTMLSelectElement>(".zhengyu-ming").value =
      String(this.settings.current.zhengyuMingType);
    this.query<HTMLSelectElement>(".zhengyu-shen").value =
      String(this.settings.current.zhengyuShenType);
    this.query<HTMLSelectElement>(".zhengyu-node").value =
      String(this.settings.current.zhengyuNodeTrue);
    this.query<HTMLInputElement>(".bazi-true-solar").checked =
      this.settings.current.baziTrueSolarTime;
    this.element.querySelectorAll<HTMLElement>("[data-chart-text]").forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.chartText === this.settings.current.chartTextMode,
      );
    });
    if (this.activeTab === "observation") {
      this.content.innerHTML = `<section class="observation-card">
        <span class="chart-eyebrow">OBSERVATION</span><h2>观星</h2>
        <div class="empty-wheel"><i></i><i></i><i></i><i></i><i></i><i></i>
          <span class="wheel-earth">观</span></div>
        <p>当前不与盘面比较。可自由观察天体、星官与真实空间深度。</p>
      </section>`;
      this.events.onOrientation(undefined);
      this.alignOnNextRender = false;
      return;
    }
    const renderer = this.activeTab === "astrology" ? this.western
      : this.activeTab === "zhengyu" ? this.zhengyu
        : this.activeTab === "bazi" ? this.bazi : this.gaitian;
    try {
      this.content.innerHTML = renderer.render(this.context, {
        selectedBody: this.selectedBody,
        textMode: this.settings.current.chartTextMode,
        nameStyle: this.settings.current.nameStyle,
        zhengyuCalcType: this.settings.current.zhengyuCalcType,
        zhengyuMingType: this.settings.current.zhengyuMingType,
        zhengyuShenType: this.settings.current.zhengyuShenType,
        zhengyuNodeTrue: this.settings.current.zhengyuNodeTrue,
        baziTrueSolarTime: this.settings.current.baziTrueSolarTime,
        aspectOrbs: this.settings.current.aspectOrbs,
      });
    } catch (error) {
      this.content.innerHTML = `<p class="chart-error">盘面计算失败：` +
        `${error instanceof Error ? error.message : "无效输入"}</p>`;
    }
    this.makeTablesCollapsible();
    this.applySelection();
    this.emitOrientation(this.alignOnNextRender && this.settings.current.alignChartOrientation);
    this.alignOnNextRender = false;
  }

  private emitOrientation(align: boolean): void {
    const alignment = this.content.querySelector<HTMLElement>("[data-alignment-pole]");
    this.events.onOrientation(alignment ? {
      longitude: Number(alignment.dataset.alignmentLongitude),
      screenAngle: Number(alignment.dataset.alignmentAngle),
      pole: alignment.dataset.alignmentPole as EclipticViewPole,
      mc: alignment.dataset.guideMc === undefined
        ? undefined : Number(alignment.dataset.guideMc),
      cusps: alignment.dataset.guideCusps?.split(",").map(Number),
      mansions: alignment.dataset.guideMansions?.split(",").map(Number),
    } : undefined, align);
  }

  private activateDefinition(definition: ChartTab): void {
    this.activeTab = definition.id;
    this.activateTabs();
    this.events.onPreset(definition.preset);
    this.events.onTab(definition.id, this.western.mode);
    this.alignOnNextRender = false;
    this.settings.update({ lastTab: definition.id });
    this.events.onVirtualRadius(this.isComparisonTab() && this.virtualRadius);
    this.alignOnNextRender = true;
    this.render();
  }

  private applySelection(): void {
    this.content.querySelectorAll<HTMLElement>("[data-body]").forEach((element) => {
      element.classList.toggle("is-linked", element.dataset.body === this.selectedBody);
    });
    this.content.querySelectorAll<HTMLElement>("[data-link-kind=asterism]")
      .forEach((element) => {
        element.classList.toggle("is-linked", element.dataset.linkId === this.selectedAsterism);
      });
  }

  private populateHouseSystems(): void {
    const systems = this.western.mode === "modern"
      ? MODERN_HOUSE_SYSTEMS
      : CLASSICAL_HOUSE_SYSTEMS;
    const previous = this.western.houseSystem;
    this.houseSelect.replaceChildren(
      ...systems.map(([value, label]) => new Option(label, value)),
    );
    const supported = systems.some(([value]) => value === previous);
    this.houseSelect.value = supported ? previous : "P";
    this.western.houseSystem = this.houseSelect.value;
  }

  private populateZhengyuOptions(): void {
    this.populateOptions(".zhengyu-zodiac", ZHENGYU_ZODIACS);
    this.populateOptions(".zhengyu-mansion", ZHENGYU_MANSIONS);
    this.populateOptions(".zhengyu-ming", ZHENGYU_MING);
    this.populateOptions(".zhengyu-shen", ZHENGYU_SHEN);
  }

  private populateOptions(
    selector: string,
    choices: ReadonlyArray<readonly [string, string, boolean]>,
  ): void {
    const select = this.query<HTMLSelectElement>(selector);
    select.replaceChildren(...choices.map(([value, label, disabled]) => {
      const option = new Option(label, value);
      option.disabled = disabled;
      if (disabled) option.title = "未实现";
      return option;
    }));
  }

  private makeTablesCollapsible(): void {
    for (const heading of [...this.content.querySelectorAll<HTMLHeadingElement>("h3")]) {
      const body = heading.nextElementSibling;
      if (!body) continue;
      const details = document.createElement("details");
      details.className = "chart-table-section";
      details.open = heading.dataset.collapsed !== "true";
      const summary = document.createElement("summary");
      summary.textContent = heading.textContent;
      heading.replaceWith(details);
      details.append(summary, body);
    }
  }

  private activateTabs(): void {
    this.element.querySelectorAll<HTMLElement>("[role=tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tab === this.activeTab);
      button.setAttribute("aria-selected", String(button.dataset.tab === this.activeTab));
    });
  }

  private isComparisonTab(): boolean {
    return this.activeTab === "astrology" || this.activeTab === "zhengyu";
  }

  private query<T extends Element>(selector: string): T {
    const element = this.element.querySelector<T>(selector);
    if (!element) throw new Error(`Missing chart panel element: ${selector}`);
    return element;
  }
}
