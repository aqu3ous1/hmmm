// The chest and its slot-machine reveal: weapons flash up out of the lid,
// faster then slower, until one locks in and hangs in the air before it drops
// into your hands.

import * as THREE from '../../vendor/three.module.js';
import { buildChest, buildWeaponIcon } from '../render/models.js';
import { WEAPONS, RARITY_COLORS, RARITY_NAMES, chestPool } from '../combat/weapons.js';
import { disposeTree } from '../world/geometry.js';
import { clamp, weightedPick } from '../core/util.js';

/**
 * Weapon display meshes for the reel, built lazily and keyed per chest — two
 * chests can be mid-roll at once, and they must not fight over one mesh.
 */
export class WeaponIconCache {
  constructor(scene) {
    this.scene = scene;
    this.icons = new Map();
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  get(id, channel = 0) {
    const key = `${id}#${channel}`;
    let m = this.icons.get(key);
    if (!m) {
      if (!WEAPONS[id]) return null;
      m = buildWeaponIcon(id, null);
      m.visible = false;
      this.group.add(m);
      this.icons.set(key, m);
    }
    return m;
  }

  hideAll() { for (const m of this.icons.values()) m.visible = false; }

  dispose() {
    disposeTree(this.group);
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

/** Rarity-weighted draw, biased upward as you climb. */
export function rollWeaponId(rng, floorIndex, exclude = []) {
  const pool = chestPool().filter((id) => !exclude.includes(id));
  const entries = pool.map((id) => {
    const r = WEAPONS[id].rarity;
    // Legendaries stay rare but become plausible near the top.
    const base = [10, 7, 4, 1][r] ?? 4;
    const climb = 1 + floorIndex * 0.09 * r;
    return { id, weight: base * climb };
  });
  return weightedPick(rng, entries).id;
}

const STATES = { CLOSED: 'closed', OPENING: 'opening', ROLLING: 'rolling', LANDED: 'landed', CLAIMED: 'claimed' };

export class Chest {
  constructor(pos, iconCache, opts = {}) {
    this.pos = pos.clone();
    this.iconCache = iconCache;
    this.group = buildChest();
    this.group.position.copy(pos);
    this.group.rotation.y = opts.rotation ?? 0;
    this.state = STATES.CLOSED;
    this.timer = 0;
    this.rollTimer = 0;
    this.rollInterval = 0.045;
    this.rollElapsed = 0;
    this.rollDuration = opts.rollDuration ?? 3.4;
    this.currentIcon = null;
    this.currentId = null;
    this.resultId = null;
    this.sequence = [];
    this.seqIndex = 0;
    this.iconHeight = 1.5;
    this.landTimer = 0;
    this.claimed = false;
    this.isPrologue = !!opts.prologue;
    this.label = opts.label || 'CHEST';
    this.channel = opts.channel ?? 0;
    this.glow = null;
  }

  addToScene(scene) { scene.add(this.group); }

  get interactable() {
    return this.state === STATES.CLOSED || this.state === STATES.LANDED;
  }

  get canClaim() { return this.state === STATES.LANDED; }

  prompt() {
    if (this.state === STATES.CLOSED) return 'Open the chest';
    if (this.state === STATES.LANDED) return `Take the ${WEAPONS[this.resultId].name}`;
    return null;
  }

  open(rng, floorIndex, exclude, audio) {
    if (this.state !== STATES.CLOSED) return;
    this.state = STATES.OPENING;
    this.timer = 0;
    this.resultId = rollWeaponId(rng, floorIndex, exclude);

    // Build the reel: a shuffle of everything, ending on the real result.
    const pool = chestPool();
    const seq = [];
    for (let i = 0; i < 60; i++) seq.push(pool[(rng() * pool.length) | 0]);
    // The FAKe-47 likes to appear right before the real thing, as a tease.
    if (this.resultId === 'fake47') seq[seq.length - 1] = 'ak47';
    seq.push(this.resultId);
    this.sequence = seq;
    this.seqIndex = 0;
    audio?.doorOpen();
  }

  claim() {
    if (this.state !== STATES.LANDED) return null;
    this.state = STATES.CLAIMED;
    this.claimed = true;
    if (this.currentIcon) this.currentIcon.visible = false;
    this.group.userData.beam.material.opacity = 0;
    return this.resultId;
  }

  update(dt, now, audio, particles) {
    const lid = this.group.userData.lid;
    const beam = this.group.userData.beam;

    switch (this.state) {
      case STATES.CLOSED:
        lid.position.y = 0.86 + Math.sin(now * 1.6) * 0.012;
        beam.material.opacity = 0.06 + Math.sin(now * 2.2) * 0.02;
        break;

      case STATES.OPENING: {
        this.timer += dt;
        const t = clamp(this.timer / 0.5, 0, 1);
        lid.rotation.x = -t * 1.9;
        lid.position.y = 0.86 + t * 0.28;
        lid.position.z = -t * 0.38;
        beam.material.opacity = t * 0.3;
        if (t >= 1) {
          this.state = STATES.ROLLING;
          this.rollElapsed = 0;
          this.rollTimer = 0;
        }
        break;
      }

      case STATES.ROLLING: {
        this.rollElapsed += dt;
        const p = clamp(this.rollElapsed / this.rollDuration, 0, 1);
        // Ease-out: swaps start frantic and stretch out toward the end.
        this.rollInterval = 0.035 + Math.pow(p, 3.1) * 0.42;
        this.iconHeight = 1.35 + p * 0.95 + Math.sin(now * 6) * 0.03;
        beam.material.opacity = 0.3 + p * 0.25;

        this.rollTimer -= dt;
        if (this.rollTimer <= 0) {
          this.rollTimer = this.rollInterval;
          const isLast = p >= 1;
          const id = isLast ? this.resultId : this.sequence[this.seqIndex++ % this.sequence.length];
          this._showIcon(id);
          audio?.slotTick(0.8 + p * 1.4);
          particles?.burst(this.pos.x, this.pos.y + this.iconHeight, this.pos.z, 3, {
            color: RARITY_COLORS[WEAPONS[id].rarity], speed: 2.4, size: 0.05, life: 0.3, gravity: 2,
          });
          if (isLast) {
            this.state = STATES.LANDED;
            this.landTimer = 0;
            const rarity = WEAPONS[this.resultId].rarity;
            audio?.slotLand(rarity);
            particles?.ring(this.pos.x, this.pos.y + 0.1, this.pos.z, {
              from: 0.6, to: 4.5, life: 0.7, color: RARITY_COLORS[rarity],
            });
            particles?.burst(this.pos.x, this.pos.y + this.iconHeight, this.pos.z, 26, {
              color: RARITY_COLORS[rarity], speed: 5, size: 0.09, life: 0.9, gravity: 3,
            });
            particles?.flash(this.pos.x, this.pos.y + this.iconHeight, this.pos.z, RARITY_COLORS[rarity], 6, 0.5, 20);
          }
        }
        if (this.currentIcon) {
          this.currentIcon.position.set(this.pos.x, this.pos.y + this.iconHeight, this.pos.z);
          this.currentIcon.rotation.y = now * 7;
          this.currentIcon.rotation.z = 0.35;
        }
        break;
      }

      case STATES.LANDED: {
        this.landTimer += dt;
        // A held beat where the weapon just hangs there, turning slowly.
        const hover = 2.32 + Math.sin(now * 2.2) * 0.07;
        if (this.currentIcon) {
          this.currentIcon.position.set(this.pos.x, this.pos.y + hover, this.pos.z);
          this.currentIcon.rotation.y = this.landTimer < 0.9 ? now * (7 - this.landTimer * 6) : now * 1.1;
          this.currentIcon.rotation.z = 0.35 - clamp(this.landTimer, 0, 1) * 0.35;
          const pop = this.landTimer < 0.25 ? 1 + (0.25 - this.landTimer) * 1.6 : 1;
          this.currentIcon.scale.setScalar(pop);
        }
        beam.material.opacity = 0.42 + Math.sin(now * 4) * 0.06;
        if (Math.random() < dt * 14) {
          particles?.burst(this.pos.x, this.pos.y + hover, this.pos.z, 1, {
            color: RARITY_COLORS[WEAPONS[this.resultId].rarity], speed: 1, size: 0.05, life: 0.6, gravity: -1.5,
          });
        }
        break;
      }

      case STATES.CLAIMED:
        beam.material.opacity = Math.max(0, beam.material.opacity - dt);
        lid.rotation.x = -1.9;
        break;
      default: break;
    }
  }

  _showIcon(id) {
    if (this.currentIcon) this.currentIcon.visible = false;
    const m = this.iconCache.get(id, this.channel);
    if (!m) return;
    m.visible = true;
    m.scale.setScalar(1);
    this.currentIcon = m;
    this.currentId = id;
  }

  /** Info for the on-screen reveal card. */
  revealInfo() {
    if (!this.resultId) return null;
    const def = WEAPONS[this.resultId];
    return {
      id: def.id, name: def.name, desc: def.desc, tip: def.tip, flavor: def.flavor,
      rarity: def.rarity, rarityName: RARITY_NAMES[def.rarity], color: RARITY_COLORS[def.rarity],
    };
  }

  dispose() {
    if (this.currentIcon) this.currentIcon.visible = false;
    disposeTree(this.group);
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
