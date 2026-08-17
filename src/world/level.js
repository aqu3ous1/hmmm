// Floor layout generation and mesh construction.
//
// The plan lives on a coarse tile grid: rooms and corridors carve open cells out
// of a solid block. Collision is a grid lookup, which makes doorways, pillars and
// odd room shapes all behave identically without any special-case geometry.

import * as THREE from '../../vendor/three.module.js';
import { UNIT, xform, mergeGeometries, disposeTree, quad, paint } from './geometry.js';
import { clamp } from '../core/util.js';

export const CELL = 2.4;
export const WALL_H = 4.6;
export const GRID = 112;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const _shadeColor = new THREE.Color();
/** A darkened copy of a palette colour. */
function shade(hex, amount) {
  return _shadeColor.setHex(hex).multiplyScalar(amount).getHex();
}

/**
 * Palette entries are authored for mood, not for reflectance — most are so dark
 * that a physically-lit surface has nothing to return. This lifts a colour to a
 * usable albedo while keeping its hue, so the floor still reads as "that floor".
 */
function albedo(hex, k = 2.2) {
  const c = _shadeColor.setHex(hex);
  const max = Math.max(c.r, c.g, c.b);
  const scale = max > 0.001 ? Math.min(k, 0.46 / max) : k;
  return c.multiplyScalar(Math.max(1, scale)).getHex();
}

const _hsl = { h: 0, s: 0, l: 0 };

/**
 * Albedo for a *structural* surface — concrete, plate, panel, ceiling.
 *
 * The palette hue belongs on the trim, the emissives and the lights. When it is
 * also painted onto the concrete, the ambient light, the hemisphere, the
 * fixtures, the reflections and the colour grade all multiply the same hue
 * together and the whole frame turns into one flat wash: the Server Farm went
 * green from floor to ceiling and nothing in it read as a different material.
 * So structure keeps only a trace of hue and gets its brightness set outright —
 * value separation between floor, wall and ceiling is what actually makes a
 * room legible, and it can only exist if those three aren't the same colour.
 */
function structural(hex, value, keep = 0.2) {
  const c = _shadeColor.setHex(hex);
  c.getHSL(_hsl);
  c.setHSL(_hsl.h, Math.min(1, _hsl.s) * keep, value);
  return c.getHex();
}

/** Physically-shaded surface material. `rough`/`metal` are what separate
 *  painted steel from bare metal from rubber once the env map is bound. */
function surface(color, { rough = 0.9, metal = 0.04, ...extra } = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: metal, envMapIntensity: 0.6, ...extra,
  });
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function generateLayout(cfg, rng) {
  const grid = new Uint8Array(GRID * GRID).fill(1); // 1 = solid
  const rooms = [];
  const links = [];
  const at = (x, z) => x + z * GRID;

  const fits = (x, z, w, h, pad = 2) => {
    if (x - pad < 1 || z - pad < 1 || x + w + pad >= GRID - 1 || z + h + pad >= GRID - 1) return false;
    for (const r of rooms) {
      if (x - pad < r.x + r.w && x + w + pad > r.x && z - pad < r.z + r.h && z + h + pad > r.z) return false;
    }
    return true;
  };

  const carveRect = (x, z, w, h) => {
    for (let j = z; j < z + h; j++) for (let i = x; i < x + w; i++) grid[at(i, j)] = 0;
  };

  const addRoom = (x, z, w, h) => {
    const r = {
      id: rooms.length, x, z, w, h,
      cx: x + w / 2, cz: z + h / 2,
      type: 'normal', neighbors: [], cleared: false, visited: false,
    };
    rooms.push(r);
    carveRect(x, z, w, h);
    return r;
  };

  // Spawn room, dead centre.
  const sw = 9, sh = 9;
  const spawn = addRoom(Math.floor(GRID / 2 - sw / 2), Math.floor(GRID / 2 - sh / 2), sw, sh);
  spawn.type = 'spawn';

  const target = cfg.rooms;
  let attempts = 0;
  while (rooms.length < target && attempts++ < 4000) {
    const from = rooms[rng.int(0, rooms.length - 1)];
    const [dx, dz] = DIRS[rng.int(0, 3)];
    const w = rng.int(7, 15);
    const h = rng.int(7, 15);
    const gap = rng.int(4, 10);

    let x, z;
    if (dx === 1) { x = from.x + from.w + gap; z = Math.round(from.cz - h / 2) + rng.int(-3, 3); }
    else if (dx === -1) { x = from.x - gap - w; z = Math.round(from.cz - h / 2) + rng.int(-3, 3); }
    else if (dz === 1) { z = from.z + from.h + gap; x = Math.round(from.cx - w / 2) + rng.int(-3, 3); }
    else { z = from.z - gap - h; x = Math.round(from.cx - w / 2) + rng.int(-3, 3); }

    if (!fits(x, z, w, h)) continue;
    const room = addRoom(x, z, w, h);
    carveCorridor(grid, from, room, rng);
    from.neighbors.push(room.id);
    room.neighbors.push(from.id);
    links.push([from.id, room.id]);
  }

  // A couple of extra loops so the floor isn't a pure tree — backtracking is
  // more interesting when there's a second way around.
  let loops = 0;
  for (let i = 0; i < rooms.length && loops < 3; i++) {
    const a = rooms[rng.int(0, rooms.length - 1)];
    const b = rooms[rng.int(0, rooms.length - 1)];
    if (a === b || a.neighbors.includes(b.id)) continue;
    const d = Math.hypot(a.cx - b.cx, a.cz - b.cz);
    if (d > 34 || d < 10) continue;
    carveCorridor(grid, a, b, rng);
    a.neighbors.push(b.id); b.neighbors.push(a.id);
    links.push([a.id, b.id]);
    loops++;
  }

  assignRoomTypes(rooms, cfg, rng);
  addRoomFeatures(grid, rooms, rng);

  return { grid, rooms, links, spawn };
}

function carveCorridor(grid, a, b, rng) {
  const at = (x, z) => x + z * GRID;
  const halfW = 1; // 3 cells wide
  const ax = Math.round(a.cx), az = Math.round(a.cz);
  const bx = Math.round(b.cx), bz = Math.round(b.cz);
  const horizFirst = rng.chance(0.5);
  const cornerX = horizFirst ? bx : ax;
  const cornerZ = horizFirst ? az : bz;

  const carveLine = (x0, z0, x1, z1) => {
    const sx = Math.sign(x1 - x0), sz = Math.sign(z1 - z0);
    let x = x0, z = z0;
    for (let guard = 0; guard < 400; guard++) {
      for (let j = -halfW; j <= halfW; j++) {
        for (let i = -halfW; i <= halfW; i++) {
          const px = clamp(x + i, 1, GRID - 2), pz = clamp(z + j, 1, GRID - 2);
          grid[at(px, pz)] = 0;
        }
      }
      if (x === x1 && z === z1) break;
      if (x !== x1) x += sx; else if (z !== z1) z += sz;
    }
  };

  carveLine(ax, az, cornerX, cornerZ);
  carveLine(cornerX, cornerZ, bx, bz);
}

function assignRoomTypes(rooms, cfg, rng) {
  const spawn = rooms[0];
  // BFS from spawn for graph distance.
  const dist = new Array(rooms.length).fill(-1);
  dist[0] = 0;
  const q = [0];
  while (q.length) {
    const i = q.shift();
    for (const n of rooms[i].neighbors) if (dist[n] < 0) { dist[n] = dist[i] + 1; q.push(n); }
  }
  for (let i = 0; i < rooms.length; i++) if (dist[i] < 0) dist[i] = 0;

  // Boss room: the furthest reachable, enlarged.
  let bossIdx = 0, best = -1;
  for (let i = 1; i < rooms.length; i++) {
    const score = dist[i] * 3 + Math.hypot(rooms[i].cx - spawn.cx, rooms[i].cz - spawn.cz) * 0.1;
    if (score > best) { best = score; bossIdx = i; }
  }
  rooms[bossIdx].type = 'boss';

  const free = rooms.map((r, i) => i).filter((i) => rooms[i].type === 'normal');
  const shuffled = rng.shuffle(free).sort((a, b) => dist[b] - dist[a]);

  // Objective rooms spread across the far half of the floor.
  const objCount = Math.min(cfg.objective.count, Math.max(1, shuffled.length - 2));
  const objRooms = [];
  for (let i = 0; i < objCount && shuffled.length; i++) {
    const pick = shuffled.splice(Math.floor(i * shuffled.length / Math.max(1, objCount)), 1)[0];
    if (pick === undefined) break;
    rooms[pick].type = 'objective';
    objRooms.push(pick);
  }

  // Two chests, biased toward rooms you'll reach early and mid.
  const nearFirst = shuffled.slice().sort((a, b) => dist[a] - dist[b]);
  const chestPicks = [];
  if (nearFirst.length) chestPicks.push(nearFirst[Math.min(1, nearFirst.length - 1)]);
  if (nearFirst.length > 2) chestPicks.push(nearFirst[Math.floor(nearFirst.length * 0.65)]);
  for (const c of chestPicks) if (c !== undefined) rooms[c].type = 'chest';

  // Anything still normal but far out becomes a loot/ambush room.
  for (const r of rooms) if (r.type === 'normal' && rng.chance(0.35)) r.type = 'ambush';

  rooms.forEach((r, i) => { r.dist = dist[i]; });
}

/** Pillars and alcoves so combat rooms have cover. */
function addRoomFeatures(grid, rooms, rng) {
  const at = (x, z) => x + z * GRID;
  for (const r of rooms) {
    if (r.type === 'spawn') continue;
    const area = r.w * r.h;
    if (area < 70) continue;
    const pillars = r.type === 'boss' ? rng.int(2, 4) : rng.int(1, 4);
    r.pillars = [];
    for (let p = 0; p < pillars; p++) {
      const pw = rng.int(1, 2), ph = rng.int(1, 2);
      const px = r.x + rng.int(2, Math.max(2, r.w - pw - 2));
      const pz = r.z + rng.int(2, Math.max(2, r.h - ph - 2));
      // Never wall off the middle of a small room.
      if (Math.abs(px + pw / 2 - r.cx) < 1.5 && Math.abs(pz + ph / 2 - r.cz) < 1.5) continue;
      for (let j = pz; j < pz + ph; j++) for (let i = px; i < px + pw; i++) grid[at(i, j)] = 1;
      r.pillars.push({ x: px, z: pz, w: pw, h: ph });
    }
  }
}

// ---------------------------------------------------------------------------
// Level: meshes + collision
// ---------------------------------------------------------------------------

export class Level {
  constructor(layout, cfg, rng) {
    this.layout = layout;
    this.cfg = cfg;
    this.grid = layout.grid;
    this.rooms = layout.rooms;
    this.rng = rng;
    this.group = new THREE.Group();
    this.lightPoints = [];
    this.decorGroup = new THREE.Group();
    this.group.add(this.decorGroup);
    this._build();
  }

  // -- coordinate helpers --
  cellToWorldX(cx) { return (cx - GRID / 2) * CELL; }
  cellToWorldZ(cz) { return (cz - GRID / 2) * CELL; }
  worldToCellX(x) { return Math.floor(x / CELL + GRID / 2); }
  worldToCellZ(z) { return Math.floor(z / CELL + GRID / 2); }

  roomCenter(room) {
    return new THREE.Vector3(this.cellToWorldX(room.cx), 0, this.cellToWorldZ(room.cz));
  }

  roomWorldRect(room) {
    return {
      x0: this.cellToWorldX(room.x), z0: this.cellToWorldZ(room.z),
      x1: this.cellToWorldX(room.x + room.w), z1: this.cellToWorldZ(room.z + room.h),
    };
  }

  isSolidCell(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= GRID || cz >= GRID) return true;
    return this.grid[cx + cz * GRID] === 1;
  }

  isSolidAt(x, z) {
    return this.isSolidCell(this.worldToCellX(x), this.worldToCellZ(z));
  }

  /** Which room contains this world position (or null if a corridor). */
  roomAt(x, z) {
    const cx = this.worldToCellX(x), cz = this.worldToCellZ(z);
    for (const r of this.rooms) {
      if (cx >= r.x && cx < r.x + r.w && cz >= r.z && cz < r.z + r.h) return r;
    }
    return null;
  }

  /**
   * Push a circle out of any solid tiles it overlaps. Mutates `pos` (a Vector3,
   * y ignored) and returns true if it moved.
   */
  resolveCircle(pos, radius) {
    let moved = false;
    const minX = this.worldToCellX(pos.x - radius), maxX = this.worldToCellX(pos.x + radius);
    const minZ = this.worldToCellZ(pos.z - radius), maxZ = this.worldToCellZ(pos.z + radius);
    for (let cz = minZ; cz <= maxZ; cz++) {
      for (let cx = minX; cx <= maxX; cx++) {
        if (!this.isSolidCell(cx, cz)) continue;
        const bx0 = this.cellToWorldX(cx), bz0 = this.cellToWorldZ(cz);
        const bx1 = bx0 + CELL, bz1 = bz0 + CELL;
        const nx = clamp(pos.x, bx0, bx1);
        const nz = clamp(pos.z, bz0, bz1);
        const dx = pos.x - nx, dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = radius - d;
          pos.x += (dx / d) * push;
          pos.z += (dz / d) * push;
        } else {
          // Dead centre of a tile: eject along the shallowest axis.
          const toL = pos.x - bx0, toR = bx1 - pos.x, toT = pos.z - bz0, toB = bz1 - pos.z;
          const m = Math.min(toL, toR, toT, toB);
          if (m === toL) pos.x = bx0 - radius;
          else if (m === toR) pos.x = bx1 + radius;
          else if (m === toT) pos.z = bz0 - radius;
          else pos.z = bz1 + radius;
        }
        moved = true;
      }
    }
    return moved;
  }

  /**
   * DDA raycast against the wall grid in the XZ plane.
   * Returns { hit, dist, nx, nz } — normal points out of the wall.
   */
  raycast(ox, oz, dx, dz, maxDist) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return { hit: false, dist: maxDist };
    dx /= len; dz /= len;

    let cx = this.worldToCellX(ox), cz = this.worldToCellZ(oz);
    if (this.isSolidCell(cx, cz)) return { hit: true, dist: 0, nx: -dx, nz: -dz };

    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = Math.abs(dx) < 1e-9 ? Infinity : Math.abs(CELL / dx);
    const tDeltaZ = Math.abs(dz) < 1e-9 ? Infinity : Math.abs(CELL / dz);

    const bx = this.cellToWorldX(cx), bz = this.cellToWorldZ(cz);
    let tMaxX = Math.abs(dx) < 1e-9 ? Infinity : ((dx > 0 ? bx + CELL - ox : ox - bx) / Math.abs(dx));
    let tMaxZ = Math.abs(dz) < 1e-9 ? Infinity : ((dz > 0 ? bz + CELL - oz : oz - bz) / Math.abs(dz));

    let t = 0, guard = 0;
    while (t <= maxDist && guard++ < 512) {
      let nx = 0, nz = 0;
      if (tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDeltaX; cx += stepX; nx = -stepX; }
      else { t = tMaxZ; tMaxZ += tDeltaZ; cz += stepZ; nz = -stepZ; }
      if (t > maxDist) break;
      if (this.isSolidCell(cx, cz)) return { hit: true, dist: t, nx, nz };
    }
    return { hit: false, dist: maxDist };
  }

  /** True if there is unobstructed line of sight between two world points. */
  lineOfSight(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const d = Math.hypot(dx, dz);
    if (d < 0.001) return true;
    const r = this.raycast(ax, az, dx, dz, d - 0.05);
    return !r.hit;
  }

  /** A walkable point inside a room, at least `margin` cells from its walls. */
  randomPointIn(room, rng, margin = 1.5) {
    for (let i = 0; i < 40; i++) {
      const x = this.cellToWorldX(room.x + margin + rng() * Math.max(0.1, room.w - margin * 2));
      const z = this.cellToWorldZ(room.z + margin + rng() * Math.max(0.1, room.h - margin * 2));
      if (!this.isSolidAt(x, z) &&
          !this.isSolidAt(x + 0.6, z) && !this.isSolidAt(x - 0.6, z) &&
          !this.isSolidAt(x, z + 0.6) && !this.isSolidAt(x, z - 0.6)) {
        return new THREE.Vector3(x, 0, z);
      }
    }
    return this.roomCenter(room);
  }

  // -- construction --

  _build() {
    this._bakeAO();
    this._buildSurfaces();
    this._buildArchitecture();
    this._buildCeilingLights();
    this._buildProps();
  }

  // -- ambient occlusion ---------------------------------------------------

  /**
   * Per-grid-corner occlusion, baked once and read back as vertex colours.
   * A corner touches four cells; the more of them are solid, the darker it is.
   * This one pass is what stops the level reading as flat coloured boxes.
   */
  _bakeAO() {
    const n = GRID + 1;
    this.ao = new Float32Array(n * n);
    const solid = (x, z) => (this.isSolidCell(x, z) ? 1 : 0);
    for (let cz = 0; cz <= GRID; cz++) {
      for (let cx = 0; cx <= GRID; cx++) {
        const around = solid(cx - 1, cz - 1) + solid(cx, cz - 1) + solid(cx - 1, cz) + solid(cx, cz);
        // A corner poking into open space stays bright; a corner buried in
        // geometry goes dark, with the diagonal case pulled down further.
        let a = 1 - around * 0.3;
        if (around === 2 && solid(cx - 1, cz - 1) === solid(cx, cz)) a -= 0.1;
        this.ao[cx + cz * n] = clamp(a, 0.18, 1);
      }
    }
  }

  aoAt(cx, cz) {
    const n = GRID + 1;
    if (cx < 0 || cz < 0 || cx > GRID || cz > GRID) return 0.42;
    return this.ao[cx + cz * n];
  }

  /** Deterministic per-cell noise so panels and tiles vary without a texture. */
  _cellHash(cx, cz, salt = 0) {
    let h = (cx * 374761393 + cz * 668265263 + salt * 2246822519) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // -- floors, ceilings, walls --------------------------------------------

  _buildSurfaces() {
    const pal = this.cfg.palette;
    const grid = this.grid;
    const open = (x, z) => x >= 0 && z >= 0 && x < GRID && z < GRID && grid[x + z * GRID] === 0;

    const floorGeo = [], ceilGeo = [], wallGeo = [], trimGeo = [], decalGeo = [];
    const seamGeo = [], plateGeo = [];

    const wx = (cx) => this.cellToWorldX(cx);
    const wz = (cz) => this.cellToWorldZ(cz);

    // A recessed seam between floor plates. Real floors are laid in sections,
    // and the dark line where two sections meet is most of what tells you the
    // floor has a scale at all — without it every room is one infinite surface.
    const seam = (x0, z0, x1, z1, w) => seamGeo.push(quad(
      [x0 - w, 0.012, z1 + w], [x1 + w, 0.012, z1 + w],
      [x1 + w, 0.012, z0 - w], [x0 - w, 0.012, z0 - w],
      [1, 1, 1, 1],
    ));

    for (let cz = 0; cz < GRID; cz++) {
      for (let cx = 0; cx < GRID; cx++) {
        const x0 = wx(cx), x1 = x0 + CELL;
        const z0 = wz(cz), z1 = z0 + CELL;

        if (open(cx, cz)) {
          // --- floor tile, shaded from its four corners ---
          const a = this.aoAt(cx, cz), b = this.aoAt(cx + 1, cz);
          const c = this.aoAt(cx + 1, cz + 1), d = this.aoAt(cx, cz + 1);
          // Wound so the normal points up — reverse this and the tile is a
          // back face, gets culled, and you see straight through the world.
          const v = 0.82 + this._cellHash(cx, cz, 3) * 0.26;
          floorGeo.push(quad(
            [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0],
            [d * v, c * v, b * v, a * v],
          ));

          // Plate seams every third cell, and a raised diamond-plate insert on
          // a scattered few. Two cheap passes, and the floor stops being a
          // single continuous colour the eye slides straight off.
          if (cx % 3 === 0) seam(x0, z0, x0, z1, 0.035);
          if (cz % 3 === 0) seam(x0, z0, x1, z0, 0.035);
          if (this._cellHash(cx, cz, 21) > 0.86) {
            const pv = 0.9 + this._cellHash(cx, cz, 23) * 0.2;
            plateGeo.push(quad(
              [x0 + 0.18, 0.026, z1 - 0.18], [x1 - 0.18, 0.026, z1 - 0.18],
              [x1 - 0.18, 0.026, z0 + 0.18], [x0 + 0.18, 0.026, z0 + 0.18],
              [d * pv, c * pv, b * pv, a * pv],
            ));
          }

          // --- ceiling tile: same trick, normal pointing down ---
          const cv = 0.5 + this._cellHash(cx, cz, 7) * 0.1;
          ceilGeo.push(quad(
            [x0, WALL_H, z0], [x1, WALL_H, z0], [x1, WALL_H, z1], [x0, WALL_H, z1],
            [a * cv, b * cv, c * cv, d * cv],
          ));
          continue;
        }

        // --- wall faces: only the sides that actually front open space ---
        for (const [dx, dz] of DIRS) {
          if (!open(cx + dx, cz + dz)) continue;

          // Corners of this face at floor level, ordered so the quad faces out.
          let p0, p1, ca, cb;
          if (dx === 1) {
            p0 = [x1, 0, z1]; p1 = [x1, 0, z0];
            ca = this.aoAt(cx + 1, cz + 1); cb = this.aoAt(cx + 1, cz);
          } else if (dx === -1) {
            p0 = [x0, 0, z0]; p1 = [x0, 0, z1];
            ca = this.aoAt(cx, cz); cb = this.aoAt(cx, cz + 1);
          } else if (dz === 1) {
            p0 = [x0, 0, z1]; p1 = [x1, 0, z1];
            ca = this.aoAt(cx, cz + 1); cb = this.aoAt(cx + 1, cz + 1);
          } else {
            p0 = [x1, 0, z0]; p1 = [x0, 0, z0];
            ca = this.aoAt(cx + 1, cz); cb = this.aoAt(cx, cz);
          }

          // Inside corners: darken an edge whose neighbour along the face also
          // sticks out into the room.
          const side = dx ? [0, 1] : [1, 0];
          if (this.isSolidCell(cx - side[0], cz - side[1]) && open(cx + dx - side[0], cz + dz - side[1])) ca *= 0.82;
          if (this.isSolidCell(cx + side[0], cz + side[1]) && open(cx + dx + side[0], cz + dz + side[1])) cb *= 0.82;

          const tone = 0.86 + this._cellHash(cx, cz, dx * 5 + dz * 11) * 0.28;
          // Three stacked bands give the wall a vertical gradient — dark at the
          // skirting, brightest at eye level, falling off into the ceiling.
          const bands = [
            [0, 0.42, 0.36, 0.82],
            [0.42, WALL_H - 0.9, 0.82, 1.0],
            [WALL_H - 0.9, WALL_H, 1.0, 0.46],
          ];
          for (const [yLo, yHi, sLo, sHi] of bands) {
            wallGeo.push(quad(
              [p0[0], yLo, p0[2]], [p1[0], yLo, p1[2]],
              [p1[0], yHi, p1[2]], [p0[0], yHi, p0[2]],
              [ca * sLo * tone, cb * sLo * tone, cb * sHi * tone, ca * sHi * tone],
            ));
          }

          // Panel joints. A wall built out of bolted sections catches light at
          // every seam; one flat quad from skirting to cornice never will.
          const jx = dx * 0.014, jz = dz * 0.014;
          const jointQuad = (yLo, yHi, t0, t1) => {
            const lerp3 = (t) => [p0[0] + (p1[0] - p0[0]) * t + jx, 0, p0[2] + (p1[2] - p0[2]) * t + jz];
            const q0 = lerp3(t0), q1 = lerp3(t1);
            seamGeo.push(quad(
              [q0[0], yLo, q0[2]], [q1[0], yLo, q1[2]],
              [q1[0], yHi, q1[2]], [q0[0], yHi, q0[2]],
              [ca, cb, cb, ca],
            ));
          };
          jointQuad(0.42, WALL_H - 0.9, 0.02, 0.06);
          jointQuad(0.42, WALL_H - 0.9, 0.94, 0.98);
          jointQuad(2.62, 2.70, 0.06, 0.94);
          // Occasional vent grille, so the walls aren't uniformly panelled.
          if (this._cellHash(cx, cz, dx * 31 + dz * 17) > 0.8) {
            for (let g = 0; g < 5; g++) {
              const yy = 1.15 + g * 0.17;
              jointQuad(yy, yy + 0.1, 0.28, 0.72);
            }
          }

          // Emissive skirting and a cornice line.
          const nx = dx * 0.012, nz = dz * 0.012;
          const strip = (yLo, yHi, shade) => trimGeo.push(quad(
            [p0[0] + nx, yLo, p0[2] + nz], [p1[0] + nx, yLo, p1[2] + nz],
            [p1[0] + nx, yHi, p1[2] + nz], [p0[0] + nx, yHi, p0[2] + nz],
            [shade, shade, shade, shade],
          ));
          strip(0.10, 0.20, 1);
          strip(WALL_H - 0.32, WALL_H - 0.26, 0.7);
        }
      }
    }

    // Floor markings: a ring at the middle of every room, so rooms read as
    // places rather than as identical boxes.
    for (const room of this.rooms) {
      const cxw = this.cellToWorldX(room.cx), czw = this.cellToWorldZ(room.cz);
      const rad = Math.min(room.w, room.h) * CELL * 0.3;
      const seg = 28;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        if (i % 4 === 3) continue;  // dashed
        const r0 = rad, r1 = rad + 0.16;
        decalGeo.push(quad(
          [cxw + Math.cos(a0) * r1, 0.02, czw + Math.sin(a0) * r1],
          [cxw + Math.cos(a1) * r1, 0.02, czw + Math.sin(a1) * r1],
          [cxw + Math.cos(a1) * r0, 0.02, czw + Math.sin(a1) * r0],
          [cxw + Math.cos(a0) * r0, 0.02, czw + Math.sin(a0) * r0],
          [1, 1, 1, 1],
        ));
      }
    }

    const wire = !!pal.wireframe;
    // Value separation, set outright rather than inherited from the palette:
    // ceiling darkest, floor mid, walls lightest. That ordering is what lets
    // you read the shape of a room in one glance.
    if (floorGeo.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(floorGeo), surface(structural(pal.floor, 0.082), {
        vertexColors: true, rough: 0.82, metal: 0.12,
      })));
    }
    if (plateGeo.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(plateGeo), surface(structural(pal.floor, 0.105, 0.14), {
        vertexColors: true, rough: 0.58, metal: 0.42,
      })));
    }
    if (ceilGeo.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(ceilGeo), surface(structural(pal.ceiling, 0.062), {
        vertexColors: true, rough: 0.95, metal: 0.02,
      })));
    }
    if (wallGeo.length) {
      const mat = wire
        ? new THREE.MeshBasicMaterial({ color: pal.wall, wireframe: true, vertexColors: true })
        : surface(structural(pal.wall, 0.165), { vertexColors: true, rough: 0.74, metal: 0.16 });
      const mesh = new THREE.Mesh(mergeGeometries(wallGeo), mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.wallMesh = mesh;
    }
    if (seamGeo.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(seamGeo), surface(structural(pal.wall, 0.03), {
        vertexColors: true, rough: 0.95, metal: 0.2,
      })));
    }
    if (trimGeo.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(trimGeo), new THREE.MeshBasicMaterial({
        color: pal.trim, vertexColors: true, transparent: true, opacity: 0.92,
      })));
    }
    if (decalGeo.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(decalGeo), new THREE.MeshBasicMaterial({
        color: pal.trim, transparent: true, opacity: 0.22, depthWrite: false,
      })));
    }
  }

  // -- doorways, columns, ceiling beams -----------------------------------

  _buildArchitecture() {
    const pal = this.cfg.palette;
    const open = (x, z) => !this.isSolidCell(x, z);
    const solidParts = [], glowParts = [];
    const push = (arr, geo, o, sh) => arr.push(paint(xform(geo, o), sh));

    // Door frames wherever an open cell is pinched between two walls — that is
    // exactly where a corridor meets a room, without needing to track it.
    for (let cz = 1; cz < GRID - 1; cz++) {
      for (let cx = 1; cx < GRID - 1; cx++) {
        if (!open(cx, cz)) continue;
        const ew = !open(cx - 1, cz), ee = !open(cx + 1, cz);
        const nn = !open(cx, cz - 1), ns = !open(cx, cz + 1);
        const horiz = ew && ee && open(cx, cz - 1) && open(cx, cz + 1);
        const vert = nn && ns && open(cx - 1, cz) && open(cx + 1, cz);
        if (!horiz && !vert) continue;
        // Only the middle of a run, so a 3-wide corridor gets one frame.
        if (horiz && !(open(cx, cz - 1) && !open(cx - 1, cz - 1))) { /* keep */ }
        const x = this.cellToWorldX(cx) + CELL / 2;
        const z = this.cellToWorldZ(cz) + CELL / 2;
        const ry = horiz ? 0 : Math.PI / 2;
        const half = CELL / 2;
        for (const s of [-1, 1]) {
          push(solidParts, UNIT.box, {
            x: x + (horiz ? s * half : 0), y: WALL_H / 2, z: z + (horiz ? 0 : s * half),
            ry, sx: horiz ? 0.3 : CELL * 1.02, sy: WALL_H, sz: horiz ? CELL * 1.02 : 0.3,
          }, 0.7);
        }
        push(solidParts, UNIT.box, {
          x, y: WALL_H - 0.42, z, sx: horiz ? CELL * 1.05 : CELL * 1.05, sy: 0.7, sz: CELL * 1.05,
        }, 0.85);
        push(glowParts, UNIT.box, {
          x, y: WALL_H - 0.78, z,
          sx: horiz ? CELL * 0.9 : 0.09, sy: 0.07, sz: horiz ? 0.09 : CELL * 0.9,
        }, 1);
      }
    }

    // Ceiling beams across rooms, and hanging conduits along their length.
    for (const room of this.rooms) {
      const spanX = room.w >= room.h;
      const count = Math.max(1, Math.floor((spanX ? room.h : room.w) / 4));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        if (spanX) {
          const z = this.cellToWorldZ(room.z + t * room.h);
          const x = this.cellToWorldX(room.cx);
          push(solidParts, UNIT.box, {
            x, y: WALL_H - 0.22, z, sx: room.w * CELL * 0.98, sy: 0.34, sz: 0.44,
          }, 0.72);
          push(solidParts, UNIT.lowCyl, {
            x, y: WALL_H - 0.55, z, rz: Math.PI / 2, sx: 0.16, sy: room.w * CELL * 0.8, sz: 0.16,
          }, 0.6);
        } else {
          const x = this.cellToWorldX(room.x + t * room.w);
          const z = this.cellToWorldZ(room.cz);
          push(solidParts, UNIT.box, {
            x, y: WALL_H - 0.22, z, sx: 0.44, sy: 0.34, sz: room.h * CELL * 0.98,
          }, 0.72);
          push(solidParts, UNIT.lowCyl, {
            x, y: WALL_H - 0.55, z, rx: Math.PI / 2, sx: 0.16, sy: room.h * CELL * 0.8, sz: 0.16,
          }, 0.6);
        }
      }

      // Corner columns in the larger rooms.
      if (room.w * room.h >= 90) {
        const inset = 1.4;
        for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const x = this.cellToWorldX(room.cx + sx * (room.w / 2 - inset));
          const z = this.cellToWorldZ(room.cz + sz * (room.h / 2 - inset));
          if (this.isSolidAt(x, z)) continue;
          push(solidParts, UNIT.lowCyl, { x, y: WALL_H / 2, z, sx: 0.6, sy: WALL_H, sz: 0.6 }, 0.78);
          push(solidParts, UNIT.lowCyl, { x, y: 0.2, z, sx: 0.9, sy: 0.4, sz: 0.9 }, 0.6);
          push(solidParts, UNIT.lowCyl, { x, y: WALL_H - 0.2, z, sx: 0.9, sy: 0.4, sz: 0.9 }, 0.7);
          push(glowParts, UNIT.box, { x, y: 1.5, z, sx: 0.63, sy: 0.06, sz: 0.63 }, 1);
        }
      }
    }

    if (solidParts.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(solidParts), new THREE.MeshStandardMaterial({
        color: structural(pal.wallAccent, 0.2, 0.3), vertexColors: true, flatShading: true,
        roughness: 0.44, metalness: 0.55, envMapIntensity: 0.9,
      })));
    }
    if (glowParts.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(glowParts), new THREE.MeshBasicMaterial({
        color: pal.emissive, vertexColors: true, transparent: true, opacity: 0.9,
      })));
    }
  }

  _buildCeilingLights() {
    const pal = this.cfg.palette;
    const panels = [], housings = [];
    for (const r of this.rooms) {
      const nx = Math.max(1, Math.floor(r.w / 5));
      const nz = Math.max(1, Math.floor(r.h / 5));
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const cx = r.x + (i + 0.5) * (r.w / nx);
          const cz = r.z + (j + 0.5) * (r.h / nz);
          const x = this.cellToWorldX(cx), z = this.cellToWorldZ(cz);
          if (this.isSolidAt(x, z)) continue;
          panels.push(paint(xform(UNIT.plane, {
            x, y: WALL_H - 0.66, z, rx: Math.PI / 2, sx: 2.3, sy: 0.85,
          }), 1));
          housings.push(paint(xform(UNIT.box, {
            x, y: WALL_H - 0.6, z, sx: 2.6, sy: 0.16, sz: 1.15,
          }), 0.75));
          this.lightPoints.push({ x, y: WALL_H - 0.8, z, room: r.id });
        }
      }
    }
    if (panels.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(panels), new THREE.MeshBasicMaterial({
        color: pal.light, transparent: true, opacity: 0.95,
      })));
      this.group.add(new THREE.Mesh(mergeGeometries(housings), new THREE.MeshStandardMaterial({
        color: structural(pal.wallAccent, 0.22, 0.24), vertexColors: true, flatShading: true,
        roughness: 0.36, metalness: 0.68, envMapIntensity: 1.0,
      })));
    }
  }

  /** Open cells that touch a wall, with the outward direction — props look
   *  deliberate when they are installed against something. */
  _wallSpots(room) {
    const spots = [];
    for (let cz = room.z; cz < room.z + room.h; cz++) {
      for (let cx = room.x; cx < room.x + room.w; cx++) {
        if (this.isSolidCell(cx, cz)) continue;
        for (const [dx, dz] of DIRS) {
          if (!this.isSolidCell(cx + dx, cz + dz)) continue;
          spots.push({
            x: this.cellToWorldX(cx) + CELL / 2 - dx * 0.45,
            z: this.cellToWorldZ(cz) + CELL / 2 - dz * 0.45,
            ry: Math.atan2(-dx, -dz),
          });
          break;
        }
      }
    }
    return spots;
  }

  _buildProps() {
    const style = this.cfg.propStyle;
    const pal = this.cfg.palette;
    const rng = this.rng;
    const body = [], accent = [], glow = [], dark = [];

    const B = (arr, o, sh = 1) => arr.push(paint(xform(UNIT.box, o), sh));
    const C = (arr, o, sh = 1) => arr.push(paint(xform(UNIT.lowCyl, o), sh));
    const S = (arr, o, sh = 1) => arr.push(paint(xform(UNIT.lowSphere, o), sh));
    const I = (arr, o, sh = 1) => arr.push(paint(xform(UNIT.icosa, o), sh));
    const N = (arr, o, sh = 1) => arr.push(paint(xform(UNIT.cone, o), sh));

    for (const room of this.rooms) {
      if (room.type === 'spawn') continue;
      const wallSpots = rng.shuffle(this._wallSpots(room));
      const wallCount = Math.min(wallSpots.length, Math.floor((room.w + room.h) / 3.2));
      const freeCount = Math.floor((room.w * room.h) / 42);

      // --- installations against the walls ---
      for (let i = 0; i < wallCount; i++) {
        const s = wallSpots[i];
        const { x, z, ry } = s;
        const fx = Math.sin(ry), fz = Math.cos(ry);   // outward from the wall

        switch (style) {
          case 'racks': {
            const h = rng.range(2.6, 3.4);
            B(body, { x, y: h / 2, z, ry, sx: 1.5, sy: h, sz: 0.75 }, 0.8);
            B(dark, { x: x + fx * 0.4, y: h / 2, z: z + fz * 0.4, ry, sx: 1.34, sy: h - 0.2, sz: 0.06 }, 0.55);
            for (let k = 0; k < 7; k++) {
              const yy = 0.35 + k * (h - 0.6) / 6;
              B(glow, { x: x + fx * 0.44, y: yy, z: z + fz * 0.44, ry, sx: 1.0, sy: 0.045, sz: 0.03 }, 1);
              if (rng.chance(0.45)) {
                B(glow, { x: x + fx * 0.44 - fz * 0.55, y: yy, z: z + fz * 0.44 + fx * 0.55, ry, sx: 0.07, sy: 0.07, sz: 0.03 }, 1);
              }
            }
            B(accent, { x, y: h + 0.12, z, ry, sx: 1.6, sy: 0.2, sz: 0.85 }, 0.75);
            break;
          }
          case 'crates': {
            const stack = rng.int(1, 3);
            for (let k = 0; k < stack; k++) {
              const sz = rng.range(0.85, 1.25);
              B(body, { x: x + (rng() - 0.5) * 0.3, y: sz / 2 + k * sz, z: z + (rng() - 0.5) * 0.3, ry: ry + rng.range(-0.3, 0.3), sx: sz, sy: sz, sz }, 0.85);
              B(accent, { x, y: sz * 0.5 + k * sz, z: z + fz * 0.01, ry, sx: sz * 1.02, sy: 0.09, sz: sz * 1.02 }, 0.7);
            }
            if (rng.chance(0.3)) B(glow, { x: x + fx * 0.5, y: 0.9, z: z + fz * 0.5, ry, sx: 0.26, sy: 0.16, sz: 0.02 }, 1);
            break;
          }
          case 'signs': {
            const h = rng.range(2.4, 3.8);
            C(dark, { x, y: h / 2, z, sx: 0.14, sy: h, sz: 0.14 }, 0.45);
            const w = rng.range(1.3, 2.8), sh2 = rng.range(0.55, 1.2);
            B(dark, { x: x + fx * 0.12, y: h, z: z + fz * 0.12, ry, sx: w, sy: sh2, sz: 0.1 }, 0.4);
            B(glow, { x: x + fx * 0.2, y: h, z: z + fz * 0.2, ry, sx: w - 0.16, sy: sh2 - 0.14, sz: 0.03 }, 1);
            // tube outline
            B(glow, { x: x + fx * 0.22, y: h + sh2 / 2 - 0.05, z: z + fz * 0.22, ry, sx: w, sy: 0.06, sz: 0.03 }, 1);
            B(glow, { x: x + fx * 0.22, y: h - sh2 / 2 + 0.05, z: z + fz * 0.22, ry, sx: w, sy: 0.06, sz: 0.03 }, 1);
            break;
          }
          case 'tanks': {
            const h = rng.range(2.2, 3.2);
            C(dark, { x, y: 0.16, z, sx: 1.9, sy: 0.32, sz: 1.9 }, 0.5);
            C(glow, { x, y: h / 2 + 0.2, z, sx: 1.5, sy: h, sz: 1.5 }, 0.55);
            C(accent, { x, y: h + 0.3, z, sx: 1.85, sy: 0.28, sz: 1.85 }, 0.8);
            C(dark, { x, y: h * 0.5, z, sx: 1.56, sy: h * 0.9, sz: 0.12 }, 0.5);
            for (let k = 0; k < 3; k++) {
              S(glow, { x: x + rng.range(-0.4, 0.4), y: 0.7 + k * 0.7, z: z + rng.range(-0.4, 0.4), sx: 0.18, sy: 0.18, sz: 0.18 }, 1);
            }
            C(dark, { x: x + fx * 0.9, y: h + 0.6, z: z + fz * 0.9, rx: Math.PI / 2, sx: 0.16, sy: 1.6, sz: 0.16 }, 0.45);
            break;
          }
          case 'furnace': {
            const h = rng.range(1.8, 2.6);
            B(body, { x, y: h / 2, z, ry, sx: 2.0, sy: h, sz: 1.0 }, 0.8);
            B(dark, { x: x + fx * 0.52, y: h * 0.45, z: z + fz * 0.52, ry, sx: 1.1, sy: h * 0.5, sz: 0.08 }, 0.35);
            B(glow, { x: x + fx * 0.56, y: h * 0.45, z: z + fz * 0.56, ry, sx: 0.95, sy: h * 0.4, sz: 0.03 }, 1);
            for (let k = 0; k < 4; k++) {
              B(dark, { x: x + fx * 0.58, y: h * 0.25 + k * h * 0.13, z: z + fz * 0.58, ry, sx: 1.0, sy: 0.05, sz: 0.03 }, 0.3);
            }
            C(accent, { x: x - fx * 0.2, y: h + 1.1, z: z - fz * 0.2, sx: 0.4, sy: 2.2, sz: 0.4 }, 0.6);
            break;
          }
          case 'abandoned': {
            const roll = rng();
            if (roll < 0.35) {
              // desk + dead terminal
              B(body, { x, y: 0.72, z, ry, sx: 1.7, sy: 0.1, sz: 0.9 }, 0.8);
              for (const [ox, oz] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) {
                B(dark, { x: x + ox * Math.cos(ry) - oz * Math.sin(ry), y: 0.36, z: z + ox * Math.sin(ry) + oz * Math.cos(ry), sx: 0.09, sy: 0.72, sz: 0.09 }, 0.5);
              }
              B(dark, { x, y: 1.06, z, ry, sx: 0.95, sy: 0.6, sz: 0.09 }, 0.45);
              if (rng.chance(0.35)) B(glow, { x: x + fx * 0.06, y: 1.06, z: z + fz * 0.06, ry, sx: 0.82, sy: 0.46, sz: 0.02 }, 1);
            } else if (roll < 0.6) {
              // hanging curtain — somebody made this place a home
              const w = rng.range(1.4, 2.4);
              B(body, { x: x + fx * 0.1, y: WALL_H - 1.5, z: z + fz * 0.1, ry, sx: w, sy: 2.6, sz: 0.06 }, 0.65);
              B(accent, { x: x + fx * 0.1, y: WALL_H - 0.25, z: z + fz * 0.1, ry, sx: w + 0.2, sy: 0.1, sz: 0.12 }, 0.8);
            } else if (roll < 0.82) {
              // toppled chair
              B(body, { x, y: 0.22, z, ry, rz: 1.3, sx: 0.55, sy: 0.1, sz: 0.55 }, 0.75);
              B(dark, { x: x + 0.25, y: 0.5, z, ry, sx: 0.1, sy: 0.6, sz: 0.5 }, 0.5);
            } else {
              // stacked crates of somebody's things
              B(body, { x, y: 0.4, z, ry, sx: 1.0, sy: 0.8, sz: 0.7 }, 0.8);
              B(accent, { x, y: 0.84, z, ry, sx: 1.05, sy: 0.08, sz: 0.75 }, 0.65);
            }
            break;
          }
          case 'garden': {
            const h = rng.range(1.6, 3.2);
            C(dark, { x, y: 0.22, z, sx: 1.5, sy: 0.44, sz: 1.5 }, 0.55);
            C(body, { x, y: h / 2, z, rz: rng.range(-0.12, 0.12), sx: 0.24, sy: h, sz: 0.24 }, 0.8);
            for (let k = 0; k < 5; k++) {
              const a = rng() * Math.PI * 2, rr = rng.range(0.3, 0.85);
              I(glow, {
                x: x + Math.cos(a) * rr, y: h * rng.range(0.5, 1.05), z: z + Math.sin(a) * rr,
                sx: 0.3, sy: 0.42, sz: 0.3, rz: rng.range(-0.5, 0.5),
              }, 1);
              N(body, {
                x: x + Math.cos(a) * rr * 0.6, y: h * 0.6, z: z + Math.sin(a) * rr * 0.6,
                sx: 0.5, sy: 0.9, sz: 0.12, rz: a,
              }, 0.7);
            }
            break;
          }
          case 'circuit': {
            const w = rng.range(1.6, 3.0);
            B(body, { x, y: 0.14, z, ry, sx: w, sy: 0.28, sz: w * 0.7 }, 0.8);
            for (let k = 0; k < 4; k++) {
              B(dark, { x: x + rng.range(-w / 3, w / 3), y: 0.34, z: z + rng.range(-w / 4, w / 4), ry, sx: 0.3, sy: 0.14, sz: 0.3 }, 0.45);
            }
            B(glow, { x, y: 0.3, z, ry, sx: w * 0.9, sy: 0.02, sz: 0.06 }, 1);
            B(glow, { x, y: 0.3, z, ry, sx: 0.06, sy: 0.02, sz: w * 0.6 }, 1);
            C(accent, { x, y: 1.1, z, sx: 0.2, sy: 1.9, sz: 0.2 }, 0.7);
            S(glow, { x, y: 2.1, z, sx: 0.3, sy: 0.3, sz: 0.3 }, 1);
            break;
          }
          case 'mirrors': {
            const h = rng.range(2.6, 3.6);
            B(accent, { x: x + fx * 0.06, y: h / 2, z: z + fz * 0.06, ry, sx: 1.9, sy: h, sz: 0.12 }, 0.9);
            B(glow, { x: x + fx * 0.14, y: h / 2, z: z + fz * 0.14, ry, sx: 1.72, sy: h - 0.18, sz: 0.03 }, 0.35);
            B(accent, { x: x + fx * 0.16, y: h / 2, z: z + fz * 0.16, ry, rz: rng.range(-0.4, 0.4), sx: 0.05, sy: h, sz: 0.02 }, 1);
            break;
          }
          default: { // 'void'
            const h = rng.range(0.8, 3.2);
            I(glow, { x, y: h, z, ry, sx: rng.range(0.4, 1.1), sy: rng.range(0.4, 1.1), sz: rng.range(0.4, 1.1) }, 1);
            B(dark, { x, y: h, z, ry, sx: 2.2, sy: 0.02, sz: 0.02 }, 0.8);
            break;
          }
        }
      }

      // --- a few free-standing pieces so the middle isn't bare ---
      for (let i = 0; i < freeCount; i++) {
        const p = this.randomPointIn(room, rng, 3);
        const ry = rng() * Math.PI * 2;
        if (style === 'void') {
          I(glow, { x: p.x, y: rng.range(1, 3.4), z: p.z, ry, sx: rng.range(0.3, 0.8), sy: rng.range(0.3, 0.8), sz: rng.range(0.3, 0.8) }, 1);
        } else if (style === 'garden') {
          for (let k = 0; k < 3; k++) {
            C(body, { x: p.x + rng.range(-0.5, 0.5), y: rng.range(0.3, 0.7), z: p.z + rng.range(-0.5, 0.5), sx: 0.1, sy: rng.range(0.6, 1.4), sz: 0.1, rz: rng.range(-0.3, 0.3) }, 0.7);
          }
        } else {
          // low debris — reads as cover without blocking movement
          B(dark, { x: p.x, y: 0.14, z: p.z, ry, sx: rng.range(0.5, 1.2), sy: 0.28, sz: rng.range(0.5, 1.2) }, 0.6);
        }
      }
    }

    // Cables slung under the ceiling in corridors.
    for (const room of this.rooms) {
      if (rng.chance(0.5)) continue;
      const p = this.randomPointIn(room, rng, 2);
      const len = rng.range(3, 8);
      const ry = rng() * Math.PI * 2;
      C(dark, { x: p.x, y: WALL_H - 0.85, z: p.z, ry, rx: Math.PI / 2, sx: 0.07, sy: len, sz: 0.07 }, 0.4);
      C(dark, { x: p.x + 0.2, y: WALL_H - 1.0, z: p.z, ry: ry + 0.2, rx: Math.PI / 2, sx: 0.05, sy: len * 0.8, sz: 0.05 }, 0.35);
    }

    this._dressCorridors(body, accent, glow, dark, rng);

    const add = (arr, mat) => { if (arr.length) this.decorGroup.add(new THREE.Mesh(mergeGeometries(arr), mat)); };
    // Props are where the floor's colour is allowed to live: painted equipment
    // against neutral concrete, rather than concrete that happens to be green.
    add(body, surface(structural(pal.wallAccent, 0.19, 0.55), {
      vertexColors: true, flatShading: true, rough: 0.55, metal: 0.4, envMapIntensity: 0.9,
    }));
    add(accent, surface(structural(pal.trim, 0.3, 0.75), {
      vertexColors: true, flatShading: true, rough: 0.3, metal: 0.85, envMapIntensity: 1.2,
    }));
    add(dark, surface(structural(pal.wall, 0.07, 0.35), {
      vertexColors: true, flatShading: true, rough: 0.86, metal: 0.25, envMapIntensity: 0.6,
    }));
    add(glow, new THREE.MeshBasicMaterial({
      color: pal.emissive, vertexColors: true, transparent: true, opacity: 0.92,
    }));
  }
  /**
   * Dress the corridors.
   *
   * All the detail lived inside rooms, and the corridors — which are a third
   * of the floor by area and most of the time between fights — were bare
   * tunnels. A corridor does not need furniture; it needs the things a real
   * one accumulates: cable trays, junction boxes, wayfinding paint, a stencil
   * on the wall, a dropped crate somebody never came back for.
   *
   * These are placed by walking the grid for open cells that are *not* inside
   * any room, so they never fight with a room's own prop budget.
   */
  _dressCorridors(body, accent, glow, dark, rng) {
    const B = (arr, o, sh = 1) => arr.push(paint(xform(UNIT.box, o), sh));
    const C2 = (arr, o, sh = 1) => arr.push(paint(xform(UNIT.lowCyl, o), sh));

    // Which cells belong to a room? Everything else open is corridor.
    const inRoom = new Uint8Array(GRID * GRID);
    for (const r of this.rooms) {
      for (let z = r.z; z < r.z + r.h; z++) {
        for (let x = r.x; x < r.x + r.w; x++) inRoom[x + z * GRID] = 1;
      }
    }

    let placed = 0;
    for (let cz = 1; cz < GRID - 1; cz++) {
      for (let cx = 1; cx < GRID - 1; cx++) {
        const i = cx + cz * GRID;
        if (this.grid[i] === 1 || inRoom[i]) continue;
        const x = this.cellToWorldX(cx) + CELL / 2;
        const z = this.cellToWorldZ(cz) + CELL / 2;

        // Which side has a wall? Props go against it, not in the middle.
        let wallDir = null;
        for (const [dx, dz] of DIRS) {
          if (this.isSolidCell(cx + dx, cz + dz)) { wallDir = [dx, dz]; break; }
        }

        const h = this._cellHash(cx, cz, 91);

        // Cable tray along the ceiling of every corridor run — continuous, so
        // it reads as infrastructure going somewhere rather than as clutter.
        if (h < 0.55) {
          const along = this.isSolidCell(cx - 1, cz) || this.isSolidCell(cx + 1, cz);
          B(dark, {
            x, y: WALL_H - 0.62, z, ry: along ? 0 : Math.PI / 2,
            sx: 0.34, sy: 0.1, sz: CELL * 1.02,
          }, 0.5);
          for (let k = 0; k < 3; k++) {
            C2(dark, {
              x: x + (along ? 0 : (k - 1) * 0.1), y: WALL_H - 0.7,
              z: z + (along ? (k - 1) * 0.1 : 0),
              ry: along ? 0 : Math.PI / 2, rx: Math.PI / 2,
              sx: 0.05, sy: CELL * 1.02, sz: 0.05,
            }, 0.4);
          }
        }

        // Floor guidance paint: a dashed centre line the whole Pod shares.
        if (h > 0.2 && h < 0.72) {
          const along = this.isSolidCell(cx - 1, cz) || this.isSolidCell(cx + 1, cz);
          B(glow, {
            x, y: 0.03, z, ry: along ? 0 : Math.PI / 2,
            sx: 0.09, sy: 0.01, sz: CELL * 0.5,
          }, 0.5);
        }

        if (!wallDir) continue;
        const [dx, dz] = wallDir;
        const wx = x + dx * (CELL * 0.42), wz = z + dz * (CELL * 0.42);
        const ry = Math.atan2(dx, dz);

        // One item per cell at most, and only on about a fifth of them.
        if (h > 0.955) {
          // Junction box with a status lamp.
          B(body, { x: wx, y: 1.5, z: wz, ry, sx: 0.5, sy: 0.62, sz: 0.22 }, 0.85);
          B(accent, { x: wx - dx * 0.1, y: 1.5, z: wz - dz * 0.1, ry, sx: 0.44, sy: 0.1, sz: 0.06 }, 0.7);
          B(glow, { x: x + -dx * 0.28, y: 1.72, z: z + -dz * 0.28, ry, sx: 0.1, sy: 0.06, sz: 0.02 }, 1);
          C2(dark, { x: wx, y: 0.9, z: wz, sx: 0.06, sy: 1.0, sz: 0.06 }, 0.4);
          placed++;
        } else if (h > 0.93) {
          // Wall stencil — a number and an arrow, in trim paint.
          B(glow, { x: x - dx * 0.42, y: 1.7, z: z - dz * 0.42, ry, sx: 0.42, sy: 0.05, sz: 0.02 }, 0.55);
          B(glow, { x: x - dx * 0.42, y: 1.52, z: z - dz * 0.42, ry, sx: 0.26, sy: 0.05, sz: 0.02 }, 0.55);
          B(glow, { x: x - dx * 0.42, y: 1.9, z: z - dz * 0.42, ry, sx: 0.14, sy: 0.14, sz: 0.02 }, 0.4);
          placed++;
        } else if (h > 0.9) {
          // A crate somebody set down and did not come back for.
          const sc = 0.7 + this._cellHash(cx, cz, 93) * 0.4;
          B(body, { x: wx, y: sc * 0.5, z: wz, ry: ry + rng.range(-0.4, 0.4), sx: sc, sy: sc, sz: sc }, 0.8);
          B(accent, { x: wx, y: sc * 0.5, z: wz, ry, sx: sc * 1.02, sy: 0.07, sz: sc * 1.02 }, 0.6);
          placed++;
        } else if (h > 0.88) {
          // Standpipe with a valve wheel.
          C2(dark, { x: wx, y: WALL_H / 2, z: wz, sx: 0.16, sy: WALL_H, sz: 0.16 }, 0.45);
          C2(accent, { x: wx, y: 1.3, z: wz, sx: 0.34, sy: 0.08, sz: 0.34 }, 0.8);
          C2(accent, { x: wx, y: 2.9, z: wz, sx: 0.22, sy: 0.1, sz: 0.22 }, 0.7);
          placed++;
        } else if (h > 0.865) {
          // Emergency light in a cage, pointing down the corridor.
          B(dark, { x: wx, y: 2.7, z: wz, ry, sx: 0.3, sy: 0.24, sz: 0.2 }, 0.4);
          B(glow, { x: x - dx * 0.3, y: 2.7, z: z - dz * 0.3, ry, sx: 0.22, sy: 0.16, sz: 0.02 }, 1);
          for (let k = 0; k < 3; k++) {
            B(dark, { x: x - dx * 0.28, y: 2.62 + k * 0.08, z: z - dz * 0.28, ry, sx: 0.24, sy: 0.02, sz: 0.03 }, 0.3);
          }
          placed++;
        }
        if (placed > 260) return;   // a budget, so a big floor cannot run away
      }
    }
  }

  dispose() {
    disposeTree(this.group);
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
