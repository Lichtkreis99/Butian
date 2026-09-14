import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { eclipticToWorld, type Cartesian } from "../lib/coordinates";
import { allFinite } from "../lib/finite-state";
import { isClickGesture } from "./pointer-gesture";
import { chartCameraPose, type EclipticViewPole } from "../lib/chart-orientation";

export type ViewPreset =
  | "heliocentric"
  | "geocentric"
  | "earth-view"
  | "xuanye"
  | "other-star";

interface CameraPose {
  origin: Cartesian;
  position: THREE.Vector3;
  target: THREE.Vector3;
}

interface Transition {
  start: number;
  duration: number;
  from: CameraPose;
  to: CameraPose;
}

interface GoodCameraState {
  origin: Cartesian;
  position: THREE.Vector3;
  target: THREE.Vector3;
  quaternion: THREE.Quaternion;
  fov: number;
  aspect: number;
  near: number;
  far: number;
}

export interface CameraPointerClick {
  event: PointerEvent;
  count: 1 | 2;
}

interface ActiveGesture {
  pointerId: number;
  startedAt: number;
  lastX: number;
  lastY: number;
  totalMovement: number;
  maximumPointers: number;
  wheelOrPinch: boolean;
  lastMoveTime: number;
}

export class CameraController {
  readonly controls: OrbitControls;
  readonly origin: Cartesian = { x: 0, y: 0, z: 0 };

  private readonly keys = new Set<string>();
  private readonly activePointers = new Set<number>();
  private transition?: Transition;
  private transitionPausedAt?: number;
  private gesture?: ActiveGesture;
  private lastClick?: { time: number; x: number; y: number };
  private planetarium = false;
  private planetariumAzimuth = 180;
  private planetariumAltitude = 25;
  private planetariumTarget?: { azimuth: number; altitude: number };
  private planetariumVelocity = { azimuth: 0, altitude: 0 };
  private zoomTargetFov?: number;
  private lastGoodState: GoodCameraState;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    element: HTMLElement,
    onPointerClick: (click: CameraPointerClick) => void,
  ) {
    this.controls = new OrbitControls(camera, element);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.zoomSpeed = 1.5;
    this.controls.rotateSpeed = 0.45;
    this.controls.panSpeed = 0.7;
    this.controls.zoomToCursor = true;
    this.controls.keyPanSpeed = 18;
    this.controls.listenToKeyEvents(window);
    this.controls.minDistance = 3e-10;
    this.controls.maxDistance = 5_000;
    this.camera.up.set(0, 1, 0);
    this.controls.update();
    this.camera.updateMatrixWorld();
    this.lastGoodState = this.captureState();
    window.addEventListener("keydown", (event) => {
      const target = event.target as HTMLElement;
      if (!target.matches("input, textarea, select, [contenteditable=true]")) {
        this.keys.add(event.code);
      }
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
    element.addEventListener("pointerdown", (event) => this.pointerDown(event));
    element.addEventListener("pointermove", (event) => this.pointerMove(event));
    element.addEventListener("pointerup", (event) => this.pointerUp(event, onPointerClick));
    element.addEventListener("pointercancel", (event) => this.pointerCancel(event));
    element.addEventListener("wheel", (event) => {
      if (this.gesture) this.gesture.wheelOrPinch = true;
      if (!this.planetarium) return;
      const from = this.zoomTargetFov ?? this.camera.fov;
      this.zoomTargetFov = THREE.MathUtils.clamp(
        from * Math.exp(event.deltaY * 0.0015),
        1,
        180,
      );
      const horizontal = event.offsetX / Math.max(1, element.clientWidth) - 0.5;
      const vertical = event.offsetY / Math.max(1, element.clientHeight) - 0.5;
      const zoomFraction = 1 - this.zoomTargetFov / from;
      this.planetariumAzimuth -= horizontal * from * zoomFraction * 0.35;
      this.planetariumAltitude += vertical * from * zoomFraction * 0.25;
      event.preventDefault();
    }, { passive: false });
  }

  flyTo(preset: ViewPreset, focus: Cartesian, earth: Cartesian): void {
    const pose = this.poseFor(preset, focus, earth);
    this.transition = {
      start: performance.now(),
      duration: 1_500,
      from: {
        origin: { ...this.origin },
        position: this.camera.position.clone(),
        target: this.controls.target.clone(),
      },
      to: pose,
    };
    this.controls.enabled = false;
  }

  setPresetImmediately(preset: ViewPreset, focus: Cartesian, earth: Cartesian): void {
    const pose = this.poseFor(preset, focus, earth);
    this.transition = undefined;
    this.transitionPausedAt = undefined;
    Object.assign(this.origin, pose.origin);
    this.camera.position.copy(pose.position);
    this.controls.target.copy(pose.target);
    this.controls.enabled = true;
    this.controls.update();
    this.camera.updateMatrixWorld();
    this.rememberIfFinite();
  }

  focus(focus: Cartesian, distance: number): void {
    const direction = this.camera.position.clone()
      .sub(this.controls.target)
      .normalize();
    this.transition = {
      start: performance.now(),
      duration: 1_500,
      from: {
        origin: { ...this.origin },
        position: this.camera.position.clone(),
        target: this.controls.target.clone(),
      },
      to: {
        origin: { ...focus },
        position: direction.multiplyScalar(distance),
        target: new THREE.Vector3(),
      },
    };
    this.controls.enabled = false;
  }

  focusTopDown(focus: Cartesian, distance: number): void {
    this.transition = {
      start: performance.now(),
      duration: 1_500,
      from: {
        origin: { ...this.origin },
        position: this.camera.position.clone(),
        target: this.controls.target.clone(),
      },
      to: {
        origin: { ...focus },
        position: new THREE.Vector3(0, distance, 1e-12),
        target: new THREE.Vector3(),
      },
    };
    this.controls.enabled = false;
  }

  lookFrom(focus: Cartesian, direction: Cartesian): void {
    const world = eclipticToWorld(direction);
    this.transition = {
      start: performance.now(),
      duration: 1_500,
      from: {
        origin: { ...this.origin },
        position: this.camera.position.clone(),
        target: this.controls.target.clone(),
      },
      to: {
        origin: { ...focus },
        position: new THREE.Vector3(0, 0, 2e-9),
        target: new THREE.Vector3(world.x, world.y, world.z).multiplyScalar(1e-5),
      },
    };
    this.controls.enabled = false;
  }

  alignTopDown(
    longitude: number,
    screenAngle: number,
    pole: EclipticViewPole,
  ): void {
    const destination = this.transition?.to ?? {
      origin: { ...this.origin },
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
    };
    const radius = Math.max(destination.position.distanceTo(destination.target), 3e-10);
    const pose = chartCameraPose(longitude, screenAngle, pole, radius);
    const position = destination.target.clone().add(new THREE.Vector3(
      pose.offset.x,
      pose.offset.y,
      pose.offset.z,
    ));
    const to = { ...destination, position };
    this.camera.up.set(0, 1, 0);
    this.transition = {
      start: performance.now(),
      duration: this.transition ? this.transition.duration : 900,
      from: {
        origin: { ...this.origin },
        position: this.camera.position.clone(),
        target: this.controls.target.clone(),
      },
      to,
    };
    this.controls.enabled = false;
  }

  clearTopDownAlignment(): void {
    this.camera.up.set(0, 1, 0);
  }

  setPlanetarium(enabled: boolean): void {
    if (this.planetarium === enabled) return;
    this.planetarium = enabled;
    this.transition = undefined;
    this.controls.enabled = !enabled;
    this.camera.fov = enabled ? 72 : 48;
    this.camera.updateProjectionMatrix();
  }

  setPlanetariumFrame(origin: Cartesian, direction: Cartesian, _zenith: Cartesian): void {
    if (!this.planetarium) return;
    Object.assign(this.origin, origin);
    const worldDirection = eclipticToWorld(direction);
    this.camera.position.set(0, 0, 0);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(worldDirection.x, worldDirection.y, worldDirection.z);
  }

  turnPlanetariumTo(azimuth: number, altitude: number): void {
    this.planetariumTarget = { azimuth, altitude };
  }

  setPlanetariumLookImmediately(azimuth: number, altitude: number): void {
    this.planetariumAzimuth = azimuth;
    this.planetariumAltitude = altitude;
    this.planetariumTarget = undefined;
    this.planetariumVelocity = { azimuth: 0, altitude: 0 };
  }

  get planetariumLook(): { azimuth: number; altitude: number } {
    if (this.planetariumTarget) {
      const azimuthDelta = ((this.planetariumTarget.azimuth - this.planetariumAzimuth + 540) %
        360) - 180;
      this.planetariumAzimuth += azimuthDelta * 0.08;
      this.planetariumAltitude = THREE.MathUtils.lerp(
        this.planetariumAltitude,
        this.planetariumTarget.altitude,
        0.08,
      );
      if (Math.abs(azimuthDelta) < 0.05 &&
        Math.abs(this.planetariumTarget.altitude - this.planetariumAltitude) < 0.05) {
        this.planetariumAzimuth = this.planetariumTarget.azimuth;
        this.planetariumAltitude = this.planetariumTarget.altitude;
        this.planetariumTarget = undefined;
      }
    }
    return {
      azimuth: this.planetariumAzimuth,
      altitude: this.planetariumAltitude,
    };
  }

  flyOut(direction: Cartesian, distance = 300, duration = 15_000): void {
    const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
    const destination = {
      x: direction.x / length * distance,
      y: direction.y / length * distance,
      z: direction.z / length * distance,
    };
    this.transition = {
      start: performance.now(),
      duration,
      from: {
        origin: { ...this.origin },
        position: this.camera.position.clone(),
        target: this.controls.target.clone(),
      },
      to: {
        origin: destination,
        position: new THREE.Vector3(0, 10, 24),
        target: new THREE.Vector3(),
      },
    };
    this.transitionPausedAt = undefined;
    this.controls.enabled = false;
  }

  toggleTransitionPause(): boolean {
    if (!this.transition) return false;
    if (this.transitionPausedAt === undefined) {
      this.transitionPausedAt = performance.now();
      return true;
    }
    this.transition.start += performance.now() - this.transitionPausedAt;
    this.transitionPausedAt = undefined;
    return false;
  }

  update(deltaSeconds: number): boolean {
    let originChanged = false;
    this.camera.up.set(0, 1, 0);
    if (this.planetarium) {
      this.updatePlanetariumMotion(deltaSeconds);
      this.ensureFinite();
      return false;
    }
    if (this.transition) {
      if (this.transitionPausedAt !== undefined) return originChanged;
      const raw = (performance.now() - this.transition.start) / this.transition.duration;
      const progress = Math.min(1, raw);
      const eased = progress < 0.5
        ? 4 * progress ** 3
        : 1 - (-2 * progress + 2) ** 3 / 2;
      const { from, to } = this.transition;
      this.origin.x = THREE.MathUtils.lerp(from.origin.x, to.origin.x, eased);
      this.origin.y = THREE.MathUtils.lerp(from.origin.y, to.origin.y, eased);
      this.origin.z = THREE.MathUtils.lerp(from.origin.z, to.origin.z, eased);
      this.camera.position.lerpVectors(from.position, to.position, eased);
      this.controls.target.lerpVectors(from.target, to.target, eased);
      originChanged = true;
      if (progress >= 1) {
        this.transition = undefined;
        this.controls.enabled = true;
      }
    }
    this.updateFreeFlight(deltaSeconds);
    this.controls.update();
    this.ensureFinite();
    return originChanged;
  }

  updateControlsForSelfTest(): void {
    if (this.planetarium) this.updatePlanetariumMotion(1 / 60);
    this.controls.update();
    this.ensureFinite();
  }

  setTransitionImmediatelyForSelfTest(): void {
    if (!this.transition) return;
    const { to } = this.transition;
    Object.assign(this.origin, to.origin);
    this.camera.position.copy(to.position);
    this.controls.target.copy(to.target);
    this.transition = undefined;
    this.transitionPausedAt = undefined;
    this.controls.enabled = !this.planetarium;
    this.camera.up.set(0, 1, 0);
    this.controls.update();
    this.ensureFinite();
  }

  finiteState(): boolean {
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    return allFinite([
      this.origin.x, this.origin.y, this.origin.z,
      ...this.camera.position.toArray(), ...this.camera.quaternion.toArray(),
      ...this.camera.up.toArray(), ...this.controls.target.toArray(),
      ...this.camera.matrix.elements, ...this.camera.matrixWorld.elements,
      ...this.camera.matrixWorldInverse.elements, ...this.camera.projectionMatrix.elements,
      ...this.camera.projectionMatrixInverse.elements,
      this.camera.fov, this.camera.aspect, this.camera.near, this.camera.far,
    ]);
  }

  orbitForSelfTest(): { azimuth: number; polar: number; up: number[] } {
    const spherical = new THREE.Spherical().setFromVector3(
      this.camera.position.clone().sub(this.controls.target),
    );
    return {
      azimuth: spherical.theta,
      polar: spherical.phi,
      up: this.camera.up.toArray(),
    };
  }

  motionForSelfTest(): { angularVelocity: number; fov: number; targetFov?: number } {
    return {
      angularVelocity: Math.hypot(
        this.planetariumVelocity.azimuth,
        this.planetariumVelocity.altitude,
      ),
      fov: this.camera.fov,
      targetFov: this.zoomTargetFov,
    };
  }

  ensureFinite(): boolean {
    if (this.finiteState()) {
      this.lastGoodState = this.captureState();
      return true;
    }
    this.restoreLastGood();
    return false;
  }

  restoreLastGood(): void {
    const state = this.lastGoodState;
    Object.assign(this.origin, state.origin);
    this.camera.position.copy(state.position);
    this.controls.target.copy(state.target);
    this.camera.quaternion.copy(state.quaternion);
    this.camera.fov = state.fov;
    this.camera.aspect = state.aspect;
    this.camera.near = state.near;
    this.camera.far = state.far;
    this.camera.up.set(0, 1, 0);
    this.transition = undefined;
    this.transitionPausedAt = undefined;
    this.controls.enabled = !this.planetarium;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  get distance(): number {
    return this.camera.position.distanceTo(this.controls.target);
  }

  private updateFreeFlight(deltaSeconds: number): void {
    if (this.planetarium || this.transition || this.keys.size === 0) return;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    const up = this.camera.up.clone();
    const movement = new THREE.Vector3();
    if (this.keys.has("KeyW")) movement.add(forward);
    if (this.keys.has("KeyS")) movement.sub(forward);
    if (this.keys.has("KeyD")) movement.add(right);
    if (this.keys.has("KeyA")) movement.sub(right);
    if (this.keys.has("KeyE")) movement.add(up);
    if (this.keys.has("KeyQ")) movement.sub(up);
    if (!movement.lengthSq()) return;
    const speed = Math.max(this.distance * 0.7, 1e-9) * deltaSeconds;
    movement.normalize().multiplyScalar(speed);
    this.camera.position.add(movement);
    this.controls.target.add(movement);
  }

  private updatePlanetariumMotion(deltaSeconds: number): void {
    const delta = Math.max(0, Math.min(deltaSeconds, 0.05));
    if (!this.gesture) {
      this.planetariumAzimuth = (this.planetariumAzimuth +
        this.planetariumVelocity.azimuth * delta + 360) % 360;
      this.planetariumAltitude = THREE.MathUtils.clamp(
        this.planetariumAltitude + this.planetariumVelocity.altitude * delta,
        -90,
        90,
      );
      const decay = Math.exp(-6 * delta);
      this.planetariumVelocity.azimuth *= decay;
      this.planetariumVelocity.altitude *= decay;
      if (Math.hypot(this.planetariumVelocity.azimuth,
        this.planetariumVelocity.altitude) < 0.005) {
        this.planetariumVelocity = { azimuth: 0, altitude: 0 };
      }
    }
    if (this.zoomTargetFov !== undefined) {
      const progress = 1 - Math.exp(-11 * delta);
      this.camera.fov = Math.exp(
        THREE.MathUtils.lerp(Math.log(this.camera.fov), Math.log(this.zoomTargetFov), progress),
      );
      if (Math.abs(this.camera.fov - this.zoomTargetFov) < 0.01) {
        this.camera.fov = this.zoomTargetFov;
        this.zoomTargetFov = undefined;
      }
      this.camera.updateProjectionMatrix();
    }
    const keyPan = 42 * delta;
    if (this.keys.has("ArrowLeft")) this.planetariumAzimuth += keyPan;
    if (this.keys.has("ArrowRight")) this.planetariumAzimuth -= keyPan;
    if (this.keys.has("ArrowUp")) this.planetariumAltitude += keyPan;
    if (this.keys.has("ArrowDown")) this.planetariumAltitude -= keyPan;
    if (this.keys.has("PageUp") || this.keys.has("Equal") ||
      this.keys.has("NumpadAdd")) this.zoomTargetFov = Math.max(1, this.camera.fov * 0.96);
    if (this.keys.has("PageDown") || this.keys.has("Minus") ||
      this.keys.has("NumpadSubtract")) {
      this.zoomTargetFov = Math.min(180, this.camera.fov * 1.04);
    }
    this.planetariumAltitude = THREE.MathUtils.clamp(this.planetariumAltitude, -90, 90);
  }

  private captureState(): GoodCameraState {
    return {
      origin: { ...this.origin },
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      quaternion: this.camera.quaternion.clone(),
      fov: this.camera.fov,
      aspect: this.camera.aspect,
      near: this.camera.near,
      far: this.camera.far,
    };
  }

  private rememberIfFinite(): void {
    if (this.finiteState()) this.lastGoodState = this.captureState();
  }

  private poseFor(preset: ViewPreset, focus: Cartesian, earth: Cartesian): CameraPose {
    if (preset === "heliocentric") {
      return {
        origin: { x: 0, y: 0, z: 0 },
        position: new THREE.Vector3(0, 6.5e-4, 7e-5),
        target: new THREE.Vector3(),
      };
    }
    if (preset === "geocentric") {
      return {
        origin: { ...earth },
        position: new THREE.Vector3(0, 6.5e-4, 1e-9),
        target: new THREE.Vector3(),
      };
    }
    if (preset === "earth-view") {
      return {
        origin: { ...earth },
        position: new THREE.Vector3(0, 2e-9, 8e-9),
        target: new THREE.Vector3(0, 0, -1e-5),
      };
    }
    if (preset === "xuanye") {
      return {
        origin: { x: 0, y: 0, z: 0 },
        position: new THREE.Vector3(38, 24, 64),
        target: new THREE.Vector3(),
      };
    }
    const sunDirection = eclipticToWorld({ x: -focus.x, y: -focus.y, z: -focus.z });
    return {
      origin: { ...focus },
      position: new THREE.Vector3(0.08, 0.045, 0.12),
      target: new THREE.Vector3(sunDirection.x, sunDirection.y, sunDirection.z),
    };
  }

  private pointerDown(event: PointerEvent): void {
    this.activePointers.add(event.pointerId);
    if (!this.gesture) {
      this.gesture = {
        pointerId: event.pointerId,
        startedAt: performance.now(),
        lastX: event.clientX,
        lastY: event.clientY,
        totalMovement: 0,
        maximumPointers: this.activePointers.size,
        wheelOrPinch: false,
        lastMoveTime: performance.now(),
      };
    }
    this.gesture.maximumPointers = Math.max(
      this.gesture.maximumPointers,
      this.activePointers.size,
    );
    if (this.activePointers.size > 1) this.gesture.wheelOrPinch = true;
  }

  private pointerMove(event: PointerEvent): void {
    if (!this.gesture || event.pointerId !== this.gesture.pointerId) return;
    const deltaX = event.clientX - this.gesture.lastX;
    const deltaY = event.clientY - this.gesture.lastY;
    if (this.planetarium) {
      this.planetariumTarget = undefined;
      this.planetariumAzimuth = (this.planetariumAzimuth - deltaX * 0.18 + 360) % 360;
      this.planetariumAltitude = THREE.MathUtils.clamp(
        this.planetariumAltitude + deltaY * 0.16,
        -90,
        90,
      );
      if (deltaX !== 0 || deltaY !== 0) {
        const now = performance.now();
        const elapsed = Math.max(1 / 60, Math.min(0.1,
          (now - this.gesture.lastMoveTime) / 1_000));
        this.planetariumVelocity.azimuth = -deltaX * 0.18 / elapsed;
        this.planetariumVelocity.altitude = deltaY * 0.16 / elapsed;
        this.gesture.lastMoveTime = now;
      }
    }
    this.gesture.totalMovement += Math.hypot(
      deltaX,
      deltaY,
    );
    this.gesture.lastX = event.clientX;
    this.gesture.lastY = event.clientY;
  }

  private pointerUp(
    event: PointerEvent,
    onPointerClick: (click: CameraPointerClick) => void,
  ): void {
    this.pointerMove(event);
    this.activePointers.delete(event.pointerId);
    if (!this.gesture || event.pointerId !== this.gesture.pointerId) return;
    const now = performance.now();
    const isClick = isClickGesture({
      durationMs: now - this.gesture.startedAt,
      totalMovement: this.gesture.totalMovement,
      maximumPointers: this.gesture.maximumPointers,
      wheelOrPinch: this.gesture.wheelOrPinch,
    });
    this.gesture = undefined;
    if (!isClick) {
      this.lastClick = undefined;
      return;
    }
    const previous = this.lastClick;
    const doubleClick = previous !== undefined &&
      now - previous.time < 350 &&
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 5;
    this.lastClick = doubleClick ? undefined : {
      time: now,
      x: event.clientX,
      y: event.clientY,
    };
    onPointerClick({ event, count: doubleClick ? 2 : 1 });
  }

  private pointerCancel(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);
    if (this.gesture?.pointerId === event.pointerId) this.gesture = undefined;
    this.lastClick = undefined;
  }
}
