// Floor layout generation and mesh construction.
//
// The plan lives on a coarse tile grid: rooms and corridors carve open cells out
// of a solid block. Collision is a grid lookup, which makes doorways, pillars and
// odd room shapes all behave identically without any special-case geometry.

import * as THREE from '../../vendor/three.module.js';
import { UNIT, xform, mergeGeometries, disposeTree } from './geometry.js';
import { clamp } from '../core/util.js';

export const CELL = 2.4;
export const WALL_H = 4.6;
export const GRID = 112;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

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
    const pal = this.cfg.palette;
    const grid = this.grid;
    const open = (x, z) => x >= 0 && z >= 0 && x < GRID && z < GRID && grid[x + z * GRID] === 0;

    const floorA = [], floorB = [], ceil = [], wallMatrices = [], trims = [];

    for (let cz = 0; cz < GRID; cz++) {
      for (let cx = 0; cx < GRID; cx++) {
        const wx = this.cellToWorldX(cx) + CELL / 2;
        const wz = this.cellToWorldZ(cz) + CELL / 2;
        if (open(cx, cz)) {
          const tile = xform(UNIT.plane, { x: wx, y: 0, z: wz, rx: -Math.PI / 2, sx: CELL, sy: CELL });
          ((cx + cz) & 1 ? floorA : floorB).push(tile);
          ceil.push(xform(UNIT.plane, { x: wx, y: WALL_H, z: wz, rx: Math.PI / 2, sx: CELL, sy: CELL }));
        } else {
          // Only build wall blocks that actually face open space.
          let exposed = false;
          for (let j = -1; j <= 1 && !exposed; j++) {
            for (let i = -1; i <= 1; i++) {
              if ((i || j) && open(cx + i, cz + j)) { exposed = true; break; }
            }
          }
          if (!exposed) continue;
          const m = new THREE.Matrix4();
          m.makeScale(CELL, WALL_H, CELL);
          m.setPosition(wx, WALL_H / 2, wz);
          wallMatrices.push(m);

          // Emissive skirting on faces that touch a walkable tile.
          for (const [dx, dz] of DIRS) {
            if (!open(cx + dx, cz + dz)) continue;
            const ox = dx * (CELL / 2 + 0.02), oz = dz * (CELL / 2 + 0.02);
            trims.push(xform(UNIT.box, {
              x: wx + ox, y: 0.14, z: wz + oz,
              sx: dx ? 0.06 : CELL, sy: 0.1, sz: dz ? 0.06 : CELL,
            }));
            trims.push(xform(UNIT.box, {
              x: wx + ox, y: WALL_H - 0.22, z: wz + oz,
              sx: dx ? 0.06 : CELL, sy: 0.06, sz: dz ? 0.06 : CELL,
            }));
          }
        }
      }
    }

    // A touch of self-illumination keeps surfaces from crushing to pure black in
    // the fog — the Pod is a screen-lit place, not a cave.
    const _c = new THREE.Color();
    const selfLit = (hex, amount = 0.22) => _c.setHex(hex).multiplyScalar(amount).getHex();
    const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({
      color, emissive: selfLit(color), ...extra,
    });

    if (floorA.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(floorA), lambert(pal.floor)));
    }
    if (floorB.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(floorB), lambert(pal.floorAccent)));
    }
    if (ceil.length) {
      this.group.add(new THREE.Mesh(mergeGeometries(ceil), lambert(pal.ceiling)));
    }
    if (trims.length) {
      this.group.add(new THREE.Mesh(
        mergeGeometries(trims),
        new THREE.MeshBasicMaterial({ color: pal.trim, transparent: true, opacity: 0.75 }),
      ));
    }

    if (wallMatrices.length) {
      const wallMat = this.cfg.palette.wireframe
        ? new THREE.MeshBasicMaterial({ color: pal.wall, wireframe: true })
        : new THREE.MeshLambertMaterial({
          color: pal.wall, emissive: selfLit(pal.wall, 0.3), flatShading: true,
        });
      // Clone the shared unit box — this mesh is disposed on floor change, and
      // disposing the cached primitive would drag every other user down with it.
      const inst = new THREE.InstancedMesh(UNIT.box.clone(), wallMat, wallMatrices.length);
      const col = new THREE.Color();
      const base = new THREE.Color(pal.wall);
      const accent = new THREE.Color(pal.wallAccent);
      for (let i = 0; i < wallMatrices.length; i++) {
        inst.setMatrixAt(i, wallMatrices[i]);
        col.copy(base).lerp(accent, this.rng() * 0.75);
        inst.setColorAt(i, col);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.frustumCulled = false;
      this.group.add(inst);
      this.wallMesh = inst;
    }

    this._buildCeilingLights();
    this._buildProps();
  }

  _buildCeilingLights() {
    const pal = this.cfg.palette;
    const panels = [];
    for (const r of this.rooms) {
      const nx = Math.max(1, Math.floor(r.w / 5));
      const nz = Math.max(1, Math.floor(r.h / 5));
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const cx = r.x + (i + 0.5) * (r.w / nx);
          const cz = r.z + (j + 0.5) * (r.h / nz);
          const wx = this.cellToWorldX(cx), wz = this.cellToWorldZ(cz);
          if (this.isSolidAt(wx, wz)) continue;
          panels.push(xform(UNIT.plane, {
            x: wx, y: WALL_H - 0.06, z: wz, rx: Math.PI / 2, sx: 2.4, sy: 1.0,
          }));
          this.lightPoints.push({ x: wx, y: WALL_H - 0.5, z: wz, room: r.id });
        }
      }
    }
    if (panels.length) {
      const mesh = new THREE.Mesh(
        mergeGeometries(panels),
        new THREE.MeshBasicMaterial({ color: pal.light, transparent: true, opacity: 0.9 }),
      );
      this.group.add(mesh);
    }
  }

  _buildProps() {
    const style = this.cfg.propStyle;
    const pal = this.cfg.palette;
    const rng = this.rng;
    const solid = [], glow = [];

    const pushBox = (arr, o) => arr.push(xform(UNIT.box, o));
    const pushCyl = (arr, o) => arr.push(xform(UNIT.lowCyl, o));

    for (const room of this.rooms) {
      if (room.type === 'spawn') continue;
      const count = Math.floor((room.w * room.h) / 26) + rng.int(0, 2);
      for (let i = 0; i < count; i++) {
        const p = this.randomPointIn(room, rng, 2);
        const rot = rng() * Math.PI * 2;
        switch (style) {
          case 'crates': {
            const s = rng.range(0.9, 1.5);
            pushBox(solid, { x: p.x, y: s / 2, z: p.z, ry: rot, sx: s, sy: s, sz: s });
            if (rng.chance(0.4)) pushBox(solid, { x: p.x + 0.2, y: s + s * 0.35, z: p.z, ry: rot + 0.4, sx: s * 0.7, sy: s * 0.7, sz: s * 0.7 });
            break;
          }
          case 'racks': {
            const h = rng.range(2.4, 3.4);
            pushBox(solid, { x: p.x, y: h / 2, z: p.z, ry: rot, sx: 0.8, sy: h, sz: 2.2 });
            for (let k = 0; k < 5; k++) {
              glow.push(xform(UNIT.box, { x: p.x + Math.sin(rot) * 0.42, y: 0.5 + k * (h / 6), z: p.z + Math.cos(rot) * 0.42, ry: rot, sx: 0.05, sy: 0.06, sz: 1.6 }));
            }
            break;
          }
          case 'signs': {
            const h = rng.range(2.2, 3.6);
            pushCyl(solid, { x: p.x, y: h / 2, z: p.z, sx: 0.16, sy: h, sz: 0.16 });
            glow.push(xform(UNIT.box, { x: p.x, y: h, z: p.z, ry: rot, sx: rng.range(1.2, 2.6), sy: rng.range(0.5, 1.1), sz: 0.08 }));
            break;
          }
          case 'tanks': {
            const h = rng.range(2, 3.2);
            pushCyl(solid, { x: p.x, y: h / 2, z: p.z, sx: 1.5, sy: h, sz: 1.5 });
            glow.push(xform(UNIT.lowCyl, { x: p.x, y: h + 0.1, z: p.z, sx: 1.55, sy: 0.12, sz: 1.55 }));
            break;
          }
          case 'furnace': {
            const s = rng.range(1.2, 2);
            pushBox(solid, { x: p.x, y: s / 2, z: p.z, ry: rot, sx: s, sy: s, sz: s * 0.8 });
            glow.push(xform(UNIT.box, { x: p.x + Math.sin(rot) * (s * 0.42), y: s * 0.5, z: p.z + Math.cos(rot) * (s * 0.42), ry: rot, sx: s * 0.5, sy: s * 0.35, sz: 0.06 }));
            break;
          }
          case 'abandoned': {
            if (rng.chance(0.5)) {
              pushBox(solid, { x: p.x, y: 0.4, z: p.z, ry: rot, rz: rng.range(-0.3, 0.3), sx: 1.6, sy: 0.8, sz: 0.9 });
            } else {
              pushBox(solid, { x: p.x, y: 0.45, z: p.z, ry: rot, sx: 0.7, sy: 0.9, sz: 0.7 });
              glow.push(xform(UNIT.box, { x: p.x, y: 0.95, z: p.z, ry: rot, sx: 0.4, sy: 0.03, sz: 0.3 }));
            }
            break;
          }
          case 'circuit': {
            const h = rng.range(0.3, 0.8);
            pushBox(solid, { x: p.x, y: h / 2, z: p.z, ry: rot, sx: rng.range(1.5, 3), sy: h, sz: rng.range(1.5, 3) });
            glow.push(xform(UNIT.box, { x: p.x, y: h + 0.03, z: p.z, ry: rot, sx: 0.12, sy: 0.03, sz: rng.range(1.5, 3) }));
            glow.push(xform(UNIT.box, { x: p.x, y: h + 0.03, z: p.z, ry: rot, sx: rng.range(1.5, 3), sy: 0.03, sz: 0.12 }));
            break;
          }
          case 'garden': {
            const h = rng.range(1.2, 2.6);
            pushCyl(solid, { x: p.x, y: h / 2, z: p.z, sx: 0.3, sy: h, sz: 0.3 });
            for (let k = 0; k < 4; k++) {
              const a = rot + k * 1.57;
              glow.push(xform(UNIT.icosa, { x: p.x + Math.cos(a) * 0.5, y: h - rng.range(0, 0.6), z: p.z + Math.sin(a) * 0.5, sx: 0.4, sy: 0.4, sz: 0.4 }));
            }
            break;
          }
          case 'mirrors': {
            const h = rng.range(2.4, 3.6);
            pushBox(solid, { x: p.x, y: h / 2, z: p.z, ry: rot, sx: 1.8, sy: h, sz: 0.14 });
            glow.push(xform(UNIT.box, { x: p.x, y: h / 2, z: p.z, ry: rot, sx: 1.9, sy: 0.06, sz: 0.16 }));
            break;
          }
          case 'vault': {
            const s = rng.range(1, 1.8);
            pushBox(solid, { x: p.x, y: s / 2, z: p.z, ry: rot, sx: s * 1.4, sy: s, sz: s });
            glow.push(xform(UNIT.torus, { x: p.x + Math.sin(rot) * (s * 0.52), y: s * 0.55, z: p.z + Math.cos(rot) * (s * 0.52), ry: rot, sx: s * 0.7, sy: s * 0.7, sz: s * 0.7 }));
            break;
          }
          default: { // 'void'
            glow.push(xform(UNIT.octa, { x: p.x, y: rng.range(0.6, 2.8), z: p.z, ry: rot, sx: rng.range(0.4, 1.2), sy: rng.range(0.4, 1.2), sz: rng.range(0.4, 1.2) }));
            break;
          }
        }
      }
    }

    if (solid.length) {
      const c = new THREE.Color(pal.wallAccent);
      this.decorGroup.add(new THREE.Mesh(
        mergeGeometries(solid),
        new THREE.MeshLambertMaterial({
          color: pal.wallAccent, emissive: c.clone().multiplyScalar(0.24).getHex(), flatShading: true,
        }),
      ));
    }
    if (glow.length) {
      this.decorGroup.add(new THREE.Mesh(
        mergeGeometries(glow),
        new THREE.MeshBasicMaterial({ color: pal.emissive, transparent: true, opacity: 0.85 }),
      ));
    }
  }

  dispose() {
    disposeTree(this.group);
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
