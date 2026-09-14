export const LABEL_PRIORITY = {
  interactive: 0,
  involvedBody: 1,
  ringOrMansion: 2,
  brightStar: 3,
} as const;

export type LabelPriority = typeof LABEL_PRIORITY[keyof typeof LABEL_PRIORITY];

export interface LabelRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface LabelCandidate {
  id: string;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  priority: LabelPriority;
  order: number;
  valid: boolean;
}

export interface LabelPlacement {
  id: string;
  left: number;
  top: number;
  rect: LabelRect;
}

export function labelCap(density: number): number {
  const clamped = Math.min(1, Math.max(0, density));
  return Math.round(28 + clamped * 96);
}

export function estimateLabelSize(
  text: string,
  fontSize: number,
  horizontalPadding: number,
  verticalPadding: number,
): { width: number; height: number } {
  let units = 0;
  for (const character of Array.from(text)) {
    units += /[\u2e80-\uffff]/u.test(character) ? 1 : 0.62;
  }
  return {
    width: Math.ceil(units * fontSize + horizontalPadding * 2 + 2),
    height: Math.ceil(fontSize * 1.25 + verticalPadding * 2 + 2),
  };
}

export function labelAnchorVisible(
  candidate: LabelCandidate,
  viewport: { width: number; height: number },
): boolean {
  return candidate.valid && Number.isFinite(candidate.anchorX) &&
    Number.isFinite(candidate.anchorY) && candidate.anchorX >= 0 &&
    candidate.anchorY >= 0 && candidate.anchorX <= viewport.width &&
    candidate.anchorY <= viewport.height;
}

export function labelRect(
  candidate: LabelCandidate,
): LabelRect {
  const left = candidate.anchorX + candidate.offsetX;
  const top = candidate.anchorY + candidate.offsetY;
  return {
    left,
    top,
    right: left + candidate.width,
    bottom: top + candidate.height,
  };
}

export function labelFitsViewport(
  rect: LabelRect,
  viewport: { width: number; height: number },
  margin = 3,
): boolean {
  return rect.left > margin && rect.top > margin &&
    rect.right < viewport.width - margin && rect.bottom < viewport.height - margin;
}

export function labelsCollide(first: LabelRect, second: LabelRect, gap = 3): boolean {
  return first.left < second.right + gap && first.right + gap > second.left &&
    first.top < second.bottom + gap && first.bottom + gap > second.top;
}

export function compareLabelPriority(first: LabelCandidate, second: LabelCandidate): number {
  return first.priority - second.priority || first.order - second.order ||
    first.id.localeCompare(second.id);
}

export function layoutLabels(
  candidates: readonly LabelCandidate[],
  viewport: { width: number; height: number },
  cap: number,
): LabelPlacement[] {
  const accepted: LabelPlacement[] = [];
  for (const candidate of [...candidates].sort(compareLabelPriority)) {
    if (accepted.length >= Math.max(0, cap)) break;
    if (!labelAnchorVisible(candidate, viewport)) continue;
    const rect = labelRect(candidate);
    if (!labelFitsViewport(rect, viewport)) continue;
    if (accepted.some((placement) => labelsCollide(placement.rect, rect))) continue;
    accepted.push({ id: candidate.id, left: rect.left, top: rect.top, rect });
  }
  return accepted;
}
