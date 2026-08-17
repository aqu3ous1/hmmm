// Michael Sandlor: first-person controller, vitals, and the two weapon slots.

import * as THREE from '../../vendor/three.module.js';
import { clamp, damp } from '../core/util.js';

export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.72;
const EYE = 1.58;

export class Player {
  constructor() {
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = PLAYER_RADIUS;
    this.height = PLAYER_HEIGHT;

    this.maxHealth = 100;
    this.health = 100;
    this.debt = 0;                // Sanguine Ledger's outstanding balance
    this.shards = 0;
    this.totalShards = 0;

    this.onGround = true;
    this.vy = 0;
    this.jumpsLeft = 1;

    this.sprinting = false;
    this.dodgeTime = 0;           // > 0 while rolling
    this.dodgeCooldown = 0;
    this.iFrames = 0;
    this.dodgeDir = new THREE.Vector3();

    this.baseSpeed = 6.4;
    this.sprintMul = 1.42;
    this.speedMul = 1;            // synergy / status effects
    this.slowUntil = 0;
    this.slowFactor = 1;
    this.carryPenalty = 1;   // < 1 while both hands are holding something

    this.lastDamageTime = -999;
    this.regenDelay = 5.5;
    this.regenRate = 11;

    this.bob = 0;
    this.viewRoll = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.kickBack = 0;
    this.shake = 0;

    // Loadout: two slots. Slot contents may be null (fists are the fallback).
    this.slots = [null, null];
    this.activeSlot = 0;
    this.fists = null;            // populated by the game with makeWeapon('knuckles')
    this.swapCooldown = 0;

    this.stats = {
      kills: 0, shotsFired: 0, damageDealt: 0, damageTaken: 0, deaths: 0, bossKills: 0,
      // Counters the contract board measures against.
      timesHit: 0, headshots: 0, meleeKills: 0, shardsSpent: 0,
    };
    this.alive = true;
  }

  eyeY() { return this.pos.y + EYE; }

  get weapon() {
    return this.slots[this.activeSlot] || this.fists;
  }

  get otherWeapon() {
    return this.slots[1 - this.activeSlot] || (this.slots[this.activeSlot] ? this.fists : null);
  }

  /** Both carried weapons, fists standing in for empty slots. */
  pairing() {
    const a = this.slots[0] || this.fists;
    const b = this.slots[1] || this.fists;
    return [a, b];
  }

  hasWeapon(id) {
    return this.slots.some((w) => w && w.id === id);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  flatForward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  right(out = new THREE.Vector3()) {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  look(dYaw, dPitch) {
    this.yaw += dYaw;
    this.pitch = clamp(this.pitch + dPitch, -1.45, 1.45);
  }

  hurt(amount, source) {
    if (this.iFrames > 0 || !this.alive) return false;
    const dmg = Math.max(1, Math.round(amount));
    this.health -= dmg;
    this.stats.damageTaken += dmg;
    this.stats.timesHit++;
    this.lastDamageTime = 0;
    this.shake = Math.min(1.4, this.shake + dmg * 0.016);
    if (this.health <= 0) { this.health = 0; this.alive = false; }
    return true;
  }

  heal(amount) {
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - before;
  }

  addShards(n) {
    this.shards += n;
    this.totalShards += n;
  }

  spendShards(n) {
    if (this.shards < n) return false;
    this.shards -= n;
    this.stats.shardsSpent += n;
    return true;
  }

  slow(factor, duration, now) {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowUntil = Math.max(this.slowUntil, now + duration);
  }

  tryDodge(moveAxis) {
    if (this.dodgeCooldown > 0 || this.dodgeTime > 0) return false;
    const f = this.flatForward(new THREE.Vector3());
    const r = this.right(new THREE.Vector3());
    let dx = r.x * moveAxis.x + f.x * moveAxis.y;
    let dz = r.z * moveAxis.x + f.z * moveAxis.y;
    if (Math.hypot(dx, dz) < 0.1) { dx = f.x; dz = f.z; }
    const len = Math.hypot(dx, dz) || 1;
    this.dodgeDir.set(dx / len, 0, dz / len);
    this.dodgeTime = 0.32;
    this.iFrames = 0.4;
    this.dodgeCooldown = 1.05;
    return true;
  }

  update(dt, input, level, now) {
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.swapCooldown = Math.max(0, this.swapCooldown - dt);
    this.lastDamageTime += dt;
    if (now > this.slowUntil) this.slowFactor = 1;

    const axis = input ? input.moveAxis() : { x: 0, y: 0 };
    const wantSprint = input ? input.down('ShiftLeft') || input.down('ShiftRight') : false;
    this.sprinting = wantSprint && axis.y > 0.2 && this.dodgeTime <= 0;

    const weaponMove = this.weapon?.effectiveMoveMul ?? 1;
    let speed = this.baseSpeed * this.speedMul * weaponMove * this.slowFactor * (this.carryPenalty ?? 1);
    if (this.sprinting) speed *= this.sprintMul;

    const f = this.flatForward(_f);
    const r = this.right(_r);

    let wishX, wishZ;
    if (this.dodgeTime > 0) {
      this.dodgeTime -= dt;
      const t = clamp(this.dodgeTime / 0.32, 0, 1);
      const boost = 14.5 * (0.35 + t * 0.65);
      wishX = this.dodgeDir.x * boost;
      wishZ = this.dodgeDir.z * boost;
    } else {
      wishX = (r.x * axis.x + f.x * axis.y) * speed;
      wishZ = (r.z * axis.x + f.z * axis.y) * speed;
    }

    // Ground control is snappy; air control is deliberately mushy.
    const accel = this.onGround ? (this.dodgeTime > 0 ? 40 : 22) : 6;
    this.vel.x = damp(this.vel.x, wishX, accel, dt);
    this.vel.z = damp(this.vel.z, wishZ, accel, dt);

    // Vertical
    if (input && input.pressed('Space') && this.jumpsLeft > 0) {
      this.vy = 6.2;
      this.onGround = false;
      this.jumpsLeft--;
    }
    this.vy -= 21 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vy = 0;
      if (!this.onGround) this.onGround = true;
      this.jumpsLeft = 1;
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    if (level) level.resolveCircle(this.pos, this.radius);

    // Health regen once you've been left alone long enough.
    if (this.alive && this.lastDamageTime > this.regenDelay && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + this.regenRate * dt);
    }

    // The Ledger collects.
    if (this.debt > 0) {
      const take = Math.min(this.debt, 6 * dt);
      this.debt -= take;
      this.health = Math.max(1, this.health - take);
    }

    // View feel
    const planarSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * planarSpeed * 1.35;
    this.viewRoll = damp(this.viewRoll, -axis.x * 0.035 + (this.dodgeTime > 0 ? 0.22 : 0), 9, dt);
    this.recoilPitch = damp(this.recoilPitch, 0, 9, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, 9, dt);
    this.kickBack = damp(this.kickBack, 0, 12, dt);
    this.shake = damp(this.shake, 0, 5, dt);
  }

  /**
   * Apply the camera transform, including bob, recoil and shake.
   *
   * `bobScale` and `shakeScale` come from the accessibility settings. Both go
   * to zero, and at zero the camera is rigid — which for some players is the
   * difference between finishing the game and being unable to play it.
   */
  applyCamera(camera, dt, bobScale = 1, shakeScale = 1) {
    const planarSpeed = Math.hypot(this.vel.x, this.vel.z);
    const bobAmp = Math.min(0.055, planarSpeed * 0.007) * bobScale;
    const bobY = Math.sin(this.bob * 2) * bobAmp;
    const bobX = Math.cos(this.bob) * bobAmp * 0.7;
    const sh = this.shake * shakeScale;
    camera.position.set(
      this.pos.x + bobX + (Math.random() - 0.5) * sh * 0.14,
      this.eyeY() + bobY + (Math.random() - 0.5) * sh * 0.14,
      this.pos.z + (Math.random() - 0.5) * sh * 0.14,
    );
    camera.rotation.set(0, 0, 0);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.yaw + this.recoilYaw;
    camera.rotation.x = this.pitch + this.recoilPitch;
    camera.rotation.z = this.viewRoll * bobScale;
  }

  reset(spawnPos) {
    this.pos.copy(spawnPos);
    this.pos.y = 0;
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.health = this.maxHealth;
    this.debt = 0;
    this.alive = true;
    this.iFrames = 1.2;
    this.dodgeTime = 0;
    this.dodgeCooldown = 0;
    this.shake = 0;
    this.slowFactor = 1;
  }
}

const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
