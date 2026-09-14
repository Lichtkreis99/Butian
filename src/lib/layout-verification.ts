export interface LayoutMeasurement {
  container: { width: number; height: number };
  canvas: { width: number; height: number };
  drawingBuffer: { width: number; height: number };
  devicePixelRatio: number;
  cameraAspect: number;
  labelsOutside: number;
  offendingLabels: Array<{
    text: string;
    class: string;
    rect: {
      left: number;
      top: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    };
  }>;
}

export interface LayoutStep extends LayoutMeasurement {
  label: string;
  ok: boolean;
}

export function layoutMeasurementPasses(value: LayoutMeasurement): boolean {
  const { container, canvas, drawingBuffer, devicePixelRatio } = value;
  if (container.width <= 0 || container.height <= 0) return false;
  return Math.abs(canvas.width - container.width) <= 1 &&
    Math.abs(canvas.height - container.height) <= 1 &&
    Math.abs(value.cameraAspect - container.width / container.height) < 1e-3 &&
    Math.abs(drawingBuffer.width - Math.round(container.width * devicePixelRatio)) <= 1 &&
    Math.abs(drawingBuffer.height - Math.round(container.height * devicePixelRatio)) <= 1 &&
    value.labelsOutside === 0;
}
