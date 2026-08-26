type Tone = {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  slide?: number;
};

export class TableAudio {
  muted = false;
  private ctx: AudioContext | null = null;

  unlock(): void {
    if (this.muted) return;
    const ctx = this.getCtx();
    if (ctx.state === "suspended") void ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted && this.ctx) void this.ctx.suspend();
    if (!this.muted) this.unlock();
    return this.muted;
  }

  bumper(): void {
    this.blip({ freq: 420, dur: 0.09, type: "square", gain: 0.08, slide: 180 });
    this.noise(0.05, 0.06);
  }

  sling(): void {
    this.blip({ freq: 180, dur: 0.08, type: "sawtooth", gain: 0.07, slide: -80 });
  }

  flip(): void {
    this.blip({ freq: 90, dur: 0.06, type: "triangle", gain: 0.09, slide: -40 });
  }

  rollover(): void {
    this.blip({ freq: 880, dur: 0.1, type: "sine", gain: 0.07, slide: 220 });
  }

  target(): void {
    this.blip({ freq: 520, dur: 0.12, type: "square", gain: 0.07, slide: 90 });
  }

  plunge(): void {
    this.blip({ freq: 140, dur: 0.18, type: "sawtooth", gain: 0.08, slide: 260 });
  }

  drain(): void {
    this.blip({ freq: 240, dur: 0.45, type: "triangle", gain: 0.09, slide: -200 });
  }

  bonus(): void {
    this.blip({ freq: 660, dur: 0.12, type: "square", gain: 0.07, slide: 0 });
    window.setTimeout(() => {
      this.blip({ freq: 880, dur: 0.12, type: "square", gain: 0.07 });
    }, 90);
    window.setTimeout(() => {
      this.blip({ freq: 1174, dur: 0.16, type: "square", gain: 0.07 });
    }, 180);
  }

  extraBall(): void {
    this.bonus();
    window.setTimeout(() => this.blip({ freq: 1480, dur: 0.2, type: "sine", gain: 0.08 }), 280);
  }

  kickback(): void {
    this.blip({ freq: 200, dur: 0.16, type: "sawtooth", gain: 0.1, slide: 400 });
  }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private blip(tone: Tone): void {
    if (this.muted) return;
    const ctx = this.getCtx();
    if (ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type ?? "sine";
    osc.frequency.setValueAtTime(tone.freq, ctx.currentTime);
    if (tone.slide) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, tone.freq + tone.slide),
        ctx.currentTime + tone.dur,
      );
    }
    gain.gain.setValueAtTime(tone.gain ?? 0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + tone.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + tone.dur + 0.02);
  }

  private noise(dur: number, volume: number): void {
    if (this.muted) return;
    const ctx = this.getCtx();
    if (ctx.state !== "running") return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }
}
