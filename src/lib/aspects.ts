export interface AspectMotionInput {
  firstLongitude: number;
  firstSpeed: number;
  secondLongitude: number;
  secondSpeed: number;
  angle: number;
}

export type AspectMotion = "applying" | "separating" | "stationary";

export function angularSeparation(first: number, second: number): number {
  const distance = Math.abs(((first - second) % 360 + 360) % 360);
  return Math.min(distance, 360 - distance);
}

export function aspectMotion(input: AspectMotionInput): AspectMotion {
  const current = Math.abs(
    angularSeparation(input.firstLongitude, input.secondLongitude) - input.angle,
  );
  const step = 1 / 1_000;
  const future = Math.abs(angularSeparation(
    input.firstLongitude + input.firstSpeed * step,
    input.secondLongitude + input.secondSpeed * step,
  ) - input.angle);
  if (Math.abs(future - current) < 1e-10) return "stationary";
  return future < current ? "applying" : "separating";
}

export function aspectMotionLabel(motion: AspectMotion): string {
  if (motion === "applying") return "入相";
  if (motion === "separating") return "出相";
  return "静止";
}
