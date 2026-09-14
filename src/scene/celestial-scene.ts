import * as THREE from "three";
import { MakeTime, RotateVector, Rotation_EQD_EQJ, Vector } from "astronomy-engine";

import type {
  Asterism,
  ChineseSkyculture,
  StarCatalog,
  WesternSkyculture,
} from "../data/catalog";
import { MANSIONS, type MansionDefinition } from "../data/mansions";
import {
  eclipticToWorld,
  eclipticToEquatorialJ2000,
  equatorialToEclipticJ2000,
  type Cartesian,
} from "../lib/coordinates";
import {
  BODY_DEFINITIONS,
  bodyDetails,
  type ObserverLocation,
  type SolarBodyId,
} from "../lib/ephemeris";
import type { VirtualPointId } from "../lib/projection-data";
import {
  CameraController,
  type CameraPointerClick,
  type ViewPreset,
} from "./camera-controller";
import { PROJECTION_RING_RADIUS, ProjectionLayer } from "./projection-layer";
import { SolarSystemLayer } from "./solar-system";
import { SolarTermLayer } from "./solar-term-layer";
import { STAR_VISIBILITY_LIMIT, StarField } from "./star-field";
import { AsterismLayer } from "./asterism-layer";
import { contextProfile, type WesternMode } from "../lib/context-profiles";
import { resolveNameStyle } from "../lib/names";
import type { XuanYeSettings } from "../lib/settings-store";
import type { ChartTabId } from "../ui/charts/types";
import { StarLabelLayer } from "./star-label-layer";
import type { EclipticViewPole } from "../lib/chart-orientation";
import { eclipticPointHorizontal, equatorialHorizontal, horizontalDirectionEcliptic } from
  "../lib/planetarium";
import { PlanetariumOverlay } from "./planetarium-overlay";
import { projectScreenPoint } from "./project-screen";
import type { LayoutMeasurement } from "../lib/layout-verification";
import { PlanetariumBackdrop } from "./planetarium-backdrop";
import { projectionForward } from "../lib/planetarium";
import { ConstellationArtLayer } from "./constellation-art-layer";
import { LandscapeLayer } from "./landscape-layer";
import {
  detectableStarMagnitude,
  planetThreshold,
  starDistanceVisible,
} from "../lib/visibility";
import {
  GROUND_SELFTEST_HOURS,
  GROUND_SELFTEST_LOCATION,
  GROUND_SELFTEST_START,
  landscapeGroundColorForSunAltitude,
} from "../lib/ground-shading";
import { labelCap, layoutLabels } from "../lib/label-layout";
import { applySceneLabelPlacements } from "./scene-labels";
import { loadDeepSkyObjects, type DeepSkyObject } from "../data/deep-sky";
import { MilkyWayLayer } from "./milky-way-layer";
import { DeepSkyLayer } from "./deep-sky-layer";
import type { SkySearchEntry } from "../lib/sky-search";
import { extinctionMagnitude, fovLabelCap } from "../lib/sky-appearance";

export type SkyMode = "xuanye" | "huntian" | "gaitian";
export type SphereViewpoint = "earth" | "sun" | "camera" | "selected";

export type SceneSelection =
  | { kind: "star"; index: number }
  | { kind: "body"; id: SolarBodyId }
  | { kind: "point"; id: VirtualPointId | "Ziqi" }
  | { kind: "asterism"; asterism: Asterism }
  | { kind: "dso"; object: DeepSkyObject };

export interface CelestialSceneEvents {
  onSelection(selection: SceneSelection): void;
  onMansionHover(
    mansion: MansionDefinition | undefined,
    longitude: number | undefined,
    point: { x: number; y: number },
  ): void;
  onBodyHover(id: string | undefined): void;
}

export class CelestialScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly cameraController: CameraController;
  private readonly starField: StarField;
  private readonly starLabels: StarLabelLayer;
  private readonly asterisms: AsterismLayer;
  private readonly westernAsterisms: AsterismLayer;
  private readonly constellationArt: ConstellationArtLayer;
  private readonly solarSystem = new SolarSystemLayer();
  private readonly projection: ProjectionLayer;
  private readonly solarTerms = new SolarTermLayer();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly timer = new THREE.Timer();
  private readonly planetarium = new PlanetariumOverlay();
  private readonly backdrop = new PlanetariumBackdrop();
  private readonly landscape = new LandscapeLayer();
  private readonly milkyWay = new MilkyWayLayer();
  private readonly deepSkyObjects = loadDeepSkyObjects();
  private readonly deepSky = new DeepSkyLayer(this.deepSkyObjects);
  private readonly selftest = new URLSearchParams(location.hash.slice(1)).get("selftest");
  private readonly synchronousSelfTest = this.selftest === "ground" ||
    this.selftest === "charts" || this.selftest === "drag" || this.selftest === "ui" ||
    this.selftest === "sky";

  private date = new Date();
  private location: ObserverLocation = { latitude: 39.93, longitude: 116.41 };
  private timeZone = "Asia/Shanghai";
  private selectedStar?: number;
  private selectedBody?: SolarBodyId;
  private selectedPoint?: VirtualPointId | "Ziqi";
  private selectedDso?: DeepSkyObject;
  private selectedAsterism?: Asterism;
  private tracking = false;
  private animationFrame = 0;
  private resizeFrame = 0;
  private mode: SkyMode = "xuanye";
  private morph = 0;
  private viewpointKind: SphereViewpoint = "earth";
  private sphereLocked = true;
  private chartTab: ChartTabId = "observation";
  private westernMode: WesternMode = "modern";
  private settings?: Readonly<XuanYeSettings>;
  private virtualRadiusEnabled = false;
  private virtualRadiusMorph = 0;
  private huntianExterior = false;
  private chartGuide?: {
    longitude: number;
    mc?: number;
    cusps?: number[];
    mansions?: number[];
  };
  private planetariumHighlight?: number;
  private lockedViewpoint: Cartesian = { x: 0, y: 0, z: 0 };
  private currentPreset: ViewPreset = "xuanye";
  private lastVisibilityReport = 0;
  private labelLayoutKey = "";
  private labelRevision = 0;
  private visibleSceneLabels = 0;
  private hoveredBody?: SolarBodyId;
  private skyTestExtinctionAltitude?: number;
  private readonly asterismHips: Set<number>;
  private readonly mansionHips = new Set(MANSIONS.map((item) => item.referenceHip));
  private backgroundDust?: THREE.Points;

  constructor(
    private readonly container: HTMLElement,
    readonly stars: StarCatalog,
    readonly skyculture: ChineseSkyculture,
    readonly western: WesternSkyculture,
    private readonly events: CelestialSceneEvents,
  ) {
    this.asterismHips = new Set(skyculture.asterisms.flatMap((item) => item.lines.flat()));
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: this.synchronousSelfTest,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.setAttribute("aria-label", "真实三维星空交互视窗");
    container.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(48, 1, 1e-12, 10_000);
    this.camera.up.set(0, 1, 0);
    this.camera.position.set(0, 7e-5, 1e-9);
    this.cameraController = new CameraController(
      this.camera,
      this.renderer.domElement,
      (click) => this.handleClick(click),
    );
    this.starField = new StarField(stars, skyculture);
    this.starLabels = new StarLabelLayer(stars, skyculture);
    this.asterisms = new AsterismLayer(stars, skyculture, (asterism) => {
      this.asterisms.setSelected(asterism);
      this.labelRevision += 1;
      this.events.onSelection({ kind: "asterism", asterism });
    });
    this.westernAsterisms = new AsterismLayer(stars, western, (asterism) => {
      this.events.onSelection({ kind: "asterism", asterism });
    });
    this.constellationArt = new ConstellationArtLayer(stars, western);
    container.append(this.asterisms.labels);
    container.append(this.westernAsterisms.labels);
    container.append(this.starLabels.element);
    container.append(this.solarSystem.labels);
    container.append(this.planetarium.element);
    container.append(this.deepSky.labels);
    this.projection = new ProjectionLayer(stars);
    this.scene.add(
      this.starField.points,
      this.asterisms.group,
      this.westernAsterisms.group,
      this.constellationArt.group,
      this.solarSystem.group,
      this.projection.group,
      this.solarTerms.group,
      this.backdrop.mesh,
      this.landscape.group,
      this.milkyWay.group,
      this.deepSky.group,
    );
    this.addBackgroundDust();

    const resizeObserver = new ResizeObserver(() => this.requestResize());
    resizeObserver.observe(container);
    this.renderer.domElement.addEventListener(
      "pointermove",
      (event) => this.handlePointerMove(event),
    );
    if (!this.synchronousSelfTest) this.animate();
  }

  setDate(date: Date): void {
    this.date = date;
  }

  get deepSkyCatalog(): readonly DeepSkyObject[] {
    return this.deepSkyObjects;
  }

  focusSearchEntry(entry: SkySearchEntry): void {
    if (entry.kind === "star") {
      const index = Number(entry.id);
      this.selectedStar = index;
      this.selectedBody = undefined;
      this.selectedPoint = undefined;
      this.selectedDso = undefined;
      this.selectedAsterism = undefined;
      this.deepSky.setSelected(undefined);
      this.events.onSelection({ kind: "star", index });
    } else if (entry.kind === "body") {
      this.selectBody(String(entry.id) as SolarBodyId);
    } else if (entry.kind === "asterism") {
      const asterism = this.skyculture.asterisms.find((item) => item.id === entry.id);
      if (asterism) this.selectAsterism(asterism);
    } else {
      const object = this.deepSkyObjects[Number(entry.id)];
      if (object) this.selectDso(object);
    }
    this.centerSelection();
  }

  centerSelection(): void {
    const horizontal = this.selectionHorizontal();
    if (horizontal && this.mode === "huntian" && !this.huntianExterior) {
      this.cameraController.turnPlanetariumTo(horizontal.azimuth, horizontal.altitude);
      return;
    }
    this.flyToSelection();
  }

  toggleTracking(): boolean {
    this.tracking = !this.tracking;
    return this.tracking;
  }

  setLocation(location: ObserverLocation): void {
    this.location = location;
  }

  setTimeZone(timeZone: string): void {
    this.timeZone = timeZone;
  }

  setChartTab(tab: ChartTabId, westernMode: WesternMode = "modern"): void {
    this.chartTab = tab;
    this.westernMode = westernMode;
    this.labelRevision += 1;
    this.applyContext();
    if (tab === "gaitian") this.lookAtNorthPole();
  }

  applySettings(settings: Readonly<XuanYeSettings>): void {
    this.settings = settings;
    this.labelRevision += 1;
    this.starField.setBrightness(settings.starBrightness);
    this.solarSystem.setOrbitsVisible(settings.orbitLines);
    this.solarSystem.setGridVisible(settings.gridVisible);
    this.projection.setLinesEnabled(settings.projectionLines);
    this.projection.setCalcType(settings.zhengyuCalcType);
    for (const kind of ["mansions", "enclosures", "other"] as const) {
      this.asterisms.setLayerVisible(kind, settings.asterismLayers[kind]);
    }
    this.applyContext();
  }

  setVirtualRadius(enabled: boolean): void {
    this.virtualRadiusEnabled = enabled;
    if (enabled) this.flyToPreset("geocentric");
  }

  setChartOrientation(alignment: {
    longitude: number;
    screenAngle: number;
    pole: EclipticViewPole;
    mc?: number;
    cusps?: number[];
    mansions?: number[];
  } | undefined, align = false): void {
    this.chartGuide = alignment;
    this.cameraController.clearTopDownAlignment();
    if (!align) return;
    if (!alignment && this.chartTab === "gaitian") {
      this.lookAtNorthPole();
      return;
    }
    if (alignment) {
      this.cameraController.alignTopDown(
        alignment.longitude,
        alignment.screenAngle,
        alignment.pole,
      );
    }
  }

  setMode(mode: SkyMode): void {
    this.mode = mode;
    this.updatePlanetariumMode();
    if (mode === "gaitian") this.lookAtNorthPole();
    if (mode !== "xuanye") this.lockedViewpoint = this.resolveViewpoint();
  }

  setHuntianExterior(exterior: boolean): void {
    this.huntianExterior = exterior;
    this.updatePlanetariumMode();
  }

  setSphereViewpoint(viewpoint: SphereViewpoint): void {
    this.viewpointKind = viewpoint;
    this.lockedViewpoint = this.resolveViewpoint();
  }

  setSphereLocked(locked: boolean): void {
    this.sphereLocked = locked;
    if (locked) this.lockedViewpoint = this.resolveViewpoint();
  }

  setDepthVisible(visible: boolean): void {
    this.asterisms.setDepthVisible(visible);
  }

  setAsterismLayer(kind: "mansions" | "enclosures" | "other", visible: boolean): void {
    this.asterisms.setLayerVisible(kind, visible);
  }

  runDissolution(): void {
    this.mode = "huntian";
    this.sphereLocked = false;
    const orion = this.stars.getByHip(27989);
    if (!orion) return;
    const [x, y, z] = orion.position;
    this.cameraController.flyOut({ x, y, z });
  }

  toggleDissolutionPause(): boolean {
    return this.cameraController.toggleTransitionPause();
  }

  get observerLocation(): ObserverLocation {
    return this.location;
  }

  flyToPreset(preset: ViewPreset): void {
    this.currentPreset = preset;
    const earth = this.solarSystem.bodyPositions.get("Earth") ?? { x: 0, y: 0, z: 0 };
    const sirius = this.stars.getByHip(32349);
    const fallback = sirius
      ? this.stars.positionAt(sirius.index, this.decimalYear())
      : [2.6, 0, 0] as [number, number, number];
    const selected = this.selectedStar === undefined
      ? fallback
      : this.stars.positionAt(this.selectedStar, this.decimalYear());
    this.cameraController.flyTo(
      preset,
      { x: selected[0], y: selected[1], z: selected[2] },
      earth,
    );
    this.projection.setVisible(preset === "geocentric");
  }

  setPresetImmediatelyForSelfTest(preset: ViewPreset): void {
    if (!this.synchronousSelfTest) throw new Error("Synchronous preset requires a self-test");
    this.currentPreset = preset;
    const earth = this.solarSystem.bodyPositions.get("Earth") ?? { x: 0, y: 0, z: 0 };
    const sirius = this.stars.getByHip(32349);
    const fallback = sirius
      ? this.stars.positionAt(sirius.index, this.decimalYear())
      : [2.6, 0, 0] as [number, number, number];
    const selected = this.selectedStar === undefined
      ? fallback
      : this.stars.positionAt(this.selectedStar, this.decimalYear());
    this.cameraController.setPresetImmediately(
      preset,
      { x: selected[0], y: selected[1], z: selected[2] },
      earth,
    );
    this.projection.setVisible(preset === "geocentric");
    this.labelRevision += 1;
  }

  flyToSelection(): void {
    if (this.selectedDso) {
      const horizontal = this.selectionHorizontal();
      if (horizontal) {
        this.cameraController.turnPlanetariumTo(horizontal.azimuth, horizontal.altitude);
      }
      return;
    }
    if (this.selectedBody) {
      const position = this.solarSystem.bodyPositions.get(this.selectedBody);
      if (!position) return;
      const distance = this.selectedBody === "Moon" || this.selectedBody === "Earth"
        ? 1.2e-8
        : 7e-7;
      this.cameraController.focus(position, distance);
      return;
    }
    if (this.selectedPoint && this.selectedPoint !== "Ziqi") {
      const position = this.projection.virtualPositions.get(this.selectedPoint);
      if (position) this.cameraController.focus(position, 1.2e-8);
      return;
    }
    if (this.selectedStar === undefined) return;
    const position = this.stars.positionAt(this.selectedStar, this.decimalYear());
    this.cameraController.focus(
      { x: position[0], y: position[1], z: position[2] },
      0.08,
    );
  }

  activateChartLink(
    kind: "body" | "house" | "sign" | "mansion" | "asterism" | "sky",
    id: string | number,
    longitude?: number,
  ): void {
    if (this.mode === "huntian" && !this.huntianExterior) {
      const targetLongitude = longitude ?? (kind === "mansion"
        ? this.projection.mansionBoundary(Number(id)) : undefined);
      if (targetLongitude !== undefined) {
        this.planetariumHighlight = targetLongitude;
        const horizontal = eclipticPointHorizontal(
          targetLongitude,
          0,
          this.date,
          this.location,
        );
        this.cameraController.turnPlanetariumTo(
          horizontal.azimuth,
          horizontal.altitude,
        );
      }
      if (kind === "sky" || kind === "house" || kind === "sign") return;
    }
    if (kind === "asterism") {
      const asterism = this.skyculture.asterisms.find((item) => item.id === id);
      if (asterism) this.selectAsterism(asterism);
      return;
    }
    if (kind === "sky") return;
    if (kind === "mansion") {
      const mansion = MANSIONS[Number(id)];
      const asterism = this.skyculture.asterisms.find((item) =>
        item.nameZh === `${mansion?.name}宿`);
      if (asterism) this.selectAsterism(asterism);
    }
    this.projection.setHighlight(kind, id);
    if (kind !== "body") {
      this.flyToPreset("geocentric");
      return;
    }
    const bodyId = String(id);
    const definition = BODY_DEFINITIONS.find((item) => item.id === bodyId);
    if (definition) {
      this.selectBody(definition.id);
      const position = this.solarSystem.bodyPositions.get(definition.id);
      if (position) this.cameraController.focusTopDown(position, 7e-7);
      return;
    }
    const pointId = bodyId as VirtualPointId | "Ziqi";
    this.selectPoint(pointId);
    if (pointId === "Ziqi") return;
    const position = this.projection.virtualPositions.get(pointId);
    if (position) this.cameraController.focusTopDown(position, 1.2e-8);
  }

  hoverChartLink(
    kind: "body" | "house" | "sign" | "mansion" | "asterism" | "sky" | undefined,
    id?: string | number,
  ): void {
    if (!kind || id === undefined) {
      if (this.selectedBody) this.projection.setHighlight("body", this.selectedBody);
      else if (this.selectedPoint) this.projection.setHighlight("body", this.selectedPoint);
      else this.projection.clearHighlight();
      return;
    }
    if (kind !== "asterism" && kind !== "sky") this.projection.setHighlight(kind, id);
  }

  private selectAsterism(asterism: Asterism): void {
    this.selectedAsterism = asterism;
    this.asterisms.setSelected(asterism);
    this.labelRevision += 1;
    this.events.onSelection({ kind: "asterism", asterism });
  }

  private applyContext(): void {
    const profile = contextProfile(this.chartTab, this.westernMode);
    this.solarTerms.setVisible(profile.solarTerms);
    this.projection.setContextProfile(profile);
    this.asterisms.setEmphasized(profile.emphasizeAsterisms);
    const settings = this.settings;
    const style = resolveNameStyle(settings?.nameStyle ?? "auto", this.chartTab, "body");
    this.starLabels.setOptions(
      settings?.nameStyle ?? "auto",
      this.chartTab,
      settings?.labelDensity ?? 0.55,
    );
    this.solarSystem.setLabelOptions({
      involved: profile.involvedBodies,
      labelAll: profile.labelAllBodies && (settings?.planetLabels ?? true),
      involvedOnly: settings?.involvedLabelsOnly ?? true,
      style,
      density: settings?.labelDensity ?? 0.55,
      enabled: settings?.planetLabels ?? true,
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    cancelAnimationFrame(this.resizeFrame);
    this.timer.dispose();
    this.renderer.dispose();
  }

  requestResize(): void {
    if (this.synchronousSelfTest) {
      this.resize();
      return;
    }
    cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = requestAnimationFrame(() => this.resize());
  }

  inspectLayout(): LayoutMeasurement {
    const containerRect = this.container.getBoundingClientRect();
    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const offendingLabels: LayoutMeasurement["offendingLabels"] = [];
    this.container.querySelectorAll<HTMLElement | SVGElement>(
      ".body-labels span, .star-labels span, .asterism-labels button, " +
      ".dso-labels span, .planetarium-overlay text",
    ).forEach((label) => {
      if (!this.labelIsVisible(label)) return;
      const rect = label.getBoundingClientRect();
      if (rect.left < containerRect.left - 0.5 || rect.top < containerRect.top - 0.5 ||
        rect.right > containerRect.right + 0.5 || rect.bottom > containerRect.bottom + 0.5) {
        if (offendingLabels.length < 10) {
          offendingLabels.push({
            text: label.textContent?.trim() ?? "",
            class: label.getAttribute("class") ?? "",
            rect: {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
            },
          });
        }
      }
    });
    const labelsOutside = this.countOutsideVisibleLabels(containerRect);
    return {
      container: { width: containerRect.width, height: containerRect.height },
      canvas: { width: canvasRect.width, height: canvasRect.height },
      drawingBuffer: { width: buffer.x, height: buffer.y },
      devicePixelRatio: this.renderer.getPixelRatio(),
      cameraAspect: this.camera.aspect,
      labelsOutside,
      offendingLabels,
    };
  }

  private labelIsVisible(label: Element): boolean {
    const rect = label.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || label.hasAttribute("hidden")) return false;
    let current: Element | null = label;
    while (current && this.container.contains(current)) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" ||
        style.visibility === "collapse" || Number(style.opacity) <= 0) return false;
      if (current === this.container) break;
      current = current.parentElement;
    }
    return true;
  }

  private countOutsideVisibleLabels(containerRect: DOMRect): number {
    let count = 0;
    this.container.querySelectorAll<HTMLElement | SVGElement>(
      ".body-labels span, .star-labels span, .asterism-labels button, " +
      ".dso-labels span, .planetarium-overlay text",
    ).forEach((label) => {
      if (!this.labelIsVisible(label)) return;
      const rect = label.getBoundingClientRect();
      if (rect.left < containerRect.left - 0.5 || rect.top < containerRect.top - 0.5 ||
        rect.right > containerRect.right + 0.5 || rect.bottom > containerRect.bottom + 0.5) {
        count += 1;
      }
    });
    return count;
  }

  prepareGroundSelfTest(azimuth: number): void {
    this.cameraController.setPlanetariumLookImmediately(azimuth, 0);
    this.camera.fov = 120;
    this.camera.updateProjectionMatrix();
    this.morph = 1;
  }

  findGroundSelfTestInstants(): {
    location: ObserverLocation;
    day: { date: Date; sunAltitude: number };
    night: { date: Date; sunAltitude: number };
  } {
    const sun = BODY_DEFINITIONS.find((item) => item.id === "Sun")!;
    const start = new Date(GROUND_SELFTEST_START).getTime();
    const values = Array.from({ length: GROUND_SELFTEST_HOURS }, (_, hour) => {
      const date = new Date(start + hour * 60 * 60 * 1_000);
      return {
        date,
        sunAltitude: bodyDetails(sun, date, GROUND_SELFTEST_LOCATION).altitude,
      };
    });
    const day = values.reduce((best, value) =>
      value.sunAltitude > best.sunAltitude ? value : best);
    const night = values.reduce((best, value) =>
      value.sunAltitude < best.sunAltitude ? value : best);
    if (day.sunAltitude <= 20 || night.sunAltitude >= -18) {
      throw new Error(
        `No test instants in ${GROUND_SELFTEST_HOURS} hourly steps: ` +
        `day ${day.sunAltitude.toFixed(2)}°, night ${night.sunAltitude.toFixed(2)}°`,
      );
    }
    return { location: { ...GROUND_SELFTEST_LOCATION }, day, night };
  }

  waitForLandscapeForSelfTest(timeoutMs: number): Promise<void> {
    return this.landscape.waitUntilReadyForSelfTest(timeoutMs);
  }

  waitForSkyDataForSelfTest(timeoutMs: number): Promise<void> {
    return this.milkyWay.waitUntilReadyForSelfTest(timeoutMs);
  }

  renderOnceForSelfTest(): void {
    if (!this.synchronousSelfTest) {
      throw new Error("renderOnceForSelfTest requires a synchronous self-test");
    }
    this.resize();
    this.renderFrame(0);
  }

  setFovForSelfTest(fov: number): void {
    if (this.selftest !== "sky") throw new Error("FOV override requires #selftest=sky");
    this.camera.fov = THREE.MathUtils.clamp(fov, 1, 180);
    this.camera.updateProjectionMatrix();
    this.labelRevision += 1;
  }

  setLookForSelfTest(azimuth: number, altitude: number): void {
    if (this.selftest !== "sky") throw new Error("Look override requires #selftest=sky");
    this.cameraController.setPlanetariumLookImmediately(azimuth, altitude);
    this.labelRevision += 1;
  }

  setExtinctionAltitudeForSelfTest(altitude: number | undefined): void {
    if (this.selftest !== "sky") {
      throw new Error("Extinction override requires #selftest=sky");
    }
    this.skyTestExtinctionAltitude = altitude;
  }

  motionForSelfTest(): ReturnType<CameraController["motionForSelfTest"]> {
    return this.cameraController.motionForSelfTest();
  }

  visibleLabelsForSelfTest(): number {
    return this.visibleSceneLabels;
  }

  selectionCenterErrorForSelfTest(): number {
    const target = this.selectionHorizontal();
    if (!target) return Infinity;
    const look = this.cameraController.planetariumLook;
    const azimuth = Math.abs(((look.azimuth - target.azimuth + 540) % 360) - 180);
    return Math.hypot(azimuth * Math.cos(target.altitude * Math.PI / 180),
      look.altitude - target.altitude);
  }

  skyDataForSelfTest(): { milkyWayBrightness: number; m42Visible: boolean } {
    return {
      milkyWayBrightness: this.milkyWay.brightnessForSelfTest(),
      m42Visible: this.deepSky.visibleForSelfTest(
        "M42",
        this.camera.fov,
        this.settings?.bortleClass ?? 3,
      ),
    };
  }

  frameLuminanceForSelfTest(): number {
    if (this.selftest !== "sky") throw new Error("Sky luminance requires #selftest=sky");
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const pixels = new Uint8Array(buffer.x * buffer.y * 4);
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, buffer.x, buffer.y, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let total = 0;
    const columns = 64;
    const rows = 36;
    for (let row = 0; row < rows; row += 1) {
      const y = Math.min(buffer.y - 1, Math.floor((row + 0.5) * buffer.y / rows));
      for (let column = 0; column < columns; column += 1) {
        const x = Math.min(buffer.x - 1,
          Math.floor((column + 0.5) * buffer.x / columns));
        const offset = (y * buffer.x + x) * 4;
        total += pixels[offset]! * 0.2126 + pixels[offset + 1]! * 0.7152 +
          pixels[offset + 2]! * 0.0722;
      }
    }
    return total / (columns * rows);
  }

  starPeakLuminanceForSelfTest(radius = 16): number {
    if (this.selftest !== "sky") throw new Error("Star sample requires #selftest=sky");
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const size = radius * 2 + 1;
    const x = Math.max(0, Math.floor((buffer.x - size) / 2));
    const y = Math.max(0, Math.floor((buffer.y - size) / 2));
    const width = Math.min(size, buffer.x - x);
    const height = Math.min(size, buffer.y - y);
    const pixels = new Uint8Array(width * height * 4);
    const gl = this.renderer.getContext();
    gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let peak = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      peak = Math.max(peak, pixels[offset]! * 0.2126 + pixels[offset + 1]! * 0.7152 +
        pixels[offset + 2]! * 0.0722);
    }
    return peak / 255;
  }

  finishCameraTransitionForSelfTest(): void {
    if (!this.synchronousSelfTest) throw new Error("Camera settling requires a self-test");
    this.cameraController.setTransitionImmediatelyForSelfTest();
    this.labelRevision += 1;
  }

  dispatchPointerForSelfTest(
    type: "pointerdown" | "pointermove" | "pointerup",
    x: number,
    y: number,
    buttons: number,
  ): void {
    if (this.selftest !== "drag" && this.selftest !== "sky") {
      throw new Error("Pointer dispatch requires a drag-capable self-test");
    }
    const canvas = this.renderer.domElement;
    if (type === "pointerdown") {
      Object.defineProperty(canvas, "setPointerCapture", {
        configurable: true,
        value: () => undefined,
      });
      Object.defineProperty(canvas, "releasePointerCapture", {
        configurable: true,
        value: () => undefined,
      });
    }
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: type === "pointerup" ? 0 : 0,
      buttons,
      pointerId: 73,
      pointerType: "mouse",
      isPrimary: true,
    }));
    if (type === "pointerup") {
      delete (canvas as unknown as Record<string, unknown>).setPointerCapture;
      delete (canvas as unknown as Record<string, unknown>).releasePointerCapture;
    }
  }

  dispatchWheelForSelfTest(x: number, y: number, deltaY: number): void {
    if (this.selftest !== "drag" && this.selftest !== "sky") {
      throw new Error("Wheel dispatch requires a drag-capable self-test");
    }
    this.renderer.domElement.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      deltaY,
    }));
  }

  updateControlsForSelfTest(): void {
    this.cameraController.updateControlsForSelfTest();
  }

  dragOriginForSelfTest(): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  orbitForSelfTest(): { azimuth: number; polar: number; up: number[] } {
    return this.cameraController.orbitForSelfTest();
  }

  inspectDragForSelfTest(): {
    nearWhiteFraction: number;
    largestNearWhiteBlob: number;
    brightDots: number;
    expectedBrightStars: number;
    finite: boolean;
    camera: { distance: number; fov: number; target: number[] };
    starUniforms: Record<string, number | number[]>;
  } {
    if (this.selftest !== "drag" && this.selftest !== "sky") {
      throw new Error("Drag inspection requires a drag-capable self-test");
    }
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const pixels = new Uint8Array(buffer.x * buffer.y * 4);
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, buffer.x, buffer.y, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const sampleWidth = 128;
    const sampleHeight = 72;
    const white = new Uint8Array(sampleWidth * sampleHeight);
    const light = new Uint8Array(sampleWidth * sampleHeight);
    let nearWhite = 0;
    for (let row = 0; row < sampleHeight; row += 1) {
      const y = Math.min(buffer.y - 1, Math.floor((row + 0.5) * buffer.y / sampleHeight));
      for (let column = 0; column < sampleWidth; column += 1) {
        const x = Math.min(buffer.x - 1,
          Math.floor((column + 0.5) * buffer.x / sampleWidth));
        const source = (y * buffer.x + x) * 4;
        const target = row * sampleWidth + column;
        const red = pixels[source]!;
        const green = pixels[source + 1]!;
        const blue = pixels[source + 2]!;
        light[target] = Math.max(red, green, blue);
        if (red > 200 && green > 200 && blue > 200) {
          white[target] = 1;
          nearWhite += 1;
        }
      }
    }
    let brightDots = 0;
    for (let row = 1; row < sampleHeight - 1; row += 1) {
      for (let column = 1; column < sampleWidth - 1; column += 1) {
        const index = row * sampleWidth + column;
        const value = light[index]!;
        if (value < 56) continue;
        let maximum = true;
        let strictlyBrighter = false;
        for (let y = -1; y <= 1; y += 1) {
          for (let x = -1; x <= 1; x += 1) {
            if (x === 0 && y === 0) continue;
            const neighbour = light[index + y * sampleWidth + x]!;
            if (neighbour > value) maximum = false;
            if (neighbour < value) strictlyBrighter = true;
          }
        }
        if (maximum && strictlyBrighter) brightDots += 1;
      }
    }
    let largestNearWhiteBlob = 0;
    const visited = new Uint8Array(white.length);
    for (let start = 0; start < white.length; start += 1) {
      if (!white[start] || visited[start]) continue;
      const queue = [start];
      visited[start] = 1;
      let size = 0;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const index = queue[cursor]!;
        size += 1;
        const x = index % sampleWidth;
        for (const next of [index - 1, index + 1, index - sampleWidth,
          index + sampleWidth]) {
          if (next < 0 || next >= white.length || visited[next] || !white[next]) continue;
          if ((next === index - 1 && x === 0) ||
            (next === index + 1 && x === sampleWidth - 1)) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
      largestNearWhiteBlob = Math.max(largestNearWhiteBlob, size);
    }
    const starUniforms = this.starField.diagnosticsForSelfTest();
    return {
      nearWhiteFraction: nearWhite / white.length,
      largestNearWhiteBlob,
      brightDots,
      expectedBrightStars: this.expectedBrightStarsForSelfTest(starUniforms),
      finite: this.cameraController.finiteState() && this.starField.finiteStateForSelfTest(),
      camera: {
        distance: this.cameraController.distance,
        fov: this.camera.fov,
        target: this.cameraController.controls.target.toArray(),
      },
      starUniforms,
    };
  }

  private expectedBrightStarsForSelfTest(
    uniforms: Record<string, number | number[]>,
  ): number {
    const numberValue = (name: string) => uniforms[name] as number;
    const vectorValue = (name: string) => uniforms[name] as number[];
    const profileFilter = numberValue("profileFilter");
    const profileScale = profileFilter > 0.5 && profileFilter < 1.5 ? 0.2 : 1;
    const magnitudeLimit = Math.min(
      numberValue("visibilityLimit"),
      detectableStarMagnitude(
        numberValue("brightnessScale"),
        numberValue("atmosphereScale"),
        profileScale,
      ),
    );
    if (!Number.isFinite(magnitudeLimit)) return 0;
    const distanceCenter = vectorValue("distanceCenter");
    const projectionCenter = vectorValue("projectionCenter");
    const worldOrigin = vectorValue("origin");
    const minimum = numberValue("distanceMinimum");
    const maximum = numberValue("distanceMaximum");
    const fullRange = numberValue("distanceRangeFull") > 0.5;
    const morph = numberValue("morph");
    const radius = numberValue("projectionRadius");
    const inner = numberValue("planetariumMode") > 0.5;
    const projectionIndex = numberValue("planetariumProjection");
    const projection = projectionIndex > 1.5 ? "fisheye"
      : projectionIndex > 0.5 ? "stereographic" : "perspective";
    const zenith = inner
      ? horizontalDirectionEcliptic(this.date, this.location, 0, 90) : undefined;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const year = this.decimalYear();
    const point = new THREE.Vector3();
    let count = 0;
    for (let index = 0; index < this.stars.count; index += 1) {
      const star = this.stars.get(index);
      if (profileFilter >= 1.5 && profileFilter < 2.5 &&
        !this.asterismHips.has(star.hip)) continue;
      if (profileFilter >= 2.5 && !this.asterismHips.has(star.hip) &&
        !this.mansionHips.has(star.hip)) continue;
      const ecliptic = this.stars.positionAt(index, year);
      const distance = Math.hypot(
        ecliptic[0] - distanceCenter[0]!,
        ecliptic[1] - distanceCenter[1]!,
        ecliptic[2] - distanceCenter[2]!,
      );
      if (distance < minimum || (!fullRange && distance > maximum)) continue;
      if (!fullRange && star.distanceSource === "unknown") continue;
      if (zenith) {
        const horizontal = (ecliptic[0] - distanceCenter[0]!) * zenith.x +
          (ecliptic[1] - distanceCenter[1]!) * zenith.y +
          (ecliptic[2] - distanceCenter[2]!) * zenith.z;
        if (horizontal <= 0) continue;
        const altitude = Math.asin(Math.min(1, Math.max(-1,
          horizontal / Math.max(1e-20, distance)))) * 180 / Math.PI;
        if (star.magnitude + (numberValue("extinctionEnabled") > 0.5
          ? extinctionMagnitude(altitude) : 0) > magnitudeLimit) continue;
      } else if (star.magnitude > magnitudeLimit) {
        continue;
      }
      const deltaX = ecliptic[0] - projectionCenter[0]!;
      const deltaY = ecliptic[1] - projectionCenter[1]!;
      const deltaZ = ecliptic[2] - projectionCenter[2]!;
      const length = Math.max(Math.hypot(deltaX, deltaY, deltaZ), 1e-20);
      const projected = [
        projectionCenter[0]! + deltaX / length * radius,
        projectionCenter[1]! + deltaY / length * radius,
        projectionCenter[2]! + deltaZ / length * radius,
      ];
      const mixed = {
        x: ecliptic[0] + (projected[0]! - ecliptic[0]) * morph,
        y: ecliptic[1] + (projected[1]! - ecliptic[1]) * morph,
        z: ecliptic[2] + (projected[2]! - ecliptic[2]) * morph,
      };
      const world = eclipticToWorld(mixed);
      point.set(
        world.x - worldOrigin[0]!,
        world.y - worldOrigin[1]!,
        world.z - worldOrigin[2]!,
      );
      const screen = projectScreenPoint(
        point,
        this.camera,
        width,
        height,
        inner,
        projection,
      );
      if (screen.visible && screen.x >= 0 && screen.x <= width &&
        screen.y >= 0 && screen.y <= height) count += 1;
    }
    return count;
  }

  inspectChartsForSelfTest(): {
    visibleLabels: number;
    edgeLabels: number;
    nearWhiteFraction: number;
    domLabelElements: number;
    cap: number;
    budgetedLabels: number;
  } {
    if (this.selftest !== "charts") {
      throw new Error("inspectChartsForSelfTest requires #selftest=charts");
    }
    const selector = ".body-labels span, .star-labels span, " +
      ".asterism-labels button, .dso-labels span, .planetarium-overlay text";
    const containerRect = this.container.getBoundingClientRect();
    const elements = [...this.container.querySelectorAll<HTMLElement | SVGElement>(selector)];
    let domVisible = 0;
    let edgeLabels = 0;
    for (const element of elements) {
      if (!this.labelIsVisible(element)) continue;
      domVisible += 1;
      const rect = element.getBoundingClientRect();
      if (Math.abs(rect.left - containerRect.left) <= 2 ||
        Math.abs(rect.top - containerRect.top) <= 2 ||
        Math.abs(rect.right - containerRect.right) <= 2 ||
        Math.abs(rect.bottom - containerRect.bottom) <= 2) {
        edgeLabels += 1;
      }
    }
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const pixels = new Uint8Array(buffer.x * buffer.y * 4);
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, buffer.x, buffer.y, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let nearWhite = 0;
    const sampleWidth = 64;
    const sampleHeight = 36;
    for (let row = 0; row < sampleHeight; row += 1) {
      const y = Math.min(buffer.y - 1, Math.floor((row + 0.5) * buffer.y / sampleHeight));
      for (let column = 0; column < sampleWidth; column += 1) {
        const x = Math.min(buffer.x - 1,
          Math.floor((column + 0.5) * buffer.x / sampleWidth));
        const offset = (y * buffer.x + x) * 4;
        if (pixels[offset]! > 200 && pixels[offset + 1]! > 200 &&
          pixels[offset + 2]! > 200) nearWhite += 1;
      }
    }
    const canvasLabels = this.projection.visibleLabelCount();
    return {
      visibleLabels: domVisible + canvasLabels,
      edgeLabels,
      nearWhiteFraction: nearWhite / (sampleWidth * sampleHeight),
      domLabelElements: elements.length,
      cap: labelCap(this.settings?.labelDensity ?? 0.55),
      budgetedLabels: this.visibleSceneLabels,
    };
  }

  inspectHorizonSamples(
    azimuth: number,
    projection: XuanYeSettings["planetariumProjection"],
  ): {
    below: Array<{ altitude: number; side: number; rgba: number[] }>;
    above: Array<{ altitude: number; rgba: number[] }>;
  } {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const inverseCamera = this.camera.quaternion.clone().invert();
    const gl = this.renderer.getContext();
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const sample = (sampleAzimuth: number, altitude: number): number[] => {
      const value = horizontalDirectionEcliptic(
        this.date,
        this.location,
        sampleAzimuth,
        altitude,
      );
      const world = eclipticToWorld(value);
      const cameraDirection = new THREE.Vector3(world.x, world.y, world.z)
        .normalize().applyQuaternion(inverseCamera);
      const raw = projectionForward(projection, {
        x: cameraDirection.x,
        y: cameraDirection.y,
        z: -cameraDirection.z,
      });
      const scale = projection === "perspective" ? Math.tan(halfFov)
        : projection === "stereographic" ? 2 * Math.tan(halfFov / 2) : halfFov;
      const ndcX = raw.x / scale / this.camera.aspect;
      const ndcY = raw.y / scale;
      const cssX = (ndcX + 1) * width / 2;
      const cssY = (1 - ndcY) * height / 2;
      const x = Math.min(buffer.x - 1, Math.max(0,
        Math.round(cssX / width * buffer.x),
      ));
      const y = Math.min(buffer.y - 1, Math.max(0,
        Math.round((height - cssY) / height * buffer.y),
      ));
      const pixel = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [...pixel];
    };
    const below: Array<{ altitude: number; side: number; rgba: number[] }> = [];
    for (const altitude of [-5, -20, -40]) {
      for (const side of [-1, 1]) {
        below.push({
          altitude,
          side,
          rgba: sample(azimuth + side * 15, altitude),
        });
      }
    }
    const above = [5, 20, 40].map((altitude) => ({
      altitude,
      rgba: sample(azimuth, altitude),
    }));
    return { below, above };
  }

  private animate = (): void => {
    this.timer.update();
    const delta = Math.min(this.timer.getDelta(), 0.05);
    this.renderFrame(delta);
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private renderFrame(delta: number): void {
    const innerView = this.mode === "huntian" && !this.huntianExterior;
    if (this.backgroundDust) this.backgroundDust.visible = !innerView;
    const starView = innerView && this.viewpointKind === "selected" &&
      this.selectedStar !== undefined;
    if (innerView) {
      if (this.tracking) {
        const tracked = this.selectionHorizontal();
        if (tracked) {
          this.cameraController.setPlanetariumLookImmediately(
            tracked.azimuth,
            tracked.altitude,
          );
        }
      }
      const earthForView = starView ? this.resolveViewpoint()
        : this.solarSystem.bodyPositions.get("Earth") ?? { x: 0, y: 0, z: 0 };
      const look = this.cameraController.planetariumLook;
      this.cameraController.setPlanetariumFrame(
        earthForView,
        horizontalDirectionEcliptic(
          this.date,
          this.location,
          look.azimuth,
          look.altitude,
        ),
        horizontalDirectionEcliptic(this.date, this.location, 0, 90),
      );
    }
    this.cameraController.update(delta);
    const origin = this.cameraController.origin;
    const distance = this.cameraController.distance;
    const targetMorph = this.mode === "xuanye" ? 0 : 1;
    const morphStep = delta / 1.5;
    this.morph = targetMorph > this.morph
      ? Math.min(targetMorph, this.morph + morphStep)
      : Math.max(targetMorph, this.morph - morphStep);
    const virtualTarget = this.virtualRadiusEnabled ? 1 : 0;
    const virtualStep = delta / 1.2;
    this.virtualRadiusMorph = virtualTarget > this.virtualRadiusMorph
      ? Math.min(virtualTarget, this.virtualRadiusMorph + virtualStep)
      : Math.max(virtualTarget, this.virtualRadiusMorph - virtualStep);
    this.projection.setComparisonProgress(this.virtualRadiusMorph);
    const viewpoint = innerView
      ? { ...origin }
      : this.sphereLocked ? this.lockedViewpoint : { ...origin };
    const planetariumProjection = this.settings?.planetariumProjection ?? "stereographic";
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.near = Math.max(distance * 1e-8, 1e-12);
    this.camera.far = Math.max(10_000, distance * 200);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    const labelKey = [
      this.date.getTime(), width, height, this.camera.fov, this.camera.aspect,
      ...this.camera.position.toArray(), ...this.camera.quaternion.toArray(),
      origin.x, origin.y, origin.z, viewpoint.x, viewpoint.y, viewpoint.z,
      this.morph, this.virtualRadiusMorph, this.labelRevision,
    ].join(":");
    const labelsDirty = labelKey !== this.labelLayoutKey;
    if (labelsDirty) this.labelLayoutKey = labelKey;
    this.starField.setPlanetariumProjection(
      innerView,
      planetariumProjection,
      this.camera.fov,
      this.camera.aspect,
    );
    const sun = BODY_DEFINITIONS.find((item) => item.id === "Sun")!;
    const moon = BODY_DEFINITIONS.find((item) => item.id === "Moon")!;
    const sunAltitude = bodyDetails(sun, this.date, this.location).altitude;
    const moonAltitude = bodyDetails(moon, this.date, this.location).altitude;
    const atmosphereEnabled = Boolean(innerView && !starView && this.settings?.atmosphere);
    let zenith = horizontalDirectionEcliptic(this.date, this.location, 0, 90);
    if (this.skyTestExtinctionAltitude !== undefined && this.selectedStar !== undefined) {
      const position = this.stars.positionAt(this.selectedStar, this.decimalYear());
      const direction = new THREE.Vector3(
        position[0] - viewpoint.x,
        position[1] - viewpoint.y,
        position[2] - viewpoint.z,
      ).normalize();
      const basis = Math.abs(direction.z) < 0.9
        ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      const perpendicular = basis.addScaledVector(direction, -basis.dot(direction)).normalize();
      const altitude = THREE.MathUtils.degToRad(this.skyTestExtinctionAltitude);
      const testZenith = direction.multiplyScalar(Math.sin(altitude))
        .add(perpendicular.multiplyScalar(Math.cos(altitude)));
      zenith = { x: testZenith.x, y: testZenith.y, z: testZenith.z };
    }
    this.starField.setSkyAppearance({
      fov: this.camera.fov,
      bortle: this.settings?.bortleClass ?? 3,
      relativeScale: this.settings?.starRelativeScale ?? 0.65,
      absoluteScale: this.settings?.starAbsoluteScale ?? 0.55,
      extinction: atmosphereEnabled,
      zenith,
    });
    this.asterisms.setPlanetariumProjection(
      innerView,
      planetariumProjection,
      this.camera.fov,
      this.camera.aspect,
    );
    this.westernAsterisms.setPlanetariumProjection(
      innerView,
      planetariumProjection,
      this.camera.fov,
      this.camera.aspect,
    );
    this.starField.update(this.date, origin);
    this.starField.setProjection(viewpoint, 1, this.morph);
    const profile = contextProfile(this.chartTab, this.westernMode);
    this.starField.setVisibility({
      profile: profile.starFilter,
      enabled: Boolean(this.settings?.hideUninvolved && profile.allowHideUninvolved),
      center: innerView ? origin : { x: 0, y: 0, z: 0 },
      minimum: this.settings?.starDistanceMin ?? 1,
      maximum: this.settings?.starDistanceMax ?? 5_001,
    });
    this.asterisms.setDistanceRange(
      innerView ? origin : { x: 0, y: 0, z: 0 },
      this.settings?.starDistanceMin ?? 1,
      this.settings?.starDistanceMax ?? 5_001,
    );
    this.westernAsterisms.setDistanceRange(
      innerView ? origin : { x: 0, y: 0, z: 0 },
      this.settings?.starDistanceMin ?? 1,
      this.settings?.starDistanceMax ?? 5_001,
    );
    const earth = this.solarSystem.bodyPositions.get("Earth") ?? { x: 0, y: 0, z: 0 };
    this.solarSystem.update(
      this.date,
      origin,
      distance,
      this.camera,
      height,
      {
        morph: this.virtualRadiusMorph,
        earth: this.solarSystem.bodyPositions.get("Earth") ?? { x: 0, y: 0, z: 0 },
        involved: new Set(contextProfile(this.chartTab, this.westernMode).involvedBodies),
        longitudeFor: (id) => this.projection.longitudeFor(id),
        radius: PROJECTION_RING_RADIUS,
        hideUninvolved: Boolean(this.settings?.hideUninvolved &&
          contextProfile(this.chartTab, this.westernMode).allowHideUninvolved),
        visibilityThresholdAu: planetThreshold(this.settings?.planetVisibility ?? 1),
        visibilityCenter: innerView || this.currentPreset === "geocentric" ||
          this.currentPreset === "earth-view" ? earth : { x: 0, y: 0, z: 0 },
        visibilityCenterId: innerView || this.currentPreset === "geocentric" ||
          this.currentPreset === "earth-view" ? "Earth" : "Sun",
      },
      { enabled: innerView, projection: planetariumProjection },
    );
    if (performance.now() - this.lastVisibilityReport > 250) {
      this.lastVisibilityReport = performance.now();
      window.dispatchEvent(new CustomEvent(
        "xuanye-planet-visibility",
        { detail: this.solarSystem.visibilitySummary() },
      ));
    }
    this.projection.update(
      this.date,
      origin,
      earth,
      this.solarSystem.bodyPositions,
      distance,
      this.location,
      this.timeZone,
    );
    this.solarTerms.update(
      this.date,
      origin,
      earth,
      this.location.longitude,
      distance,
    );
    const chineseLabels = this.asterisms.update(
      origin,
      viewpoint,
      1,
      this.morph,
      this.camera,
      width,
      height,
      innerView,
      planetariumProjection,
      labelsDirty,
    );
    const westernLabels = this.westernAsterisms.update(
      origin,
      viewpoint,
      1,
      this.morph,
      this.camera,
      width,
      height,
      innerView,
      planetariumProjection,
      labelsDirty,
    );
    this.starLabels.setVisibility({
      minimum: this.settings?.starDistanceMin ?? 1,
      maximum: this.settings?.starDistanceMax ?? 5_001,
      center: innerView ? origin : { x: 0, y: 0, z: 0 },
      filter: profile.starFilter,
      enabled: Boolean(this.settings?.hideUninvolved && profile.allowHideUninvolved),
    });
    const westernCulture = this.settings?.skyCulture === "western";
    this.asterisms.setLinesVisible(
      !westernCulture && (this.settings?.constellationLines ?? true),
    );
    this.asterisms.setNamesVisible(
      !westernCulture && (this.settings?.constellationNames ?? true),
    );
    this.westernAsterisms.setLinesVisible(
      westernCulture && (this.settings?.constellationLines ?? true),
    );
    this.westernAsterisms.setNamesVisible(
      westernCulture && (this.settings?.constellationNames ?? true),
    );
    this.constellationArt.update({
      visible: Boolean(westernCulture && this.settings?.constellationArt),
      origin,
      center: viewpoint,
      planetarium: innerView,
      projection: planetariumProjection,
      fov: this.camera.fov,
      aspect: this.camera.aspect,
    });
    const starLabels = labelsDirty ? this.starLabels.candidates(
      this.date,
      origin,
      viewpoint,
      1,
      this.morph,
      this.camera,
      width,
      height,
      innerView,
      planetariumProjection,
      this.selectedStar,
    ) : [];
    const atmosphere = innerView && !starView && this.settings?.atmosphere
      ? Math.min(1, Math.max(0.04, 1 - (sunAltitude + 8) / 18)) : 1;
    this.starField.setAtmosphereVisibility(atmosphere);
    this.milkyWay.update({
      visible: innerView && !starView && Boolean(this.settings?.milkyWay),
      origin,
      center: viewpoint,
      projection: planetariumProjection,
      fov: this.camera.fov,
      aspect: this.camera.aspect,
      bortle: this.settings?.bortleClass ?? 3,
      sunAltitude,
      moonAltitude,
      atmosphere: this.settings?.atmosphere ?? true,
    });
    const dsoLabels = this.deepSky.update({
      visible: innerView && !starView && Boolean(this.settings?.deepSkyObjects),
      origin,
      center: viewpoint,
      planetarium: innerView,
      projection: planetariumProjection,
      fov: this.camera.fov,
      aspect: this.camera.aspect,
      bortle: this.settings?.bortleClass ?? 3,
      width,
      height,
      camera: this.camera,
      labelsDirty,
      sunAltitude,
      moonAltitude,
      atmosphere: this.settings?.atmosphere ?? true,
    });
    const photoLandscape = this.settings?.landscape === "photo";
    this.backdrop.update({
      enabled: innerView && !starView,
      projection: planetariumProjection,
      fov: this.camera.fov,
      width,
      height,
      camera: this.camera,
      zenith,
      ground: photoLandscape ||
        ((this.settings?.ground ?? true) && this.settings?.landscape === "flat"),
      atmosphere: this.settings?.atmosphere ?? true,
      sunAltitude,
      bortle: this.settings?.bortleClass ?? 3,
      groundColor: photoLandscape
        ? landscapeGroundColorForSunAltitude(sunAltitude) : undefined,
    });
    this.landscape.update({
      visible: innerView && !starView && photoLandscape,
      origin,
      center: viewpoint,
      south: horizontalDirectionEcliptic(this.date, this.location, 180, 0),
      west: horizontalDirectionEcliptic(this.date, this.location, 270, 0),
      zenith,
      projection: planetariumProjection,
      fov: this.camera.fov,
      aspect: this.camera.aspect,
      sunAltitude,
    });
    if (this.settings) {
      const overlaySettings = starView
        ? { ...this.settings, ground: false, atmosphere: false }
        : this.settings;
      this.planetarium.update(
        this.date,
        this.location,
        this.camera,
        width,
        height,
        overlaySettings,
        sunAltitude,
        this.chartTab,
        this.chartGuide,
        this.planetariumHighlight,
      );
    }
    if (labelsDirty) {
      const sceneLabels = [
        ...this.solarSystem.labelCandidates(this.camera, width, height),
        ...this.projection.labelCandidates(
          this.camera,
          width,
          height,
          innerView,
          planetariumProjection,
        ),
        ...chineseLabels,
        ...westernLabels,
        ...starLabels,
        ...dsoLabels,
      ];
      const baseCap = labelCap(this.settings?.labelDensity ?? 0.55);
      const cap = innerView ? fovLabelCap(baseCap, this.camera.fov) : baseCap;
      const available = Math.max(0, cap - this.planetarium.visibleLabelCount);
      const placements = layoutLabels(sceneLabels, { width, height }, available);
      applySceneLabelPlacements(sceneLabels, placements);
      this.visibleSceneLabels = placements.length + this.planetarium.visibleLabelCount;
    }
    if (this.selectedStar !== undefined) {
      this.starField.showSelection(this.selectedStar, this.date, origin, distance);
    }
    if (!this.cameraController.ensureFinite() || !this.starField.ensureFinite()) return;
    if (this.selftest === "ground") this.renderIsolatedGroundFrame();
    else this.renderer.render(this.scene, this.camera);
  }

  private renderIsolatedGroundFrame(): void {
    const hidden: THREE.Object3D[] = [];
    for (const child of this.scene.children) {
      if (child === this.backdrop.mesh || child === this.landscape.group || !child.visible) {
        continue;
      }
      hidden.push(child);
      child.visible = false;
    }
    const labelLayers = [
      this.starLabels.element,
      this.solarSystem.labels,
      this.asterisms.labels,
      this.westernAsterisms.labels,
      this.planetarium.element,
      this.deepSky.labels,
    ];
    labelLayers.forEach((element) => {
      element.hidden = true;
      element.style.display = "none";
    });
    try {
      this.renderer.render(this.scene, this.camera);
    } finally {
      hidden.forEach((child) => { child.visible = true; });
    }
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.starField.setPixelRatio(window.devicePixelRatio);
  }

  private handleClick(click: CameraPointerClick): void {
    const { event } = click;
    this.setPointer(event);
    const id = this.pickBody(event);
    if (id) {
      const definition = BODY_DEFINITIONS.find((item) => item.id === id);
      if (definition) this.selectBody(definition.id);
      else this.selectPoint(id as VirtualPointId);
      if (click.count === 2) this.flyToSelection();
      return;
    }
    const dso = this.pickDso(event);
    if (dso) {
      this.selectDso(dso);
      if (click.count === 2) this.centerSelection();
      return;
    }
    const starIndex = this.pickStar(event);
    if (starIndex === undefined) return;
    this.selectedStar = starIndex;
    this.labelRevision += 1;
    this.selectedBody = undefined;
    this.selectedPoint = undefined;
    this.selectedDso = undefined;
    this.selectedAsterism = undefined;
    this.deepSky.setSelected(undefined);
    this.solarSystem.setSelection(undefined);
    this.projection.clearHighlight();
    this.events.onSelection({ kind: "star", index: starIndex });
    if (click.count === 2) this.flyToSelection();
  }

  private pickBody(event: PointerEvent): SolarBodyId | VirtualPointId | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect();
    let best: { id: SolarBodyId | VirtualPointId; distance: number } | undefined;
    const pickable = [...this.projection.virtualPickable, ...this.solarSystem.pickable];
    for (const object of pickable) {
      if (!object.visible) continue;
      const projected = object.getWorldPosition(new THREE.Vector3()).project(this.camera);
      if (projected.z < -1 || projected.z > 1) continue;
      const x = rect.left + (projected.x + 1) * rect.width / 2;
      const y = rect.top + (1 - projected.y) * rect.height / 2;
      const distance = Math.hypot(event.clientX - x, event.clientY - y);
      if (distance < 6 && (!best || distance < best.distance)) {
        best = {
          id: object.userData.bodyId as SolarBodyId | VirtualPointId,
          distance,
        };
      }
    }
    return best?.id;
  }

  private pickStar(event: PointerEvent): number | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect();
    let bestIndex: number | undefined;
    let bestDistance = 6;
    const originWorld = eclipticToWorld(this.cameraController.origin);
    const year = this.decimalYear();
    const projected = new THREE.Vector3();
    for (let index = 0; index < this.stars.count; index += 1) {
      const star = this.stars.get(index);
      if (star.magnitude > STAR_VISIBILITY_LIMIT) continue;
      const position = this.stars.positionAt(index, year);
      const inner = this.mode === "huntian" && !this.huntianExterior;
      const center = inner ? this.cameraController.origin : { x: 0, y: 0, z: 0 };
      const starDistance = Math.hypot(
        position[0] - center.x,
        position[1] - center.y,
        position[2] - center.z,
      );
      if (!starDistanceVisible(
        starDistance,
        star.distanceSource,
        this.settings?.starDistanceMin ?? 1,
        this.settings?.starDistanceMax ?? 5_001,
      )) continue;
      const profile = contextProfile(this.chartTab, this.westernMode);
      if (this.settings?.hideUninvolved && profile.allowHideUninvolved &&
        profile.starFilter === "members" && !this.asterismHips.has(star.hip)) continue;
      if (this.settings?.hideUninvolved && profile.allowHideUninvolved &&
        profile.starFilter === "members-and-mansions" &&
        !this.asterismHips.has(star.hip) && !this.mansionHips.has(star.hip)) continue;
      const world = eclipticToWorld({ x: position[0], y: position[1], z: position[2] });
      projected.set(
        world.x - originWorld.x,
        world.y - originWorld.y,
        world.z - originWorld.z,
      );
      const screen = projectScreenPoint(
        projected,
        this.camera,
        rect.width,
        rect.height,
        this.mode === "huntian" && !this.huntianExterior,
        this.settings?.planetariumProjection ?? "perspective",
      );
      if (!screen.visible) continue;
      const x = rect.left + screen.x;
      const y = rect.top + screen.y;
      const distance = Math.hypot(event.clientX - x, event.clientY - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  private pickDso(event: PointerEvent): DeepSkyObject | undefined {
    const inner = this.mode === "huntian" && !this.huntianExterior;
    if (!inner || !this.settings?.deepSkyObjects) return undefined;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const origin = this.cameraController.origin;
    return this.deepSky.pick(event.clientX - rect.left, event.clientY - rect.top, {
      visible: true,
      origin,
      center: origin,
      planetarium: true,
      projection: this.settings.planetariumProjection,
      fov: this.camera.fov,
      aspect: this.camera.aspect,
      bortle: this.settings.bortleClass,
      width: rect.width,
      height: rect.height,
      camera: this.camera,
      labelsDirty: false,
    });
  }

  private handlePointerMove(event: PointerEvent): void {
    const hovered = this.pickBody(event);
    const body = BODY_DEFINITIONS.some((item) => item.id === hovered)
      ? hovered as SolarBodyId : undefined;
    if (body !== this.hoveredBody) {
      this.hoveredBody = body;
      this.labelRevision += 1;
    }
    this.solarSystem.setHovered(body);
    this.events.onBodyHover(hovered);
    if (!this.projection.group.visible) {
      this.events.onMansionHover(undefined, undefined, { x: 0, y: 0 });
      return;
    }
    this.setPointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.projection.mansionLabels, false)[0];
    const mansion = hit?.object.userData.mansion as MansionDefinition | undefined;
    const longitude = mansion
      ? this.projection.mansionActualLongitude(mansion, this.date)
      : undefined;
    this.events.onMansionHover(
      mansion,
      longitude,
      { x: event.clientX, y: event.clientY },
    );
  }

  private selectBody(id: SolarBodyId): void {
    this.selectedStar = undefined;
    this.labelRevision += 1;
    this.selectedPoint = undefined;
    this.selectedDso = undefined;
    this.selectedAsterism = undefined;
    this.deepSky.setSelected(undefined);
    this.selectedBody = id;
    this.starField.clearSelection();
    this.solarSystem.setSelection(id);
    this.projection.setHighlight("body", id);
    this.events.onSelection({ kind: "body", id });
  }

  private selectPoint(id: VirtualPointId | "Ziqi"): void {
    this.selectedStar = undefined;
    this.labelRevision += 1;
    this.selectedBody = undefined;
    this.selectedPoint = id;
    this.selectedDso = undefined;
    this.selectedAsterism = undefined;
    this.deepSky.setSelected(undefined);
    this.starField.clearSelection();
    this.solarSystem.setSelection(undefined);
    this.projection.setHighlight("body", id);
    this.events.onSelection({ kind: "point", id });
  }

  private selectDso(object: DeepSkyObject): void {
    this.selectedStar = undefined;
    this.selectedBody = undefined;
    this.selectedPoint = undefined;
    this.selectedDso = object;
    this.selectedAsterism = undefined;
    this.starField.clearSelection();
    this.solarSystem.setSelection(undefined);
    this.projection.clearHighlight();
    this.deepSky.setSelected(object);
    this.labelRevision += 1;
    this.events.onSelection({ kind: "dso", object });
  }

  private selectionHorizontal(): { altitude: number; azimuth: number } | undefined {
    if (this.selectedBody) {
      const definition = BODY_DEFINITIONS.find((item) => item.id === this.selectedBody);
      if (!definition) return undefined;
      const details = bodyDetails(definition, this.date, this.location);
      return { altitude: details.altitude, azimuth: details.azimuth };
    }
    if (this.selectedDso) {
      return equatorialHorizontal(
        this.selectedDso.ra * 180 / Math.PI,
        this.selectedDso.dec * 180 / Math.PI,
        this.date,
        this.location,
      );
    }
    if (this.selectedStar !== undefined) {
      const value = this.stars.positionAt(this.selectedStar, this.decimalYear());
      const equatorial = eclipticToEquatorialJ2000({ x: value[0], y: value[1], z: value[2] });
      const radius = Math.hypot(equatorial.x, equatorial.y, equatorial.z) || 1;
      return equatorialHorizontal(
        Math.atan2(equatorial.y, equatorial.x) * 180 / Math.PI,
        Math.asin(equatorial.z / radius) * 180 / Math.PI,
        this.date,
        this.location,
      );
    }
    if (this.selectedAsterism) {
      const members = [...new Set(this.selectedAsterism.lines.flat())]
        .map((hip) => this.stars.getByHip(hip)).filter((star) => star !== undefined);
      if (!members.length) return undefined;
      const direction = members.reduce((sum, star) => ({
        x: sum.x + star.position[0] / Math.hypot(...star.position),
        y: sum.y + star.position[1] / Math.hypot(...star.position),
        z: sum.z + star.position[2] / Math.hypot(...star.position),
      }), { x: 0, y: 0, z: 0 });
      const equatorial = eclipticToEquatorialJ2000(direction);
      const radius = Math.hypot(equatorial.x, equatorial.y, equatorial.z) || 1;
      return equatorialHorizontal(
        Math.atan2(equatorial.y, equatorial.x) * 180 / Math.PI,
        Math.asin(equatorial.z / radius) * 180 / Math.PI,
        this.date,
        this.location,
      );
    }
    return undefined;
  }

  private resolveViewpoint(): Cartesian {
    if (this.viewpointKind === "sun") return { x: 0, y: 0, z: 0 };
    if (this.viewpointKind === "camera") return { ...this.cameraController.origin };
    if (this.viewpointKind === "selected" && this.selectedStar !== undefined) {
      const [x, y, z] = this.stars.positionAt(this.selectedStar, this.decimalYear());
      return { x, y, z };
    }
    return this.solarSystem.bodyPositions.get("Earth") ?? { x: 0, y: 0, z: 0 };
  }

  private lookAtNorthPole(): void {
    const pole = RotateVector(
      Rotation_EQD_EQJ(this.date),
      new Vector(0, 0, 1, MakeTime(this.date)),
    );
    const direction = equatorialToEclipticJ2000(pole);
    const earth = this.solarSystem.bodyPositions.get("Earth") ?? { x: 0, y: 0, z: 0 };
    this.cameraController.lookFrom(earth, direction);
  }

  private setPointer(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private decimalYear(): number {
    return this.date.getUTCFullYear() + this.date.getUTCMonth() / 12;
  }

  private addBackgroundDust(): void {
    const positions = new Float32Array(1_200 * 3);
    for (let index = 0; index < positions.length; index += 3) {
      const radius = 1_500 + Math.random() * 3_000;
      const longitude = Math.random() * Math.PI * 2;
      const latitude = Math.asin(Math.random() * 2 - 1);
      positions[index] = radius * Math.cos(latitude) * Math.cos(longitude);
      positions[index + 1] = radius * Math.sin(latitude);
      positions[index + 2] = radius * Math.cos(latitude) * Math.sin(longitude);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x52647a,
      size: 1.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.backgroundDust = new THREE.Points(geometry, material);
    this.scene.add(this.backgroundDust);
  }

  private updatePlanetariumMode(): void {
    const inner = this.mode === "huntian" && !this.huntianExterior;
    this.cameraController.setPlanetarium(inner);
    this.planetarium.setVisible(inner);
    this.container.classList.toggle("is-planetarium", inner);
  }
}
