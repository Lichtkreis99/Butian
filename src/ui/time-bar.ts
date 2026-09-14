import { formatDateTimeInput, localInputToUtc, yearIsInAccurateRange } from "../lib/time";
import { DEFAULT_PLACE, searchPlaces, type PlaceResult } from "../lib/regions";

const SPEEDS = [
  { label: "1 秒 = 1 分", value: 60 },
  { label: "1 秒 = 1 时", value: 3_600 },
  { label: "1 秒 = 1 日", value: 86_400 },
  { label: "1 秒 = 1 月", value: 2_629_746 },
  { label: "1 秒 = 1 年", value: 31_556_952 },
] as const;

export interface TimeBarEvents {
  onDate(date: Date, playing: boolean): void;
  onLocation(location: PlaceResult): void;
  onTimeZone(timeZone: string): void;
}

export class TimeBar {
  readonly element: HTMLElement;

  private readonly dateInput: HTMLInputElement;
  private readonly zoneSelect: HTMLSelectElement;
  private readonly playButton: HTMLButtonElement;
  private readonly warning: HTMLElement;
  private readonly placeInput: HTMLInputElement;
  private readonly results: HTMLElement;
  private readonly speedSelect: HTMLSelectElement;
  private date = new Date();
  private timeZone = DEFAULT_PLACE.timeZone;
  private playing = false;
  private secondsPerSecond: number = SPEEDS[2].value;
  private lastFrame = performance.now();
  private readonly mirrors = new Set<(state: {
    date: Date;
    playing: boolean;
    rate: number;
  }) => void>();

  constructor(private readonly events: TimeBarEvents) {
    this.element = document.createElement("header");
    this.element.className = "time-bar";
    this.element.innerHTML = `
      <div class="brand-lockup">
        <span class="brand-seal">步</span>
        <span><strong>步天</strong><small>BUTIAN · 天文实景</small></span>
      </div>
      <div class="time-controls">
        <label>历元<input class="date-time" type="datetime-local" step="1"></label>
        <label>时区<select class="time-zone">
          <option value="Asia/Shanghai">中国标准时 · UTC+8</option>
          <option value="UTC">协调世界时 · UTC</option>
          <option value="Europe/Berlin">欧洲中部时间</option>
          <option value="America/New_York">北美东部时间</option>
        </select></label>
        <label class="place-field">观测地
          <input class="place-search" value="北京 · 东城区" autocomplete="off">
          <span class="place-results" role="listbox"></span>
        </label>
        <button class="now-button quiet-button" type="button">此刻</button>
        <button class="play-button icon-button" type="button" aria-label="播放时间">▶</button>
        <label>步速<select class="speed-select"></select></label>
      </div>
      <span class="accuracy-warning" role="status">⚠ 超出 1000–2500 CE，历算精度降低</span>
    `;
    this.dateInput = this.query(".date-time");
    this.zoneSelect = this.query(".time-zone");
    this.playButton = this.query(".play-button");
    this.warning = this.query(".accuracy-warning");
    this.placeInput = this.query(".place-search");
    this.results = this.query(".place-results");
    this.speedSelect = this.query<HTMLSelectElement>(".speed-select");
    SPEEDS.forEach((speed) => this.speedSelect.add(new Option(
      speed.label,
      String(speed.value),
    )));
    this.speedSelect.value = String(this.secondsPerSecond);
    this.syncInput();

    this.dateInput.addEventListener("change", () => this.readDate());
    this.zoneSelect.addEventListener("change", () => {
      this.timeZone = this.zoneSelect.value;
      this.syncInput();
      this.events.onTimeZone(this.timeZone);
    });
    this.query<HTMLButtonElement>(".now-button").addEventListener("click", () => {
      this.date = new Date();
      this.emitDate();
    });
    this.playButton.addEventListener("click", () => {
      this.playing = !this.playing;
      this.playButton.textContent = this.playing ? "❚❚" : "▶";
      this.playButton.setAttribute("aria-label", this.playing ? "暂停时间" : "播放时间");
      this.lastFrame = performance.now();
      this.emitDate();
    });
    this.speedSelect.addEventListener("change", () => {
      this.secondsPerSecond = Number(this.speedSelect.value);
      this.emitDate();
    });
    this.placeInput.addEventListener("input", () => this.showPlaceResults());
    this.placeInput.addEventListener("focus", () => this.showPlaceResults());
    document.addEventListener("pointerdown", (event) => {
      if (!this.element.contains(event.target as Node)) this.results.replaceChildren();
    });
    requestAnimationFrame(this.tick);
  }

  get currentDate(): Date {
    return this.date;
  }

  get currentTimeZone(): string {
    return this.timeZone;
  }

  createPlanetariumControls(): HTMLElement {
    const element = document.createElement("section");
    element.className = "planetarium-time dock-panel auto-hide-sky-ui";
    element.dataset.dockPanel = "time-controls";
    element.innerHTML = `<button data-time="rewind" title="倒放">◀◀</button>` +
      `<button data-time="slower" title="减速">◀</button>` +
      `<button data-time="toggle" title="暂停 / 播放">▶</button>` +
      `<button data-time="realtime" title="实时">1×</button>` +
      `<button data-time="faster" title="加速">▶</button>` +
      `<button data-time="now" title="回到现在">8</button>` +
      `<output></output>`;
    element.addEventListener("click", (event) => {
      const action = (event.target as Element).closest<HTMLButtonElement>("[data-time]")
        ?.dataset.time;
      if (action) this.action(action);
    });
    const update = (state: { date: Date; playing: boolean; rate: number }) => {
      element.querySelector("[data-time=toggle]")!.textContent = state.playing ? "❚❚" : "▶";
      const date = new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      }).format(state.date);
      element.querySelector("output")!.textContent = `${date} · ${this.rateLabel(state.rate)}`;
    };
    this.mirrors.add(update);
    update({ date: this.date, playing: this.playing, rate: this.secondsPerSecond });
    return element;
  }

  handleShortcut(code: string): boolean {
    if (code === "KeyJ") this.action("slower");
    else if (code === "KeyK") this.action("realtime");
    else if (code === "KeyL") this.action("faster");
    else if (code === "Digit8" || code === "Numpad8") this.action("now");
    else return false;
    return true;
  }

  private action(action: string): void {
    if (action === "toggle") this.playing = !this.playing;
    if (action === "now") this.date = new Date();
    if (action === "realtime") {
      this.secondsPerSecond = 1;
      this.playing = true;
    }
    if (action === "rewind") {
      this.secondsPerSecond = -Math.max(1, Math.abs(this.secondsPerSecond));
      this.playing = true;
    }
    if (action === "slower") {
      this.secondsPerSecond = Math.sign(this.secondsPerSecond || 1) *
        Math.max(1, Math.abs(this.secondsPerSecond) / 10);
      this.playing = true;
    }
    if (action === "faster") {
      this.secondsPerSecond = Math.sign(this.secondsPerSecond || 1) *
        Math.min(31_556_952, Math.max(1, Math.abs(this.secondsPerSecond) * 10));
      this.playing = true;
    }
    this.playButton.textContent = this.playing ? "❚❚" : "▶";
    let option = [...this.speedSelect.options].find((item) =>
      Number(item.value) === this.secondsPerSecond);
    if (!option) {
      option = new Option(this.rateLabel(this.secondsPerSecond), String(this.secondsPerSecond));
      option.dataset.dynamic = "true";
      this.speedSelect.add(option);
    }
    this.speedSelect.value = option.value;
    this.lastFrame = performance.now();
    this.emitDate();
  }

  private rateLabel(rate: number): string {
    if (rate === 1) return "实时";
    const direction = rate < 0 ? "−" : "";
    return `${direction}${Math.abs(rate).toLocaleString("zh-CN")}×`;
  }

  private tick = (now: number): void => {
    if (this.playing) {
      const elapsed = Math.min((now - this.lastFrame) / 1_000, 0.25);
      this.date = new Date(this.date.getTime() + elapsed * this.secondsPerSecond * 1_000);
      this.emitDate();
    }
    this.lastFrame = now;
    requestAnimationFrame(this.tick);
  };

  private readDate(): void {
    try {
      this.date = localInputToUtc(this.dateInput.value, this.timeZone);
      this.dateInput.setCustomValidity("");
      this.emitDate();
    } catch (error) {
      this.dateInput.setCustomValidity(error instanceof Error ? error.message : "无效日期");
      this.dateInput.reportValidity();
    }
  }

  private emitDate(): void {
    this.syncInput();
    this.events.onDate(this.date, this.playing);
    const state = { date: this.date, playing: this.playing, rate: this.secondsPerSecond };
    for (const mirror of this.mirrors) mirror(state);
  }

  private syncInput(): void {
    this.dateInput.value = formatDateTimeInput(this.date, this.timeZone);
    this.warning.classList.toggle("is-visible", !yearIsInAccurateRange(this.date));
  }

  private showPlaceResults(): void {
    const matches = searchPlaces(this.placeInput.value);
    this.results.replaceChildren(
      ...matches.map((place) => {
        const button = document.createElement("button");
        button.type = "button";
        button.role = "option";
        button.textContent = place.label;
        button.addEventListener("click", () => {
          this.placeInput.value = place.label;
          this.timeZone = place.timeZone;
          this.zoneSelect.value = place.timeZone;
          this.results.replaceChildren();
          this.syncInput();
          this.events.onLocation(place);
        });
        return button;
      }),
    );
  }

  private query<T extends Element>(selector: string): T {
    const element = this.element.querySelector<T>(selector);
    if (!element) throw new Error(`Missing time bar element: ${selector}`);
    return element;
  }
}
