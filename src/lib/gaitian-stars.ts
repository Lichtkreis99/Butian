export function gaitianStarRadius(magnitude: number): number {
  return Math.min(2.2, Math.max(0.45, 2.2 - 0.35 * magnitude));
}

export function gaitianStarVisible(magnitude: number, asterismMember: boolean): boolean {
  return asterismMember || magnitude <= 5.5;
}
