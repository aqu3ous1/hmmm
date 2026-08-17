// Boss controller: phases, attack primitives, dialogue timing, and the two
// bespoke mechanics — Synar & Gwynak's tag-team swap and the Doppelgänger's
// weapon mimicry.

import * as THREE from '../../vendor/three.module.js';
import { BOSSES, MIMIC_PATTERNS } from './bossTypes.js';
import { buildBossMesh } from '../render/models.js';
import { clamp, damp, TAU } from '../core/util.js';
import { disposeTree } from '../world/geometry.js';

export class Boss {
  constructor(bossId, pos, scaling = 1) {
    const def = BOSSES[bossId];
    this.def = def;
    this.id = -1;              // filled by the game so damage code can treat it like an enemy
    this.bossId = bossId;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.maxHp = Math.round(def.hp * scaling);
    this.hp = this.maxHp;
    this.radius = def.radius;
    this.height = def.height;
    this.speed = def.speed;
    this.alive = true;
    this.armor = 0;
    this.facing = 0;
    this.flash = 0;
    this.animPhase = 0;
    this.invuln = 0;

    // status effects (bosses resist the strong ones)
    this.jumbified = 0;
    this.marked = 0;
    this.tether = 0;
    this.tetherDps = 0;
    this.slowUntil = 0;
    this.slowFactor = 1;
    this.stunned = 0;
    this.burn = 0;
    this.distracted = 0;
    this.type = { hitSound: 'metal', ai: 'boss', name: def.name, attackRange: 4 };

    this.phaseIndex = 0;
    this.cooldowns = new Map();
    this.action = null;
    this.state = 'idle';
    this.tauntTimer = 6 + Math.random() * 6;
    this.spokenPhases = new Set();

    this.mesh = buildBossMesh(def);
    this.mesh.position.copy(pos);

    // Tag team: a second body that waits at the edge of the arena.
    this.tagTeam = !!def.tagTeam;
    if (this.tagTeam) {
      this.meshB = buildBossMesh(def, true);
      this.meshB.position.copy(pos);
      this.activeTwin = 0;
      this.benchPos = pos.clone();
      this.tagSwapT = 0;
    }
    this._resetPhaseCooldowns();
  }

  /** Bosses stand on the floor, but every hit test asks for this, so it exists
   *  here too rather than being special-cased at each call site. */
  get feetY() { return this.pos.y; }

  get center() { return _v.set(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z); }
  headY() { return this.pos.y + this.height * 0.85; }
  get activeMesh() { return this.tagTeam && this.activeTwin === 1 ? this.meshB : this.mesh; }
  get hpFraction() { return clamp(this.hp / this.maxHp, 0, 1); }
  get phase() { return this.def.phases[this.phaseIndex]; }

  _resetPhaseCooldowns() {
    this.cooldowns.clear();
    for (const a of this.phase.attacks) this.cooldowns.set(a, Math.random() * a.cd * 0.6);
  }

  takeDamage(amount, { crit = false } = {}) {
    if (!this.alive || this.invuln > 0) return { dealt: 0, killed: false, crit };
    const dmg = Math.max(1, amount * (this.marked > 0 ? 1.12 : 1));
    this.hp -= dmg;
    this.flash = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return { dealt: dmg, killed: true, crit };
    }
    return { dealt: dmg, killed: false, crit };
  }

  knock() { /* bosses do not get knocked around */ }

  update(dt, ctx) {
    const { player, level, now } = ctx;
    this.flash = Math.max(0, this.flash - dt);
    this.marked = Math.max(0, this.marked - dt);
    this.stunned = Math.max(0, this.stunned - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.jumbified = Math.max(0, this.jumbified - dt);
    if (now > this.slowUntil) this.slowFactor = 1;
    if (this.tether > 0) {
      this.tether -= dt;
      const r = this.takeDamage(this.tetherDps * dt);
      if (r.killed) { ctx.onDeath?.(this); return; }
    }
    if (this.burn > 0) { this.burn -= dt; this.takeDamage(14 * dt); }

    // Phase transitions. Phases are listed with descending `above` thresholds,
    // so the first one the current health fraction clears is the active phase.
    const frac = this.hpFraction;
    let newPhase = this.def.phases.length - 1;
    for (let i = 0; i < this.def.phases.length; i++) {
      if (frac > this.def.phases[i].above) { newPhase = i; break; }
    }
    if (newPhase !== this.phaseIndex) {
      this.phaseIndex = newPhase;
      this._resetPhaseCooldowns();
      this.action = null;
      this.invuln = 0.6;
      if (newPhase > 0 && !this.spokenPhases.has(newPhase)) {
        this.spokenPhases.add(newPhase);
        const lines = this.def.lines.phase;
        ctx.say?.(lines[(newPhase - 1) % lines.length] || lines[0], 'BOSS');
        ctx.particles?.ring(this.pos.x, 0.1, this.pos.z, { from: 1, to: 14, life: 0.7, color: this.def.build.accent });
        ctx.audio?.bossRoar(1.2);
      }
    }

    // Occasional taunt
    this.tauntTimer -= dt;
    if (this.tauntTimer <= 0) {
      this.tauntTimer = 13 + Math.random() * 12;
      const t = this.def.lines.taunt;
      if (t && t.length) ctx.say?.(t[(Math.random() * t.length) | 0], 'BOSS');
    }

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const distToPlayer = Math.hypot(dx, dz) || 0.001;

    // Face the player unless mid-charge.
    const wantFacing = Math.atan2(dx, dz);
    let diff = wantFacing - this.facing;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    this.facing += diff * Math.min(1, dt * 4);

    if (this.stunned <= 0) {
      if (this.action) this._runAction(dt, ctx, dx, dz, distToPlayer);
      else this._pickAction(dt, ctx, distToPlayer);
    }

    // Drift toward a comfortable stand-off range while not committed.
    if (!this.action || this.action.type !== 'charge') {
      const want = clamp(distToPlayer > 16 ? 1 : distToPlayer < 7 ? -1 : 0, -1, 1);
      const mx = (dx / distToPlayer) * want;
      const mz = (dz / distToPlayer) * want;
      // Slow orbit keeps arenas from becoming a stationary shooting gallery.
      const ox = -dz / distToPlayer, oz = dx / distToPlayer;
      const sp = this.speed * this.slowFactor * (this.jumbified > 0 ? 0.35 : 1);
      this.vel.x = damp(this.vel.x, (mx + ox * 0.55) * sp, 4, dt);
      this.vel.z = damp(this.vel.z, (mz + oz * 0.55) * sp, 4, dt);
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    level.resolveCircle(this.pos, this.radius);

    this._animate(dt, now, ctx);
  }

  _pickAction(dt, ctx, distToPlayer) {
    const candidates = [];
    for (const a of this.phase.attacks) {
      const cd = (this.cooldowns.get(a) ?? 0) - dt;
      this.cooldowns.set(a, cd);
      if (cd <= 0) candidates.push(a);
    }
    if (!candidates.length) return;
    const a = candidates[(Math.random() * candidates.length) | 0];
    this.cooldowns.set(a, a.cd);
    this._begin(a, ctx, distToPlayer);
  }

  _begin(a, ctx, distToPlayer) {
    let spec = a;
    if (a.type === 'mimic') {
      spec = this._mimicSpec(ctx);
      if (!spec) return;
    }
    this.action = {
      type: spec.type, spec, elapsed: 0, fired: 0, timer: 0,
      angle: Math.random() * TAU, done: false,
    };
    switch (spec.type) {
      case 'charge': {
        const dx = ctx.player.pos.x - this.pos.x, dz = ctx.player.pos.z - this.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        this.action.dir = new THREE.Vector3(dx / d, 0, dz / d);
        this.action.duration = 1.6;
        this.action.windup = 0.5;
        ctx.audio?.bossRoar(1.6);
        ctx.particles?.ring(this.pos.x, 0.1, this.pos.z, { from: 0.5, to: 4, life: 0.4, color: this.def.build.accent });
        break;
      }
      case 'slam':
        this.action.duration = 1.0;
        this.action.windup = 0.55;
        break;
      case 'beam':
        this.action.duration = spec.duration || 3;
        this.action.windup = 0.7;
        this.action.beamAngle = Math.atan2(ctx.player.pos.x - this.pos.x, ctx.player.pos.z - this.pos.z) - (spec.sweep || 2) / 2;
        break;
      case 'blink': {
        const ang = Math.random() * TAU;
        const r = 8 + Math.random() * 5;
        const nx = ctx.player.pos.x + Math.cos(ang) * r;
        const nz = ctx.player.pos.z + Math.sin(ang) * r;
        ctx.particles?.burst(this.pos.x, this.pos.y + 1.4, this.pos.z, 18, { color: this.def.build.accent, speed: 8 });
        if (!ctx.level.isSolidAt(nx, nz)) this.pos.set(nx, this.pos.y, nz);
        ctx.particles?.burst(this.pos.x, this.pos.y + 1.4, this.pos.z, 18, { color: this.def.build.eye, speed: 8 });
        ctx.audio?.glitch(0.6);
        this.action = null;
        break;
      }
      case 'summon':
        this.action.duration = 0.9;
        this.action.windup = 0.35;
        break;
      case 'tag':
        this.action.duration = 1.1;
        this.invuln = 1.1;
        ctx.audio?.levelUp();
        break;
      case 'melt':
        this.action.duration = 2.2;
        this.invuln = 2.0;
        ctx.audio?.glitch(0.5);
        break;
      case 'spiral':
        this.action.duration = (spec.burst || 20) * (spec.cd || 0.25) + 0.2;
        break;
      case 'aimed':
        this.action.duration = (spec.count || 1) * (spec.burstDelay || 0.08) + 0.25;
        break;
      default:
        this.action.duration = 0.55;
        this.action.windup = 0.2;
    }
  }

  _mimicSpec(ctx) {
    const w = ctx.player.weapon;
    if (!w) return null;
    let key = 'ballistic';
    if (w.tags.includes('fist')) key = 'fist';
    else if (w.tags.includes('melee')) key = 'melee';
    else if (w.tags.includes('shotgun')) key = 'shotgun';
    else if (w.tags.includes('heavy')) key = 'heavy';
    else if (w.tags.includes('precision')) key = 'precision';
    else if (w.tags.includes('energy')) key = 'energy';
    const table = MIMIC_PATTERNS[key] || MIMIC_PATTERNS.ballistic;
    const pick = table[(Math.random() * table.length) | 0];
    if (this._lastMimicKey !== key) {
      this._lastMimicKey = key;
      ctx.say?.(`DOPPELGÄNGER: ${MIMIC_QUIPS[key] || MIMIC_QUIPS.ballistic}`, 'BOSS');
    }
    return pick;
  }

  _runAction(dt, ctx, dx, dz, distToPlayer) {
    const a = this.action;
    const s = a.spec;
    a.elapsed += dt;
    const px = this.pos.x, py = this.pos.y + this.height * 0.55, pz = this.pos.z;
    const color = s.color || this.def.build.accent;

    switch (a.type) {
      case 'aimed': {
        a.timer -= dt;
        if (a.timer <= 0 && a.fired < (s.count || 1)) {
          a.timer = s.burstDelay || 0.08;
          a.fired++;
          const baseAng = Math.atan2(dx, dz);
          const ang = baseAng + (Math.random() - 0.5) * (s.spread || 0.05) * 2;
          const ty = ctx.player.eyeY();
          const vertical = (ty - py) / Math.max(4, distToPlayer);
          ctx.spawnBossBullet(px, py, pz, Math.sin(ang), vertical, Math.cos(ang), s.speed, s.damage, color, s.homing || 0);
          ctx.audio?.shoot({ body: 900, punch: 0.4, tail: 0.1, pitch: 260, volume: 0.28 });
        }
        break;
      }

      case 'spread': {
        if (!a.done) {
          a.done = true;
          const n = s.count || 12;
          const base = Math.random() * TAU;
          for (let i = 0; i < n; i++) {
            const ang = base + (i / n) * TAU;
            ctx.spawnBossBullet(px, py, pz, Math.sin(ang), 0, Math.cos(ang), s.speed, s.damage, color, 0);
          }
          ctx.audio?.explode(0.6);
          ctx.particles?.ring(px, 0.1, pz, { from: 0.5, to: 5, life: 0.35, color });
        }
        break;
      }

      case 'spiral': {
        a.timer -= dt;
        if (a.timer <= 0 && a.fired < (s.burst || 20)) {
          a.timer = s.cd || 0.25;
          a.fired++;
          const arms = s.arms || 4;
          a.angle += 0.42;
          for (let i = 0; i < arms; i++) {
            const ang = a.angle + (i / arms) * TAU;
            ctx.spawnBossBullet(px, py, pz, Math.sin(ang), 0, Math.cos(ang), s.speed, s.damage, color, 0);
          }
          if (a.fired % 4 === 0) ctx.audio?.shoot({ body: 700, punch: 0.3, tail: 0.08, pitch: 200, volume: 0.22 });
        }
        break;
      }

      case 'wall': {
        if (!a.done) {
          a.done = true;
          const n = s.count || 16;
          const baseAng = Math.atan2(dx, dz);
          const perpX = Math.cos(baseAng), perpZ = -Math.sin(baseAng);
          const gapAt = 2 + Math.floor(Math.random() * (n - 4));
          const gapW = s.gap || 3;
          for (let i = 0; i < n; i++) {
            if (i >= gapAt && i < gapAt + gapW) continue;
            const off = (i - n / 2) * 1.1;
            ctx.spawnBossBullet(
              px + perpX * off, py, pz + perpZ * off,
              Math.sin(baseAng), 0, Math.cos(baseAng), s.speed, s.damage, color, 0,
            );
          }
          ctx.audio?.explode(0.5);
        }
        break;
      }

      case 'rain': {
        if (!a.done) {
          a.done = true;
          const n = s.count || 14;
          for (let i = 0; i < n; i++) {
            const ang = Math.random() * TAU;
            const r = Math.random() * (s.spreadRadius || 10);
            const tx = ctx.player.pos.x + Math.cos(ang) * r;
            const tz = ctx.player.pos.z + Math.sin(ang) * r;
            if (ctx.level.isSolidAt(tx, tz)) continue;
            ctx.spawnBossBullet(tx, 4.3, tz, 0, -1, 0, 13 + Math.random() * 5, s.damage, color, 0);
            ctx.particles?.ring(tx, 0.06, tz, { from: 0.2, to: 1.2, life: 0.55, color });
          }
          ctx.audio?.explode(0.7);
        }
        break;
      }

      case 'charge': {
        if (a.elapsed < a.windup) {
          this.vel.set(0, 0, 0);
          break;
        }
        const sp = s.speed || 15;
        this.vel.x = a.dir.x * sp;
        this.vel.z = a.dir.z * sp;
        const wall = ctx.level.raycast(this.pos.x, this.pos.z, a.dir.x, a.dir.z, this.radius + 0.8);
        if (wall.hit) {
          a.elapsed = a.duration;
          this.stunned = 1.2;
          ctx.particles?.explosion(this.pos.x, 1, this.pos.z, 3, this.def.build.accent);
          ctx.audio?.explode(1);
        }
        if (distToPlayer < this.radius + ctx.player.radius + 0.8) {
          ctx.damagePlayer(s.damage, this);
          a.elapsed = a.duration;
        }
        break;
      }

      case 'slam': {
        if (a.elapsed < a.windup) {
          this.vel.set(0, 0, 0);
          break;
        }
        if (!a.done) {
          a.done = true;
          const radius = s.radius || 7;
          ctx.particles?.ring(px, 0.12, pz, { from: 0.5, to: radius, life: 0.42, color });
          ctx.particles?.burst(px, 0.4, pz, 24, { color, speed: 9, up: 4 });
          ctx.audio?.explode(1.3);
          if (distToPlayer < radius) ctx.damagePlayer(s.damage, this);
          ctx.shockEnemies?.(px, pz, radius);
          if (s.fire) {
            for (let i = 0; i < 10; i++) {
              const ang = (i / 10) * TAU;
              ctx.spawnBossBullet(px, 0.6, pz, Math.sin(ang), 0.05, Math.cos(ang), 12, s.damage * 0.5, 0xff6a2a, 0);
            }
          }
        }
        break;
      }

      case 'beam': {
        if (a.elapsed < a.windup) {
          ctx.particles?.beam(px, py, pz,
            px + Math.sin(a.beamAngle) * 30, py, pz + Math.cos(a.beamAngle) * 30,
            { color, width: 0.04, life: 0.06 });
          break;
        }
        const t = (a.elapsed - a.windup) / Math.max(0.1, a.duration - a.windup);
        const ang = a.beamAngle + (s.sweep || 2) * t;
        const bx = Math.sin(ang), bz = Math.cos(ang);
        const hit = ctx.level.raycast(px, pz, bx, bz, 40);
        const len = hit.hit ? hit.dist : 40;
        ctx.particles?.beam(px, py, pz, px + bx * len, py, pz + bz * len, { color, width: 0.34, life: 0.05 });
        ctx.particles?.beam(px, py, pz, px + bx * len, py, pz + bz * len, { color: 0xffffff, width: 0.12, life: 0.05 });
        // Damage anything close to the beam line.
        const relX = ctx.player.pos.x - px, relZ = ctx.player.pos.z - pz;
        const along = relX * bx + relZ * bz;
        if (along > 0 && along < len) {
          const perp = Math.abs(relX * bz - relZ * bx);
          if (perp < 1.0) ctx.damagePlayer((s.damage || 20) * dt * 2.2, this, true);
        }
        if (Math.random() < 0.25) ctx.audio?.ui(220 + Math.random() * 90);
        break;
      }

      case 'summon': {
        if (a.elapsed >= a.windup && !a.done) {
          a.done = true;
          ctx.summon?.(s.enemy, s.count || 2, this.pos);
          ctx.particles?.ring(px, 0.1, pz, { from: 1, to: 8, life: 0.5, color });
          ctx.audio?.glitch(0.8);
        }
        break;
      }

      case 'tag': {
        const t = clamp(a.elapsed / a.duration, 0, 1);
        this.tagSwapT = t;
        if (t >= 0.5 && !a.done) {
          a.done = true;
          this.activeTwin = 1 - this.activeTwin;
          ctx.particles?.burst(px, py, pz, 26, { color: this.def.build.eye, speed: 9 });
          const lines = this.def.lines.phase;
          if (Math.random() < 0.5 && lines?.length) ctx.say?.(lines[(Math.random() * lines.length) | 0], 'BOSS');
          // The fresh twin comes in swinging.
          this.speed = this.def.speed * (this.activeTwin === 1 ? 0.82 : 1.15);
        }
        break;
      }

      case 'melt': {
        const t = clamp(a.elapsed / a.duration, 0, 1);
        if (!a.done && t > 0.5) {
          a.done = true;
          const healed = this.maxHp * (s.heal || 0.03);
          this.hp = Math.min(this.maxHp, this.hp + healed);
          const ang = Math.random() * TAU;
          const r = 9 + Math.random() * 4;
          const nx = ctx.player.pos.x + Math.cos(ang) * r;
          const nz = ctx.player.pos.z + Math.sin(ang) * r;
          if (!ctx.level.isSolidAt(nx, nz)) this.pos.set(nx, this.pos.y, nz);
          ctx.particles?.burst(this.pos.x, 0.5, this.pos.z, 30, { color: this.def.build.accent, speed: 7, up: 1 });
        }
        break;
      }

      default: break;
    }

    if (a.elapsed >= (a.duration || 0.5)) this.action = null;
  }

  _animate(dt, now, ctx) {
    this.animPhase += dt * 2;
    const bobY = Math.sin(this.animPhase) * 0.09;
    const active = this.activeMesh;

    active.position.set(this.pos.x, this.pos.y + bobY, this.pos.z);
    active.rotation.y = this.facing;
    active.visible = true;

    if (this.tagTeam) {
      const bench = this.activeTwin === 1 ? this.mesh : this.meshB;
      // The benched twin hangs back and watches.
      const bx = this.pos.x + Math.cos(now * 0.4) * 11;
      const bz = this.pos.z + Math.sin(now * 0.4) * 11;
      if (!ctx.level.isSolidAt(bx, bz)) bench.position.set(bx, Math.sin(now * 2) * 0.12, bz);
      bench.rotation.y = Math.atan2(this.pos.x - bench.position.x, this.pos.z - bench.position.z);
      bench.visible = true;
      bench.scale.setScalar(0.9);
      active.scale.setScalar(1);
    }

    if (this.def.build.shape === 'root' || this.def.build.shape === 'motherboard') {
      const inner = active.children[0];
      if (inner) inner.rotation.y = now * 0.6;
    }

    if (this.action?.type === 'charge' && this.action.elapsed < this.action.windup) {
      active.scale.setScalar(1 + Math.sin(now * 40) * 0.05);
    } else if (this.invuln > 0) {
      active.scale.setScalar(1 + Math.sin(now * 22) * 0.07);
    } else if (!this.tagTeam) {
      active.scale.setScalar(1);
    }

    if (this.flash > 0) this._setFlash(this.flash / 0.1);
    else if (this._flashed) this._setFlash(0);
  }

  _setFlash(amount) {
    if (!this._materials) {
      this._materials = [];
      const collect = (root) => root.traverse((o) => {
        if (o.material && o.material.emissive) {
          this._materials.push({ mat: o.material, base: o.material.emissive.getHex() });
        }
      });
      collect(this.mesh);
      if (this.meshB) collect(this.meshB);
    }
    for (const { mat, base } of this._materials) {
      if (amount <= 0) mat.emissive.setHex(base);
      else mat.emissive.setRGB(amount, amount * 0.6, amount * 0.6);
    }
    this._flashed = amount > 0;
  }

  addToScene(scene) {
    scene.add(this.mesh);
    if (this.meshB) scene.add(this.meshB);
  }

  dispose() {
    disposeTree(this.mesh);
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    if (this.meshB) {
      disposeTree(this.meshB);
      if (this.meshB.parent) this.meshB.parent.remove(this.meshB);
    }
  }
}

const MIMIC_QUIPS = {
  fist: 'Fists. Bold. I have fists too, obviously. I have exactly your fists.',
  melee: 'Close range. Fine. I will meet you there.',
  shotgun: 'A shotgun. Cramped, loud, honest. Very you.',
  heavy: 'Oh, the big one. Let us both be slow together.',
  precision: 'One shot at a time. I can count. I have counted everything you do.',
  energy: 'Something exotic. I will approximate it. I approximate everything about you.',
  ballistic: 'Standard issue. So am I.',
};

const _v = new THREE.Vector3();
