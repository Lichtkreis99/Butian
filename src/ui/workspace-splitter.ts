const STORAGE_KEY = "xuanye:workspace-split:v1";
const DEFAULT_SKY_RATIO = 0.62;
const MIN_SKY_WIDTH = 360;
const MIN_CHART_WIDTH = 300;
const SPLITTER_WIDTH = 9;

function readStoredRatio(): number {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) && value > 0 && value < 1
      ? value
      : DEFAULT_SKY_RATIO;
  } catch {
    return DEFAULT_SKY_RATIO;
  }
}

function storeRatio(value: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Storage can be unavailable for file:// pages; layout still works in memory.
  }
}

export class WorkspaceSplitter {
  readonly element = document.createElement("div");

  private ratio = readStoredRatio();
  private dragging = false;

  constructor(
    private readonly workspace: HTMLElement,
    private readonly chartPanel: HTMLElement,
    private readonly onResize: () => void,
  ) {
    this.element.className = "workspace-splitter";
    this.element.tabIndex = 0;
    this.element.setAttribute("role", "separator");
    this.element.setAttribute("aria-label", "调整三维视图与盘面宽度");
    this.element.setAttribute("aria-orientation", "vertical");
    this.element.setAttribute("aria-valuemin", String(MIN_SKY_WIDTH));
    this.element.addEventListener("pointerdown", (event) => this.startDrag(event));
    this.element.addEventListener("pointermove", (event) => this.drag(event));
    this.element.addEventListener("pointerup", (event) => this.endDrag(event));
    this.element.addEventListener("pointercancel", (event) => this.endDrag(event));
    this.element.addEventListener("keydown", (event) => this.keydown(event));
    this.element.addEventListener("dblclick", () => this.reset());
    window.addEventListener("resize", () => this.apply());
    this.chartPanel.addEventListener("chart-layout-change", () => this.apply());
    this.workspace.insertBefore(this.element, this.chartPanel);
    this.apply();
  }

  private startDrag(event: PointerEvent): void {
    if (event.button !== 0 || this.isStacked() || this.isCollapsed()) return;
    this.dragging = true;
    this.element.classList.add("is-dragging");
    this.element.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  private drag(event: PointerEvent): void {
    if (!this.dragging || !this.element.hasPointerCapture(event.pointerId)) return;
    const rect = this.workspace.getBoundingClientRect();
    this.setSkyWidth(event.clientX - rect.left, true);
  }

  private endDrag(event: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.element.classList.remove("is-dragging");
    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId);
    }
    storeRatio(this.ratio);
  }

  private keydown(event: KeyboardEvent): void {
    if (this.isStacked() || this.isCollapsed()) return;
    if (event.key === "Home") {
      this.reset();
      event.preventDefault();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const current = this.availableWidth() * this.ratio;
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    this.setSkyWidth(current + direction * (event.shiftKey ? 40 : 12), true);
    storeRatio(this.ratio);
    event.preventDefault();
  }

  private reset(): void {
    this.ratio = DEFAULT_SKY_RATIO;
    storeRatio(this.ratio);
    this.apply();
  }

  private setSkyWidth(requested: number, persistRatio: boolean): void {
    const available = this.availableWidth();
    const maximum = Math.max(MIN_SKY_WIDTH, available - MIN_CHART_WIDTH);
    const width = Math.min(maximum, Math.max(MIN_SKY_WIDTH, requested));
    if (persistRatio && available > 0) this.ratio = width / available;
    this.workspace.style.setProperty("--sky-column-width", `${width}px`);
    this.element.setAttribute("aria-valuenow", String(Math.round(width)));
    this.element.setAttribute("aria-valuemax", String(Math.round(maximum)));
    this.onResize();
  }

  private apply(): void {
    const collapsed = this.isCollapsed();
    this.workspace.classList.toggle("is-chart-collapsed", collapsed);
    if (this.isStacked()) {
      this.workspace.style.removeProperty("--sky-column-width");
      this.onResize();
      return;
    }
    if (!collapsed) this.setSkyWidth(this.availableWidth() * this.ratio, false);
    else this.onResize();
  }

  private availableWidth(): number {
    return Math.max(1, this.workspace.clientWidth - SPLITTER_WIDTH);
  }

  private isCollapsed(): boolean {
    return this.chartPanel.classList.contains("is-collapsed");
  }

  private isStacked(): boolean {
    return window.matchMedia("(max-width: 820px)").matches;
  }

  setRatioForSelfTest(ratio: number): void {
    this.ratio = Math.min(0.7, Math.max(0.3, ratio));
    this.apply();
  }

  chartWidthForSelfTest(): number {
    return this.availableWidth() * (1 - this.ratio);
  }

  setChartWidthForSelfTest(width: number): void {
    this.setSkyWidth(this.availableWidth() - width, true);
  }
}
