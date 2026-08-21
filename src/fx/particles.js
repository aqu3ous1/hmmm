// Sparks, gibs, shockwaves, tracers and floating damage numbers.
// Particles share one InstancedMesh; rings and tracers are small pooled meshes.

import * as THREE from '../../vendor/three.module.js';
import { UNIT } from '../world/geometry.js';

const MAX_P = 1200;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0).setPosition(0, -9999, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    for (let i = 0; i < MAX_P; i++) {
      this.items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 0.1, color: 0xffffff, gravity: 12, drag: 0.9, spin: 0, rot: 0, fade: true });
    }
    this.mesh = new THREE.InstancedMesh(
      UNIT.box,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false }),
      MAX_P,
    );
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this._c = new THREE.Color();
    for (let i = 0; i < MAX_P; i++) this.mesh.setMatrixAt(i, HIDDEN);

    // Expanding rings for explosions / slams / spawn markers.
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 28);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, life: 0, maxLife: 1, from: 0, to: 1, flat: true });
    }

    // Short-lived beams: tracers, lightning arcs, grapple lines.
    this.beams = [];
    for (let i = 0; i < 32; i++) {
      const m = new THREE.Mesh(UNIT.box, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
      }));
      m.visible = false;
      scene.add(m);
      this.beams.push({ mesh: m, life: 0, maxLife: 1, width: 0.03 });
    }

    // Dynamic lights for muzzle flashes and blasts.
    this.lights = [];
    for (let i = 0; i < 5; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 16, 2);
      l.visible = false;
      scene.add(l);
      this.lights.push({ light: l, life: 0, maxLife: 1, power: 0 });
    }
  }

  spawn(o) {
    for (let i = 0; i < MAX_P; i++) {
      const p = this.items[i];
      if (p.alive) continue;
      p.alive = true;
      p.x = o.x; p.y = o.y; p.z = o.z;
      p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
      p.life = p.maxLife = o.life ?? 0.6;
      p.size = o.size ?? 0.08;
      p.color = o.color ?? 0xffffff;
      p.gravity = o.gravity ?? 12;
      p.drag = o.drag ?? 0.92;
      p.spin = o.spin ?? 0;
      p.rot = Math.random() * 6.28;
      p.fade = o.fade !== false;
      return p;
    }
    return null;
  }

  burst(x, y, z, count, opts = {}) {
    const speed = opts.speed ?? 6;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (opts.cone ? Math.random() * 0.8 : Math.random() * Math.PI - Math.PI / 2);
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn({
        x, y, z,
        vx: Math.cos(a) * Math.cos(e) * s + (opts.dx || 0) * (opts.push || 0),
        vy: Math.sin(e) * s + (opts.up || 2),
        vz: Math.sin(a) * Math.cos(e) * s + (opts.dz || 0) * (opts.push || 0),
        life: (opts.life ?? 0.55) * (0.6 + Math.random() * 0.8),
        size: (opts.size ?? 0.08) * (0.6 + Math.random() * 0.9),
        color: Array.isArray(opts.color) ? opts.color[(Math.random() * opts.color.length) | 0] : (opts.color ?? 0xffffff),
        gravity: opts.gravity ?? 14,
        drag: opts.drag ?? 0.9,
        spin: opts.spin ?? 8,
      });
    }
  }

  ring(x, y, z, { from = 0.4, to = 6, life = 0.5, color = 0xffffff, flat = true } = {}) {
    for (const r of this.rings) {
      if (r.life > 0) continue;
      r.life = r.maxLife = life;
      r.from = from; r.to = to; r.flat = flat;
      r.mesh.position.set(x, y, z);
      r.mesh.material.color.setHex(color);
      r.mesh.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
      r.mesh.visible = true;
      return r;
    }
    return null;
  }

  beam(ax, ay, az, bx, by, bz, { life = 0.07, color = 0xffffff, width = 0.016 } = {}) {
    for (const b of this.beams) {
      if (b.life > 0) continue;
      b.life = b.maxLife = life;
      b.width = width;
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const len = Math.hypot(dx, dy, dz) || 0.001;
      _v.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
      _s.set(width, len, width);
      _m.compose(_v, _q, _s);
      b.mesh.matrix.copy(_m);
      b.mesh.matrixAutoUpdate = false;
      b.mesh.material.color.setHex(color);
      b.mesh.visible = true;
      return b;
    }
    return null;
  }

  /** Jagged multi-segment arc, used for chain lightning. */
  arc(ax, ay, az, bx, by, bz, color = 0x8ff0ff, segments = 5) {
    let px = ax, py = ay, pz = az;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const jitter = i === segments ? 0 : 0.55;
      const nx = ax + (bx - ax) * t + (Math.random() - 0.5) * jitter;
      const ny = ay + (by - ay) * t + (Math.random() - 0.5) * jitter;
      const nz = az + (bz - az) * t + (Math.random() - 0.5) * jitter;
      this.beam(px, py, pz, nx, ny, nz, { color, width: 0.018, life: 0.08 });
      px = nx; py = ny; pz = nz;
    }
  }

  flash(x, y, z, color, power = 3, life = 0.08, range = 14) {
    for (const l of this.lights) {
      if (l.life > 0) continue;
      l.life = l.maxLife = life;
      l.power = power;
      l.light.position.set(x, y, z);
      l.light.color.setHex(color);
      l.light.distance = range;
      l.light.intensity = power;
      l.light.visible = true;
      return l;
    }
    return null;
  }

  explosion(x, y, z, radius, color = 0xffa04a) {
    this.burst(x, y, z, 26, { color: [color, 0xffffff, 0xff6a2a], speed: radius * 3.2, size: 0.16, life: 0.6, up: 3 });
    this.ring(x, 0.08, z, { from: 0.5, to: radius * 1.6, life: 0.42, color });
    this.flash(x, y + 0.6, z, color, 7, 0.16, radius * 5);
  }

  update(dt) {
    for (let i = 0; i < MAX_P; i++) {
      const p = this.items[i];
      if (!p.alive) { this.mesh.setMatrixAt(i, HIDDEN); continue; }
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; this.mesh.setMatrixAt(i, HIDDEN); continue; }
      p.vy -= p.gravity * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vz *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy = -p.vy * 0.35; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += p.spin * dt;

      const t = p.life / p.maxLife;
      const sc = p.size * (p.fade ? (0.35 + t * 0.65) : 1);
      _v.set(p.x, p.y, p.z);
      _e.set(p.rot * 0.7, p.rot, p.rot * 1.3);
      _q.setFromEuler(_e);
      _s.set(sc, sc, sc);
      _m.compose(_v, _q, _s);
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, this._c.setHex(p.color));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    for (const r of this.rings) {
      if (r.life <= 0) { if (r.mesh.visible) r.mesh.visible = false; continue; }
      r.life -= dt;
      const t = 1 - Math.max(0, r.life) / r.maxLife;
      const s = r.from + (r.to - r.from) * (1 - Math.pow(1 - t, 2));
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = Math.max(0, 0.85 * (1 - t));
      if (r.life <= 0) r.mesh.visible = false;
    }

    for (const b of this.beams) {
      if (b.life <= 0) { if (b.mesh.visible) b.mesh.visible = false; continue; }
      b.life -= dt;
      b.mesh.material.opacity = Math.max(0, b.life / b.maxLife);
      if (b.life <= 0) b.mesh.visible = false;
    }

    for (const l of this.lights) {
      if (l.life <= 0) { if (l.light.visible) { l.light.visible = false; l.light.intensity = 0; } continue; }
      l.life -= dt;
      l.light.intensity = l.power * Math.max(0, l.life / l.maxLife);
      if (l.life <= 0) { l.light.visible = false; l.light.intensity = 0; }
    }
  }

  clear() {
    for (const p of this.items) p.alive = false;
    for (const r of this.rings) { r.life = 0; r.mesh.visible = false; }
    for (const b of this.beams) { b.life = 0; b.mesh.visible = false; }
    for (const l of this.lights) { l.life = 0; l.light.visible = false; l.light.intensity = 0; }
  }
}

// ---------------------------------------------------------------------------
// Floating damage numbers (DOM overlay — cheap, crisp, and easy to style)
// ---------------------------------------------------------------------------

export class DamageNumbers {
  constructor(container, camera) {
    this.container = container;
    this.camera = camera;
    this.pool = [];
    for (let i = 0; i < 28; i++) {
      const el = document.createElement('div');
      el.className = 'dmgnum';
      el.style.display = 'none';
      container.appendChild(el);
      this.pool.push({ el, life: 0, maxLife: 1, x: 0, y: 0, z: 0, vy: 2, offX: 0 });
    }
    this._v = new THREE.Vector3();
    // Gated here rather than at the dozen call sites that emit a number. A
    // setting enforced in one place cannot be half-implemented.
    this.enabled = true;
  }

  add(x, y, z, amount, kind = 'normal') {
    if (!this.enabled) return;
    for (const n of this.pool) {
      if (n.life > 0) continue;
      n.life = n.maxLife = kind === 'crit' ? 1.05 : 0.8;
      n.x = x; n.y = y; n.z = z;
      n.vy = 1.9 + Math.random() * 0.8;
      n.offX = (Math.random() - 0.5) * 30;
      n.el.textContent = kind === 'miss' ? 'null' : String(Math.max(1, Math.round(amount)));
      n.el.className = `dmgnum ${kind}`;
      n.el.style.display = 'block';
      return;
    }
  }

  update(dt, width, height) {
    for (const n of this.pool) {
      if (n.life <= 0) { if (n.el.style.display !== 'none') n.el.style.display = 'none'; continue; }
      n.life -= dt;
      n.y += n.vy * dt;
      n.vy -= 2.4 * dt;
      if (n.life <= 0) { n.el.style.display = 'none'; continue; }
      this._v.set(n.x, n.y, n.z).project(this.camera);
      if (this._v.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = 'block';
      const sx = (this._v.x * 0.5 + 0.5) * width + n.offX;
      const sy = (-this._v.y * 0.5 + 0.5) * height;
      const t = n.life / n.maxLife;
      n.el.style.transform = `translate(-50%,-50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${(0.85 + t * 0.35).toFixed(2)})`;
      n.el.style.opacity = String(Math.min(1, t * 2.2));
    }
  }

  clear() {
    for (const n of this.pool) { n.life = 0; n.el.style.display = 'none'; }
  }
}
