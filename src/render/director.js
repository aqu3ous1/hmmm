// Cutscene director.
//
// The game had no camera language at all: every beat in the story — waking up
// in the dark, the door of a boss room opening, the moment Kimvatch stops
// pretending — happened with the camera bolted to the player's eyes and a line
// of text sliding in at the bottom. That is a radio play with a first-person
// shooter attached.
//
// A cutscene here is a list of shots. Each shot names where the camera is,
// what it is looking at, how long it takes to get there, and optionally a line
// to say while it does. Positions can be absolute vectors or functions
// evaluated at play time, so a shot can orbit whatever the boss happens to be.
//
//   director.play([
//     { from: [0, 6, -8], to: [0, 2, -3], look: () => boss.pos, time: 3.2,
//       line: ['CROOK KING', 'You are standing in my floor.'] },
//   ], { onDone });
//
// Input is suppressed for the duration and any key skips to the end, because a
// cutscene you cannot skip is a cutscene you resent the second time.

import * as THREE from '../../vendor/three.module.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _look = new THREE.Vector3();

/** Smootherstep — no visible acceleration at either end of a camera move. */
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);

const resolve = (v, fallback) => {
  if (typeof v === 'function') v = v();
  if (!v) return fallback;
  if (v.isVector3) return _a.copy(v);
  return _a.set(v[0], v[1], v[2]);
};

export class Director {
  constructor(hud) {
    this.hud = hud;
    this.active = false;
    this.shots = null;
    this.index = 0;
    this.t = 0;
    this.onDone = null;
    this.skippable = true;
    this._letterbox = 0;
    this._built = false;
  }

  _ensureDom() {
    if (this._built) return;
    const wrap = document.createElement('div');
    wrap.id = 'cinematic';
    wrap.className = 'hidden';
    wrap.innerHTML = `
      <div class="barTop"></div>
      <div class="barBottom"></div>
      <div id="cineText"><span id="cineWho"></span><span id="cineLine"></span></div>
      <div id="cineSkip">ANY KEY — SKIP</div>`;
    document.body.appendChild(wrap);
    this.el = wrap;
    this.elWho = wrap.querySelector('#cineWho');
    this.elLine = wrap.querySelector('#cineLine');
    this.elSkip = wrap.querySelector('#cineSkip');
    this._built = true;
  }

  /**
   * @param {Array} shots  [{ from, to, look, lookFrom, time, fov, line, hold, shake }]
   * @param {{onDone?:Function, skippable?:boolean}} opts
   */
  play(shots, { onDone = null, skippable = true } = {}) {
    if (!shots || !shots.length) { onDone?.(); return; }
    this._ensureDom();
    this.shots = shots;
    this.index = 0;
    this.t = 0;
    this.active = true;
    this.onDone = onDone;
    this.skippable = skippable;
    this.el.classList.remove('hidden');
    this.elSkip.style.display = skippable ? '' : 'none';
    this._applyLine(shots[0]);
  }

  skip() {
    if (!this.active || !this.skippable) return;
    this._finish();
  }

  /**
   * Stop without running the completion callback. Used when the thing the
   * cutscene was about stops existing — a floor change, a wipe mid-intro — in
   * which case finishing it would hand the camera back to a dead boss.
   */
  cancel() {
    if (!this.active) return;
    this.active = false;
    this.shots = null;
    this.onDone = null;
    if (this.el) this.el.classList.add('hidden');
  }

  _finish() {
    this.active = false;
    this.shots = null;
    if (this.el) this.el.classList.add('hidden');
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }

  _applyLine(shot) {
    if (!shot.line) { this.elWho.textContent = ''; this.elLine.textContent = ''; return; }
    const [who, text] = shot.line;
    this.elWho.textContent = who || '';
    this.elLine.textContent = text || '';
    this.el.classList.add('speaking');
  }

  /**
   * Drive the camera for this frame. Returns true if it owns the camera, in
   * which case the caller must not apply the player's view.
   */
  update(dt, camera) {
    if (!this.active) return false;
    const shot = this.shots[this.index];
    const dur = Math.max(0.01, shot.time ?? 2);
    this.t += dt;

    const k = ease(Math.min(1, this.t / dur));
    const from = resolve(shot.from, camera.position).clone();
    const to = resolve(shot.to, from);
    camera.position.lerpVectors(from, to, k);

    // Look target can also travel, which is what sells a reveal.
    const lookA = shot.lookFrom ? resolve(shot.lookFrom, null).clone() : null;
    const lookB = resolve(shot.look, _b.set(0, 0, 0)).clone();
    _look.copy(lookA ? lookA.lerp(lookB, k) : lookB);
    camera.lookAt(_look);

    if (shot.shake) {
      const s = shot.shake * (1 - k * 0.6);
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
    }
    if (shot.fov && camera.fov !== shot.fov) {
      camera.fov += (shot.fov - camera.fov) * Math.min(1, dt * 3);
      camera.updateProjectionMatrix();
    }

    if (this.t >= dur + (shot.hold || 0)) {
      this.index++;
      this.t = 0;
      if (this.index >= this.shots.length) { this._finish(); return false; }
      this._applyLine(this.shots[this.index]);
    }
    return true;
  }
}

/**
 * Shot builders. Cutscenes read much better as a sentence than as six numbers,
 * and every one of these is used more than once.
 */
export const shot = {
  /** Slow push toward a target from behind and above. */
  push(target, { dist = 7, height = 3, close = 3, time = 3, line = null, hold = 0 } = {}) {
    const dir = () => {
      const t = typeof target === 'function' ? target() : target;
      return t;
    };
    return {
      from: () => { const t = dir(); return [t.x, t.y + height, t.z - dist]; },
      to: () => { const t = dir(); return [t.x, t.y + height * 0.4, t.z - close]; },
      look: () => { const t = dir(); return [t.x, t.y + 1.2, t.z]; },
      time, line, hold,
    };
  },

  /** Arc around a target — the standard "here is your boss" move. */
  orbit(target, { radius = 8, height = 4, from = 0, to = 1.4, time = 4, line = null, hold = 0, shake = 0 } = {}) {
    const at = () => (typeof target === 'function' ? target() : target);
    return {
      from: () => { const t = at(); return [t.x + Math.cos(from) * radius, t.y + height, t.z + Math.sin(from) * radius]; },
      to: () => { const t = at(); return [t.x + Math.cos(to) * radius, t.y + height * 0.7, t.z + Math.sin(to) * radius]; },
      look: () => { const t = at(); return [t.x, t.y + 1.6, t.z]; },
      time, line, hold, shake,
    };
  },

  /** Drift upward off a target, for endings and departures. */
  rise(target, { height = 2, to = 9, time = 4, line = null, hold = 0 } = {}) {
    const at = () => (typeof target === 'function' ? target() : target);
    return {
      from: () => { const t = at(); return [t.x + 1.5, t.y + height, t.z + 3]; },
      to: () => { const t = at(); return [t.x + 1.5, t.y + to, t.z + 5]; },
      look: () => { const t = at(); return [t.x, t.y + 1, t.z]; },
      time, line, hold,
    };
  },

  /** Hold on a spot and let the line land. */
  hold(pos, look, { time = 2.4, line = null } = {}) {
    return { from: pos, to: pos, look, time, line };
  },
};
