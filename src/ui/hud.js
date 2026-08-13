// Thin wrapper over the DOM in index.html. The game calls setters; nothing here
// knows about the simulation.

import { WEAPONS, RARITY_NAMES, babyStage } from '../combat/weapons.js';
import { clamp, formatTime } from '../core/util.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      crosshair: $('crosshair'),
      hitmarker: $('hitmarker'),
      vignette: $('vignette'),
      glitch: $('glitchOverlay'),
      flash: $('flashOverlay'),
      floorNum: $('floorNum'),
      floorName: $('floorName'),
      objText: $('objText'),
      objBar: $('objBar').firstElementChild,
      waveInfo: $('waveInfo'),
      shardVal: $('shardVal'),
      runTime: $('runTime'),
      killCount: $('killCount'),
      bossBar: $('bossBar'),
      bossName: $('bossName'),
      bossTitle: $('bossTitle'),
      bossFill: $('bossFill'),
      hpFill: $('hpFill'),
      debtFill: $('debtFill'),
      hpVal: $('hpVal'),
      statusRow: $('statusRow'),
      slots: [$('slot0'), $('slot1')],
      reloadBar: $('reloadBar'),
      chargeBar: $('chargeBar'),
      synergyPanel: $('synergyPanel'),
      interact: $('interactPrompt'),
      toasts: $('toasts'),
      banner: $('bigBanner'),
      bannerMain: $('bannerMain'),
      bannerSub: $('bannerSub'),
      intercom: $('intercom'),
      intercomSpeaker: $('intercomSpeaker'),
      intercomText: $('intercomText'),
      compass: $('compass'),
      dmgnums: $('dmgnums'),
    };
    this._hitTimer = 0;
    this._bannerTimer = 0;
    this._flashTimer = 0;
    this._glitchTimer = 0;
    this._synKey = '';
    this._slotCache = ['', ''];
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setFloor(cfg) {
    this.el.floorNum.textContent = cfg.index === 0 ? 'B1' : `F${cfg.index}`;
    this.el.floorName.textContent = cfg.name;
  }

  setObjective(text, progress) {
    this.el.objText.textContent = text;
    this.el.objBar.style.width = `${clamp(progress, 0, 1) * 100}%`;
  }

  setWave(text) {
    if (!text) { this.el.waveInfo.classList.add('hidden'); return; }
    this.el.waveInfo.classList.remove('hidden');
    this.el.waveInfo.innerHTML = text;
  }

  setStats(shards, time, kills) {
    this.el.shardVal.textContent = String(shards);
    this.el.runTime.textContent = formatTime(time);
    this.el.killCount.textContent = `${kills} kills`;
  }

  setHealth(hp, max, debt) {
    const f = clamp(hp / max, 0, 1);
    this.el.hpFill.style.width = `${f * 100}%`;
    this.el.hpVal.textContent = String(Math.ceil(hp));
    this.el.debtFill.style.width = `${clamp(debt / max, 0, 1) * 100}%`;
    this.el.hpVal.style.color = f < 0.3 ? 'var(--red)' : '';
  }

  setStatuses(list) {
    const key = list.map((s) => s.label).join('|');
    if (key === this._statusKey) return;
    this._statusKey = key;
    this.el.statusRow.innerHTML = list
      .map((s) => `<span class="status" style="color:${s.color}">${s.label}</span>`)
      .join('');
  }

  setBoss(boss) {
    if (!boss) { this.el.bossBar.classList.add('hidden'); return; }
    this.el.bossBar.classList.remove('hidden');
    this.el.bossName.textContent = boss.def.name;
    this.el.bossTitle.textContent = boss.def.title;
    this.el.bossFill.style.width = `${boss.hpFraction * 100}%`;
  }

  setLoadout(player, runtime) {
    for (let i = 0; i < 2; i++) {
      const el = this.el.slots[i];
      const isActive = player.activeSlot === i;
      // An empty active slot still shows what you're holding: your fists.
      const shown = player.slots[i] || (isActive ? player.weapon : null);
      const nameEl = el.querySelector('.slot-name');
      const ammoEl = el.querySelector('.slot-ammo');

      el.classList.toggle('active', isActive);
      el.classList.remove('r0', 'r1', 'r2', 'r3');

      if (!shown) {
        nameEl.textContent = '— empty —';
        nameEl.style.color = '';
        ammoEl.textContent = '';
        ammoEl.classList.remove('low');
        continue;
      }
      el.classList.add(`r${shown.rarity}`);
      nameEl.textContent = shown.name;
      if (!isFinite(shown.magSize)) {
        ammoEl.textContent = '∞';
        ammoEl.classList.remove('low');
      } else {
        const mag = runtime ? Math.round(runtime.eff(shown).magSize) : shown.magSize;
        ammoEl.innerHTML = `${shown.ammo}<span class="res"> / ${shown.reserveAmmo}</span>`;
        ammoEl.classList.toggle('low', shown.ammo <= Math.max(1, mag * 0.25));
      }
    }

    const w = player.weapon;
    if (w && w.reloading) {
      this.el.reloadBar.classList.remove('hidden');
      const e = runtime.eff(w);
      const p = 1 - clamp((w.reloadEnd - runtime.game.now) / Math.max(0.05, e.reload), 0, 1);
      this.el.reloadBar.firstElementChild.style.width = `${p * 100}%`;
    } else {
      this.el.reloadBar.classList.add('hidden');
    }

    if (w && w.charge > 0.001) {
      this.el.chargeBar.classList.remove('hidden');
      this.el.chargeBar.firstElementChild.style.width = `${w.charge * 100}%`;
    } else {
      this.el.chargeBar.classList.add('hidden');
    }

    this.el.crosshair.classList.toggle('wide', !!(w && w.tags.includes('shotgun')));
  }

  setSynergies(list) {
    const key = list.map((s) => s.id).join('|');
    if (key === this._synKey) return;
    this._synKey = key;
    this.el.synergyPanel.innerHTML = list.map((s) => `
      <div class="syn ${s.kind === 'desynergy' ? 'bad' : ''}">
        <div class="n">${s.kind === 'desynergy' ? '⚠ ' : '✦ '}${s.name}</div>
        <div class="d">${s.detail}</div>
      </div>`).join('');
  }

  setInteract(text) {
    if (!text) { this.el.interact.classList.add('hidden'); return; }
    this.el.interact.classList.remove('hidden');
    this.el.interact.querySelector('span').textContent = text;
  }

  toast(text, kind = 'info', life = 1.4) {
    const div = document.createElement('div');
    div.className = `toast ${kind}`;
    div.textContent = text;
    this.el.toasts.appendChild(div);
    setTimeout(() => {
      div.style.transition = 'opacity .25s';
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 260);
    }, life * 1000);
    while (this.el.toasts.children.length > 5) this.el.toasts.firstChild.remove();
  }

  banner(main, sub, life = 3) {
    this.el.banner.classList.remove('hidden');
    this.el.bannerMain.textContent = main;
    this.el.bannerSub.textContent = sub || '';
    this._bannerTimer = life;
  }

  intercom(speaker, text, cls) {
    this.el.intercom.classList.remove('hidden');
    this.el.intercom.className = cls || '';
    this.el.intercomSpeaker.textContent = speaker;
    this.el.intercomText.textContent = text;
  }

  hideIntercom() { this.el.intercom.classList.add('hidden'); }

  hitMarker(crit, head) {
    this.el.hitmarker.classList.add('on');
    this.el.hitmarker.classList.toggle('crit', !!crit && !head);
    this.el.hitmarker.classList.toggle('head', !!head);
    this._hitTimer = head ? 0.2 : 0.13;
  }

  screenFlash(alpha = 0.5) {
    this.el.flash.style.opacity = String(alpha);
    this._flashTimer = 0.14;
  }

  glitchBurst(life = 0.4) { this._glitchTimer = life; }

  setDamageVignette(v) { this.el.vignette.style.opacity = String(clamp(v, 0, 1)); }

  setCompass(text) { this.el.compass.textContent = text; }

  update(dt) {
    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
      if (this._hitTimer <= 0) this.el.hitmarker.classList.remove('on', 'head', 'crit');
    }
    if (this._bannerTimer > 0) {
      this._bannerTimer -= dt;
      if (this._bannerTimer <= 0) this.el.banner.classList.add('hidden');
    }
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      this.el.flash.style.opacity = String(Math.max(0, this._flashTimer / 0.14) * 0.5);
    }
    if (this._glitchTimer > 0) {
      this._glitchTimer -= dt;
      this.el.glitch.style.opacity = String(Math.max(0, this._glitchTimer) * 0.9 * (0.5 + Math.random() * 0.5));
      if (this._glitchTimer <= 0) this.el.glitch.style.opacity = '0';
    }
  }
}

// ---------------------------------------------------------------------------
// Static screens
// ---------------------------------------------------------------------------

export function buildCodex() {
  const list = $('codexList');
  const order = Object.values(WEAPONS).sort((a, b) => a.rarity - b.rarity || a.name.localeCompare(b.name));
  list.innerHTML = order.map((w) => `
    <div class="codex-item r${w.rarity}">
      <div class="cn">${w.name}</div>
      <div class="cr">${RARITY_NAMES[w.rarity]} · ${w.kind === 'melee' ? 'MELEE' : 'RANGED'}</div>
      <div class="cd">${w.desc}</div>
      <div class="ct">${w.tip || ''}</div>
    </div>`).join('');
}

export function renderLoadoutDetail(player, runtime, pairing) {
  const el = $('loadoutDetail');
  const cards = [];
  for (let i = 0; i < 2; i++) {
    const w = player.slots[i] || (i === 0 ? player.fists : null);
    if (!w) {
      cards.push('<div class="ld-card"><h4>— empty —</h4><div class="r">NOTHING IN THIS HAND</div></div>');
      continue;
    }
    const e = runtime.eff(w);
    const dps = (e.damage * e.pellets * e.fireRate).toFixed(0);
    const stage = w.id === 'babygun' ? babyStage(w) : null;
    const progress = stage && isFinite(stage.killsToNext)
      ? `<div class="tip">Evolution: ${w.evoProgress || 0} / ${stage.killsToNext} kills</div>` : '';
    cards.push(`
      <div class="ld-card r${w.rarity}">
        <h4>${w.name}</h4>
        <div class="r">${RARITY_NAMES[w.rarity]} · SLOT ${i + 1}${player.activeSlot === i ? ' · ACTIVE' : ''}</div>
        <div class="ld-stats">
          <span>Damage</span><b>${e.damage.toFixed(1)}${e.pellets > 1 ? ` ×${e.pellets}` : ''}</b>
          <span>Rate</span><b>${e.fireRate.toFixed(2)}/s</b>
          <span>Burst DPS</span><b>${dps}</b>
          <span>Magazine</span><b>${isFinite(e.magSize) ? Math.round(e.magSize) : '∞'}</b>
          <span>Reload</span><b>${e.reload ? `${e.reload.toFixed(1)}s` : '—'}</b>
          <span>Crit</span><b>${(e.critChance * 100).toFixed(0)}% ×${e.critMult.toFixed(1)}</b>
          <span>Kills</span><b>${w.kills}</b>
          <span>Move</span><b>${(e.moveMul * 100).toFixed(0)}%</b>
        </div>
        <div class="tip">${w.tip || w.desc}</div>
        ${progress}
      </div>`);
  }
  const syn = pairing.active.map((r) => `
    <div class="ld-card ${r.kind === 'desynergy' ? 'r3' : 'r1'}">
      <h4>${r.kind === 'desynergy' ? '⚠' : '✦'} ${r.name}</h4>
      <div class="r">${r.kind === 'desynergy' ? 'DESYNCHRONISATION' : 'SYNERGY'}</div>
      <div class="tip">${r.detail}</div>
      <div class="tip" style="color:var(--dim);font-style:italic">${r.text}</div>
    </div>`).join('');
  el.innerHTML = cards.join('') + syn;
}
