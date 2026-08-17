// Pooled projectiles rendered through a single InstancedMesh, so a screen full
// of boss bullets still costs one draw call.

import * as THREE from '../../vendor/three.module.js';
import { UNIT } from '../world/geometry.js';

const MAX = 900;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0).setPosition(0, -9999, 0);

export class ProjectileSystem {
  constructor(scene) {
    this.pool = [];
    for (let i = 0; i < MAX; i++) this.pool.push(this._blank());
    this.active = 0;

    // Six radial segments made a bolt read as a flat hexagon whenever one
    // passed close to the camera, which on a floor full of ranged enemies is
    // constantly. Ten is still cheap and actually looks round.
    const geo = new THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.5, 1.0, 4, 10)
      : UNIT.lowSphere.clone();
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 }),
      MAX,
    );
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = MAX;
    scene.add(this.mesh);
    this._color = new THREE.Color();
    for (let i = 0; i < MAX; i++) {
      this.mesh.setMatrixAt(i, HIDDEN);
      this.mesh.setColorAt(i, this._color.setHex(0xffffff));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  _blank() {
    return {
      alive: false, hostile: false,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      life: 0, damage: 0, radius: 0.16, size: 0.16, color: 0xffffff,
      gravity: 0, pierce: 0, bounces: 0, bounceGain: 1, homing: 0,
      traits: null, params: null, weaponId: null, hitList: null,
      spin: 0, glowTrail: 0, targetId: -1, seed: 0,
    };
  }

  spawn(opts) {
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (p.alive) continue;
      Object.assign(p, this._blank(), opts, { alive: true });
      p.hitList = opts.pierce ? new Set() : null;
      p.seed = Math.random() * 100;
      return p;
    }
    return null;
  }

  clear() {
    for (const p of this.pool) p.alive = false;
    this.sync();
  }

  /**
   * Step every projectile. Callers supply the world hooks so this file stays
   * free of gameplay knowledge.
   *
   * hooks: { level, enemies, player, onEnemyHit(p, enemy), onPlayerHit(p),
   *          onWallHit(p, nx, nz), onExpire(p) }
   */
  update(dt, hooks) {
    const { level } = hooks;
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;

      p.life -= dt;
      if (p.life <= 0) { p.alive = false; hooks.onExpire?.(p); continue; }

      if (p.gravity) p.vy -= p.gravity * dt;

      if (p.homing && !p.hostile) {
        const t = hooks.findHomingTarget?.(p);
        if (t) {
          _dir.set(t.pos.x - p.x, (t.feetY + t.height * 0.5) - p.y, t.pos.z - p.z).normalize();
          const sp = Math.hypot(p.vx, p.vy, p.vz);
          p.vx += _dir.x * p.homing * sp * dt * 3;
          p.vy += _dir.y * p.homing * sp * dt * 3;
          p.vz += _dir.z * p.homing * sp * dt * 3;
          const ns = Math.hypot(p.vx, p.vy, p.vz) || 1;
          p.vx = (p.vx / ns) * sp; p.vy = (p.vy / ns) * sp; p.vz = (p.vz / ns) * sp;
        }
      } else if (p.homing && p.hostile) {
        const px = hooks.player.pos.x, py = hooks.player.eyeY(), pz = hooks.player.pos.z;
        _dir.set(px - p.x, py - p.y, pz - p.z).normalize();
        const sp = Math.hypot(p.vx, p.vy, p.vz);
        p.vx += _dir.x * p.homing * sp * dt;
        p.vy += _dir.y * p.homing * sp * dt;
        p.vz += _dir.z * p.homing * sp * dt;
        const ns = Math.hypot(p.vx, p.vy, p.vz) || 1;
        p.vx = (p.vx / ns) * sp; p.vy = (p.vy / ns) * sp; p.vz = (p.vz / ns) * sp;
      }

      const stepX = p.vx * dt, stepY = p.vy * dt, stepZ = p.vz * dt;
      const stepLen = Math.hypot(stepX, stepZ);

      // Walls (XZ only — ceilings/floors handled by the height check below).
      if (stepLen > 0.0001) {
        const r = level.raycast(p.x, p.z, stepX, stepZ, stepLen + p.radius);
        if (r.hit) {
          if (p.bounces > 0) {
            p.bounces--;
            if (r.nx) p.vx = -p.vx;
            if (r.nz) p.vz = -p.vz;
            p.damage *= p.bounceGain;
            p.x += p.vx * dt * 0.5;
            p.z += p.vz * dt * 0.5;
            hooks.onWallHit?.(p, r.nx, r.nz, true);
            continue;
          }
          p.x += (stepX / stepLen) * Math.max(0, r.dist - 0.05);
          p.z += (stepZ / stepLen) * Math.max(0, r.dist - 0.05);
          p.y += stepY * (r.dist / Math.max(stepLen, 1e-5));
          p.alive = false;
          hooks.onWallHit?.(p, r.nx, r.nz, false);
          continue;
        }
      }

      p.x += stepX; p.y += stepY; p.z += stepZ;

      if (p.y < 0.05) {
        p.y = 0.05;
        if (p.bounces > 0) { p.bounces--; p.vy = Math.abs(p.vy) * 0.55; }
        else { p.alive = false; hooks.onWallHit?.(p, 0, 0, false); continue; }
      }
      if (p.y > 4.4) {
        if (p.vy > 0) { p.y = 4.4; p.vy = -Math.abs(p.vy) * 0.4; }
      }

      // Collision
      if (p.hostile) {
        const pl = hooks.player;
        const dx = p.x - pl.pos.x, dz = p.z - pl.pos.z;
        const dy = p.y - (pl.pos.y + pl.height * 0.5);
        if (dx * dx + dz * dz < (p.radius + pl.radius) ** 2 && Math.abs(dy) < pl.height * 0.65) {
          p.alive = false;
          hooks.onPlayerHit?.(p);
          continue;
        }
      } else {
        const hit = hooks.findEnemyHit?.(p);
        if (hit) {
          if (p.hitList) p.hitList.add(hit.id);
          // onEnemyHit returns true when the projectile should be consumed.
          const consumed = hooks.onEnemyHit?.(p, hit);
          if (consumed) { p.alive = false; continue; }
          if (p.pierce > 0) p.pierce--;
        }
      }
    }
  }

  /** Push positions into the instance buffer. Called once per frame after update. */
  sync(time = 0) {
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (!p.alive) { this.mesh.setMatrixAt(i, HIDDEN); continue; }
      n++;
      _p.set(p.x, p.y, p.z);
      _dir.set(p.vx, p.vy, p.vz);
      const speed = _dir.length();
      if (speed > 0.001) {
        _dir.divideScalar(speed);
        _q.setFromUnitVectors(_up, _dir);
      } else {
        _q.identity();
      }
      if (p.spin) {
        const spinQ = new THREE.Quaternion().setFromAxisAngle(_up, time * p.spin + p.seed);
        _q.multiply(spinQ);
      }
      // Stretched hard along travel so it reads as a bolt in flight rather
      // than a ball, and kept slim across so a near miss is a streak past your
      // ear instead of a coloured blob filling a third of the screen.
      const stretch = Math.min(5.5, 1.1 + speed * 0.055);
      _s.set(p.size * 1.15, p.size * stretch, p.size * 1.15);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, this._color.setHex(p.color));
    }
    this.active = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
