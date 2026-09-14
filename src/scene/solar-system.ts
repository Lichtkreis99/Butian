import * as THREE from "three";
import { RotationAxis } from "astronomy-engine";

import {
  METERS_PER_PARSEC,
  AU_PER_PARSEC,
  addCartesian,
  eclipticToWorld,
  equatorialToEclipticJ2000,
  worldToEcliptic,
  type Cartesian,
} from "../lib/coordinates";
import {
  BODY_DEFINITIONS,
  geocentricPositionParsecs,
  heliocentricPositionParsecs,
  type BodyDefinition,
  type SolarBodyId,
} from "../lib/ephemeris";
import { bodyName, type ConcreteNameStyle } from "../lib/names";
import { apparentMagnitudeFromCamera } from "../lib/planet-brightness";
import { virtualRadiusPosition } from "../lib/virtual-radius";
import type { PlanetariumProjection } from "../lib/settings-store";
import { planetFade } from "../lib/visibility";
import { estimateLabelSize, LABEL_PRIORITY } from "../lib/label-layout";
import type { SceneLabelCandidate } from "./scene-labels";

const ORBIT_SAMPLES = 144;
const RADII_KM: Record<SolarBodyId, number> = {
  Sun: 696_340,
  Mercury: 2_439.7,
  Venus: 6_051.8,
  Earth: 6_371,
  Moon: 1_737.4,
  Mars: 3_389.5,
  Jupiter: 69_911,
  Saturn: 58_232,
  Uranus: 25_362,
  Neptune: 24_622,
  Pluto: 1_188.3,
};

const sharedSphere = new THREE.SphereGeometry(1, 64, 32);

export class SolarSystemLayer {
  readonly group = new THREE.Group();
  readonly labels = document.createElement("div");
  readonly pickable: THREE.Object3D[] = [];
  readonly bodyPositions = new Map<SolarBodyId, Cartesian>();

  private readonly markers = new Map<SolarBodyId, THREE.Sprite>();
  private readonly surfaces = new Map<SolarBodyId, THREE.Mesh>();
  private readonly loadedTextures = new Set<SolarBodyId>();
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly sunLight = new THREE.PointLight(0xffe3ad, 3.2, 0, 1.8);
  private readonly selectionMarker: THREE.Sprite;
  private readonly orbitLines = new Map<SolarBodyId, THREE.Line>();
  private readonly labelEntries = new Map<SolarBodyId, {
    element: HTMLSpanElement;
    measuredText: string;
    width: number;
    height: number;
  }>();
  private grid!: THREE.LineSegments;
  private orbitAnchorYear = Number.NaN;
  private orbitsEnabled = true;
  private positionTimestamp = Number.NaN;
  private lastOrbitOrigin: Cartesian = { x: Number.NaN, y: Number.NaN, z: Number.NaN };
  private involved = new Set<string>();
  private labelAll = true;
  private involvedOnly = true;
  private nameStyle: ConcreteNameStyle = "modern-zh";
  private hovered?: SolarBodyId;
  private labelsEnabled = true;
  private visibilityCenterId: SolarBodyId = "Sun";

  constructor() {
    this.group.name = "Solar system";
    this.labels.className = "body-labels";
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.strokeStyle = "#f0ca79";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(32, 32, 25, 0, Math.PI * 2);
    context.stroke();
    this.selectionMarker = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      depthTest: false,
      transparent: true,
    }));
    this.selectionMarker.visible = false;
    this.selectionMarker.renderOrder = 30;
    this.group.add(this.selectionMarker);
    this.group.add(this.sunLight);
    this.createGrid();
    for (const definition of BODY_DEFINITIONS) {
      const marker = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTexture(),
        color: definition.color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }));
      marker.userData.bodyId = definition.id;
      marker.name = `${definition.nameZh} ${definition.id}`;
      this.markers.set(definition.id, marker);
      this.pickable.push(marker);
      this.group.add(marker);
      const label = document.createElement("span");
      label.dataset.bodyLabel = definition.id;
      this.labels.append(label);
      this.labelEntries.set(definition.id, {
        element: label,
        measuredText: "",
        width: 0,
        height: 0,
      });
      this.createSurface(definition.id);
      if (definition.id !== "Sun") this.createOrbit(definition);
    }
  }

  update(
    date: Date,
    origin: Cartesian,
    cameraDistance: number,
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
    comparison?: {
      morph: number;
      earth: Cartesian;
      involved: ReadonlySet<string>;
      longitudeFor(id: string): number | undefined;
      radius: number;
      hideUninvolved: boolean;
      visibilityThresholdAu: number;
      visibilityCenter: Cartesian;
      visibilityCenterId: SolarBodyId;
    },
    planetarium?: { enabled: boolean; projection: PlanetariumProjection },
  ): void {
    if (comparison) this.visibilityCenterId = comparison.visibilityCenterId;
    const gridPosition = eclipticToWorld({ x: -origin.x, y: -origin.y, z: -origin.z });
    this.grid.position.set(gridPosition.x, gridPosition.y, gridPosition.z);
    if (date.getTime() !== this.positionTimestamp) {
      this.positionTimestamp = date.getTime();
      for (const definition of BODY_DEFINITIONS) {
        this.bodyPositions.set(definition.id, heliocentricPositionParsecs(definition, date));
      }
    }
    const cameraOffset = worldToEcliptic(camera.position);
    const cameraLocation = addCartesian(origin, cameraOffset);
    const earth = this.bodyPositions.get("Earth") ?? { x: 0, y: 0, z: 0 };
    for (const definition of BODY_DEFINITIONS) {
      const position = this.bodyPositions.get(definition.id)!;
      const longitude = comparison?.longitudeFor(definition.id);
      const target = comparison && definition.id !== "Earth" &&
        comparison.involved.has(definition.id) && longitude !== undefined
        ? virtualRadiusPosition(comparison.earth, longitude, comparison.radius)
        : position;
      const displayPosition = {
        x: THREE.MathUtils.lerp(position.x, target.x, comparison?.morph ?? 0),
        y: THREE.MathUtils.lerp(position.y, target.y, comparison?.morph ?? 0),
        z: THREE.MathUtils.lerp(position.z, target.z, comparison?.morph ?? 0),
      };
      const relative = {
        x: displayPosition.x - origin.x,
        y: displayPosition.y - origin.y,
        z: displayPosition.z - origin.z,
      };
      const world = eclipticToWorld(relative);
      const marker = this.markers.get(definition.id)!;
      const alwaysVisible = definition.id === "Sun" || definition.id === "Moon" ||
        definition.id === comparison?.visibilityCenterId;
      const involvedVisible = !comparison?.hideUninvolved || alwaysVisible ||
        comparison.involved.has(definition.id);
      const thresholdFade = comparison ? planetFade(
        Math.hypot(
          position.x - comparison.visibilityCenter.x,
          position.y - comparison.visibilityCenter.y,
          position.z - comparison.visibilityCenter.z,
        ) * AU_PER_PARSEC,
        comparison.visibilityThresholdAu,
      ) : 1;
      const bodyAlpha = involvedVisible && (alwaysVisible || thresholdFade > 0)
        ? (alwaysVisible ? 1 : thresholdFade) : 0;
      marker.visible = bodyAlpha > 0.001;
      marker.userData.visibilityAlpha = bodyAlpha;
      marker.position.set(world.x, world.y, world.z);
      if (planetarium?.enabled && planetarium.projection !== "perspective") {
        this.warpForPlanetarium(marker.position, camera, planetarium.projection);
      }
      if (definition.id === "Sun") this.sunLight.position.copy(marker.position);
      const radius = RADII_KM[definition.id] * 1_000 / METERS_PER_PARSEC;
      const bodyDistance = Math.max(marker.position.distanceTo(camera.position), 1e-15);
      const focalLength = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      const projectedPixels = radius * 2 / bodyDistance * focalLength;
      const magnitude = apparentMagnitudeFromCamera(
        definition,
        date,
        position,
        cameraLocation,
        earth,
      );
      marker.userData.apparentMagnitude = magnitude;
      const visibilityFloor = definition.id === "Uranus" || definition.id === "Neptune"
        ? 4 : 2.4;
      const glowPixels = Math.max(visibilityFloor, Math.min(18, 11 - magnitude * 0.7));
      const glowScale = glowPixels / focalLength * bodyDistance;
      marker.scale.setScalar(glowScale * (this.hovered === definition.id ? 1.65 : 1));
      const surface = this.surfaces.get(definition.id);
      if (surface) {
        const blend = THREE.MathUtils.smoothstep(projectedPixels, 3, 5);
        surface.position.copy(marker.position);
        surface.scale.setScalar(radius);
        surface.visible = blend * bodyAlpha > 0.001;
        (surface.material as THREE.Material).opacity = blend * bodyAlpha;
        if (surface.material instanceof THREE.ShaderMaterial) {
          surface.material.uniforms.surfaceOpacity!.value = blend * bodyAlpha;
          if (surface.material.uniforms.sunPosition) {
            surface.material.uniforms.sunPosition.value.copy(this.sunLight.position);
          }
          const glow = surface.getObjectByName("Sun glow") as THREE.Sprite | undefined;
          if (glow) (glow.material as THREE.SpriteMaterial).opacity = blend * bodyAlpha;
        }
        const clouds = surface.getObjectByName("Earth clouds") as THREE.Mesh | undefined;
        if (clouds) {
          const cloudMaterial = clouds.material as THREE.ShaderMaterial;
          cloudMaterial.uniforms.surfaceOpacity!.value = blend * bodyAlpha;
          cloudMaterial.uniforms.sunPosition!.value.copy(this.sunLight.position);
        }
        const ring = surface.getObjectByName("Saturn ring") as THREE.Mesh | undefined;
        if (ring) (ring.material as THREE.MeshStandardMaterial).opacity = blend * bodyAlpha;
        (marker.material as THREE.SpriteMaterial).opacity = (1 - blend) * bodyAlpha;
        if (blend > 0 && !this.loadedTextures.has(definition.id)) {
          this.loadSurfaceTexture(definition.id, surface);
        }
        this.orientSurface(definition.id, surface, date);
      }
      if (this.selectionMarker.userData.bodyId === definition.id) {
        this.selectionMarker.position.copy(marker.position);
        this.selectionMarker.scale.setScalar(Math.max(cameraDistance * 0.024, glowScale * 2.4));
      }
    }
    const orbitOpacity = 1 - (comparison?.morph ?? 0);
    for (const [id, orbit] of this.orbitLines) {
      const material = orbit.material as THREE.LineBasicMaterial;
      const alpha = this.markers.get(id)?.userData.visibilityAlpha as number ?? 1;
      material.opacity = 0.16 * orbitOpacity * alpha;
      orbit.visible = this.orbitsEnabled && orbitOpacity * alpha > 0.01;
    }
    const anchorYear = date.getUTCFullYear();
    if (anchorYear !== this.orbitAnchorYear) {
      this.orbitAnchorYear = anchorYear;
      this.updateOrbits(date, origin);
    } else if (
      origin.x !== this.lastOrbitOrigin.x ||
      origin.y !== this.lastOrbitOrigin.y ||
      origin.z !== this.lastOrbitOrigin.z
    ) {
      this.positionOrbits(origin);
    }
  }

  visibilitySummary(): { visible: string[]; count: number } {
    const visible = BODY_DEFINITIONS.filter((definition) =>
      definition.id !== this.visibilityCenterId && this.markers.get(definition.id)?.visible)
      .map((definition) => definition.id);
    return { visible, count: visible.length };
  }

  private warpForPlanetarium(
    position: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    projection: PlanetariumProjection,
  ): void {
    const distance = Math.max(position.distanceTo(camera.position), 1e-12);
    const cameraDirection = position.clone().sub(camera.position).normalize()
      .applyQuaternion(camera.quaternion.clone().invert());
    const forward = -cameraDirection.z;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    let x: number;
    let y: number;
    if (projection === "stereographic") {
      const scale = Math.tan(halfFov / 2);
      x = cameraDirection.x / Math.max(1e-8, 1 + forward) / scale / camera.aspect;
      y = cameraDirection.y / Math.max(1e-8, 1 + forward) / scale;
    } else {
      const theta = Math.acos(Math.min(1, Math.max(-1, forward)));
      const radial = Math.hypot(cameraDirection.x, cameraDirection.y) || 1;
      x = cameraDirection.x / radial * theta / halfFov / camera.aspect;
      y = cameraDirection.y / radial * theta / halfFov;
    }
    const tangent = Math.tan(halfFov);
    const cameraPosition = new THREE.Vector3(
      x * distance * tangent * camera.aspect,
      y * distance * tangent,
      -distance,
    ).applyQuaternion(camera.quaternion).add(camera.position);
    position.copy(cameraPosition);
  }

  private glowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.12, "rgba(255,255,255,.95)");
    glow.addColorStop(0.35, "rgba(255,255,255,.42)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  setLabelOptions(options: {
    involved: readonly string[];
    labelAll: boolean;
    involvedOnly: boolean;
    style: ConcreteNameStyle;
    density: number;
    enabled: boolean;
  }): void {
    this.involved = new Set(options.involved);
    this.labelAll = options.labelAll;
    this.involvedOnly = options.involvedOnly;
    this.nameStyle = options.style;
    this.labelsEnabled = options.enabled;
  }

  setOrbitsVisible(visible: boolean): void {
    this.orbitsEnabled = visible;
    if (!visible) {
      for (const orbit of this.orbitLines.values()) orbit.visible = false;
    }
  }

  setGridVisible(visible: boolean): void {
    this.grid.visible = visible;
  }

  labelCandidates(
    camera: THREE.PerspectiveCamera,
    viewportWidth: number,
    viewportHeight: number,
  ): SceneLabelCandidate[] {
    return BODY_DEFINITIONS.map((definition, order) => {
      const entry = this.labelEntries.get(definition.id)!;
      const shouldShow = this.labelsEnabled && (this.labelAll || !this.involvedOnly ||
        this.involved.has(definition.id));
      const marker = this.markers.get(definition.id)!;
      const screen = marker.position.clone().project(camera);
      const x = (screen.x + 1) * viewportWidth / 2;
      const y = (1 - screen.y) * viewportHeight / 2;
      const text = bodyName(definition.id, this.nameStyle);
      if (text !== entry.measuredText) {
        const size = estimateLabelSize(text, 10, 4, 1);
        entry.measuredText = text;
        entry.width = size.width;
        entry.height = size.height;
      }
      const selected = this.selectionMarker.userData.bodyId === definition.id;
      const interactive = selected || this.hovered === definition.id;
      return {
        id: `body-${definition.id}`,
        anchorX: x,
        anchorY: y,
        width: entry.width,
        height: entry.height,
        offsetX: 7,
        offsetY: -5,
        priority: interactive ? LABEL_PRIORITY.interactive
          : this.involved.has(definition.id) ? LABEL_PRIORITY.involvedBody
            : LABEL_PRIORITY.brightStar,
        order,
        valid: shouldShow && marker.visible && screen.z >= -1 && screen.z <= 1,
        element: entry.element,
        text,
        selected,
      };
    });
  }

  private createSurface(id: SolarBodyId): void {
    const material = id === "Sun" ? this.sunMaterial()
      : id === "Earth" ? this.earthMaterial()
        : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.95,
          metalness: 0,
          transparent: true,
          opacity: 0,
        });
    const surface = new THREE.Mesh(sharedSphere, material);
    surface.visible = false;
    surface.name = `${id} true-scale surface`;
    this.surfaces.set(id, surface);
    this.group.add(surface);
    if (id === "Sun") this.addSunGlow(surface);
    if (id === "Earth") {
      const clouds = new THREE.Mesh(sharedSphere, this.earthCloudMaterial());
      clouds.name = "Earth clouds";
      clouds.scale.setScalar(1.008);
      surface.add(clouds);
    }
    if (id === "Saturn") {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.25, 2.3, 96),
        new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide }),
      );
      ring.name = "Saturn ring";
      ring.rotation.x = Math.PI / 2;
      surface.add(ring);
    }
  }

  private loadSurfaceTexture(id: SolarBodyId, surface: THREE.Mesh): void {
    if (id === "Sun") {
      this.loadedTextures.add(id);
      return;
    }
    if (id === "Earth") {
      this.loadEarthTextures(surface);
      this.loadedTextures.add(id);
      return;
    }
    const uri = window.__XUANYE_TEXTURES__?.[id];
    if (!uri) return;
    this.loadedTextures.add(id);
    const material = surface.material as THREE.MeshStandardMaterial;
    material.map = this.textureLoader.load(uri, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      material.needsUpdate = true;
    });
    if (id === "Saturn") {
      const ring = surface.getObjectByName("Saturn ring") as THREE.Mesh;
      const ringUri = window.__XUANYE_TEXTURES__?.SaturnRing;
      if (ring && ringUri) {
        (ring.material as THREE.MeshStandardMaterial).map = this.textureLoader.load(ringUri);
        (ring.material as THREE.MeshStandardMaterial).alphaTest = 0.08;
      }
    }
  }

  private orientSurface(id: SolarBodyId, surface: THREE.Mesh, date: Date): void {
    const definition = BODY_DEFINITIONS.find((item) => item.id === id)!;
    const axis = RotationAxis(definition.body, date);
    const ra = axis.ra * 15 * Math.PI / 180;
    const dec = axis.dec * Math.PI / 180;
    const ecliptic = equatorialToEclipticJ2000({
      x: Math.cos(dec) * Math.cos(ra),
      y: Math.cos(dec) * Math.sin(ra),
      z: Math.sin(dec),
    });
    const pole = eclipticToWorld(ecliptic);
    surface.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(pole.x, pole.y, pole.z).normalize(),
    );
    surface.rotateOnAxis(new THREE.Vector3(0, 1, 0), axis.spin * Math.PI / 180);
  }

  private sunMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { surfaceOpacity: { value: 0 } },
      vertexShader: `varying vec3 normalView; void main() {
        normalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
      fragmentShader: `uniform float surfaceOpacity;
      varying vec3 normalView; void main() {
        float limb = pow(max(normalView.z, 0.0), 0.35);
        gl_FragColor = vec4(mix(vec3(1.0, 0.34, 0.04),
          vec3(1.0, 0.88, 0.42), limb), surfaceOpacity);
      }`,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    });
  }

  private earthMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: null },
        nightMap: { value: null },
        sunPosition: { value: new THREE.Vector3() },
        surfaceOpacity: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDirection;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vDirection = normal;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform samplerCube dayMap;
        uniform samplerCube nightMap;
        uniform vec3 sunPosition;
        uniform float surfaceOpacity;
        varying vec3 vDirection;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 sampleDirection = vec3(vDirection.x, vDirection.y, -vDirection.z);
          vec3 day = textureCube(dayMap, sampleDirection).rgb;
          vec3 night = textureCube(nightMap, sampleDirection).rgb;
          float daylight = max(dot(vWorldNormal,
            normalize(sunPosition - vWorldPosition)), 0.0);
          vec3 color = day * (0.06 + daylight * 0.94) +
            night * pow(1.0 - daylight, 3.0) * 0.55;
          gl_FragColor = vec4(color, surfaceOpacity);
        }
      `,
      transparent: true,
    });
  }

  private earthCloudMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        cloudMap: { value: null },
        sunPosition: { value: new THREE.Vector3() },
        surfaceOpacity: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDirection;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vDirection = normal;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform samplerCube cloudMap;
        uniform vec3 sunPosition;
        uniform float surfaceOpacity;
        varying vec3 vDirection;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 sampleDirection = vec3(vDirection.x, vDirection.y, -vDirection.z);
          vec3 cloud = textureCube(cloudMap, sampleDirection).rgb;
          float density = max(max(cloud.r, cloud.g), cloud.b);
          float daylight = max(dot(vWorldNormal,
            normalize(sunPosition - vWorldPosition)), 0.0);
          gl_FragColor = vec4(cloud * (0.12 + daylight * 0.88),
            density * surfaceOpacity * 0.5);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
  }

  private loadEarthTextures(surface: THREE.Mesh): void {
    const material = surface.material as THREE.ShaderMaterial;
    material.uniforms.dayMap!.value = this.loadCubeTexture("EarthDay");
    material.uniforms.nightMap!.value = this.loadCubeTexture("EarthNight");
    const clouds = surface.getObjectByName("Earth clouds") as THREE.Mesh | undefined;
    if (clouds) {
      (clouds.material as THREE.ShaderMaterial).uniforms.cloudMap!.value =
        this.loadCubeTexture("EarthCloud");
    }
  }

  private loadCubeTexture(prefix: string): THREE.CubeTexture | undefined {
    const source = window.__XUANYE_TEXTURES__;
    if (!source) return undefined;
    const suffixes = ["Rt", "Lf", "Up", "Dn", "Ft", "Bk"];
    const uris = suffixes.map((suffix) => source[`${prefix}${suffix}`]);
    if (uris.some((uri) => !uri)) return undefined;
    const texture = new THREE.CubeTextureLoader().load(uris as string[]);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private addSunGlow(surface: THREE.Mesh): void {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const glow = context.createRadialGradient(32, 32, 4, 32, 32, 32);
    glow.addColorStop(0, "rgba(255,220,130,.8)");
    glow.addColorStop(0.25, "rgba(255,165,60,.35)");
    glow.addColorStop(1, "rgba(255,120,20,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, 64, 64);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    sprite.name = "Sun glow";
    sprite.scale.setScalar(5);
    surface.add(sprite);
  }

  objectFor(id: SolarBodyId): THREE.Object3D | undefined {
    return this.markers.get(id);
  }

  setSelection(id: SolarBodyId | undefined): void {
    this.selectionMarker.userData.bodyId = id;
    this.selectionMarker.visible = id !== undefined;
  }

  setHovered(id: SolarBodyId | undefined): void {
    this.hovered = id;
  }

  private createGrid(): void {
    const material = new THREE.LineBasicMaterial({
      color: 0x856f4c,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    const points: number[] = [];
    const outer = 55 / 206_264.806;
    for (let ring = 1; ring <= 11; ring += 1) {
      const radius = outer * ring / 11;
      for (let step = 0; step < 96; step += 1) {
        const first = step / 96 * Math.PI * 2;
        const second = (step + 1) / 96 * Math.PI * 2;
        const firstWorld = eclipticToWorld({
          x: radius * Math.cos(first),
          y: radius * Math.sin(first),
          z: 0,
        });
        const secondWorld = eclipticToWorld({
          x: radius * Math.cos(second),
          y: radius * Math.sin(second),
          z: 0,
        });
        points.push(
          firstWorld.x,
          firstWorld.y,
          firstWorld.z,
          secondWorld.x,
          secondWorld.y,
          secondWorld.z,
        );
      }
    }
    for (let spoke = 0; spoke < 24; spoke += 1) {
      const angle = spoke / 24 * Math.PI * 2;
      const end = eclipticToWorld({
        x: outer * Math.cos(angle),
        y: outer * Math.sin(angle),
        z: 0,
      });
      points.push(0, 0, 0, end.x, end.y, end.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    this.grid = new THREE.LineSegments(geometry, material);
    this.grid.name = "J2000 ecliptic grid";
    this.group.add(this.grid);
  }

  private createOrbit(definition: BodyDefinition): void {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array((ORBIT_SAMPLES + 1) * 3), 3),
    );
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: definition.color,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    line.userData.absolutePositions = [] as Cartesian[];
    this.orbitLines.set(definition.id, line);
    this.group.add(line);
  }

  private updateOrbits(date: Date, origin: Cartesian): void {
    for (const definition of BODY_DEFINITIONS) {
      const line = this.orbitLines.get(definition.id);
      if (!line) continue;
      const start = date.getTime() - definition.orbitDays * 86_400_000 / 2;
      const positions: Cartesian[] = [];
      for (let index = 0; index <= ORBIT_SAMPLES; index += 1) {
        const time = start + definition.orbitDays * 86_400_000 * index / ORBIT_SAMPLES;
        const sampleDate = new Date(time);
        if (definition.id === "Moon") {
          const earth = this.bodyPositions.get("Earth")!;
          positions.push(addCartesian(
            earth,
            geocentricPositionParsecs(definition.body, sampleDate),
          ));
        } else {
          positions.push(heliocentricPositionParsecs(definition, sampleDate));
        }
      }
      line.userData.absolutePositions = positions;
    }
    this.positionOrbits(origin);
  }

  private positionOrbits(origin: Cartesian): void {
    for (const line of this.orbitLines.values()) {
      const positions = line.userData.absolutePositions as Cartesian[];
      const attribute = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      positions.forEach((position, index) => {
        const world = eclipticToWorld({
          x: position.x - origin.x,
          y: position.y - origin.y,
          z: position.z - origin.z,
        });
        attribute.setXYZ(index, world.x, world.y, world.z);
      });
      attribute.needsUpdate = true;
    }
    this.lastOrbitOrigin = { ...origin };
  }
}
