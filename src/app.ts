import type { MansionDefinition } from "./data/mansions";
import type { ObserverLocation } from "./lib/ephemeris";
import { CelestialScene } from "./scene/celestial-scene";
import type { SkyMode, SphereViewpoint } from "./scene/celestial-scene";
import type { ViewPreset } from "./scene/camera-controller";
import { AboutDialog } from "./ui/about-dialog";
import { ChartPanel } from "./ui/chart-panel";
import { InfoPanel } from "./ui/info-panel";
import { TimeBar } from "./ui/time-bar";
import { WorkspaceSplitter } from "./ui/workspace-splitter";
import { SettingsStore } from "./lib/settings-store";
import { SettingsPanel } from "./ui/settings-panel";
import { loadCatalogData } from "./data/catalog";
import { layoutMeasurementPasses, type LayoutStep } from
  "./lib/layout-verification";
import { PlanetariumToolbar } from "./ui/planetarium-toolbar";
import { VisibilityControls } from "./ui/visibility-controls";
import {
  colorsHaveClearContrast,
  colorsWithinTolerance,
  groundColorForSunAltitude,
} from "./lib/ground-shading";
import type { ChartTabId } from "./ui/charts/types";
import { SkySearch } from "./ui/sky-search";
import { extinctionMagnitude } from "./lib/sky-appearance";

const PRESETS: ReadonlyArray<{ id: ViewPreset; label: string; index: string }> = [
  { id: "heliocentric", label: "太阳系俯视", index: "壹" },
  { id: "geocentric", label: "地心俯视", index: "贰" },
  { id: "earth-view", label: "地球视点", index: "叁" },
  { id: "xuanye", label: "宣夜漫游", index: "肆" },
  { id: "other-star", label: "他星回望", index: "伍" },
];

const GROUND_PHASES = ["flat-day", "flat-night", "landscape-day"] as const;
const GROUND_PROJECTIONS = ["stereographic", "perspective", "fisheye"] as const;
type GroundPhase = typeof GROUND_PHASES[number];
type GroundProjection = typeof GROUND_PROJECTIONS[number];
const GROUND_SELFTEST_TIMEOUT_MS = 60_000;
const CHART_SELFTEST_CASES: ReadonlyArray<{
  label: string;
  tab: ChartTabId;
  mode: "modern" | "classical";
  preset: ViewPreset;
}> = [
  { label: "观星", tab: "observation", mode: "modern", preset: "earth-view" },
  { label: "星盘 modern", tab: "astrology", mode: "modern", preset: "geocentric" },
  { label: "星盘 classical", tab: "astrology", mode: "classical", preset: "geocentric" },
  { label: "七政四余", tab: "zhengyu", mode: "modern", preset: "geocentric" },
  { label: "四柱八字", tab: "bazi", mode: "modern", preset: "heliocentric" },
  { label: "盖天图", tab: "gaitian", mode: "modern", preset: "earth-view" },
];

const DRAG_SELFTEST_CASES = [
  { mode: "xuanye", label: "宣夜 / 观星", tab: "observation", preset: "earth-view" },
  { mode: "xuanye", label: "宣夜 / 星盘", tab: "astrology", preset: "geocentric" },
  { mode: "xuanye", label: "宣夜 / 七政四余", tab: "zhengyu", preset: "geocentric" },
  { mode: "xuanye", label: "宣夜 / 四柱八字", tab: "bazi", preset: "heliocentric" },
  { mode: "xuanye", label: "宣夜 / 盖天图", tab: "gaitian", preset: "earth-view" },
  { mode: "xuanye-roam", label: "宣夜漫游 / 观星", tab: "observation", preset: "xuanye" },
  { mode: "huntian-inner", label: "浑天内视 / 观星", tab: "observation",
    preset: "earth-view" },
  { mode: "huntian-inner", label: "浑天内视 / 星盘", tab: "astrology",
    preset: "geocentric" },
  { mode: "huntian-outer", label: "浑天外视 / 观星", tab: "observation",
    preset: "earth-view" },
  { mode: "gaitian", label: "盖天 / 盖天图", tab: "gaitian", preset: "earth-view" },
] as const;

type DragSelfTestMode = typeof DRAG_SELFTEST_CASES[number]["mode"];
const SELFTEST_TIMEOUT_MS = 90_000;
const SKY_SELFTEST_PARTS = [
  "labels", "stars", "extinction", "inertia", "zoom", "search", "deep-sky",
] as const;
type SkySelfTestPart = typeof SKY_SELFTEST_PARTS[number];

export class XuanYeApp {
  private readonly settings = new SettingsStore();
  private readonly scene: CelestialScene;
  private readonly infoPanel: InfoPanel;
  private readonly chartPanel: ChartPanel;
  private readonly layerToolbar: PlanetariumToolbar;
  private readonly tooltip: HTMLElement;
  private currentDate = new Date();
  private location: ObserverLocation = { latitude: 39.9316, longitude: 116.41 };
  private skyMode: SkyMode = "xuanye";
  private activeTab: ChartTabId = "observation";
  private westernMode: "modern" | "classical" = "modern";

  constructor(root: HTMLElement) {
    const data = loadCatalogData();
    root.innerHTML = `
      <div class="app-shell">
        <div class="time-slot"></div>
        <main class="workspace">
          <section class="sky-viewport">
            <div class="scene-host"></div>
            <div class="viewport-heading">
              <span class="section-kicker">宣夜层 · THREE-DIMENSIONAL SKY</span>
              <h1>天体本无垣界，因目而成象</h1>
            </div>
            <section class="view-dock dock-panel" data-dock-panel="viewpoint">
              <button class="dock-heading" type="button" aria-expanded="true">
                <span>视点</span><i>−</i></button>
              <div class="view-dock-body">
                <nav class="view-presets" aria-label="观察视角"></nav>
                <div class="sphere-controls">
                  <label>机位<select class="sphere-viewpoint">
                    <option value="earth">地球</option><option value="sun">太阳</option>
                    <option value="camera">当前相机</option>
                    <option value="selected">所选恒星</option>
                  </select></label>
                  <label class="view-kind"><input class="huntian-exterior"
                    type="checkbox">外视</label>
                  <label><input class="sphere-lock" type="checkbox" checked>锁定机位</label>
                  <label><input class="depth-lines" type="checkbox">深度连线</label>
                  <button class="dissolve-button quiet-button" type="button">解体演示</button>
                  <button class="dissolve-pause quiet-button" type="button">暂停</button>
                </div>
              </div>
            </section>
            <section class="range-dock dock-panel" data-dock-panel="range">
              <button class="range-dock-toggle" type="button" aria-expanded="false">
                显示范围</button><div class="range-dock-body"></div>
            </section>
            <div class="scene-readout">
              <span class="live-dot"></span>
              <span>${data.stars.count.toLocaleString("zh-CN")} 颗恒星</span>
              <i></i>
              <span>Gaia DR3 · J2000</span>
            </div>
            <p class="control-hint">拖拽环视 · 滚轮跨尺度 · WASD / QE 自由飞行</p>
            <button class="about-button quiet-button" type="button">关于</button>
            <div class="mansion-tooltip" role="tooltip"></div>
          </section>
        </main>
      </div>
    `;
    const viewport = root.querySelector<HTMLElement>(".sky-viewport")!;
    const sceneHost = root.querySelector<HTMLElement>(".scene-host")!;
    this.tooltip = root.querySelector<HTMLElement>(".mansion-tooltip")!;
    this.infoPanel = new InfoPanel(
      data.stars,
      data.skyculture,
      () => this.scene.flyToSelection(),
    );
    viewport.append(this.infoPanel.element);

    this.scene = new CelestialScene(sceneHost, data.stars, data.skyculture, data.western, {
      onSelection: (selection) => {
        this.infoPanel.setSelection(selection);
        this.chartPanel.setSelectedBody(
          selection.kind === "body" || selection.kind === "point"
            ? selection.id
            : undefined,
        );
        this.chartPanel.setSelectedAsterism(
          selection.kind === "asterism" ? selection.asterism.id : undefined,
        );
      },
      onBodyHover: (id) => this.chartPanel.setHoveredBody(id),
      onMansionHover: (mansion, longitude, point) => {
        this.showMansionTooltip(mansion, longitude, point);
      },
    });
    this.scene.setDate(this.currentDate);
    this.scene.setLocation(this.location);
    this.layerToolbar = new PlanetariumToolbar(this.settings);
    viewport.append(this.layerToolbar.element);
    const rangeControls = new VisibilityControls(
      this.settings,
      data.stars,
      data.skyculture,
      true,
    ).element;
    root.querySelector(".range-dock-body")!.append(rangeControls);
    const viewDock = root.querySelector<HTMLElement>(".view-dock")!;
    viewDock.querySelector<HTMLButtonElement>(".dock-heading")!.addEventListener(
      "click",
      (event) => {
        const collapsed = viewDock.classList.toggle("is-collapsed");
        const button = event.currentTarget as HTMLButtonElement;
        button.setAttribute("aria-expanded", String(!collapsed));
        button.querySelector("i")!.textContent = collapsed ? "+" : "−";
      },
    );
    const rangeDock = root.querySelector<HTMLElement>(".range-dock")!;
    rangeDock.querySelector<HTMLButtonElement>(".range-dock-toggle")!.addEventListener(
      "click",
      (event) => {
        const open = rangeDock.classList.toggle("is-open");
        (event.currentTarget as HTMLButtonElement).setAttribute(
          "aria-expanded",
          String(open),
        );
      },
    );

    const presetNav = root.querySelector<HTMLElement>(".view-presets")!;
    PRESETS.forEach((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.preset = preset.id;
      button.innerHTML = `<span>${preset.index}</span>${preset.label}`;
      button.addEventListener("click", () => this.selectPreset(preset.id));
      presetNav.append(button);
    });

    this.chartPanel = new ChartPanel({
      onPreset: (preset) => this.selectPreset(preset),
      onTab: (tab, westernMode) => {
        this.activeTab = tab;
        this.westernMode = westernMode;
        this.scene.setChartTab(tab, westernMode);
        this.infoPanel.setNaming(this.settings.current.nameStyle, tab);
        this.syncLayerToolbar();
      },
      onActivate: (link) => {
        if (link.kind === "body") this.chartPanel.setSelectedBody(link.id);
        this.scene.activateChartLink(link.kind, link.id, link.longitude);
      },
      onHover: (link) => this.scene.hoverChartLink(link?.kind, link?.id),
      onVirtualRadius: (enabled) => {
        this.scene.setVirtualRadius(enabled);
        this.infoPanel.setVirtualRadius(enabled);
      },
      onOrientation: (alignment, align) => this.scene.setChartOrientation(alignment, align),
    }, data.stars, data.skyculture, this.settings);
    root.querySelector(".workspace")!.append(this.chartPanel.element);
    const splitter = new WorkspaceSplitter(
      root.querySelector<HTMLElement>(".workspace")!,
      this.chartPanel.element,
      () => this.scene.requestResize(),
    );
    const timeBar = new TimeBar({
      onDate: (date, playing) => {
        this.currentDate = date;
        this.scene.setDate(date);
        this.infoPanel.setDate(date);
        this.chartPanel.setContext(date, timeBar.currentTimeZone, this.location, playing);
      },
      onLocation: (place) => {
        this.location = { latitude: place.latitude, longitude: place.longitude };
        this.scene.setLocation(this.location);
        this.scene.setTimeZone(place.timeZone);
        this.infoPanel.setLocation(this.location);
        this.chartPanel.setContext(
          this.currentDate,
          place.timeZone,
          this.location,
        );
      },
      onTimeZone: (timeZone) => {
        this.scene.setTimeZone(timeZone);
        this.chartPanel.setContext(this.currentDate, timeZone, this.location);
      },
    });
    root.querySelector(".time-slot")!.replaceWith(timeBar.element);
    const bottomTime = timeBar.createPlanetariumControls();
    viewport.append(bottomTime);
    const skySearch = new SkySearch(
      data.stars,
      data.skyculture,
      this.scene.deepSkyCatalog,
      (entry) => this.scene.focusSearchEntry(entry),
    );
    viewport.append(skySearch.element);
    this.bindSkyShortcuts(timeBar, skySearch);
    this.bindSkyAutoHide(viewport, [this.layerToolbar.element, bottomTime]);
    const modeSwitch = document.createElement("nav");
    modeSwitch.className = "mode-switch";
    modeSwitch.setAttribute("aria-label", "天文模型");
    for (const [id, label] of [["xuanye", "宣夜"], ["huntian", "浑天"],
      ["gaitian", "盖天"]] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.skyMode = id;
      button.textContent = label;
      button.addEventListener("click", () => this.selectMode(id));
      modeSwitch.append(button);
    }
    timeBar.element.append(modeSwitch);
    const settingsButton = document.createElement("button");
    settingsButton.type = "button";
    settingsButton.className = "settings-button icon-button";
    settingsButton.setAttribute("aria-label", "打开设置");
    settingsButton.textContent = "⚙";
    timeBar.element.append(settingsButton);
    timeBar.element.append(root.querySelector(".about-button")!);
    const settingsPanel = new SettingsPanel(this.settings);
    root.append(settingsPanel.element);
    settingsButton.addEventListener("click", () => settingsPanel.open());
    this.settings.subscribe((settings) => {
      this.scene.applySettings(settings);
      this.infoPanel.setNaming(settings.nameStyle, settings.lastTab);
      root.querySelectorAll<HTMLInputElement>("[data-asterism-layer]").forEach((input) => {
        const key = input.dataset.asterismLayer as keyof typeof settings.asterismLayers;
        input.checked = settings.asterismLayers[key];
      });
    });
    this.bindSphereControls(root);
    this.currentDate = timeBar.currentDate;
    this.scene.setDate(this.currentDate);
    this.scene.setTimeZone(timeBar.currentTimeZone);
    this.infoPanel.setDate(this.currentDate);
    this.infoPanel.setLocation(this.location);
    this.chartPanel.setContext(
      this.currentDate,
      timeBar.currentTimeZone,
      this.location,
    );
    this.chartPanel.activateTab(this.settings.current.lastTab);

    const about = new AboutDialog();
    root.querySelector(".about-button")!.addEventListener("click", () => about.open());
    this.selectMode("xuanye");
    const selftestParams = new URLSearchParams(location.hash.slice(1));
    const selftest = selftestParams.get("selftest");
    if (selftest === "layout") {
      void this.runLayoutSelfTest(splitter);
    }
    if (selftest === "ground") {
      void this.runGroundSelfTest(selftestParams);
    }
    if (selftest === "charts") {
      this.runChartsSelfTest();
    }
    if (selftest === "drag") {
      this.runDragSelfTest(selftestParams);
    }
    if (selftest === "ui") {
      this.runUiSelfTest(splitter, settingsPanel);
    }
    if (selftest === "ping") {
      document.documentElement.dataset.selftest = JSON.stringify({
        name: "ping",
        ok: true,
      });
    }
    if (selftest === "sky") {
      void this.runSkySelfTest(selftestParams, skySearch);
    }
  }

  private async runSkySelfTest(params: URLSearchParams, search: SkySearch): Promise<void> {
    const requested = params.get("part");
    const parts = requested
      ? SKY_SELFTEST_PARTS.filter((part) => part === requested) : [...SKY_SELFTEST_PARTS];
    const originalSettings = structuredClone(this.settings.current);
    const originalDate = new Date(this.currentDate);
    const originalLocation = { ...this.location };
    const originalMode = this.skyMode;
    const exteriorInput = document.querySelector<HTMLInputElement>(".huntian-exterior")!;
    const originalExterior = exteriorInput.checked;
    const records: Array<Record<string, unknown>> = [];
    const started = performance.now();
    let progress = "initializing";
    let caught: Error | undefined;
    const checkDeadline = () => {
      if (performance.now() - started <= SELFTEST_TIMEOUT_MS) return;
      const error = new Error("timeout");
      error.name = "SkySelfTestTimeout";
      throw error;
    };
    const step = (part: SkySelfTestPart, label: string) => {
      progress = `${records.length + 1} ${part} ${label}`;
      document.documentElement.dataset.selftestProgress = progress;
      checkDeadline();
    };
    try {
      if (!parts.length) throw new Error(`Unknown sky self-test part: ${requested}`);
      await this.scene.waitForSkyDataForSelfTest(10_000);
      this.scene.setHuntianExterior(false);
      this.selectMode("huntian");
      this.chartPanel.activateForSelfTest("observation", "modern");
      this.currentDate = new Date("2026-01-15T14:00:00.000Z");
      this.location = { latitude: 39.93, longitude: 116.41 };
      this.scene.setDate(this.currentDate);
      this.scene.setLocation(this.location);
      this.settings.update({
        atmosphere: false,
        ground: false,
        landscape: "off",
        bortleClass: 1,
        hideUninvolved: false,
        milkyWay: true,
        deepSkyObjects: true,
        labelDensity: 0.55,
        constellationNames: false,
        planetLabels: true,
        cardinalPoints: false,
        horizonGrid: false,
        equatorialGrid: false,
        eclipticLine: false,
        meridianLine: false,
        planetariumProjection: "stereographic",
      });
      this.scene.setLookForSelfTest(180, 45);
      const betelgeuse = search.resolve("Betelgeuse");
      if (betelgeuse) {
        this.scene.focusSearchEntry(betelgeuse);
        for (let frame = 0; frame < 100; frame += 1) this.scene.renderOnceForSelfTest();
      }
      if (parts.includes("labels")) {
        const counts: number[] = [];
        for (const fov of [180, 90, 30, 10]) {
          step("labels", `fov-${fov}`);
          this.scene.setFovForSelfTest(fov);
          this.scene.renderOnceForSelfTest();
          counts.push(this.scene.visibleLabelsForSelfTest());
        }
        const monotone = counts.every((value, index) => index === 0 ||
          value >= counts[index - 1]!);
        records.push({ part: "labels", fovs: [180, 90, 30, 10], counts,
          ok: monotone && counts[0]! <= 25 });
      }
      if (parts.includes("stars")) {
        const counts: Array<{ bortle: number; detected: number; expected: number;
          ratio: number }> = [];
        this.scene.setFovForSelfTest(30);
        for (const bortle of [1, 5, 9]) {
          step("stars", `bortle-${bortle}`);
          this.settings.update({ bortleClass: bortle });
          this.scene.renderOnceForSelfTest();
          const value = this.scene.inspectDragForSelfTest();
          counts.push({ bortle, detected: value.brightDots,
            expected: value.expectedBrightStars,
            ratio: value.expectedBrightStars ? value.brightDots / value.expectedBrightStars : 1 });
        }
        const monotone = counts.every((value, index) => index === 0 ||
          value.detected <= counts[index - 1]!.detected);
        const ratios = counts.every((value) => value.expected < 20 || value.ratio >= 0.5);
        records.push({ part: "stars", counts, ok: monotone && ratios });
      }
      if (parts.includes("extinction")) {
        const altitudes = [60, 20, 5];
        const expected = altitudes.map((altitude) =>
          10 ** (-0.4 * extinctionMagnitude(altitude)));
        const rendered: number[] = [];
        this.settings.update({
          atmosphere: true,
          bortleClass: 1,
          milkyWay: false,
          deepSkyObjects: false,
          planetLabels: false,
        });
        this.scene.setFovForSelfTest(15);
        for (const altitude of altitudes) {
          step("extinction", `altitude-${altitude}`);
          this.scene.setExtinctionAltitudeForSelfTest(altitude);
          this.scene.renderOnceForSelfTest();
          rendered.push(this.scene.starPeakLuminanceForSelfTest());
        }
        this.scene.setExtinctionAltitudeForSelfTest(undefined);
        records.push({ part: "extinction", star: "Betelgeuse", altitudes,
          expected, rendered,
          ok: rendered[0]! > rendered[1]! && rendered[1]! > rendered[2]! });
      }
      if (parts.includes("inertia")) {
        step("inertia", "flick");
        const origin = this.scene.dragOriginForSelfTest();
        this.scene.dispatchPointerForSelfTest("pointerdown", origin.x, origin.y, 1);
        this.scene.dispatchPointerForSelfTest("pointermove", origin.x + 180, origin.y, 1);
        this.scene.dispatchPointerForSelfTest("pointerup", origin.x + 180, origin.y, 0);
        const initial = this.scene.motionForSelfTest().angularVelocity;
        const velocities: number[] = [];
        for (let frame = 0; frame < 60; frame += 1) {
          this.scene.updateControlsForSelfTest();
          velocities.push(this.scene.motionForSelfTest().angularVelocity);
        }
        records.push({ part: "inertia", initial, final: velocities.at(-1),
          finite: this.scene.inspectDragForSelfTest().finite,
          ok: initial > 0 && velocities.at(-1)! < initial * 0.01 &&
            this.scene.inspectDragForSelfTest().finite });
      }
      if (parts.includes("zoom")) {
        step("zoom", "wheel");
        this.scene.setFovForSelfTest(100);
        const origin = this.scene.dragOriginForSelfTest();
        this.scene.dispatchWheelForSelfTest(origin.x, origin.y, -900);
        const sequence: number[] = [];
        for (let frame = 0; frame < 80; frame += 1) {
          this.scene.updateControlsForSelfTest();
          sequence.push(this.scene.motionForSelfTest().fov);
        }
        const monotone = sequence.every((value, index) => index === 0 ||
          value <= sequence[index - 1]! + 1e-9);
        records.push({ part: "zoom", start: 100, end: sequence.at(-1), monotone,
          ok: monotone && sequence.at(-1)! < 45 });
      }
      if (parts.includes("search")) {
        const queries = ["参宿四", "Betelgeuse", "HIP 27989", "猎户座 α",
          "火星", "M42", "参宿"];
        const results: Array<{ query: string; error: number; found: boolean }> = [];
        for (const query of queries) {
          step("search", query);
          const entry = search.resolve(query);
          if (entry) {
            this.scene.focusSearchEntry(entry);
            for (let frame = 0; frame < 100; frame += 1) {
              this.scene.renderOnceForSelfTest();
            }
          }
          results.push({ query, found: Boolean(entry),
            error: entry ? this.scene.selectionCenterErrorForSelfTest() : Infinity });
        }
        records.push({ part: "search", results,
          ok: results.every((result) => result.found && result.error <= 1) });
      }
      if (parts.includes("deep-sky")) {
        step("deep-sky", "milky-way-night");
        this.currentDate = new Date("2026-01-15T14:00:00.000Z");
        this.scene.setDate(this.currentDate);
        const m42 = search.resolve("M42");
        if (m42) this.scene.focusSearchEntry(m42);
        this.scene.setFovForSelfTest(60);
        for (let frame = 0; frame < 100; frame += 1) this.scene.renderOnceForSelfTest();
        this.settings.update({
          bortleClass: 1,
          atmosphere: true,
          milkyWay: false,
          deepSkyObjects: true,
        });
        this.scene.renderOnceForSelfTest();
        const luminanceWithout = this.scene.frameLuminanceForSelfTest();
        this.settings.update({ milkyWay: true });
        this.scene.renderOnceForSelfTest();
        const night = this.scene.skyDataForSelfTest();
        const luminanceWith = this.scene.frameLuminanceForSelfTest();
        step("deep-sky", "milky-way-day");
        this.currentDate = new Date("2026-06-21T04:00:00.000Z");
        this.scene.setDate(this.currentDate);
        this.settings.update({ bortleClass: 9 });
        this.scene.renderOnceForSelfTest();
        const day = this.scene.skyDataForSelfTest();
        if (m42) this.scene.focusSearchEntry(m42);
        this.scene.setFovForSelfTest(10);
        this.settings.update({ bortleClass: 1, atmosphere: false });
        this.scene.renderOnceForSelfTest();
        const zoomed = this.scene.skyDataForSelfTest();
        records.push({ part: "deep-sky", night, day, zoomed,
          luminanceWithout, luminanceWith,
          ok: night.milkyWayBrightness > 0 && luminanceWith > luminanceWithout &&
            day.milkyWayBrightness === 0 &&
            zoomed.m42Visible });
      }
    } catch (error) {
      caught = error instanceof Error ? error : new Error(String(error));
    } finally {
      this.scene.setExtinctionAltitudeForSelfTest(undefined);
      this.settings.update(originalSettings);
      this.currentDate = originalDate;
      this.scene.setDate(originalDate);
      this.location = originalLocation;
      this.scene.setLocation(originalLocation);
      exteriorInput.checked = originalExterior;
      this.scene.setHuntianExterior(originalExterior);
      this.selectMode(originalMode);
    }
    document.documentElement.dataset.selftest = JSON.stringify({
      name: "sky",
      ok: !caught && records.length === parts.length &&
        records.every((record) => record.ok === true),
      reason: caught?.name === "SkySelfTestTimeout" ? "timeout" : caught ? "error" : undefined,
      error: caught?.message,
      stack: caught?.stack,
      progress,
      records,
    });
  }

  private bindSkyShortcuts(timeBar: TimeBar, search: SkySearch): void {
    window.addEventListener("keydown", (event) => {
      const target = event.target as HTMLElement;
      const typing = target.matches("input, textarea, select, [contenteditable=true]");
      if (event.code === "Slash" && !typing) {
        event.preventDefault();
        search.focus();
        return;
      }
      if (typing) return;
      if (event.code === "Space") {
        event.preventDefault();
        this.scene.centerSelection();
      } else if (event.code === "KeyT") {
        this.scene.toggleTracking();
      } else if (timeBar.handleShortcut(event.code)) {
        event.preventDefault();
      }
    });
  }

  private bindSkyAutoHide(viewport: HTMLElement, elements: HTMLElement[]): void {
    const selftest = new URLSearchParams(location.hash.slice(1)).has("selftest");
    let timeout = 0;
    const reveal = () => {
      elements.forEach((element) => element.classList.add("is-revealed"));
      window.clearTimeout(timeout);
      if (!selftest) {
        timeout = window.setTimeout(() => {
          elements.forEach((element) => element.classList.remove("is-revealed"));
        }, 3_000);
      }
    };
    viewport.addEventListener("pointermove", (event) => {
      const rect = viewport.getBoundingClientRect();
      if (event.clientY > rect.bottom - 120) reveal();
    });
    elements.forEach((element) => element.addEventListener("pointerenter", reveal));
    reveal();
  }

  private async runLayoutSelfTest(splitter: WorkspaceSplitter): Promise<void> {
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const waitLayout = async () => { await frame(); await frame(); };
    const steps: LayoutStep[] = [];
    const record = async (label: string) => {
      this.scene.requestResize();
      await waitLayout();
      const value = this.scene.inspectLayout();
      steps.push({ label, ...value, ok: layoutMeasurementPasses(value) });
    };
    const collapse = document.querySelector<HTMLButtonElement>(".collapse-chart")!;
    splitter.setRatioForSelfTest(0.3);
    await record("splitter-30");
    splitter.setRatioForSelfTest(0.7);
    await record("splitter-70");
    collapse.click();
    await record("chart-collapsed");
    collapse.click();
    await record("chart-expanded");
    document.documentElement.dataset.selftest = JSON.stringify({
      name: "layout",
      ok: steps.every((step) => step.ok),
      steps,
    });
  }

  private async runGroundSelfTest(params: URLSearchParams): Promise<void> {
    const originalDate = new Date(this.currentDate);
    const originalLocation = { ...this.location };
    const originalSettings = structuredClone(this.settings.current);
    const steps: Array<{
      phase: GroundPhase;
      projection: GroundProjection;
      azimuth: number;
      expected?: readonly [number, number, number];
      samples: ReturnType<CelestialScene["inspectHorizonSamples"]>;
      ok: boolean;
    }> = [];
    const failures: Array<Record<string, unknown>> = [];
    let instantAltitudes = { day: 0, night: 0 };
    let lastProgress = "initializing";
    let expectedSteps = 0;
    let caught: Error | undefined;
    const started = performance.now();
    const checkDeadline = () => {
      if (performance.now() - started < GROUND_SELFTEST_TIMEOUT_MS) return;
      const error = new Error("timeout");
      error.name = "GroundSelfTestTimeout";
      throw error;
    };
    try {
      const requestedPhase = params.get("phase");
      const requestedProjection = params.get("projection");
      if (requestedPhase && !GROUND_PHASES.includes(requestedPhase as GroundPhase)) {
        throw new Error(`Unknown ground self-test phase: ${requestedPhase}`);
      }
      if (requestedProjection &&
        !GROUND_PROJECTIONS.includes(requestedProjection as GroundProjection)) {
        throw new Error(`Unknown ground self-test projection: ${requestedProjection}`);
      }
      const phases = requestedPhase
        ? [requestedPhase as GroundPhase] : [...GROUND_PHASES];
      const projections = requestedProjection
        ? [requestedProjection as GroundProjection] : [...GROUND_PROJECTIONS];
      expectedSteps = phases.length * projections.length * 12;
      this.selectMode("huntian");
      const instants = this.scene.findGroundSelfTestInstants();
      this.scene.setLocation(instants.location);
      instantAltitudes = {
        day: instants.day.sunAltitude,
        night: instants.night.sunAltitude,
      };
      if (phases.includes("landscape-day")) {
        lastProgress = `0/${expectedSteps} landscape-loading stereographic 0 ` +
          instants.day.date.toISOString();
        document.documentElement.dataset.selftestProgress = lastProgress;
        const remaining = GROUND_SELFTEST_TIMEOUT_MS - (performance.now() - started);
        await this.scene.waitForLandscapeForSelfTest(remaining);
        checkDeadline();
      }
      let index = 0;
      for (const phase of phases) {
        const instant = phase === "flat-night" ? instants.night : instants.day;
        this.scene.setDate(instant.date);
        const flat = phase !== "landscape-day";
        this.settings.update({
          ground: flat,
          atmosphere: false,
          landscape: flat ? "flat" : "photo",
        });
        const expected = flat
          ? groundColorForSunAltitude(instant.sunAltitude) : undefined;
        for (const projection of projections) {
          this.settings.update({ planetariumProjection: projection });
          for (let azimuth = 0; azimuth < 360; azimuth += 30) {
            index += 1;
            checkDeadline();
            lastProgress = `${index}/${expectedSteps} ${phase} ${projection} ` +
              `${azimuth} ${instant.date.toISOString()}`;
            document.documentElement.dataset.selftestProgress = lastProgress;
            this.scene.prepareGroundSelfTest(azimuth);
            this.scene.renderOnceForSelfTest();
            const samples = this.scene.inspectHorizonSamples(azimuth, projection);
            if (flat && expected) {
              const shadesMatch = samples.below.every((sample) =>
                colorsWithinTolerance(sample.rgba, expected));
              const contrast = samples.below.every((below) =>
                samples.above.every((above) =>
                  above.rgba[3] === 0 ||
                  colorsHaveClearContrast(below.rgba, above.rgba)));
              const ok = shadesMatch && contrast;
              steps.push({ phase, projection, azimuth, expected, samples, ok });
              if (!ok && failures.length < 10) {
                failures.push({
                  phase,
                  projection,
                  azimuth,
                  expected,
                  actualBelow: samples.below.map((sample) => sample.rgba),
                  actualAbove: samples.above.map((sample) => sample.rgba),
                  shadesMatch,
                  contrast,
                });
              }
            } else {
              const ok = samples.below.every((sample) => sample.rgba[3]! > 240 &&
                sample.rgba[0]! + sample.rgba[1]! + sample.rgba[2]! > 30);
              steps.push({ phase, projection, azimuth, samples, ok });
              if (!ok && failures.length < 10) {
                failures.push({
                  phase,
                  projection,
                  azimuth,
                  actualBelow: samples.below.map((sample) => sample.rgba),
                  reason: "landscape sample is transparent or black",
                });
              }
            }
            checkDeadline();
          }
        }
      }
    } catch (error) {
      caught = error instanceof Error ? error : new Error(String(error));
    } finally {
      try {
        this.scene.setDate(originalDate);
        this.scene.setLocation(originalLocation);
        this.settings.update(originalSettings);
        this.selectMode("xuanye");
      } catch (error) {
        if (!caught) caught = error instanceof Error ? error : new Error(String(error));
      }
    }
    if (caught) {
      const timeout = caught.name === "GroundSelfTestTimeout" ||
        caught.message.toLowerCase().includes("timeout");
      document.documentElement.dataset.selftest = JSON.stringify({
        name: "ground",
        ok: false,
        reason: timeout ? "timeout" : "error",
        error: caught.message,
        stack: caught.stack ?? "",
        lastProgress,
        instantAltitudes,
        steps,
        failures,
      });
      return;
    }
    document.documentElement.dataset.selftest = JSON.stringify({
      name: "ground",
      ok: failures.length === 0 && steps.length === expectedSteps &&
        steps.every((step) => step.ok),
      lastProgress,
      instantAltitudes,
      steps,
      failures,
    });
  }

  private runChartsSelfTest(): void {
    const originalSettings = structuredClone(this.settings.current);
    const started = performance.now();
    let lastProgress = "initializing";
    let caught: Error | undefined;
    const records: Array<ReturnType<CelestialScene["inspectChartsForSelfTest"]> & {
      label: string;
      tab: ChartTabId;
      mode: "modern" | "classical";
      averageRenderMs: number;
      chartRenderMs: number;
      sectionCount: number;
      requiredSections: boolean;
      sectionOffenders: Array<Record<string, unknown>>;
      ok: boolean;
    }> = [];
    const checkDeadline = () => {
      if (performance.now() - started < 60_000) return;
      const error = new Error("timeout");
      error.name = "ChartSelfTestTimeout";
      throw error;
    };
    try {
      this.scene.renderOnceForSelfTest();
      for (let index = 0; index < CHART_SELFTEST_CASES.length; index += 1) {
        const test = CHART_SELFTEST_CASES[index]!;
        lastProgress = `${index + 1}/${CHART_SELFTEST_CASES.length} ${test.label} setup`;
        document.documentElement.dataset.selftestProgress = lastProgress;
        const chartRenderStarted = performance.now();
        this.chartPanel.activateForSelfTest(test.tab, test.mode);
        const chartRenderMs = performance.now() - chartRenderStarted;
        this.scene.setPresetImmediatelyForSelfTest(test.preset);
        this.scene.renderOnceForSelfTest();
        const renderStarted = performance.now();
        for (let frame = 0; frame < 30; frame += 1) {
          checkDeadline();
          lastProgress = `${index + 1}/${CHART_SELFTEST_CASES.length} ` +
            `${test.label} render ${frame + 1}/30`;
          document.documentElement.dataset.selftestProgress = lastProgress;
          this.scene.renderOnceForSelfTest();
        }
        const averageRenderMs = (performance.now() - renderStarted) / 30;
        const inspection = this.scene.inspectChartsForSelfTest();
        const sections = this.inspectChartSectionsForSelfTest(test.tab);
        records.push({
          label: test.label,
          tab: test.tab,
          mode: test.mode,
          averageRenderMs,
          chartRenderMs,
          ...sections,
          ...inspection,
          ok: false,
        });
        checkDeadline();
      }
      const baseline = records[0]?.averageRenderMs ?? Number.POSITIVE_INFINITY;
      for (const record of records) {
        record.ok = record.edgeLabels === 0 && record.nearWhiteFraction < 0.02 &&
          record.visibleLabels <= record.cap && record.averageRenderMs <= baseline * 2 &&
          record.chartRenderMs <= 100 && record.requiredSections &&
          record.sectionOffenders.length === 0;
      }
    } catch (error) {
      caught = error instanceof Error ? error : new Error(String(error));
    } finally {
      try {
        this.settings.update(originalSettings);
        this.chartPanel.activateForSelfTest(originalSettings.lastTab, "modern");
        const preset = CHART_SELFTEST_CASES.find((test) =>
          test.tab === originalSettings.lastTab)?.preset ?? "earth-view";
        this.scene.setPresetImmediatelyForSelfTest(preset);
        this.selectMode("xuanye");
      } catch (error) {
        if (!caught) caught = error instanceof Error ? error : new Error(String(error));
      }
    }
    if (caught) {
      document.documentElement.dataset.selftest = JSON.stringify({
        name: "charts",
        ok: false,
        reason: caught.name === "ChartSelfTestTimeout" ? "timeout" : "error",
        error: caught.message,
        stack: caught.stack ?? "",
        lastProgress,
        records,
      });
      return;
    }
    document.documentElement.dataset.selftest = JSON.stringify({
      name: "charts",
      ok: records.length === CHART_SELFTEST_CASES.length &&
        records.every((record) => record.ok),
      lastProgress,
      records,
    });
  }

  private inspectChartSectionsForSelfTest(tab: ChartTabId): {
    sectionCount: number;
    requiredSections: boolean;
    sectionOffenders: Array<Record<string, unknown>>;
  } {
    const content = document.querySelector<HTMLElement>(".chart-content")!;
    const section = content.querySelector<HTMLElement>(".chart-section");
    const details = section
      ? [...section.querySelectorAll<HTMLElement>(":scope > .chart-table-section")]
      : [];
    const offenders: Array<Record<string, unknown>> = [];
    this.findUiOverlaps(details, offenders, "chart-section-overlap");
    const contentRect = content.getBoundingClientRect();
    for (const item of details) {
      const rect = item.getBoundingClientRect();
      if (rect.left < contentRect.left - 1 || rect.right > contentRect.right + 1) {
        offenders.push(this.uiOffender("chart-section-outside", item));
      }
      const summary = item.querySelector<HTMLElement>("summary");
      if (summary && summary.scrollWidth > summary.clientWidth + 1) {
        offenders.push(this.uiOffender("chart-summary-overflow", summary));
      }
    }
    const summaries = details.map((item) => item.querySelector("summary")?.textContent ?? "");
    const requiredSections = tab === "astrology"
      ? Boolean(section?.querySelector(".aspect-grid")) && summaries.includes("相位")
      : tab === "zhengyu"
        ? summaries.includes("神煞查法") && summaries.includes("格局规则")
        : tab === "bazi"
          ? Boolean(section?.querySelector(".bazi-relation-diagram")) &&
            summaries.includes("神煞查法")
          : true;
    return {
      sectionCount: details.length,
      requiredSections,
      sectionOffenders: offenders.slice(0, 10),
    };
  }

  private runDragSelfTest(params: URLSearchParams): void {
    const originalSettings = structuredClone(this.settings.current);
    const originalDate = new Date(this.currentDate);
    const originalLocation = { ...this.location };
    const requestedMode = params.get("mode");
    let lastProgress = "initializing";
    let caught: Error | undefined;
    const records: Array<Record<string, unknown>> = [];
    const started = performance.now();
    const checkDeadline = () => {
      if (performance.now() - started < SELFTEST_TIMEOUT_MS) return;
      const error = new Error("timeout");
      error.name = "DragSelfTestTimeout";
      throw error;
    };
    try {
      const knownModes = new Set(DRAG_SELFTEST_CASES.map((item) => item.mode));
      if (requestedMode && !knownModes.has(requestedMode as DragSelfTestMode)) {
        throw new Error(`Unknown drag self-test mode: ${requestedMode}`);
      }
      const cases = requestedMode
        ? DRAG_SELFTEST_CASES.filter((item) => item.mode === requestedMode)
        : DRAG_SELFTEST_CASES;
      this.scene.setLocation({ latitude: 39.9316, longitude: 116.41 });
      this.scene.setDate(new Date("2026-01-15T16:00:00Z"));
      for (let index = 0; index < cases.length; index += 1) {
        const test = cases[index]!;
        lastProgress = `${index + 1}/${cases.length} ${test.label} setup`;
        document.documentElement.dataset.selftestProgress = lastProgress;
        this.scene.setHuntianExterior(test.mode === "huntian-outer");
        this.selectMode(test.mode.startsWith("huntian") ? "huntian" :
          test.mode === "gaitian" ? "gaitian" : "xuanye");
        this.chartPanel.activateForSelfTest(test.tab, "modern");
        if (test.mode === "xuanye-roam") {
          this.scene.setPresetImmediatelyForSelfTest("xuanye");
        } else {
          this.scene.finishCameraTransitionForSelfTest();
        }
        for (let warmup = 0; warmup < 3; warmup += 1) this.scene.renderOnceForSelfTest();
        let baselineMs = 0;
        for (let frame = 0; frame < 5; frame += 1) {
          const baselineStarted = performance.now();
          this.scene.renderOnceForSelfTest();
          baselineMs = Math.max(baselineMs, performance.now() - baselineStarted);
        }
        const baseline = this.scene.inspectDragForSelfTest();
        const before = this.scene.orbitForSelfTest();
        let horizontal = before;
        let maximumNearWhite = baseline.nearWhiteFraction;
        let largestBlob = baseline.largestNearWhiteBlob;
        let allFinite = baseline.finite;
        let maximumRenderMs = 0;
        const renderTimes: number[] = [];
        let minimumRatio = 1;
        let minimumRatioStep = "none";
        let ratiosOk = true;
        const steps: Array<Record<string, unknown>> = [];
        const rounded = (value: number, digits = 3) =>
          Number(value.toFixed(digits));
        const compactUniforms = (uniforms: Record<string, number | number[]>) => {
          const names = [
            "pointSize", "pixelRatio", "visibilityLimit", "brightnessScale",
            "atmosphereScale", "profileFilter", "distanceMinimum",
            "distanceMaximum", "distanceRangeFull", "morph", "planetariumMode",
            "planetariumProjection", "planetariumFov", "planetariumAspect",
            "yearOffset", "origin", "projectionCenter", "projectionRadius",
            "distanceCenter",
          ];
          return Object.fromEntries(names.map((name) => {
            const value = uniforms[name]!;
            return [name, Array.isArray(value)
              ? value.map((item) => rounded(item, 5)) : rounded(value, 5)];
          }));
        };
        const recordStep = (
          name: string,
          sample: ReturnType<CelestialScene["inspectDragForSelfTest"]>,
        ) => {
          const ratio = sample.expectedBrightStars >= 20
            ? sample.brightDots / sample.expectedBrightStars : undefined;
          if (ratio !== undefined && ratio < minimumRatio) {
            minimumRatio = ratio;
            minimumRatioStep = name;
          }
          if (ratio !== undefined && ratio < 0.5) ratiosOk = false;
          steps.push({
            step: name,
            detectedDots: sample.brightDots,
            expectedBrightStars: sample.expectedBrightStars,
            ratio: ratio === undefined ? null : rounded(ratio),
            cameraDistance: Number(sample.camera.distance.toPrecision(6)),
            fov: rounded(sample.camera.fov),
            target: sample.camera.target.map((value) => Number(value.toPrecision(6))),
            uniforms: compactUniforms(sample.starUniforms),
          });
        };
        recordStep("baseline", baseline);
        const renderEvent = (progress: string) => {
          checkDeadline();
          lastProgress = `${index + 1}/${cases.length} ${test.label} ${progress}`;
          document.documentElement.dataset.selftestProgress = lastProgress;
          this.scene.updateControlsForSelfTest();
          const renderStarted = performance.now();
          this.scene.renderOnceForSelfTest();
          const renderMs = performance.now() - renderStarted;
          renderTimes.push(renderMs);
          maximumRenderMs = Math.max(maximumRenderMs, renderMs);
          const sample = this.scene.inspectDragForSelfTest();
          recordStep(progress, sample);
          maximumNearWhite = Math.max(maximumNearWhite, sample.nearWhiteFraction);
          largestBlob = Math.max(largestBlob, sample.largestNearWhiteBlob);
          allFinite &&= sample.finite;
          checkDeadline();
        };
        const origin = this.scene.dragOriginForSelfTest();
        let x = origin.x;
        let y = origin.y;
        this.scene.dispatchPointerForSelfTest("pointerdown", x, y, 1);
        renderEvent("pointerdown");
        for (let move = 0; move < 8; move += 1) {
          x += 40;
          this.scene.dispatchPointerForSelfTest("pointermove", x, y, 1);
          renderEvent(`horizontal ${move + 1}/8`);
        }
        horizontal = this.scene.orbitForSelfTest();
        const verticalDirection = test.mode === "huntian-inner" ||
          horizontal.polar <= Math.PI / 2 ? -1 : 1;
        for (let move = 0; move < 4; move += 1) {
          y += verticalDirection * 40;
          this.scene.dispatchPointerForSelfTest("pointermove", x, y, 1);
          renderEvent(`vertical ${move + 1}/4`);
        }
        this.scene.dispatchPointerForSelfTest("pointerup", x, y, 0);
        renderEvent("pointerup");
        for (let wheel = 0; wheel < 3; wheel += 1) {
          this.scene.dispatchWheelForSelfTest(x, y, wheel === 1 ? -80 : 80);
          renderEvent(`wheel ${wheel + 1}/3`);
        }
        const after = this.scene.orbitForSelfTest();
        const inner = test.mode === "huntian-inner";
        const azimuthChange = Math.abs(Math.atan2(
          Math.sin(horizontal.azimuth - before.azimuth),
          Math.cos(horizontal.azimuth - before.azimuth),
        )) * 180 / Math.PI;
        const polarChange = Math.abs(after.polar - horizontal.polar);
        const upOk = after.up.every((value, axis) =>
          Math.abs(value - (axis === 1 ? 1 : 0)) < 1e-9);
        const orbitOk = inner || (azimuthChange > 10 && polarChange > 1e-3 && upOk);
        const sortedRenderTimes = [...renderTimes].sort((first, second) => first - second);
        const percentileIndex = Math.max(
          0,
          Math.ceil(sortedRenderTimes.length * 0.9) - 1,
        );
        const p90RenderMs = sortedRenderTimes[percentileIndex] ?? 0;
        const renderTimeOk = p90RenderMs <= Math.max(
          baselineMs * 3,
          baselineMs + 20,
        );
        const ok = maximumNearWhite < 0.02 && largestBlob < 40 &&
          ratiosOk && allFinite && renderTimeOk && orbitOk;
        records.push({
          label: test.label,
          mode: test.mode,
          tab: test.tab,
          maximumNearWhite,
          largestNearWhiteBlob: largestBlob,
          minimumRatio: rounded(minimumRatio),
          minimumRatioStep,
          ratiosOk,
          allFinite,
          baselineMs,
          p90RenderMs,
          maximumRenderMs,
          renderTimeOk,
          azimuthChange,
          polarChange,
          cameraUp: after.up,
          orbitOk,
          steps: steps.slice(0, 20),
          ok,
        });
      }
    } catch (error) {
      caught = error instanceof Error ? error : new Error(String(error));
    } finally {
      try {
        this.scene.setDate(originalDate);
        this.scene.setLocation(originalLocation);
        this.settings.update(originalSettings);
        this.scene.setHuntianExterior(false);
        this.selectMode("xuanye");
        this.chartPanel.activateForSelfTest(originalSettings.lastTab, "modern");
        this.scene.finishCameraTransitionForSelfTest();
      } catch (error) {
        if (!caught) caught = error instanceof Error ? error : new Error(String(error));
      }
    }
    document.documentElement.dataset.selftest = JSON.stringify({
      name: "drag",
      ok: !caught && records.length > 0 && records.every((record) => record.ok === true),
      reason: caught?.name === "DragSelfTestTimeout" ? "timeout" : caught ? "error" : undefined,
      error: caught?.message,
      stack: caught?.stack,
      lastProgress,
      records,
    });
  }

  private runUiSelfTest(splitter: WorkspaceSplitter, panel: SettingsPanel): void {
    const params = new URLSearchParams(location.hash.slice(1));
    const requestedMode = params.get("mode");
    const modes = ["xuanye", "huntian-inner", "huntian-outer", "gaitian"] as const;
    const tabs = ["observation", "astrology", "zhengyu", "bazi", "gaitian"] as const;
    const widths = [300, 420, 600];
    const drawerStates = [false, true];
    const originalChartWidth = splitter.chartWidthForSelfTest();
    const originalSettings = structuredClone(this.settings.current);
    const originalMode = this.skyMode;
    const originalDrawer = document.querySelector(".range-dock")!.classList
      .contains("is-open");
    const records: Array<Record<string, unknown>> = [];
    let caught: Error | undefined;
    let lastProgress = "initializing";
    const started = performance.now();
    const checkDeadline = () => {
      if (performance.now() - started < SELFTEST_TIMEOUT_MS) return;
      const error = new Error("timeout");
      error.name = "UiSelfTestTimeout";
      throw error;
    };
    try {
      if (requestedMode && !modes.includes(requestedMode as typeof modes[number])) {
        throw new Error(`Unknown UI self-test mode: ${requestedMode}`);
      }
      panel.close();
      this.scene.renderOnceForSelfTest();
      this.scene.activateChartLink("body", "Sun");
      this.scene.finishCameraTransitionForSelfTest();
      const selectedModes = requestedMode
        ? modes.filter((mode) => mode === requestedMode) : modes;
      const total = selectedModes.length * tabs.length * widths.length * drawerStates.length;
      let index = 0;
      for (const mode of selectedModes) {
        const huntian = mode.startsWith("huntian");
        const exterior = mode === "huntian-outer";
        const skyMode = huntian ? "huntian" : mode;
        this.scene.setHuntianExterior(exterior);
        const exteriorInput = document.querySelector<HTMLInputElement>(".huntian-exterior")!;
        exteriorInput.checked = exterior;
        this.selectMode(skyMode as SkyMode);
        for (const tab of tabs) {
          this.chartPanel.activateForSelfTest(tab, "modern");
          const preset = tab === "astrology" || tab === "zhengyu"
            ? "geocentric" : tab === "bazi" ? "heliocentric" : "earth-view";
          this.scene.setPresetImmediatelyForSelfTest(preset);
          for (const width of widths) {
            splitter.setChartWidthForSelfTest(width);
            for (const drawerOpen of drawerStates) {
              index += 1;
              lastProgress = `${index}/${total} ${mode} ${tab} ${width} ` +
                `${drawerOpen ? "drawer-open" : "drawer-closed"}`;
              document.documentElement.dataset.selftestProgress = lastProgress;
              const range = document.querySelector<HTMLElement>(".range-dock")!;
              range.classList.toggle("is-open", drawerOpen);
              range.querySelector("button")!.setAttribute(
                "aria-expanded",
                String(drawerOpen),
              );
              this.scene.requestResize();
              this.scene.renderOnceForSelfTest();
              records.push(this.inspectUiCase(mode, tab, width, drawerOpen));
              checkDeadline();
            }
          }
        }
      }
    } catch (error) {
      caught = error instanceof Error ? error : new Error(String(error));
    } finally {
      splitter.setChartWidthForSelfTest(originalChartWidth);
      const range = document.querySelector<HTMLElement>(".range-dock")!;
      range.classList.toggle("is-open", originalDrawer);
      range.querySelector("button")!.setAttribute("aria-expanded", String(originalDrawer));
      this.settings.update(originalSettings);
      this.chartPanel.activateForSelfTest(originalSettings.lastTab, "modern");
      this.scene.setHuntianExterior(false);
      this.selectMode(originalMode);
      panel.close();
    }
    document.documentElement.dataset.selftest = JSON.stringify({
      name: "ui",
      ok: !caught && records.length > 0 && records.every((record) => record.ok === true),
      reason: caught?.name === "UiSelfTestTimeout" ? "timeout" : caught ? "error" : undefined,
      error: caught?.message,
      stack: caught?.stack,
      lastProgress,
      records,
    });
  }

  private inspectUiCase(
    mode: string,
    tab: ChartTabId,
    width: number,
    drawerOpen: boolean,
  ): Record<string, unknown> {
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" &&
        Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const viewport = document.querySelector<HTMLElement>(".sky-viewport")!;
    const chart = document.querySelector<HTMLElement>(".chart-panel")!;
    const panels = [...viewport.querySelectorAll<HTMLElement>("[data-dock-panel]")]
      .filter(visible);
    const controls = [...chart.querySelectorAll<HTMLElement>(
      "[data-chart-toolbar] > label, [data-chart-toolbar] > button, " +
      "[data-chart-toolbar] > .chart-text-toggle, " +
      "[data-chart-toolbar] > .toolbar-group > label, " +
      "[data-chart-toolbar] > .toolbar-group > button",
    )].filter(visible);
    const offenders: Array<Record<string, unknown>> = [];
    this.findUiOverlaps(panels, offenders, "panel-overlap");
    this.findUiOverlaps(controls, offenders, "control-overlap");
    const viewportRect = viewport.getBoundingClientRect();
    const chartRect = chart.getBoundingClientRect();
    for (const element of [...panels, ...controls]) {
      const rect = element.getBoundingClientRect();
      const bounds = panels.includes(element) ? viewportRect : chartRect;
      if (rect.left < bounds.left - 1 || rect.top < bounds.top - 1 ||
        rect.right > bounds.right + 1 || rect.bottom > bounds.bottom + 1) {
        offenders.push(this.uiOffender("outside", element));
      }
    }
    const textElements = [...document.querySelectorAll<HTMLElement>(
      "[data-dock-panel] button, [data-dock-panel] output, " +
      "[data-dock-panel] dt, [data-dock-panel] dd, " +
      "[data-chart-toolbar] label, [data-chart-toolbar] button",
    )].filter(visible);
    for (const element of textElements) {
      if (element.scrollWidth > element.clientWidth + 1) {
        offenders.push(this.uiOffender("text-overflow", element));
      }
    }
    const chartSections = this.inspectChartSectionsForSelfTest(tab);
    return {
      mode,
      tab,
      width,
      drawerOpen,
      panels: panels.map((element) => this.uiOffender("panel", element)),
      controlCount: controls.length,
      offenders: offenders.slice(0, 20),
      ...chartSections,
      ok: offenders.length === 0 && chartSections.requiredSections &&
        chartSections.sectionOffenders.length === 0,
    };
  }

  private findUiOverlaps(
    elements: HTMLElement[],
    offenders: Array<Record<string, unknown>>,
    kind: string,
  ): void {
    for (let first = 0; first < elements.length; first += 1) {
      for (let second = first + 1; second < elements.length; second += 1) {
        const a = elements[first]!;
        const b = elements[second]!;
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        const overlapX = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
        const overlapY = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
        if (overlapX <= 0.5 || overlapY <= 0.5) continue;
        offenders.push({
          kind,
          first: this.uiOffender("element", a),
          second: this.uiOffender("element", b),
        });
      }
    }
  }

  private uiOffender(kind: string, element: HTMLElement): Record<string, unknown> {
    const rect = element.getBoundingClientRect();
    return {
      kind,
      text: element.textContent?.trim() || element.getAttribute("aria-label") ||
        element.getAttribute("type"),
      class: element.className,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  }

  private selectMode(mode: SkyMode): void {
    this.skyMode = mode;
    document.querySelectorAll<HTMLElement>("[data-sky-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.skyMode === mode);
    });
    this.scene.setMode(mode);
    this.infoPanel.setPlanetarium(mode === "huntian" &&
      !document.querySelector<HTMLInputElement>(".huntian-exterior")?.checked);
    document.querySelector(".sphere-controls")?.classList.toggle(
      "is-visible",
      mode === "huntian",
    );
    document.querySelector(".sky-viewport")?.setAttribute("data-sky-mode", mode);
    this.syncLayerToolbar();
    if (mode === "gaitian") this.chartPanel.activateTab("gaitian");
  }

  private syncLayerToolbar(): void {
    const exterior = document.querySelector<HTMLInputElement>(".huntian-exterior")
      ?.checked ?? false;
    this.layerToolbar.setContext(
      this.activeTab,
      this.westernMode,
      this.skyMode === "huntian" && !exterior,
    );
  }

  private bindSphereControls(root: HTMLElement): void {
    root.querySelector<HTMLSelectElement>(".sphere-viewpoint")!.addEventListener(
      "change",
      (event) => this.scene.setSphereViewpoint(
        (event.currentTarget as HTMLSelectElement).value as SphereViewpoint,
      ),
    );
    root.querySelector<HTMLInputElement>(".sphere-lock")!.addEventListener(
      "change",
      (event) => this.scene.setSphereLocked((event.currentTarget as HTMLInputElement).checked),
    );
    root.querySelector<HTMLInputElement>(".huntian-exterior")!.addEventListener(
      "change",
      (event) => {
        const exterior = (event.currentTarget as HTMLInputElement).checked;
        this.scene.setHuntianExterior(exterior);
        this.infoPanel.setPlanetarium(!exterior);
        this.syncLayerToolbar();
      },
    );
    root.querySelector<HTMLInputElement>(".depth-lines")!.addEventListener(
      "change",
      (event) => this.scene.setDepthVisible((event.currentTarget as HTMLInputElement).checked),
    );
    root.querySelectorAll<HTMLInputElement>("[data-asterism-layer]").forEach((input) => {
      input.addEventListener("change", () => this.scene.setAsterismLayer(
        input.dataset.asterismLayer as "mansions" | "enclosures" | "other",
        input.checked,
      ));
      input.addEventListener("change", () => {
        const key = input.dataset.asterismLayer as
          keyof typeof this.settings.current.asterismLayers;
        this.settings.update({
          asterismLayers: {
            ...this.settings.current.asterismLayers,
            [key]: input.checked,
          },
        });
      });
    });
    root.querySelector(".dissolve-button")!.addEventListener("click", () => {
      this.scene.runDissolution();
      this.selectMode("huntian");
    });
    root.querySelector(".dissolve-pause")!.addEventListener("click", (event) => {
      const paused = this.scene.toggleDissolutionPause();
      (event.currentTarget as HTMLButtonElement).textContent = paused ? "继续" : "暂停";
    });
  }

  private selectPreset(preset: ViewPreset): void {
    document.querySelectorAll<HTMLElement>("[data-preset]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.preset === preset);
    });
    this.scene.flyToPreset(preset);
  }

  private showMansionTooltip(
    mansion: MansionDefinition | undefined,
    longitude: number | undefined,
    point: { x: number; y: number },
  ): void {
    if (!mansion) {
      this.tooltip.classList.remove("is-visible");
      return;
    }
    this.tooltip.innerHTML = `
      <strong>${mansion.name}宿</strong>
      <span>${mansion.planet}${mansion.animal} · 距星 HIP ${mansion.referenceHip}</span>
      <span>当日实际黄经
        ${longitude === undefined ? "无数据" : `${longitude.toFixed(4)}°`}
      </span>
    `;
    this.tooltip.style.left = `${point.x + 14}px`;
    this.tooltip.style.top = `${point.y + 14}px`;
    this.tooltip.classList.add("is-visible");
  }
}
