// Geometry helpers. Only the three.js core is vendored, so the handful of
// addon utilities we need (buffer merging in particular) live here.

import * as THREE from '../../vendor/three.module.js';

/**
 * Merge an array of BufferGeometry into one. All inputs must share the same
 * attribute set; we normalise to position/normal/uv and index everything.
 * A `color` attribute is carried through when any input has one — that's how
 * baked ambient occlusion reaches the level meshes.
 */
export function mergeGeometries(geoms) {
  const kept = geoms.filter((g) => g && g.attributes.position);
  if (!kept.length) return new THREE.BufferGeometry();

  let vertexCount = 0;
  let indexCount = 0;
  let anyColor = false;
  for (const g of kept) {
    vertexCount += g.attributes.position.count;
    indexCount += g.index ? g.index.count : g.attributes.position.count;
    if (g.attributes.color) anyColor = true;
  }

  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const color = anyColor ? new Float32Array(vertexCount * 3).fill(1) : null;
  const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  let vo = 0, io = 0;
  for (const g of kept) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    const c = g.attributes.color;
    position.set(p.array.subarray(0, p.count * 3), vo * 3);
    if (n) normal.set(n.array.subarray(0, n.count * 3), vo * 3);
    if (u) uv.set(u.array.subarray(0, u.count * 2), vo * 2);
    if (color && c) color.set(c.array.subarray(0, c.count * 3), vo * 3);
    if (g.index) {
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) index[io + i] = gi[i] + vo;
      io += gi.length;
    } else {
      for (let i = 0; i < p.count; i++) index[io + i] = i + vo;
      io += p.count;
    }
    vo += p.count;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (color) out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

/**
 * A single quad from four corners (counter-clockwise), with per-corner vertex
 * colours. This is the workhorse for level surfaces: emitting only the faces
 * that are actually visible, each carrying its own baked shading, produces far
 * less geometry and far more depth than boxes ever did.
 */
export function quad(a, b, c, d, colors, uvScale = 1) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array([
    a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
    a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2],
  ]);
  // Flat normal from the first triangle.
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  const nrm = new Float32Array(18);
  for (let i = 0; i < 6; i++) { nrm[i * 3] = nx; nrm[i * 3 + 1] = ny; nrm[i * 3 + 2] = nz; }
  const uvs = new Float32Array([
    0, 0, uvScale, 0, uvScale, uvScale,
    0, 0, uvScale, uvScale, 0, uvScale,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (colors) {
    const [ca, cb, cc, cd] = colors;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array([
      ca, ca, ca, cb, cb, cb, cc, cc, cc,
      ca, ca, ca, cc, cc, cc, cd, cd, cd,
    ]), 3));
  }
  return g;
}

/**
 * Bake an RGB colour into a geometry's vertex colours.
 *
 * This is what lets a whole enemy collapse into three or four draw calls: if
 * colour lives in the vertices, `assemble()` only has to batch by *material
 * class* — how shiny and how rough — instead of by every distinct hex in the
 * model. A detailed model uses twenty colours and about four surfaces.
 */
const _paintCol = new THREE.Color();
export function paintRGB(geo, hex) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  _paintCol.setHex(hex);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = _paintCol.r;
    arr[i * 3 + 1] = _paintCol.g;
    arr[i * 3 + 2] = _paintCol.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Uniform vertex colour on an existing geometry, for merging alongside quads. */
export function paint(geo, shade) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) arr[i] = shade;
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Clone `geo`, apply a TRS transform, and return it ready for merging. */
export function xform(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const g = geo.clone();
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _v.set(x, y, z);
  _s.set(sx, sy, sz);
  _m.compose(_v, _q, _s);
  g.applyMatrix4(_m);
  return g;
}

// Cached unit primitives — cloned + transformed rather than re-tessellated.
export const UNIT = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  sphere: new THREE.SphereGeometry(0.5, 16, 12),
  lowSphere: new THREE.SphereGeometry(0.5, 10, 7),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  lowCyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 12),
  torus: new THREE.TorusGeometry(0.5, 0.14, 10, 20),
  icosa: new THREE.IcosahedronGeometry(0.5, 0),
  octa: new THREE.OctahedronGeometry(0.5, 0),
  tetra: new THREE.TetrahedronGeometry(0.5, 0),

  // Detail primitives. A model reads as "made" rather than "blocked out" mostly
  // because of chamfers, panel gaps and fasteners, so those get first-class
  // shapes instead of being faked with thin boxes.
  bevelBox: bevelledBox(0.09),
  slab: bevelledBox(0.045),
  capsule: THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.5, 1, 5, 12) : new THREE.SphereGeometry(0.5, 12, 8),
  ring: new THREE.TorusGeometry(0.5, 0.06, 8, 22),
  disc: new THREE.CylinderGeometry(0.5, 0.5, 1, 22),
  hex: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  pipe: new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true),
  taper: new THREE.CylinderGeometry(0.5, 0.32, 1, 12),
  wedge: wedgeGeometry(),
  bolt: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
};

// The primitives are a cache: everything that uses one clones it first, so no
// mesh should ever hold one directly. Flagging them stops disposeTree from
// freeing the whole library if something ever does — the particle system
// already shares UNIT.box across its beam pool, and one stray disposal there
// would blank every box in the game with no obvious cause.
for (const geo of Object.values(UNIT)) geo.userData.shared = true;

/** A unit cube with its corners cut — reads as machined rather than extruded. */
function bevelledBox(b) {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    // Pull each corner vertex in slightly along all three axes.
    pos.setXYZ(i,
      pos.getX(i) * (1 - b * 2) + Math.sign(pos.getX(i)) * b,
      pos.getY(i) * (1 - b * 2) + Math.sign(pos.getY(i)) * b,
      pos.getZ(i) * (1 - b * 2) + Math.sign(pos.getZ(i)) * b);
  }
  g.computeVertexNormals();
  return g;
}

/** Right-triangular prism, for tapered armour plates and gun bodies. */
function wedgeGeometry() {
  const g = new THREE.BufferGeometry();
  const v = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5],
  ];
  const tri = [
    [0, 1, 2], [3, 5, 4], [0, 2, 5], [0, 5, 3],
    [1, 4, 5], [1, 5, 2], [0, 3, 4], [0, 4, 1],
  ];
  const pos = [];
  for (const [a, b2, c] of tri) pos.push(...v[a], ...v[b2], ...v[c]);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  return g;
}

/**
 * Build a mesh from a list of `{ geo, color, ...transform }` parts, batching by
 * material so a 120-piece model is still only a handful of draw calls.
 *
 * Surfaces are physically shaded by default. `metal` and `rough` are what make
 * a chrome pauldron, a rubber boot and a wet blob look like different substances
 * instead of three differently-coloured boxes — combine them with the scene's
 * environment map (see render/env.js) and the highlights do most of the work.
 *
 * Per-part options:
 *   metal 0..1   rough 0..1   emissive hex   glow (emissive intensity)
 *   opacity 0..1 basic (unlit) smooth (per-vertex normals instead of flat)
 */
/**
 * Material cache. Two parts that ask for the same surface get the same
 * material object, which lets three.js skip a program and uniform switch
 * between them and keeps the total material count bounded no matter how many
 * models are built over a run.
 */
const _matCache = new Map();

/** Round to a step, so "0.55 rough" and "0.58 rough" are the same material. */
const q = (v, step) => Math.round(v / step) * step;

// A batch below this many triangles is not a surface, it is a rounding error
// with a draw call attached. Twelve triangles is one box; ninety is a handful.
const TINY_BATCH_TRIS = 90;

/**
 * Fold negligible batches into their nearest surviving neighbour.
 *
 * Measuring the cast turned up rig after rig paying a full draw call for
 * twelve triangles: the Neon Punk had two such batches, the Ashwalker two, the
 * Brute three. One box's worth of geometry, at a roughness a quarter-step away
 * from a batch of four thousand triangles it could have joined. Quantising
 * harder would have papered over it at the cost of flattening every surface in
 * the game; this only touches the batches nobody can see.
 *
 * Two rules keep it honest. Emissive and unlit parts never fold — a glowing
 * eye is a handful of triangles *and* the whole point of the model. Neither do
 * parts at a different opacity, because folding a translucent part into an
 * opaque batch does not dim it, it solidifies it. Everything else is fair game:
 * the difference between roughness 0.6 and 0.8 on a single box is not
 * something anyone has ever noticed.
 */
function foldTinyBatches(batches) {
  if (batches.size < 2) return;
  const all = [...batches.values()];
  const foldable = (b) => !b.spec.basic && !b.spec.emissive;
  for (const b of all) {
    if (b.tris >= TINY_BATCH_TRIS || !foldable(b)) continue;
    let best = null, bestCost = Infinity;
    for (const o of all) {
      if (o === b || !batches.has(o.key) || !foldable(o)) continue;
      if (o.tris < b.tris) continue;                    // never fold into a smaller one
      // Transparency is not a shading nuance; it is a different object.
      if (((o.spec.opacity ?? 1) < 1) !== ((b.spec.opacity ?? 1) < 1)) continue;
      const cost = Math.abs((o.spec.metal ?? 0) - (b.spec.metal ?? 0))
        + Math.abs((o.spec.rough ?? 0.8) - (b.spec.rough ?? 0.8))
        // Weight shading agreement heavily. The host's flag wins for the whole
        // merged batch, so folding a box into a smooth batch rounds off its
        // corner shading and folding a sphere into a flat one facets it — both
        // more visible on a small part than a quarter-step of roughness ever is.
        + (o.spec.smooth === b.spec.smooth ? 0 : 0.3);
      if (cost < bestCost) { bestCost = cost; best = o; }
    }
    // A surface a long way from everything else in the model is a deliberate
    // contrast — chrome trim on matte plastic — and stays its own batch.
    if (!best || bestCost > 0.9) continue;
    best.parts.push(...b.parts);
    best.tris += b.tris;
    batches.delete(b.key);
  }
}

export function assemble(parts, { flatShading = true } = {}) {
  const group = new THREE.Group();
  const batches = new Map();
  for (const p of parts) {
    // Quantise the PBR parameters before keying.
    //
    // Keying on exact floats meant every hand-tuned `rough: 0.58` became its
    // own draw call, and the detailed models push twenty to thirty distinct
    // triples each — a single Ashwalker was costing thirty draws. Nobody can
    // see the difference between 0.55 and 0.58 roughness; everybody can see a
    // frame rate. Colour is still exact, because colour is what reads.
    // Colour is deliberately NOT in the key — it goes into the vertices below.
    // Keying on it meant a twenty-colour model cost twenty draw calls, and a
    // single Ashwalker was thirty. Emissive stays in the key because it is a
    // material property with no per-vertex equivalent.
    const key = [
      p.emissive || 0, q(p.glow ?? 1, 0.25), q(p.opacity ?? 1, 0.2),
      p.basic ? 1 : 0, q(p.metal ?? 0, 0.25), q(p.rough ?? 0.8, 0.2),
      p.smooth ? 1 : 0, q(p.envIntensity ?? 1, 0.5),
    ].join('|');
    if (!batches.has(key)) batches.set(key, { parts: [], spec: p, key, tris: 0 });
    const b = batches.get(key);
    b.parts.push(p);
    const g = p.geo || UNIT.box;
    b.tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  }

  foldTinyBatches(batches);

  for (const { parts: ps, spec, key } of batches.values()) {
    const merged = mergeGeometries(ps.map((p) => paintRGB(xform(p.geo || UNIT.box, p), p.color)));
    if (spec.smooth) merged.computeVertexNormals();
    const transparent = (spec.opacity ?? 1) < 1;
    const cacheKey = `${key}|${flatShading ? 1 : 0}`;
    let mat = _matCache.get(cacheKey);
    if (!mat) {
      if (spec.basic) {
        mat = new THREE.MeshBasicMaterial({
          color: 0xffffff, vertexColors: true,
          transparent, opacity: spec.opacity ?? 1,
          toneMapped: spec.toneMapped !== false,
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: 0xffffff, vertexColors: true,
          emissive: spec.emissive || 0x000000,
          emissiveIntensity: q(spec.glow ?? 1, 0.25),
          metalness: q(spec.metal ?? 0, 0.25),
          roughness: q(spec.rough ?? 0.8, 0.2),
          flatShading: spec.smooth ? false : flatShading,
          transparent, opacity: spec.opacity ?? 1,
          envMapIntensity: q(spec.envIntensity ?? 1, 0.5),
        });
      }
      // Shared: disposeTree must not free these, hence the flag it checks.
      mat.userData.shared = true;
      _matCache.set(cacheKey, mat);
    }
    group.add(new THREE.Mesh(merged, mat));
  }
  return group;
}

/**
 * Give a subtree its own copies of every material.
 *
 * The cache above hands the same material object to everything that asks for
 * the same surface, which is exactly right for static geometry — and exactly
 * wrong for anything that *writes* to its material at runtime. The enemy
 * damage flash pushes emissive to white, and ghosts drop their opacity; with
 * shared materials, flashing one Shambler flashes every Shambler on the floor.
 * Anything that mutates its own look calls this once at build time.
 */
export function unshareMaterials(root) {
  const seen = new Map();
  root.traverse((o) => {
    if (!o.material || Array.isArray(o.material)) return;
    if (!o.material.userData?.shared) return;
    let copy = seen.get(o.material);
    if (!copy) {
      copy = o.material.clone();
      copy.userData = { ...o.material.userData, shared: false };
      seen.set(o.material, copy);
    }
    o.material = copy;
  });
  return root;
}

/** Dispose everything under a node so floor transitions don't leak GPU memory. */
export function disposeTree(root) {
  root.traverse((o) => {
    // Geometry gets the same shared flag as materials. It did not before, and
    // the moment anything started reusing one buffer across instances — the
    // contact shadow under every enemy — the first corpse disposed it and every
    // other enemy's shadow vanished.
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        // Cached materials are shared by every model built this session;
        // disposing one here would blank every other mesh using it.
        if (m.userData?.shared) continue;
        for (const k of ['map', 'lightMap', 'aoMap', 'emissiveMap', 'normalMap', 'alphaMap']) {
          if (m[k]) m[k].dispose();
        }
        m.dispose();
      }
    }
  });
}

/** Slightly randomised colour, for variety without new materials. */
export function tint(hex, amount, rand) {
  const c = new THREE.Color(hex);
  const f = 1 + (rand * 2 - 1) * amount;
  c.multiplyScalar(f);
  return c.getHex();
}
