import type { Object3D } from "three";

import type { LabelCandidate, LabelPlacement } from "../lib/label-layout";

export interface SceneLabelCandidate extends LabelCandidate {
  element?: HTMLElement;
  object?: Object3D;
  text?: string;
  selected?: boolean;
}

export function applySceneLabelPlacements(
  candidates: readonly SceneLabelCandidate[],
  placements: readonly LabelPlacement[],
): void {
  const visible = new Map(placements.map((placement) => [placement.id, placement]));
  const writes = candidates.map((candidate) => ({
    candidate,
    placement: visible.get(candidate.id),
  }));
  for (const { candidate, placement } of writes) {
    if (candidate.object) candidate.object.visible = placement !== undefined;
    if (!candidate.element) continue;
    if (candidate.text !== undefined && candidate.element.textContent !== candidate.text) {
      candidate.element.textContent = candidate.text;
    }
    candidate.element.hidden = placement === undefined;
    candidate.element.classList.toggle("is-selected", candidate.selected === true);
    if (placement) {
      candidate.element.style.transform =
        `translate3d(${placement.left.toFixed(1)}px, ${placement.top.toFixed(1)}px, 0)`;
    }
  }
}
