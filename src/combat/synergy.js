// Synergies and desynergies between the two weapons you're carrying.
//
// A pairing is evaluated whenever the loadout changes. Matching rules produce
// a list of "mods" — multiplicative stat tweaks and extra traits — that the
// combat runtime reads through `effective()`. Nothing here mutates the weapon
// definitions themselves, so swapping a gun out cleanly undoes everything.

/**
 * match forms:
 *   { ids: ['a','b'] }                  both specific weapons, order-free
 *   { id: 'a', tag: 'melee' }           one specific + the other has a tag
 *   { id: 'a', family: 'baby' }         one specific + the other is in a family
 * mods: { [weaponId|'*'|'other'|'self']: { damage, fireRate, reload, spread, ... } }
 * flags: extra traits granted, keyed the same way.
 */

const FAMILIES = {
  baby: ['babygun'],
  melee: null, // resolved via tag
};

export const SYNERGIES = [
  {
    id: 'understudy', name: 'The Understudy', kind: 'synergy',
    ids: ['ak47', 'fake47'],
    text: 'The FAKe-47 has spent ten minutes next to a real one and taken notes.',
    detail: 'FAKe-47: 6x damage, no jams, tight spread. AK-47: +10% fire rate.',
    mods: { fake47: { damage: 6, spread: 0.22, fireRate: 1.25 }, ak47: { fireRate: 1.1 } },
    remove: { fake47: ['jam'] },
  },
  {
    id: 'bloodmoney', name: 'Blood Money', kind: 'synergy',
    id1: 'sanguine', tag: 'ballistic',
    text: 'The Ledger has started auditing your bullets. It approves.',
    detail: 'Your firearm drains 9% of the damage it deals back into your health.',
    flags: { other: ['lifesteal'] },
    grantParams: { other: { lifesteal: 0.09 } },
  },
  {
    id: 'yankspank', name: 'Yank & Spank', kind: 'synergy',
    ids: ['grappler', 'bigknife'],
    text: 'Bring the problem to the knife. The knife is not going to travel.',
    detail: 'Marked targets take 3x knife damage. Large Knife swings 45% faster.',
    mods: { bigknife: { fireRate: 1.45 } },
    flags: { bigknife: ['markedBonus'] },
    grantParams: { bigknife: { markedMult: 3 } },
  },
  {
    id: 'catering', name: 'Catering Anomaly', kind: 'synergy',
    ids: ['nimbo', 'sandwich'],
    text: 'A jumbified enemy is, dietarily speaking, mostly bread.',
    detail: 'Jumbo bursts scatter sandwiches. Nimbo bursts hit 40% harder.',
    mods: { nimbo: { burstDamage: 1.4 } },
    flags: { nimbo: ['cateredBurst'] },
  },
  {
    id: 'brasssass', name: 'Brass & Sass', kind: 'synergy',
    ids: ['knuckles', 'tinyknife'],
    text: 'Two very small solutions, applied at an unreasonable rate.',
    detail: 'Both +55% attack speed. Crits arc to a second enemy nearby.',
    mods: { knuckles: { fireRate: 1.55 }, tinyknife: { fireRate: 1.55 } },
    flags: { knuckles: ['critArc'], tinyknife: ['critArc'] },
  },
  {
    id: 'growingpains', name: 'Growing Pains', kind: 'synergy',
    ids: ['deagle', 'babygun'],
    text: 'The Eagle is not mentoring it. The Eagle is simply nearby, being excellent.',
    detail: 'Desert Eagle kills grant 3x evolution progress. Baby line +25% damage.',
    mods: { babygun: { damage: 1.25 } },
    flags: { deagle: ['feedsEvolution'] },
  },
  {
    id: 'ionstorm', name: 'Ion Storm', kind: 'synergy',
    ids: ['zapper', 'nimbo'],
    text: 'Charged particles and whatever a Jumbus is. Do not stand in the middle.',
    detail: 'Zapper arcs to 6 targets. Jumbo bursts electrify and stun.',
    mods: { zapper: { chainTargets: 2, chainRange: 1.3 } },
    flags: { nimbo: ['electricBurst'] },
  },
  {
    id: 'mentorship', name: 'Mentorship Program', kind: 'synergy',
    id1: 'intern', family: 'baby',
    text: 'The Intern has found something less experienced than itself. It is thriving.',
    detail: 'Intern ramps twice as fast. The Baby line inherits the ramp.',
    mods: { intern: { rampRate: 2 } },
    flags: { babygun: ['ramp'] },
    grantParams: { babygun: { rampMax: 2, rampRate: 0.04, rampDecay: 1.2 } },
  },
  {
    id: 'audittrail', name: 'Audit Trail', kind: 'synergy',
    ids: ['compliance', 'nullptr'],
    text: 'Every deletion is now properly documented, which somehow makes it worse.',
    detail: 'Null Pointer: delete chance doubled, misses halved. Officer: 1.6x shard scaling.',
    mods: { nullptr: { deleteChance: 2, missChance: 0.5 }, compliance: { shardsPerPoint: 0.62 } },
  },
  {
    id: 'overclock', name: 'Overclock', kind: 'synergy',
    ids: ['behemoth', 'prototype'],
    text: 'The prototype recognises its own handwriting in the Behemoth. It cooperates.',
    detail: 'Behemoth spins up instantly and moves 15% faster. Prototype rolls only good outcomes.',
    mods: { behemoth: { spinupTime: 0.2, moveMul: 1.18 } },
    flags: { prototype: ['luckyRolls'] },
  },
  {
    id: 'buzzsaw', name: 'Buzzsaw Buffet', kind: 'synergy',
    ids: ['sawblade', 'roombroom'],
    text: 'Spread and ricochet. The room stops having corners.',
    detail: 'Sawblades split into two on their first bounce. Room Broom fires 4 more pellets.',
    mods: { roombroom: { pellets: 1.45 } },
    flags: { sawblade: ['splitBounce'] },
  },
  {
    id: 'catchrelease', name: 'Catch & Release', kind: 'synergy',
    ids: ['harpoon', 'sanguine'],
    text: 'The line runs both ways, and the Ledger has opinions about which way.',
    detail: 'Tethered enemies bleed into you. Harpoon +30% damage.',
    mods: { harpoon: { damage: 1.3 } },
    flags: { harpoon: ['tetherDrain'] },
  },
  {
    id: 'actuarial', name: 'Actuarial Table', kind: 'synergy',
    ids: ['actuary', 'deagle'],
    text: 'Two instruments that consider missing to be a clerical failure.',
    detail: 'Both: +60% headshot damage. Actuary charges 40% faster.',
    mods: { actuary: { chargeTime: 0.6 }, deagle: { headMult: 1.6 }, actuaryHead: {} },
    flags: { actuary: ['bigHead'], deagle: ['bigHead'] },
  },
  {
    id: 'deepclean', name: 'Deep Clean', kind: 'synergy',
    id1: 'mop', tag: 'melee',
    text: 'Two-handed sanitation. The Custodian would have wanted this.',
    detail: 'Every melee kill leaves a slowing slick. Both melee weapons +20% damage.',
    mods: { mop: { damage: 1.2 }, other: { damage: 1.2 } },
    flags: { other: ['slick'] },
    grantParams: { other: { slickRadius: 3, slickTime: 4 } },
  },
  {
    id: 'oldschool', name: 'Old School', kind: 'synergy',
    ids: ['babygun', 'knuckles'], requires: (a, b) => {
      const baby = a.id === 'babygun' ? a : b;
      return (baby.params.stage | 0) >= 5;
    },
    text: 'Grandpa remembers when this was all fists. Grandpa approves of your fists.',
    detail: 'Both +40% damage. Knuckles knock enemies into next week.',
    mods: { babygun: { damage: 1.4 }, knuckles: { damage: 1.4, knockback: 2.2 } },
  },

  // ---- Desynergies: the meme pairs --------------------------------------
  {
    id: 'foodpoisoning', name: 'Food Poisoning', kind: 'desynergy',
    ids: ['sandwich', 'sanguine'],
    text: 'The Ledger will not drink from anything the Sandwich Machine has touched.',
    detail: 'Lifesteal disabled. Sandwiches damage YOU. Both -25% damage.',
    mods: { sandwich: { damage: 0.75 }, sanguine: { damage: 0.75, lifesteal: 0 } },
    flags: { sandwich: ['spoiled'] },
  },
  {
    id: 'overcompensating', name: 'Overcompensating', kind: 'desynergy',
    ids: ['deagle', 'tinyknife'],
    text: 'The Eagle keeps asking the tiny knife what its whole deal is.',
    detail: 'Both -35% damage. Neither will discuss it further.',
    mods: { deagle: { damage: 0.65 }, tinyknife: { damage: 0.65 } },
  },
  {
    id: 'whypunching', name: 'Why Are You Punching', kind: 'desynergy',
    ids: ['behemoth', 'knuckles'],
    text: 'You are carrying a crew-served weapon. You have chosen to punch.',
    detail: 'Behemoth -45% fire rate and slower spin-up. Knuckles unaffected, smugly.',
    mods: { behemoth: { fireRate: 0.55, spinupTime: 2.2 } },
  },
  {
    id: 'hrincident', name: 'HR Incident', kind: 'desynergy',
    ids: ['intern', 'compliance'],
    text: 'The Intern filed something. The Officer received something. Work has stopped.',
    detail: 'Both randomly refuse to fire for a second. Repeatedly. Loudly.',
    flags: { intern: ['jam'], compliance: ['jam'] },
    grantParams: { intern: { jamChance: 0.13, jamTime: 0.9 }, compliance: { jamChance: 0.16, jamTime: 1.0 } },
  },
  {
    id: 'rockbottom', name: 'Rock Bottom', kind: 'desynergy',
    ids: ['fake47', 'babygun'],
    text: 'The two least threatening objects in the Pod, together at last.',
    detail: 'Both -50% damage. You move 35% faster, because you should be running.',
    mods: { fake47: { damage: 0.5 }, babygun: { damage: 0.5 } },
    playerMods: { moveMul: 1.35 },
  },
  {
    id: 'undefined', name: 'Undefined Behaviour', kind: 'desynergy',
    ids: ['nimbo', 'nullptr'],
    text: 'An anomaly and a null dereference, sharing a holster. Nobody is comfortable.',
    detail: 'Nimbo orbs sometimes cease to exist. Null Pointer -30% fire rate.',
    mods: { nullptr: { fireRate: 0.7 } },
    flags: { nimbo: ['vanishing'] },
  },
  {
    id: 'sizediscourse', name: 'Size Discourse', kind: 'desynergy',
    ids: ['bigknife', 'tinyknife'],
    text: 'They have been arguing since the moment you picked up the second one.',
    detail: 'Both -22% damage. The argument is audible. It is not going well.',
    mods: { bigknife: { damage: 0.78 }, tinyknife: { damage: 0.78 } },
    flags: { bigknife: ['bickering'], tinyknife: ['bickering'] },
  },
  {
    id: 'closetalker', name: 'Close Talker', kind: 'desynergy',
    ids: ['grappler', 'roombroom'],
    text: 'One tool drags you into range. The other only works in range. This should work.',
    detail: 'It does not. Both -20% damage, grapple reloads 60% slower.',
    mods: { grappler: { damage: 0.8, reload: 1.6 }, roombroom: { damage: 0.8 } },
  },
  {
    id: 'safetybriefing', name: 'Mandatory Safety Briefing', kind: 'desynergy',
    ids: ['compliance', 'behemoth'],
    text: 'The Officer has reviewed the Behemoth against nine hundred regulations.',
    detail: 'Behemoth -30% damage pending review. Officer +20% damage, thrilled.',
    mods: { behemoth: { damage: 0.7 }, compliance: { damage: 1.2 } },
  },
];

const MULT_KEYS = new Set([
  'damage', 'fireRate', 'reload', 'spread', 'knockback', 'moveMul', 'range',
  'critChance', 'critMult', 'pellets', 'speed', 'magSize',
]);

function otherOf(pair, w) { return pair[0] === w ? pair[1] : pair[0]; }

function ruleMatches(rule, a, b) {
  if (rule.ids) {
    const ok = (rule.ids[0] === a.id && rule.ids[1] === b.id) || (rule.ids[0] === b.id && rule.ids[1] === a.id);
    if (!ok) return false;
  } else if (rule.id1) {
    const anchor = a.id === rule.id1 ? a : b.id === rule.id1 ? b : null;
    if (!anchor) return false;
    const partner = anchor === a ? b : a;
    if (rule.tag && !partner.tags.includes(rule.tag)) return false;
    if (rule.family) {
      const fam = FAMILIES[rule.family];
      if (fam && !fam.includes(partner.id)) return false;
    }
    if (!rule.tag && !rule.family) return false;
  } else {
    return false;
  }
  if (rule.requires && !rule.requires(a, b)) return false;
  return true;
}

/**
 * Evaluate the loadout. Returns { active: [rule...], mods: Map<weaponId, statMods>,
 * flags: Map<weaponId, Set<trait>>, params: Map<weaponId, obj>, playerMods }.
 */
export function evaluatePairing(a, b) {
  const result = {
    active: [],
    mods: new Map(),
    flags: new Map(),
    params: new Map(),
    playerMods: {},
  };
  if (!a || !b) return result;

  const getMods = (id) => {
    if (!result.mods.has(id)) result.mods.set(id, {});
    return result.mods.get(id);
  };
  const getFlags = (id) => {
    if (!result.flags.has(id)) result.flags.set(id, new Set());
    return result.flags.get(id);
  };
  const getParams = (id) => {
    if (!result.params.has(id)) result.params.set(id, {});
    return result.params.get(id);
  };

  for (const rule of SYNERGIES) {
    if (!ruleMatches(rule, a, b)) continue;
    result.active.push(rule);

    // Resolve the 'other' alias relative to the rule's anchor weapon.
    const anchorId = rule.id1 || null;
    const resolve = (key) => {
      if (key === 'other') {
        if (!anchorId) return null;
        return a.id === anchorId ? b.id : a.id;
      }
      if (key === 'self') return anchorId;
      return key;
    };

    for (const [key, stats] of Object.entries(rule.mods || {})) {
      const target = resolve(key);
      if (!target) continue;
      const m = getMods(target);
      for (const [k, v] of Object.entries(stats)) {
        if (MULT_KEYS.has(k)) m[k] = (m[k] ?? 1) * v;
        else m[k] = (m[k] ?? 1) * v; // param multipliers behave the same way
      }
    }
    for (const [key, traits] of Object.entries(rule.flags || {})) {
      const target = resolve(key);
      if (!target) continue;
      const f = getFlags(target);
      for (const t of traits) f.add(t);
    }
    for (const [key, traits] of Object.entries(rule.remove || {})) {
      const target = resolve(key);
      if (!target) continue;
      const f = getFlags(target);
      for (const t of traits) f.add(`-${t}`);
    }
    for (const [key, obj] of Object.entries(rule.grantParams || {})) {
      const target = resolve(key);
      if (!target) continue;
      Object.assign(getParams(target), obj);
    }
    for (const [k, v] of Object.entries(rule.playerMods || {})) {
      result.playerMods[k] = (result.playerMods[k] ?? 1) * v;
    }
  }
  return result;
}

/**
 * Effective stats for a weapon under the current pairing. Cached by the caller —
 * this is called on every shot.
 */
export function effective(weapon, pairing) {
  const mods = pairing?.mods.get(weapon.id);
  const flags = pairing?.flags.get(weapon.id);
  const extraParams = pairing?.params.get(weapon.id);

  const out = {
    headMult: weapon.headMult ?? 2.5,
    damage: weapon.damage,
    fireRate: weapon.fireRate,
    reload: weapon.reload,
    spread: weapon.spread,
    pellets: weapon.pellets,
    speed: weapon.speed,
    range: weapon.range,
    magSize: weapon.magSize,
    knockback: weapon.knockback,
    critChance: weapon.critChance,
    critMult: weapon.critMult,
    moveMul: weapon.moveMul,
    recoil: weapon.recoil,
    traits: new Set(weapon.traits),
    params: { ...weapon.params, ...(extraParams || {}) },
  };

  if (mods) {
    for (const [k, v] of Object.entries(mods)) {
      if (k in out && typeof out[k] === 'number') out[k] *= v;
      else if (k in out.params) out.params[k] *= v;
      else if (k === 'headMult') out.headMult *= v;
    }
    out.pellets = Math.max(1, Math.round(out.pellets));
    out.magSize = Math.max(1, Math.round(out.magSize));
  }
  if (flags) {
    for (const t of flags) {
      if (t.startsWith('-')) out.traits.delete(t.slice(1));
      else out.traits.add(t);
    }
  }
  return out;
}

export function pairingSummary(pairing) {
  return pairing.active.map((r) => ({
    id: r.id, name: r.name, kind: r.kind, text: r.text, detail: r.detail,
  }));
}
