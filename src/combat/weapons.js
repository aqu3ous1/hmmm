// Weapon definitions.
//
// Behaviour that is genuinely one-of-a-kind lives in `traits` (strings the
// combat runtime switches on) plus numeric params, rather than closures — it
// keeps the data readable and means the synergy layer can inspect and rewrite
// a weapon's stats without fighting captured scope.
//
// Stat conventions:
//   damage        per bullet / per pellet / per swing
//   fireRate      attacks per second
//   spread        radians of cone half-angle at the muzzle
//   speed         projectile metres/second (0 = hitscan)
//   reload        seconds
//   rarity        0 common, 1 uncommon, 2 rare, 3 legendary

export const RARITY_NAMES = ['STANDARD', 'CALIBRATED', 'ANOMALOUS', 'CLASSIFIED'];
export const RARITY_COLORS = [0x9fb4c7, 0x63d78b, 0x59a5ff, 0xffb43d];

/** Shared defaults so each entry only states what makes it interesting. */
const BASE = {
  kind: 'gun',
  rarity: 0,
  damage: 10,
  fireRate: 5,
  magSize: 20,
  reserve: 200,
  reload: 1.4,
  spread: 0.02,
  pellets: 1,
  speed: 0,
  range: 60,
  auto: true,
  critChance: 0.05,
  critMult: 2,
  recoil: 0.6,
  knockback: 2,
  moveMul: 1,
  traits: [],
  params: {},
  tags: ['ballistic'],
  sound: { body: 900, punch: 0.5, tail: 0.14, pitch: 220, tone: 'square', volume: 0.5 },
};

function W(def) { return { ...BASE, ...def, params: { ...BASE.params, ...(def.params || {}) }, sound: { ...BASE.sound, ...(def.sound || {}) } }; }

export const WEAPONS = {

  // ---- Fists ------------------------------------------------------------
  knuckles: W({
    id: 'knuckles', name: 'Knuckles', kind: 'melee', rarity: 0,
    damage: 26, fireRate: 3.2, magSize: Infinity, reserve: Infinity, reload: 0,
    range: 2.6, auto: true, critChance: 0.2, critMult: 3, knockback: 7, recoil: 0.25,
    moveMul: 1.18, tags: ['melee', 'fist'],
    traits: ['nostalgia'],
    desc: 'Your hands. Free, fast, and honest.',
    flavor: 'Standard-issue. Everyone starts here. Some people finish here too.',
    tip: 'Moving 18% faster with nothing in your hands.',
    sound: { body: 500, punch: 0.3, tail: 0.1, pitch: 150, volume: 0.35 },
  }),

  // ---- Bread and butter -------------------------------------------------
  ak47: W({
    id: 'ak47', name: 'AK-47', rarity: 1,
    damage: 17, fireRate: 9.2, magSize: 30, reserve: 300, reload: 1.9,
    spread: 0.032, recoil: 0.9, knockback: 2.4, critChance: 0.08,
    desc: 'Thirty rounds of nothing clever.',
    flavor: 'Dr. Kimvatch modelled it from memory. He got it right.',
    tip: 'The baseline every other gun is quietly measured against.',
    sound: { body: 1100, punch: 0.8, tail: 0.16, pitch: 240, volume: 0.6 },
  }),

  deagle: W({
    id: 'deagle', name: 'Desert Eagle', rarity: 2,
    damage: 74, fireRate: 2.6, magSize: 7, reserve: 84, reload: 1.7,
    spread: 0.012, recoil: 2.6, knockback: 9, critChance: 0.16, critMult: 2.6, auto: false,
    desc: 'Seven chances to be extremely correct.',
    flavor: 'The recoil is simulated with what Kimvatch calls "malicious accuracy".',
    tip: 'Headshots pay double. Missing costs a full second of your life.',
    sound: { body: 1500, punch: 1.4, tail: 0.26, pitch: 190, tone: 'sawtooth', volume: 0.85 },
  }),

  roombroom: W({
    id: 'roombroom', name: 'Room Broom', rarity: 1,
    damage: 13, fireRate: 1.5, magSize: 6, reserve: 72, reload: 2.4,
    spread: 0.11, pellets: 9, range: 22, recoil: 2.2, knockback: 11, auto: false,
    tags: ['ballistic', 'shotgun'],
    desc: 'Nine pellets. One opinion.',
    flavor: 'Sweeps a corridor in the way a broom absolutely does not.',
    tip: 'Damage falls off past 10m. Get uncomfortably close.',
    sound: { body: 700, punch: 1.2, tail: 0.3, pitch: 120, tone: 'sawtooth', volume: 0.8 },
  }),

  // ---- The knives -------------------------------------------------------
  bigknife: W({
    id: 'bigknife', name: 'Staggeringly Large Knife', kind: 'melee', rarity: 2,
    damage: 105, fireRate: 1.05, magSize: Infinity, reserve: Infinity, reload: 0,
    range: 4.6, critChance: 0.12, critMult: 2.5, knockback: 16, recoil: 1.4,
    moveMul: 0.88, tags: ['melee', 'blade', 'large'],
    traits: ['cleave'], params: { cleaveArc: 2.4 },
    desc: 'A knife by category only.',
    flavor: '"It is legally a knife," the manifest insists, twice, unprompted.',
    tip: 'Cleaves everything in a wide arc. Swings like a wet door.',
    sound: { body: 400, punch: 0.6, tail: 0.3, pitch: 110, tone: 'sawtooth', volume: 0.6 },
  }),

  tinyknife: W({
    id: 'tinyknife', name: 'Staggeringly Tiny Knife', kind: 'melee', rarity: 2,
    damage: 21, fireRate: 9.5, magSize: Infinity, reserve: Infinity, reload: 0,
    range: 1.9, critChance: 0.34, critMult: 3.4, knockback: 1, recoil: 0.12,
    moveMul: 1.25, tags: ['melee', 'blade', 'tiny'],
    traits: ['backstab'], params: { backstabMult: 4 },
    desc: 'You could lose it in a pocket. Enemies keep losing it in themselves.',
    flavor: 'Ships in a container 900 times its volume. Nobody has explained this.',
    tip: 'Hits behind an enemy deal quadruple damage.',
    sound: { body: 2200, punch: 0.3, tail: 0.06, pitch: 800, volume: 0.35 },
  }),

  sanguine: W({
    id: 'sanguine', name: 'Sanguine Ledger', kind: 'melee', rarity: 2,
    damage: 62, fireRate: 1.9, magSize: Infinity, reserve: Infinity, reload: 0,
    range: 3.4, critChance: 0.1, critMult: 2.2, knockback: 7, recoil: 0.9,
    tags: ['melee', 'blade', 'blood'],
    traits: ['lifesteal', 'debt'], params: { lifesteal: 0.42, debtRate: 0.35, debtCap: 45 },
    desc: 'Takes their health. Writes it down. Collects later.',
    flavor: 'Every drop it gives you is a loan. The Ledger has never forgiven one.',
    tip: 'Heals 42% of damage dealt — then slowly reclaims a portion as debt.',
    sound: { body: 620, punch: 0.5, tail: 0.28, pitch: 160, tone: 'triangle', volume: 0.55 },
  }),

  mop: W({
    id: 'mop', name: "Custodian's Mop", kind: 'melee', rarity: 1,
    damage: 44, fireRate: 2.4, magSize: Infinity, reserve: Infinity, reload: 0,
    range: 3.8, critChance: 0.08, knockback: 9, recoil: 0.5, moveMul: 1.05,
    tags: ['melee', 'blunt'],
    traits: ['slick'], params: { slickRadius: 3.2, slickTime: 5 },
    desc: 'Leaves the floor wet, and the enemies on it.',
    flavor: 'Someone kept this place clean for a very long time. Nobody thanked them.',
    tip: 'Kills leave a slick patch that slows anything walking through it.',
    sound: { body: 500, punch: 0.4, tail: 0.22, pitch: 130, volume: 0.5 },
  }),

  // ---- The oddities -----------------------------------------------------
  nimbo: W({
    id: 'nimbo', name: 'Nimbo Jumbus', rarity: 2,
    damage: 34, fireRate: 1.6, magSize: 8, reserve: 64, reload: 2.6,
    speed: 15, spread: 0.01, range: 55, knockback: 3, auto: false,
    tags: ['energy', 'anomaly'],
    traits: ['jumbify'], params: { jumbifyTime: 4, burstDamage: 70, burstRadius: 4.4 },
    desc: 'A ray gun that does not kill things so much as editorialise about them.',
    flavor: 'The manual is one page. It reads: "JUMBUS. (do not aim at self)".',
    tip: 'Hit enemies become slow, harmless jumbos — then pop for area damage.',
    sound: { body: 2600, punch: 0.4, tail: 0.34, pitch: 900, tone: 'sine', volume: 0.55 },
  }),

  sandwich: W({
    id: 'sandwich', name: 'Sandwich Machine', rarity: 1,
    damage: 24, fireRate: 3.4, magSize: 12, reserve: 96, reload: 2.1,
    speed: 26, spread: 0.05, range: 40, knockback: 5,
    tags: ['food'],
    traits: ['sandwich'], params: { healAmount: 12, distractTime: 3.2, dropChance: 0.5 },
    desc: 'Fires sandwiches. Load-bearing sandwiches.',
    flavor: 'Cafeteria hardware. Repurposed by an alpha tester who was, quote, "starving".',
    tip: 'Missed shots become pickups that heal you. Enemies stop to eat them.',
    sound: { body: 800, punch: 0.3, tail: 0.12, pitch: 340, tone: 'triangle', volume: 0.45 },
  }),

  grappler: W({
    id: 'grappler', name: 'The Grappler', rarity: 2,
    damage: 30, fireRate: 1.1, magSize: 4, reserve: 40, reload: 2.0,
    speed: 55, spread: 0, range: 34, knockback: 0, auto: false, moveMul: 1.08,
    tags: ['utility'],
    traits: ['grapple'], params: { pullSpeed: 26, markTime: 4 },
    desc: 'Pulls small things to you and you to big things.',
    flavor: 'Rated for 400kg. Michael Sandlor is not 400kg. Most bosses are.',
    tip: 'Light enemies get yanked in. Walls yank you. Grappled targets are MARKED.',
    sound: { body: 900, punch: 0.6, tail: 0.2, pitch: 260, volume: 0.5 },
  }),

  harpoon: W({
    id: 'harpoon', name: 'Reel Talk', rarity: 2,
    damage: 88, fireRate: 1.0, magSize: 3, reserve: 30, reload: 2.2,
    speed: 48, spread: 0, range: 45, knockback: 4, auto: false, critChance: 0.1,
    tags: ['ballistic', 'aquatic'],
    traits: ['harpoon', 'pierce'], params: { pierce: 3, tetherDamage: 14, tetherTime: 4 },
    desc: 'Harpoon gun. Everything it touches stays on the line.',
    flavor: 'Recovered from the Aquatics Lab. Still slightly damp. It should not be.',
    tip: 'Punches through up to 3 enemies and bleeds each of them out.',
    sound: { body: 1000, punch: 0.9, tail: 0.22, pitch: 200, volume: 0.65 },
  }),

  zapper: W({
    id: 'zapper', name: 'Bug Zapper Mk. Eleven', rarity: 2,
    damage: 26, fireRate: 3.6, magSize: 24, reserve: 240, reload: 2.0,
    spread: 0.02, range: 40, knockback: 1,
    tags: ['energy'],
    traits: ['chain'], params: { chainTargets: 3, chainRange: 7, chainFalloff: 0.72 },
    desc: 'Electricity has never respected personal space.',
    flavor: 'Marks I through X are unaccounted for. Nobody asks about Mark VII.',
    tip: 'Every hit arcs to 3 more enemies nearby.',
    sound: { body: 3200, punch: 0.5, tail: 0.12, pitch: 620, tone: 'sawtooth', volume: 0.5 },
  }),

  sawblade: W({
    id: 'sawblade', name: 'Circular Reasoning', rarity: 2,
    damage: 32, fireRate: 2.6, magSize: 10, reserve: 90, reload: 2.3,
    speed: 32, spread: 0.02, range: 70, knockback: 4,
    tags: ['ballistic'],
    traits: ['ricochet'], params: { bounces: 4, bounceGain: 1.18 },
    desc: 'Sawblades that come back around to the point.',
    flavor: 'It bounces off walls and, given time, off its own conclusions.',
    tip: 'Ricochets up to 4 times, gaining damage with each wall it argues with.',
    sound: { body: 1400, punch: 0.5, tail: 0.18, pitch: 420, tone: 'sawtooth', volume: 0.55 },
  }),

  actuary: W({
    id: 'actuary', name: 'The Actuary', rarity: 3,
    damage: 150, fireRate: 0.9, magSize: 5, reserve: 40, reload: 2.4,
    spread: 0, range: 120, recoil: 2.2, knockback: 12, auto: false,
    critChance: 0.25, critMult: 2.4,
    tags: ['energy', 'precision'],
    traits: ['charge', 'pierce'], params: { chargeTime: 0.85, chargeMult: 2.6, pierce: 99 },
    desc: 'Calculates the exact amount of damage required, then adds a margin.',
    flavor: 'It does not fire until it is certain. It is always certain eventually.',
    tip: 'Hold fire to charge for 2.6x damage. Fully charged shots pierce everything.',
    sound: { body: 2000, punch: 1.3, tail: 0.4, pitch: 300, tone: 'sine', volume: 0.8 },
  }),

  // ---- The jokes that bite ---------------------------------------------
  fake47: W({
    id: 'fake47', name: 'FAKe-47', rarity: 0,
    damage: 3, fireRate: 5.5, magSize: 30, reserve: 300, reload: 3.2,
    spread: 0.18, recoil: 1.4, knockback: 0.4, critChance: 0,
    tags: ['ballistic', 'meme'],
    traits: ['jam'], params: { jamChance: 0.14, jamTime: 1.1 },
    desc: 'It looks exactly like an AK-47 until the moment it matters.',
    flavor: 'The serial number is a drawing of a serial number.',
    tip: 'Jams constantly. Fires sideways. There is, allegedly, a way to fix it.',
    sound: { body: 600, punch: 0.2, tail: 0.1, pitch: 170, tone: 'triangle', volume: 0.35 },
  }),

  intern: W({
    id: 'intern', name: 'The Intern', rarity: 1,
    damage: 9, fireRate: 4, magSize: 45, reserve: 400, reload: 1.6,
    spread: 0.05, knockback: 0.8,
    tags: ['ballistic', 'office'],
    traits: ['ramp'], params: { rampMax: 3.4, rampRate: 0.055, rampDecay: 1.3 },
    desc: 'Fires paperclips. Gets better the longer you let it talk.',
    flavor: 'Unpaid. Enthusiastic. Has ideas about the Pod it would love to share.',
    tip: 'Sustained fire ramps up to 3.4x fire rate. Stopping resets the confidence.',
    sound: { body: 1600, punch: 0.25, tail: 0.07, pitch: 500, volume: 0.35 },
  }),

  compliance: W({
    id: 'compliance', name: 'Compliance Officer', rarity: 2,
    damage: 20, fireRate: 2.0, magSize: 8, reserve: 80, reload: 2.0,
    spread: 0.03, knockback: 6, auto: false,
    tags: ['ballistic', 'office'],
    traits: ['shardScaling'], params: { shardsPerPoint: 40, shardCap: 90 },
    desc: 'Issues fines. The fine is the damage.',
    flavor: 'It does not shoot people. It finds them in violation, and they comply.',
    tip: 'Damage scales with your unspent Shards. Spending money weakens it.',
    sound: { body: 1100, punch: 0.7, tail: 0.2, pitch: 280, volume: 0.6 },
  }),

  nullptr: W({
    id: 'nullptr', name: 'Null Pointer', rarity: 2,
    damage: 38, fireRate: 3.2, magSize: 13, reserve: 130, reload: 1.8,
    spread: 0.02, knockback: 2,
    tags: ['energy', 'glitch'],
    traits: ['nullpointer'], params: { missChance: 0.22, deleteChance: 0.055 },
    desc: 'Sometimes it points at nothing. Sometimes nothing is what it leaves.',
    flavor: 'Kimvatch flagged this one for removal in build 0.9. It removed the flag.',
    tip: '22% of shots dereference nothing. 5.5% delete the target outright.',
    sound: { body: 1800, punch: 0.6, tail: 0.15, pitch: 380, tone: 'sine', volume: 0.5 },
  }),

  prototype: W({
    id: 'prototype', name: "Kimvatch's Prototype", rarity: 2,
    damage: 30, fireRate: 4.0, magSize: 20, reserve: 200, reload: 2.0,
    spread: 0.04, knockback: 3,
    tags: ['energy', 'anomaly'],
    traits: ['random'],
    desc: 'Every shot is a different gun. He kept meaning to pick one.',
    flavor: 'Found in a drawer labelled TODO. The drawer was also labelled SORRY.',
    tip: 'Randomises its behaviour on every single shot. Chaos, statistically fair.',
    sound: { body: 1300, punch: 0.6, tail: 0.16, pitch: 300, volume: 0.55 },
  }),

  // ---- The evolving line ------------------------------------------------
  babygun: W({
    id: 'babygun', name: "Baby's First Gun", rarity: 1,
    damage: 7, fireRate: 4.6, magSize: 12, reserve: 999, reload: 1.2,
    spread: 0.07, speed: 34, knockback: 1, critChance: 0.03,
    tags: ['ballistic', 'evolving'],
    traits: ['evolve'], params: { stage: 0 },
    desc: 'Foam darts. It is trying so hard.',
    flavor: 'Every legend was, at some point, embarrassing.',
    tip: 'Grows into something else entirely. Kills are how it learns.',
    sound: { body: 700, punch: 0.2, tail: 0.09, pitch: 420, tone: 'triangle', volume: 0.3 },
  }),

  behemoth: W({
    id: 'behemoth', name: 'The Behemoth', rarity: 3,
    damage: 46, fireRate: 13, magSize: 150, reserve: 450, reload: 4.2,
    spread: 0.05, recoil: 0.7, knockback: 6, critChance: 0.1, moveMul: 0.76,
    tags: ['ballistic', 'heavy'],
    traits: ['spinup', 'explosive'], params: { spinupTime: 0.75, splashRadius: 1.8, splashDamage: 14 },
    desc: 'The best gun in the Pod. Everything else is a compromise.',
    flavor: 'Kimvatch built it to prove he could, then hid it so nobody would.',
    tip: 'Spins up, then never stops. Rounds detonate on impact.',
    sound: { body: 1200, punch: 1.1, tail: 0.14, pitch: 150, tone: 'sawtooth', volume: 0.75 },
  }),
};

/** Baby's First Gun evolution ladder — each stage replaces the display stats. */
export const BABY_STAGES = [
  {
    name: "Baby's First Gun", killsToNext: 14, damage: 7, fireRate: 4.6, magSize: 12,
    spread: 0.07, color: 0xffd6e7, desc: 'Foam darts. It is trying so hard.',
    line: 'It makes a small, encouraging noise when you hit something.',
  },
  {
    name: "Toddler's Trusty Blaster", killsToNext: 34, damage: 13, fireRate: 5.4, magSize: 16,
    spread: 0.055, color: 0xffc266, desc: 'Now with a trigger guard and opinions.',
    line: 'The gun has learned the word "again". It uses it constantly.',
  },
  {
    name: 'Teen Angst Cannon', killsToNext: 68, damage: 24, fireRate: 6.8, magSize: 22,
    spread: 0.05, color: 0x8f6bd8, desc: 'Loud, unfocused, occasionally devastating.',
    line: 'It fires slightly harder when you are not looking at it.',
  },
  {
    name: "Working Adult's Sidearm", killsToNext: 120, damage: 40, fireRate: 5.2, magSize: 15,
    spread: 0.022, color: 0x6f8ba3, desc: 'Reliable. Punctual. Quietly exhausted.',
    line: 'The gun does not complain. The gun has a mortgage.',
  },
  {
    name: 'Midlife Crisis Magnum', killsToNext: 200, damage: 72, fireRate: 3.0, magSize: 8,
    spread: 0.015, color: 0xe03d3d, desc: 'Chrome. Enormous. Bought impulsively.',
    line: 'It has been polished far more often than it has been fired.',
  },
  {
    name: "Grandpa's Last Gun", killsToNext: Infinity, damage: 132, fireRate: 2.1, magSize: 6,
    spread: 0.006, color: 0xd8c47a, desc: 'It has seen everything you are about to do.',
    line: 'It does not miss. It has stopped finding that impressive.',
  },
];

export function babyStage(weapon) {
  return BABY_STAGES[Math.min(weapon.params.stage | 0, BABY_STAGES.length - 1)];
}

/** Instantiate a runtime copy of a weapon — mutable per-run state lives here. */
export function makeWeapon(id) {
  const def = WEAPONS[id];
  if (!def) throw new Error(`unknown weapon: ${id}`);
  const w = {
    ...def,
    params: { ...def.params },
    tags: def.tags.slice(),
    traits: def.traits.slice(),
    sound: { ...def.sound },
    // runtime state
    ammo: def.magSize,
    reserveAmmo: def.reserve,
    reloading: false,
    reloadEnd: 0,
    nextShot: 0,
    heat: 0,
    ramp: 0,
    spin: 0,
    charge: 0,
    jammedUntil: 0,
    kills: 0,
    shotsFired: 0,
    debt: 0,
  };
  if (id === 'babygun') applyBabyStage(w);
  return w;
}

export function applyBabyStage(w) {
  const s = babyStage(w);
  w.name = s.name;
  w.damage = s.damage;
  w.fireRate = s.fireRate;
  w.magSize = s.magSize;
  w.spread = s.spread;
  w.desc = s.desc;
  w.stageColor = s.color;
  w.rarity = Math.min(3, Math.floor(w.params.stage / 2) + 1);
  w.ammo = Math.min(w.ammo, w.magSize);
}

export const WEAPON_IDS = Object.keys(WEAPONS);

/** Pool a floor can roll from, excluding fists (you always have those). */
export function chestPool() {
  return WEAPON_IDS.filter((id) => id !== 'knuckles');
}
