// The twenty-two weapons, assembled from the parts bin in weaponKit.js.
//
// Each builder returns `{ parts, anim }`. `parts` is the static body; `anim` is
// an optional map of named sub-assemblies — a slide, a bolt, a cylinder, a
// trigger, a magazine — which the viewmodel animates. A gun that cycles when
// you fire it reads as a mechanism rather than a decal, and it costs one extra
// draw call per moving group.

import * as THREE from '../../vendor/three.module.js';
import { UNIT, assemble } from '../world/geometry.js';
import {
  MAT, HUE, p, glow, rail, screws, louvres, receiver, barrel, sights,
  pistolGrip, triggerGuard, triggerBlade, magazine, stock, handguard,
  muzzle, optic, boltHandle, cylinderBlock,
  B, BB, SL, C, CY, TP, HX, DS, SP, RG, WG, CN,
} from './weaponKit.js';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const BUILDERS = {

  // -- brawling -------------------------------------------------------------

  knuckles() {
    // A four-hole duster. The holes have to face the wrist — laid flat they
    // read as a gold bar with eggs on it, which is exactly what happened the
    // first time. UNIT.ring already sits in the XY plane, so no rotation.
    const parts = [];
    const brass = 0xc9962a, dark = 0x8a6a1e;
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.072;
      const r = 0.062 - Math.abs(i - 1.5) * 0.005;   // holes taper toward the little finger
      parts.push(p(RG, brass, MAT.brass, { x, y: -0.01, sx: r * 2, sy: r * 2, sz: 0.11 }));
      // the striking dome above each hole
      parts.push(p(SP, brass, MAT.brass, { x, y: 0.055, sx: 0.062, sy: 0.05, sz: 0.1, smooth: true }));
      // the valley between two domes
      if (i < 3) parts.push(p(SP, dark, MAT.brass, { x: x + 0.036, y: 0.035, sx: 0.03, sy: 0.03, sz: 0.09, smooth: true }));
    }
    // Frame bridging the holes, front and back faces.
    parts.push(p(BB, brass, MAT.brass, { y: 0.045, sx: 0.3, sy: 0.045, sz: 0.1 }));
    parts.push(p(BB, brass, MAT.brass, { y: -0.075, sx: 0.28, sy: 0.045, sz: 0.1 }));
    // Edge chamfers along the top and bottom of the frame — NOT a face plate,
    // which is what covered the holes and turned this into a gold brick.
    parts.push(p(SL, dark, MAT.brass, { y: 0.068, sx: 0.3, sy: 0.008, sz: 0.104 }));
    parts.push(p(SL, dark, MAT.brass, { y: -0.098, sx: 0.28, sy: 0.008, sz: 0.104 }));
    // Palm bar, taped, sitting behind the fingers.
    parts.push(p(BB, 0x5a4a3a, MAT.rubber, { y: -0.115, z: -0.01, sx: 0.24, sy: 0.05, sz: 0.075 }));
    for (let i = 0; i < 6; i++) {
      parts.push(p(C, 0x6d5a44, MAT.rubber, {
        x: -0.1 + i * 0.04, y: -0.115, z: -0.01, rz: Math.PI / 2 + 0.22,
        sx: 0.055, sy: 0.036, sz: 0.085,
      }));
    }
    // Wear: the two middle domes are polished bright, the outer ones aren't.
    parts.push(p(SP, 0xf0d98a, MAT.chrome, { x: -0.036, y: 0.078, z: 0.012, sx: 0.03, sy: 0.016, sz: 0.05, smooth: true }));
    parts.push(p(SP, 0xf0d98a, MAT.chrome, { x: 0.036, y: 0.078, z: 0.012, sx: 0.03, sy: 0.016, sz: 0.05, smooth: true }));
    // Stamped plate — the Pod marks everything it makes.
    parts.push(p(SL, dark, MAT.brass, { y: -0.075, z: 0.054, sx: 0.12, sy: 0.03, sz: 0.005 }));
    parts.push(glow(B, 0xffd24a, { y: -0.075, z: 0.058, sx: 0.09, sy: 0.008, sz: 0.004 }));
    return { parts };
  },

  // -- rifles ---------------------------------------------------------------

  ak47() {
    const parts = [
      ...receiver({ z: 0.02, len: 0.62, w: 0.085, h: 0.13, color: HUE.parker }),
      // The dust cover, with its distinctive ribs.
      ...[0, 1, 2].map((i) => p(C, HUE.parker, MAT.cast, {
        y: 0.068, z: -0.06 + i * 0.09, rz: Math.PI / 2, sx: 0.09, sy: 0.084, sz: 0.09,
      })),
      ...barrel({ z0: 0.33, len: 0.46, r: 0.019, gasBlock: true }),
      ...muzzle({ z: 0.78, r: 0.021, style: 'brake' }),
      ...handguard({ z: 0.4, len: 0.3, r: 0.05, color: HUE.wood, mat: MAT.wood, vents: 5 }),
      // Gas tube above the handguard.
      p(CY, HUE.parker, MAT.cast, { y: 0.055, z: 0.42, rx: Math.PI / 2, sx: 0.03, sy: 0.28, sz: 0.03 }),
      ...pistolGrip({ z: -0.1, y: -0.13, angle: 0.22, h: 0.26, color: 0x4a3722, mat: MAT.polymer }),
      ...triggerGuard({ z: -0.02, y: -0.045 }),
      ...stock({ z: -0.44, len: 0.36, color: HUE.wood, mat: MAT.wood }),
      ...sights({ frontZ: 0.72, rearZ: 0.16, y: 0.075 }),
      ...boltHandle({ x: 0.055, y: 0.035, z: 0.14 }),
      // Selector lever — the big flat paddle on the right side.
      p(SL, HUE.parker, MAT.cast, { x: 0.052, y: 0.02, z: 0.02, sx: 0.012, sy: 0.09, sz: 0.13 }),
      p(C, HUE.steel, MAT.steel, { x: 0.052, y: -0.02, z: 0.0, rz: Math.PI / 2, sx: 0.03, sy: 0.02, sz: 0.03 }),
    ];
    const mag = [...magazine({ z: -0.02, y: -0.1, len: 0.28, w: 0.055, d: 0.09, curve: 0.075, color: 0x3a4a2c, rounds: 1 })];
    return { parts, anim: { mag: { parts: mag }, bolt: { parts: boltHandle({ x: 0.055, y: 0.035, z: 0.14 }), axis: 'z' } } };
  },

  fake47() {
    // Identical to the AK at a glance, wrong in every detail up close: the
    // stamping is plastic, the barrel is bent, and the selector is painted on.
    const parts = [
      ...receiver({ z: 0.02, len: 0.62, w: 0.085, h: 0.13, color: 0x4d5560, mat: MAT.polymer, panel: false }),
      p(SL, 0x5a626e, MAT.polymer, { y: 0.068, z: 0.02, sx: 0.086, sy: 0.02, sz: 0.6 }),
      // The tell: a visible mould seam and sprue nub, and a barrel off-axis.
      p(B, 0x6a727e, MAT.polymer, { x: 0.044, y: 0, z: 0.02, sx: 0.004, sy: 0.13, sz: 0.6 }),
      p(SP, 0x6a727e, MAT.polymer, { x: -0.046, y: -0.05, z: -0.2, sx: 0.02, sy: 0.02, sz: 0.02 }),
      ...barrel({ z0: 0.33, len: 0.46, r: 0.019, color: 0x50575f, mat: MAT.polymer }).map((q) => ({ ...q, ry: (q.ry || 0) + 0.06 })),
      ...handguard({ z: 0.4, len: 0.3, r: 0.05, color: 0x8a6a48, mat: MAT.polymer, vents: 3 }),
      ...pistolGrip({ z: -0.1, y: -0.13, angle: 0.22, h: 0.26, color: 0x8a6a48, mat: MAT.polymer, grooves: 1 }),
      ...triggerGuard({ z: -0.02, y: -0.045, color: 0x5a626e, mat: MAT.polymer }),
      ...stock({ z: -0.44, len: 0.36, color: 0x8a6a48, mat: MAT.polymer }),
      ...sights({ frontZ: 0.72, rearZ: 0.16, y: 0.075, color: 0x5a626e }),
      // A sticker where the proof marks should be.
      p(SL, 0xd8d8d8, MAT.polymer, { x: 0.046, y: 0.01, z: -0.1, sx: 0.006, sy: 0.05, sz: 0.16 }),
      glow(B, 0xff5a5a, { x: 0.05, y: 0.01, z: -0.1, sx: 0.004, sy: 0.02, sz: 0.1 }),
    ];
    const mag = magazine({ z: -0.02, y: -0.1, len: 0.28, w: 0.055, d: 0.09, curve: 0.075, color: 0x6a7a4c, mat: MAT.polymer });
    return { parts, anim: { mag: { parts: mag } } };
  },

  intern() {
    // A stubby SMG covered in sticky notes and a stress ball taped to the grip.
    const parts = [
      ...receiver({ z: 0.05, len: 0.44, w: 0.08, h: 0.12, color: 0x555c66, mat: MAT.alloy }),
      ...rail(-0.1, 0.3, 0.068),
      ...barrel({ z0: 0.26, len: 0.24, r: 0.015, shroud: true }),
      ...handguard({ z: 0.3, len: 0.18, r: 0.042, color: 0x3a3f48, mat: MAT.polymer, vents: 4 }),
      ...pistolGrip({ z: -0.06, y: -0.11, angle: 0.2, h: 0.24, color: 0x2b2f36 }),
      ...triggerGuard({ z: 0.0, y: -0.04 }),
      ...stock({ z: -0.32, len: 0.26, skeleton: true, color: 0x3a3f48 }),
      ...sights({ frontZ: 0.46, rearZ: 0.0, y: 0.085 }),
      // Sticky notes, curling at the corners.
      p(SL, 0xf2e15c, MAT.polymer, { x: 0.046, y: 0.02, z: 0.08, rz: 0.2, sx: 0.006, sy: 0.07, sz: 0.07 }),
      p(SL, 0xf27fbf, MAT.polymer, { x: -0.046, y: -0.01, z: 0.0, rz: -0.3, sx: 0.006, sy: 0.06, sz: 0.06 }),
      p(SL, 0x7fd4f2, MAT.polymer, { y: 0.075, z: -0.1, rx: 0.1, sx: 0.06, sy: 0.006, sz: 0.06 }),
      // Stress ball, zip-tied on.
      p(SP, 0xff6a4a, MAT.rubber, { x: 0.055, y: -0.16, z: -0.05, sx: 0.07, sy: 0.07, sz: 0.07, smooth: true }),
      p(C, 0xd8d8d8, MAT.polymer, { x: 0.055, y: -0.16, z: -0.05, rz: Math.PI / 2, sx: 0.08, sy: 0.008, sz: 0.08 }),
    ];
    const mag = magazine({ z: 0.0, y: -0.1, len: 0.3, w: 0.045, d: 0.075, color: 0x2b2f36 });
    return { parts, anim: { mag: { parts: mag } } };
  },

  // -- handguns -------------------------------------------------------------

  deagle() {
    // Big, square, gas-operated, and unmistakably chromed.
    const frame = [
      ...pistolGrip({ z: -0.05, y: -0.14, angle: 0.3, h: 0.3, w: 0.07, color: 0x2a2018, mat: MAT.wood, grooves: 0 }),
      // Chequered wooden grip panels.
      ...Array.from({ length: 5 }, (_, i) => p(B, 0x1d1610, MAT.wood, {
        x: 0.037, y: -0.06 - i * 0.045, z: -0.03 + i * 0.014, rx: 0.3, sx: 0.006, sy: 0.03, sz: 0.08,
      })),
      ...triggerGuard({ z: 0.03, y: -0.05, color: HUE.chrome, mat: MAT.chrome }),
      p(BB, HUE.chrome, MAT.chrome, { y: -0.035, z: 0.07, sx: 0.075, sy: 0.07, sz: 0.3 }),
      // Safety and slide stop.
      p(SL, HUE.blued, MAT.steel, { x: 0.04, y: 0.02, z: -0.05, sx: 0.012, sy: 0.028, sz: 0.075 }),
      p(SL, HUE.blued, MAT.steel, { x: -0.04, y: -0.005, z: 0.02, sx: 0.012, sy: 0.022, sz: 0.09 }),
      // The gas cylinder under the barrel — the Deagle's real signature.
      p(CY, HUE.chrome, MAT.chrome, { y: -0.048, z: 0.3, rx: Math.PI / 2, sx: 0.038, sy: 0.34, sz: 0.038 }),
      p(HX, HUE.chrome, MAT.chrome, { y: -0.048, z: 0.47, rx: Math.PI / 2, sx: 0.046, sy: 0.03, sz: 0.046 }),
    ];
    const slide = [
      // Slab-sided slide with a hexagonal barrel poking out of it.
      p(BB, HUE.chrome, MAT.chrome, { y: 0.055, z: 0.16, sx: 0.078, sy: 0.09, sz: 0.62 }),
      p(HX, HUE.chrome, MAT.chrome, { y: 0.055, z: 0.42, rx: Math.PI / 2, sx: 0.07, sy: 0.24, sz: 0.07 }),
      p(CY, 0x07080a, MAT.blued, { y: 0.055, z: 0.46, rx: Math.PI / 2, sx: 0.034, sy: 0.06, sz: 0.034 }),
      // Cocking serrations.
      ...Array.from({ length: 8 }, (_, i) => p(B, 0x8d939c, MAT.steel, {
        x: 0.04, y: 0.055, z: -0.08 - i * 0.022, sx: 0.006, sy: 0.075, sz: 0.008,
      })),
      ...Array.from({ length: 8 }, (_, i) => p(B, 0x8d939c, MAT.steel, {
        x: -0.04, y: 0.055, z: -0.08 - i * 0.022, sx: 0.006, sy: 0.075, sz: 0.008,
      })),
      // Ejection port and extractor.
      p(B, 0x07080a, MAT.blued, { x: 0.04, y: 0.075, z: 0.16, sx: 0.012, sy: 0.05, sz: 0.14 }),
      ...sights({ frontZ: 0.44, rearZ: -0.1, y: 0.095, color: HUE.blued, tritium: 0x6fff9a }),
      ...screws(3, { x: 0.042, y: 0.02, z0: 0.0, z1: 0.28 }),
    ];
    const mag = magazine({ z: -0.04, y: -0.14, len: 0.26, w: 0.05, d: 0.085, color: HUE.blued, rounds: 1 });
    return {
      parts: [...frame, ...slide],
      anim: { slide: { parts: slide, recoil: 0.075 }, mag: { parts: mag } },
    };
  },

  compliance() {
    // A civil-service sidearm: matte, unglamorous, with a receipt spool bolted
    // to the top and a coin slot in the grip.
    const parts = [
      ...receiver({ z: 0.1, len: 0.42, w: 0.07, h: 0.1, color: 0x3d4249, mat: MAT.paint }),
      ...barrel({ z0: 0.3, len: 0.22, r: 0.016, color: 0x22252a }),
      ...pistolGrip({ z: -0.06, y: -0.13, angle: 0.3, h: 0.28, color: 0x1f2227 }),
      ...triggerGuard({ z: 0.02, y: -0.05 }),
      ...sights({ frontZ: 0.48, rearZ: 0.0, y: 0.06 }),
      // Receipt spool and a curl of paper coming out of it.
      p(CY, 0xd8d4c8, MAT.polymer, { y: 0.12, z: 0.0, rz: Math.PI / 2, sx: 0.07, sy: 0.09, sz: 0.07 }),
      p(BB, 0x2b2f36, MAT.polymer, { y: 0.12, z: 0.0, sx: 0.1, sy: 0.08, sz: 0.09 }),
      p(SL, 0xe8e4d8, MAT.polymer, { y: 0.1, z: 0.07, rx: 0.5, sx: 0.055, sy: 0.001, sz: 0.13 }),
      p(SL, 0xe8e4d8, MAT.polymer, { y: 0.05, z: 0.12, rx: 1.2, sx: 0.055, sy: 0.001, sz: 0.1 }),
      // Coin slot, worn bright at the lip.
      p(B, 0x07080a, MAT.blued, { x: 0.038, y: -0.14, z: -0.05, sx: 0.008, sy: 0.012, sz: 0.05 }),
      p(SL, 0xc8c2a8, MAT.brass, { x: 0.04, y: -0.128, z: -0.05, sx: 0.005, sy: 0.006, sz: 0.06 }),
      glow(B, 0x6fd8ff, { y: 0.055, z: 0.18, sx: 0.02, sy: 0.006, sz: 0.09 }),
    ];
    const mag = magazine({ z: -0.05, y: -0.13, len: 0.22, w: 0.048, d: 0.075, color: 0x2b2f36 });
    return { parts, anim: { mag: { parts: mag } } };
  },

  nullptr() {
    // A pistol that is partly not there. Half its geometry is a wireframe
    // ghost of the half that exists.
    const solid = [
      ...receiver({ z: 0.08, len: 0.38, w: 0.07, h: 0.1, color: 0x1a1d24, mat: MAT.paint, port: false }),
      ...pistolGrip({ z: -0.06, y: -0.12, angle: 0.3, h: 0.26, color: 0x101218 }),
      ...triggerGuard({ z: 0.02, y: -0.05, color: 0x1a1d24 }),
      ...barrel({ z0: 0.26, len: 0.2, r: 0.015, color: 0x101218 }),
    ];
    // The half that is not there, drawn as its own edges. Solid translucent
    // boxes just read as blue plastic; only the wireframe reads as absence.
    const ghost = [];
    const edge = (x, y, z, sx, sy, sz) => glow(B, 0x8fb4ff, { x, y, z, sx, sy, sz, opacity: 0.5 });
    const wireBox = (cx, cy, cz, hx, hy, hz, t = 0.004) => {
      for (const sy of [1, -1]) for (const sz of [1, -1]) ghost.push(edge(cx, cy + sy * hy, cz + sz * hz, hx * 2, t, t));
      for (const sx of [1, -1]) for (const sz of [1, -1]) ghost.push(edge(cx + sx * hx, cy, cz + sz * hz, t, hy * 2, t));
      for (const sx of [1, -1]) for (const sy of [1, -1]) ghost.push(edge(cx + sx * hx, cy + sy * hy, cz, t, t, hz * 2));
    };
    wireBox(0, 0.09, 0.12, 0.036, 0.03, 0.2);          // the slide that isn't
    wireBox(0, 0.09, 0.38, 0.016, 0.016, 0.08);        // the barrel that isn't
    // Scan lines drifting through the empty volume.
    for (let i = 0; i < 4; i++) {
      ghost.push(glow(B, 0x6f9aff, { y: 0.09, z: -0.02 + i * 0.11, sx: 0.074, sy: 0.06, sz: 0.002, opacity: 0.22 }));
    }
    ghost.push(glow(B, 0xff3a6a, { x: 0.04, y: 0.0, z: 0.0, sx: 0.004, sy: 0.03, sz: 0.1 }));
    return { parts: [...solid, ...ghost], anim: { flicker: { parts: ghost } } };
  },

  babygun(weapon) {
    // Six stages, from a toy to an heirloom. Everything grows: the frame, the
    // furniture, the sights, and finally the engraving and the wood.
    const s = weapon ? (weapon.params.stage | 0) : 0;
    const col = weapon?.stageColor || 0xffc2d8;
    const scale = 0.72 + s * 0.11;
    const bodyMat = s >= 3 ? MAT.alloy : MAT.polymer;
    const bodyCol = s >= 4 ? 0x8d939c : (s >= 2 ? 0x5a6270 : col);
    const parts = [
      ...receiver({ z: 0.08 * scale, len: 0.34 * scale, w: 0.07 * scale, h: 0.1 * scale, color: bodyCol, mat: bodyMat, panel: s >= 2, port: s >= 3 }),
      ...barrel({ z0: 0.24 * scale, len: 0.2 * scale, r: 0.015 * scale, color: s >= 3 ? HUE.blued : col, mat: s >= 3 ? MAT.blued : MAT.polymer }),
      ...pistolGrip({ z: -0.05, y: -0.12 * scale, angle: 0.3, h: 0.24 * scale, w: 0.06 * scale, color: s >= 4 ? 0x2a2018 : col, mat: s >= 4 ? MAT.wood : MAT.polymer, grooves: s >= 1 ? 2 : 0 }),
      ...triggerGuard({ z: 0.02, y: -0.045, color: bodyCol, mat: bodyMat }),
    ];
    if (s === 0) {
      // A cork on a string, and a smiling sticker.
      parts.push(p(SP, 0xd8a05a, MAT.wood, { z: 0.45 * scale, sx: 0.035, sy: 0.035, sz: 0.045 }));
      parts.push(p(C, 0xe8e8e8, MAT.polymer, { z: 0.36 * scale, y: -0.03, rx: Math.PI / 2, sx: 0.004, sy: 0.16, sz: 0.004 }));
      parts.push(glow(DS, 0xffe45a, { x: 0.04, y: 0.02, z: 0.05, rz: Math.PI / 2, sx: 0.05, sy: 0.004, sz: 0.05 }));
    }
    if (s >= 1) parts.push(...sights({ frontZ: 0.42 * scale, rearZ: 0.0, y: 0.055 * scale, color: bodyCol }));
    if (s >= 2) parts.push(...rail(-0.02, 0.22 * scale, 0.058 * scale, 0.06));
    if (s >= 3) parts.push(...muzzle({ z: 0.44 * scale, r: 0.017 * scale, style: 'comp' }));
    if (s >= 4) {
      parts.push(...optic({ z: 0.1, y: 0.14, len: 0.2, r: 0.036, reticle: 0xff8a3c }));
    }
    if (s >= 5) {
      // Grandpa's: walnut furniture, gold inlay, a worn brass plate.
      parts.push(...stock({ z: -0.34, len: 0.28, color: HUE.walnut, mat: MAT.wood }));
      parts.push(p(SL, 0xc9a227, MAT.brass, { x: 0.038, y: -0.02, z: 0.06, sx: 0.005, sy: 0.05, sz: 0.16 }));
      parts.push(glow(B, 0xffd98a, { x: 0.042, y: -0.02, z: 0.06, sx: 0.004, sy: 0.012, sz: 0.12 }));
      for (let i = 0; i < 5; i++) {
        parts.push(p(B, 0xc9a227, MAT.brass, {
          x: -0.038, y: 0.0 + Math.sin(i) * 0.02, z: 0.0 + i * 0.03, rz: i * 0.4,
          sx: 0.004, sy: 0.03, sz: 0.006,
        }));
      }
    }
    const mag = magazine({ z: -0.04, y: -0.11 * scale, len: 0.18 * scale, w: 0.042 * scale, d: 0.065 * scale, color: bodyCol, mat: bodyMat });
    return { parts, anim: { mag: { parts: mag } } };
  },

  // -- shotguns and heavies -------------------------------------------------

  roombroom() {
    // Side-by-side, sawn short, with a broom head zip-tied under the barrels
    // because somebody in the Pod thought that was funny.
    const parts = [
      ...receiver({ z: -0.05, len: 0.3, w: 0.105, h: 0.13, color: 0x4a4038, mat: MAT.cast, port: false }),
      // Twin barrels with a rib between them.
      ...barrel({ z0: 0.08, len: 0.5, r: 0.028, y: 0.03, color: 0x2a2d33 }),
      ...barrel({ z0: 0.08, len: 0.5, r: 0.028, y: -0.03, color: 0x2a2d33 }),
      p(SL, 0x2a2d33, MAT.blued, { y: 0, z: 0.32, sx: 0.012, sy: 0.06, sz: 0.48 }),
      p(RG, HUE.steel, MAT.steel, { y: 0.03, z: 0.3, sx: 0.075, sy: 0.075, sz: 0.075 }),
      p(RG, HUE.steel, MAT.steel, { y: -0.03, z: 0.3, sx: 0.075, sy: 0.075, sz: 0.075 }),
      ...handguard({ z: 0.24, len: 0.2, r: 0.062, color: HUE.walnut, mat: MAT.wood, vents: 0, ribbed: true }),
      ...pistolGrip({ z: -0.14, y: -0.12, angle: 0.34, h: 0.24, color: HUE.walnut, mat: MAT.wood, grooves: 0 }),
      ...triggerGuard({ z: -0.06, y: -0.05, color: 0x4a4038 }),
      // Two triggers, because two barrels.
      ...triggerBlade({ z: -0.07, y: -0.05 }),
      ...triggerBlade({ z: -0.11, y: -0.05 }),
      // Break-action hinge and top lever.
      p(HX, HUE.steel, MAT.steel, { y: -0.05, z: 0.06, rz: Math.PI / 2, sx: 0.055, sy: 0.11, sz: 0.055 }),
      p(SL, HUE.steel, MAT.steel, { y: 0.07, z: -0.12, rz: 0.25, sx: 0.02, sy: 0.016, sz: 0.1 }),
      // Two shells in the loops on the stock.
      ...[0, 1].map((i) => p(CY, 0xa8323c, MAT.polymer, {
        x: 0.055, y: -0.02, z: -0.24 - i * 0.06, rx: Math.PI / 2, sx: 0.03, sy: 0.09, sz: 0.03,
      })),
      ...[0, 1].map((i) => p(CY, HUE.brass, MAT.brass, {
        x: 0.055, y: -0.02, z: -0.21 - i * 0.06, rx: Math.PI / 2, sx: 0.032, sy: 0.03, sz: 0.032,
      })),
      // The broom head. Bristles, obviously.
      p(BB, 0x8a6a3a, MAT.wood, { y: -0.085, z: 0.42, sx: 0.16, sy: 0.03, sz: 0.1 }),
      ...Array.from({ length: 14 }, (_, i) => p(B, 0xd8b45a, MAT.rubber, {
        x: -0.07 + (i % 7) * 0.023, y: -0.13, z: 0.4 + Math.floor(i / 7) * 0.04,
        rz: (i % 3 - 1) * 0.1, sx: 0.008, sy: 0.08, sz: 0.008,
      })),
      p(C, 0xd8d8d8, MAT.polymer, { y: -0.085, z: 0.42, rz: Math.PI / 2, sx: 0.19, sy: 0.008, sz: 0.12 }),
    ];
    return { parts, anim: { break: { parts: [] } } };
  },

  behemoth() {
    // The best gun in the Pod, and it looks like it: a six-barrel rotary with
    // a drum, a heat exchanger and far too many warning labels.
    const barrels = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bx = Math.cos(a) * 0.062, by = 0.02 + Math.sin(a) * 0.062;
      barrels.push(p(CY, 0x40464f, MAT.cast, { x: bx, y: by, z: 0.52, rx: Math.PI / 2, sx: 0.036, sy: 0.66, sz: 0.036 }));
      barrels.push(p(CY, 0x07080a, MAT.blued, { x: bx, y: by, z: 0.84, rx: Math.PI / 2, sx: 0.022, sy: 0.05, sz: 0.022 }));
      barrels.push(p(RG, 0x6a7280, MAT.steel, { x: bx, y: by, z: 0.83, sx: 0.05, sy: 0.05, sz: 0.05 }));
    }
    // Clamp rings hold the barrel cluster together.
    for (const z of [0.28, 0.52, 0.76]) {
      barrels.push(p(UNIT.pipe, 0x5a6270, MAT.steel, { y: 0.02, z, rx: Math.PI / 2, sx: 0.2, sy: 0.035, sz: 0.2 }));
    }
    const parts = [
      ...receiver({ z: -0.02, len: 0.56, w: 0.17, h: 0.24, color: 0x2c3038, mat: MAT.cast, port: false }),
      // Heat exchanger fins along the top.
      ...Array.from({ length: 9 }, (_, i) => p(SL, 0x4a515c, MAT.cast, {
        y: 0.14, z: -0.22 + i * 0.055, sx: 0.16, sy: 0.05, sz: 0.016,
      })),
      // Ammo drum on the left, with a feed chute into the receiver.
      p(CY, 0x353a43, MAT.cast, { x: -0.16, y: -0.02, z: -0.14, rz: Math.PI / 2, sx: 0.3, sy: 0.12, sz: 0.3 }),
      p(UNIT.pipe, 0x5a6270, MAT.steel, { x: -0.16, y: -0.02, z: -0.14, rz: Math.PI / 2, sx: 0.32, sy: 0.13, sz: 0.32 }),
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return p(HX, 0x6a7280, MAT.steel, {
          x: -0.16, y: -0.02 + Math.sin(a) * 0.11, z: -0.14 + Math.cos(a) * 0.11,
          rz: Math.PI / 2, sx: 0.03, sy: 0.13, sz: 0.03,
        });
      }),
      p(BB, 0x40464f, MAT.cast, { x: -0.08, y: -0.02, z: -0.02, rz: 0.5, sx: 0.16, sy: 0.07, sz: 0.09 }),
      // Linked belt hanging out of the feed.
      ...Array.from({ length: 6 }, (_, i) => p(BB, HUE.brass, MAT.brass, {
        x: -0.02, y: -0.14 - i * 0.035, z: -0.06 + Math.sin(i * 0.9) * 0.03,
        rz: Math.sin(i * 0.7) * 0.3, sx: 0.05, sy: 0.03, sz: 0.05,
      })),
      // Spade grips — you hold this thing with both hands, behind it.
      p(C, 0x2c3038, MAT.cast, { y: -0.06, z: -0.32, rz: Math.PI / 2, sx: 0.07, sy: 0.28, sz: 0.07 }),
      ...[1, -1].flatMap((s) => [
        p(BB, 0x14161a, MAT.rubber, { x: s * 0.15, y: -0.14, z: -0.34, rx: 0.2, sx: 0.06, sy: 0.2, sz: 0.07 }),
        p(SP, 0x14161a, MAT.rubber, { x: s * 0.15, y: -0.24, z: -0.32, sx: 0.07, sy: 0.05, sz: 0.07, smooth: true }),
        ...screws(3, { x: s * 0.15, y: -0.14, z0: -0.38, z1: -0.3, r: 0.01 }),
      ]),
      // Thumb trigger, and the warning plate nobody read.
      p(SL, 0xc9302a, MAT.paint, { y: -0.03, z: -0.36, sx: 0.06, sy: 0.03, sz: 0.03 }),
      p(SL, 0xd8b43a, MAT.paint, { x: 0.088, y: 0.02, z: -0.12, sx: 0.006, sy: 0.08, sz: 0.18 }),
      ...Array.from({ length: 4 }, (_, i) => p(B, 0x14161a, MAT.paint, {
        x: 0.092, y: 0.05 - i * 0.02, z: -0.12, sx: 0.004, sy: 0.008, sz: 0.13,
      })),
      // Hot glow between the barrels and along the exchanger.
      glow(B, 0xff6a2a, { x: 0.09, y: 0.02, z: -0.02, sx: 0.012, sy: 0.05, sz: 0.4 }),
      glow(B, 0xff6a2a, { x: -0.09, y: 0.02, z: -0.02, sx: 0.012, sy: 0.05, sz: 0.4 }),
      glow(UNIT.pipe, 0xff9a4a, { y: 0.02, z: 0.14, rx: Math.PI / 2, sx: 0.16, sy: 0.03, sz: 0.16, opacity: 0.7 }),
      ...barrels,
    ];
    return { parts, anim: { spin: { parts: barrels, axis: 'z' } } };
  },

  // -- exotics --------------------------------------------------------------

  nimbo() {
    // A cloud projector: a copper coil, a glass bulb and a lot of soft light.
    const coil = [];
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      coil.push(p(RG, 0xc98a4a, MAT.copper, {
        y: 0.02, z: 0.24 + t * 0.24, sx: 0.11 + Math.sin(t * Math.PI) * 0.03,
        sy: 0.11 + Math.sin(t * Math.PI) * 0.03, sz: 0.11,
      }));
    }
    const parts = [
      ...receiver({ z: 0.02, len: 0.42, w: 0.1, h: 0.14, color: 0x2c3e5a, mat: MAT.paint, port: false }),
      ...pistolGrip({ z: -0.08, y: -0.13, angle: 0.26, h: 0.26, color: 0x1c2a40 }),
      ...triggerGuard({ z: -0.01, y: -0.05, color: 0x2c3e5a, mat: MAT.paint }),
      ...coil,
      // Glass bulb with something drifting inside it.
      p(SP, 0xbfe8ff, MAT.glass, { y: 0.02, z: 0.5, sx: 0.13, sy: 0.13, sz: 0.13 }),
      glow(SP, 0xaaffff, { y: 0.02, z: 0.5, sx: 0.075, sy: 0.075, sz: 0.075, opacity: 0.85 }),
      glow(UNIT.torus, 0x6fffe4, { y: 0.02, z: 0.58, sx: 0.17, sy: 0.17, sz: 0.17 }),
      // Pressure gauge and two brass valves.
      p(CY, 0xd8d4c8, MAT.polymer, { x: 0.06, y: 0.09, z: -0.06, rz: Math.PI / 2, sx: 0.055, sy: 0.02, sz: 0.055 }),
      p(RG, 0xc98a4a, MAT.copper, { x: 0.068, y: 0.09, z: -0.06, rz: Math.PI / 2, sx: 0.06, sy: 0.06, sz: 0.06 }),
      glow(B, 0xff5a5a, { x: 0.072, y: 0.095, z: -0.055, rz: 0.7, sx: 0.004, sy: 0.022, sz: 0.004 }),
      p(HX, 0xc98a4a, MAT.copper, { y: 0.09, z: -0.16, sx: 0.05, sy: 0.04, sz: 0.05 }),
      p(HX, 0xc98a4a, MAT.copper, { x: -0.06, y: 0.02, z: -0.14, rz: Math.PI / 2, sx: 0.045, sy: 0.035, sz: 0.045 }),
      // Coolant lines looping over the top.
      p(UNIT.torus, 0x1c2a40, MAT.rubber, { x: 0.05, y: 0.1, z: 0.12, rx: Math.PI / 2, ry: 0.4, sx: 0.14, sy: 0.14, sz: 0.14 }),
      glow(B, 0x6fffe4, { x: 0.052, y: 0.02, z: -0.02, sx: 0.006, sy: 0.03, sz: 0.28 }),
      glow(B, 0x6fffe4, { x: -0.052, y: 0.02, z: -0.02, sx: 0.006, sy: 0.03, sz: 0.28 }),
    ];
    return { parts, anim: { coil: { parts: coil, axis: 'z' } } };
  },

  sandwich() {
    // A vending machine that someone gave a trigger.
    const parts = [
      p(BB, 0xc8ccd4, MAT.paint, { y: 0.02, z: 0.0, sx: 0.26, sy: 0.32, sz: 0.44 }),
      p(BB, 0x9aa0aa, MAT.alloy, { y: 0.19, z: -0.02, sx: 0.24, sy: 0.05, sz: 0.4 }),
      // Front window with two shelves of stock behind it.
      p(B, 0x14161a, MAT.polymer, { y: 0.05, z: 0.225, sx: 0.2, sy: 0.22, sz: 0.012 }),
      p(B, 0x9fd8ff, MAT.glass, { y: 0.05, z: 0.232, sx: 0.18, sy: 0.2, sz: 0.006 }),
      ...[0, 1].flatMap((r) => [0, 1, 2].map((c) => p(BB, [0xd9a441, 0xc85a3a, 0x8ab45a][c], MAT.polymer, {
        x: -0.055 + c * 0.055, y: 0.11 - r * 0.09, z: 0.2, sx: 0.04, sy: 0.055, sz: 0.03,
      }))),
      p(SL, 0x6a7080, MAT.steel, { y: 0.065, z: 0.205, sx: 0.19, sy: 0.006, sz: 0.05 }),
      p(SL, 0x6a7080, MAT.steel, { y: -0.025, z: 0.205, sx: 0.19, sy: 0.006, sz: 0.05 }),
      // Keypad, coin return, delivery flap.
      ...Array.from({ length: 9 }, (_, i) => p(SL, 0x3a3f48, MAT.polymer, {
        x: 0.15, y: 0.12 - Math.floor(i / 3) * 0.035, z: 0.06 - (i % 3) * 0.035,
        sx: 0.008, sy: 0.026, sz: 0.026,
      })),
      glow(B, 0xff9a3c, { x: 0.156, y: 0.155, z: 0.02, sx: 0.004, sy: 0.02, sz: 0.11 }),
      p(B, 0x14161a, MAT.polymer, { y: -0.11, z: 0.22, sx: 0.18, sy: 0.07, sz: 0.014 }),
      p(SL, 0x6a7080, MAT.steel, { y: -0.075, z: 0.226, sx: 0.19, sy: 0.012, sz: 0.008 }),
      // Muzzle: the delivery chute, and it is loaded.
      p(UNIT.pipe, 0x6a7080, MAT.steel, { y: -0.02, z: 0.3, rx: Math.PI / 2, sx: 0.14, sy: 0.16, sz: 0.14 }),
      p(BB, 0xd9a441, MAT.polymer, { y: -0.02, z: 0.34, sx: 0.09, sy: 0.05, sz: 0.05 }),
      p(SL, 0x8ab45a, MAT.polymer, { y: -0.005, z: 0.345, sx: 0.095, sy: 0.008, sz: 0.055 }),
      // Grip bolted to the underside, and a cooling fan on the back.
      ...pistolGrip({ z: -0.1, y: -0.24, angle: 0.24, h: 0.26, color: 0x3a3f48 }),
      ...triggerGuard({ z: -0.04, y: -0.16 }),
      p(UNIT.pipe, 0x3a3f48, MAT.polymer, { y: 0.02, z: -0.23, rx: Math.PI / 2, sx: 0.17, sy: 0.03, sz: 0.17 }),
      ...Array.from({ length: 5 }, (_, i) => p(SL, 0x5a6270, MAT.alloy, {
        y: 0.02, z: -0.235, rz: i * 0.63, sx: 0.14, sy: 0.02, sz: 0.008,
      })),
      glow(B, 0xffd24a, { y: 0.19, z: 0.18, sx: 0.16, sy: 0.008, sz: 0.03 }),
    ];
    return { parts };
  },

  grappler() {
    // A line thrower: a big reel of cable, a launch rail and a four-fluke hook.
    const reel = [];
    for (let i = 0; i < 9; i++) {
      reel.push(p(UNIT.pipe, 0x2a2d33, MAT.rubber, {
        y: 0.14, z: -0.1, rz: Math.PI / 2, sx: 0.13 + i * 0.006, sy: 0.1, sz: 0.13 + i * 0.006,
      }));
    }
    const parts = [
      ...receiver({ z: 0.04, len: 0.42, w: 0.11, h: 0.15, color: 0x3f4a56, mat: MAT.alloy }),
      ...pistolGrip({ z: -0.1, y: -0.14, angle: 0.26, h: 0.26, color: 0x232830 }),
      ...triggerGuard({ z: -0.03, y: -0.055 }),
      // Reel with its side plates and a ratchet.
      p(DS, 0x5a6470, MAT.alloy, { x: 0.055, y: 0.14, z: -0.1, rz: Math.PI / 2, sx: 0.24, sy: 0.02, sz: 0.24 }),
      p(DS, 0x5a6470, MAT.alloy, { x: -0.055, y: 0.14, z: -0.1, rz: Math.PI / 2, sx: 0.24, sy: 0.02, sz: 0.24 }),
      ...Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return p(B, 0x3f4a56, MAT.alloy, {
          x: 0.066, y: 0.14 + Math.sin(a) * 0.1, z: -0.1 + Math.cos(a) * 0.1,
          rx: a, sx: 0.006, sy: 0.03, sz: 0.02,
        });
      }),
      ...reel,
      // Launch rail with the cable running along it.
      ...rail(0.16, 0.5, 0.09, 0.09),
      p(CY, 0x8d939c, MAT.steel, { y: 0.11, z: 0.34, rx: Math.PI / 2, sx: 0.016, sy: 0.42, sz: 0.016 }),
      // The hook itself, sitting in the rail.
      p(CY, 0x8a939c, MAT.steel, { y: 0.115, z: 0.46, rx: Math.PI / 2, sx: 0.03, sy: 0.16, sz: 0.03 }),
      ...Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + 0.78;
        return p(WG, 0xc9a227, MAT.steel, {
          x: Math.cos(a) * 0.045, y: 0.115 + Math.sin(a) * 0.045, z: 0.55,
          rz: a, sx: 0.02, sy: 0.09, sz: 0.09,
        });
      }),
      p(CN, 0xc9a227, MAT.steel, { y: 0.115, z: 0.6, rx: -Math.PI / 2, sx: 0.05, sy: 0.09, sz: 0.05 }),
      // Winch motor and its warning stripe.
      p(CY, 0x232830, MAT.paint, { x: -0.1, y: 0.06, z: -0.14, rz: Math.PI / 2, sx: 0.09, sy: 0.09, sz: 0.09 }),
      ...Array.from({ length: 3 }, (_, i) => p(B, 0xd8b43a, MAT.paint, {
        x: -0.145, y: 0.06, z: -0.14, rz: Math.PI / 2, rx: i * 0.5, sx: 0.085, sy: 0.004, sz: 0.02,
      })),
      glow(B, 0x6fd8ff, { x: 0.058, y: 0.02, z: 0.02, sx: 0.006, sy: 0.03, sz: 0.24 }),
      glow(RG, 0x6fd8ff, { x: 0.056, y: 0.14, z: -0.1, rz: Math.PI / 2, sx: 0.09, sy: 0.09, sz: 0.09 }),
    ];
    return { parts, anim: { reel: { parts: reel, axis: 'x' } } };
  },

  harpoon() {
    // Reel Talk: a pneumatic speargun with a fishing reel and a barbed shaft.
    const parts = [
      p(BB, 0x2a4a52, MAT.paint, { y: 0.0, z: 0.1, sx: 0.09, sy: 0.11, sz: 0.7 }),
      p(UNIT.pipe, 0x3d6670, MAT.alloy, { y: 0.0, z: 0.1, rx: Math.PI / 2, sx: 0.12, sy: 0.62, sz: 0.12 }),
      ...Array.from({ length: 5 }, (_, i) => p(RG, 0x568a96, MAT.alloy, {
        y: 0, z: -0.14 + i * 0.14, sx: 0.14, sy: 0.14, sz: 0.14,
      })),
      // Pressure vessel underneath with a gauge.
      p(CY, 0x1e363c, MAT.paint, { y: -0.085, z: 0.08, rx: Math.PI / 2, sx: 0.075, sy: 0.5, sz: 0.075 }),
      p(CY, 0xd8d4c8, MAT.polymer, { x: 0.05, y: -0.085, z: -0.16, rz: Math.PI / 2, sx: 0.05, sy: 0.02, sz: 0.05 }),
      glow(B, 0x5affc8, { x: 0.056, y: -0.085, z: -0.16, rz: 1.1, sx: 0.004, sy: 0.02, sz: 0.004 }),
      // Fishing reel on the side, spooled with line.
      p(DS, 0x8d939c, MAT.steel, { x: 0.1, y: 0.06, z: -0.1, rz: Math.PI / 2, sx: 0.19, sy: 0.03, sz: 0.19 }),
      ...Array.from({ length: 7 }, (_, i) => p(UNIT.pipe, 0xe4e4d8, MAT.polymer, {
        x: 0.1, y: 0.06, z: -0.1, rz: Math.PI / 2, sx: 0.1 + i * 0.008, sy: 0.028, sz: 0.1 + i * 0.008,
      })),
      p(C, 0x8d939c, MAT.steel, { x: 0.13, y: 0.06, z: -0.1, rz: Math.PI / 2, sx: 0.03, sy: 0.06, sz: 0.03 }),
      p(SP, 0x14161a, MAT.rubber, { x: 0.17, y: 0.06, z: -0.1, sx: 0.04, sy: 0.04, sz: 0.04 }),
      // The shaft, barbed, with the line tied to it.
      p(CY, 0xb6bcc6, MAT.steel, { y: 0.0, z: 0.62, rx: Math.PI / 2, sx: 0.022, sy: 0.72, sz: 0.022 }),
      p(CN, 0xdde4ec, MAT.steel, { y: 0.0, z: 1.0, rx: -Math.PI / 2, sx: 0.045, sy: 0.13, sz: 0.045 }),
      ...[1, -1].flatMap((s) => [0, 1].map((i) => p(WG, 0x9aa2ac, MAT.steel, {
        x: s * 0.028, y: 0, z: 0.86 - i * 0.1, rz: s > 0 ? 0.6 : -0.6,
        sx: 0.012, sy: 0.06, sz: 0.07,
      }))),
      p(CY, 0xe4e4d8, MAT.polymer, { x: 0.05, y: 0.03, z: 0.3, rz: -0.6, rx: 1.2, sx: 0.004, sy: 0.34, sz: 0.004 }),
      ...pistolGrip({ z: -0.14, y: -0.13, angle: 0.28, h: 0.26, color: 0x14262a }),
      ...triggerGuard({ z: -0.07, y: -0.05, color: 0x2a4a52, mat: MAT.paint }),
      ...sights({ frontZ: 0.42, rearZ: -0.12, y: 0.07, color: 0x1e363c }),
      glow(B, 0x5affc8, { y: 0.06, z: 0.0, sx: 0.03, sy: 0.006, sz: 0.3 }),
    ];
    return { parts };
  },

  zapper() {
    // Bug Zapper Mk. Eleven: a tesla emitter in a cage, still labelled Mk. X
    // with the X crossed out.
    const parts = [
      ...receiver({ z: -0.02, len: 0.4, w: 0.1, h: 0.14, color: 0x3a3348, mat: MAT.paint, port: false }),
      ...pistolGrip({ z: -0.12, y: -0.13, angle: 0.26, h: 0.26, color: 0x241f2e }),
      ...triggerGuard({ z: -0.05, y: -0.05, color: 0x3a3348, mat: MAT.paint }),
      // Transformer stack.
      ...Array.from({ length: 6 }, (_, i) => p(DS, i % 2 ? 0xc98a4a : 0x241f2e, i % 2 ? MAT.copper : MAT.polymer, {
        y: 0.02, z: 0.12 + i * 0.05, rx: Math.PI / 2, sx: 0.17 - i * 0.012, sy: 0.04, sz: 0.17 - i * 0.012,
      })),
      // Emitter cage: four struts and two rings.
      ...[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + 0.78;
        return p(C, 0x8d939c, MAT.steel, {
          x: Math.cos(a) * 0.085, y: 0.02 + Math.sin(a) * 0.085, z: 0.52,
          rx: Math.PI / 2, sx: 0.014, sy: 0.28, sz: 0.014,
        });
      }),
      p(RG, 0x8d939c, MAT.steel, { y: 0.02, z: 0.42, sx: 0.19, sy: 0.19, sz: 0.19 }),
      p(RG, 0x8d939c, MAT.steel, { y: 0.02, z: 0.64, sx: 0.19, sy: 0.19, sz: 0.19 }),
      // Twin electrodes with an arc between them.
      p(CY, 0xc98a4a, MAT.copper, { x: 0.035, y: 0.02, z: 0.54, rx: Math.PI / 2, sx: 0.022, sy: 0.18, sz: 0.022 }),
      p(CY, 0xc98a4a, MAT.copper, { x: -0.035, y: 0.02, z: 0.54, rx: Math.PI / 2, sx: 0.022, sy: 0.18, sz: 0.022 }),
      p(SP, 0xe4e9f0, MAT.chrome, { x: 0.035, y: 0.02, z: 0.63, sx: 0.04, sy: 0.04, sz: 0.04 }),
      p(SP, 0xe4e9f0, MAT.chrome, { x: -0.035, y: 0.02, z: 0.63, sx: 0.04, sy: 0.04, sz: 0.04 }),
      glow(B, 0x9fe4ff, { y: 0.02, z: 0.63, sx: 0.075, sy: 0.008, sz: 0.008 }),
      glow(SP, 0xd8f4ff, { y: 0.02, z: 0.63, sx: 0.05, sy: 0.05, sz: 0.05, opacity: 0.6 }),
      // Capacitor bank on top, charge lamps down the side.
      ...[0, 1, 2].map((i) => p(CY, 0x5a4a72, MAT.polymer, {
        x: -0.03 + i * 0.03, y: 0.11, z: -0.1, rx: Math.PI / 2, sx: 0.026, sy: 0.16, sz: 0.026,
      })),
      ...Array.from({ length: 5 }, (_, i) => glow(SP, i < 3 ? 0x9fe4ff : 0x2a3348, {
        x: 0.052, y: 0.03, z: -0.16 + i * 0.05, sx: 0.016, sy: 0.016, sz: 0.008,
      })),
      // The label.
      p(SL, 0xd8d4c8, MAT.polymer, { x: -0.052, y: 0.0, z: -0.06, sx: 0.006, sy: 0.05, sz: 0.14 }),
      glow(B, 0xff5a5a, { x: -0.056, y: 0.0, z: -0.06, rz: 0.6, sx: 0.004, sy: 0.006, sz: 0.05 }),
      glow(B, 0xff5a5a, { x: -0.056, y: 0.0, z: -0.06, rz: -0.6, sx: 0.004, sy: 0.006, sz: 0.05 }),
    ];
    return { parts };
  },

  sawblade() {
    // Circular Reasoning: a blade launcher with a magazine of discs on top.
    const discs = [];
    for (let i = 0; i < 4; i++) {
      discs.push(p(DS, 0xb6bcc6, MAT.steel, {
        y: 0.24, z: 0.11 - i * 0.05, rz: Math.PI / 2, sx: 0.22, sy: 0.012, sz: 0.22,
      }));
      for (let t = 0; t < 10; t++) {
        const a = (t / 10) * Math.PI * 2;
        discs.push(p(WG, 0xdde4ec, MAT.steel, {
          x: 0, y: 0.24 + Math.sin(a) * 0.11, z: 0.11 - i * 0.05 + Math.cos(a) * 0.11,
          rx: -a, sx: 0.012, sy: 0.04, sz: 0.04,
        }));
      }
    }
    const parts = [
      ...receiver({ z: 0.0, len: 0.46, w: 0.1, h: 0.15, color: 0x4a3f2e, mat: MAT.paint }),
      ...pistolGrip({ z: -0.12, y: -0.14, angle: 0.28, h: 0.26, color: 0x2e2820 }),
      ...triggerGuard({ z: -0.05, y: -0.055 }),
      // Blade magazine: two side plates and a floor, open at the top so the
      // discs are actually visible. A closed box just hides them.
      p(SL, 0x2e2820, MAT.paint, { x: 0.032, y: 0.15, z: 0.0, sx: 0.014, sy: 0.2, sz: 0.34 }),
      p(SL, 0x2e2820, MAT.paint, { x: -0.032, y: 0.15, z: 0.0, sx: 0.014, sy: 0.2, sz: 0.34 }),
      p(SL, 0x2e2820, MAT.paint, { y: 0.05, z: 0.0, sx: 0.08, sy: 0.02, sz: 0.34 }),
      p(SL, 0x2e2820, MAT.paint, { y: 0.15, z: -0.175, sx: 0.08, sy: 0.2, sz: 0.016 }),
      ...screws(3, { x: 0.04, y: 0.13, z0: -0.14, z1: 0.14 }),
      // Follower spring pushing the stack up.
      ...Array.from({ length: 5 }, (_, i) => p(RG, 0x8d939c, MAT.steel, {
        y: 0.07 + i * 0.012, z: -0.13, rz: Math.PI / 2, sx: 0.05, sy: 0.05, sz: 0.05,
      })),
      ...discs,
      // Launch throat and guide rollers.
      p(UNIT.pipe, 0x6a7080, MAT.steel, { y: 0.06, z: 0.36, rz: Math.PI / 2, sx: 0.24, sy: 0.05, sz: 0.24 }),
      p(C, 0x8d939c, MAT.steel, { x: 0.05, y: 0.06, z: 0.42, rz: Math.PI / 2, sx: 0.05, sy: 0.03, sz: 0.05 }),
      p(C, 0x8d939c, MAT.steel, { x: -0.05, y: 0.06, z: 0.42, rz: Math.PI / 2, sx: 0.05, sy: 0.03, sz: 0.05 }),
      // Spin-up motor with a belt to the throat.
      p(CY, 0x2e2820, MAT.paint, { x: 0.08, y: -0.06, z: 0.14, rz: Math.PI / 2, sx: 0.08, sy: 0.07, sz: 0.08 }),
      p(UNIT.pipe, 0x14161a, MAT.rubber, { x: 0.08, y: 0.0, z: 0.28, rz: Math.PI / 2, ry: 0.5, sx: 0.2, sy: 0.02, sz: 0.32 }),
      ...sights({ frontZ: 0.44, rearZ: -0.12, y: -0.09, color: 0x2e2820 }),
      glow(B, 0xff9a3c, { x: 0.052, y: -0.02, z: 0.0, sx: 0.006, sy: 0.03, sz: 0.26 }),
    ];
    return { parts, anim: { discs: { parts: discs, axis: 'x' } } };
  },

  actuary() {
    // A charge rifle that looks like an instrument: long, spare, and precise.
    const parts = [
      ...receiver({ z: 0.0, len: 0.58, w: 0.075, h: 0.12, color: 0xd8d4cc, mat: MAT.paint }),
      p(SL, 0x2a2d33, MAT.paint, { y: 0.03, z: 0.0, sx: 0.078, sy: 0.05, sz: 0.56 }),
      ...rail(-0.24, 0.24, 0.065, 0.062),
      ...optic({ z: 0.02, y: 0.16, len: 0.36, r: 0.045, reticle: 0x6fd8ff, color: 0x1c1f24 }),
      // Long fluted barrel in a skeleton shroud.
      ...barrel({ z0: 0.28, len: 0.6, r: 0.017, color: 0x2a2d33, fluted: true }),
      ...Array.from({ length: 4 }, (_, i) => p(RG, 0xd8d4cc, MAT.paint, {
        z: 0.36 + i * 0.16, sx: 0.09, sy: 0.09, sz: 0.09,
      })),
      p(C, 0xd8d4cc, MAT.paint, { x: 0.04, y: 0.03, z: 0.56, rx: Math.PI / 2, sx: 0.012, sy: 0.56, sz: 0.012 }),
      p(C, 0xd8d4cc, MAT.paint, { x: -0.04, y: 0.03, z: 0.56, rx: Math.PI / 2, sx: 0.012, sy: 0.56, sz: 0.012 }),
      ...muzzle({ z: 0.87, r: 0.019, style: 'comp' }),
      // Charge cell in a transparent housing, with a graduated scale beside it.
      p(CY, 0x1c1f24, MAT.polymer, { y: -0.075, z: -0.12, rx: Math.PI / 2, sx: 0.06, sy: 0.24, sz: 0.06 }),
      p(UNIT.pipe, 0xbfe8ff, MAT.glass, { y: -0.075, z: -0.12, rx: Math.PI / 2, sx: 0.07, sy: 0.2, sz: 0.07 }),
      glow(CY, 0x6fd8ff, { y: -0.075, z: -0.16, rx: Math.PI / 2, sx: 0.05, sy: 0.09, sz: 0.05 }),
      ...Array.from({ length: 6 }, (_, i) => p(B, 0x1c1f24, MAT.paint, {
        x: 0.05, y: -0.075, z: -0.21 + i * 0.035, sx: 0.006, sy: 0.014, sz: 0.005,
      })),
      ...pistolGrip({ z: -0.16, y: -0.13, angle: 0.24, h: 0.26, color: 0x1c1f24 }),
      ...triggerGuard({ z: -0.09, y: -0.05, color: 0xd8d4cc, mat: MAT.paint }),
      ...stock({ z: -0.5, len: 0.34, skeleton: true, color: 0x1c1f24 }),
      // Bipod, folded back along the barrel.
      p(C, 0x2a2d33, MAT.alloy, { x: 0.03, y: -0.07, z: 0.42, rx: 1.2, sx: 0.012, sy: 0.2, sz: 0.012 }),
      p(C, 0x2a2d33, MAT.alloy, { x: -0.03, y: -0.07, z: 0.42, rx: 1.2, sx: 0.012, sy: 0.2, sz: 0.012 }),
      glow(B, 0x6fd8ff, { x: 0.04, y: -0.02, z: 0.0, sx: 0.005, sy: 0.02, sz: 0.34 }),
    ];
    return { parts };
  },

  prototype() {
    // Kimvatch's Prototype: half-built, still on the bench, wires everywhere
    // and a hand-lettered warning where a serial number should be.
    const parts = [
      ...receiver({ z: 0.0, len: 0.44, w: 0.1, h: 0.14, color: 0x5a5f68, mat: MAT.alloy, panel: false }),
      // Exposed internals: no side plate, just a rats' nest.
      ...Array.from({ length: 8 }, (_, i) => p(C, [0xc93a3a, 0x3ac95a, 0x3a6ac9, 0xd8b43a][i % 4], MAT.rubber, {
        x: 0.045, y: -0.03 + (i % 4) * 0.025, z: -0.1 + Math.sin(i) * 0.09,
        rx: Math.PI / 2, rz: Math.sin(i * 2) * 0.5, sx: 0.007, sy: 0.24, sz: 0.007,
      })),
      p(BB, 0x1c3a24, MAT.polymer, { x: -0.05, y: 0.0, z: 0.0, sx: 0.01, sy: 0.1, sz: 0.28 }),
      ...Array.from({ length: 6 }, (_, i) => p(B, 0xc9a227, MAT.brass, {
        x: -0.056, y: -0.03 + (i % 3) * 0.03, z: -0.08 + Math.floor(i / 3) * 0.1,
        sx: 0.004, sy: 0.016, sz: 0.03,
      })),
      // Three different barrels, because he could not decide.
      ...barrel({ z0: 0.24, len: 0.34, r: 0.017, y: 0.03 }),
      p(CY, 0x8d939c, MAT.steel, { x: 0.045, y: -0.03, z: 0.36, rx: Math.PI / 2, sx: 0.026, sy: 0.26, sz: 0.026 }),
      p(HX, 0xc98a4a, MAT.copper, { x: -0.045, y: -0.03, z: 0.34, rx: Math.PI / 2, sx: 0.03, sy: 0.22, sz: 0.03 }),
      // A dial with far too many positions, and a lamp that is never the same.
      p(DS, 0x2a2d33, MAT.polymer, { x: 0.0, y: 0.09, z: -0.1, sx: 0.11, sy: 0.03, sz: 0.11 }),
      ...Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return p(B, 0xd8d4c8, MAT.polymer, {
          x: Math.cos(a) * 0.042, y: 0.106, z: -0.1 + Math.sin(a) * 0.042,
          ry: -a, sx: 0.004, sy: 0.004, sz: 0.014,
        });
      }),
      p(SL, 0xc93a3a, MAT.paint, { y: 0.108, z: -0.075, sx: 0.008, sy: 0.006, sz: 0.05 }),
      glow(SP, 0xff6fd8, { y: 0.12, z: 0.06, sx: 0.03, sy: 0.03, sz: 0.03 }),
      // Duct tape holding the front end on.
      p(UNIT.pipe, 0xb8b0a0, MAT.rubber, { y: 0.0, z: 0.22, rx: Math.PI / 2, sx: 0.14, sy: 0.05, sz: 0.14 }),
      // Hand-lettered label.
      p(SL, 0xd8d4c8, MAT.polymer, { x: 0.052, y: 0.045, z: 0.1, sx: 0.005, sy: 0.04, sz: 0.11 }),
      glow(B, 0xff3a3a, { x: 0.056, y: 0.045, z: 0.1, sx: 0.004, sy: 0.008, sz: 0.08 }),
      ...pistolGrip({ z: -0.12, y: -0.13, angle: 0.26, h: 0.26, color: 0x2b2f36, grooves: 1 }),
      ...triggerGuard({ z: -0.05, y: -0.05, color: 0x5a5f68, mat: MAT.alloy }),
    ];
    return { parts };
  },

  // -- melee ----------------------------------------------------------------

  bigknife() {
    // Staggeringly large. A slab of steel with a fuller, a serrated spine and
    // a wrapped handle that is still too small for it.
    const parts = [
      // Blade: tapered slab, ground bevel, deep fuller.
      p(BB, 0xc4ccd6, MAT.steel, { y: 0.3, z: 0.62, sx: 0.05, sy: 0.46, sz: 1.7 }),
      p(WG, 0xdde4ec, MAT.steel, { y: 0.46, z: 1.42, rx: 0, ry: 0, sx: 0.05, sy: 0.3, sz: 0.5 }),
      p(WG, 0xdde4ec, MAT.steel, { y: 0.14, z: 1.42, rz: Math.PI, sx: 0.05, sy: 0.3, sz: 0.5 }),
      // Cutting edge, polished bright.
      p(B, 0xf2f6fa, MAT.chrome, { y: 0.09, z: 0.62, rz: 0.06, sx: 0.022, sy: 0.05, sz: 1.66 }),
      // Fuller — the groove that makes it read as forged, not cut from plate.
      p(B, 0x8d97a4, MAT.steel, { x: 0.021, y: 0.32, z: 0.6, sx: 0.014, sy: 0.1, sz: 1.4 }),
      p(B, 0x8d97a4, MAT.steel, { x: -0.021, y: 0.32, z: 0.6, sx: 0.014, sy: 0.1, sz: 1.4 }),
      // Serrated spine.
      ...Array.from({ length: 12 }, (_, i) => p(WG, 0xb6bcc6, MAT.steel, {
        y: 0.53, z: 0.22 + i * 0.085, rz: Math.PI / 2, rx: Math.PI, sx: 0.05, sy: 0.05, sz: 0.05,
      })),
      // Guard, ricasso and a maker's stamp.
      p(BB, 0x6a5a3a, MAT.brass, { y: 0.28, z: -0.1, sx: 0.09, sy: 0.34, sz: 0.08 }),
      p(SL, 0x8a7a40, MAT.brass, { y: 0.28, z: -0.16, sx: 0.13, sy: 0.4, sz: 0.05 }),
      p(SL, 0x9aa2ac, MAT.steel, { x: 0.026, y: 0.3, z: 0.05, sx: 0.004, sy: 0.08, sz: 0.12 }),
      // Handle: cord wrap over a full tang, with a lanyard pin.
      p(BB, 0x2a1f16, MAT.rubber, { y: 0.24, z: -0.42, sx: 0.075, sy: 0.11, sz: 0.5 }),
      ...Array.from({ length: 11 }, (_, i) => p(C, 0x4a3a26, MAT.rubber, {
        y: 0.24, z: -0.22 - i * 0.042, rz: Math.PI / 2, rx: 0.2, sx: 0.13, sy: 0.085, sz: 0.09,
      })),
      p(HX, 0x8a7a40, MAT.brass, { y: 0.24, z: -0.68, rz: Math.PI / 2, sx: 0.1, sy: 0.09, sz: 0.1 }),
      p(RG, 0x8a7a40, MAT.brass, { y: 0.12, z: -0.72, rx: Math.PI / 2, sx: 0.06, sy: 0.06, sz: 0.06 }),
      glow(B, 0x9fe4ff, { y: 0.09, z: 0.62, sx: 0.014, sy: 0.014, sz: 1.5 }),
    ];
    return { parts };
  },

  tinyknife() {
    // Staggeringly tiny, and modelled with exactly as much care as the big one
    // — that is the joke. Everything is here, just at 6% scale.
    const parts = [
      p(BB, 0xc4ccd6, MAT.steel, { y: 0.02, z: 0.075, sx: 0.008, sy: 0.024, sz: 0.11 }),
      p(WG, 0xdde4ec, MAT.steel, { y: 0.03, z: 0.13, sx: 0.008, sy: 0.016, sz: 0.035 }),
      p(B, 0xf2f6fa, MAT.chrome, { y: 0.009, z: 0.075, sx: 0.004, sy: 0.004, sz: 0.105 }),
      p(B, 0x8d97a4, MAT.steel, { x: 0.0035, y: 0.022, z: 0.07, sx: 0.002, sy: 0.006, sz: 0.085 }),
      p(BB, 0x6a5a3a, MAT.brass, { y: 0.018, z: 0.012, sx: 0.016, sy: 0.024, sz: 0.008 }),
      p(BB, 0x2a1f16, MAT.rubber, { y: 0.016, z: -0.035, sx: 0.014, sy: 0.02, sz: 0.08 }),
      ...Array.from({ length: 5 }, (_, i) => p(C, 0x4a3a26, MAT.rubber, {
        y: 0.016, z: -0.008 - i * 0.014, rz: Math.PI / 2, sx: 0.024, sy: 0.016, sz: 0.018,
      })),
      p(HX, 0x8a7a40, MAT.brass, { y: 0.016, z: -0.078, rz: Math.PI / 2, sx: 0.02, sy: 0.016, sz: 0.02 }),
      glow(B, 0xff8ad0, { y: 0.009, z: 0.09, sx: 0.003, sy: 0.003, sz: 0.07 }),
      // A presentation cushion, because it deserves one.
      p(BB, 0x5a1a2a, MAT.rubber, { y: -0.02, z: 0.0, sx: 0.13, sy: 0.012, sz: 0.2 }),
      p(SL, 0xc9a227, MAT.brass, { y: -0.013, z: -0.08, sx: 0.09, sy: 0.004, sz: 0.03 }),
    ];
    return { parts };
  },

  sanguine() {
    // The Sanguine Ledger: a straight-bladed sword with a channel down the
    // middle that fills as it drains you, and a counter at the guard.
    const parts = [
      p(BB, 0x4a1018, MAT.steel, { y: 0.26, z: 0.6, sx: 0.045, sy: 0.26, sz: 1.4 }),
      p(WG, 0x6a1a24, MAT.steel, { y: 0.36, z: 1.28, sx: 0.045, sy: 0.16, sz: 0.42 }),
      p(WG, 0x6a1a24, MAT.steel, { y: 0.16, z: 1.28, rz: Math.PI, sx: 0.045, sy: 0.16, sz: 0.42 }),
      // The blood channel, and the fluid in it.
      p(B, 0x1c060a, MAT.blued, { y: 0.26, z: 0.6, sx: 0.05, sy: 0.075, sz: 1.36 }),
      glow(B, 0xff2a3c, { y: 0.26, z: 0.5, sx: 0.052, sy: 0.05, sz: 1.1 }),
      p(B, 0xc4a8ac, MAT.chrome, { y: 0.14, z: 0.6, sx: 0.02, sy: 0.03, sz: 1.36 }),
      // Ledger rules etched down the flat.
      ...Array.from({ length: 9 }, (_, i) => p(B, 0x8a3a44, MAT.steel, {
        x: 0.024, y: 0.34, z: 0.06 + i * 0.13, sx: 0.003, sy: 0.05, sz: 0.008,
      })),
      // Cross guard shaped like a balance, with two pans.
      p(BB, 0x2a1218, MAT.cast, { y: 0.24, z: -0.1, sx: 0.34, sy: 0.05, sz: 0.075 }),
      p(DS, 0x8a2030, MAT.cast, { x: 0.15, y: 0.19, z: -0.1, sx: 0.1, sy: 0.02, sz: 0.1 }),
      p(DS, 0x8a2030, MAT.cast, { x: -0.15, y: 0.21, z: -0.1, sx: 0.1, sy: 0.02, sz: 0.1 }),
      p(C, 0x2a1218, MAT.cast, { x: 0.15, y: 0.215, z: -0.1, sx: 0.004, sy: 0.05, sz: 0.004 }),
      p(C, 0x2a1218, MAT.cast, { x: -0.15, y: 0.225, z: -0.1, sx: 0.004, sy: 0.05, sz: 0.004 }),
      // The counter: a small dark window with digits burning in it.
      p(BB, 0x14080c, MAT.polymer, { y: 0.24, z: -0.2, sx: 0.11, sy: 0.075, sz: 0.05 }),
      glow(B, 0xff3a4a, { y: 0.24, z: -0.226, sx: 0.085, sy: 0.045, sz: 0.006 }),
      ...Array.from({ length: 4 }, (_, i) => p(B, 0x14080c, MAT.polymer, {
        x: -0.03 + i * 0.02, y: 0.24, z: -0.23, sx: 0.003, sy: 0.05, sz: 0.004,
      })),
      // Grip: wound wire over leather, with a heavy pommel.
      p(BB, 0x1c0e12, MAT.rubber, { y: 0.24, z: -0.42, sx: 0.06, sy: 0.075, sz: 0.36 }),
      ...Array.from({ length: 9 }, (_, i) => p(C, 0x6a5a3a, MAT.brass, {
        y: 0.24, z: -0.28 - i * 0.036, rz: Math.PI / 2, rx: 0.25, sx: 0.09, sy: 0.07, sz: 0.075,
      })),
      p(OCTA_POMMEL, 0x8a2030, MAT.cast, { y: 0.24, z: -0.63, sx: 0.11, sy: 0.11, sz: 0.11 }),
      glow(SP, 0xff3a4a, { y: 0.24, z: -0.63, sx: 0.055, sy: 0.055, sz: 0.055 }),
    ];
    return { parts };
  },

  mop() {
    // A real mop, in genuinely poor condition. Laid along +Z with a slight
    // tilt so the head sits where the muzzle would; the first version rotated
    // the handle without moving the head and the two came apart.
    const tilt = 0.18;
    const along = (t) => ({ y: 0.06 - Math.sin(tilt) * t, z: t });   // t = distance up the shaft
    const parts = [];
    const shaft = along(0.24);
    parts.push(p(CY, 0x9a7a4a, MAT.wood, { ...shaft, rx: Math.PI / 2 - tilt, sx: 0.048, sy: 1.15, sz: 0.048 }));
    // Grain, a taped repair, and the hanging hole at the butt.
    for (let i = 0; i < 4; i++) {
      const t = -0.3 + i * 0.34;
      parts.push(p(C, 0x846542, MAT.wood, { ...along(t), rx: Math.PI / 2 - tilt, rz: i * 0.7, sx: 0.052, sy: 0.3, sz: 0.03 }));
    }
    const tape = along(0.1);
    parts.push(p(UNIT.pipe, 0x2a4a8a, MAT.rubber, { ...tape, rx: Math.PI / 2 - tilt, sx: 0.062, sy: 0.13, sz: 0.062 }));
    const butt = along(-0.34);
    parts.push(p(RG, 0x9a7a4a, MAT.wood, { ...butt, rx: 0, sx: 0.05, sy: 0.05, sz: 0.05 }));
    parts.push(p(UNIT.pipe, 0x8d939c, MAT.steel, { ...along(-0.31), rx: Math.PI / 2 - tilt, sx: 0.056, sy: 0.06, sz: 0.056 }));

    // Collar, clamp and the head, all hung off the far end of the same axis.
    const neck = along(0.72);
    parts.push(p(UNIT.pipe, 0x8d939c, MAT.steel, { ...neck, rx: Math.PI / 2 - tilt, sx: 0.075, sy: 0.16, sz: 0.075 }));
    parts.push(p(HX, 0x6a7080, MAT.steel, { x: 0.05, y: neck.y, z: neck.z, rz: Math.PI / 2, sx: 0.03, sy: 0.035, sz: 0.03 }));
    const head = along(0.84);
    parts.push(p(BB, 0xd4d8dc, MAT.polymer, { ...head, sx: 0.3, sy: 0.11, sz: 0.2 }));
    parts.push(p(SL, 0x9aa0aa, MAT.steel, { x: 0, y: head.y + 0.056, z: head.z, sx: 0.31, sy: 0.018, sz: 0.21 }));
    // Strands: a wet, matted mass, some clumped, hanging down and forward.
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 0.05 + (i % 3) * 0.04;
      parts.push(p(C, i % 4 ? 0xe4e8ec : 0xb8bcc0, MAT.rubber, {
        x: Math.cos(a) * r,
        y: head.y - 0.16 - (i % 5) * 0.03,
        z: head.z + Math.sin(a) * r * 0.65 + 0.01,
        rx: Math.sin(i) * 0.3, rz: Math.cos(i * 1.7) * 0.35,
        sx: 0.019, sy: 0.34 + (i % 4) * 0.07, sz: 0.019,
      }));
    }
    // The grime, and a suspicious sheen it did not start with.
    parts.push(p(SP, 0x6a7a4a, MAT.rubber, { x: 0.02, y: head.y - 0.32, z: head.z, sx: 0.13, sy: 0.08, sz: 0.11, smooth: true }));
    parts.push(glow(SP, 0x9dff4a, { x: 0.02, y: head.y - 0.34, z: head.z + 0.02, sx: 0.07, sy: 0.035, sz: 0.06, opacity: 0.5 }));
    // PROPERTY OF THE POD, stuck on at eye level.
    const label = along(0.3);
    parts.push(p(SL, 0xd8d4c8, MAT.polymer, { x: 0.05, y: label.y, z: label.z, rx: -tilt, sx: 0.004, sy: 0.06, sz: 0.11 }));
    parts.push(glow(B, 0x3ad98a, { x: 0.054, y: label.y, z: label.z, rx: -tilt, sx: 0.004, sy: 0.014, sz: 0.07 }));
    return { parts };
  },
};

// `OCTA_POMMEL` is just the octahedron, named where it is used.
const OCTA_POMMEL = UNIT.octa;

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Build a weapon. Returns a Group whose `userData.anim` maps names to the
 * sub-groups the viewmodel animates (slide, bolt, cylinder, magazine, …), each
 * carrying its rest transform so the animator can offset from it.
 */
export function buildWeapon(id, weapon) {
  const builder = BUILDERS[id];
  const built = builder ? builder(weapon) : {
    parts: [
      ...receiver({ z: 0, len: 0.5, w: 0.09, h: 0.13 }),
      ...barrel({ z0: 0.26, len: 0.3, r: 0.018 }),
      ...pistolGrip({}), ...triggerGuard({}),
    ],
  };

  const group = new THREE.Group();
  const body = assemble(built.parts);
  group.add(body);

  const anim = {};
  if (built.anim) {
    for (const [name, spec] of Object.entries(built.anim)) {
      if (!spec.parts || !spec.parts.length) continue;
      const node = assemble(spec.parts);
      node.userData.axis = spec.axis || null;
      node.userData.recoil = spec.recoil || 0;
      group.add(node);
      anim[name] = node;
    }
  }
  group.userData.anim = anim;
  group.userData.partCount = built.parts.length
    + Object.values(built.anim || {}).reduce((n, s) => n + (s.parts?.length || 0), 0);
  return group;
}

export const WEAPON_MODEL_IDS = Object.keys(BUILDERS);
