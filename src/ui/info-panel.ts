import {
  Body,
  DefineStar,
  EquatorFromVector,
  Horizon,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  SearchHourAngle,
  SearchRiseSet,
  Vector,
} from "astronomy-engine";

import type { ChineseSkyculture, StarCatalog } from "../data/catalog";
import {
  AU_PER_PARSEC,
  LIGHT_YEARS_PER_PARSEC,
  cartesianToSpherical,
  eclipticJ2000ToEclipticOfDate,
  eclipticToEquatorialJ2000,
} from "../lib/coordinates";
import {
  BODY_DEFINITIONS,
  bodyDetails,
  type ObserverLocation,
  type SolarBodyId,
} from "../lib/ephemeris";
import type { SceneSelection } from "../scene/celestial-scene";
import {
  bodyName,
  hasNoAncientName,
  resolveNameStyle,
  starName,
} from "../lib/names";
import type { NameStyle } from "../lib/settings-store";
import type { ChartTabId } from "./charts/types";
import { deepSkyTypeLabel } from "../data/deep-sky";

function degrees(value: number, digits = 3): string {
  return `${value.toFixed(digits)}°`;
}

function distance(value: number, unit: string): string {
  if (value === 0) return `0 ${unit}`;
  if (Math.abs(value) < 0.001 || Math.abs(value) >= 100_000) {
    return `${value.toExponential(3)} ${unit}`;
  }
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 4 })} ${unit}`;
}

export class InfoPanel {
  readonly element: HTMLElement;

  private selection?: SceneSelection;
  private date = new Date();
  private location: ObserverLocation = { latitude: 39.93, longitude: 116.41 };
  private readonly memberships = new Map<number, string[]>();
  private nameStyle: NameStyle = "auto";
  private tab: ChartTabId = "observation";
  private virtualRadius = false;
  private planetarium = false;

  constructor(
    private readonly stars: StarCatalog,
    private readonly skyculture: ChineseSkyculture,
    private readonly onFly: () => void,
  ) {
    this.element = document.createElement("section");
    this.element.className = "info-panel";
    this.element.dataset.dockPanel = "info";
    this.element.setAttribute("aria-live", "polite");
    for (const asterism of skyculture.asterisms) {
      const hips = new Set(asterism.lines.flat());
      for (const hip of hips) {
        const entries = this.memberships.get(hip) ?? [];
        entries.push(asterism.nameZh);
        this.memberships.set(hip, entries);
      }
    }
    this.renderEmpty();
  }

  setSelection(selection: SceneSelection): void {
    this.selection = selection;
    this.render();
  }

  setDate(date: Date): void {
    this.date = date;
    if (this.selection) this.render();
  }

  setLocation(location: ObserverLocation): void {
    this.location = location;
    if (this.selection) this.render();
  }

  setNaming(nameStyle: NameStyle, tab: ChartTabId): void {
    this.nameStyle = nameStyle;
    this.tab = tab;
    if (this.selection) this.render();
  }

  setVirtualRadius(enabled: boolean): void {
    this.virtualRadius = enabled;
    if (this.selection) this.render();
  }

  setPlanetarium(enabled: boolean): void {
    this.planetarium = enabled;
    if (this.selection) this.render();
  }

  private render(): void {
    if (!this.selection) return;
    if (this.selection.kind === "body") this.renderBody(this.selection.id);
    else if (this.selection.kind === "point") this.renderPoint(this.selection.id);
    else if (this.selection.kind === "asterism") {
      this.renderAsterism(this.selection.asterism);
    }
    else if (this.selection.kind === "dso") this.renderDso(this.selection.object);
    else this.renderStar(this.selection.index);
  }

  private renderDso(object: Extract<SceneSelection, { kind: "dso" }>["object"]): void {
    this.renderCard({
      kicker: "DEEP SKY · 深空天体",
      title: object.nameZh ?? object.primaryId,
      subtitle: object.nameZh ? `${object.primaryId} · ${object.name}` : object.name,
      rows: [
        ["类型", deepSkyTypeLabel(object.type)],
        ["编号", object.ids.filter((id) => !id.startsWith("NAME ")).join(" · ") || "—"],
        ["赤经赤纬 · J2000",
          `${degrees(object.ra * 180 / Math.PI)}  ${degrees(object.dec * 180 / Math.PI)}`],
        ["视星等", object.magnitude > 0 ? object.magnitude.toFixed(2) : "未载"],
        ["视尺寸", object.majorAxis > 0
          ? `${(object.majorAxis * 10_800 / Math.PI).toFixed(1)}′ × ` +
            `${(object.minorAxis * 10_800 / Math.PI).toFixed(1)}′` : "未载"],
        ["形态", object.morphology || "—"],
      ],
      canFly: false,
    });
  }

  private renderAsterism(asterism: ChineseSkyculture["asterisms"][number]): void {
    const members = [...new Set(asterism.lines.flat())]
      .map((hip) => this.stars.getByHip(hip)).filter((star) => star !== undefined);
    const known = members.filter((star) => star.distanceSource !== "unknown")
      .map((star) => Math.hypot(...star.position));
    const minimum = known.length ? Math.min(...known) : undefined;
    const maximum = known.length ? Math.max(...known) : undefined;
    const rows: Array<[string, string]> = [
      ["成员", `${members.length} 颗`],
      ["深度跨度", minimum === undefined || maximum === undefined ? "无已知距离" :
        `${minimum.toFixed(2)}–${maximum.toFixed(2)} pc · ` +
        `${(maximum / minimum).toFixed(1)}×`],
      ...members.map((star): [string, string] => {
        const name = starName(
          star.hip,
          resolveNameStyle(this.nameStyle, this.tab, "star"),
          this.stars.bayerNames[String(star.hip)],
          this.skyculture,
          this.stars.names[String(star.hip)],
        );
        const memberDistance = star.distanceSource === "unknown" ? "距离未知" :
          `${Math.hypot(...star.position).toFixed(2)} pc`;
        return [name, `HIP ${star.hip} · ${star.magnitude.toFixed(2)} 等 · ${memberDistance}`];
      }),
    ];
    this.renderCard({
      kicker: "中国星官 · ASTERISM",
      title: asterism.nameZh,
      subtitle: asterism.nameEn,
      rows,
      canFly: false,
    });
  }

  private renderPoint(id: "NorthNode" | "SouthNode" | "Lilith" | "Ziqi"): void {
    const cards = {
      NorthNode: {
        title: "罗睺",
        subtitle: "Rahu · North Node",
        rows: [
          ["天文对应", "月球轨道升交点"],
          ["节点关系", "与计都相差 180°"],
          ["引擎定义", "NorthNode 对应罗睺"],
        ] as Array<[string, string]>,
      },
      SouthNode: {
        title: "计都",
        subtitle: "Ketu · South Node",
        rows: [
          ["天文对应", "月球轨道降交点"],
          ["节点关系", "与罗睺相差 180°"],
          ["引擎定义", "SouthNode 对应计都"],
        ] as Array<[string, string]>,
      },
      Lilith: {
        title: "月孛",
        subtitle: "Lunar Apogee · Lilith",
        rows: [
          ["天文对应", "月球轨道平均远地点"],
          ["显示方式", "空心虚点与虚线投影"],
        ] as Array<[string, string]>,
      },
      Ziqi: {
        title: "紫气",
        subtitle: "Ziqi · calculated cycle",
        rows: [
          ["说明", "无物理对应的推算周期"],
          ["三维定位", "无实体位置，不执行飞行"],
        ] as Array<[string, string]>,
      },
    } as const;
    const card = cards[id];
    this.renderCard({
      kicker: "七政四余 · 虚点",
      title: card.title,
      subtitle: card.subtitle,
      rows: [...card.rows],
      canFly: id !== "Ziqi",
    });
  }

  private renderStar(index: number): void {
    const star = this.stars.get(index);
    const year = this.date.getUTCFullYear() + this.date.getUTCMonth() / 12;
    const position = this.stars.positionAt(index, year);
    const ecliptic = { x: position[0], y: position[1], z: position[2] };
    const sphericalJ2000 = cartesianToSpherical(ecliptic);
    const equatorialJ2000 = eclipticToEquatorialJ2000(ecliptic);
    const eqjVector = new Vector(
      equatorialJ2000.x,
      equatorialJ2000.y,
      equatorialJ2000.z,
      MakeTime(this.date),
    );
    const j2000Angles = EquatorFromVector(eqjVector);
    const ofDateVector = RotateVector(Rotation_EQJ_EQD(this.date), eqjVector);
    const ofDateAngles = EquatorFromVector(ofDateVector);
    const eclipticOfDate = cartesianToSpherical(
      eclipticJ2000ToEclipticOfDate(ecliptic, this.date),
    );
    const observer = new Observer(this.location.latitude, this.location.longitude, 0);
    const horizontal = Horizon(
      this.date,
      observer,
      ofDateAngles.ra,
      ofDateAngles.dec,
      "normal",
    );
    const english = star.hip ? this.stars.names[String(star.hip)] : undefined;
    const absoluteMagnitude = star.magnitude - 5 * (Math.log10(sphericalJ2000.radius) - 1);
    const memberships = star.hip ? this.memberships.get(star.hip) ?? [] : [];
    let starEvents: Array<[string, string]> = [];
    if (this.planetarium) {
      DefineStar(
        Body.Star1,
        j2000Angles.ra,
        j2000Angles.dec,
        Math.max(1, sphericalJ2000.radius * LIGHT_YEARS_PER_PARSEC),
      );
      const eventObserver = new Observer(
        this.location.latitude,
        this.location.longitude,
        this.location.elevation ?? 0,
      );
      const eventTime = (value: Date | undefined) => value
        ? new Intl.DateTimeFormat("zh-CN", {
          hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit",
        }).format(value)
        : "无";
      const rise = SearchRiseSet(Body.Star1, eventObserver, 1, this.date, 2)?.date;
      const set = SearchRiseSet(Body.Star1, eventObserver, -1, this.date, 2)?.date;
      const transit = SearchHourAngle(
        Body.Star1,
        eventObserver,
        0,
        this.date,
      ).time.date;
      starEvents = [[
        "升起 / 中天 / 落下",
        `${eventTime(rise)} / ${eventTime(transit)} / ${eventTime(set)}`,
      ]];
    }
    this.renderCard({
      kicker: "GAIA DR3 · 恒星",
      title: starName(
        star.hip,
        resolveNameStyle(this.nameStyle, this.tab, "star"),
        this.stars.bayerNames[String(star.hip)],
        this.skyculture,
        english,
      ),
      subtitle: english || (star.hip ? `HIP ${star.hip}` : "Gaia source"),
      rows: [
        ["HIP", star.hip ? String(star.hip) : "—"],
        ["赤经赤纬 · J2000", `${degrees(j2000Angles.ra * 15)}  ${degrees(j2000Angles.dec)}`],
        ["赤经赤纬 · 当日", `${degrees(ofDateAngles.ra * 15)}  ${degrees(ofDateAngles.dec)}`],
        [
          "黄经黄纬 · 当日",
          `${degrees(eclipticOfDate.longitude)}  ${degrees(eclipticOfDate.latitude)}`,
        ],
        ["距离", star.distanceSource === "unknown" ? "未知（宣夜层按 1000 pc 示意）" :
          `${distance(sphericalJ2000.radius, "pc")} · ` +
          `${distance(sphericalJ2000.radius * LIGHT_YEARS_PER_PARSEC, "光年")}`],
        ["距离 · 天文单位", star.distanceSource === "unknown" ? "—" :
          distance(sphericalJ2000.radius * AU_PER_PARSEC, "AU")],
        ["星等", star.distanceSource === "unknown" ? `视 ${star.magnitude.toFixed(2)}` :
          `视 ${star.magnitude.toFixed(2)} · 绝对 ${absoluteMagnitude.toFixed(2)}`],
        ["色指数", star.colorIndex.toFixed(3)],
        [
          "地平坐标",
          `高度 ${degrees(horizontal.altitude)} · 方位 ${degrees(horizontal.azimuth)}`,
        ],
        ["中国星官", memberships.length ? memberships.join("、") : "未载于所用线表"],
        ...starEvents,
      ],
    });
  }

  private renderBody(id: SolarBodyId): void {
    const definition = BODY_DEFINITIONS.find((item) => item.id === id)!;
    if (id === "Earth") {
      this.renderCard({
        kicker: "SOLAR SYSTEM · 观察基点",
        title: bodyName("Earth", resolveNameStyle(this.nameStyle, this.tab)),
        subtitle: "Earth · ⊕",
        rows: [
          ["参考系", "日心 J2000 平黄道"],
          ["观测地", `${degrees(this.location.latitude)} · ${degrees(this.location.longitude)}`],
          ["说明", "当前地心视角与投影线起点"],
        ],
      });
      return;
    }
    const details = bodyDetails(definition, this.date, this.location);
    const observer = new Observer(
      this.location.latitude,
      this.location.longitude,
      this.location.elevation ?? 0,
    );
    const eventTime = (date: Date | undefined) => date
      ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit",
      }).format(date)
      : "无";
    const rise = this.planetarium
      ? SearchRiseSet(definition.body, observer, 1, this.date, 2)?.date : undefined;
    const set = this.planetarium
      ? SearchRiseSet(definition.body, observer, -1, this.date, 2)?.date : undefined;
    const transit = this.planetarium
      ? SearchHourAngle(definition.body, observer, 0, this.date).time.date : undefined;
    this.renderCard({
      kicker: "SOLAR SYSTEM · 天体",
      title: bodyName(id, resolveNameStyle(this.nameStyle, this.tab)),
      subtitle: `${definition.id} · ${definition.symbol}`,
      rows: [
        ["赤经赤纬 · 当日", `${degrees(details.ra)}  ${degrees(details.dec)}`],
        ["黄经黄纬 · 当日", `${degrees(details.longitude)}  ${degrees(details.latitude)}`],
        ["黄经 · J2000 面", degrees(details.j2000Longitude)],
        ["地心距离", distance(details.distanceAu, "AU")],
        ["视星等", details.magnitude === undefined ? "—" : details.magnitude.toFixed(2)],
        ["地平坐标", `高度 ${degrees(details.altitude)} · 方位 ${degrees(details.azimuth)}`],
        ...(this.planetarium ? [
          ["地平高度 / 方位", `${degrees(details.altitude)} / ${degrees(details.azimuth)}`],
          ["升起 / 中天 / 落下",
            `${eventTime(rise)} / ${eventTime(transit)} / ${eventTime(set)}`],
        ] as Array<[string, string]> : []),
        ["中国名称", definition.nameZh],
        ...(this.virtualRadius ? [["显示", "同心圆对照中，位置距离为虚拟"]] as
          Array<[string, string]> : []),
        ...(hasNoAncientName(id) ? [["古名", "近代发现，无古名"]] as
          Array<[string, string]> : []),
      ],
    });
  }

  private renderCard(card: {
    kicker: string;
    title: string;
    subtitle: string;
    rows: Array<[string, string]>;
    canFly?: boolean;
  }): void {
    this.element.innerHTML = `
      <button class="info-close" type="button" aria-label="关闭信息">×</button>
      <span class="section-kicker">${card.kicker}</span>
      <h2>${card.title}</h2>
      <p class="object-subtitle">${card.subtitle}</p>
      <dl>${card.rows.map(([term, value]) =>
        `<div><dt>${term}</dt><dd>${value}</dd></div>`).join("")}</dl>
      ${card.canFly === false ? "" :
        '<button class="info-fly quiet-button" type="button">飞往</button>'}
    `;
    this.element.classList.add("has-selection");
    this.element.querySelector(".info-close")!.addEventListener("click", () => {
      this.selection = undefined;
      this.renderEmpty();
    });
    this.element.querySelector(".info-fly")?.addEventListener("click", this.onFly);
  }

  private renderEmpty(): void {
    this.element.classList.remove("has-selection");
    this.element.innerHTML = `
      <span class="section-kicker">天体志 · OBJECT RECORD</span>
      <p class="empty-info">
        点选恒星或行星，查看位置、距离、星等与中国星官信息。
      </p>
    `;
  }
}
