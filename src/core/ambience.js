// Room tone.
//
// Six of the seven things this game does to you are doing real work and the
// ambient layer was doing none. Every floor was *silent* between gunshots —
// which is not atmosphere, it is absence, and the ear reads absence as "the
// audio is broken" long before it reads it as tension.
//
// A place sounds like the machinery that keeps it running. So each floor gets
// a bed built from three parts:
//
//   1. a continuous tone — the hum of whatever is powering the room
//   2. a filtered noise floor — air handling, water, fire, static
//   3. sparse one-shots — a relay, a drip, a distant impact, a bird that is
//      not a bird — scheduled at irregular intervals so the ear never locks on
//
// It is all synthesised, it all ducks under gunfire through the same limiter,
// and it costs three oscillators and a filter per floor.

const TAU = Math.PI * 2;

/**
 * Per-floor beds. `hum` is the tonal layer, `air` shapes the noise floor, and
 * `events` are the one-shots with their mean gap in seconds.
 */
export const BEDS = {
  // B1 — Cold Storage. Refrigeration, and something settling in the dark.
  coldstorage: {
    hum: [{ f: 47, type: 'sine', g: 0.1 }, { f: 71, type: 'sine', g: 0.045 }],
    air: { freq: 320, q: 0.7, g: 0.05, sweep: 0.02 },
    events: [
      { gap: 9, kind: 'clank', pitch: 130, g: 0.1 },
      { gap: 17, kind: 'drip', pitch: 900, g: 0.06 },
      { gap: 26, kind: 'groan', pitch: 58, g: 0.09 },
    ],
  },
  // F1 — The Sorting Floor. Conveyors, and the arms working somewhere else.
  sorting: {
    hum: [{ f: 61, type: 'triangle', g: 0.08 }, { f: 122, type: 'sine', g: 0.03 }],
    air: { freq: 700, q: 1.1, g: 0.045, sweep: 0.05 },
    events: [
      { gap: 5.5, kind: 'servo', pitch: 320, g: 0.07 },
      { gap: 12, kind: 'clank', pitch: 190, g: 0.09 },
      { gap: 21, kind: 'buzzer', pitch: 240, g: 0.05 },
    ],
  },
  // F2 — The Server Farm. Fans, fans, fans, and a rack that shouldn't be warm.
  serverfarm: {
    hum: [{ f: 100, type: 'sine', g: 0.075 }, { f: 150, type: 'sine', g: 0.04 }, { f: 201, type: 'sine', g: 0.022 }],
    air: { freq: 2200, q: 0.5, g: 0.07, sweep: 0.03 },
    events: [
      { gap: 7, kind: 'relay', pitch: 1400, g: 0.045 },
      { gap: 13, kind: 'servo', pitch: 520, g: 0.05 },
      { gap: 29, kind: 'laugh', pitch: 210, g: 0.05 },
    ],
  },
  // F3 — Aquatics Lab. Pumps, water against glass, something moving in tank 7.
  aquatics: {
    hum: [{ f: 55, type: 'sine', g: 0.09 }, { f: 83, type: 'triangle', g: 0.035 }],
    air: { freq: 420, q: 1.6, g: 0.07, sweep: 0.09 },
    events: [
      { gap: 6, kind: 'bubble', pitch: 600, g: 0.06 },
      { gap: 11, kind: 'drip', pitch: 1100, g: 0.07 },
      { gap: 23, kind: 'groan', pitch: 44, g: 0.1 },
    ],
  },
  // F4 — The Neon Strip. Transformers, a jingle four rooms away, coins.
  neonstrip: {
    hum: [{ f: 120, type: 'sawtooth', g: 0.045 }, { f: 60, type: 'sine', g: 0.07 }],
    air: { freq: 1500, q: 0.8, g: 0.04, sweep: 0.06 },
    events: [
      { gap: 6, kind: 'coin', pitch: 1600, g: 0.055 },
      { gap: 10, kind: 'jingle', pitch: 660, g: 0.05 },
      { gap: 19, kind: 'buzzer', pitch: 180, g: 0.05 },
    ],
  },
  // F5 — The Alpha Wing. Almost nothing. A ventilator, and a room being used.
  alphawing: {
    hum: [{ f: 41, type: 'sine', g: 0.085 }],
    air: { freq: 260, q: 0.9, g: 0.038, sweep: 0.015 },
    events: [
      { gap: 14, kind: 'breath', pitch: 200, g: 0.05 },
      { gap: 22, kind: 'clank', pitch: 150, g: 0.06 },
      { gap: 34, kind: 'groan', pitch: 52, g: 0.07 },
    ],
  },
  // F6 — The Garden. Insects that are not insects, and something growing fast.
  garden: {
    hum: [{ f: 73, type: 'triangle', g: 0.06 }, { f: 219, type: 'sine', g: 0.018 }],
    air: { freq: 3400, q: 0.4, g: 0.05, sweep: 0.12 },
    events: [
      { gap: 4.5, kind: 'chirp', pitch: 2400, g: 0.045 },
      { gap: 9, kind: 'creak', pitch: 300, g: 0.05 },
      { gap: 20, kind: 'breath', pitch: 130, g: 0.06 },
    ],
  },
  // F7 — The Kiln. Combustion, expansion, metal complaining about heat.
  kiln: {
    hum: [{ f: 38, type: 'sawtooth', g: 0.06 }, { f: 57, type: 'sine', g: 0.06 }],
    air: { freq: 900, q: 0.6, g: 0.085, sweep: 0.2 },
    events: [
      { gap: 5, kind: 'creak', pitch: 210, g: 0.075 },
      { gap: 9, kind: 'flare', pitch: 140, g: 0.08 },
      { gap: 18, kind: 'clank', pitch: 260, g: 0.08 },
    ],
  },
  // F8 — Hall of Mirrors. Almost anechoic, with a rehearsal happening nearby.
  mirrors: {
    hum: [{ f: 88, type: 'sine', g: 0.05 }, { f: 132, type: 'sine', g: 0.03 }],
    air: { freq: 5200, q: 0.35, g: 0.028, sweep: 0.02 },
    events: [
      { gap: 8, kind: 'chime', pitch: 1760, g: 0.05 },
      { gap: 15, kind: 'applause', pitch: 500, g: 0.05 },
      { gap: 27, kind: 'breath', pitch: 190, g: 0.045 },
    ],
  },
  // F9 — Substrate Layer. Data as sound: buses switching, carriers drifting.
  substrate: {
    hum: [{ f: 66, type: 'square', g: 0.035 }, { f: 99, type: 'sine', g: 0.05 }, { f: 264, type: 'sine', g: 0.014 }],
    air: { freq: 1800, q: 2.2, g: 0.045, sweep: 0.35 },
    events: [
      { gap: 3.5, kind: 'relay', pitch: 900, g: 0.04 },
      { gap: 7, kind: 'datablip', pitch: 2200, g: 0.038 },
      { gap: 16, kind: 'groan', pitch: 40, g: 0.08 },
    ],
  },
  // F10 — Root. The sound of a room with nothing behind its walls.
  root: {
    hum: [{ f: 33, type: 'sine', g: 0.11 }, { f: 49.5, type: 'sine', g: 0.05 }],
    air: { freq: 180, q: 3.0, g: 0.05, sweep: 0.5 },
    events: [
      { gap: 6, kind: 'datablip', pitch: 3000, g: 0.035 },
      { gap: 11, kind: 'groan', pitch: 31, g: 0.12 },
      { gap: 19, kind: 'breath', pitch: 90, g: 0.06 },
    ],
  },
};

/**
 * The ambient bed for one floor. Lives as long as the floor does, and is
 * rebuilt from scratch on a floor change rather than crossfaded — you are in
 * a lift for two seconds, which is exactly long enough for a hard change to
 * read as arriving somewhere else.
 */
export class Ambience {
  constructor(audio) {
    this.audio = audio;
    this.nodes = [];
    this.bed = null;
    this.gain = null;
    this.timers = [];
    this.level = 1;
  }

  get ctx() { return this.audio.ctx; }

  start(floorId) {
    this.stop();
    if (!this.audio.ready) return;
    const bed = BEDS[floorId];
    if (!bed) return;
    this.bed = bed;
    const ctx = this.ctx;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(this.audio.sfxGain);
    // Fade in over a couple of seconds: a bed that snaps on is a bug sound.
    this.gain.gain.setTargetAtTime(this.level, ctx.currentTime, 0.9);

    // --- tonal layer ---
    for (const h of bed.hum) {
      const osc = ctx.createOscillator();
      osc.type = h.type;
      osc.frequency.value = h.f;
      const g = ctx.createGain();
      g.gain.value = h.g;
      // A slow tremolo so the hum breathes instead of sitting perfectly still.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.11;
      const lfoG = ctx.createGain();
      lfoG.gain.value = h.g * 0.35;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      osc.connect(g); g.connect(this.gain);
      osc.start(); lfo.start();
      this.nodes.push(osc, lfo, g, lfoG);
    }

    // --- noise floor ---
    if (bed.air) {
      const src = ctx.createBufferSource();
      src.buffer = this.audio._noiseBuffer;
      src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = bed.air.freq;
      filt.Q.value = bed.air.q;
      const g = ctx.createGain();
      g.gain.value = bed.air.g;
      // Drift the filter, so the air moves through the room.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + Math.random() * 0.06;
      const lfoG = ctx.createGain();
      lfoG.gain.value = bed.air.freq * bed.air.sweep;
      lfo.connect(lfoG); lfoG.connect(filt.frequency);
      src.connect(filt); filt.connect(g); g.connect(this.gain);
      src.start(); lfo.start();
      this.nodes.push(src, lfo, filt, g, lfoG);
      this.airFilter = filt;
    }

    // --- one-shots, on irregular timers ---
    for (const e of bed.events) this._scheduleEvent(e);
  }

  _scheduleEvent(e) {
    // Jitter hard: an event on a fixed period stops being a room and starts
    // being a metronome within about four repetitions.
    const wait = e.gap * (0.55 + Math.random() * 0.9) * 1000;
    const t = setTimeout(() => {
      if (this.bed) {
        this._oneShot(e);
        this._scheduleEvent(e);
      }
    }, wait);
    this.timers.push(t);
  }

  _oneShot(e) {
    if (!this.audio.ready || !this.gain) return;
    const a = this.audio;
    const g = e.g * (0.7 + Math.random() * 0.6);
    const dest = this.gain;
    switch (e.kind) {
      case 'clank':
        a._noise(0.14, { gain: g * 1.4, type: 'bandpass', freq: e.pitch * 4, q: 3, dest });
        a._tone(e.pitch, 0.3, { type: 'triangle', gain: g, slideTo: e.pitch * 0.7, dest });
        break;
      case 'drip':
        a._tone(e.pitch, 0.12, { type: 'sine', gain: g, slideTo: e.pitch * 0.4, dest, attack: 0.001 });
        break;
      case 'groan':
        a._tone(e.pitch, 2.4, { type: 'sawtooth', gain: g * 0.5, slideTo: e.pitch * 0.85, dest, attack: 0.6 });
        a._noise(2.0, { gain: g * 0.3, type: 'lowpass', freq: 200, dest });
        break;
      case 'servo':
        a._tone(e.pitch, 0.42, { type: 'square', gain: g * 0.5, slideTo: e.pitch * 1.5, dest });
        a._noise(0.4, { gain: g * 0.5, type: 'bandpass', freq: 1800, q: 6, dest });
        break;
      case 'relay':
        a._noise(0.035, { gain: g * 1.8, type: 'highpass', freq: e.pitch, dest });
        break;
      case 'buzzer':
        a._tone(e.pitch, 0.5, { type: 'square', gain: g * 0.6, dest });
        a._tone(e.pitch * 1.01, 0.5, { type: 'square', gain: g * 0.5, dest });
        break;
      case 'bubble':
        for (let i = 0; i < 4; i++) {
          a._tone(e.pitch * (0.8 + Math.random() * 0.8), 0.09, {
            type: 'sine', gain: g * 0.7, slideTo: e.pitch * 1.8, delay: i * 0.07, dest, attack: 0.002,
          });
        }
        break;
      case 'coin':
        for (let i = 0; i < 3; i++) {
          a._tone(e.pitch * (1 + i * 0.25), 0.1, { type: 'triangle', gain: g * 0.6, delay: i * 0.05, dest });
        }
        break;
      case 'jingle':
        [0, 4, 7, 12].forEach((n, i) => a._tone(e.pitch * Math.pow(2, n / 12), 0.18, {
          type: 'square', gain: g * 0.4, delay: i * 0.11, dest,
        }));
        break;
      case 'chirp':
        a._tone(e.pitch, 0.06, { type: 'sine', gain: g, slideTo: e.pitch * 1.7, dest, attack: 0.002 });
        a._tone(e.pitch * 1.2, 0.05, { type: 'sine', gain: g * 0.7, slideTo: e.pitch * 2, delay: 0.09, dest, attack: 0.002 });
        break;
      case 'creak':
        a._tone(e.pitch, 0.9, { type: 'sawtooth', gain: g * 0.35, slideTo: e.pitch * 1.35, dest, attack: 0.3 });
        break;
      case 'flare':
        a._noise(0.7, { gain: g * 1.1, type: 'lowpass', freq: 900, sweepTo: 200, dest });
        break;
      case 'chime':
        [0, 7, 12].forEach((n, i) => a._tone(e.pitch * Math.pow(2, n / 12), 1.4, {
          type: 'sine', gain: g * 0.35, delay: i * 0.06, dest, attack: 0.01,
        }));
        break;
      case 'applause':
        a._noise(1.1, { gain: g * 0.8, type: 'bandpass', freq: e.pitch * 4, q: 0.8, dest });
        break;
      case 'breath':
        a._noise(0.9, { gain: g * 0.7, type: 'bandpass', freq: e.pitch * 3, q: 1.4, sweepTo: e.pitch * 6, dest });
        break;
      case 'datablip':
        for (let i = 0; i < 5; i++) {
          a._tone(e.pitch * (0.5 + Math.random()), 0.025, {
            type: 'square', gain: g * 0.5, delay: i * 0.035, dest,
          });
        }
        break;
      case 'laugh':
        // Jim, four rooms away, at something you did not see.
        for (let i = 0; i < 6; i++) {
          a._tone(e.pitch * (1 + Math.sin(i * 1.7) * 0.18), 0.09, {
            type: 'sawtooth', gain: g * 0.45 * (1 - i * 0.1), delay: i * 0.1, dest,
          });
        }
        break;
      default:
        break;
    }
  }

  /**
   * Duck the bed. Used while a boss is alive — a room tone under a boss fight
   * is clutter, and bringing it back afterwards is most of the relief.
   */
  setLevel(v, seconds = 1.2) {
    this.level = v;
    if (this.gain && this.audio.ready) {
      this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, seconds / 3);
    }
  }

  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    this.bed = null;
    const nodes = this.nodes;
    const g = this.gain;
    this.nodes = [];
    this.gain = null;
    this.airFilter = null;
    if (!g || !this.audio.ready) return;
    g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25);
    setTimeout(() => {
      for (const n of nodes) { try { n.stop?.(); n.disconnect(); } catch { /* already gone */ } }
      try { g.disconnect(); } catch { /* already gone */ }
    }, 900);
  }
}
