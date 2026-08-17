// Everything you hear is synthesised at runtime — no audio files ship with the game.
// Gunshots are filtered noise bursts, music is a scheduled arpeggiator whose scale
// and timbre are picked per floor.

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  wholetone: [0, 2, 4, 6, 8, 10],
  pentatonic: [0, 3, 5, 7, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.enabled = true;
    this.volume = 0.7;
    this.musicVolume = 0.45;
    this.sfxVolume = 0.8;
    this._noiseBuffer = null;
    this._music = null;
    this._schedTimer = null;
  }

  /** Must be called from a user gesture or the context stays suspended. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { this.enabled = false; return; }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    // A gentle limiter keeps overlapping explosions from clipping.
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 12;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.master);

    this._buildNoise();
  }

  _buildNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buf;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  get ready() { return this.enabled && this.ctx && this.ctx.state === 'running'; }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMusicVolume(v) { this.musicVolume = v; if (this._music && this.musicGain) this.musicGain.gain.setTargetAtTime(v, this.now, 0.2); }
  setSfxVolume(v) { this.sfxVolume = v; if (this.sfxGain) this.sfxGain.gain.value = v; }

  _noise(dur, { gain = 0.4, type = 'lowpass', freq = 1200, q = 1, sweepTo = null, dest = null } = {}) {
    if (!this.ready) return null;
    const t = this.now;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t);
    filt.Q.value = q;
    if (sweepTo != null) filt.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(dest || this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
    return { src, g, filt };
  }

  _tone(freq, dur, { type = 'square', gain = 0.2, slideTo = null, delay = 0, dest = null, attack = 0.004 } = {}) {
    if (!this.ready) return null;
    const t = this.now + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(dest || this.sfxGain);
    osc.start(t); osc.stop(t + dur + 0.02);
    return { osc, g };
  }

  // ---- Game sound effects -------------------------------------------------

  /**
   * Gunshot. `profile` shapes the character: body frequency, punch, tail length.
   * Every weapon passes its own numbers so nothing sounds identical.
   */
  shoot(profile = {}) {
    if (!this.ready) return;
    const {
      body = 900, punch = 0.5, tail = 0.14, pitch = 220, tone = 'square', volume = 0.5,
    } = profile;
    this._noise(tail, { gain: 0.45 * volume, type: 'lowpass', freq: body, sweepTo: body * 0.25, q: 1.2 });
    this._tone(pitch, tail * 0.7, { type: tone, gain: 0.22 * volume * punch, slideTo: pitch * 0.35 });
    // Crack — a very short high-passed transient.
    this._noise(0.035, { gain: 0.3 * volume * punch, type: 'highpass', freq: 3000, q: 0.7 });
  }

  melee(pitch = 400, whoosh = 0.18) {
    this._noise(whoosh, { gain: 0.28, type: 'bandpass', freq: 800, sweepTo: 300, q: 2 });
    this._tone(pitch, 0.1, { type: 'triangle', gain: 0.1, slideTo: pitch * 0.6 });
  }

  hit(kind = 'flesh') {
    if (kind === 'metal') {
      this._tone(520 + Math.random() * 200, 0.09, { type: 'square', gain: 0.12, slideTo: 180 });
      this._noise(0.07, { gain: 0.18, type: 'highpass', freq: 2600 });
    } else if (kind === 'crit') {
      this._tone(1400, 0.09, { type: 'triangle', gain: 0.18, slideTo: 500 });
      this._tone(2100, 0.06, { type: 'sine', gain: 0.12, delay: 0.03 });
    } else {
      this._noise(0.09, { gain: 0.22, type: 'lowpass', freq: 700, sweepTo: 200 });
    }
  }

  /** Distinct, unmistakable crack — you should know without reading a number. */
  headshot() {
    this._tone(1850, 0.07, { type: 'square', gain: 0.16, slideTo: 900 });
    this._tone(2600, 0.05, { type: 'sine', gain: 0.13, delay: 0.02 });
    this._tone(620, 0.16, { type: 'triangle', gain: 0.12, slideTo: 220, delay: 0.03 });
    this._noise(0.05, { gain: 0.24, type: 'highpass', freq: 5200 });
  }

  hurt() {
    this._tone(180, 0.28, { type: 'sawtooth', gain: 0.2, slideTo: 70 });
    this._noise(0.2, { gain: 0.2, type: 'lowpass', freq: 500, sweepTo: 120 });
  }

  explode(size = 1) {
    this._noise(0.55 * size, { gain: 0.6, type: 'lowpass', freq: 900, sweepTo: 60, q: 0.8 });
    this._tone(90, 0.5 * size, { type: 'sine', gain: 0.35, slideTo: 30 });
  }

  /**
   * Reload, in three beats: the magazine release, the new one seating, and the
   * bolt going home. One undifferentiated click gives the player no sense of
   * how far through a two-second reload they are — which matters, because that
   * is exactly when something is walking toward them.
   */
  reload(stage = 0) {
    if (!this.ready) return;
    if (stage === 0) {
      // Catch releases, magazine drops free.
      this._tone(880, 0.04, { type: 'square', gain: 0.09 });
      this._noise(0.06, { gain: 0.13, type: 'highpass', freq: 2600 });
      this._noise(0.16, { gain: 0.07, type: 'bandpass', freq: 420, q: 2, delay: 0.1 });
    } else if (stage === 1) {
      // New magazine seats — a solid, low knock.
      this._noise(0.09, { gain: 0.2, type: 'bandpass', freq: 700, q: 1.6 });
      this._tone(190, 0.11, { type: 'triangle', gain: 0.14, slideTo: 120 });
    } else {
      // Bolt home. The bright one, so it reads as "ready" from across a room.
      this._noise(0.06, { gain: 0.26, type: 'highpass', freq: 1800 });
      this._tone(1250, 0.05, { type: 'square', gain: 0.12, slideTo: 700 });
      this._tone(320, 0.12, { type: 'triangle', gain: 0.1, slideTo: 210, delay: 0.02 });
    }
  }

  pickup() {
    [660, 880, 1320].forEach((f, i) => this._tone(f, 0.14, { type: 'triangle', gain: 0.16, delay: i * 0.06 }));
  }

  deny() {
    this._tone(200, 0.16, { type: 'square', gain: 0.16, slideTo: 120 });
    this._tone(150, 0.16, { type: 'square', gain: 0.12, slideTo: 90, delay: 0.06 });
  }

  ui(freq = 700) { this._tone(freq, 0.06, { type: 'square', gain: 0.08 }); }

  /** Slot-machine tick while the chest cycles through weapons. */
  slotTick(pitchMul = 1) {
    this._tone(900 * pitchMul, 0.035, { type: 'square', gain: 0.09 });
    this._noise(0.02, { gain: 0.08, type: 'highpass', freq: 4000 });
  }

  slotLand(rarity = 0) {
    const chords = [
      [440, 554, 659],
      [523, 659, 784],
      [587, 740, 880, 1174],
      [659, 830, 988, 1318, 1568],
    ];
    const chord = chords[Math.min(rarity, chords.length - 1)];
    chord.forEach((f, i) => this._tone(f, 0.9, { type: 'triangle', gain: 0.16, delay: i * 0.05 }));
    this._noise(0.5, { gain: 0.2, type: 'lowpass', freq: 2000, sweepTo: 300 });
  }

  /**
   * Radio-filtered blip under intercom lines. `warmth` drops the pitch and
   * level — the doctor's channel gets colder and quieter as the run goes on.
   */
  radioBlip(warmth = 1) {
    this._tone(560 + 640 * warmth, 0.04 + (1 - warmth) * 0.03, { type: 'square', gain: 0.02 + 0.03 * warmth });
    this._noise(0.06, { gain: 0.02 + 0.03 * warmth, type: 'bandpass', freq: 700 + 1100 * warmth, q: 4 });
  }

  glitch(intensity = 1) {
    if (!this.ready) return;
    for (let i = 0; i < 6 * intensity; i++) {
      this._noise(0.04, {
        gain: 0.12, type: 'bandpass', q: 8,
        freq: 200 + Math.random() * 5000,
      });
      this._tone(80 + Math.random() * 2000, 0.05, { type: 'square', gain: 0.06, delay: i * 0.035 });
    }
  }

  doorOpen() {
    this._noise(0.8, { gain: 0.25, type: 'lowpass', freq: 400, sweepTo: 900 });
    this._tone(70, 0.7, { type: 'sine', gain: 0.2, slideTo: 130 });
  }

  bossRoar(depth = 1) {
    this._tone(70 / depth, 1.4, { type: 'sawtooth', gain: 0.3, slideTo: 40 / depth });
    this._noise(1.4, { gain: 0.35, type: 'lowpass', freq: 600, sweepTo: 90 });
    this._tone(140 / depth, 1.1, { type: 'square', gain: 0.12, slideTo: 60 });
  }

  levelUp() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this._tone(f, 0.35, { type: 'triangle', gain: 0.16, delay: i * 0.08 }));
  }

  // ---- Music --------------------------------------------------------------

  /**
   * Start (or crossfade to) a floor's music bed. The pattern is regenerated
   * every bar so it never loops audibly.
   */
  /**
   * Hand the score over to a new one without a gap.
   *
   * A boss fight used to arrive via stopMusic() and a setTimeout, which meant
   * half a second of nothing exactly where the tension should peak. Ducking
   * into the new bed and swapping the pattern on the beat keeps the pulse.
   */
  crossfadeMusic(cfg, seconds = 0.9) {
    if (!this.ready) { this.startMusic(cfg); return; }
    const t = this.now;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.12, t, seconds / 4);
    clearTimeout(this._xfTimer);
    this._xfTimer = setTimeout(() => {
      const keepStep = this._music ? this._music.step : 0;
      this.startMusic({ ...cfg, step: keepStep });
    }, seconds * 500);
  }

  startMusic(cfg) {
    if (!this.ready) return;
    this._music = Object.assign({
      root: 55, scale: 'minor', bpm: 96, wave: 'sawtooth', bass: true,
      arp: true, pad: true, intensity: 0.6, step: 0, nextTime: this.now + 0.1,
    }, cfg);
    this.musicGain.gain.cancelScheduledValues(this.now);
    this.musicGain.gain.setTargetAtTime(this.musicVolume, this.now, 0.8);
    if (!this._schedTimer) this._schedTimer = setInterval(() => this._schedule(), 60);
  }

  setMusicIntensity(v) { if (this._music) this._music.intensity = v; }

  stopMusic(fade = 1.2) {
    // A crossfade scheduled a moment ago would otherwise restart the score
    // half a second after it was told to stop.
    clearTimeout(this._xfTimer);
    this._xfTimer = null;
    if (!this.ready) return;
    this.musicGain.gain.setTargetAtTime(0.0001, this.now, fade / 3);
    setTimeout(() => {
      if (this._schedTimer) { clearInterval(this._schedTimer); this._schedTimer = null; }
      this._music = null;
    }, fade * 1000);
  }

  _schedule() {
    const m = this._music;
    if (!m || !this.ready) return;
    const spb = 60 / m.bpm;
    const stepDur = spb / 2; // eighth notes
    const horizon = this.now + 0.35;
    let guard = 0;
    while (m.nextTime < horizon && guard++ < 32) {
      this._playStep(m, m.nextTime);
      m.nextTime += stepDur;
      m.step++;
    }
  }

  _playStep(m, t) {
    const scale = SCALES[m.scale] || SCALES.minor;
    const s = m.step;
    const bar = Math.floor(s / 8);
    const inBar = s % 8;
    const g = this.musicGain;

    // Bass on the downbeat and the "and" of 3.
    if (m.bass && (inBar === 0 || inBar === 5)) {
      const deg = [0, 0, 5, 3, 0, 6, 4, 5][bar % 8];
      const f = m.root * Math.pow(2, scale[deg % scale.length] / 12);
      this._toneAt(f, t, 0.42, { type: 'sine', gain: 0.3, dest: g });
      this._toneAt(f * 2, t, 0.16, { type: m.wave, gain: 0.06, dest: g });
    }

    // Arpeggio — density scales with combat intensity.
    if (m.arp && (inBar % 2 === 0 || m.intensity > 0.55)) {
      const idx = (s * 3 + bar) % scale.length;
      const oct = 3 + ((s >> 2) % 2);
      const f = m.root * Math.pow(2, scale[idx] / 12 + oct);
      this._toneAt(f, t, 0.16, { type: m.wave, gain: 0.035 + 0.05 * m.intensity, dest: g });
    }

    // Pad swell once per bar.
    if (m.pad && inBar === 0 && bar % 2 === 0) {
      const f = m.root * Math.pow(2, scale[0] / 12 + 2);
      this._toneAt(f, t, 1.9, { type: 'triangle', gain: 0.05, dest: g, attack: 0.5 });
      this._toneAt(f * Math.pow(2, scale[2] / 12), t, 1.9, { type: 'triangle', gain: 0.04, dest: g, attack: 0.6 });
    }

    // Percussion: kick on 0/4, hat on odds, snare on 4.
    if (inBar === 0 || inBar === 4) {
      this._toneAt(58, t, 0.16, { type: 'sine', gain: 0.28, slideTo: 32, dest: g });
    }
    if (inBar === 4 && m.intensity > 0.3) {
      this._noiseAt(t, 0.12, { gain: 0.1 * m.intensity, type: 'bandpass', freq: 1800, q: 1.2, dest: g });
    }
    if (inBar % 2 === 1 && m.intensity > 0.45) {
      this._noiseAt(t, 0.045, { gain: 0.045, type: 'highpass', freq: 7000, dest: g });
    }
  }

  _toneAt(freq, t, dur, { type = 'sine', gain = 0.1, slideTo = null, dest = null, attack = 0.01 } = {}) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(gain, t + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gn); gn.connect(dest || this.musicGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _noiseAt(t, dur, { gain = 0.1, type = 'highpass', freq = 4000, q = 1, dest = null } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type; filt.frequency.value = freq; filt.Q.value = q;
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(gain, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(gn); gn.connect(dest || this.musicGain);
    src.start(t); src.stop(t + dur + 0.02);
  }
}

export const audio = new AudioEngine();
