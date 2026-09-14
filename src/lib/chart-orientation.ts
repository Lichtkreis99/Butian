import { normalizeDegrees } from "./coordinates";

export type EclipticViewPole = "north" | "south";

export const CHART_POLAR_EPSILON = 1e-3;

export interface ChartCameraPose {
  azimuth: number;
  polar: number;
  offset: { x: number; y: number; z: number };
}

export function westernChartAngle(longitude: number, ascendant: number): number {
  return normalizeDegrees(180 - (longitude - ascendant));
}

export function zhengyuChartAngle(longitude: number): number {
  return normalizeDegrees(longitude - 90);
}

export function chartPoint(angle: number, radius: number, center = 220): [number, number] {
  const radians = angle * Math.PI / 180;
  return [center + Math.cos(radians) * radius, center + Math.sin(radians) * radius];
}

export function chartSpoke(angle: number, inner: number, outer: number): string {
  const first = chartPoint(angle, inner);
  const second = chartPoint(angle, outer);
  return `<line x1="${first[0]}" y1="${first[1]}" x2="${second[0]}" ` +
    `y2="${second[1]}"/>`;
}

export function alignedScreenAngle(
  longitude: number,
  referenceLongitude: number,
  referenceScreenAngle: number,
  pole: EclipticViewPole,
): number {
  const delta = longitude - referenceLongitude;
  return normalizeDegrees(referenceScreenAngle + (pole === "south" ? delta : -delta));
}

export function chartCameraPose(
  referenceLongitude: number,
  referenceScreenAngle: number,
  pole: EclipticViewPole,
  radius: number,
  epsilon = CHART_POLAR_EPSILON,
): ChartCameraPose {
  const azimuthDegrees = pole === "north"
    ? referenceLongitude + referenceScreenAngle
    : referenceLongitude - referenceScreenAngle;
  const azimuth = azimuthDegrees * Math.PI / 180;
  const polar = pole === "north" ? epsilon : Math.PI - epsilon;
  const horizontal = radius * Math.sin(polar);
  return {
    azimuth,
    polar,
    offset: {
      x: horizontal * Math.sin(azimuth),
      y: radius * Math.cos(polar),
      z: horizontal * Math.cos(azimuth),
    },
  };
}

export function screenAngleFromChartPose(
  longitude: number,
  pose: ChartCameraPose,
): number {
  const length = Math.hypot(pose.offset.x, pose.offset.y, pose.offset.z);
  const backward = {
    x: pose.offset.x / length,
    y: pose.offset.y / length,
    z: pose.offset.z / length,
  };
  const rightLength = Math.hypot(backward.z, backward.x);
  const right = {
    x: backward.z / rightLength,
    y: 0,
    z: -backward.x / rightLength,
  };
  const cameraUp = {
    x: backward.y * right.z,
    y: backward.z * right.x - backward.x * right.z,
    z: -backward.y * right.x,
  };
  const radians = longitude * Math.PI / 180;
  const direction = { x: Math.cos(radians), y: 0, z: -Math.sin(radians) };
  const screenX = direction.x * right.x + direction.z * right.z;
  const screenY = -(direction.x * cameraUp.x + direction.z * cameraUp.z);
  return normalizeDegrees(Math.atan2(screenY, screenX) * 180 / Math.PI);
}
