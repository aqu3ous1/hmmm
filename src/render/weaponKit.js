// Gun construction kit.
//
// The weapons used to be five or six boxes each, and at viewmodel distance —
// where the player is staring at them for the entire game — that is exactly
// what they looked like. A firearm reads as *manufactured* because of things
// that are individually tiny: the ladder of a picatinny rail, the row of
// screw heads down a receiver, a bevelled ejection port, the flat of a
// trigger face, the checkering on a grip. None of those change the
// silhouette; all of them are the difference between a prop and a model.
//
// So this file is the parts bin. Each helper returns an array of `assemble()`
// parts in a shared local frame:
//
//     +Z forward (muzzle)   +Y up   +X right   origin at the grip/hand
//
// Weapons in weaponModels.js are then assembled out of these rather than
// authored box by box, which is both far more detailed and far less code.

import { UNIT } from '../world/geometry.js';

const B = UNIT.box, BB = UNIT.bevelBox, SL = UNIT.slab, C = UNIT.lowCyl;
const CY = UNIT.cyl, TP = UNIT.taper, HX = UNIT.hex, DS = UNIT.disc;
const SP = UNIT.lowSphere, RG = UNIT.ring, WG = UNIT.wedge, CN = UNIT.cone;

// Surface classes. `metal`/`rough` are what let the environment map tell
// blued steel from parkerised cast from polymer from oiled walnut — with one
// shared material they were all the same grey plastic no matter the colour.
export const MAT = {
  blued: { metal: 0.94, rough: 0.3 },
  steel: { metal: 0.92, rough: 0.18 },
  chrome: { metal: 1.0, rough: 0.05 },
  cast: { metal: 0.82, rough: 0.58 },
  alloy: { metal: 0.7, rough: 0.42 },
  polymer: { metal: 0.0, rough: 0.52 },
  rubber: { metal: 0.0, rough: 0.94 },
  wood: { metal: 0.0, rough: 0.58 },
  brass: { metal: 1.0, rough: 0.22 },
  copper: { metal: 1.0, rough: 0.3 },
  paint: { metal: 0.2, rough: 0.44 },
  bone: { metal: 0.0, rough: 0.72 },
  glass: { metal: 0.0, rough: 0.04, opacity: 0.34, smooth: true },
  flesh: { metal: 0.0, rough: 0.66, smooth: true },
};

export const HUE = {
  blued: 0x23262c,
  parker: 0x3b4048,
  steel: 0xb6bcc6,
  chrome: 0xe4e9f0,
  black: 0x14161a,
  polymer: 0x2b2f36,
  wood: 0x6d4a2a,
  walnut: 0x53341c,
  brass: 0xc8a24a,
  copper: 0xa8622a,
};

/** One part, with a surface class folded in. */
export function p(geo, color, mat, o = {}) {
  return { geo, color, ...(mat || MAT.cast), ...o };
}

/** An unlit, bloom-feeding part — indicators, tracer slots, hot metal. */
export function glow(geo, color, o = {}) {
  return { geo, color, basic: true, ...o };
}

/**
 * A ladder of picatinny slots. Nothing says "gun" faster than this, and it is
 * the single cheapest detail in the whole kit: a row of slabs with gaps.
 */
export function rail(z0, z1, y, w = 0.075, mat = MAT.cast, color = HUE.parker) {
  const parts = [p(SL, color, mat, {
    y, z: (z0 + z1) / 2, sx: w, sy: 0.028, sz: z1 - z0,
  })];
  const pitch = 0.05;
  const n = Math.max(1, Math.floor((z1 - z0) / pitch));
  for (let i = 0; i < n; i++) {
    parts.push(p(B, color, mat, {
      y: y + 0.021, z: z0 + (i + 0.5) * ((z1 - z0) / n),
      sx: w * 1.06, sy: 0.022, sz: pitch * 0.44,
    }));
  }
  return parts;
}

/** A row of fastener heads down a seam. */
export function screws(count, { x = 0, y = 0, z0 = 0, z1 = 0, r = 0.012, mat = MAT.steel, color = HUE.steel, ry = 0 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    parts.push(p(HX, color, mat, {
      x, y, z: z0 + (z1 - z0) * t, rz: Math.PI / 2, ry,
      sx: r * 2, sy: 0.012, sz: r * 2,
    }));
  }
  return parts;
}

/** Cooling slots / lightening cuts cut into a flat side. */
export function louvres(count, { x = 0, y = 0, z0 = 0, z1 = 0, w = 0.01, h = 0.05, color = HUE.black } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    parts.push(p(B, color, MAT.blued, {
      x, y, z: z0 + (z1 - z0) * t, sx: w, sy: h, sz: 0.018,
    }));
  }
  return parts;
}

/**
 * A receiver: the bevelled body of the weapon, with a recessed side panel, a
 * cut ejection port and a seam of fasteners. Everything else bolts onto this.
 */
export function receiver({
  z = 0, len = 0.9, w = 0.09, h = 0.15, y = 0,
  color = HUE.parker, mat = MAT.cast, port = true, panel = true,
} = {}) {
  const parts = [
    p(BB, color, mat, { y, z, sx: w, sy: h, sz: len }),
    // top and bottom rails of the shell, slightly proud
    p(SL, color, mat, { y: y + h * 0.46, z, sx: w * 0.94, sy: h * 0.14, sz: len * 0.98 }),
    p(SL, color, mat, { y: y - h * 0.46, z, sx: w * 0.9, sy: h * 0.12, sz: len * 0.94 }),
  ];
  if (panel) {
    for (const s of [1, -1]) {
      parts.push(p(SL, HUE.black, MAT.blued, {
        x: s * w * 0.5, y, z, sx: 0.012, sy: h * 0.56, sz: len * 0.72,
      }));
    }
    parts.push(...screws(4, { x: w * 0.52, y: y - h * 0.3, z0: z - len * 0.34, z1: z + len * 0.34 }));
    parts.push(...screws(4, { x: -w * 0.52, y: y - h * 0.3, z0: z - len * 0.34, z1: z + len * 0.34 }));
  }
  if (port) {
    // Ejection port: a dark recess with a raised lip below it.
    parts.push(p(B, 0x0a0b0d, MAT.blued, {
      x: w * 0.5, y: y + h * 0.16, z: z + len * 0.16, sx: 0.016, sy: h * 0.34, sz: len * 0.24,
    }));
    parts.push(p(SL, color, mat, {
      x: w * 0.55, y: y - h * 0.04, z: z + len * 0.16, sx: 0.02, sy: 0.018, sz: len * 0.28,
    }));
  }
  return parts;
}

/** A barrel with a step down, a gas block and a crowned muzzle. */
export function barrel({
  z0 = 0, len = 0.5, r = 0.026, y = 0, color = HUE.blued, mat = MAT.blued,
  gasBlock = false, shroud = false, fluted = false,
} = {}) {
  const parts = [
    p(CY, color, mat, { y, z: z0 + len / 2, rx: Math.PI / 2, sx: r * 2, sy: len, sz: r * 2 }),
    // chamber end is fatter than the muzzle end
    p(CY, color, mat, { y, z: z0 + len * 0.12, rx: Math.PI / 2, sx: r * 2.7, sy: len * 0.24, sz: r * 2.7 }),
    // crown
    p(RG, HUE.steel, MAT.steel, { y, z: z0 + len - 0.004, rx: 0, sx: r * 2.3, sy: r * 2.3, sz: r * 2.3 }),
    p(CY, 0x07080a, MAT.blued, { y, z: z0 + len - 0.01, rx: Math.PI / 2, sx: r * 1.15, sy: 0.03, sz: r * 1.15 }),
  ];
  if (fluted) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push(p(B, 0x15171b, MAT.blued, {
        x: Math.cos(a) * r * 0.95, y: y + Math.sin(a) * r * 0.95,
        z: z0 + len * 0.55, rz: a, sx: 0.01, sy: r * 0.5, sz: len * 0.5,
      }));
    }
  }
  if (gasBlock) {
    parts.push(p(BB, HUE.parker, MAT.cast, { y: y + r * 1.1, z: z0 + len * 0.62, sx: r * 2.2, sy: r * 2.4, sz: 0.07 }));
    parts.push(p(CY, HUE.blued, MAT.blued, { y: y + r * 1.5, z: z0 + len * 0.4, rx: Math.PI / 2, sx: r * 0.9, sy: len * 0.45, sz: r * 0.9 }));
  }
  if (shroud) {
    parts.push(p(UNIT.pipe, HUE.parker, MAT.cast, { y, z: z0 + len * 0.5, rx: Math.PI / 2, sx: r * 4, sy: len * 0.8, sz: r * 4 }));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      parts.push(p(B, 0x0a0b0d, MAT.blued, {
        x: Math.cos(a) * r * 2, y: y + Math.sin(a) * r * 2, z: z0 + len * 0.5,
        rz: a, sx: 0.014, sy: 0.03, sz: len * 0.5,
      }));
    }
  }
  return parts;
}

/** Front post between protective wings, and a rear notch or aperture. */
export function sights({
  frontZ = 0.6, rearZ = 0.05, y = 0.1, color = HUE.blued, aperture = false, tritium = 0,
} = {}) {
  const parts = [
    // front: base, post, two wings
    p(BB, color, MAT.blued, { y: y + 0.01, z: frontZ, sx: 0.05, sy: 0.03, sz: 0.05 }),
    p(B, color, MAT.blued, { y: y + 0.05, z: frontZ, sx: 0.012, sy: 0.06, sz: 0.014 }),
    p(B, color, MAT.blued, { x: 0.026, y: y + 0.05, z: frontZ, sx: 0.01, sy: 0.07, sz: 0.03 }),
    p(B, color, MAT.blued, { x: -0.026, y: y + 0.05, z: frontZ, sx: 0.01, sy: 0.07, sz: 0.03 }),
  ];
  if (aperture) {
    parts.push(p(RG, color, MAT.blued, { y: y + 0.05, z: rearZ, sx: 0.07, sy: 0.07, sz: 0.07 }));
    parts.push(p(BB, color, MAT.blued, { y: y + 0.012, z: rearZ, sx: 0.06, sy: 0.03, sz: 0.05 }));
  } else {
    parts.push(p(BB, color, MAT.blued, { y: y + 0.03, z: rearZ, sx: 0.075, sy: 0.045, sz: 0.05 }));
    parts.push(p(B, 0x07080a, MAT.blued, { y: y + 0.045, z: rearZ - 0.01, sx: 0.016, sy: 0.05, sz: 0.03 }));
  }
  if (tritium) {
    parts.push(glow(SP, tritium, { y: y + 0.06, z: frontZ, sx: 0.012, sy: 0.012, sz: 0.012 }));
    parts.push(glow(SP, tritium, { x: 0.022, y: y + 0.05, z: rearZ, sx: 0.01, sy: 0.01, sz: 0.01 }));
    parts.push(glow(SP, tritium, { x: -0.022, y: y + 0.05, z: rearZ, sx: 0.01, sy: 0.01, sz: 0.01 }));
  }
  return parts;
}

/** An angled pistol grip with a backstrap, finger grooves and a base plate. */
export function pistolGrip({
  z = -0.06, y = -0.12, angle = 0.28, h = 0.3, w = 0.075,
  color = HUE.polymer, mat = MAT.polymer, grooves = 3,
} = {}) {
  const parts = [
    p(BB, color, mat, { y, z, rx: angle, sx: w, sy: h, sz: 0.11 }),
    // palm swell and backstrap
    p(SP, color, mat, { y: y + h * 0.1, z: z - 0.045, rx: angle, sx: w * 0.98, sy: h * 0.5, sz: 0.07, smooth: true }),
    p(SL, HUE.black, MAT.rubber, { y: y + h * 0.05, z: z - 0.055, rx: angle, sx: w * 0.86, sy: h * 0.72, sz: 0.02 }),
    // base plate
    p(SL, color, mat, { y: y - h * 0.52, z: z + Math.sin(angle) * h * 0.52, rx: angle, sx: w * 1.12, sy: 0.02, sz: 0.12 }),
  ];
  for (let i = 0; i < grooves; i++) {
    const t = (i + 0.8) / (grooves + 1.2);
    parts.push(p(C, HUE.black, MAT.rubber, {
      y: y + h * (0.42 - t * 0.86), z: z + 0.05 + Math.sin(angle) * h * (t - 0.5),
      rz: Math.PI / 2, sx: 0.022, sy: w * 1.02, sz: 0.022,
    }));
  }
  return parts;
}

/** Trigger blade inside a guard. Returned separately so it can be animated. */
export function triggerGuard({ z = 0.02, y = -0.05, color = HUE.parker, mat = MAT.cast } = {}) {
  return [
    p(RG, color, mat, { y: y - 0.035, z, rx: Math.PI / 2, ry: Math.PI / 2, sx: 0.11, sy: 0.11, sz: 0.11 }),
    p(SL, color, mat, { y: y + 0.02, z: z + 0.055, sx: 0.05, sy: 0.05, sz: 0.02 }),
  ];
}

export function triggerBlade({ z = 0.01, y = -0.05, color = HUE.steel } = {}) {
  return [
    p(SL, color, MAT.steel, { y, z, rx: -0.25, sx: 0.016, sy: 0.055, sz: 0.016 }),
    p(SL, color, MAT.steel, { y: y - 0.024, z: z + 0.004, rx: -0.5, sx: 0.016, sy: 0.03, sz: 0.014 }),
  ];
}

/** A box or curved magazine, built from a stack so a curve is possible. */
export function magazine({
  z = -0.08, y = -0.16, len = 0.3, w = 0.06, d = 0.09, curve = 0,
  color = HUE.parker, mat = MAT.cast, rounds = 0,
} = {}) {
  const parts = [];
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    parts.push(p(BB, color, mat, {
      y: y - t * len, z: z + curve * t * t, rx: curve * 0.9,
      sx: w, sy: len / steps * 1.35, sz: d,
    }));
  }
  parts.push(p(SL, color, mat, {
    y: y - len - 0.01, z: z + curve, rx: curve * 0.9, sx: w * 1.15, sy: 0.02, sz: d * 1.12,
  }));
  // witness holes
  for (let i = 0; i < 3; i++) {
    parts.push(p(C, 0x07080a, MAT.blued, {
      x: w * 0.51, y: y - len * (0.25 + i * 0.24), z: z + curve * 0.4,
      rz: Math.PI / 2, sx: 0.016, sy: 0.008, sz: 0.016,
    }));
  }
  if (rounds) {
    parts.push(p(CY, HUE.brass, MAT.brass, {
      y: y + 0.03, z: z + 0.005, rx: Math.PI / 2 + curve * 0.3, sx: 0.03, sy: 0.055, sz: 0.03,
    }));
    parts.push(p(CN, 0xa8622a, MAT.copper, {
      y: y + 0.062, z: z + 0.005, rx: Math.PI / 2 + curve * 0.3, sx: 0.028, sy: 0.03, sz: 0.028,
    }));
  }
  return parts;
}

/** A shoulder stock: comb, cheek rest, recoil pad. */
export function stock({
  z = -0.5, len = 0.4, color = HUE.walnut, mat = MAT.wood, skeleton = false,
} = {}) {
  if (skeleton) {
    return [
      p(C, HUE.parker, MAT.cast, { y: 0.03, z: z + 0.02, rx: Math.PI / 2, sx: 0.03, sy: len, sz: 0.03 }),
      p(C, HUE.parker, MAT.cast, { y: -0.09, z: z + 0.02, rx: Math.PI / 2, sx: 0.03, sy: len, sz: 0.03 }),
      p(BB, color, mat, { y: -0.03, z: z - len * 0.48, sx: 0.055, sy: 0.19, sz: 0.05 }),
      p(SL, HUE.black, MAT.rubber, { y: -0.03, z: z - len * 0.54, sx: 0.06, sy: 0.2, sz: 0.02 }),
    ];
  }
  return [
    p(BB, color, mat, { y: -0.012, z, sx: 0.075, sy: 0.125, sz: len }),
    // comb slopes up toward the receiver
    p(WG, color, mat, { y: 0.06, z: z + len * 0.18, ry: Math.PI, sx: 0.07, sy: 0.06, sz: len * 0.5 }),
    // cheek rest and sling swivel
    p(SL, color, mat, { x: 0.038, y: 0.02, z, sx: 0.012, sy: 0.09, sz: len * 0.7 }),
    p(RG, HUE.steel, MAT.steel, { y: -0.075, z: z - len * 0.2, rx: Math.PI / 2, sx: 0.05, sy: 0.05, sz: 0.05 }),
    // recoil pad, with its two mounting screws
    p(BB, HUE.black, MAT.rubber, { y: -0.012, z: z - len * 0.52, sx: 0.078, sy: 0.135, sz: 0.03 }),
    ...screws(2, { z0: z - len * 0.54, z1: z - len * 0.54, y: 0.03, x: 0, ry: Math.PI / 2 }),
  ];
}

/** A handguard: heat shield, vents, and a hand stop. */
export function handguard({
  z = 0.35, len = 0.36, r = 0.055, color = HUE.walnut, mat = MAT.wood, vents = 6, ribbed = false,
} = {}) {
  const parts = [
    p(BB, color, mat, { y: -0.005, z, sx: r * 1.7, sy: r * 1.9, sz: len }),
    p(SL, color, mat, { y: -0.045, z, sx: r * 1.5, sy: 0.02, sz: len * 0.92 }),
  ];
  for (let i = 0; i < vents; i++) {
    const t = (i + 0.5) / vents;
    for (const s of [1, -1]) {
      parts.push(p(B, 0x0a0b0d, MAT.blued, {
        x: s * r * 0.87, y: 0.012, z: z - len / 2 + t * len, sx: 0.012, sy: 0.03, sz: len / vents * 0.5,
      }));
    }
  }
  if (ribbed) {
    for (let i = 0; i < 8; i++) {
      parts.push(p(C, color, mat, {
        y: -0.005, z: z - len / 2 + (i + 0.5) * (len / 8), rz: Math.PI / 2,
        sx: r * 1.95, sy: r * 1.78, sz: r * 1.95,
      }));
    }
  }
  return parts;
}

/** A muzzle device — brake, compensator or flash hider. */
export function muzzle({ z = 0.9, r = 0.03, style = 'brake', color = HUE.blued } = {}) {
  const parts = [p(CY, color, MAT.blued, { z: z + 0.03, rx: Math.PI / 2, sx: r * 2.4, sy: 0.075, sz: r * 2.4 })];
  if (style === 'brake') {
    for (let i = 0; i < 3; i++) {
      parts.push(p(B, 0x07080a, MAT.blued, {
        y: r * 1.1, z: z + 0.012 + i * 0.024, sx: r * 2.6, sy: 0.02, sz: 0.012,
      }));
    }
  } else if (style === 'hider') {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      parts.push(p(B, color, MAT.blued, {
        x: Math.cos(a) * r * 1.5, y: Math.sin(a) * r * 1.5, z: z + 0.05,
        rz: a, sx: 0.012, sy: r * 1.2, sz: 0.07,
      }));
    }
  } else if (style === 'comp') {
    parts.push(p(TP, color, MAT.blued, { z: z + 0.07, rx: -Math.PI / 2, sx: r * 2.6, sy: 0.08, sz: r * 2.6 }));
  }
  return parts;
}

/** An optic: tube, mount, turrets and a lit reticle. */
export function optic({ z = 0.18, y = 0.16, len = 0.28, r = 0.05, reticle = 0xff3a3a, color = HUE.black } = {}) {
  return [
    p(CY, color, MAT.paint, { y, z, rx: Math.PI / 2, sx: r * 2, sy: len, sz: r * 2 }),
    p(CY, color, MAT.paint, { y, z: z + len * 0.44, rx: Math.PI / 2, sx: r * 2.5, sy: len * 0.2, sz: r * 2.5 }),
    p(CY, color, MAT.paint, { y, z: z - len * 0.44, rx: Math.PI / 2, sx: r * 2.3, sy: len * 0.2, sz: r * 2.3 }),
    // turrets
    p(HX, color, MAT.paint, { y: y + r * 1.5, z, sx: 0.035, sy: 0.03, sz: 0.035 }),
    p(HX, color, MAT.paint, { x: r * 1.5, y, z, rz: Math.PI / 2, sx: 0.035, sy: 0.03, sz: 0.035 }),
    // mount rings
    p(RG, HUE.parker, MAT.cast, { y, z: z + len * 0.3, sx: r * 2.6, sy: r * 2.6, sz: r * 2.6 }),
    p(RG, HUE.parker, MAT.cast, { y, z: z - len * 0.3, sx: r * 2.6, sy: r * 2.6, sz: r * 2.6 }),
    p(BB, HUE.parker, MAT.cast, { y: y - r * 1.9, z, sx: 0.07, sy: 0.05, sz: len * 0.7 }),
    // glass and reticle
    p(DS, 0x18324a, MAT.glass, { y, z: z + len * 0.5, rx: Math.PI / 2, sx: r * 1.8, sy: 0.01, sz: r * 1.8 }),
    glow(SP, reticle, { y, z: z + len * 0.46, sx: 0.012, sy: 0.012, sz: 0.012 }),
  ];
}

/** Charging handle / bolt carrier, usually animated. */
export function boltHandle({ x = 0.06, y = 0.03, z = 0.2, color = HUE.steel } = {}) {
  return [
    p(BB, color, MAT.steel, { x, y, z, sx: 0.055, sy: 0.035, sz: 0.09 }),
    p(C, color, MAT.steel, { x: x + 0.03, y, z, rz: Math.PI / 2, sx: 0.03, sy: 0.05, sz: 0.03 }),
    p(SP, color, MAT.steel, { x: x + 0.055, y, z, sx: 0.04, sy: 0.04, sz: 0.04 }),
  ];
}

/** A revolver cylinder with visible chambers and cartridge heads. */
export function cylinderBlock({ z = 0.06, r = 0.055, len = 0.14, chambers = 6, color = HUE.blued } = {}) {
  const parts = [p(CY, color, MAT.blued, { z, rx: Math.PI / 2, sx: r * 2, sy: len, sz: r * 2 })];
  for (let i = 0; i < chambers; i++) {
    const a = (i / chambers) * Math.PI * 2;
    const cx = Math.cos(a) * r * 0.6, cy = Math.sin(a) * r * 0.6;
    parts.push(p(CY, 0x07080a, MAT.blued, {
      x: cx, y: cy, z: z + len * 0.42, rx: Math.PI / 2, sx: 0.03, sy: 0.03, sz: 0.03,
    }));
    parts.push(p(CY, HUE.brass, MAT.brass, {
      x: cx, y: cy, z: z - len * 0.46, rx: Math.PI / 2, sx: 0.032, sy: 0.02, sz: 0.032,
    }));
    // flute between chambers
    parts.push(p(B, 0x15171b, MAT.blued, {
      x: Math.cos(a + Math.PI / chambers) * r * 0.98,
      y: Math.sin(a + Math.PI / chambers) * r * 0.98,
      z, rz: a + Math.PI / chambers, sx: 0.012, sy: 0.03, sz: len * 0.75,
    }));
  }
  return parts;
}

export { B, BB, SL, C, CY, TP, HX, DS, SP, RG, WG, CN };
