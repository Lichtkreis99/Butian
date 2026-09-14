export interface PointerGestureSummary {
  durationMs: number;
  totalMovement: number;
  maximumPointers: number;
  wheelOrPinch: boolean;
  cancelled?: boolean;
}

export function isClickGesture(gesture: PointerGestureSummary): boolean {
  return !gesture.cancelled &&
    !gesture.wheelOrPinch &&
    gesture.maximumPointers === 1 &&
    gesture.totalMovement < 5 &&
    gesture.durationMs < 350;
}
