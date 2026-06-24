export interface FrameClockOptions {
  fps: number;
  onTick: () => void;
}

export class FrameClock {
  private animationId: number | null = null;
  private lastTimestamp = 0;
  private accumulator = 0;
  private running = false;

  constructor(private readonly options: FrameClockOptions) {}

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.accumulator = 0;
    this.lastTimestamp = performance.now();
    this.animationId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  setFps(fps: number) {
    this.options.fps = fps;
  }

  private loop = (timestamp: number) => {
    if (!this.running) {
      return;
    }

    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.accumulator += delta;

    const frameDuration = 1000 / this.options.fps;
    // One tick per animation frame max — avoids burst catch-up after decode/network jank.
    if (this.accumulator >= frameDuration) {
      this.options.onTick();
      this.accumulator -= frameDuration;
      if (this.accumulator > frameDuration * 4) {
        this.accumulator = frameDuration * 4;
      }
    }

    this.animationId = requestAnimationFrame(this.loop);
  };
}
