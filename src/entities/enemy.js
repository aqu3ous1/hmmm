// Enemy instances plus the shared flow-field pathfinder they navigate with.

import * as THREE from '../../vendor/three.module.js';
import { ENEMY_TYPES } from './enemyTypes.js';
import { buildEnemyMesh } from '../render/models.js';
import { GRID, CELL } from '../world/level.js';
import { clamp, damp, dist2 } from '../core/util.js';
import { disposeTree } from '../world/geometry.js';

/**
 * Breadth-first distance field over the walkable grid, rooted at the player.
 * Enemies walk downhill, which gets them around corners without per-agent
 * pathfinding.
 */
export class FlowField {
  constructor(level) {
    this.level = level;
    this.dist = new Int32Array(GRID * GRID).fill(-1);
    this.queue = new Int32Array(GRID * GRID);
    this.rootCell = -1;
    this.timer = 0;
  }

  rebuild(targetX, targetZ) {
    const level = this.level;
    const cx = clamp(level.worldToCellX(targetX), 0, GRID - 1);
    const cz = clamp(level.worldToCellZ(targetZ), 0, GRID - 1);
    const start = cx + cz * GRID;
    this.rootCell = start;
    this.dist.fill(-1);
    if (level.isSolidCell(cx, cz)) return;

    const q = this.queue;
    let head = 0, tail = 0;
    q[tail++] = start;
    this.dist[start] = 0;

    while (head < tail) {
      const cur = q[head++];
      const d = this.dist[cur] + 1;
      const x = cur % GRID, z = (cur / GRID) | 0;
      for (let i = 0; i < 4; i++) {
        const nx = x + (i === 0 ? 1 : i === 1 ? -1 : 0);
        const nz = z + (i === 2 ? 1 : i === 3 ? -1 : 0);
        if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
        const ni = nx + nz * GRID;
        if (this.dist[ni] !== -1) continue;
        if (level.isSolidCell(nx, nz)) continue;
        this.dist[ni] = d;
        q[tail++] = ni;
      }
    }
  }

  /** Unit direction downhill from a world position, or null if unreachable. */
  direction(x, z, out) {
    const level = this.level;
    const cx = level.worldToCellX(x), cz = level.worldToCellZ(z);
    if (cx < 0 || cz < 0 || cx >= GRID || cz >= GRID) return null;
    const here = this.dist[cx + cz * GRID];
    if (here < 0) return null;

    let bestD = here, bx = cx, bz = cz;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        if (!i && !j) continue;
        const nx = cx + i, nz = cz + j;
        if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
        // Don't cut diagonal corners through solid tiles.
        if (i && j && (level.isSolidCell(cx + i, cz) || level.isSolidCell(cx, cz + j))) continue;
        const d = this.dist[nx + nz * GRID];
        if (d < 0) continue;
        if (d < bestD) { bestD = d; bx = nx; bz = nz; }
      }
    }
    if (bx === cx && bz === cz) return null;
    const tx = level.cellToWorldX(bx) + CELL / 2;
    const tz = level.cellToWorldZ(bz) + CELL / 2;
    const dx = tx - x, dz = tz - z;
    const len = Math.hypot(dx, dz) || 1;
    out.set(dx / len, 0, dz / len);
    return out;
  }
}

let nextId = 1;

export class Enemy {
  constructor(typeId, pos, scaling = 1) {
    const t = ENEMY_TYPES[typeId];
    this.id = nextId++;
    this.type = t;
    this.typeId = typeId;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.maxHp = Math.round(t.hp * scaling);
    this.hp = this.maxHp;
    this.radius = t.radius;
    this.height = t.height;
    this.speed = t.speed * (0.92 + Math.random() * 0.16);
    this.damage = t.damage * Math.min(2.4, 0.85 + scaling * 0.35);
    this.armor = t.armor || 0;
    this.alive = true;
    this.facing = Math.random() * Math.PI * 2;

    this.attackCd = Math.random() * t.attackCd;
    this.stagger = 0;
    this.animPhase = Math.random() * 10;
    this.flash = 0;

    // status effects
    this.jumbified = 0;
    this.marked = 0;
    this.tether = 0;
    this.tetherDps = 0;
    this.slowUntil = 0;
    this.slowFactor = 1;
    this.burn = 0;
    this.stunned = 0;
    this.distracted = 0;

    // per-AI state
    this.leapCd = Math.random() * (t.leapCd || 3);
    this.leaping = 0;
    this.blinkCd = Math.random() * (t.blinkCd || 3);
    this.chargeCd = Math.random() * (t.chargeCd || 4);
    this.charging = 0;
    this.chargeDir = new THREE.Vector3();
    this.burstLeft = 0;
    this.burstTimer = 0;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeTimer = 0;
    this.fuse = -1;
    this.vy = 0;
    this.onGround = true;

    this.mesh = buildEnemyMesh(t);
    this.mesh.position.copy(this.pos);
    this.baseY = t.flying ? (t.hoverHeight || 2) : 0;
    this.mesh.position.y = this.baseY;
    // Head volume comes straight from the model, so the hitbox always sits
    // where the modeller actually put the head.
    this.headOffset = this.mesh.userData.headY ?? t.height * 0.85;
    this.headRadius = this.mesh.userData.headR ?? 0.2;
    this.wobble = this.mesh.userData.wobble || 0;
    this._origColors = null;
  }

  /**
   * Bottom of the body volume in world space.
   *
   * For a walker this is `pos.y`. For a flyer it is not: hovering is done by
   * offsetting the *mesh* by `baseY` while `pos.y` stays on the floor, so any
   * hit test that reads `pos.y` directly builds its volume at ground level
   * while the drone is two metres up. That is exactly why Watcher Drones could
   * only ever be killed by a headshot — the head volume was the one place that
   * remembered to add `baseY`.
   */
  get feetY() { return this.pos.y + this.baseY; }

  get center() {
    return _c.set(this.pos.x, this.feetY + this.height * 0.55, this.pos.z);
  }

  /** World-space centre of the head — used for hit tests and damage numbers. */
  headY() { return this.pos.y + this.baseY + this.headOffset; }

  /** Returns { dealt, killed, crit } after armour and status modifiers. */
  takeDamage(amount, { crit = false, source = null } = {}) {
    if (!this.alive) return { dealt: 0, killed: false, crit };
    let dmg = amount * (1 - this.armor);
    if (this.jumbified > 0) dmg *= 1.35;
    if (this.marked > 0) dmg *= 1.15;
    dmg = Math.max(1, dmg);
    this.hp -= dmg;
    this.flash = 0.12;
    this.stagger = Math.min(0.35, this.stagger + 0.06);
    if (this.hp <= 0) {
      this.alive = false;
      return { dealt: dmg, killed: true, crit };
    }
    return { dealt: dmg, killed: false, crit };
  }

  knock(dirX, dirZ, force) {
    const m = 1 / (0.6 + this.radius * 1.6);
    this.vel.x += dirX * force * m;
    this.vel.z += dirZ * force * m;
  }

  update(dt, ctx) {
    const t = this.type;
    const { player, level, flow, now, fire, particles } = ctx;

    this.flash = Math.max(0, this.flash - dt);
    this.stagger = Math.max(0, this.stagger - dt);
    this.marked = Math.max(0, this.marked - dt);
    this.stunned = Math.max(0, this.stunned - dt);
    this.distracted = Math.max(0, this.distracted - dt);
    if (now > this.slowUntil) this.slowFactor = 1;

    if (this.jumbified > 0) {
      this.jumbified -= dt;
      if (this.jumbified <= 0) ctx.onJumboExpire?.(this);
    }
    if (this.tether > 0) {
      this.tether -= dt;
      const bleed = this.tetherDps * dt;
      const r = this.takeDamage(bleed, {});
      if (r.killed) { ctx.onDeath?.(this, null); return; }
      ctx.onTetherTick?.(this, r.dealt);
    }
    if (this.burn > 0) {
      this.burn -= dt;
      const r = this.takeDamage(9 * dt, {});
      if (r.killed) { ctx.onDeath?.(this, null); return; }
    }

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const distToPlayer = Math.hypot(dx, dz);
    const canSee = level.lineOfSight(this.pos.x, this.pos.z, player.pos.x, player.pos.z);

    const frozen = this.stunned > 0 || this.jumbified > 0 || this.distracted > 0;
    let moveSpeed = this.speed * this.slowFactor * (this.stagger > 0 ? 0.55 : 1);
    if (this.jumbified > 0) moveSpeed *= 0.3;
    if (this.distracted > 0) moveSpeed = 0;

    let desiredX = 0, desiredZ = 0;

    if (!frozen) {
      switch (t.ai) {
        case 'turret':
          moveSpeed = 0;
          if (canSee && distToPlayer < t.attackRange) this._rangedFire(dt, ctx, distToPlayer);
          break;

        case 'ranged': {
          const want = t.attackRange * 0.55;
          const dir = flow.direction(this.pos.x, this.pos.z, _d);
          if (canSee && distToPlayer < want) {
            // Back off and strafe once in range.
            desiredX = -dx / (distToPlayer || 1);
            desiredZ = -dz / (distToPlayer || 1);
            this.strafeTimer -= dt;
            if (this.strafeTimer <= 0) { this.strafeTimer = 1.2 + Math.random(); this.strafeDir *= -1; }
            desiredX += (-dz / (distToPlayer || 1)) * this.strafeDir * 1.3;
            desiredZ += (dx / (distToPlayer || 1)) * this.strafeDir * 1.3;
          } else if (dir) {
            desiredX = dir.x; desiredZ = dir.z;
          }
          if (canSee && distToPlayer < t.attackRange) this._rangedFire(dt, ctx, distToPlayer);
          break;
        }

        case 'hover': {
          const dir = flow.direction(this.pos.x, this.pos.z, _d);
          const want = t.attackRange * 0.6;
          if (canSee && distToPlayer < want) {
            this.strafeTimer -= dt;
            if (this.strafeTimer <= 0) { this.strafeTimer = 0.9 + Math.random(); this.strafeDir *= -1; }
            desiredX = (-dz / (distToPlayer || 1)) * this.strafeDir;
            desiredZ = (dx / (distToPlayer || 1)) * this.strafeDir;
          } else if (dir) { desiredX = dir.x; desiredZ = dir.z; }
          if (canSee && distToPlayer < t.attackRange) this._rangedFire(dt, ctx, distToPlayer);
          break;
        }

        case 'leaper': {
          this.leapCd -= dt;
          if (this.leaping > 0) {
            this.leaping -= dt;
            desiredX = this.chargeDir.x * 3; desiredZ = this.chargeDir.z * 3;
            moveSpeed = t.leapSpeed;
          } else if (canSee && this.leapCd <= 0 && distToPlayer < t.leapRange && distToPlayer > 3) {
            this.leapCd = t.leapCd;
            this.leaping = 0.45;
            this.chargeDir.set(dx / distToPlayer, 0, dz / distToPlayer);
            this.vy = 5.4;
            this.onGround = false;
            ctx.audio?.melee(700, 0.2);
          } else {
            const dir = flow.direction(this.pos.x, this.pos.z, _d);
            if (dir) { desiredX = dir.x; desiredZ = dir.z; }
          }
          this._meleeTry(dt, ctx, distToPlayer);
          break;
        }

        case 'charger': {
          this.chargeCd -= dt;
          if (this.charging > 0) {
            this.charging -= dt;
            desiredX = this.chargeDir.x; desiredZ = this.chargeDir.z;
            moveSpeed = t.chargeSpeed;
            const wall = level.raycast(this.pos.x, this.pos.z, this.chargeDir.x, this.chargeDir.z, this.radius + 0.6);
            if (wall.hit) {
              this.charging = 0;
              this.stagger = 1.1;
              particles?.burst(this.pos.x, this.pos.y + 1, this.pos.z, 12, { color: 0xbbbbbb, speed: 5 });
              ctx.audio?.hit('metal');
            }
          } else if (canSee && this.chargeCd <= 0 && distToPlayer < t.chargeRange && distToPlayer > 4) {
            this.chargeCd = t.chargeCd;
            this.charging = 1.5;
            this.chargeDir.set(dx / distToPlayer, 0, dz / distToPlayer);
            ctx.audio?.bossRoar(2.5);
          } else {
            const dir = flow.direction(this.pos.x, this.pos.z, _d);
            if (dir) { desiredX = dir.x; desiredZ = dir.z; }
          }
          this._meleeTry(dt, ctx, distToPlayer);
          break;
        }

        case 'blink': {
          this.blinkCd -= dt;
          if (this.blinkCd <= 0 && distToPlayer > 5 && distToPlayer < 24) {
            this.blinkCd = t.blinkCd;
            const a = Math.random() * Math.PI * 2;
            const r = 3 + Math.random() * 2.5;
            const nx = player.pos.x + Math.cos(a) * r;
            const nz = player.pos.z + Math.sin(a) * r;
            if (!level.isSolidAt(nx, nz)) {
              particles?.burst(this.pos.x, this.pos.y + 1, this.pos.z, 10, { color: 0xff2ea6, speed: 5 });
              this.pos.set(nx, this.pos.y, nz);
              particles?.burst(nx, this.pos.y + 1, nz, 10, { color: 0x2effe0, speed: 5 });
            }
          }
          const dir = flow.direction(this.pos.x, this.pos.z, _d);
          if (dir) { desiredX = dir.x; desiredZ = dir.z; }
          this._meleeTry(dt, ctx, distToPlayer);
          break;
        }

        case 'exploder': {
          const dir = flow.direction(this.pos.x, this.pos.z, _d);
          if (dir) { desiredX = dir.x; desiredZ = dir.z; }
          if (this.fuse < 0 && distToPlayer < t.attackRange) {
            this.fuse = t.fuse;
            ctx.audio?.ui(300);
          }
          if (this.fuse >= 0) {
            this.fuse -= dt;
            moveSpeed *= 1.6;
            if (this.fuse <= 0) {
              this.alive = false;
              ctx.onExplode?.(this);
              return;
            }
          }
          break;
        }

        case 'mirror': {
          // Keeps its distance and copies the player's rhythm.
          const dir = flow.direction(this.pos.x, this.pos.z, _d);
          const want = 12;
          if (canSee && distToPlayer < want) {
            desiredX = -dx / (distToPlayer || 1); desiredZ = -dz / (distToPlayer || 1);
          } else if (dir) { desiredX = dir.x; desiredZ = dir.z; }
          if (canSee && distToPlayer < t.attackRange) this._rangedFire(dt, ctx, distToPlayer);
          break;
        }

        default: { // 'melee'
          const dir = flow.direction(this.pos.x, this.pos.z, _d);
          if (dir) { desiredX = dir.x; desiredZ = dir.z; }
          else if (distToPlayer > 0.1) { desiredX = dx / distToPlayer; desiredZ = dz / distToPlayer; }
          this._meleeTry(dt, ctx, distToPlayer);
          break;
        }
      }
    }

    // Separation from neighbours so packs don't stack into one pixel.
    const sep = ctx.separation(this);
    desiredX += sep.x; desiredZ += sep.z;

    const dlen = Math.hypot(desiredX, desiredZ);
    if (dlen > 0.001) { desiredX /= dlen; desiredZ /= dlen; }

    this.vel.x = damp(this.vel.x, desiredX * moveSpeed, 8, dt);
    this.vel.z = damp(this.vel.z, desiredZ * moveSpeed, 8, dt);

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    level.resolveCircle(this.pos, this.radius);

    if (!t.flying) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.onGround = true; this.leaping = Math.min(this.leaping, 0); }
    }

    if (distToPlayer > 0.001 && (this.vel.lengthSq() > 0.05 || canSee)) {
      const want = Math.atan2(dx, dz);
      let diff = want - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * Math.min(1, dt * 7);
    }

    this._animate(dt, now);
  }

  _meleeTry(dt, ctx, distToPlayer) {
    this.attackCd -= dt;
    if (this.attackCd > 0) return;
    if (distToPlayer > this.type.attackRange + ctx.player.radius) return;
    if (!ctx.level.lineOfSight(this.pos.x, this.pos.z, ctx.player.pos.x, ctx.player.pos.z)) return;
    this.attackCd = this.type.attackCd;
    ctx.onMelee?.(this, this.damage);
  }

  _rangedFire(dt, ctx, distToPlayer) {
    const proj = this.type.projectile;
    if (!proj) return;
    if (this.burstLeft > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this.burstTimer = proj.burstDelay || 0.08;
        this.burstLeft--;
        ctx.onRanged?.(this, proj);
      }
      return;
    }
    this.attackCd -= dt;
    if (this.attackCd > 0) return;
    this.attackCd = this.type.attackCd;
    this.burstLeft = proj.count || 1;
    this.burstTimer = 0;
  }

  _animate(dt, now) {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.animPhase += dt * (2.4 + speed * 1.9);
    const m = this.mesh;
    m.position.set(this.pos.x, this.pos.y + this.baseY, this.pos.z);
    m.rotation.y = this.facing;

    const upper = m.userData.upper;
    const legL = m.userData.legL;
    const legR = m.userData.legR;
    const swing = Math.sin(this.animPhase) * Math.min(0.85, 0.14 + speed * 0.1);

    if (this.type.flying) {
      m.position.y += Math.sin(this.animPhase * 0.9) * 0.22;
      if (upper) {
        upper.rotation.y = now * 2.4;
        upper.rotation.z = Math.sin(now * 1.7) * 0.12;
      }
    } else if (this.type.static) {
      // Turrets don't walk; they scan and settle.
      if (upper) upper.rotation.z = Math.sin(now * 2.2) * 0.03;
    } else {
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
      if (upper) {
        upper.position.y = Math.abs(Math.sin(this.animPhase)) * 0.05 * (0.4 + speed * 0.12);
        upper.rotation.z = Math.sin(this.animPhase) * 0.05;
        upper.rotation.y = Math.sin(this.animPhase) * 0.06;
        upper.rotation.x = (this.type.build.slouch || 0) * 0.5 + (this.charging > 0 ? 0.3 : 0);
        // Soft-bodied things jiggle as they move.
        if (this.wobble) {
          const w = 1 + Math.sin(this.animPhase * 1.6) * 0.05 * this.wobble;
          upper.scale.set(w, 1 / w, w);
        }
      }
    }

    if (this.jumbified > 0) {
      const p = 1 + Math.sin(now * 9) * 0.16;
      m.scale.set(1.5 * p, 1.5 / p, 1.5 * p);
    } else if (this.stagger > 0) {
      m.scale.setScalar(1 + this.stagger * 0.18);
    } else {
      m.scale.setScalar(1);
    }

    if (m.userData.glitch && Math.random() < 0.08) {
      m.position.x += (Math.random() - 0.5) * 0.4;
      m.position.z += (Math.random() - 0.5) * 0.4;
    }

    // Damage flash: momentarily push every material's emissive to white.
    if (this.flash > 0) this._setFlash(this.flash / 0.12);
    else if (this._flashed) this._setFlash(0);
  }

  _setFlash(amount) {
    if (!this._materials) {
      this._materials = [];
      this.mesh.traverse((o) => {
        if (o.material && o.material.emissive) {
          this._materials.push({ mat: o.material, base: o.material.emissive.getHex() });
        }
      });
    }
    for (const { mat, base } of this._materials) {
      if (amount <= 0) mat.emissive.setHex(base);
      else mat.emissive.setRGB(amount * 0.9, amount * 0.75, amount * 0.75);
    }
    this._flashed = amount > 0;
  }

  dispose() {
    disposeTree(this.mesh);
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}

const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
