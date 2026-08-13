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
  sphere: new THREE.SphereGeometry(0.5, 12, 8),
  lowSphere: new THREE.SphereGeometry(0.5, 8, 6),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  lowCyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cone: new THREE.ConeGeometry(0.5, 1, 10),
  torus: new THREE.TorusGeometry(0.5, 0.14, 8, 16),
  icosa: new THREE.IcosahedronGeometry(0.5, 0),
  octa: new THREE.OctahedronGeometry(0.5, 0),
  tetra: new THREE.TetrahedronGeometry(0.5, 0),
};

/** Build a mesh from a list of {geo, color, ...transform} parts, grouped by colour. */
export function assemble(parts, { material = 'lambert', flatShading = true } = {}) {
  const group = new THREE.Group();
  const byColor = new Map();
  for (const p of parts) {
    const key = `${p.color}|${p.emissive || 0}|${p.opacity ?? 1}|${p.basic ? 1 : 0}`;
    if (!byColor.has(key)) byColor.set(key, { parts: [], spec: p });
    byColor.get(key).parts.push(p);
  }
  for (const { parts: ps, spec } of byColor.values()) {
    const geos = ps.map((p) => xform(p.geo || UNIT.box, p));
    const merged = mergeGeometries(geos);
    let mat;
    if (spec.basic) {
      mat = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: (spec.opacity ?? 1) < 1,
        opacity: spec.opacity ?? 1,
      });
    } else if (material === 'phong') {
      mat = new THREE.MeshPhongMaterial({
        color: spec.color, emissive: spec.emissive || 0x000000,
        flatShading, shininess: 40,
        transparent: (spec.opacity ?? 1) < 1, opacity: spec.opacity ?? 1,
      });
    } else {
      mat = new THREE.MeshLambertMaterial({
        color: spec.color, emissive: spec.emissive || 0x000000,
        flatShading,
        transparent: (spec.opacity ?? 1) < 1, opacity: spec.opacity ?? 1,
      });
    }
    const mesh = new THREE.Mesh(merged, mat);
    group.add(mesh);
  }
  return group;
}

/** Dispose everything under a node so floor transitions don't leak GPU memory. */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
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
