// Enemy archetypes. `build` describes the body so the mesh factory can assemble
// one from primitives; `ai` picks the behaviour routine in enemy.js.

export const ENEMY_TYPES = {

  shambler: {
    id: 'shambler', name: 'Shambler', ai: 'melee', family: 'undead',
    hp: 60, speed: 2.3, damage: 14, attackRange: 1.9, attackCd: 1.1, radius: 0.48, height: 1.75,
    shards: 12, hitSound: 'flesh',
    build: { body: 0x4a6b4e, head: 0x86a17a, shape: 'humanoid', eye: 0xd9ff4a, slouch: 0.22 },
    desc: 'Was a person. Is now mostly a direction.',
  },

  sprinter: {
    id: 'sprinter', name: 'Sprinter', ai: 'melee', family: 'undead',
    hp: 42, speed: 5.6, damage: 11, attackRange: 1.8, attackCd: 0.7, radius: 0.4, height: 1.6,
    shards: 16, hitSound: 'flesh',
    build: { body: 0x7a3b3b, head: 0xc26a5a, shape: 'humanoid', eye: 0xff5a3c, slouch: 0.5, lean: 0.35 },
    desc: 'Faster than it has any business being.',
  },

  bloater: {
    id: 'bloater', name: 'Bloater', ai: 'exploder', family: 'undead',
    hp: 110, speed: 2.0, damage: 46, attackRange: 2.6, attackCd: 2, radius: 0.72, height: 1.7,
    shards: 24, hitSound: 'flesh',
    explodeRadius: 4.6, explodeDamage: 46, fuse: 0.7,
    build: { body: 0x6b7a3a, head: 0x9aa855, shape: 'blob', eye: 0xbfff2a, bulge: 1.5 },
    desc: 'Full of something. Wants to share.',
  },

  android: {
    id: 'android', name: 'Service Android', ai: 'ranged', family: 'machine',
    hp: 80, speed: 2.6, damage: 12, attackRange: 22, attackCd: 1.5, radius: 0.45, height: 1.8,
    shards: 18, hitSound: 'metal',
    projectile: { speed: 26, color: 0x64d2ff, size: 0.16, count: 1, spread: 0.03 },
    build: { body: 0x8d99a6, head: 0xdfe7ee, shape: 'humanoid', eye: 0x64d2ff, chrome: true },
    desc: 'Politely attempting to end you.',
  },

  enforcer: {
    id: 'enforcer', name: 'Enforcer Unit', ai: 'ranged', family: 'machine',
    hp: 160, speed: 2.2, damage: 9, attackRange: 26, attackCd: 2.1, radius: 0.55, height: 2.0,
    shards: 30, hitSound: 'metal', armor: 0.25,
    projectile: { speed: 30, color: 0xff9a3c, size: 0.15, count: 4, spread: 0.09, burstDelay: 0.09 },
    build: { body: 0x59616b, head: 0x2f3540, shape: 'humanoid', eye: 0xff9a3c, chrome: true, bulk: 1.3 },
    desc: 'Compliance is not optional. It is scheduled.',
  },

  drone: {
    id: 'drone', name: 'Watcher Drone', ai: 'hover', family: 'machine',
    hp: 45, speed: 4.2, damage: 8, attackRange: 18, attackCd: 1.2, radius: 0.4, height: 0.8,
    shards: 14, hitSound: 'metal', flying: true, hoverHeight: 2.2,
    projectile: { speed: 22, color: 0xff5ad0, size: 0.13, count: 1, spread: 0.02 },
    build: { body: 0x3f4756, head: 0xff5ad0, shape: 'drone', eye: 0xff5ad0 },
    desc: 'It has been recording this whole time.',
  },

  leaper: {
    id: 'leaper', name: 'Leaper', ai: 'leaper', family: 'creature',
    hp: 55, speed: 4.0, damage: 20, attackRange: 2.2, attackCd: 1.4, radius: 0.42, height: 1.1,
    shards: 20, hitSound: 'flesh', leapRange: 10, leapSpeed: 15, leapCd: 3,
    build: { body: 0x6b3f7a, head: 0xa15fc4, shape: 'quad', eye: 0xffe14a },
    desc: 'Covers ten metres without meaningfully touching any of them.',
  },

  spitter: {
    id: 'spitter', name: 'Spitter', ai: 'ranged', family: 'creature',
    hp: 65, speed: 2.4, damage: 15, attackRange: 20, attackCd: 2.0, radius: 0.5, height: 1.5,
    shards: 20, hitSound: 'flesh',
    projectile: { speed: 15, color: 0x9dff4a, size: 0.24, count: 1, spread: 0.02, arc: true, puddle: true },
    build: { body: 0x4b6b2e, head: 0x9dff4a, shape: 'blob', eye: 0x203010, bulge: 1.2 },
    desc: 'Leaves puddles. The puddles are also a problem.',
  },

  husk: {
    id: 'husk', name: 'Alpha Husk', ai: 'melee', family: 'tester',
    hp: 130, speed: 3.1, damage: 22, attackRange: 2.1, attackCd: 1.0, radius: 0.5, height: 1.8,
    shards: 34, hitSound: 'flesh',
    build: { body: 0x2f3d4a, head: 0xb8c6d4, shape: 'humanoid', eye: 0xffffff, ghost: 0.55 },
    desc: 'It still has a session badge. The name has worn off.',
  },

  glitchling: {
    id: 'glitchling', name: 'Glitchling', ai: 'blink', family: 'anomaly',
    hp: 70, speed: 3.4, damage: 18, attackRange: 2.0, attackCd: 0.9, radius: 0.44, height: 1.5,
    shards: 26, hitSound: 'metal', blinkCd: 2.6, blinkRange: 9,
    build: { body: 0xff2ea6, head: 0x2effe0, shape: 'humanoid', eye: 0xffffff, glitch: true },
    desc: 'A rendering error that developed goals.',
  },

  sentry: {
    id: 'sentry', name: 'Wall Sentry', ai: 'turret', family: 'machine',
    hp: 90, speed: 0, damage: 10, attackRange: 28, attackCd: 0.5, radius: 0.5, height: 1.2,
    shards: 22, hitSound: 'metal', static: true,
    projectile: { speed: 34, color: 0xff4444, size: 0.12, count: 1, spread: 0.015 },
    build: { body: 0x4a4a52, head: 0xff4444, shape: 'turret', eye: 0xff4444 },
    desc: 'Bolted down. Extremely attentive.',
  },

  brute: {
    id: 'brute', name: 'Brute', ai: 'charger', family: 'creature',
    hp: 280, speed: 2.4, damage: 34, attackRange: 2.8, attackCd: 1.6, radius: 0.85, height: 2.4,
    shards: 55, hitSound: 'flesh', armor: 0.15, chargeSpeed: 12, chargeCd: 5, chargeRange: 18,
    build: { body: 0x8a4a2e, head: 0xc4763f, shape: 'humanoid', eye: 0xff3a1a, bulk: 1.8 },
    desc: 'Builds up speed and does not budget for stopping.',
  },

  fishling: {
    id: 'fishling', name: 'Fishling', ai: 'melee', family: 'creature',
    hp: 48, speed: 4.4, damage: 12, attackRange: 1.8, attackCd: 0.8, radius: 0.38, height: 1.2,
    shards: 15, hitSound: 'flesh',
    build: { body: 0x2e7a8a, head: 0x5fd4e8, shape: 'quad', eye: 0xffe14a, fin: true },
    desc: 'It is out of water and blames you specifically.',
  },

  neonpunk: {
    id: 'neonpunk', name: 'Strip Raider', ai: 'ranged', family: 'raider',
    hp: 95, speed: 3.6, damage: 13, attackRange: 20, attackCd: 1.3, radius: 0.45, height: 1.8,
    shards: 24, hitSound: 'flesh', strafes: true,
    projectile: { speed: 28, color: 0xffe14a, size: 0.14, count: 2, spread: 0.06, burstDelay: 0.1 },
    build: { body: 0x2a1f3d, head: 0xe8a0d0, shape: 'humanoid', eye: 0xffe14a, neon: 0xff2ea6 },
    desc: 'Dressed for a night out that ended several years ago.',
  },

  ashwalker: {
    id: 'ashwalker', name: 'Ashwalker', ai: 'melee', family: 'creature',
    hp: 100, speed: 3.0, damage: 18, attackRange: 2.0, attackCd: 1.0, radius: 0.48, height: 1.8,
    shards: 26, hitSound: 'flesh', burnAura: 6,
    build: { body: 0x3a1f18, head: 0xff6a2a, shape: 'humanoid', eye: 0xffcc3a, ember: true },
    desc: 'Runs hot. Standing near it is a decision.',
  },

  xenoling: {
    id: 'xenoling', name: 'Xenoling', ai: 'leaper', family: 'alien',
    hp: 85, speed: 4.2, damage: 16, attackRange: 2.2, attackCd: 1.0, radius: 0.44, height: 1.6,
    shards: 28, hitSound: 'flesh', leapRange: 11, leapSpeed: 16, leapCd: 2.6,
    build: { body: 0x5a3d8a, head: 0x2effe0, shape: 'humanoid', eye: 0xd9ff4a, slouch: 0.3 },
    desc: 'Came with the twins. Did not come with a visa.',
  },

  gellump: {
    id: 'gellump', name: 'Gellump', ai: 'melee', family: 'gelatin',
    hp: 120, speed: 2.8, damage: 20, attackRange: 2.1, attackCd: 1.0, radius: 0.6, height: 1.6,
    shards: 30, hitSound: 'flesh', splitOnDeath: 2,
    build: { body: 0xd45a7a, head: 0xff8ad0, shape: 'blob', eye: 0xffe8f0, bulge: 1.35, ghost: 0.82 },
    desc: 'A finger that got ambitious.',
  },

  mirrorself: {
    id: 'mirrorself', name: 'Reflection', ai: 'mirror', family: 'anomaly',
    hp: 120, speed: 4.0, damage: 16, attackRange: 24, attackCd: 1.1, radius: 0.45, height: 1.8,
    shards: 40, hitSound: 'metal',
    projectile: { speed: 30, color: 0xffffff, size: 0.14, count: 1, spread: 0.02 },
    build: { body: 0xc9d4e0, head: 0xeef4fa, shape: 'humanoid', eye: 0x000000, chrome: true },
    desc: 'It has your loadout. It does not have your judgement.',
  },
};

export const ENEMY_IDS = Object.keys(ENEMY_TYPES);
