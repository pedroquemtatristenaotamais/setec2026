export class AudioManager {
  constructor() {
    this.context = null;
    this.master = null;
    this.ambienceStarted = false;
    this.noiseBuffer = null;
    this.enabled = true;
  }

  async resume() {
    if (!this.enabled) return;

    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        this.enabled = false;
        return;
      }

      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer(1.0);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    if (!this.ambienceStarted) this.startAmbience();
  }

  createNoiseBuffer(seconds) {
    const size = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(1, size, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < size; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.65;
    }

    return buffer;
  }

  startAmbience() {
    if (!this.context || this.ambienceStarted) return;
    this.ambienceStarted = true;

    const hum = this.context.createOscillator();
    const humGain = this.context.createGain();
    hum.type = "sine";
    hum.frequency.value = 53;
    humGain.gain.value = 0.055;
    hum.connect(humGain).connect(this.master);
    hum.start();

    const hum2 = this.context.createOscillator();
    const hum2Gain = this.context.createGain();
    hum2.type = "triangle";
    hum2.frequency.value = 107;
    hum2Gain.gain.value = 0.018;
    hum2.connect(hum2Gain).connect(this.master);
    hum2.start();
  }

  playGunshot() {
    if (!this.context) return;

    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.value = 0.7;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.95, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + 0.14);

    const thump = this.context.createOscillator();
    const thumpGain = this.context.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(88, now);
    thump.frequency.exponentialRampToValueAtTime(44, now + 0.08);
    thumpGain.gain.setValueAtTime(0.24, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    thump.connect(thumpGain).connect(this.master);
    thump.start(now);
    thump.stop(now + 0.11);
  }

  playReload() {
    if (!this.context) return;
    this.playClick(0.0, 700, 0.07);
    this.playClick(0.20, 420, 0.06);
    this.playClick(0.66, 250, 0.09);
    this.playClick(1.30, 540, 0.06);
    this.playClick(1.74, 900, 0.07);
    this.playClick(1.98, 360, 0.05);
  }

  playReloadComplete() {
    if (!this.context) return;
    this.playClick(0, 520, 0.045);
    this.playClick(0.055, 860, 0.055);
    this.playClick(0.16, 280, 0.07);
  }

  playDryFire() {
    if (!this.context) return;
    this.playClick(0, 1700, 0.035);
    this.playClick(0.055, 980, 0.025);
  }

  playHit() {
    if (!this.context) return;
    this.playClick(0, 1250, 0.06);
    this.playClick(0.08, 1650, 0.04);
  }

  playEnemyHit() {
    if (!this.context) return;
    this.playClick(0, 430, 0.07);
  }

  playFootstep() {
    if (!this.context) return;

    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const now = this.context.currentTime;

    filter.type = "lowpass";
    filter.frequency.value = 680;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + 0.07);
  }

  playAlert() {
    if (!this.context) return;
    this.playClick(0, 330, 0.08);
    this.playClick(0.16, 620, 0.08);
    this.playClick(0.32, 330, 0.08);
  }

  playClick(offset, frequency, duration) {
    if (!this.context) return;
    const now = this.context.currentTime + offset;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }
}
