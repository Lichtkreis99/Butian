import * as THREE from "three";

import type { PlanetariumProjection } from "../lib/settings-store";

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export function projectScreenPoint(
  point: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  planetarium: boolean,
  projection: PlanetariumProjection,
): ScreenPoint {
  if (!planetarium || projection === "perspective") {
    const screen = point.clone().project(camera);
    return {
      x: (screen.x + 1) * width / 2,
      y: (1 - screen.y) * height / 2,
      visible: screen.z >= -1 && screen.z <= 1,
    };
  }
  const direction = point.clone().sub(camera.position).normalize()
    .applyQuaternion(camera.quaternion.clone().invert());
  const forward = -direction.z;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  let x: number;
  let y: number;
  if (projection === "stereographic") {
    const scale = Math.tan(halfFov / 2);
    x = direction.x / Math.max(1e-8, 1 + forward) / scale / camera.aspect;
    y = direction.y / Math.max(1e-8, 1 + forward) / scale;
  } else {
    const theta = Math.acos(Math.min(1, Math.max(-1, forward)));
    const radial = Math.hypot(direction.x, direction.y) || 1;
    x = direction.x / radial * theta / halfFov / camera.aspect;
    y = direction.y / radial * theta / halfFov;
  }
  return {
    x: (x + 1) * width / 2,
    y: (1 - y) * height / 2,
    visible: Math.abs(x) <= 1 && Math.abs(y) <= 1,
  };
}
