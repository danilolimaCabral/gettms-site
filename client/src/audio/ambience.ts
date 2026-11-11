/**
 * Som ambiente da cena: tráfego, chuva, grilos da noite e passagens de avião.
 * Tudo é sintetizado com WebAudio — nenhum arquivo é baixado.
 */
export type AmbienceMode = "day" | "night" | "rain";

type Nodes = {
  ctx: AudioContext;
  master: GainNode;
  traffic: GainNode;
  rain: GainNode;
  night: GainNode;
  noise: AudioBuffer;
};

export class Ambience {
  private nodes: Nodes | null = null;
  private mode: AmbienceMode = "day";
  private planeTimer: number | null = null;
  private started = false;

  get running() {
    return this.started;
  }

  private build() {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // ruído branco reaproveitado por todos os canais
    const length = ctx.sampleRate * 2;
    const noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = white * 0.5 + last * 2.4;
    }

    // tráfego: ruído grave, com respiração lenta
    const traffic = ctx.createGain();
    traffic.gain.value = 0.16;
    const trafficFilter = ctx.createBiquadFilter();
    trafficFilter.type = "lowpass";
    trafficFilter.frequency.value = 420;
    trafficFilter.Q.value = 0.6;
    const trafficSource = ctx.createBufferSource();
    trafficSource.buffer = noise;
    trafficSource.loop = true;
    trafficSource.connect(trafficFilter).connect(traffic);
    traffic.connect(master);
    trafficSource.start();

    const trafficLfo = ctx.createOscillator();
    trafficLfo.frequency.value = 0.07;
    const trafficLfoGain = ctx.createGain();
    trafficLfoGain.gain.value = 0.05;
    trafficLfo.connect(trafficLfoGain).connect(traffic.gain);
    trafficLfo.start();

    // chuva: ruído agudo filtrado
    const rain = ctx.createGain();
    rain.gain.value = 0;
    const rainHigh = ctx.createBiquadFilter();
    rainHigh.type = "highpass";
    rainHigh.frequency.value = 900;
    const rainLow = ctx.createBiquadFilter();
    rainLow.type = "lowpass";
    rainLow.frequency.value = 7200;
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = noise;
    rainSource.loop = true;
    rainSource.connect(rainHigh).connect(rainLow).connect(rain);
    rain.connect(master);
    rainSource.start();

    // noite: grilos
    const night = ctx.createGain();
    night.gain.value = 0;
    const cricket = ctx.createOscillator();
    cricket.type = "sine";
    cricket.frequency.value = 4300;
    const chirp = ctx.createOscillator();
    chirp.frequency.value = 11;
    const chirpGain = ctx.createGain();
    chirpGain.gain.value = 0.5;
    const chirpDepth = ctx.createGain();
    chirpDepth.gain.value = 0.5;
    chirp.connect(chirpGain).connect(chirpDepth.gain);
    cricket.connect(chirpDepth).connect(night);
    night.connect(master);
    cricket.start();
    chirp.start();

    this.nodes = { ctx, master, traffic, rain, night, noise };
    this.applyMode(true);
  }

  private applyMode(immediate = false) {
    const nodes = this.nodes;
    if (!nodes) return;
    const { ctx, traffic, rain, night } = nodes;
    const now = ctx.currentTime;
    const ramp = (param: AudioParam, value: number) => {
      param.cancelScheduledValues(now);
      if (immediate) param.setValueAtTime(value, now);
      else param.linearRampToValueAtTime(value, now + 1.4);
    };
    if (this.mode === "rain") {
      ramp(traffic.gain, 0.1);
      ramp(rain.gain, 0.26);
      ramp(night.gain, 0.004);
    } else if (this.mode === "night") {
      ramp(traffic.gain, 0.055);
      ramp(rain.gain, 0);
      ramp(night.gain, 0.018);
    } else {
      ramp(traffic.gain, 0.16);
      ramp(rain.gain, 0);
      ramp(night.gain, 0.004);
    }
  }

  private plane() {
    const nodes = this.nodes;
    if (!nodes || !this.started) return;
    const { ctx, noise, master } = nodes;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.6;
    band.frequency.setValueAtTime(320, now);
    band.frequency.linearRampToValueAtTime(880, now + 3.2);
    band.frequency.linearRampToValueAtTime(360, now + 7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 2.6);
    gain.gain.linearRampToValueAtTime(0.0001, now + 7.4);
    source.connect(band).connect(gain).connect(master);
    source.start(now);
    source.stop(now + 7.6);
    this.schedulePlane();
  }

  private schedulePlane() {
    if (this.planeTimer) window.clearTimeout(this.planeTimer);
    this.planeTimer = window.setTimeout(() => this.plane(), 16000 + Math.random() * 14000);
  }

  async enable() {
    if (!this.nodes) this.build();
    const ctx = this.nodes!.ctx;
    if (ctx.state === "suspended") await ctx.resume();
    this.started = true;
    const now = ctx.currentTime;
    this.nodes!.master.gain.cancelScheduledValues(now);
    this.nodes!.master.gain.setValueAtTime(this.nodes!.master.gain.value, now);
    this.nodes!.master.gain.linearRampToValueAtTime(0.9, now + 1.2);
    this.applyMode();
    this.schedulePlane();
  }

  disable() {
    this.started = false;
    if (this.planeTimer) window.clearTimeout(this.planeTimer);
    this.planeTimer = null;
    const nodes = this.nodes;
    if (!nodes) return;
    const now = nodes.ctx.currentTime;
    nodes.master.gain.cancelScheduledValues(now);
    nodes.master.gain.setValueAtTime(nodes.master.gain.value, now);
    nodes.master.gain.linearRampToValueAtTime(0, now + 0.6);
  }

  setMode(mode: AmbienceMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyMode();
  }

  dispose() {
    this.disable();
    const nodes = this.nodes;
    if (nodes) {
      window.setTimeout(() => nodes.ctx.close().catch(() => undefined), 800);
      this.nodes = null;
    }
  }
}
