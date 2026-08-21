// Firing logic. Everything a weapon's `traits` promise is implemented here.
//
// The game passes a `ctx` bundle with the world hooks so this module never has
// to reach into the scene graph directly.

import * as THREE from '../../vendor/three.module.js';
import { effective } from './synergy.js';
import { applyBabyStage, BABY_STAGES, babyStage } from './weapons.js';
import { TAU, clamp } from '../core/util.js';

const _dir = new THREE.Vector3();
const _tmp = new THREE.Vector3();

export class WeaponRuntime {
  constructor(game) {
    this.game = game;
    this.lastFireTime = -99;
    this.chargeHeld = 0;
    this.grapple = null;      // { target, timer } | { anchor }
  }

  /** Recompute the cached effective stats after a swap or synergy change. */
  refresh(player, pairing) {
    for (const w of [player.slots[0], player.slots[1], player.fists]) {
      if (!w) continue;
      const e = effective(w, pairing);
      w.eff = e;
      w.effectiveMoveMul = e.moveMul;
    }
    const active = player.weapon;
    player.speedMul = pairing?.playerMods?.moveMul ?? 1;
    if (active) active.effectiveMoveMul = active.eff.moveMul;
  }

  eff(weapon) {
    return weapon.eff || effective(weapon, null);
  }

  // -------------------------------------------------------------------------

  update(dt, ctx) {
    const w = ctx.player.weapon;
    if (!w) return;
    const e = this.eff(w);
    const now = ctx.now;

    // Both hands full: you can walk and you can be hit, and that is all. The
    // trade is the point of a carry objective — otherwise it is just a slower
    // walk to the same button.
    if (ctx.player.carryPenalty < 1) {
      ctx.player.firing = false;
      w.charge = 0;
      return;
    }

    // Reload completion
    if (w.reloading && now >= w.reloadEnd) {
      w.reloading = false;
      const need = e.magSize - w.ammo;
      const take = Math.min(need, w.reserveAmmo);
      w.ammo += take;
      w.reserveAmmo -= take;
      ctx.audio.reload(2);
    }

    // Intern-style ramp decays when you stop shooting.
    if (e.traits.has('ramp')) {
      if (now - this.lastFireTime > 0.25) {
        w.ramp = Math.max(0, w.ramp - (e.params.rampDecay || 1) * dt);
      }
    }

    // Behemoth spin-down
    if (e.traits.has('spinup') && !ctx.firing) {
      w.spin = Math.max(0, w.spin - dt / Math.max(0.2, e.params.spinupTime));
    }

    // Actuary charge release
    if (e.traits.has('charge')) {
      if (ctx.firing && !w.reloading && w.ammo > 0 && w.jammedUntil < now) {
        w.charge = Math.min(1, w.charge + dt / Math.max(0.05, e.params.chargeTime));
        if (Math.random() < dt * 12) {
          ctx.particles.burst(ctx.muzzle.x, ctx.muzzle.y, ctx.muzzle.z, 1, {
            color: 0x8ff0ff, speed: 1.5, size: 0.05, life: 0.25, gravity: -2,
          });
        }
      } else if (w.charge > 0) {
        this._fire(ctx, w, e, w.charge);
        w.charge = 0;
      }
      return;
    }

    if (!ctx.firing) return;
    if (w.reloading) return;
    if (now < w.jammedUntil) return;

    // Spin-up before the first round leaves the barrel.
    if (e.traits.has('spinup')) {
      w.spin = Math.min(1, w.spin + dt / Math.max(0.05, e.params.spinupTime));
      if (w.spin < 0.999) {
        if (Math.random() < dt * 8) ctx.audio.ui(160 + w.spin * 340);
        return;
      }
    }

    if (!w.auto && this.lastFireTime > 0 && !ctx.firePressed) return;

    let rate = e.fireRate;
    if (e.traits.has('ramp')) rate *= 1 + w.ramp;
    const interval = 1 / Math.max(0.05, rate);
    if (now - this.lastFireTime < interval) return;

    if (w.ammo <= 0) {
      if (w.reserveAmmo > 0) this.startReload(ctx);
      else ctx.audio.deny();
      this.lastFireTime = now;
      return;
    }

    this._fire(ctx, w, e, 1);
  }

  startReload(ctx) {
    const w = ctx.player.weapon;
    if (!w || w.reloading) return;
    const e = this.eff(w);
    if (!isFinite(e.magSize)) return;
    if (w.ammo >= e.magSize || w.reserveAmmo <= 0) return;
    w.reloading = true;
    w.reloadEnd = ctx.now + e.reload;
    w.spin = 0;
    ctx.audio.reload(0);
    setTimeout(() => ctx.audio.reload(1), Math.min(600, e.reload * 500));
  }

  // -------------------------------------------------------------------------

  _fire(ctx, w, e, chargeScale) {
    const now = ctx.now;
    this.lastFireTime = now;
    w.shotsFired++;
    ctx.player.stats.shotsFired++;

    // FAKe-47 (and the HR Incident pair) jam.
    if (e.traits.has('jam') && Math.random() < (e.params.jamChance || 0.12)) {
      w.jammedUntil = now + (e.params.jamTime || 1);
      ctx.audio.deny();
      ctx.toast(pickJamLine(w.id), 'bad');
      ctx.viewKick(0.4);
      return;
    }

    if (isFinite(e.magSize)) {
      w.ammo--;
      if (w.ammo <= 0 && w.reserveAmmo > 0) this.startReload(ctx);
    }

    if (e.traits.has('ramp')) w.ramp = Math.min(e.params.rampMax || 2, w.ramp + (e.params.rampRate || 0.05));

    if (w.kind === 'melee') { this._melee(ctx, w, e); return; }
    if (e.traits.has('grapple')) { this._grapple(ctx, w, e); return; }
    if (e.traits.has('sandwich')) { this._sandwich(ctx, w, e); return; }

    // Kimvatch's Prototype rerolls itself every trigger pull.
    let rollMod = null;
    if (e.traits.has('random')) rollMod = this._prototypeRoll(ctx, e);

    const pellets = Math.max(1, Math.round(e.pellets * (rollMod?.pellets || 1)));
    // Sights tighten the cone. Not to zero — a shotgun aimed carefully is still
    // a shotgun, and a weapon that becomes a laser on right-click makes hip
    // fire pointless for the rest of the run.
    const adsTighten = 1 - (ctx.player.aim || 0) * 0.62;
    const spread = e.spread * (rollMod?.spread ?? 1) * adsTighten;
    const dmgScale = (rollMod?.damage ?? 1) * (e.traits.has('charge') ? this._chargeScale(e, chargeScale) : 1);

    ctx.audio.shoot({ ...w.sound, volume: (w.sound.volume || 0.5) * (rollMod ? 0.9 : 1) });
    ctx.muzzleFlash(w, e);
    // Shouldering the weapon absorbs some of the kick, which is the other half
    // of why anyone aims.
    ctx.viewKick(e.recoil * (rollMod?.recoil ?? 1)
      * (e.traits.has('charge') ? 0.6 + chargeScale : 1)
      * (1 - (ctx.player.aim || 0) * 0.35));

    const origin = ctx.muzzle;
    ctx.aimDir(_dir);

    for (let i = 0; i < pellets; i++) {
      const dx = _dir.x + (Math.random() - 0.5) * spread * 2;
      const dy = _dir.y + (Math.random() - 0.5) * spread * 2;
      const dz = _dir.z + (Math.random() - 0.5) * spread * 2;
      const len = Math.hypot(dx, dy, dz) || 1;
      const ux = dx / len, uy = dy / len, uz = dz / len;

      const speed = e.speed * (rollMod?.speed ?? 1);
      const damage = e.damage * dmgScale;

      if (speed > 0) {
        ctx.projectiles.spawn({
          x: origin.x, y: origin.y, z: origin.z,
          vx: ux * speed, vy: uy * speed, vz: uz * speed,
          life: Math.min(6, e.range / speed + 0.4),
          damage, color: rollMod?.color ?? bulletColor(w, e),
          size: bulletSize(w, e), radius: bulletSize(w, e) * 1.4,
          hostile: false, weaponId: w.id,
          pierce: e.traits.has('pierce') ? (e.params.pierce || 1) : 0,
          bounces: e.traits.has('ricochet') ? (e.params.bounces || 0) : 0,
          bounceGain: e.params.bounceGain || 1,
          gravity: e.traits.has('jumbify') ? 0 : 0,
          spin: e.traits.has('ricochet') ? 22 : 0,
          traits: e.traits, params: e.params,
        });
      } else {
        this._hitscan(ctx, w, e, origin, ux, uy, uz, damage);
      }
    }
  }

  _chargeScale(e, charge) {
    const full = charge >= 0.999;
    return 0.35 + charge * ((e.params.chargeMult || 2) - 0.35) + (full ? 0.15 : 0);
  }

  _prototypeRoll(ctx, e) {
    const lucky = e.traits.has('luckyRolls');
    const rolls = [
      { name: 'BUCKSHOT', pellets: 8, spread: 6, damage: 0.55, color: 0xff9a3c, good: true },
      { name: 'RAILSHOT', pellets: 1, spread: 0.1, damage: 3.2, color: 0x8ff0ff, good: true },
      { name: 'FIREHOSE', pellets: 3, spread: 3, damage: 0.7, speed: 1.6, color: 0x4affa0, good: true },
      { name: 'HEAVY SLUG', pellets: 1, spread: 0.5, damage: 2.1, recoil: 2, color: 0xffd24a, good: true },
      { name: 'confetti', pellets: 12, spread: 9, damage: 0.14, color: 0xff8ad0, good: false },
      { name: 'sputter', pellets: 1, spread: 4, damage: 0.35, color: 0x9a9a9a, good: false },
      { name: 'DOUBLE TAP', pellets: 2, spread: 0.4, damage: 1.5, color: 0xb894ff, good: true },
      { name: 'wet click', pellets: 1, spread: 1, damage: 0.05, color: 0x6a6a6a, good: false },
    ];
    const pool = lucky ? rolls.filter((r) => r.good) : rolls;
    const r = pool[(Math.random() * pool.length) | 0];
    ctx.toast(r.name, r.good ? 'good' : 'bad', 0.7);
    return r;
  }

  // -------------------------------------------------------------------------

  _hitscan(ctx, w, e, origin, ux, uy, uz, damage) {
    const maxDist = e.range;
    const wall = ctx.level.raycast(origin.x, origin.z, ux, uz, maxDist);
    const wallDist = wall.hit ? wall.dist / Math.max(0.001, Math.hypot(ux, uz)) : maxDist;

    let remaining = e.traits.has('pierce') ? (e.params.pierce || 1) : 0;
    const hits = ctx.raycastTargets(origin, ux, uy, uz, Math.min(maxDist, wallDist));

    let tracerEnd = Math.min(maxDist, wallDist);
    let hitAny = false;

    for (const hit of hits) {
      hitAny = true;
      tracerEnd = hit.dist;
      let dmg = damage;

      // Shotguns lose bite with distance.
      if (w.tags.includes('shotgun')) dmg *= clamp(1 - (hit.dist - 10) / 20, 0.35, 1);

      this.applyHit(ctx, w, e, hit.target, dmg, {
        headshot: hit.headshot, ux, uy, uz,
        point: hit.point,
      });
      if (remaining <= 0) break;
      remaining--;
    }

    // Tracer + impact
    const ex = origin.x + ux * tracerEnd, ey = origin.y + uy * tracerEnd, ez = origin.z + uz * tracerEnd;
    ctx.particles.beam(origin.x, origin.y, origin.z, ex, ey, ez, {
      color: bulletColor(w, e), width: w.tags.includes('shotgun') ? 0.018 : 0.026, life: 0.055,
    });
    if (!hitAny && wall.hit) {
      ctx.particles.burst(ex, ey, ez, 4, { color: 0xcccccc, speed: 3.4, size: 0.05, life: 0.3, cone: true });
    }
  }

  // -------------------------------------------------------------------------

  _melee(ctx, w, e) {
    ctx.audio.melee(w.sound.pitch || 400, w.kind === 'melee' ? 0.16 : 0.1);
    ctx.viewKick(e.recoil, true);
    ctx.swingViewmodel();

    const player = ctx.player;
    ctx.aimDir(_dir);
    const range = e.range;
    const arc = e.traits.has('cleave') ? (e.params.cleaveArc || 2.2) : 1.1;
    const targets = ctx.targetsInCone(player.pos, _dir, range, arc);
    const cleave = e.traits.has('cleave');

    let struck = 0;
    for (const t of targets) {
      if (!cleave && struck >= 1) break;
      struck++;
      let dmg = e.damage;

      // Tiny Knife rewards getting behind things.
      if (e.traits.has('backstab')) {
        const toT = _tmp.set(t.pos.x - player.pos.x, 0, t.pos.z - player.pos.z).normalize();
        const facing = Math.atan2(Math.sin(t.facing), Math.cos(t.facing));
        const behind = Math.cos(facing - Math.atan2(toT.x, toT.z));
        if (behind > 0.35) {
          dmg *= e.params.backstabMult || 3;
          ctx.toast('BACKSTAB', 'good', 0.5);
        }
      }
      if (e.traits.has('markedBonus') && t.marked > 0) dmg *= e.params.markedMult || 3;

      const dx = t.pos.x - player.pos.x, dz = t.pos.z - player.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      this.applyHit(ctx, w, e, t, dmg, { ux: dx / len, uy: 0, uz: dz / len, melee: true });
    }

    if (struck) {
      ctx.particles.burst(
        player.pos.x + _dir.x * range * 0.6, player.eyeY() - 0.2, player.pos.z + _dir.z * range * 0.6,
        cleave ? 12 : 6, { color: 0xffffff, speed: 5, size: 0.07, life: 0.25 },
      );
    }
  }

  // -------------------------------------------------------------------------

  _grapple(ctx, w, e) {
    const player = ctx.player;
    ctx.aimDir(_dir);
    ctx.audio.shoot({ ...w.sound });
    ctx.viewKick(e.recoil);

    const hits = ctx.raycastTargets(ctx.muzzle, _dir.x, _dir.y, _dir.z, e.range);
    const wall = ctx.level.raycast(ctx.muzzle.x, ctx.muzzle.z, _dir.x, _dir.z, e.range);

    if (hits.length && (!wall.hit || hits[0].dist < wall.dist)) {
      const t = hits[0].target;
      ctx.particles.beam(ctx.muzzle.x, ctx.muzzle.y, ctx.muzzle.z, t.pos.x, t.feetY + t.height * 0.5, t.pos.z, {
        color: 0x6fd8ff, width: 0.05, life: 0.25,
      });
      this.applyHit(ctx, w, e, t, e.damage, { ux: _dir.x, uy: 0, uz: _dir.z });
      t.marked = Math.max(t.marked, e.params.markTime || 4);

      // Light things get reeled in; heavy things reel you.
      const heavy = t.radius > 1.0 || t.maxHp > 900;
      if (heavy) {
        const dx = t.pos.x - player.pos.x, dz = t.pos.z - player.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        player.vel.x = (dx / len) * (e.params.pullSpeed || 24);
        player.vel.z = (dz / len) * (e.params.pullSpeed || 24);
        player.vy = 3.2;
        ctx.toast('REELED IN', 'good', 0.6);
      } else {
        const dx = player.pos.x - t.pos.x, dz = player.pos.z - t.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        t.knock(dx / len, dz / len, (e.params.pullSpeed || 24) * 0.9);
      }
      ctx.audio.pickup();
    } else if (wall.hit) {
      const wx = ctx.muzzle.x + _dir.x * wall.dist;
      const wz = ctx.muzzle.z + _dir.z * wall.dist;
      ctx.particles.beam(ctx.muzzle.x, ctx.muzzle.y, ctx.muzzle.z, wx, ctx.muzzle.y, wz, {
        color: 0x6fd8ff, width: 0.05, life: 0.25,
      });
      const dx = wx - player.pos.x, dz = wz - player.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      player.vel.x = (dx / len) * (e.params.pullSpeed || 24);
      player.vel.z = (dz / len) * (e.params.pullSpeed || 24);
      player.vy = 4.2;
      player.onGround = false;
      ctx.audio.doorOpen();
    } else {
      ctx.audio.deny();
    }
  }

  // -------------------------------------------------------------------------

  _sandwich(ctx, w, e) {
    ctx.audio.shoot({ ...w.sound });
    ctx.viewKick(e.recoil * 0.6);
    ctx.aimDir(_dir);
    const spoiled = e.traits.has('spoiled');
    ctx.projectiles.spawn({
      x: ctx.muzzle.x, y: ctx.muzzle.y, z: ctx.muzzle.z,
      vx: _dir.x * e.speed + (Math.random() - 0.5) * 2,
      vy: _dir.y * e.speed + 2.5,
      vz: _dir.z * e.speed + (Math.random() - 0.5) * 2,
      life: 4, damage: e.damage, color: spoiled ? 0x7a8a3a : 0xd9a441,
      size: 0.22, radius: 0.3, gravity: 12, hostile: false, weaponId: w.id,
      traits: e.traits, params: e.params,
    });
  }

  // -------------------------------------------------------------------------

  /**
   * Central damage application. Every trait that reacts to a hit lives here so
   * bullets, pellets, melee swings and projectiles all behave consistently.
   */
  applyHit(ctx, w, e, target, damage, opts = {}) {
    if (!target || !target.alive) return;
    const player = ctx.player;

    // Null Pointer sometimes dereferences nothing at all.
    if (e.traits.has('nullpointer')) {
      if (Math.random() < (e.params.missChance || 0.2)) {
        ctx.damageNumbers.add(target.pos.x, target.headY(), target.pos.z, 0, 'miss');
        ctx.audio.ui(140);
        return;
      }
      if (Math.random() < (e.params.deleteChance || 0.05) && !target.def) {
        ctx.toast('SEGMENTATION FAULT', 'good', 1.1);
        ctx.audio.glitch(1.2);
        ctx.particles.burst(target.pos.x, target.pos.y + 1, target.pos.z, 24, { color: 0x2effe0, speed: 8 });
        const res = target.takeDamage(target.hp + 9999, {});
        ctx.onTargetDamaged(target, res, w, e, opts);
        return;
      }
    }

    let dmg = damage;
    let crit = false;
    if (Math.random() < e.critChance) { crit = true; dmg *= e.critMult; }
    const head = !!opts.headshot;
    if (head) dmg *= e.headMult * (e.traits.has('bigHead') ? 1.6 : 1);

    if (e.traits.has('shardScaling')) {
      const per = e.params.shardsPerPoint || 40;
      const cap = e.params.shardCap || 90;
      dmg += Math.min(cap, player.shards / per);
    }

    // Pass where the shot came from, so the flinch folds the right way.
    const res = target.takeDamage(dmg, { crit, source: opts.point || ctx.muzzle });
    if (res.dealt <= 0) return;

    player.stats.damageDealt += res.dealt;
    ctx.damageNumbers.add(
      target.pos.x + (Math.random() - 0.5) * 0.5,
      target.headY() + 0.2,
      target.pos.z + (Math.random() - 0.5) * 0.5,
      res.dealt, head ? 'head' : crit ? 'crit' : 'normal',
    );
    if (head) {
      player.stats.headshots++;
      ctx.audio.headshot();
      ctx.toast('HEADSHOT', 'good', 0.7);
      // A bright spray from the head itself, so the hit reads at a glance.
      ctx.particles.burst(target.pos.x, target.headY(), target.pos.z, 12, {
        color: [0xffffff, 0xffd24a, target.type?.build?.eye ?? 0xffffff],
        speed: 6, size: 0.09, life: 0.45,
      });
      ctx.particles.ring(target.pos.x, target.headY(), target.pos.z, {
        from: 0.15, to: 1.1, life: 0.28, color: 0xffd24a, flat: false,
      });
      ctx.particles.flash(target.pos.x, target.headY(), target.pos.z, 0xffd8a0, 2.4, 0.1, 7);
    } else {
      ctx.audio.hit(crit ? 'crit' : (target.type?.hitSound || 'flesh'));
    }
    ctx.hitMarker(crit || head, head);

    const px = opts.point?.x ?? target.pos.x;
    const py = opts.point?.y ?? (target.feetY + target.height * 0.55);
    const pz = opts.point?.z ?? target.pos.z;
    ctx.particles.burst(px, py, pz, crit ? 8 : 4, {
      color: target.type?.build?.body ?? 0xff5a5a, speed: 4, size: 0.06, life: 0.3,
    });

    if (opts.ux !== undefined) target.knock(opts.ux, opts.uz, e.knockback);

    // ---- reactive traits ----
    if (e.traits.has('lifesteal')) {
      const gained = player.heal(res.dealt * (e.params.lifesteal || 0.1));
      if (gained > 0) {
        if (e.traits.has('debt')) player.debt = Math.min(e.params.debtCap || 45, player.debt + gained * (e.params.debtRate || 0.35));
        ctx.particles.burst(player.pos.x, player.eyeY() - 0.4, player.pos.z, 2, {
          color: 0xff3a4a, speed: 1.2, size: 0.05, life: 0.4, gravity: -3,
        });
      }
    }

    if (e.traits.has('slick') && res.killed) {
      ctx.addSlick(target.pos.x, target.pos.z, e.params.slickRadius || 3, e.params.slickTime || 4);
    }

    if (e.traits.has('jumbify') && !res.killed) {
      this._jumbify(ctx, e, target);
    }

    if (e.traits.has('chain')) {
      this._chain(ctx, w, e, target, res.dealt);
    }

    if (e.traits.has('critArc') && crit) {
      const near = ctx.nearestOther(target, 8);
      if (near) {
        ctx.particles.arc(target.pos.x, target.headY(), target.pos.z, near.pos.x, near.headY(), near.pos.z, 0xffd24a, 4);
        const r2 = near.takeDamage(dmg * 0.6, {});
        ctx.onTargetDamaged(near, r2, w, e, {});
      }
    }

    if (e.traits.has('harpoon')) {
      target.tether = Math.max(target.tether, e.params.tetherTime || 4);
      target.tetherDps = Math.max(target.tetherDps, e.params.tetherDamage || 12);
      target.tetherDrain = e.traits.has('tetherDrain');
    }

    if (e.traits.has('explosive')) {
      const r = e.params.splashRadius || 1.8;
      ctx.splash(px, py, pz, r, e.params.splashDamage || 12, w, e);
      ctx.particles.burst(px, py, pz, 5, { color: 0xffa04a, speed: 4, size: 0.08, life: 0.25 });
    }

    ctx.onTargetDamaged(target, res, w, e, opts);
  }

  _jumbify(ctx, e, target) {
    if (target.def) { // bosses only get a brief slow
      target.slowFactor = 0.55;
      target.slowUntil = ctx.now + 2;
      return;
    }
    if (target.jumbified > 0) return;
    target.jumbified = e.params.jumbifyTime || 4;
    target.jumboBurst = {
      damage: e.params.burstDamage || 60,
      radius: e.params.burstRadius || 4,
      catered: e.traits.has('cateredBurst'),
      electric: e.traits.has('electricBurst'),
    };
    ctx.toast('JUMBIFIED', 'good', 0.6);
    ctx.audio.ui(880);
    ctx.particles.ring(target.pos.x, 0.08, target.pos.z, { from: 0.4, to: 2.6, life: 0.4, color: 0x6fffe4 });
  }

  _chain(ctx, w, e, from, baseDamage) {
    const count = Math.round(e.params.chainTargets || 3);
    const range = e.params.chainRange || 7;
    const falloff = e.params.chainFalloff || 0.7;
    let src = from;
    let dmg = baseDamage * falloff;
    const visited = new Set([src.id]);
    for (let i = 0; i < count; i++) {
      const next = ctx.nearestOther(src, range, visited);
      if (!next) break;
      visited.add(next.id);
      ctx.particles.arc(src.pos.x, src.headY(), src.pos.z, next.pos.x, next.headY(), next.pos.z, 0x8ff0ff, 5);
      const res = next.takeDamage(dmg, {});
      ctx.damageNumbers.add(next.pos.x, next.headY(), next.pos.z, res.dealt, 'normal');
      ctx.onTargetDamaged(next, res, w, e, {});
      src = next;
      dmg *= falloff;
    }
    ctx.audio.hit('metal');
  }

  // -------------------------------------------------------------------------

  /** Progress the Baby's First Gun ladder. Returns true if it evolved. */
  registerKill(ctx, weapon, viaOtherWeapon = false) {
    if (!weapon) return false;
    weapon.kills++;
    if (weapon.kind === 'melee' && !viaOtherWeapon) ctx.player.stats.meleeKills++;
    if (!weapon.traits.includes('evolve')) return false;
    const stage = babyStage(weapon);
    const gain = viaOtherWeapon ? 3 : 1;
    weapon.evoProgress = (weapon.evoProgress || 0) + gain;
    if (weapon.evoProgress >= stage.killsToNext && weapon.params.stage < BABY_STAGES.length - 1) {
      weapon.params.stage++;
      weapon.evoProgress = 0;
      applyBabyStage(weapon);
      weapon.ammo = weapon.magSize;
      weapon.reserveAmmo = Math.max(weapon.reserveAmmo, 200);
      const next = babyStage(weapon);
      ctx.audio.levelUp();
      ctx.onWeaponEvolved?.(weapon, next);
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------

function bulletColor(w, e) {
  if (w.stageColor) return w.stageColor;
  if (w.tags.includes('energy')) return 0x8ff0ff;
  if (w.tags.includes('anomaly')) return 0x6fffe4;
  if (w.tags.includes('food')) return 0xd9a441;
  if (w.tags.includes('glitch')) return 0x2effe0;
  if (w.id === 'fake47') return 0x9a9a9a;
  return 0xffd98a;
}

function bulletSize(w, e) {
  if (w.tags.includes('shotgun')) return 0.07;
  if (w.tags.includes('heavy')) return 0.13;
  if (w.id === 'nimbo') return 0.3;
  if (w.id === 'sawblade') return 0.26;
  if (w.id === 'harpoon') return 0.14;
  return 0.09;
}

const JAM_LINES = {
  fake47: ['*click*', 'JAMMED', 'the bolt fell off', 'it went sideways', 'that was not a bullet'],
  intern: ['"quick question—"', 'INTERN: filing something', 'unpaid, unbothered'],
  compliance: ['REVIEWING PAPERWORK', 'PENDING APPROVAL', 'ESCALATED TO HR'],
};

function pickJamLine(id) {
  const pool = JAM_LINES[id] || ['JAMMED'];
  return pool[(Math.random() * pool.length) | 0];
}
