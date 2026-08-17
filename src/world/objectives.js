// What you actually have to *do* on a floor.
//
// Eleven floors used to share two verbs, and nine of them were the same one:
// walk to a glowing pillar, hold E, survive three waves, repeat. That is a
// single mechanic wearing eleven hats, and by the Kiln you are not solving
// anything — you are waiting.
//
// So each floor now gets its own kind. A kind is:
//
//   setup(g, cfg, rng)      build the props, seed the state
//   update(g, dt)           per-frame logic
//   offer(g, add)           contribute interaction targets
//   force(g)                complete it outright (the smoke test needs this)
//
// Kinds share the small helpers at the bottom — a station mesh, a marker, a
// punishment wave — so a new one is mostly its own rules and nothing else.

import * as THREE from '../../vendor/three.module.js';
import { UNIT, assemble, disposeTree } from './geometry.js';
import { audio } from '../core/audio.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------

const part = (geo, color, o = {}) => ({ geo, color, ...o });
const emit = (geo, color, o = {}) => ({ geo, color, basic: true, ...o });

/**
 * A floor station: a plinth, a housing and a lit core. `shape` changes the
 * housing so a sorting arm, a pump socket and a bus terminal are not the same
 * object with a different label on it.
 */
export function buildStation(color, shape = 'panel') {
  const g = new THREE.Group();
  const base = [
    part(UNIT.lowCyl, 0x2f3540, { y: 0.11, sx: 1.5, sy: 0.22, sz: 1.5, metal: 0.6, rough: 0.5 }),
    part(UNIT.lowCyl, 0x3d4553, { y: 0.24, sx: 1.24, sy: 0.08, sz: 1.24, metal: 0.7, rough: 0.35 }),
    ...[0, 1, 2, 3].map((i) => part(UNIT.hex, 0x59657a, {
      x: Math.cos(i * TAU / 4) * 0.6, y: 0.26, z: Math.sin(i * TAU / 4) * 0.6,
      sx: 0.13, sy: 0.06, sz: 0.13, metal: 0.8, rough: 0.3,
    })),
  ];
  const housing = {
    panel: [
      part(UNIT.bevelBox, 0x3d4553, { y: 0.95, rx: -0.16, sx: 0.8, sy: 1.4, sz: 0.34, metal: 0.55, rough: 0.42 }),
      part(UNIT.slab, 0x14181e, { y: 1.05, z: 0.2, rx: -0.16, sx: 0.62, sy: 0.9, sz: 0.05 }),
      part(UNIT.bevelBox, 0x59657a, { y: 1.72, sx: 0.94, sy: 0.2, sz: 0.46, metal: 0.7, rough: 0.3 }),
    ],
    arm: [
      part(UNIT.lowCyl, 0x3d4553, { y: 1.0, sx: 0.42, sy: 1.6, sz: 0.42, metal: 0.6, rough: 0.4 }),
      part(UNIT.bevelBox, 0x59657a, { y: 1.9, z: 0.34, rx: 0.5, sx: 0.34, sy: 0.9, sz: 0.34, metal: 0.75, rough: 0.3 }),
      part(UNIT.bevelBox, 0x2f3540, { y: 2.32, z: 0.72, sx: 0.5, sy: 0.24, sz: 0.6, metal: 0.5, rough: 0.5 }),
      part(UNIT.torus, 0x59657a, { y: 1.82, rx: Math.PI / 2, sx: 0.62, sy: 0.62, sz: 0.62, metal: 0.8, rough: 0.25 }),
    ],
    valve: [
      part(UNIT.lowCyl, 0x3d4553, { y: 0.8, sx: 0.66, sy: 1.16, sz: 0.66, metal: 0.6, rough: 0.42 }),
      part(UNIT.pipe, 0x59657a, { y: 1.42, sx: 0.8, sy: 0.24, sz: 0.8, metal: 0.8, rough: 0.28 }),
      ...[0, 1, 2, 3, 4, 5].map((i) => part(UNIT.box, 0x8d99a6, {
        y: 1.54, rz: 0, ry: i * TAU / 6, sx: 0.9, sy: 0.07, sz: 0.1, metal: 0.85, rough: 0.25,
      })),
      part(UNIT.lowCyl, 0x2f3540, { y: 1.62, sx: 0.24, sy: 0.14, sz: 0.24, metal: 0.7, rough: 0.35 }),
    ],
    socket: [
      part(UNIT.lowCyl, 0x3d4553, { y: 0.5, sx: 1.0, sy: 0.6, sz: 1.0, metal: 0.6, rough: 0.45 }),
      part(UNIT.pipe, 0x2f3540, { y: 0.95, sx: 0.76, sy: 0.5, sz: 0.76, metal: 0.5, rough: 0.5 }),
      ...[0, 1, 2].map((i) => part(UNIT.box, 0x59657a, {
        y: 1.16, ry: i * TAU / 3, sx: 0.9, sy: 0.1, sz: 0.14, metal: 0.8, rough: 0.3,
      })),
    ],
    bus: [
      part(UNIT.bevelBox, 0x3d4553, { y: 0.85, sx: 1.1, sy: 1.3, sz: 0.4, metal: 0.55, rough: 0.4 }),
      ...[0, 1, 2, 3].map((i) => part(UNIT.slab, 0x14181e, {
        x: -0.36 + (i % 2) * 0.72, y: 0.6 + Math.floor(i / 2) * 0.5, z: 0.22,
        sx: 0.5, sy: 0.34, sz: 0.04,
      })),
      part(UNIT.bevelBox, 0x59657a, { y: 1.58, sx: 1.2, sy: 0.16, sz: 0.5, metal: 0.7, rough: 0.3 }),
    ],
    bloom: [
      part(UNIT.lowCyl, 0x3a4a24, { y: 0.4, sx: 1.1, sy: 0.6, sz: 1.1, rough: 0.85 }),
      part(UNIT.lowCyl, 0x5a7038, { y: 0.9, sx: 0.24, sy: 1.0, sz: 0.24, rough: 0.8 }),
      ...[0, 1, 2, 3, 4].map((i) => part(UNIT.cone, 0x6a8a3a, {
        x: Math.cos(i * TAU / 5) * 0.3, y: 1.5, z: Math.sin(i * TAU / 5) * 0.3,
        rz: Math.cos(i * TAU / 5) * 0.7, rx: -Math.sin(i * TAU / 5) * 0.7,
        sx: 0.4, sy: 0.7, sz: 0.4, rough: 0.75,
      })),
    ],
    sink: [
      part(UNIT.bevelBox, 0x4a3028, { y: 0.9, sx: 1.0, sy: 1.5, sz: 0.6, metal: 0.5, rough: 0.6 }),
      ...Array.from({ length: 7 }, (_, i) => part(UNIT.slab, 0x6a4438, {
        y: 0.4 + i * 0.2, sx: 1.3, sy: 0.1, sz: 0.8, metal: 0.6, rough: 0.5,
      })),
      part(UNIT.pipe, 0x8d939c, { y: 1.9, rx: Math.PI / 2, sx: 0.4, sy: 0.7, sz: 0.4, metal: 0.85, rough: 0.3 }),
    ],
  }[shape] || [];

  g.add(assemble([...base, ...housing]));

  const core = new THREE.Mesh(UNIT.icosa.clone(),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
  core.scale.setScalar(0.9);
  core.position.y = shape === 'arm' ? 2.32 : shape === 'socket' ? 1.0 : 1.15;
  const ring = new THREE.Mesh(UNIT.torus.clone(),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }));
  ring.scale.setScalar(2.0);
  ring.position.y = core.position.y;
  ring.rotation.x = Math.PI / 2;
  g.add(core, ring);
  g.userData.core = core;
  g.userData.ring = ring;
  return g;
}

/** A carryable core: the thing you pick up and take somewhere. */
export function buildCarryCore(color) {
  const g = new THREE.Group();
  g.add(assemble([
    part(UNIT.hex, 0x3d4553, { sx: 0.5, sy: 0.62, sz: 0.5, metal: 0.7, rough: 0.35 }),
    part(UNIT.pipe, 0x8d99a6, { sx: 0.56, sy: 0.3, sz: 0.56, metal: 0.85, rough: 0.25 }),
    part(UNIT.torus, 0x59657a, { y: 0.34, rx: Math.PI / 2, sx: 0.34, sy: 0.34, sz: 0.34, metal: 0.8, rough: 0.3 }),
  ]));
  const glow = new THREE.Mesh(UNIT.lowSphere.clone(),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
  glow.scale.setScalar(0.34);
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

/** A floating symbol, so an ordering puzzle can actually be read. */
const SYMBOL_SHAPES = [UNIT.tetra, UNIT.octa, UNIT.icosa, UNIT.hex, UNIT.cone, UNIT.disc];
export function buildSymbol(index, color) {
  const m = new THREE.Mesh(SYMBOL_SHAPES[index % SYMBOL_SHAPES.length].clone(),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  m.scale.setScalar(0.36);
  return m;
}

// ---------------------------------------------------------------------------
// Helpers used by more than one kind
// ---------------------------------------------------------------------------

function place(g, cfg, rng, count, shape, colour) {
  const level = g.level;
  const rooms = level.rooms.filter((r) => r.type === 'objective');
  const spare = rng.shuffle(level.rooms.filter(
    (r) => r.type !== 'spawn' && r.type !== 'boss' && r.type !== 'objective'));
  const picks = rooms.length >= count ? rooms : rooms.concat(spare);
  const out = [];
  for (let i = 0; i < count; i++) {
    const room = picks[i % picks.length];
    if (!room) break;
    const pos = level.randomPointIn(room, rng, 2.5);
    const group = buildStation(colour ?? cfg.palette.trim, shape);
    group.position.copy(pos);
    g.propGroup.add(group);
    out.push({ group, pos, room, index: i, state: 'idle', charge: 0 });
  }
  return out;
}

/** Spin the core and pulse the ring — every kind wants this. */
function idleAnim(g, s, dt, colour) {
  const core = s.group.userData.core, ring = s.group.userData.ring;
  core.rotation.y += dt * 1.4;
  core.rotation.x += dt * 0.7;
  ring.rotation.z += dt * 0.8;
  ring.scale.setScalar(2.0 + Math.sin(g.now * 2 + s.index) * 0.2);
  if (colour !== undefined) core.material.color.setHex(colour);
}

function completed(g, s) {
  s.state = 'done';
  s.group.userData.core.material.color.setHex(0x4affa0);
  s.group.userData.core.scale.setScalar(0.6);
  s.group.userData.ring.material.color.setHex(0x4affa0);
  g.particles.ring(s.pos.x, 0.1, s.pos.z, { from: 1, to: 10, life: 0.8, color: 0x4affa0 });
  audio.levelUp();
}

function tick(g, label) {
  g.objective.done++;
  g.hud.toast(`${label} ${g.objective.done}/${g.objective.total}`, 'good', 2.2);
  g._checkObjective();
}

/** Throw a handful of enemies at the player as a consequence. */
function punish(g, cfg, n, text) {
  if (text) g.hud.toast(text, 'bad', 2.4);
  audio.bossRoar(1.5);
  for (let i = 0; i < n; i++) {
    if (g.enemies.length >= 28) break;
    const p = g._spawnPointNear(g.player.pos, 9, 26);
    if (p) g._spawnEnemy(g._pickEnemyType(cfg), p);
  }
}

/** Hold-E-to-charge, shared by every kind that wants a commitment. */
function charging(g, dt, list, seconds, onDone) {
  const p = g.player;
  // "Tap to interact" completes the hold outright. Holding a key for a second
  // and a half is a real barrier for some hands, and nothing about this game
  // is more interesting for having required it.
  const tap = g.opts?.tapHold;
  for (const s of list) {
    if (s.state !== 'charging') continue;
    if (tap) { s.charge = 1; onDone(s); continue; }
    const d = Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z);
    if (d < 3.4 && g.input.down('KeyE')) {
      s.charge = Math.min(1, s.charge + dt / seconds);
      if (Math.random() < dt * 18) audio.ui(400 + s.charge * 500);
      if (s.charge >= 1) onDone(s);
    } else {
      s.charge = Math.max(0, s.charge - dt * 1.6);
      if (s.charge <= 0) s.state = 'idle';
    }
  }
}

const near = (g, pos) => Math.hypot(pos.x - g.player.pos.x, pos.z - g.player.pos.z);

// ---------------------------------------------------------------------------
// The kinds
// ---------------------------------------------------------------------------

export const OBJECTIVE_KINDS = {

  /**
   * The original: engage a station, then hold the ground around it for a few
   * waves. Kept for the basement — where it is the tutorial for everything —
   * and for Root, where the last floor should feel like the first.
   */
  nodes: {
    setup(g, cfg, rng) {
      g.stations = place(g, cfg, rng, cfg.objective.count, cfg.objective.shape || 'panel');
      for (const s of g.stations) { s.wave = 0; s.waveEnemies = []; s.spawnedThisWave = 0; }
    },
    update(g, dt) {
      const cfg = g.floorCfg;
      for (const s of g.stations) {
        idleAnim(g, s, dt);
        if (s.state === 'done') { s.group.userData.core.material.color.setHex(0x4affa0); continue; }
        if (s.state === 'charging') {
          s.group.userData.core.material.color.setHex(0xffd24a);
          s.group.userData.core.scale.setScalar(0.9 + s.charge * 0.5);
        }
        if (s.state !== 'defending') continue;
        s.group.userData.core.material.color.setHex(0xff4a5a);
        s.group.userData.core.scale.setScalar(0.9 + Math.sin(g.now * 9) * 0.14);

        if (s.waveEnemies.length === 0 && s.spawnedThisWave >= g._waveSize(cfg)) {
          s.wave++;
          s.spawnedThisWave = 0;
          if (s.wave >= cfg.waveCount) { completed(g, s); tick(g, g.objective.label); continue; }
          g.hud.toast(`WAVE ${s.wave + 1} / ${cfg.waveCount}`, 'bad', 2);
          audio.bossRoar(2);
        }
        if (s.spawnedThisWave < g._waveSize(cfg) && g.enemies.length < 30) {
          s.spawnTimer = (s.spawnTimer || 0) - dt;
          if (s.spawnTimer <= 0) {
            s.spawnTimer = 0.55;
            const p = g._spawnPointNear(s.pos, 8, 34) || g._spawnPointNear(g.player.pos, 10, 40);
            if (p) {
              const e = g._spawnEnemy(g._pickEnemyType(cfg), p);
              if (e) { s.waveEnemies.push(e); s.spawnedThisWave++; }
            }
          }
        }
      }
      charging(g, dt, g.stations, 1.4, (s) => {
        s.state = 'defending';
        s.wave = 0; s.spawnedThisWave = 0; s.waveEnemies = [];
        g.hud.toast(`HOLD — WAVE 1 / ${g.floorCfg.waveCount}`, 'bad', 2.4);
        audio.bossRoar(2);
      });
    },
    offer(g, add) {
      for (const s of g.stations) {
        if (s.state === 'done' || s.state === 'defending') continue;
        add(near(g, s.pos), s.state === 'charging' ? 'Hold to engage…' : `Engage ${g.objective.label.toLowerCase()}`,
          () => { if (s.state === 'idle') { s.state = 'charging'; s.charge = 0; audio.ui(500); } });
      }
    },
    onKill(g, enemy) {
      for (const s of g.stations) {
        const i = s.waveEnemies?.indexOf(enemy) ?? -1;
        if (i >= 0) s.waveEnemies.splice(i, 1);
      }
    },
  },

  /**
   * Sorting Floor. Four arms, each stamped with a symbol; a manifest terminal
   * somewhere else on the floor tells you the order. Get it right and the
   * stair unlocks; get it wrong and the floor notices.
   */
  sequence: {
    setup(g, cfg, rng) {
      const n = cfg.objective.count;
      g.stations = place(g, cfg, rng, n, 'arm');
      const symbols = rng.shuffle(g.stations.map((_, i) => i));
      g.stations.forEach((s, i) => {
        s.symbol = symbols[i];
        const sym = buildSymbol(s.symbol, cfg.palette.emissive);
        sym.position.set(0, 2.9, 0.7);
        s.group.add(sym);
        s.symbolMesh = sym;
      });
      // The correct order, and a manifest that shows it.
      g.seqOrder = rng.shuffle(g.stations.map((s) => s.symbol));
      g.seqAt = 0;
      g.seqKnown = false;
      const room = rng.shuffle(g.level.rooms.filter((r) => r.type !== 'boss'))[0];
      const pos = g.level.randomPointIn(room, rng, 2.5);
      const manifest = buildStation(0xffd24a, 'panel');
      manifest.position.copy(pos);
      g.propGroup.add(manifest);
      g.seqManifest = { group: manifest, pos, room, index: 99, state: 'idle' };
    },
    update(g, dt) {
      for (const s of g.stations) {
        idleAnim(g, s, dt, s.state === 'done' ? 0x4affa0 : (g.seqKnown && g.seqOrder[g.seqAt] === s.symbol ? 0xffd24a : undefined));
        if (s.symbolMesh) {
          s.symbolMesh.rotation.y += dt * 1.1;
          s.symbolMesh.position.y = 2.9 + Math.sin(g.now * 1.6 + s.index) * 0.08;
        }
      }
      idleAnim(g, g.seqManifest, dt, g.seqKnown ? 0x4affa0 : 0xffd24a);
    },
    offer(g, add) {
      if (!g.seqKnown) {
        add(near(g, g.seqManifest.pos), 'Read the sorting manifest', () => {
          g.seqKnown = true;
          audio.levelUp();
          const names = g.seqOrder.map((i) => SYMBOL_NAMES[i % SYMBOL_NAMES.length]);
          g.hud.toast(`MANIFEST — ${names.join(' → ')}`, 'good', 6);
          g.hud.intercom('POD SYSTEM', `Sorting order logged: ${names.join(', ')}. Jam the arms in that order.`, '');
        });
      }
      for (const s of g.stations) {
        if (s.state === 'done') continue;
        const label = SYMBOL_NAMES[s.symbol % SYMBOL_NAMES.length];
        add(near(g, s.pos), `Jam the ${label} arm`, () => {
          if (!g.seqKnown) {
            g.hud.toast('THE ARMS ARE INTERLOCKED — FIND THE MANIFEST', 'bad', 2.6);
            audio.ui(180);
            return;
          }
          if (g.seqOrder[g.seqAt] === s.symbol) {
            g.seqAt++;
            completed(g, s);
            tick(g, g.objective.label);
          } else {
            // Wrong arm: the whole sequence resets and the floor reacts.
            g.seqAt = 0;
            g.objective.done = 0;
            for (const o of g.stations) {
              if (o.state !== 'done') continue;
              o.state = 'idle';
              o.group.userData.core.scale.setScalar(0.9);
              o.group.userData.ring.material.color.setHex(g.floorCfg.palette.trim);
            }
            punish(g, g.floorCfg, 5, 'WRONG ARM — SORTING RESET');
          }
        });
      }
    },
    force(g) { for (const s of g.stations) if (s.state !== 'done') { completed(g, s); tick(g, g.objective.label); } },
  },

  /**
   * Server Farm. The valves are not marked and not in the open — they sit in
   * dead-end alcoves and behind the racks. No waves at all: the floor's
   * pressure comes from having to walk it, not from standing still on it.
   */
  hunt: {
    setup(g, cfg, rng) {
      g.stations = place(g, cfg, rng, cfg.objective.count, cfg.objective.shape || 'valve');
      // Push each one to the least-trafficked corner of its room.
      for (const s of g.stations) {
        const r = s.room;
        const corners = [[r.x + 1.5, r.z + 1.5], [r.x + r.w - 1.5, r.z + 1.5],
          [r.x + 1.5, r.z + r.h - 1.5], [r.x + r.w - 1.5, r.z + r.h - 1.5]];
        const c = corners[rng.int(0, 3)];
        const x = g.level.cellToWorldX(c[0]), z = g.level.cellToWorldZ(c[1]);
        if (!g.level.isSolidAt(x, z)) { s.pos.set(x, 0, z); s.group.position.copy(s.pos); }
        s.found = false;
      }
      g.huntHint = 0;
    },
    update(g, dt) {
      for (const s of g.stations) {
        idleAnim(g, s, dt, s.state === 'done' ? 0x4affa0 : undefined);
        // They only light up once you are close — that is the whole point.
        const d = near(g, s.pos);
        const vis = s.state === 'done' ? 1 : Math.max(0.05, 1 - d / 16);
        s.group.userData.core.material.opacity = vis;
        s.group.userData.ring.material.opacity = vis * 0.55;
        if (!s.found && d < 7) {
          s.found = true;
          audio.ui(760);
          g.hud.toast('COOLING VALVE LOCATED', 'good', 1.8);
        }
      }
      // A nudge toward the nearest one if the player has been wandering.
      g.huntHint -= dt;
      if (g.huntHint <= 0) {
        g.huntHint = 34;
        const open = g.stations.filter((s) => s.state !== 'done');
        if (open.length) {
          const closest = open.reduce((a, b) => (near(g, a.pos) < near(g, b.pos) ? a : b));
          const d = near(g, closest.pos);
          g.hud.toast(`NEAREST VALVE — ${Math.round(d)}m`, 'info', 2.4);
        }
      }
      charging(g, dt, g.stations, 1.6, (s) => { completed(g, s); tick(g, g.objective.label); });
    },
    offer(g, add) {
      for (const s of g.stations) {
        if (s.state === 'done') continue;
        add(near(g, s.pos), s.state === 'charging' ? 'Turning…' : 'Turn the cooling valve',
          () => { if (s.state === 'idle') { s.state = 'charging'; s.charge = 0; audio.ui(500); } });
      }
    },
    force(g) { for (const s of g.stations) if (s.state !== 'done') { completed(g, s); tick(g, g.objective.label); } },
  },

  /**
   * Aquatics. Pump cores live in a store room; the sockets are elsewhere. You
   * carry one at a time, you move slower with it, and you cannot shoot while
   * you are holding it — so the walk back is the encounter.
   */
  carry: {
    setup(g, cfg, rng) {
      g.stations = place(g, cfg, rng, cfg.objective.count, 'socket');
      // The store: all the cores in one room, far from the sockets.
      const used = new Set(g.stations.map((s) => s.room.id));
      const store = rng.shuffle(g.level.rooms.filter(
        (r) => r.type !== 'boss' && r.type !== 'spawn' && !used.has(r.id)))[0]
        || g.level.rooms.find((r) => r.type === 'spawn');
      g.carryStore = store;
      g.carryCores = [];
      for (let i = 0; i < cfg.objective.count; i++) {
        const a = (i / cfg.objective.count) * TAU;
        const c = g.level.roomCenter(store);
        const pos = new THREE.Vector3(c.x + Math.cos(a) * 2.2, 0.8, c.z + Math.sin(a) * 2.2);
        const group = buildCarryCore(cfg.palette.emissive);
        group.position.copy(pos);
        g.propGroup.add(group);
        g.carryCores.push({ group, pos, taken: false, index: i });
      }
      g.carrying = null;
    },
    update(g, dt) {
      for (const s of g.stations) idleAnim(g, s, dt, s.state === 'done' ? 0x4affa0 : 0xff8a3c);
      for (const c of g.carryCores) {
        if (c.taken) continue;
        c.group.rotation.y += dt * 1.2;
        c.group.position.y = 0.8 + Math.sin(g.now * 1.8 + c.index) * 0.12;
      }
      if (g.carrying) {
        // Ride just in front of the camera, low, like something heavy.
        const p = g.player;
        const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
        g.carrying.group.position.set(
          p.pos.x - fx * 1.0, p.pos.y + 0.72 + Math.sin(g.now * 5) * 0.02, p.pos.z - fz * 1.0);
        g.carrying.group.rotation.y = -p.yaw;
        g.player.carryPenalty = 0.62;
      } else {
        g.player.carryPenalty = 1;
      }
    },
    offer(g, add) {
      if (!g.carrying) {
        for (const c of g.carryCores) {
          if (c.taken) continue;
          add(near(g, c.group.position), 'Lift the pump core', () => {
            g.carrying = c;
            audio.ui(420);
            g.hud.toast('PUMP CORE — BOTH HANDS', 'info', 2.2);
          });
        }
      } else {
        // The interaction picker keeps the *closest* offer, so the
        // "set it down" option below has to be offered at a worse distance
        // than any socket — at a fixed 0.1 it always won, and seating a core
        // was literally impossible. The smoke test force-completes objectives,
        // so it never caught this; a player would have hit it in the first
        // minute of floor three.
        let nearestSocket = Infinity;
        for (const s of g.stations) {
          if (s.state === 'done') continue;
          nearestSocket = Math.min(nearestSocket, near(g, s.pos));
        }
        for (const s of g.stations) {
          if (s.state === 'done') continue;
          add(near(g, s.pos), 'Seat the pump core', () => {
            const c = g.carrying;
            c.taken = true;
            g.carrying = null;
            g.player.carryPenalty = 1;
            c.group.position.copy(s.pos);
            c.group.position.y = 1.0;
            completed(g, s);
            tick(g, g.objective.label);
          });
        }
        // Only when there is no socket in reach.
        if (nearestSocket > 3.4) add(3.3, 'Set the core down', () => {
          const c = g.carrying;
          g.carrying = null;
          g.player.carryPenalty = 1;
          c.group.position.set(g.player.pos.x, 0.8, g.player.pos.z);
          c.pos.copy(c.group.position);
        });
      }
    },
    force(g) {
      g.carrying = null;
      g.player.carryPenalty = 1;
      for (const s of g.stations) if (s.state !== 'done') { completed(g, s); tick(g, g.objective.label); }
    },
  },

  /**
   * The Garden. It blooms a colour sequence at you, once, and then you have to
   * play it back on the valves. It repeats the sequence if you ask, but each
   * replay costs you — the garden gets bored and sends something.
   */
  pattern: {
    setup(g, cfg, rng) {
      g.stations = place(g, cfg, rng, cfg.objective.count, 'bloom');
      const hues = [0xff5a6a, 0x5affa0, 0x6fa8ff, 0xffd24a, 0xd88aff, 0xff9a3c];
      g.stations.forEach((s, i) => {
        s.hue = hues[i % hues.length];
        s.group.userData.core.material.color.setHex(s.hue);
        s.group.userData.ring.material.color.setHex(s.hue);
      });
      g.patSeq = Array.from({ length: Math.min(5, cfg.objective.count + 1) },
        () => rng.int(0, g.stations.length - 1));
      g.patAt = 0;
      g.patPlaying = 0;
      g.patStep = -1;
      g.patReplays = 0;
      g.patStarted = false;
    },
    update(g, dt) {
      for (const s of g.stations) {
        idleAnim(g, s, dt, s.hue);
        s.group.userData.core.scale.setScalar(0.9);
      }
      if (g.patPlaying > 0) {
        g.patPlaying -= dt;
        const total = g.patSeq.length * 0.8;
        const idx = Math.floor((total - g.patPlaying) / 0.8);
        if (idx !== g.patStep && idx >= 0 && idx < g.patSeq.length) {
          g.patStep = idx;
          const s = g.stations[g.patSeq[idx]];
          audio.ui(300 + g.patSeq[idx] * 120);
          g.particles.ring(s.pos.x, 1.4, s.pos.z, { from: 0.5, to: 4, life: 0.6, color: s.hue });
        }
        if (g.patStep >= 0 && g.patStep < g.patSeq.length) {
          const s = g.stations[g.patSeq[g.patStep]];
          s.group.userData.core.scale.setScalar(1.7);
        }
        if (g.patPlaying <= 0) { g.patStep = -1; g.hud.toast('NOW REPEAT IT', 'info', 2.4); }
      }
      // Show progress on the stations you have already matched.
      for (let i = 0; i < g.patAt; i++) {
        const s = g.stations[g.patSeq[i]];
        if (s) s.group.userData.ring.material.color.setHex(0x4affa0);
      }
    },
    offer(g, add) {
      if (g.patPlaying > 0) return;
      for (const s of g.stations) {
        add(near(g, s.pos), g.patStarted ? 'Touch the bloom' : 'Wake the garden', () => {
          if (!g.patStarted) {
            g.patStarted = true;
            g.patPlaying = g.patSeq.length * 0.8;
            g.patStep = -1;
            g.hud.toast('WATCH', 'info', 2.4);
            return;
          }
          const want = g.patSeq[g.patAt];
          if (g.stations[want] === s) {
            g.patAt++;
            audio.ui(500 + g.patAt * 90);
            g.particles.ring(s.pos.x, 1.4, s.pos.z, { from: 0.5, to: 4, life: 0.5, color: 0x4affa0 });
            g.objective.done = Math.min(g.objective.total, Math.round(
              g.patAt / g.patSeq.length * g.objective.total));
            g.hud.toast(`${g.objective.label} ${g.patAt}/${g.patSeq.length}`, 'good', 1.6);
            if (g.patAt >= g.patSeq.length) {
              for (const o of g.stations) completed(g, o);
              g.objective.done = g.objective.total;
              g._checkObjective();
            }
          } else {
            g.patAt = 0;
            g.objective.done = 0;
            for (const o of g.stations) o.group.userData.ring.material.color.setHex(o.hue);
            g.patReplays++;
            punish(g, g.floorCfg, 4, 'THE GARDEN DISAGREES');
            g.patPlaying = g.patSeq.length * 0.8;
            g.patStep = -1;
          }
        });
      }
    },
    force(g) {
      g.patAt = g.patSeq.length;
      for (const s of g.stations) if (s.state !== 'done') completed(g, s);
      g.objective.done = g.objective.total;
    },
  },

  /**
   * The Kiln. Opening one heat sink starts a clock; all of them have to be
   * open at once before it runs out, and they close again if it does. The
   * floor is a route-planning problem with a stopwatch on it.
   */
  timed: {
    setup(g, cfg, rng) {
      g.stations = place(g, cfg, rng, cfg.objective.count, 'sink');
      g.timedClock = 0;
      g.timedWindow = 26 + cfg.objective.count * 9;
      g.timedOpen = 0;
    },
    update(g, dt) {
      for (const s of g.stations) {
        idleAnim(g, s, dt, s.state === 'open' ? 0x6fd8ff : (s.state === 'done' ? 0x4affa0 : 0xff6a2a));
      }
      if (g.timedClock > 0) {
        g.timedClock -= dt;
        g.hud.setTimer?.(`SHAFT COOLING — ${g.timedClock.toFixed(1)}s`, g.timedClock / g.timedWindow);
        if (g.timedClock <= 0) {
          for (const s of g.stations) if (s.state === 'open') { s.state = 'idle'; s.charge = 0; }
          g.timedOpen = 0;
          g.objective.done = 0;
          g.hud.setTimer?.(null);
          punish(g, g.floorCfg, 4, 'THE HEAT CAME BACK — SINKS RESET');
        }
      }
      charging(g, dt, g.stations, 1.2, (s) => {
        s.state = 'open';
        s.charge = 0;
        g.timedOpen++;
        g.objective.done = g.timedOpen;
        audio.ui(660);
        if (g.timedClock <= 0) {
          g.timedClock = g.timedWindow;
          g.hud.toast(`ALL ${g.objective.total} SINKS — ${Math.round(g.timedWindow)}s`, 'bad', 3);
        }
        g.hud.toast(`${g.objective.label} ${g.timedOpen}/${g.objective.total}`, 'good', 1.8);
        if (g.timedOpen >= g.objective.total) {
          g.timedClock = 0;
          g.hud.setTimer?.(null);
          for (const o of g.stations) completed(g, o);
          g.objective.done = g.objective.total;
          g._checkObjective();
        }
      });
    },
    offer(g, add) {
      for (const s of g.stations) {
        if (s.state === 'done' || s.state === 'open') continue;
        add(near(g, s.pos), s.state === 'charging' ? 'Opening…' : 'Open the heat sink',
          () => { if (s.state === 'idle') { s.state = 'charging'; s.charge = 0; audio.ui(500); } });
      }
    },
    force(g) {
      g.timedClock = 0;
      g.hud.setTimer?.(null);
      for (const s of g.stations) if (s.state !== 'done') completed(g, s);
      g.objective.done = g.objective.total;
    },
  },

  /**
   * Substrate Layer. A lights-out puzzle: every bus you flip also flips the
   * two nearest to it. Getting all of them lit is a real problem rather than
   * a chore, and it is solvable by trial without ever being random.
   */
  circuit: {
    setup(g, cfg, rng) {
      const n = cfg.objective.count;
      g.stations = place(g, cfg, rng, n, 'bus');
      // Neighbours: the two closest, so the graph is a property of the layout.
      for (const s of g.stations) {
        s.on = false;
        s.links = g.stations.filter((o) => o !== s)
          .sort((a, b) => a.pos.distanceTo(s.pos) - b.pos.distanceTo(s.pos))
          .slice(0, 2);
      }
      // Scramble from solved, so it is always solvable.
      for (const s of g.stations) s.on = true;
      const flips = 3 + (n >> 1);
      for (let i = 0; i < flips; i++) {
        const s = g.stations[rng.int(0, n - 1)];
        s.on = !s.on;
        for (const l of s.links) l.on = !l.on;
      }
      if (g.stations.every((s) => s.on)) { const s = g.stations[0]; s.on = false; for (const l of s.links) l.on = !l.on; }
      g.circuitLines = new THREE.Group();
      g.propGroup.add(g.circuitLines);
      for (const s of g.stations) {
        for (const l of s.links) {
          const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(s.pos.x, 1.5, s.pos.z), new THREE.Vector3(l.pos.x, 1.5, l.pos.z)]);
          g.circuitLines.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
            color: cfg.palette.trim, transparent: true, opacity: 0.2 })));
        }
      }
    },
    update(g, dt) {
      let on = 0;
      for (const s of g.stations) {
        idleAnim(g, s, dt, s.on ? 0x4affa0 : 0x3a2f5a);
        s.group.userData.core.scale.setScalar(s.on ? 1.1 : 0.6);
        s.group.userData.ring.material.opacity = s.on ? 0.6 : 0.15;
        if (s.on) on++;
      }
      if (on !== g.objective.done) {
        g.objective.done = on;
        if (on >= g.objective.total) {
          for (const s of g.stations) completed(g, s);
          g._checkObjective();
        }
      }
    },
    offer(g, add) {
      for (const s of g.stations) {
        add(near(g, s.pos), s.on ? 'Cut this bus (and its neighbours)' : 'Free this bus (and its neighbours)', () => {
          s.on = !s.on;
          for (const l of s.links) l.on = !l.on;
          audio.ui(s.on ? 620 : 300);
          g.particles.ring(s.pos.x, 1.5, s.pos.z, { from: 0.5, to: 5, life: 0.5, color: s.on ? 0x4affa0 : 0x8f6bd8 });
          g.hud.toast(`BUSES ${g.stations.filter((o) => o.on).length}/${g.objective.total}`, 'info', 1.4);
        });
      }
    },
    force(g) {
      for (const s of g.stations) { s.on = true; completed(g, s); }
      g.objective.done = g.objective.total;
    },
  },

  /**
   * Hall of Mirrors. The rehearsal has been running for a duration expressed
   * in scientific notation, and it wants its marks hit. Each mark lights in
   * turn, moves after a few seconds, and only counts while it is lit — so the
   * floor is a chase against a spotlight rather than another glowing pillar.
   */
  marks: {
    setup(g, cfg, rng) {
      // More marks than the objective needs, so the sequence has somewhere to go.
      g.stations = place(g, cfg, rng, cfg.objective.count + 3, 'panel', 0xe8f0fa);
      g.markAt = rng.int(0, g.stations.length - 1);
      g.markTimer = 9;
      g.markWindow = 9;
      g.markMissed = 0;
    },
    update(g, dt) {
      for (let i = 0; i < g.stations.length; i++) {
        const s = g.stations[i];
        const lit = i === g.markAt;
        idleAnim(g, s, dt, lit ? 0xffd24a : 0x2a3038);
        s.group.userData.core.scale.setScalar(lit ? 1.3 + Math.sin(g.now * 7) * 0.18 : 0.45);
        s.group.userData.ring.material.opacity = lit ? 0.75 : 0.1;
        // A spotlight column, so the live mark is visible across the room.
        if (lit && !s.beam) {
          s.beam = new THREE.Mesh(
            new THREE.ConeGeometry(1.4, 5, 16, 1, true),
            new THREE.MeshBasicMaterial({
              color: 0xffe6a8, transparent: true, opacity: 0.12,
              side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
            }),
          );
          s.beam.position.set(s.pos.x, 2.5, s.pos.z);
          s.beam.rotation.x = Math.PI;
          g.propGroup.add(s.beam);
        } else if (!lit && s.beam) {
          g.propGroup.remove(s.beam);
          s.beam.geometry.dispose();
          s.beam.material.dispose();
          s.beam = null;
        }
      }
      g.markTimer -= dt;
      g.hud.setTimer(`STAGE MARK — ${Math.max(0, g.markTimer).toFixed(1)}s`, g.markTimer / g.markWindow);
      if (g.markTimer <= 0) {
        g.markMissed++;
        g.hud.setTimer(null);
        punish(g, g.floorCfg, 3, 'MISSED YOUR MARK');
        this._advance(g);
      }
    },
    _advance(g) {
      let next = g.markAt;
      // Never twice in a row, and prefer a mark you have to actually cross to.
      const ranked = g.stations.map((s, i) => ({ i, d: near(g, s.pos) }))
        .filter((r) => r.i !== g.markAt)
        .sort((a, b) => b.d - a.d);
      next = ranked[Math.min(ranked.length - 1, 1 + (g.objective.done % 2))]?.i ?? next;
      g.markAt = next;
      g.markWindow = Math.max(5.5, 9 - g.objective.done * 0.6);
      g.markTimer = g.markWindow;
    },
    offer(g, add) {
      const s = g.stations[g.markAt];
      if (!s) return;
      add(near(g, s.pos), 'Hit the mark', () => {
        g.objective.done++;
        audio.levelUp();
        g.particles.ring(s.pos.x, 0.2, s.pos.z, { from: 1, to: 8, life: 0.7, color: 0xffd24a });
        g.hud.toast(`${g.objective.label} ${g.objective.done}/${g.objective.total}`, 'good', 2);
        if (g.objective.done >= g.objective.total) {
          g.hud.setTimer(null);
          for (const o of g.stations) {
            completed(g, o);
            if (o.beam) { g.propGroup.remove(o.beam); o.beam = null; }
          }
          g._checkObjective();
          return;
        }
        OBJECTIVE_KINDS.marks._advance(g);
      });
    },
    force(g) {
      g.hud.setTimer(null);
      for (const s of g.stations) {
        if (s.beam) { g.propGroup.remove(s.beam); s.beam = null; }
        if (s.state !== 'done') completed(g, s);
      }
      g.objective.done = g.objective.total;
    },
  },

  /**
   * Alpha Wing and Hall of Mirrors. Elites carry the item; killing one drops
   * it. Left as it was — it is already not a holdout, and hunting a marked
   * target through a floor is its own thing.
   */
  keycards: {
    setup(g) { g.stations = []; g.keycardsSpawned = 0; g.eliteTimer = 4; },
    update() {},
    offer() {},
    force(g) { g.objective.done = g.objective.total; },
  },
};

const SYMBOL_NAMES = ['WEDGE', 'STAR', 'ORB', 'HEX', 'SPIKE', 'DISC'];

/** Look up a floor's kind, falling back to the original behaviour. */
export function objectiveKind(type) {
  return OBJECTIVE_KINDS[type] || OBJECTIVE_KINDS.nodes;
}
