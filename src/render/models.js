// Every mesh in the game is built from primitives here — there are no external
// art assets. Enemies are assembled as a small rig (upper body + two legs) so
// the animation code has something to swing.

import * as THREE from '../../vendor/three.module.js';
import { UNIT, assemble } from '../world/geometry.js';
import { buildWeapon } from './weaponModels.js';

const B = UNIT.box, S = UNIT.lowSphere, C = UNIT.lowCyl, IC = UNIT.icosa, OC = UNIT.octa, CN = UNIT.cone;

function part(geo, color, o = {}) { return { geo, color, ...o }; }
function emit(geo, color, o = {}) { return { geo, color, basic: true, ...o }; }

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
//
// Every enemy is modelled individually rather than from a shared humanoid
// template — silhouette is the only thing that reads at combat distance, so the
// undead hunch, the machines are boxy and symmetrical, the creatures are low and
// wide, and the anomalies are broken apart. Each builder returns its parts split
// into an upper body and two legs so the animator has a rig, plus the head's
// centre and radius, which the headshot test uses directly.

const SKIN = 0x9aa88e;
const TAU_M = Math.PI * 2;

/**
 * @returns {{upper:Array, legL:Array, legR:Array, pivot:number,
 *            headY:number, headR:number, flying?:boolean, wobble?:number}}
 */
const ENEMY_BUILDERS = {

  // -- undead ---------------------------------------------------------------

  shambler(b, h) {
    const legH = h * 0.44, torso = h * 0.34;
    const headY = legH + torso + 0.14;
    const bone = 0xc8cdb4, gore = 0x5a1f22;
    return {
      pivot: legH, headY, headR: 0.2,
      upper: [
        // Hunched, twisted torso — one shoulder dropped, the spine off-axis.
        part(UNIT.bevelBox, b.body, { y: legH + torso * 0.5, rx: 0.2, rz: 0.06, sx: 0.6, sy: torso, sz: 0.34 }),
        part(UNIT.bevelBox, shadeHex(b.body, 0.82), { y: legH + torso * 0.94, rz: 0.13, sx: 0.82, sy: 0.19, sz: 0.4 }),
        // A hole torn out of the chest, with the ribs behind it.
        part(B, 0x1a0d0e, { y: legH + torso * 0.56, z: 0.15, rx: 0.2, sx: 0.34, sy: torso * 0.5, sz: 0.05 }),
        ...[0, 1, 2, 3].map((i) => part(C, bone, {
          y: legH + torso * (0.36 + i * 0.14), z: 0.17, rx: 0.2, rz: Math.PI / 2,
          sx: 0.05, sy: 0.4 - i * 0.05, sz: 0.05,
        })),
        part(C, bone, { y: legH + torso * 0.55, z: 0.16, rx: 0.2, sx: 0.05, sy: torso * 0.6, sz: 0.05 }),
        part(S, gore, { y: legH + torso * 0.44, z: 0.13, sx: 0.16, sy: 0.14, sz: 0.1 }),
        // Coat: torn panels hanging at different lengths, collar turned up.
        ...[0.22, -0.26, 0.05].map((x, i) => part(UNIT.slab, shadeHex(b.body, 0.62), {
          x, y: legH * (0.74 - i * 0.08), z: -0.04 - i * 0.02, rz: x * 0.7,
          sx: 0.26 - i * 0.03, sy: torso * (0.95 - i * 0.12), sz: 0.3,
        })),
        part(UNIT.slab, shadeHex(b.body, 0.5), { y: legH + torso * 0.9, z: -0.12, rx: -0.35, sx: 0.5, sy: 0.26, sz: 0.1 }),
        // Head: tilted, jaw hanging open, one eye gone.
        part(S, b.head, { y: headY, rz: 0.18, rx: -0.12, sx: 0.4, sy: 0.44, sz: 0.38, smooth: true }),
        part(UNIT.bevelBox, shadeHex(b.head, 0.78), { y: headY - 0.16, z: 0.09, rz: 0.18, rx: 0.3, sx: 0.24, sy: 0.13, sz: 0.2 }),
        ...[0, 1, 2, 3].map((i) => part(B, bone, {
          x: -0.06 + i * 0.04, y: headY - 0.11, z: 0.15, rz: 0.18, sx: 0.022, sy: 0.05, sz: 0.02,
        })),
        part(S, 0x0a0c0a, { x: -0.1, y: headY + 0.04, z: 0.15, sx: 0.13, sy: 0.13, sz: 0.08 }),
        emit(S, b.eye, { x: 0.11, y: headY + 0.03, z: 0.17, sx: 0.09, sy: 0.09, sz: 0.05 }),
        part(S, shadeHex(b.head, 0.6), { x: 0.02, y: headY + 0.18, z: -0.06, sx: 0.34, sy: 0.2, sz: 0.32, smooth: true }),
        // Long uneven arms, one hand curled, one missing fingers.
        part(C, b.body, { x: 0.4, y: legH + torso * 0.55, z: 0.08, rx: -0.5, sx: 0.15, sy: torso * 0.72, sz: 0.15 }),
        part(C, b.head, { x: 0.44, y: legH + torso * 0.08, z: 0.32, rx: -0.85, sx: 0.13, sy: torso * 0.6, sz: 0.13 }),
        part(S, b.head, { x: 0.46, y: legH - torso * 0.18, z: 0.44, sx: 0.15, sy: 0.14, sz: 0.15, smooth: true }),
        ...[0, 1, 2].map((i) => part(C, b.head, {
          x: 0.42 + i * 0.04, y: legH - torso * 0.3, z: 0.44, rx: -0.5, sx: 0.04, sy: 0.14, sz: 0.04,
        })),
        part(C, b.body, { x: -0.38, y: legH + torso * 0.58, z: 0.02, rx: -0.28, sx: 0.14, sy: torso * 0.7, sz: 0.14 }),
        part(C, b.head, { x: -0.4, y: legH + torso * 0.1, z: 0.14, rx: -0.15, sx: 0.12, sy: torso * 0.55, sz: 0.12 }),
        part(C, bone, { x: -0.4, y: legH - torso * 0.22, z: 0.18, sx: 0.05, sy: 0.16, sz: 0.05 }),
      ],
      legL: [
        part(C, b.body, { x: 0.16, y: -legH * 0.3, sx: 0.19, sy: legH * 0.62, sz: 0.19 }),
        part(C, b.body, { x: 0.16, y: -legH * 0.76, z: 0.02, sx: 0.15, sy: legH * 0.52, sz: 0.15 }),
        part(UNIT.bevelBox, shadeHex(b.body, 0.55), { x: 0.16, y: -legH + 0.05, z: 0.06, sx: 0.2, sy: 0.11, sz: 0.32 }),
        part(UNIT.slab, shadeHex(b.body, 0.7), { x: 0.16, y: -legH * 0.55, sx: 0.2, sy: 0.06, sz: 0.2 }),
      ],
      legR: [
        part(C, b.body, { x: -0.16, y: -legH * 0.32, rz: 0.08, sx: 0.18, sy: legH * 0.64, sz: 0.18 }),
        part(C, b.body, { x: -0.18, y: -legH * 0.78, z: 0.01, sx: 0.14, sy: legH * 0.5, sz: 0.14 }),
        part(UNIT.bevelBox, shadeHex(b.body, 0.55), { x: -0.18, y: -legH + 0.05, z: 0.05, sx: 0.19, sy: 0.11, sz: 0.3 }),
        // A strip of the trouser hanging loose.
        part(UNIT.slab, shadeHex(b.body, 0.62), { x: -0.24, y: -legH * 0.62, rz: -0.3, sx: 0.06, sy: 0.3, sz: 0.14 }),
      ],
    };
  },

  sprinter(b, h) {
    const legH = h * 0.52, torso = h * 0.26;
    const headY = legH + torso * 0.9;
    const bone = 0xe8d4c0, raw = 0x8a2a2a;
    // Everything about this thing says *forward*. The head clears the torso,
    // the arms trail behind, the ribcage has burst through the skin, and the
    // legs are already ahead of the centre of mass. Read at forty metres by
    // silhouette alone: a body falling in your direction on purpose.
    return {
      pivot: legH, headY, headR: 0.17,
      upper: [
        // Torso thrown flat forward, spine arched, ribs out through the front.
        part(UNIT.capsule, b.body, { y: legH + torso * 0.5, z: 0.16, rx: 0.62, sx: 0.36, sy: torso * 0.62, sz: 0.24 }),
        part(UNIT.wedge, shadeHex(b.body, 0.8), { y: legH + torso * 0.72, z: 0.02, rx: 0.62, ry: Math.PI, sx: 0.34, sy: 0.2, sz: 0.3 }),
        ...[0, 1, 2, 3].map((i) => part(C, bone, {
          y: legH + torso * (0.3 + i * 0.18), z: 0.28 + i * 0.075, rx: 0.62, rz: Math.PI / 2,
          sx: 0.05, sy: 0.34 - i * 0.045, sz: 0.05,
        })),
        part(C, bone, { y: legH + torso * 0.52, z: 0.3, rx: 0.62, sx: 0.05, sy: torso * 0.8, sz: 0.05 }),
        part(UNIT.lowSphere, raw, { y: legH + torso * 0.36, z: 0.3, sx: 0.2, sy: 0.16, sz: 0.12, smooth: true }),
        // Shoulders high and wide, clavicles showing.
        ...[1, -1].map((sg) => part(UNIT.lowSphere, b.body, {
          x: sg * 0.23, y: legH + torso * 0.86, z: 0.3, sx: 0.22, sy: 0.2, sz: 0.2, smooth: true,
        })),
        ...[1, -1].map((sg) => part(C, bone, {
          x: sg * 0.15, y: legH + torso * 0.92, z: 0.34, rz: sg * 1.2, sx: 0.035, sy: 0.2, sz: 0.035,
        })),
        // Head thrust out past the shoulders — the giveaway.
        part(UNIT.lowSphere, b.head, { y: headY, z: 0.52, sx: 0.31, sy: 0.32, sz: 0.36, smooth: true }),
        part(UNIT.wedge, shadeHex(b.head, 0.6), { y: headY - 0.13, z: 0.64, rx: -0.5, ry: Math.PI / 2, rz: Math.PI / 2, sx: 0.16, sy: 0.16, sz: 0.2 }),
        ...Array.from({ length: 6 }, (_, i) => part(UNIT.cone, bone, {
          x: -0.06 + (i % 3) * 0.06, y: headY - 0.1 + Math.floor(i / 3) * 0.075, z: 0.68,
          rx: Math.floor(i / 3) ? Math.PI : 0, sx: 0.035, sy: 0.1, sz: 0.035,
        })),
        emit(UNIT.lowSphere, b.eye, { x: 0.09, y: headY + 0.06, z: 0.66, sx: 0.11, sy: 0.11, sz: 0.06 }),
        emit(UNIT.lowSphere, b.eye, { x: -0.09, y: headY + 0.06, z: 0.66, sx: 0.11, sy: 0.11, sz: 0.06 }),
        // Matted hair whipped back by the run.
        ...[0, 1, 2, 3, 4].map((i) => part(UNIT.slab, shadeHex(b.head, 0.35), {
          x: -0.12 + i * 0.06, y: headY + 0.16, z: 0.4 - (i % 2) * 0.06, rx: -0.9, rz: (i - 2) * 0.18,
          sx: 0.07, sy: 0.3, sz: 0.05,
        })),
        // Arms flung back and out, hands open, fingers spread.
        ...[1, -1].flatMap((sg) => [
          part(UNIT.capsule, b.body, {
            x: sg * 0.4, y: legH + torso * 0.66, z: -0.02, rz: sg * 0.5, rx: -0.7,
            sx: 0.1, sy: torso * 0.5, sz: 0.1,
          }),
          part(UNIT.capsule, b.body, {
            x: sg * 0.56, y: legH + torso * 0.2, z: -0.34, rz: sg * 0.3, rx: -0.4,
            sx: 0.09, sy: torso * 0.46, sz: 0.09,
          }),
          part(UNIT.lowSphere, b.head, { x: sg * 0.62, y: legH - torso * 0.12, z: -0.5, sx: 0.13, sy: 0.15, sz: 0.13, smooth: true }),
          ...[0, 1, 2].map((i) => part(C, b.head, {
            x: sg * (0.6 + (i - 1) * 0.05), y: legH - torso * 0.3, z: -0.56, rx: -0.35, rz: sg * (i - 1) * 0.3,
            sx: 0.03, sy: 0.16, sz: 0.03,
          })),
        ]),
        // Shredded clothing trailing.
        ...[0, 1, 2].map((i) => part(UNIT.slab, shadeHex(b.body, 0.55), {
          x: (i - 1) * 0.16, y: legH + torso * (0.24 - i * 0.06), z: -0.24 - i * 0.06,
          rx: -0.5 - i * 0.15, rz: (i - 1) * 0.3, sx: 0.16, sy: 0.34, sz: 0.16,
        })),
      ],
      legL: [
        part(UNIT.capsule, b.body, { x: 0.13, y: -legH * 0.32, z: 0.1, rx: 0.5, sx: 0.13, sy: legH * 0.4, sz: 0.13 }),
        part(UNIT.lowSphere, b.head, { x: 0.13, y: -legH * 0.52, z: 0.16, sx: 0.15, sy: 0.15, sz: 0.15, smooth: true }),
        part(UNIT.capsule, b.body, { x: 0.13, y: -legH * 0.76, z: 0.04, rx: -0.3, sx: 0.11, sy: legH * 0.4, sz: 0.11 }),
        part(UNIT.wedge, shadeHex(b.body, 0.6), { x: 0.13, y: -legH + 0.05, z: 0.14, ry: Math.PI / 2, sx: 0.14, sy: 0.11, sz: 0.3 }),
      ],
      legR: [
        part(UNIT.capsule, b.body, { x: -0.13, y: -legH * 0.32, z: -0.08, rx: -0.5, sx: 0.13, sy: legH * 0.4, sz: 0.13 }),
        part(UNIT.lowSphere, b.head, { x: -0.13, y: -legH * 0.52, z: -0.12, sx: 0.15, sy: 0.15, sz: 0.15, smooth: true }),
        part(UNIT.capsule, b.body, { x: -0.13, y: -legH * 0.76, z: 0.02, rx: 0.35, sx: 0.11, sy: legH * 0.4, sz: 0.11 }),
        part(UNIT.wedge, shadeHex(b.body, 0.6), { x: -0.13, y: -legH + 0.05, z: 0.1, ry: Math.PI / 2, sx: 0.14, sy: 0.11, sz: 0.3 }),
      ],
    };
  },

  bloater(b, h) {
    const legH = h * 0.2;
    const headY = h * 0.92;
    const blister = shadeHex(b.body, 1.45);
    const vein = 0x6a8a2a;
    // A pressure vessel with a person somewhere in it. The sac is stretched
    // thin enough to see through in places, split along one side, and the
    // little head on top exists only to tell you which way it is facing.
    return {
      pivot: legH, headY, headR: 0.24, wobble: 1,
      upper: [
        // The sac, asymmetric — a perfect sphere reads as a beach ball.
        part(UNIT.lowSphere, b.body, { y: h * 0.5, sx: 1.5, sy: 1.32, sz: 1.42, smooth: true }),
        part(UNIT.lowSphere, shadeHex(b.body, 1.18), { x: 0.18, y: h * 0.42, z: 0.34, sx: 1.15, sy: 0.95, sz: 0.95, smooth: true }),
        part(UNIT.lowSphere, shadeHex(b.body, 0.85), { x: -0.3, y: h * 0.62, z: -0.2, sx: 0.9, sy: 0.8, sz: 0.85, smooth: true }),
        // Blisters, various sizes, clustered where the skin is tightest.
        ...Array.from({ length: 11 }, (_, i) => {
          const a = i * 2.399, r = 0.62 + (i % 3) * 0.06;
          return part(UNIT.lowSphere, blister, {
            x: Math.cos(a) * r, y: h * (0.34 + (i % 5) * 0.1), z: Math.sin(a) * r,
            sx: 0.2 + (i % 4) * 0.07, sy: 0.18 + (i % 3) * 0.06, sz: 0.2 + (i % 4) * 0.07, smooth: true,
          });
        }),
        // Veins tracking over the surface.
        ...Array.from({ length: 7 }, (_, i) => {
          const a = i * 0.9;
          return part(C, vein, {
            x: Math.cos(a) * 0.6, y: h * (0.4 + (i % 3) * 0.12), z: Math.sin(a) * 0.6,
            rz: Math.cos(a) * 1.2, rx: Math.sin(a) * 1.2, sx: 0.05, sy: 0.7, sz: 0.05,
          });
        }),
        // The split: a dark seam with something lit behind it.
        part(B, 0x1a2208, { x: 0.62, y: h * 0.5, z: 0.2, rz: 0.3, sx: 0.09, sy: 0.85, sz: 0.5 }),
        emit(B, b.eye, { x: 0.66, y: h * 0.5, z: 0.2, rz: 0.3, sx: 0.05, sy: 0.7, sz: 0.4, opacity: 0.75 }),
        // A dozen little glands round the base, already leaking.
        ...Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return emit(UNIT.lowSphere, b.eye, {
            x: Math.cos(a) * 0.68, y: h * 0.2, z: Math.sin(a) * 0.68,
            sx: 0.11, sy: 0.09, sz: 0.11, opacity: 0.85,
          });
        }),
        // Vestigial head, sunk into the shoulder of the sac.
        part(UNIT.lowSphere, b.head, { y: headY, z: 0.16, sx: 0.44, sy: 0.42, sz: 0.44, smooth: true }),
        part(UNIT.wedge, shadeHex(b.head, 0.7), { y: headY - 0.14, z: 0.3, rx: -0.4, ry: Math.PI / 2, rz: Math.PI / 2, sx: 0.2, sy: 0.18, sz: 0.2 }),
        emit(UNIT.lowSphere, b.eye, { x: 0.11, y: headY + 0.05, z: 0.34, sx: 0.09, sy: 0.09, sz: 0.06 }),
        emit(UNIT.lowSphere, b.eye, { x: -0.11, y: headY + 0.05, z: 0.34, sx: 0.09, sy: 0.09, sz: 0.06 }),
        part(UNIT.lowSphere, shadeHex(b.body, 0.8), { y: headY - 0.26, sx: 0.5, sy: 0.24, sz: 0.5, smooth: true }),
        // Two useless little arms, lost in the mass.
        ...[1, -1].flatMap((sg) => [
          part(UNIT.capsule, b.head, { x: sg * 0.78, y: h * 0.62, z: 0.24, rz: sg * 0.7, sx: 0.16, sy: 0.34, sz: 0.16 }),
          part(UNIT.lowSphere, b.head, { x: sg * 0.9, y: h * 0.44, z: 0.34, sx: 0.19, sy: 0.19, sz: 0.19, smooth: true }),
        ]),
      ],
      legL: [
        part(UNIT.capsule, b.head, { x: 0.3, y: -legH * 0.5, sx: 0.24, sy: legH * 0.9, sz: 0.24 }),
        part(UNIT.wedge, shadeHex(b.head, 0.7), { x: 0.3, y: -legH + 0.05, z: 0.1, ry: Math.PI / 2, sx: 0.28, sy: 0.12, sz: 0.36 }),
      ],
      legR: [
        part(UNIT.capsule, b.head, { x: -0.3, y: -legH * 0.5, sx: 0.24, sy: legH * 0.9, sz: 0.24 }),
        part(UNIT.wedge, shadeHex(b.head, 0.7), { x: -0.3, y: -legH + 0.05, z: 0.1, ry: Math.PI / 2, sx: 0.28, sy: 0.12, sz: 0.36 }),
      ],
    };
  },

  husk(b, h) {
    const legH = h * 0.46, torso = h * 0.32;
    const headY = legH + torso + 0.16;
    const rig = 0x2a3038, strap = 0x3a4450;
    // An alpha tester who never logged out. Still wearing the full harness,
    // still standing, gradually going transparent from the feet up. The gear
    // is the character: the person inside it barely renders any more.
    return {
      pivot: legH, headY, headR: 0.19, ghost: 0.62,
      upper: [
        part(UNIT.bevelBox, b.body, { y: legH + torso * 0.5, sx: 0.54, sy: torso, sz: 0.3 }),
        part(UNIT.bevelBox, b.body, { y: legH + torso * 0.96, sx: 0.74, sy: 0.16, sz: 0.36 }),
        // Capture harness: chest plate, shoulder straps, waist belt, trackers.
        part(UNIT.slab, rig, { y: legH + torso * 0.6, z: 0.16, sx: 0.36, sy: 0.3, sz: 0.05 }),
        ...[1, -1].map((s2) => part(UNIT.slab, strap, {
          x: s2 * 0.16, y: legH + torso * 0.78, z: 0.1, rz: s2 * 0.32, sx: 0.07, sy: 0.38, sz: 0.24,
        })),
        part(UNIT.slab, strap, { y: legH + torso * 0.34, sx: 0.58, sy: 0.09, sz: 0.34 }),
        ...[[0.22, 0.72], [-0.22, 0.72], [0.24, 0.34], [-0.24, 0.34]].map(([x, t]) => part(UNIT.hex, rig, {
          x, y: legH + torso * t, z: 0.17, rx: Math.PI / 2, sx: 0.07, sy: 0.03, sz: 0.07,
        })),
        ...[[0.22, 0.72], [-0.22, 0.72]].map(([x, t]) => emit(UNIT.lowSphere, b.eye, {
          x, y: legH + torso * t, z: 0.19, sx: 0.035, sy: 0.035, sz: 0.02,
        })),
        // The head, and the headset that is still running a session.
        part(UNIT.lowSphere, b.head, { y: headY, sx: 0.36, sy: 0.4, sz: 0.36, smooth: true }),
        part(UNIT.bevelBox, 0x0a0e14, { y: headY, z: 0.16, sx: 0.3, sy: 0.17, sz: 0.07 }),
        emit(UNIT.lowSphere, b.eye, { x: 0.07, y: headY, z: 0.185, sx: 0.05, sy: 0.05, sz: 0.03 }),
        emit(UNIT.lowSphere, b.eye, { x: -0.07, y: headY, z: 0.185, sx: 0.05, sy: 0.05, sz: 0.03 }),
        part(C, rig, { y: headY + 0.06, rz: Math.PI / 2, sx: 0.42, sy: 0.46, sz: 0.42 }),
        part(UNIT.bevelBox, rig, { x: 0.21, y: headY, sx: 0.09, sy: 0.17, sz: 0.17 }),
        part(UNIT.bevelBox, rig, { x: -0.21, y: headY, sx: 0.09, sy: 0.17, sz: 0.17 }),
        part(C, 0x1b2028, { x: -0.24, y: headY - 0.18, rz: 0.4, sx: 0.03, sy: 0.34, sz: 0.03 }),
        part(C, 0x1b2028, { x: -0.3, y: legH + torso * 0.86, z: -0.06, rx: 0.6, sx: 0.03, sy: 0.4, sz: 0.03 }),
        part(UNIT.slab, rig, { y: headY + 0.2, sx: 0.24, sy: 0.05, sz: 0.3 }),
        emit(B, b.eye, { y: headY + 0.23, z: 0.1, sx: 0.1, sy: 0.012, sz: 0.006 }),
        // Session lanyard and a badge that still has a name on it.
        part(C, strap, { x: 0.08, y: legH + torso * 0.88, z: 0.13, rz: 0.5, sx: 0.014, sy: 0.24, sz: 0.014 }),
        part(C, strap, { x: -0.08, y: legH + torso * 0.88, z: 0.13, rz: -0.5, sx: 0.014, sy: 0.24, sz: 0.014 }),
        part(UNIT.slab, 0xd8d4c8, { y: legH + torso * 0.66, z: 0.2, sx: 0.15, sy: 0.21, sz: 0.012 }),
        emit(B, 0xd9b24a, { y: legH + torso * 0.7, z: 0.208, sx: 0.11, sy: 0.02, sz: 0.004 }),
        emit(B, 0xd9b24a, { y: legH + torso * 0.62, z: 0.208, sx: 0.08, sy: 0.014, sz: 0.004 }),
        // Arms hanging dead straight, gloves still tracking.
        ...[1, -1].flatMap((s2) => [
          part(UNIT.capsule, b.body, { x: s2 * 0.34, y: legH + torso * 0.62, rz: s2 * 0.06, sx: 0.12, sy: torso * 0.5, sz: 0.12 }),
          part(UNIT.capsule, b.body, { x: s2 * 0.36, y: legH + torso * 0.2, sx: 0.1, sy: torso * 0.44, sz: 0.1 }),
          part(UNIT.bevelBox, rig, { x: s2 * 0.36, y: legH - 0.06, sx: 0.12, sy: 0.14, sz: 0.11 }),
          emit(B, b.eye, { x: s2 * 0.36, y: legH - 0.06, z: 0.06, sx: 0.06, sy: 0.01, sz: 0.004 }),
        ]),
      ],
      legL: [
        part(UNIT.capsule, b.body, { x: 0.15, y: -legH * 0.32, sx: 0.15, sy: legH * 0.44, sz: 0.15 }),
        part(UNIT.slab, strap, { x: 0.15, y: -legH * 0.5, sx: 0.17, sy: 0.06, sz: 0.17 }),
        part(UNIT.capsule, b.body, { x: 0.15, y: -legH * 0.76, sx: 0.12, sy: legH * 0.4, sz: 0.12 }),
        part(UNIT.bevelBox, rig, { x: 0.15, y: -legH + 0.05, z: 0.06, sx: 0.17, sy: 0.1, sz: 0.28 }),
      ],
      legR: [
        part(UNIT.capsule, b.body, { x: -0.15, y: -legH * 0.32, sx: 0.15, sy: legH * 0.44, sz: 0.15 }),
        part(UNIT.slab, strap, { x: -0.15, y: -legH * 0.5, sx: 0.17, sy: 0.06, sz: 0.17 }),
        part(UNIT.capsule, b.body, { x: -0.15, y: -legH * 0.76, sx: 0.12, sy: legH * 0.4, sz: 0.12 }),
        part(UNIT.bevelBox, rig, { x: -0.15, y: -legH + 0.05, z: 0.06, sx: 0.17, sy: 0.1, sz: 0.28 }),
      ],
    };
  },

  // -- machines -------------------------------------------------------------

  android(b, h) {
    const legH = h * 0.46, torso = h * 0.32;
    const headY = legH + torso + 0.2;
    const joint = 0x2f353d, trim = 0x5c95c4;
    // A machine reads as a machine because of its joints, its panel gaps and
    // the fact that its parts are obviously separate. A single smooth box with
    // a visor painted on is a toy.
    const arm = (s2) => [
      part(UNIT.lowSphere, joint, { x: s2 * 0.32, y: legH + torso * 0.94, sx: 0.19, sy: 0.19, sz: 0.19, smooth: true }),
      part(UNIT.ring, trim, { x: s2 * 0.32, y: legH + torso * 0.94, rz: Math.PI / 2, sx: 0.22, sy: 0.22, sz: 0.22 }),
      part(UNIT.capsule, b.body, { x: s2 * 0.34, y: legH + torso * 0.66, sx: 0.1, sy: torso * 0.3, sz: 0.1 }),
      part(C, joint, { x: s2 * 0.34, y: legH + torso * 0.44, rz: Math.PI / 2, sx: 0.13, sy: 0.11, sz: 0.13 }),
      part(UNIT.capsule, b.head, { x: s2 * 0.34, y: legH + torso * 0.2, sx: 0.085, sy: torso * 0.26, sz: 0.085 }),
      // Three-finger service hand.
      part(UNIT.bevelBox, joint, { x: s2 * 0.34, y: legH - 0.04, sx: 0.11, sy: 0.09, sz: 0.09 }),
      ...[0, 1, 2].map((i) => part(C, b.head, {
        x: s2 * 0.34 + (i - 1) * 0.032, y: legH - 0.14, z: 0.01, rx: 0.2,
        sx: 0.025, sy: 0.14, sz: 0.025,
      })),
      // Cable loom bridging the shoulder to the forearm.
      part(C, 0x1b2028, { x: s2 * 0.4, y: legH + torso * 0.6, rz: s2 * 0.1, sx: 0.03, sy: torso * 0.6, sz: 0.03 }),
    ];
    return {
      pivot: legH, headY, headR: 0.18,
      upper: [
        // Chassis: a shell with a visible seam and a hinged access panel.
        part(UNIT.bevelBox, b.body, { y: legH + torso * 0.52, sx: 0.5, sy: torso, sz: 0.3 }),
        part(UNIT.slab, b.head, { y: legH + torso * 0.52, z: 0.155, sx: 0.4, sy: torso * 0.78, sz: 0.03 }),
        part(B, 0x1b2028, { y: legH + torso * 0.52, z: 0.17, sx: 0.42, sy: 0.012, sz: 0.012 }),
        part(B, 0x1b2028, { x: 0.2, y: legH + torso * 0.52, z: 0.16, sx: 0.012, sy: torso * 0.78, sz: 0.02 }),
        part(B, 0x1b2028, { x: -0.2, y: legH + torso * 0.52, z: 0.16, sx: 0.012, sy: torso * 0.78, sz: 0.02 }),
        ...[0, 1].flatMap((i) => [1, -1].map((s2) => part(UNIT.hex, 0x8d99a6, {
          x: s2 * 0.16, y: legH + torso * (0.28 + i * 0.5), z: 0.17, rx: Math.PI / 2, sx: 0.03, sy: 0.02, sz: 0.03,
        }))),
        // Shoulder yoke and a neck actuator.
        part(UNIT.bevelBox, b.body, { y: legH + torso * 1.0, sx: 0.72, sy: 0.14, sz: 0.34 }),
        part(UNIT.slab, joint, { y: legH + torso * 1.06, sx: 0.5, sy: 0.05, sz: 0.28 }),
        part(C, joint, { y: legH + torso + 0.03, sx: 0.15, sy: 0.14, sz: 0.15 }),
        ...[0, 1, 2].map((i) => part(UNIT.ring, 0x6a7480, {
          y: legH + torso - 0.01 + i * 0.045, sx: 0.17, sy: 0.17, sz: 0.17,
        })),
        // Service light and a duty badge on the chest.
        emit(UNIT.disc, b.eye, { y: legH + torso * 0.68, z: 0.175, rx: Math.PI / 2, sx: 0.13, sy: 0.02, sz: 0.13 }),
        part(UNIT.ring, joint, { y: legH + torso * 0.68, z: 0.17, sx: 0.17, sy: 0.17, sz: 0.17 }),
        part(UNIT.slab, 0xd8dce2, { x: 0.13, y: legH + torso * 0.34, z: 0.172, sx: 0.12, sy: 0.08, sz: 0.01 }),
        emit(B, b.eye, { x: 0.13, y: legH + torso * 0.34, z: 0.178, sx: 0.08, sy: 0.012, sz: 0.004 }),
        // Head: a rounded shell with a wraparound visor, an antenna and vents.
        part(UNIT.bevelBox, b.head, { y: headY, sx: 0.34, sy: 0.3, sz: 0.32 }),
        part(UNIT.slab, b.head, { y: headY + 0.15, sx: 0.28, sy: 0.05, sz: 0.26 }),
        part(B, 0x14181e, { y: headY + 0.01, z: 0.145, sx: 0.32, sy: 0.17, sz: 0.05 }),
        emit(B, b.eye, { y: headY + 0.01, z: 0.172, sx: 0.27, sy: 0.075, sz: 0.02 }),
        emit(UNIT.disc, 0xffffff, { x: 0.08, y: headY + 0.03, z: 0.176, rx: Math.PI / 2, sx: 0.05, sy: 0.01, sz: 0.05 }),
        ...[0, 1, 2].map((i) => part(B, 0x1b2028, {
          x: 0.17, y: headY - 0.02 + i * 0.05, sx: 0.02, sy: 0.02, sz: 0.16,
        })),
        ...[0, 1, 2].map((i) => part(B, 0x1b2028, {
          x: -0.17, y: headY - 0.02 + i * 0.05, sx: 0.02, sy: 0.02, sz: 0.16,
        })),
        part(C, joint, { x: -0.13, y: headY + 0.24, rz: -0.2, sx: 0.018, sy: 0.2, sz: 0.018 }),
        emit(UNIT.lowSphere, b.eye, { x: -0.155, y: headY + 0.34, sx: 0.045, sy: 0.045, sz: 0.045 }),
        ...arm(1), ...arm(-1),
        // Hip block with a battery pack behind it.
        part(UNIT.bevelBox, joint, { y: legH + 0.04, sx: 0.44, sy: 0.16, sz: 0.28 }),
        part(UNIT.bevelBox, 0x1b2028, { y: legH + 0.06, z: -0.17, sx: 0.3, sy: 0.2, sz: 0.09 }),
        emit(B, b.eye, { y: legH + 0.06, z: -0.22, sx: 0.16, sy: 0.012, sz: 0.006 }),
      ],
      legL: [
        part(UNIT.capsule, b.body, { x: 0.14, y: -legH * 0.3, sx: 0.13, sy: legH * 0.4, sz: 0.13 }),
        part(C, joint, { x: 0.14, y: -legH * 0.52, rz: Math.PI / 2, sx: 0.15, sy: 0.13, sz: 0.15 }),
        part(UNIT.capsule, b.body, { x: 0.14, y: -legH * 0.76, sx: 0.11, sy: legH * 0.36, sz: 0.11 }),
        part(C, 0x1b2028, { x: 0.14, y: -legH * 0.52, z: -0.07, rx: Math.PI / 2, sx: 0.04, sy: 0.3, sz: 0.04 }),
        part(UNIT.bevelBox, joint, { x: 0.14, y: -legH + 0.05, z: 0.05, sx: 0.17, sy: 0.1, sz: 0.3 }),
        part(UNIT.slab, 0x1b2028, { x: 0.14, y: -legH + 0.005, z: 0.05, sx: 0.18, sy: 0.02, sz: 0.31 }),
      ],
      legR: [
        part(UNIT.capsule, b.body, { x: -0.14, y: -legH * 0.3, sx: 0.13, sy: legH * 0.4, sz: 0.13 }),
        part(C, joint, { x: -0.14, y: -legH * 0.52, rz: Math.PI / 2, sx: 0.15, sy: 0.13, sz: 0.15 }),
        part(UNIT.capsule, b.body, { x: -0.14, y: -legH * 0.76, sx: 0.11, sy: legH * 0.36, sz: 0.11 }),
        part(C, 0x1b2028, { x: -0.14, y: -legH * 0.52, z: -0.07, rx: Math.PI / 2, sx: 0.04, sy: 0.3, sz: 0.04 }),
        part(UNIT.bevelBox, joint, { x: -0.14, y: -legH + 0.05, z: 0.05, sx: 0.17, sy: 0.1, sz: 0.3 }),
        part(UNIT.slab, 0x1b2028, { x: -0.14, y: -legH + 0.005, z: 0.05, sx: 0.18, sy: 0.02, sz: 0.31 }),
      ],
    };
  },

  enforcer(b, h) {
    const legH = h * 0.4, torso = h * 0.38;
    const headY = legH + torso + 0.06;
    return {
      pivot: legH, headY, headR: 0.22,
      upper: [
        // slab chest with a bolted shield plate
        part(B, b.body, { y: legH + torso * 0.5, sx: 0.9, sy: torso, sz: 0.52 }),
        part(B, b.head, { y: legH + torso * 0.52, z: 0.28, sx: 0.78, sy: torso * 0.8, sz: 0.1 }),
        ...[1, -1].map((s) => emit(B, b.eye, {
          x: s * 0.24, y: legH + torso * 0.52, z: 0.34, sx: 0.08, sy: torso * 0.5, sz: 0.02,
        })),
        // huge pauldrons
        ...[1, -1].map((s) => part(B, b.head, {
          x: s * 0.62, y: legH + torso * 0.98, rz: s * -0.28, sx: 0.44, sy: 0.34, sz: 0.6,
        })),
        // caged head
        part(B, b.head, { y: headY, sx: 0.42, sy: 0.36, sz: 0.4 }),
        part(B, 0x14181e, { y: headY, z: 0.2, sx: 0.34, sy: 0.24, sz: 0.05 }),
        ...[0, 1, 2].map((i) => part(B, b.body, {
          x: (i - 1) * 0.11, y: headY, z: 0.23, sx: 0.035, sy: 0.26, sz: 0.03,
        })),
        emit(B, b.eye, { y: headY + 0.04, z: 0.22, sx: 0.28, sy: 0.05, sz: 0.02 }),
        // heavy arms, one carrying a launcher block
        part(B, b.body, { x: 0.6, y: legH + torso * 0.46, sx: 0.24, sy: torso * 0.86, sz: 0.24 }),
        part(B, b.body, { x: -0.6, y: legH + torso * 0.46, sx: 0.24, sy: torso * 0.86, sz: 0.24 }),
        part(B, 0x22272e, { x: 0.66, y: legH + torso * 0.14, z: 0.26, sx: 0.28, sy: 0.22, sz: 0.62 }),
        emit(B, b.eye, { x: 0.66, y: legH + torso * 0.14, z: 0.58, sx: 0.1, sy: 0.1, sz: 0.02 }),
        // hip armour
        part(B, b.head, { y: legH + 0.06, sx: 0.86, sy: 0.2, sz: 0.56 }),
      ],
      legL: [part(B, b.body, { x: 0.26, y: -legH * 0.5, sx: 0.26, sy: legH, sz: 0.26 }),
        part(B, b.head, { x: 0.26, y: -legH + 0.07, z: 0.06, sx: 0.3, sy: 0.14, sz: 0.4 })],
      legR: [part(B, b.body, { x: -0.26, y: -legH * 0.5, sx: 0.26, sy: legH, sz: 0.26 }),
        part(B, b.head, { x: -0.26, y: -legH + 0.07, z: 0.06, sx: 0.3, sy: 0.14, sz: 0.4 })],
    };
  },

  drone(b, h) {
    return {
      pivot: 0, headY: h + 0.05, headR: 0.3, flying: true,
      upper: [
        // lens pod
        part(OC, b.body, { y: h, sx: 0.66, sy: 0.58, sz: 0.66 }),
        part(C, 0x1b2028, { y: h, z: 0.3, rx: Math.PI / 2, sx: 0.36, sy: 0.16, sz: 0.36 }),
        emit(S, b.eye, { y: h, z: 0.36, sx: 0.24, sy: 0.24, sz: 0.12 }),
        // rotor arms and rings
        ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].flatMap(([sx, sz]) => [
          part(B, 0x2f353d, { x: sx * 0.34, y: h + 0.2, z: sz * 0.34, ry: sx * sz * 0.78, sx: 0.66, sy: 0.05, sz: 0.09 }),
          part(UNIT.torus, 0x2f353d, { x: sx * 0.62, y: h + 0.22, z: sz * 0.62, rx: Math.PI / 2, sx: 0.52, sy: 0.52, sz: 0.52 }),
          emit(B, b.eye, { x: sx * 0.62, y: h + 0.22, z: sz * 0.62, ry: Math.PI / 4, sx: 0.42, sy: 0.02, sz: 0.04, opacity: 0.85 }),
        ]),
        // underslung emitter and tail light
        part(C, 0x2f353d, { y: h - 0.34, sx: 0.18, sy: 0.28, sz: 0.18 }),
        emit(S, b.eye, { y: h - 0.5, sx: 0.16, sy: 0.16, sz: 0.16 }),
        part(B, 0x2f353d, { y: h + 0.02, z: -0.42, sx: 0.12, sy: 0.1, sz: 0.34 }),
        emit(S, 0xff3a3a, { y: h + 0.02, z: -0.6, sx: 0.1, sy: 0.1, sz: 0.1 }),
      ],
      legL: [], legR: [],
    };
  },

  sentry(b, h) {
    return {
      pivot: 0, headY: 1.02, headR: 0.24, static: true,
      upper: [
        // bolted base with hazard stripes
        part(C, 0x22272e, { y: 0.1, sx: 1.25, sy: 0.2, sz: 1.25 }),
        ...[0, 1, 2, 3, 4, 5].map((i) => emit(B, 0xffb43d, {
          x: Math.cos(i * 1.047) * 0.5, y: 0.21, z: Math.sin(i * 1.047) * 0.5,
          ry: -i * 1.047, sx: 0.22, sy: 0.02, sz: 0.16, opacity: 0.8,
        })),
        part(C, b.body, { y: 0.36, sx: 0.62, sy: 0.34, sz: 0.62 }),
        // turret head
        part(B, b.body, { y: 0.75, sx: 0.66, sy: 0.5, sz: 0.6 }),
        part(C, 0x2f353d, { x: 0.44, y: 0.78, rz: Math.PI / 2, sx: 0.3, sy: 0.2, sz: 0.3 }),
        part(C, 0x2f353d, { x: -0.44, y: 0.78, rz: Math.PI / 2, sx: 0.3, sy: 0.2, sz: 0.3 }),
        // twin barrels
        part(C, 0x14181e, { x: 0.13, y: 0.78, z: 0.5, rx: Math.PI / 2, sx: 0.13, sy: 0.9, sz: 0.13 }),
        part(C, 0x14181e, { x: -0.13, y: 0.78, z: 0.5, rx: Math.PI / 2, sx: 0.13, sy: 0.9, sz: 0.13 }),
        // iris eye
        part(B, 0x14181e, { y: 1.02, sx: 0.44, sy: 0.3, sz: 0.44 }),
        emit(UNIT.torus, b.eye, { y: 1.02, z: 0.2, sx: 0.34, sy: 0.34, sz: 0.34 }),
        emit(S, b.eye, { y: 1.02, z: 0.22, sx: 0.14, sy: 0.14, sz: 0.08 }),
        // ammo drum
        part(C, b.body, { y: 0.72, z: -0.42, rx: Math.PI / 2, sx: 0.42, sy: 0.24, sz: 0.42 }),
      ],
      legL: [], legR: [],
    };
  },

  mirrorself(b, h) {
    const legH = h * 0.46, torso = h * 0.34;
    const headY = legH + torso + 0.18;
    const seam = 0x8a97a6, glassy = 0xf2f7fc;
    // A reflection of you, assembled out of mirror shards. It is polished
    // where it is whole and fractured where it isn't — the cracks are the
    // whole point, so they are actual geometry, not a painted line.
    const shard = (x, y, z, rx, ry, rz, sx, sy) => part(UNIT.slab, glassy, {
      x, y, z, rx, ry, rz, sx, sy, sz: 0.012, metal: 1.0, rough: 0.04,
    });
    return {
      pivot: legH, headY, headR: 0.18, chrome: true,
      upper: [
        // Torso, faceted rather than smooth.
        part(UNIT.bevelBox, b.body, { y: legH + torso * 0.5, sx: 0.52, sy: torso, sz: 0.3 }),
        part(UNIT.wedge, b.body, { y: legH + torso * 0.82, z: 0.08, rx: 0.2, sx: 0.5, sy: 0.2, sz: 0.24 }),
        part(UNIT.bevelBox, b.head, { y: legH + torso * 0.99, sx: 0.72, sy: 0.14, sz: 0.34 }),
        // Crack lines running across the chest, meeting at an impact point.
        ...[0.5, -0.4, 1.1, -1.2, 0.1].map((a2, i) => part(B, seam, {
          y: legH + torso * 0.55, z: 0.156, rz: a2,
          sx: 0.42 - i * 0.04, sy: 0.012, sz: 0.006,
        })),
        part(UNIT.icosa, glassy, { y: legH + torso * 0.55, z: 0.16, sx: 0.09, sy: 0.09, sz: 0.03, metal: 1.0, rough: 0.04 }),
        // Shards floating just off the body where pieces have come away.
        shard(0.34, legH + torso * 0.86, 0.16, 0.2, 0.4, 0.3, 0.16, 0.2),
        shard(-0.3, legH + torso * 0.3, 0.2, -0.3, -0.5, 0.7, 0.13, 0.17),
        shard(0.12, legH + torso * 1.16, -0.1, 0.4, 0.2, -0.5, 0.11, 0.14),
        shard(-0.36, legH + torso * 1.02, -0.06, -0.2, 0.6, 0.2, 0.1, 0.12),
        // Head: a blank mirrored plate with a hairline fracture across it.
        part(UNIT.lowSphere, b.head, { y: headY, sx: 0.34, sy: 0.4, sz: 0.34, smooth: true }),
        part(UNIT.slab, glassy, { y: headY, z: 0.15, sx: 0.29, sy: 0.32, sz: 0.04, metal: 1.0, rough: 0.03 }),
        part(B, seam, { y: headY + 0.04, z: 0.172, rz: 0.5, sx: 0.26, sy: 0.01, sz: 0.006 }),
        part(B, seam, { x: 0.05, y: headY - 0.06, z: 0.172, rz: -0.9, sx: 0.14, sy: 0.01, sz: 0.006 }),
        // Faint eyes behind the glass — visible only as a reflection would be.
        emit(UNIT.lowSphere, 0x7f97ad, { x: 0.08, y: headY + 0.04, z: 0.14, sx: 0.06, sy: 0.04, sz: 0.02, opacity: 0.55 }),
        emit(UNIT.lowSphere, 0x7f97ad, { x: -0.08, y: headY + 0.04, z: 0.14, sx: 0.06, sy: 0.04, sz: 0.02, opacity: 0.55 }),
        // It is always holding a mirrored copy of a weapon.
        part(UNIT.bevelBox, seam, { x: 0.34, y: legH + torso * 0.55, z: 0.3, sx: 0.1, sy: 0.11, sz: 0.62 }),
        part(UNIT.cyl, glassy, { x: 0.34, y: legH + torso * 0.58, z: 0.6, rx: Math.PI / 2, sx: 0.05, sy: 0.3, sz: 0.05 }),
        part(UNIT.bevelBox, b.body, { x: 0.34, y: legH + torso * 0.3, z: 0.16, rx: 0.3, sx: 0.09, sy: 0.14, sz: 0.09 }),
        part(UNIT.capsule, b.body, { x: 0.34, y: legH + torso * 0.52, z: -0.02, rx: -0.7, sx: 0.12, sy: torso * 0.62, sz: 0.12 }),
        part(UNIT.capsule, b.body, { x: -0.34, y: legH + torso * 0.52, z: 0.02, rx: -0.5, sx: 0.12, sy: torso * 0.62, sz: 0.12 }),
        part(UNIT.lowSphere, b.head, { x: -0.36, y: legH + torso * 0.06, z: 0.2, sx: 0.13, sy: 0.13, sz: 0.13, smooth: true }),
      ],
      legL: [
        part(UNIT.capsule, b.body, { x: 0.15, y: -legH * 0.32, sx: 0.15, sy: legH * 0.44, sz: 0.15 }),
        part(UNIT.capsule, b.body, { x: 0.15, y: -legH * 0.76, sx: 0.12, sy: legH * 0.4, sz: 0.12 }),
        part(UNIT.bevelBox, b.head, { x: 0.15, y: -legH + 0.05, z: 0.06, sx: 0.17, sy: 0.1, sz: 0.28 }),
      ],
      legR: [
        part(UNIT.capsule, b.body, { x: -0.15, y: -legH * 0.32, sx: 0.15, sy: legH * 0.44, sz: 0.15 }),
        part(UNIT.capsule, b.body, { x: -0.15, y: -legH * 0.76, sx: 0.12, sy: legH * 0.4, sz: 0.12 }),
        part(UNIT.bevelBox, b.head, { x: -0.15, y: -legH + 0.05, z: 0.06, sx: 0.17, sy: 0.1, sz: 0.28 }),
      ],
    };
  },

  // -- creatures ------------------------------------------------------------

  leaper(b, h) {
    const bodyY = h * 0.62;
    const claw = 0xf0e8d8;
    const wet = { metal: 0.14, rough: 0.3, smooth: true };
    // Coiled, quadrupedal, back legs already loaded. Low and long so it reads
    // as a different threat from anything upright, with the haunches as the
    // heaviest shape — you should be able to tell it is about to jump.
    return {
      pivot: h * 0.5, headY: bodyY + 0.1, headR: 0.22,
      upper: [
        // Body: deep chest, narrow waist, high hips.
        part(UNIT.capsule, b.body, { y: bodyY, z: 0.1, rx: Math.PI / 2, sx: 0.62, sy: 0.9, sz: 0.56, ...wet }),
        part(UNIT.lowSphere, b.body, { y: bodyY + 0.04, z: 0.42, sx: 0.66, sy: 0.6, sz: 0.6, ...wet }),
        part(UNIT.lowSphere, b.body, { y: bodyY + 0.1, z: -0.42, sx: 0.72, sy: 0.68, sz: 0.66, ...wet }),
        // Spine ridge and plated back.
        ...Array.from({ length: 7 }, (_, i) => part(UNIT.cone, b.accent ?? shadeHex(b.body, 1.4), {
          y: bodyY + 0.3 - Math.abs(i - 3) * 0.02, z: 0.5 - i * 0.17, rx: -0.25,
          sx: 0.18 - Math.abs(i - 3) * 0.02, sy: 0.3 - Math.abs(i - 3) * 0.04, sz: 0.14, ...wet,
        })),
        ...Array.from({ length: 4 }, (_, i) => part(UNIT.slab, shadeHex(b.body, 0.75), {
          y: bodyY + 0.22, z: 0.34 - i * 0.24, sx: 0.5 - i * 0.04, sy: 0.05, sz: 0.2, ...wet,
        })),
        // Underside is paler and segmented.
        ...Array.from({ length: 5 }, (_, i) => part(UNIT.slab, shadeHex(b.body, 1.5), {
          y: bodyY - 0.26, z: 0.32 - i * 0.2, sx: 0.38, sy: 0.06, sz: 0.16, ...wet,
        })),
        // Head: flat, wide, mouth along the underside, no forehead to speak of.
        part(UNIT.wedge, b.head, { y: bodyY + 0.06, z: 0.78, ry: Math.PI / 2, rz: Math.PI, sx: 0.5, sy: 0.28, sz: 0.46, ...wet }),
        part(UNIT.bevelBox, b.head, { y: bodyY + 0.1, z: 0.66, sx: 0.44, sy: 0.3, sz: 0.34, ...wet }),
        part(UNIT.bevelBox, shadeHex(b.head, 1.3), { y: bodyY - 0.04, z: 0.82, rx: -0.18, sx: 0.34, sy: 0.12, sz: 0.36, ...wet }),
        ...Array.from({ length: 10 }, (_, i) => part(UNIT.cone, claw, {
          x: -0.14 + (i % 5) * 0.07, y: bodyY + (i < 5 ? 0.04 : -0.06), z: 0.94,
          rx: i < 5 ? Math.PI : 0, sx: 0.05, sy: 0.14, sz: 0.05,
        })),
        // Four eyes in two pairs, and the ridge over them.
        ...[1, -1].flatMap((sg) => [
          emit(UNIT.lowSphere, b.eye, { x: sg * 0.15, y: bodyY + 0.2, z: 0.82, sx: 0.13, sy: 0.13, sz: 0.09 }),
          emit(UNIT.lowSphere, b.eye, { x: sg * 0.25, y: bodyY + 0.14, z: 0.76, sx: 0.09, sy: 0.09, sz: 0.07 }),
          part(UNIT.wedge, shadeHex(b.head, 0.7), { x: sg * 0.2, y: bodyY + 0.28, z: 0.78, rz: sg * 1.5, sx: 0.24, sy: 0.1, sz: 0.24, ...wet }),
        ]),
        // Tail: tapering, kinked, with a barb.
        ...Array.from({ length: 5 }, (_, i) => part(UNIT.capsule, b.body, {
          y: bodyY + 0.08 + i * 0.05, z: -0.66 - i * 0.26, rx: Math.PI / 2 - i * 0.12,
          sx: 0.2 - i * 0.03, sy: 0.3, sz: 0.2 - i * 0.03, ...wet,
        })),
        part(UNIT.cone, claw, { y: bodyY + 0.36, z: -1.86, rx: -1.9, sx: 0.13, sy: 0.34, sz: 0.13 }),
      ],
      // Front legs: slim, reaching forward. Back legs: coiled and massive.
      legL: [
        part(UNIT.capsule, b.body, { x: 0.28, y: -0.1, z: 0.42, rx: 0.4, sx: 0.16, sy: 0.4, sz: 0.16, ...wet }),
        part(UNIT.capsule, b.body, { x: 0.28, y: -0.34, z: 0.52, rx: -0.3, sx: 0.13, sy: 0.36, sz: 0.13, ...wet }),
        part(UNIT.wedge, shadeHex(b.body, 0.7), { x: 0.28, y: -0.5, z: 0.62, ry: Math.PI / 2, sx: 0.16, sy: 0.1, sz: 0.26, ...wet }),
        ...[0, 1, 2].map((i) => part(UNIT.cone, claw, {
          x: 0.28 + (i - 1) * 0.06, y: -0.54, z: 0.76, rx: 1.5, sx: 0.04, sy: 0.13, sz: 0.04,
        })),
        // Rear haunch on the same side, folded.
        part(UNIT.lowSphere, b.body, { x: 0.3, y: -0.02, z: -0.44, sx: 0.42, sy: 0.44, sz: 0.4, ...wet }),
        part(UNIT.capsule, b.body, { x: 0.32, y: -0.24, z: -0.3, rx: -0.9, sx: 0.17, sy: 0.42, sz: 0.17, ...wet }),
        part(UNIT.wedge, shadeHex(b.body, 0.7), { x: 0.32, y: -0.5, z: -0.28, ry: Math.PI / 2, sx: 0.18, sy: 0.12, sz: 0.32, ...wet }),
      ],
      legR: [
        part(UNIT.capsule, b.body, { x: -0.28, y: -0.1, z: 0.42, rx: 0.4, sx: 0.16, sy: 0.4, sz: 0.16, ...wet }),
        part(UNIT.capsule, b.body, { x: -0.28, y: -0.34, z: 0.52, rx: -0.3, sx: 0.13, sy: 0.36, sz: 0.13, ...wet }),
        part(UNIT.wedge, shadeHex(b.body, 0.7), { x: -0.28, y: -0.5, z: 0.62, ry: Math.PI / 2, sx: 0.16, sy: 0.1, sz: 0.26, ...wet }),
        ...[0, 1, 2].map((i) => part(UNIT.cone, claw, {
          x: -0.28 + (i - 1) * 0.06, y: -0.54, z: 0.76, rx: 1.5, sx: 0.04, sy: 0.13, sz: 0.04,
        })),
        part(UNIT.lowSphere, b.body, { x: -0.3, y: -0.02, z: -0.44, sx: 0.42, sy: 0.44, sz: 0.4, ...wet }),
        part(UNIT.capsule, b.body, { x: -0.32, y: -0.24, z: -0.3, rx: -0.9, sx: 0.17, sy: 0.42, sz: 0.17, ...wet }),
        part(UNIT.wedge, shadeHex(b.body, 0.7), { x: -0.32, y: -0.5, z: -0.28, ry: Math.PI / 2, sx: 0.18, sy: 0.12, sz: 0.32, ...wet }),
      ],
    };
  },

  spitter(b, h) {
    const legH = h * 0.3;
    const headY = h * 0.78;
    const wet = { metal: 0.16, rough: 0.28, smooth: true };
    const gum = 0x7a2a3a;
    // Mostly mouth. The gullet sac swells before it fires, the jaw hinges past
    // where a jaw should stop, and the whole thing is built around presenting
    // that opening at you.
    return {
      pivot: legH, headY, headR: 0.3, wobble: 0.6,
      upper: [
        // Gullet: a pressurised bag under the head, visibly full.
        part(UNIT.lowSphere, shadeHex(b.body, 1.25), { y: h * 0.42, z: 0.14, sx: 1.05, sy: 0.95, sz: 1.0, ...wet }),
        ...Array.from({ length: 5 }, (_, i) => part(UNIT.pipe, shadeHex(b.body, 0.85), {
          y: h * (0.28 + i * 0.08), z: 0.14, sx: 1.02 - Math.abs(i - 2) * 0.08, sy: 0.1, sz: 1.0 - Math.abs(i - 2) * 0.08, ...wet,
        })),
        emit(UNIT.lowSphere, b.eye, { y: h * 0.4, z: 0.6, sx: 0.5, sy: 0.44, sz: 0.2, opacity: 0.55 }),
        // Shoulders/back, hunched over the sac.
        part(UNIT.lowSphere, b.body, { y: h * 0.66, z: -0.16, sx: 0.95, sy: 0.7, sz: 0.85, ...wet }),
        ...Array.from({ length: 5 }, (_, i) => part(UNIT.cone, shadeHex(b.body, 0.7), {
          x: (i - 2) * 0.17, y: h * 0.82, z: -0.3, rx: -0.5, sx: 0.13, sy: 0.26, sz: 0.13, ...wet,
        })),
        // Head: hinged jaw, wide open, ringed with teeth.
        part(UNIT.lowSphere, b.head, { y: headY, sx: 0.78, sy: 0.66, sz: 0.72, ...wet }),
        part(UNIT.wedge, b.head, { y: headY + 0.14, z: 0.3, ry: Math.PI / 2, rz: Math.PI, sx: 0.6, sy: 0.24, sz: 0.4, ...wet }),
        part(UNIT.wedge, shadeHex(b.head, 1.2), { y: headY - 0.22, z: 0.28, ry: Math.PI / 2, sx: 0.56, sy: 0.22, sz: 0.4, ...wet }),
        part(UNIT.lowSphere, gum, { y: headY - 0.03, z: 0.24, sx: 0.52, sy: 0.4, sz: 0.34, ...wet }),
        ...Array.from({ length: 14 }, (_, i) => {
          const upper = i < 7;
          const j = upper ? i : i - 7;
          return part(UNIT.cone, 0xf2ead6, {
            x: (j - 3) * 0.08, y: headY + (upper ? 0.06 : -0.14), z: 0.42,
            rx: upper ? Math.PI : 0, sx: 0.05, sy: 0.15 - Math.abs(j - 3) * 0.015, sz: 0.05,
          });
        }),
        // Jaw hinge, exposed on both sides.
        ...[1, -1].map((sg) => part(UNIT.lowCyl, shadeHex(b.head, 0.6), {
          x: sg * 0.34, y: headY - 0.06, z: 0.06, rz: Math.PI / 2, sx: 0.18, sy: 0.1, sz: 0.18, ...wet,
        })),
        // Eyes: small, set far back, almost an afterthought.
        ...[1, -1].map((sg) => emit(UNIT.lowSphere, b.eye, {
          x: sg * 0.24, y: headY + 0.24, z: 0.14, sx: 0.13, sy: 0.13, sz: 0.1,
        })),
        ...[1, -1].map((sg) => part(UNIT.wedge, shadeHex(b.head, 0.65), {
          x: sg * 0.24, y: headY + 0.34, z: 0.14, rz: sg * 1.5, sx: 0.22, sy: 0.1, sz: 0.22, ...wet,
        })),
        // Drool, mid-fall.
        ...[0, 1, 2].map((i) => emit(C, b.eye, {
          x: -0.14 + i * 0.14, y: headY - 0.34 - (i % 2) * 0.12, z: 0.34,
          sx: 0.035, sy: 0.22 + (i % 2) * 0.12, sz: 0.035, opacity: 0.6,
        })),
        // Short arms braced on the ground in front.
        ...[1, -1].flatMap((sg) => [
          part(UNIT.capsule, b.body, { x: sg * 0.6, y: h * 0.44, z: 0.16, rz: sg * 0.5, rx: 0.5, sx: 0.19, sy: 0.42, sz: 0.19, ...wet }),
          part(UNIT.capsule, b.body, { x: sg * 0.72, y: h * 0.18, z: 0.42, rx: 0.6, sx: 0.16, sy: 0.38, sz: 0.16, ...wet }),
          ...[0, 1, 2].map((i) => part(UNIT.cone, 0xf2ead6, {
            x: sg * (0.7 + (i - 1) * 0.08), y: 0.06, z: 0.6, rx: 1.5, sx: 0.05, sy: 0.16, sz: 0.05,
          })),
        ]),
      ],
      legL: [
        part(UNIT.capsule, b.body, { x: 0.3, y: -legH * 0.42, z: -0.06, rx: -0.3, sx: 0.24, sy: legH * 0.6, sz: 0.24, ...wet }),
        part(UNIT.wedge, shadeHex(b.body, 0.7), { x: 0.3, y: -legH + 0.06, z: 0.1, ry: Math.PI / 2, sx: 0.26, sy: 0.13, sz: 0.4, ...wet }),
      ],
      legR: [
        part(UNIT.capsule, b.body, { x: -0.3, y: -legH * 0.42, z: -0.06, rx: -0.3, sx: 0.24, sy: legH * 0.6, sz: 0.24, ...wet }),
        part(UNIT.wedge, shadeHex(b.body, 0.7), { x: -0.3, y: -legH + 0.06, z: 0.1, ry: Math.PI / 2, sx: 0.26, sy: 0.13, sz: 0.4, ...wet }),
      ],
    };
  },

  brute(b, h) {
    const legH = h * 0.34, torso = h * 0.4;
    const headY = legH + torso * 1.02;
    const iron = 0x5a4a3c, bone = 0xe8dcc0;
    const meat = { metal: 0.0, rough: 0.72, smooth: true };
    const plate = { metal: 0.6, rough: 0.5 };
    // Asymmetric on purpose: one arm has been grown into a weapon and the
    // other has withered. Everything is wedge-shaped and top-heavy, so the
    // silhouette leans at you even standing still.
    return {
      pivot: legH, headY, headR: 0.26,
      upper: [
        // Ribcage narrower than the shoulders — the frame is a wedge.
        part(UNIT.capsule, b.body, { y: legH + torso * 0.46, rx: 0.16, sx: 0.95, sy: torso * 0.5, sz: 0.74, ...meat }),
        part(UNIT.wedge, b.body, { y: legH + torso * 0.86, z: -0.06, ry: Math.PI, sx: 1.05, sy: 0.36, sz: 0.6, ...meat }),
        // Ribs pushing through, and a slab of bolted plate over the sternum.
        ...Array.from({ length: 5 }, (_, i) => part(C, shadeHex(b.head, 1.1), {
          x: (i % 2 ? 1 : -1) * 0.3, y: legH + torso * (0.3 + Math.floor(i / 2) * 0.16), z: 0.32,
          rz: (i % 2 ? 1 : -1) * 0.9, sx: 0.06, sy: 0.42, sz: 0.06, ...meat,
        })),
        part(UNIT.bevelBox, iron, { y: legH + torso * 0.52, z: 0.4, rx: 0.16, sx: 0.62, sy: torso * 0.55, sz: 0.1, ...plate }),
        ...Array.from({ length: 6 }, (_, i) => part(UNIT.hex, 0x9aa0aa, {
          x: -0.24 + (i % 2) * 0.48, y: legH + torso * (0.3 + Math.floor(i / 2) * 0.22), z: 0.46,
          rx: Math.PI / 2, sx: 0.09, sy: 0.05, sz: 0.09, metal: 0.9, rough: 0.3,
        })),
        // Shoulder slabs framing the head, spiked.
        ...[1, -1].flatMap((sg) => [
          part(UNIT.bevelBox, b.head, { x: sg * 0.72, y: legH + torso * 0.9, rz: sg * -0.34, sx: 0.5, sy: 0.36, sz: 0.64, ...meat }),
          part(UNIT.slab, iron, { x: sg * 0.74, y: legH + torso * 1.02, rz: sg * -0.34, sx: 0.52, sy: 0.08, sz: 0.62, ...plate }),
          ...[0, 1, 2].map((i) => part(UNIT.cone, bone, {
            x: sg * (0.56 + i * 0.2), y: legH + torso * 1.08, z: (i - 1) * 0.24,
            rz: sg * -0.45, sx: 0.15 - i * 0.02, sy: 0.38 - i * 0.05, sz: 0.15 - i * 0.02,
          })),
        ]),
        // Head: low-set, heavy brow, tusked underbite, chained jaw.
        part(UNIT.lowSphere, b.head, { y: headY, z: 0.16, sx: 0.5, sy: 0.46, sz: 0.5, ...meat }),
        part(UNIT.wedge, shadeHex(b.head, 0.75), { y: headY + 0.16, z: 0.3, rz: Math.PI / 2, ry: Math.PI / 2, sx: 0.3, sy: 0.14, sz: 0.48, ...meat }),
        part(UNIT.bevelBox, 0x24140e, { y: headY - 0.13, z: 0.36, sx: 0.36, sy: 0.16, sz: 0.14 }),
        ...[0, 1, 2, 3].map((i) => part(UNIT.cone, bone, {
          x: (i - 1.5) * 0.09, y: headY - 0.15, z: 0.4, rx: Math.PI, sx: 0.05, sy: 0.11, sz: 0.05,
        })),
        ...[1, -1].map((sg) => part(UNIT.cone, bone, {
          x: sg * 0.22, y: headY - 0.16, z: 0.32, rx: -0.25, rz: sg * 0.2, sx: 0.09, sy: 0.34, sz: 0.09,
        })),
        ...[1, -1].map((sg) => emit(UNIT.lowSphere, b.eye, {
          x: sg * 0.15, y: headY + 0.05, z: 0.36, sx: 0.12, sy: 0.09, sz: 0.08,
        })),
        // Iron collar with a broken chain still hanging off it.
        part(UNIT.pipe, iron, { y: legH + torso * 0.98, z: 0.1, sx: 0.62, sy: 0.16, sz: 0.6, ...plate }),
        ...Array.from({ length: 4 }, (_, i) => part(UNIT.ring, 0x8a8f96, {
          x: 0.28, y: legH + torso * 0.86 - i * 0.16, z: 0.28 + i * 0.04, rx: Math.PI / 2, ry: i * 1.1,
          sx: 0.15, sy: 0.15, sz: 0.15, metal: 0.9, rough: 0.35,
        })),
        // The arm: dropped low, thick, ending in a fist bigger than its head.
        part(UNIT.capsule, b.body, { x: 0.98, y: legH + torso * 0.66, rz: 0.22, sx: 0.42, sy: torso * 0.34, sz: 0.42, ...meat }),
        part(UNIT.lowSphere, b.head, { x: 1.06, y: legH + torso * 0.42, sx: 0.44, sy: 0.44, sz: 0.44, ...meat }),
        part(UNIT.capsule, shadeHex(b.body, 1.15), { x: 1.14, y: legH + torso * 0.16, rz: 0.12, sx: 0.5, sy: torso * 0.34, sz: 0.5, ...meat }),
        part(UNIT.lowSphere, b.head, { x: 1.2, y: legH - 0.16, sx: 0.88, sy: 0.78, sz: 0.88, ...meat }),
        ...[0, 1, 2].map((i) => part(UNIT.capsule, shadeHex(b.head, 1.1), {
          x: 1.2 + (i - 1) * 0.24, y: legH - 0.3, z: 0.22, rx: 1.2, sx: 0.2, sy: 0.28, sz: 0.2, ...meat,
        })),
        ...[0, 1, 2].map((i) => part(UNIT.cone, bone, {
          x: 1.2 + (i - 1) * 0.24, y: legH - 0.42, z: 0.42, rx: 1.4, sx: 0.13, sy: 0.28, sz: 0.13,
        })),
        // Wrappings around the big forearm, stained.
        ...Array.from({ length: 4 }, (_, i) => part(UNIT.pipe, 0x7a6a54, {
          x: 1.12 + i * 0.02, y: legH + torso * (0.3 - i * 0.08), rz: 0.12, sx: 0.54, sy: 0.1, sz: 0.54, rough: 0.85,
        })),
        // The other arm is almost vestigial, and strapped to the chest.
        part(UNIT.capsule, b.body, { x: -0.64, y: legH + torso * 0.56, rz: -0.26, sx: 0.2, sy: torso * 0.4, sz: 0.2, ...meat }),
        part(UNIT.capsule, b.body, { x: -0.6, y: legH + torso * 0.26, z: 0.16, rx: -0.8, sx: 0.17, sy: torso * 0.3, sz: 0.17, ...meat }),
        part(UNIT.lowSphere, b.head, { x: -0.56, y: legH + torso * 0.2, z: 0.36, sx: 0.28, sy: 0.26, sz: 0.28, ...meat }),
        part(UNIT.slab, 0x7a6a54, { x: -0.5, y: legH + torso * 0.42, z: 0.2, rz: -0.4, sx: 0.5, sy: 0.09, sz: 0.5, rough: 0.85 }),
      ],
      legL: [
        part(UNIT.capsule, b.body, { x: 0.34, y: -legH * 0.3, sx: 0.36, sy: legH * 0.44, sz: 0.4, ...meat }),
        part(UNIT.lowSphere, b.head, { x: 0.34, y: -legH * 0.54, sx: 0.38, sy: 0.36, sz: 0.4, ...meat }),
        part(UNIT.capsule, b.body, { x: 0.34, y: -legH * 0.78, sx: 0.3, sy: legH * 0.36, sz: 0.34, ...meat }),
        part(UNIT.bevelBox, b.head, { x: 0.34, y: -legH + 0.09, z: 0.12, sx: 0.44, sy: 0.2, sz: 0.64, ...meat }),
        ...[0, 1, 2].map((i) => part(UNIT.cone, bone, {
          x: 0.34 + (i - 1) * 0.13, y: -legH + 0.05, z: 0.42, rx: 1.5, sx: 0.07, sy: 0.16, sz: 0.07,
        })),
      ],
      legR: [
        part(UNIT.capsule, b.body, { x: -0.34, y: -legH * 0.3, sx: 0.36, sy: legH * 0.44, sz: 0.4, ...meat }),
        part(UNIT.lowSphere, b.head, { x: -0.34, y: -legH * 0.54, sx: 0.38, sy: 0.36, sz: 0.4, ...meat }),
        part(UNIT.capsule, b.body, { x: -0.34, y: -legH * 0.78, sx: 0.3, sy: legH * 0.36, sz: 0.34, ...meat }),
        part(UNIT.bevelBox, b.head, { x: -0.34, y: -legH + 0.09, z: 0.12, sx: 0.44, sy: 0.2, sz: 0.64, ...meat }),
        ...[0, 1, 2].map((i) => part(UNIT.cone, bone, {
          x: -0.34 + (i - 1) * 0.13, y: -legH + 0.05, z: 0.42, rx: 1.5, sx: 0.07, sy: 0.16, sz: 0.07,
        })),
        // A length of chain dragging from the ankle.
        ...Array.from({ length: 5 }, (_, i) => part(UNIT.ring, 0x8a8f96, {
          x: -0.36, y: -legH + 0.06, z: -0.2 - i * 0.16, rx: Math.PI / 2, ry: i * 1.1,
          sx: 0.14, sy: 0.14, sz: 0.14, metal: 0.9, rough: 0.4,
        })),
      ],
    };
  },

  fishling(b, h) {
    const legH = h * 0.34;
    const headY = h * 0.76;
    return {
      pivot: legH, headY, headR: 0.3,
      upper: [
        part(B, b.body, { y: h * 0.5, sx: 0.44, sy: h * 0.34, sz: 0.36 }),
        // big fish head, mouth agape
        part(S, b.head, { y: headY, z: 0.06, sx: 0.66, sy: 0.62, sz: 0.78 }),
        part(B, 0x0e2a30, { y: headY - 0.14, z: 0.3, rx: 0.2, sx: 0.42, sy: 0.22, sz: 0.2 }),
        ...[0, 1, 2, 3].map((i) => part(CN, 0xe8f8fc, {
          x: (i - 1.5) * 0.1, y: headY - 0.05, z: 0.36, rx: Math.PI, sx: 0.05, sy: 0.12, sz: 0.05,
        })),
        emit(S, b.eye, { x: 0.26, y: headY + 0.1, z: 0.16, sx: 0.2, sy: 0.2, sz: 0.16 }),
        emit(S, b.eye, { x: -0.26, y: headY + 0.1, z: 0.16, sx: 0.2, sy: 0.2, sz: 0.16 }),
        // gill slits
        ...[0, 1, 2].map((i) => part(B, 0x123840, {
          x: 0.3, y: headY - 0.06 + i * 0.1, z: -0.1, rz: 0.2, sx: 0.03, sy: 0.14, sz: 0.14,
        })),
        ...[0, 1, 2].map((i) => part(B, 0x123840, {
          x: -0.3, y: headY - 0.06 + i * 0.1, z: -0.1, rz: -0.2, sx: 0.03, sy: 0.14, sz: 0.14,
        })),
        // dorsal + tail fins
        part(CN, b.head, { y: headY + 0.28, z: -0.2, rx: -0.3, sx: 0.34, sy: 0.5, sz: 0.06 }),
        part(CN, b.head, { y: h * 0.44, z: -0.44, rx: Math.PI / 2, sx: 0.6, sy: 0.6, sz: 0.07 }),
        // small arms
        part(C, b.body, { x: 0.3, y: h * 0.48, rz: 0.6, sx: 0.1, sy: 0.42, sz: 0.1 }),
        part(C, b.body, { x: -0.3, y: h * 0.48, rz: -0.6, sx: 0.1, sy: 0.42, sz: 0.1 }),
      ],
      legL: [part(B, b.body, { x: 0.15, y: -legH / 2, sx: 0.14, sy: legH, sz: 0.14 }),
        part(CN, b.head, { x: 0.15, y: -legH + 0.04, z: 0.14, rx: Math.PI / 2, sx: 0.26, sy: 0.34, sz: 0.06 })],
      legR: [part(B, b.body, { x: -0.15, y: -legH / 2, sx: 0.14, sy: legH, sz: 0.14 }),
        part(CN, b.head, { x: -0.15, y: -legH + 0.04, z: 0.14, rx: Math.PI / 2, sx: 0.26, sy: 0.34, sz: 0.06 })],
    };
  },

  ashwalker(b, h) {
    const legH = h * 0.44, torso = h * 0.34;
    const headY = legH + torso + 0.14;
    return {
      pivot: legH, headY, headR: 0.19,
      upper: [
        // cracked charcoal body with molten seams
        part(B, b.body, { y: legH + torso * 0.5, rx: 0.1, sx: 0.58, sy: torso, sz: 0.34 }),
        part(B, b.body, { y: legH + torso * 0.96, sx: 0.78, sy: 0.18, sz: 0.38 }),
        ...[0, 1, 2, 3].map((i) => emit(B, b.head, {
          x: (i % 2 ? 0.12 : -0.12), y: legH + torso * (0.28 + i * 0.19), z: 0.17,
          rz: i * 0.5, sx: 0.22, sy: 0.045, sz: 0.02,
        })),
        emit(B, b.head, { x: 0.29, y: legH + torso * 0.5, sx: 0.02, sy: torso * 0.7, sz: 0.05 }),
        // faceless burning head with an ember crown
        part(S, 0x1c0f0a, { y: headY, sx: 0.36, sy: 0.4, sz: 0.36 }),
        emit(B, b.head, { y: headY, z: 0.16, sx: 0.24, sy: 0.05, sz: 0.03 }),
        emit(B, b.head, { y: headY + 0.1, z: 0.15, sx: 0.14, sy: 0.03, sz: 0.03 }),
        ...[0, 1, 2, 3, 4].map((i) => emit(IC, b.eye, {
          x: Math.cos(i * 1.256) * 0.2, y: headY + 0.26, z: Math.sin(i * 1.256) * 0.2,
          sx: 0.1, sy: 0.14, sz: 0.1, opacity: 0.9,
        })),
        part(B, b.body, { x: 0.4, y: legH + torso * 0.5, rz: 0.14, sx: 0.15, sy: torso * 1.05, sz: 0.15 }),
        part(B, b.body, { x: -0.4, y: legH + torso * 0.5, rz: -0.14, sx: 0.15, sy: torso * 1.05, sz: 0.15 }),
        emit(S, b.head, { x: 0.42, y: legH + torso * 0.02, sx: 0.14, sy: 0.14, sz: 0.14 }),
        emit(S, b.head, { x: -0.42, y: legH + torso * 0.02, sx: 0.14, sy: 0.14, sz: 0.14 }),
      ],
      legL: [part(B, b.body, { x: 0.16, y: -legH / 2, sx: 0.18, sy: legH, sz: 0.18 }),
        emit(B, b.head, { x: 0.16, y: -legH * 0.5, z: 0.1, sx: 0.05, sy: legH * 0.5, sz: 0.02 })],
      legR: [part(B, b.body, { x: -0.16, y: -legH / 2, sx: 0.18, sy: legH, sz: 0.18 }),
        emit(B, b.head, { x: -0.16, y: -legH * 0.5, z: 0.1, sx: 0.05, sy: legH * 0.5, sz: 0.02 })],
    };
  },

  gellump(b, h) {
    return {
      pivot: h * 0.16, headY: h * 0.72, headR: 0.3, wobble: 1.4, ghost: 0.8,
      upper: [
        part(S, b.body, { y: h * 0.44, sx: 1.25, sy: 1.0, sz: 1.15 }),
        part(S, b.body, { y: h * 0.72, sx: 0.8, sy: 0.7, sz: 0.75 }),
        // a dark nucleus suspended inside
        part(S, 0x3a1420, { y: h * 0.46, sx: 0.4, sy: 0.4, sz: 0.4, opacity: 1 }),
        emit(S, b.eye, { x: 0.16, y: h * 0.76, z: 0.28, sx: 0.13, sy: 0.13, sz: 0.09 }),
        emit(S, b.eye, { x: -0.16, y: h * 0.76, z: 0.28, sx: 0.13, sy: 0.13, sz: 0.09 }),
        // finger nubs around the base — it used to be part of a hand
        ...[0, 1, 2, 3, 4, 5].map((i) => part(C, b.head, {
          x: Math.cos(i * 1.047) * 0.52, y: h * 0.14, z: Math.sin(i * 1.047) * 0.52,
          rz: Math.cos(i * 1.047) * 0.5, rx: -Math.sin(i * 1.047) * 0.5,
          sx: 0.14, sy: 0.4, sz: 0.14, opacity: 0.85,
        })),
      ],
      legL: [], legR: [],
    };
  },

  // -- raiders, aliens, anomalies -------------------------------------------

  neonpunk(b, h) {
    const legH = h * 0.46, torso = h * 0.32;
    const headY = legH + torso + 0.16;
    return {
      pivot: legH, headY, headR: 0.18,
      upper: [
        part(B, b.body, { y: legH + torso * 0.5, sx: 0.56, sy: torso, sz: 0.32 }),
        // open jacket with neon piping
        part(B, shadeHex(b.body, 1.5), { x: 0.24, y: legH + torso * 0.52, sx: 0.16, sy: torso * 1.05, sz: 0.4 }),
        part(B, shadeHex(b.body, 1.5), { x: -0.24, y: legH + torso * 0.52, sx: 0.16, sy: torso * 1.05, sz: 0.4 }),
        emit(B, b.neon, { x: 0.31, y: legH + torso * 0.52, z: 0.02, sx: 0.03, sy: torso * 0.95, sz: 0.34 }),
        emit(B, b.neon, { x: -0.31, y: legH + torso * 0.52, z: 0.02, sx: 0.03, sy: torso * 0.95, sz: 0.34 }),
        // spiked pauldron, one side only
        part(B, shadeHex(b.body, 1.5), { x: 0.4, y: legH + torso * 0.98, rz: -0.3, sx: 0.3, sy: 0.2, sz: 0.4 }),
        ...[0, 1, 2].map((i) => part(CN, 0xc9d4e0, {
          x: 0.4, y: legH + torso * 1.1, z: (i - 1) * 0.14, sx: 0.08, sy: 0.2, sz: 0.08,
        })),
        // head with goggles and a mohawk
        part(S, b.head, { y: headY, sx: 0.34, sy: 0.38, sz: 0.34 }),
        part(B, 0x14181e, { y: headY + 0.03, z: 0.15, sx: 0.34, sy: 0.12, sz: 0.06 }),
        emit(S, b.eye, { x: 0.1, y: headY + 0.03, z: 0.19, sx: 0.09, sy: 0.09, sz: 0.03 }),
        emit(S, b.eye, { x: -0.1, y: headY + 0.03, z: 0.19, sx: 0.09, sy: 0.09, sz: 0.03 }),
        ...[0, 1, 2, 3].map((i) => emit(CN, b.neon, {
          y: headY + 0.24, z: 0.14 - i * 0.12, sx: 0.07, sy: 0.24 - Math.abs(i - 1.5) * 0.06, sz: 0.13,
        })),
        // arms, one holding a stubby gun
        part(B, b.body, { x: 0.36, y: legH + torso * 0.5, z: 0.1, rx: -0.6, sx: 0.13, sy: torso * 0.95, sz: 0.13 }),
        part(B, 0x22272e, { x: 0.36, y: legH + torso * 0.28, z: 0.42, sx: 0.1, sy: 0.12, sz: 0.44 }),
        emit(B, b.eye, { x: 0.36, y: legH + torso * 0.28, z: 0.64, sx: 0.06, sy: 0.06, sz: 0.03 }),
        part(B, b.body, { x: -0.36, y: legH + torso * 0.5, rz: -0.2, sx: 0.13, sy: torso * 0.95, sz: 0.13 }),
      ],
      legL: [part(B, b.body, { x: 0.15, y: -legH / 2, sx: 0.17, sy: legH, sz: 0.17 }),
        part(B, 0x14181e, { x: 0.15, y: -legH + 0.12, z: 0.04, sx: 0.2, sy: 0.26, sz: 0.3 })],
      legR: [part(B, b.body, { x: -0.15, y: -legH / 2, sx: 0.17, sy: legH, sz: 0.17 }),
        part(B, 0x14181e, { x: -0.15, y: -legH + 0.12, z: 0.04, sx: 0.2, sy: 0.26, sz: 0.3 })],
    };
  },

  xenoling(b, h) {
    const legH = h * 0.46, torso = h * 0.3;
    const headY = legH + torso + 0.18;
    return {
      pivot: legH, headY, headR: 0.2,
      upper: [
        part(B, b.body, { y: legH + torso * 0.5, rx: 0.16, sx: 0.42, sy: torso, sz: 0.3 }),
        part(B, b.body, { y: legH + torso * 0.96, sx: 0.62, sy: 0.14, sz: 0.3 }),
        // glowing throat sac
        emit(S, b.head, { y: legH + torso * 0.86, z: 0.2, sx: 0.24, sy: 0.3, sz: 0.2, opacity: 0.85 }),
        // elongated backswept skull
        part(S, b.head, { y: headY, z: 0.02, sx: 0.3, sy: 0.3, sz: 0.4 }),
        part(CN, b.head, { y: headY + 0.06, z: -0.34, rx: -Math.PI / 2 - 0.3, sx: 0.24, sy: 0.6, sz: 0.22 }),
        emit(B, b.eye, { x: 0.11, y: headY + 0.02, z: 0.19, rz: 0.4, sx: 0.14, sy: 0.05, sz: 0.03 }),
        emit(B, b.eye, { x: -0.11, y: headY + 0.02, z: 0.19, rz: -0.4, sx: 0.14, sy: 0.05, sz: 0.03 }),
        // double-jointed arms
        ...[1, -1].flatMap((s) => [
          part(B, b.body, { x: s * 0.3, y: legH + torso * 0.72, rz: s * 0.5, sx: 0.09, sy: torso * 0.6, sz: 0.09 }),
          part(B, b.body, { x: s * 0.46, y: legH + torso * 0.36, rz: s * -0.4, sx: 0.08, sy: torso * 0.62, sz: 0.08 }),
          part(CN, b.head, { x: s * 0.38, y: legH + torso * 0.02, sx: 0.1, sy: 0.26, sz: 0.1, rx: Math.PI }),
        ]),
        // tail
        part(C, b.body, { y: legH + 0.1, z: -0.42, rx: 0.9, sx: 0.09, sy: 0.7, sz: 0.09 }),
      ],
      // digitigrade legs
      legL: [part(B, b.body, { x: 0.15, y: -legH * 0.3, z: -0.06, rx: -0.4, sx: 0.13, sy: legH * 0.62, sz: 0.13 }),
        part(B, b.body, { x: 0.15, y: -legH * 0.78, z: 0.06, rx: 0.5, sx: 0.11, sy: legH * 0.55, sz: 0.11 })],
      legR: [part(B, b.body, { x: -0.15, y: -legH * 0.3, z: -0.06, rx: -0.4, sx: 0.13, sy: legH * 0.62, sz: 0.13 }),
        part(B, b.body, { x: -0.15, y: -legH * 0.78, z: 0.06, rx: 0.5, sx: 0.11, sy: legH * 0.55, sz: 0.11 })],
    };
  },

  glitchling(b, h) {
    const legH = h * 0.44, torso = h * 0.32;
    const headY = legH + torso + 0.24;
    // Deliberately misaligned slabs with chromatic ghosts either side.
    const ghostPair = (geo, o) => [
      emit(geo, 0xff2ea6, { ...o, x: (o.x || 0) - 0.07, opacity: 0.45 }),
      emit(geo, 0x2effe0, { ...o, x: (o.x || 0) + 0.07, opacity: 0.45 }),
    ];
    return {
      pivot: legH, headY, headR: 0.2, glitch: true,
      upper: [
        part(B, b.body, { y: legH + torso * 0.62, sx: 0.5, sy: torso * 0.5, sz: 0.3 }),
        part(B, b.head, { x: 0.08, y: legH + torso * 0.24, rz: 0.2, sx: 0.44, sy: torso * 0.36, sz: 0.28 }),
        ...ghostPair(B, { y: legH + torso * 0.62, sx: 0.5, sy: torso * 0.5, sz: 0.3 }),
        // head floats detached above the neck
        part(B, b.head, { y: headY, rz: 0.12, sx: 0.32, sy: 0.3, sz: 0.3 }),
        ...ghostPair(B, { y: headY, rz: 0.12, sx: 0.32, sy: 0.3, sz: 0.3 }),
        emit(B, b.eye, { y: headY, z: 0.16, sx: 0.24, sy: 0.06, sz: 0.02 }),
        // fragmented limbs, floating apart
        part(B, b.body, { x: 0.36, y: legH + torso * 0.66, rz: 0.3, sx: 0.12, sy: torso * 0.42, sz: 0.12 }),
        part(B, b.body, { x: 0.44, y: legH + torso * 0.2, rz: -0.2, sx: 0.11, sy: torso * 0.36, sz: 0.11 }),
        part(B, b.body, { x: -0.38, y: legH + torso * 0.5, rz: -0.4, sx: 0.12, sy: torso * 0.5, sz: 0.12 }),
        ...[0, 1, 2].map((i) => emit(B, i % 2 ? 0x2effe0 : 0xff2ea6, {
          x: (i - 1) * 0.4, y: legH + torso * (0.3 + i * 0.3), z: 0.22,
          sx: 0.3, sy: 0.03, sz: 0.02, opacity: 0.8,
        })),
      ],
      legL: [part(B, b.body, { x: 0.14, y: -legH * 0.55, sx: 0.14, sy: legH * 0.8, sz: 0.14 })],
      legR: [part(B, b.body, { x: -0.14, y: -legH * 0.42, sx: 0.14, sy: legH * 0.7, sz: 0.14 })],
    };
  },
};

const _shadeTmp = new THREE.Color();
function shadeHex(hex, k) { return _shadeTmp.setHex(hex).multiplyScalar(k).getHex(); }

/** A soft contact shadow, so nothing looks like it is hovering over the floor. */
function blobShadow(radius) {
  const geo = new THREE.CircleGeometry(radius, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.renderOrder = -1;
  return m;
}

/**
 * Surface classes by family. Every enemy part used to assemble with the same
 * default — no metalness, uniform roughness — so a chrome android, a wet
 * fishling and a rotting shambler were the same plastic in three colours.
 * Flesh is soft and smooth-shaded, machines are hard and reflective, creatures
 * are wet, and the anomalies barely have a surface at all.
 */
const FAMILY_SURFACE = {
  undead: { metal: 0.0, rough: 0.86, smooth: true },
  machine: { metal: 0.82, rough: 0.32 },
  creature: { metal: 0.12, rough: 0.36, smooth: true },
  anomaly: { metal: 0.4, rough: 0.5 },
  default: { metal: 0.05, rough: 0.7 },
};

/** Apply a family's surface to any part that hasn't asked for its own. */
function surfaced(parts, family, chrome) {
  const base = FAMILY_SURFACE[family] || FAMILY_SURFACE.default;
  return parts.map((q) => {
    if (q.basic || q.metal !== undefined || q.rough !== undefined) return q;
    const s = chrome ? { metal: 0.95, rough: 0.16 } : base;
    return { ...q, ...s, envIntensity: chrome ? 1.4 : 0.9 };
  });
}

export function buildEnemyMesh(type) {
  const b = type.build;
  const h = type.height;
  const builder = ENEMY_BUILDERS[type.id] || ENEMY_BUILDERS.shambler;
  const spec = builder(b, h);
  const fam = type.family;

  const rig = new THREE.Group();

  // Split the head out of the upper body so it can be aimed independently.
  // Doing it here rather than in every builder means each model declares its
  // head once — as the volume the headshot test already uses — and gets neck
  // articulation for free. A crowd whose heads all turn to watch you is the
  // single cheapest thing that stops enemies reading as furniture.
  const headParts = [], bodyParts = [];
  const hY = spec.headY ?? 0, hR = spec.headR ?? 0.2;
  for (const q of spec.upper) {
    const py = q.y ?? 0, px = q.x ?? 0;
    const inHead = py >= hY - hR * 1.7 && Math.abs(px) <= hR * 4.5;
    if (inHead) headParts.push({ ...q, y: py - hY });
    else bodyParts.push(q);
  }
  // If the split found nothing (or swallowed the whole model), don't use it.
  const useHead = headParts.length > 0 && bodyParts.length > 0;

  const upper = assemble(surfaced(useHead ? bodyParts : spec.upper, fam, b.chrome));
  const head = useHead ? assemble(surfaced(headParts, fam, b.chrome)) : null;
  if (head) { head.position.y = hY; upper.add(head); }
  const legL = assemble(surfaced(spec.legL || [], fam, b.chrome));
  const legR = assemble(surfaced(spec.legR || [], fam, b.chrome));
  legL.position.y = spec.pivot;
  legR.position.y = spec.pivot;

  if (spec.ghost !== undefined || b.ghost !== undefined) {
    const o = spec.ghost ?? b.ghost;
    upper.traverse((n) => {
      if (!n.material) return;
      n.material.transparent = true;
      n.material.opacity = Math.min(n.material.opacity ?? 1, o);
      n.material.depthWrite = false;
    });
  }

  rig.add(upper, legL, legR);
  if (!spec.flying) rig.add(blobShadow(Math.max(0.35, type.radius * 1.5)));

  rig.userData.upper = upper;
  rig.userData.head = head;
  rig.userData.legL = legL;
  rig.userData.legR = legR;
  rig.userData.legPivot = spec.pivot;
  rig.userData.flying = !!spec.flying;
  rig.userData.static = !!spec.static;
  rig.userData.wobble = spec.wobble || 0;
  rig.userData.glitch = !!spec.glitch;
  // The headshot test reads these directly, so the hit volume always matches
  // whatever the modeller actually put on top of the neck.
  rig.userData.headY = spec.headY;
  rig.userData.headR = spec.headR;
  return rig;
}

// ---------------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------------

// Bosses get the same treatment as the enemies, only larger and stranger: each
// one is modelled to its own description rather than from a shared template,
// because the boss is the thing you will be looking at for five minutes.
const BOSS_BUILDERS = {

  crookking(b, h) {
    // A queue-management process that built itself a throne out of the sorting
    // floor and started calling itself a king. Everything he wears was taken
    // from somewhere else and welded on: mismatched plate, other people's
    // badges, a crown repaired so many times it is mostly solder.
    const rust = 0x6a4a30, brass = 0xb08a3a, steel = 0x8d939c;
    const scrap = { metal: 0.75, rough: 0.55 };
    const gold = { metal: 1.0, rough: 0.28 };
    const cloth = { metal: 0.0, rough: 0.88 };
    return [
      // Torso: a strongbox with a hatch, not a chest.
      part(UNIT.bevelBox, b.body, { y: h * 0.46, sx: 2.05, sy: h * 0.46, sz: 1.15, ...scrap }),
      part(UNIT.bevelBox, shadeHex(b.body, 0.8), { y: h * 0.5, z: 0.56, sx: 1.5, sy: h * 0.32, sz: 0.14, ...scrap }),
      ...Array.from({ length: 8 }, (_, i) => part(UNIT.hex, steel, {
        x: -0.62 + (i % 4) * 0.42, y: h * (0.36 + Math.floor(i / 4) * 0.26), z: 0.64,
        rx: Math.PI / 2, sx: 0.14, sy: 0.07, sz: 0.14, metal: 0.95, rough: 0.3,
      })),
      // Mismatched plates riveted over the shoulders and flanks.
      ...Array.from({ length: 6 }, (_, i) => part(UNIT.slab, i % 2 ? rust : shadeHex(b.body, 1.2), {
        x: -0.9 + (i % 3) * 0.9, y: h * (0.34 + Math.floor(i / 3) * 0.3), z: 0.58,
        rz: (i - 2.5) * 0.09, sx: 0.7, sy: 0.34, sz: 0.08, ...scrap,
      })),
      // Chest of scavenged "medals" — other people's session badges.
      ...Array.from({ length: 7 }, (_, i) => part(UNIT.disc, brass, {
        x: -0.6 + i * 0.2, y: h * (0.4 + (i % 3) * 0.07), z: 0.66, rx: Math.PI / 2,
        sx: 0.17, sy: 0.03, sz: 0.17, ...gold,
      })),
      ...Array.from({ length: 7 }, (_, i) => emit(UNIT.icosa, b.accent, {
        x: -0.6 + i * 0.2, y: h * (0.4 + (i % 3) * 0.07), z: 0.7, sx: 0.1, sy: 0.1, sz: 0.06,
      })),
      // The throne, worn as a backpack: uprights, a canopy and a broken finial.
      part(UNIT.bevelBox, shadeHex(b.body, 0.6), { y: h * 0.46, z: -0.72, sx: 2.5, sy: h * 0.66, sz: 0.3, ...scrap }),
      ...Array.from({ length: 5 }, (_, i) => part(UNIT.bevelBox, shadeHex(b.body, 0.5), {
        x: (i - 2) * 0.55, y: h * (0.86 + (i % 2) * 0.11), z: -0.76,
        rz: (i - 2) * 0.11, sx: 0.3, sy: 0.8, sz: 0.24, ...scrap,
      })),
      ...Array.from({ length: 5 }, (_, i) => part(UNIT.cone, brass, {
        x: (i - 2) * 0.55, y: h * (1.06 + (i % 2) * 0.11), z: -0.76,
        rz: (i - 2) * 0.11, sx: 0.22, sy: 0.36, sz: 0.22, ...gold,
      })),
      part(UNIT.bevelBox, rust, { y: h * 1.12, z: -0.78, sx: 2.7, sy: 0.16, sz: 0.34, ...scrap }),
      // Cape: layered, ragged along the bottom, dragging.
      ...Array.from({ length: 4 }, (_, i) => part(UNIT.slab, shadeHex(b.body, 0.5 - i * 0.05), {
        y: h * (0.4 - i * 0.05), z: -0.95 - i * 0.09, rx: 0.12 + i * 0.05,
        sx: 2.2 - i * 0.2, sy: h * (0.7 + i * 0.06), sz: 0.1, ...cloth,
      })),
      ...Array.from({ length: 7 }, (_, i) => part(UNIT.wedge, shadeHex(b.body, 0.42), {
        x: (i - 3) * 0.34, y: h * 0.06, z: -1.24, rx: 0.2, rz: Math.PI, ry: Math.PI / 2,
        sx: 0.12, sy: 0.34 + (i % 3) * 0.16, sz: 0.3, ...cloth,
      })),
      // Head: hunched into the collar, letterbox eyes, a jaw of sorted junk.
      part(UNIT.pipe, rust, { y: h * 0.68, z: 0.06, sx: 1.3, sy: 0.3, sz: 1.2, ...scrap }),
      part(UNIT.lowSphere, shadeHex(b.body, 0.78), { y: h * 0.8, z: 0.12, sx: 1.05, sy: 1.0, sz: 1.0, ...scrap }),
      part(UNIT.bevelBox, 0x0d1116, { y: h * 0.8, z: 0.56, sx: 0.78, sy: 0.26, sz: 0.12 }),
      emit(B, b.eye, { x: 0.2, y: h * 0.8, z: 0.62, sx: 0.24, sy: 0.1, sz: 0.03 }),
      emit(B, b.eye, { x: -0.2, y: h * 0.8, z: 0.62, sx: 0.24, sy: 0.1, sz: 0.03 }),
      ...Array.from({ length: 6 }, (_, i) => part(UNIT.bevelBox, steel, {
        x: -0.34 + i * 0.14, y: h * 0.68, z: 0.56, sx: 0.1, sy: 0.14, sz: 0.08, metal: 0.9, rough: 0.4,
      })),
      // Crown: uneven spikes, visible solder, one spike snapped off short.
      part(UNIT.pipe, brass, { y: h * 1.0, sx: 1.18, sy: 0.26, sz: 1.18, ...gold }),
      ...Array.from({ length: 7 }, (_, i) => {
        const a2 = i * (Math.PI * 2 / 7);
        const broken = i === 3;
        return part(UNIT.cone, brass, {
          x: Math.cos(a2) * 0.52, y: h * (1.1 + (i % 2) * 0.05), z: Math.sin(a2) * 0.52,
          rz: (i % 3 - 1) * 0.22, sx: 0.24, sy: broken ? 0.18 : 0.5 + (i % 2) * 0.2, sz: 0.24, ...gold,
        });
      }),
      ...Array.from({ length: 5 }, (_, i) => part(UNIT.lowSphere, 0x9a8a6a, {
        x: Math.cos(i * 1.25) * 0.55, y: h * 1.02, z: Math.sin(i * 1.25) * 0.55,
        sx: 0.13, sy: 0.09, sz: 0.13, metal: 0.7, rough: 0.65,
      })),
      emit(UNIT.icosa, b.accent, { y: h * 1.24, sx: 0.26, sy: 0.32, sz: 0.26 }),
      // Arms: one holds a pipe sceptre with a socket head welded on.
      part(UNIT.capsule, b.body, { x: 1.28, y: h * 0.54, rz: 0.22, sx: 0.42, sy: h * 0.24, sz: 0.42, ...scrap }),
      part(UNIT.lowSphere, rust, { x: 1.36, y: h * 0.32, sx: 0.44, sy: 0.42, sz: 0.44, ...scrap }),
      part(UNIT.capsule, b.body, { x: 1.44, y: h * 0.16, rz: 0.1, sx: 0.36, sy: h * 0.2, sz: 0.36, ...scrap }),
      part(C, shadeHex(b.body, 0.5), { x: 1.5, y: h * 0.66, rz: 0.1, sx: 0.16, sy: h * 1.05, sz: 0.16, ...scrap }),
      part(UNIT.pipe, brass, { x: 1.56, y: h * 1.08, sx: 0.36, sy: 0.24, sz: 0.36, ...gold }),
      emit(UNIT.icosa, b.accent, { x: 1.58, y: h * 1.2, sx: 0.42, sy: 0.5, sz: 0.42 }),
      ...Array.from({ length: 4 }, (_, i) => part(UNIT.ring, steel, {
        x: 1.52, y: h * (0.3 + i * 0.18), rx: Math.PI / 2, sx: 0.22, sy: 0.22, sz: 0.22, metal: 0.9, rough: 0.4,
      })),
      part(UNIT.capsule, b.body, { x: -1.3, y: h * 0.5, rz: -0.3, sx: 0.4, sy: h * 0.24, sz: 0.4, ...scrap }),
      part(UNIT.lowSphere, rust, { x: -1.4, y: h * 0.3, sx: 0.42, sy: 0.4, sz: 0.42, ...scrap }),
      part(UNIT.capsule, b.body, { x: -1.46, y: h * 0.14, rz: -0.12, sx: 0.34, sy: h * 0.18, sz: 0.34, ...scrap }),
      part(UNIT.lowSphere, shadeHex(b.body, 1.2), { x: -1.5, y: h * 0.0, sx: 0.5, sy: 0.46, sz: 0.5, ...scrap }),
      // Legs: squat, plated, standing on a low plinth of welded scrap.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.capsule, b.body, { x: sg * 0.5, y: h * 0.14, sx: 0.46, sy: h * 0.16, sz: 0.46, ...scrap }),
        part(UNIT.bevelBox, rust, { x: sg * 0.5, y: h * 0.24, sx: 0.56, sy: 0.16, sz: 0.56, ...scrap }),
        part(UNIT.bevelBox, shadeHex(b.body, 0.7), { x: sg * 0.5, y: 0.1, z: 0.1, sx: 0.6, sy: 0.2, sz: 0.9, ...scrap }),
      ]),
    ];
  },

  crocodilejim(b, h) {
    // He is called Laughing Crocodile Jim, so the grin is the model. Everything
    // else — the barrel chest, the low tail, the little office lanyard — hangs
    // off a head that is far too wide and permanently open.
    const hide = { metal: 0.05, rough: 0.55, smooth: true };
    const belly = shadeHex(b.body, 1.5);
    const tooth = 0xf6f2e4;
    const scute = (y, z, sc, i) => part(UNIT.cone, b.accent, {
      y, z, rx: -0.3 + i * 0.03, sx: sc, sy: sc * 1.5, sz: sc * 0.8, ...hide,
    });
    return [
      // Barrel body, wider than it is tall, with a plated belly.
      part(UNIT.capsule, b.body, { y: h * 0.5, rx: Math.PI / 2, rz: 0.06, sx: 1.5, sy: 1.1, sz: 1.3, ...hide }),
      part(UNIT.bevelBox, belly, { y: h * 0.32, z: 0.18, sx: 1.1, sy: 0.5, sz: 1.5, ...hide }),
      ...Array.from({ length: 6 }, (_, i) => part(UNIT.slab, shadeHex(belly, 0.9), {
        y: h * 0.26, z: 0.7 - i * 0.28, sx: 1.12, sy: 0.06, sz: 0.16, ...hide,
      })),
      // Neck into a very wide skull.
      part(UNIT.capsule, b.body, { y: h * 0.72, z: 0.62, rx: 1.2, sx: 0.9, sy: 0.5, sz: 0.9, ...hide }),
      part(UNIT.bevelBox, b.body, { y: h * 0.84, z: 0.95, rx: 0.08, sx: 1.15, sy: 0.52, sz: 1.0, ...hide }),
      // Upper jaw: long, tapering, nostrils on top.
      part(UNIT.wedge, b.body, { y: h * 0.9, z: 1.75, ry: Math.PI / 2, rz: Math.PI, sx: 1.5, sy: 0.34, sz: 0.95, ...hide }),
      part(UNIT.bevelBox, b.body, { y: h * 0.93, z: 1.6, rx: 0.03, sx: 0.9, sy: 0.28, sz: 1.5, ...hide }),
      part(UNIT.lowSphere, shadeHex(b.body, 0.7), { x: 0.16, y: h * 1.02, z: 2.3, sx: 0.14, sy: 0.1, sz: 0.14, ...hide }),
      part(UNIT.lowSphere, shadeHex(b.body, 0.7), { x: -0.16, y: h * 1.02, z: 2.3, sx: 0.14, sy: 0.1, sz: 0.14, ...hide }),
      // Lower jaw, dropped open — this is the whole silhouette.
      part(UNIT.bevelBox, belly, { y: h * 0.6, z: 1.5, rx: -0.22, sx: 0.85, sy: 0.24, sz: 1.5, ...hide }),
      part(UNIT.wedge, belly, { y: h * 0.52, z: 2.2, ry: Math.PI / 2, sx: 1.3, sy: 0.24, sz: 0.8, ...hide }),
      part(UNIT.bevelBox, 0x6a2028, { y: h * 0.72, z: 1.5, rx: -0.12, sx: 0.78, sy: 0.3, sz: 1.4, rough: 0.4, smooth: true }),
      // Teeth: interlocking, uneven, far too many.
      ...Array.from({ length: 22 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const k = Math.floor(i / 2);
        const upper = k < 6;
        const j = upper ? k : k - 6;
        const z = 1.0 + j * 0.24;
        return part(UNIT.cone, tooth, {
          x: side * (0.42 - j * 0.018), y: h * (upper ? 0.79 : 0.68) + (upper ? 0 : 0.02),
          z, rx: upper ? Math.PI : 0,
          sx: 0.13 - j * 0.008, sy: 0.34 - j * 0.02, sz: 0.13 - j * 0.008, rough: 0.35,
        });
      }),
      // Eyes: high, wide-set, on ridges, with slit pupils and heavy lids.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.lowSphere, shadeHex(b.body, 0.85), { x: sg * 0.4, y: h * 0.98, z: 0.68, sx: 0.42, sy: 0.34, sz: 0.42, ...hide }),
        emit(UNIT.lowSphere, b.eye, { x: sg * 0.4, y: h * 1.02, z: 0.74, sx: 0.32, sy: 0.32, sz: 0.3 }),
        part(UNIT.box, 0x101418, { x: sg * 0.4, y: h * 1.03, z: 0.86, sx: 0.05, sy: 0.18, sz: 0.06 }),
        part(UNIT.wedge, shadeHex(b.body, 0.8), { x: sg * 0.4, y: h * 1.1, z: 0.72, rz: sg * 1.6, sx: 0.38, sy: 0.13, sz: 0.38, ...hide }),
      ]),
      // Dorsal scutes down the spine and into the tail.
      ...Array.from({ length: 7 }, (_, i) => scute(h * (0.82 - i * 0.05), -0.1 - i * 0.4, 0.34 - i * 0.03, i)),
      part(UNIT.capsule, b.body, { y: h * 0.34, z: -1.7, rx: 1.35, sx: 0.62, sy: 1.4, sz: 0.62, ...hide }),
      part(UNIT.cone, b.body, { y: h * 0.2, z: -2.7, rx: -1.5, sx: 0.42, sy: 1.0, sz: 0.42, ...hide }),
      // Stubby, splayed limbs with claws.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.capsule, b.body, { x: sg * 0.86, y: h * 0.44, z: 0.5, rz: sg * 0.5, sx: 0.36, sy: 0.5, sz: 0.36, ...hide }),
        part(UNIT.capsule, b.body, { x: sg * 1.02, y: h * 0.18, z: 0.6, rz: sg * 0.15, sx: 0.3, sy: 0.44, sz: 0.3, ...hide }),
        ...[0, 1, 2].map((i) => part(UNIT.cone, tooth, {
          x: sg * (0.92 + i * 0.14), y: 0.06, z: 0.85, rx: 1.4, sx: 0.09, sy: 0.28, sz: 0.09, rough: 0.35,
        })),
        part(UNIT.capsule, b.body, { x: sg * 0.82, y: h * 0.2, z: -0.9, rz: sg * 0.3, sx: 0.4, sy: 0.5, sz: 0.4, ...hide }),
        part(UNIT.bevelBox, shadeHex(b.body, 0.8), { x: sg * 0.86, y: 0.1, z: -0.8, sx: 0.42, sy: 0.2, sz: 0.6, ...hide }),
      ]),
      // THE LANYARD. He works here. That is the joke and it has to be legible.
      part(UNIT.cyl, 0x1f4a8a, { x: 0.3, y: h * 0.66, z: 0.5, rz: 0.55, rx: 0.2, sx: 0.06, sy: 0.7, sz: 0.06, rough: 0.8 }),
      part(UNIT.cyl, 0x1f4a8a, { x: -0.3, y: h * 0.66, z: 0.5, rz: -0.55, rx: 0.2, sx: 0.06, sy: 0.7, sz: 0.06, rough: 0.8 }),
      part(UNIT.slab, 0xe8e4d8, { y: h * 0.4, z: 0.78, rx: 0.1, sx: 0.34, sy: 0.46, sz: 0.03, rough: 0.6 }),
      emit(B, 0xd9e84a, { y: h * 0.45, z: 0.8, sx: 0.24, sy: 0.05, sz: 0.01 }),
      emit(B, 0xd9e84a, { y: h * 0.35, z: 0.8, sx: 0.18, sy: 0.04, sz: 0.01 }),
    ];
  },

  fishkid(b, h) {
    // An antique diving suit several sizes too big, half full of water, with
    // something small and unhappy floating around inside the helmet. The suit
    // is the character; the kid is a detail you only catch up close.
    const brass = { metal: 1.0, rough: 0.28 };
    const canvas = { metal: 0.0, rough: 0.82 };
    const rubber = { metal: 0.0, rough: 0.92 };
    return [
      // Canvas suit: ribbed, sagging, oversized.
      part(UNIT.capsule, b.body, { y: h * 0.44, sx: 1.0, sy: h * 0.3, sz: 0.78, ...canvas, smooth: true }),
      ...Array.from({ length: 7 }, (_, i) => part(UNIT.pipe, shadeHex(b.body, 0.88), {
        y: h * (0.24 + i * 0.07), sx: 1.02 - Math.abs(i - 3) * 0.03, sy: 0.09, sz: 0.8, ...canvas,
      })),
      // Brass corselet the helmet bolts onto.
      part(UNIT.lowCyl, 0xc9a24a, { y: h * 0.64, sx: 0.92, sy: 0.18, sz: 0.84, ...brass }),
      ...Array.from({ length: 8 }, (_, i) => part(UNIT.hex, 0xe0bd63, {
        x: Math.cos(i * TAU_M / 8) * 0.42, y: h * 0.68, z: Math.sin(i * TAU_M / 8) * 0.38,
        sx: 0.11, sy: 0.06, sz: 0.11, ...brass,
      })),
      part(UNIT.lowCyl, 0xc9a24a, { y: h * 0.74, sx: 0.6, sy: 0.12, sz: 0.6, ...brass }),
      // Helmet: brass shell, three portholes, a crown vent.
      part(UNIT.lowSphere, 0xc9a24a, { y: h * 0.94, sx: 0.86, sy: 0.9, sz: 0.86, smooth: true, ...brass }),
      part(UNIT.lowCyl, 0xc9a24a, { y: h * 0.86, sx: 0.9, sy: 0.3, sz: 0.9, ...brass }),
      part(UNIT.torus, 0xe0bd63, { y: h * 0.92, z: 0.3, sx: 0.62, sy: 0.62, sz: 0.62, ...brass }),
      part(UNIT.disc, 0xbfe8f0, { y: h * 0.92, z: 0.33, rx: Math.PI / 2, sx: 0.5, sy: 0.05, sz: 0.5, opacity: 0.42, rough: 0.05, smooth: true }),
      ...[1, -1].flatMap((sg) => [
        part(UNIT.torus, 0xe0bd63, { x: sg * 0.42, y: h * 0.94, z: 0.05, ry: sg * 1.2, sx: 0.4, sy: 0.4, sz: 0.4, ...brass }),
        part(UNIT.disc, 0xbfe8f0, { x: sg * 0.44, y: h * 0.94, z: 0.05, rz: Math.PI / 2, ry: sg * 1.2, sx: 0.3, sy: 0.04, sz: 0.3, opacity: 0.4, rough: 0.05, smooth: true }),
      ]),
      part(UNIT.lowCyl, 0xe0bd63, { y: h * 1.16, sx: 0.3, sy: 0.16, sz: 0.3, ...brass }),
      ...[0, 1, 2, 3].map((i) => part(UNIT.box, 0xa8842e, {
        y: h * 1.16, ry: i * TAU_M / 4, sx: 0.36, sy: 0.1, sz: 0.05, ...brass,
      })),
      // The water inside, at about forty percent, and the kid floating in it.
      emit(UNIT.disc, b.accent, { y: h * 0.86, rx: Math.PI / 2, sx: 0.78, sy: 0.02, sz: 0.78, opacity: 0.55 }),
      part(UNIT.lowSphere, b.accent, { y: h * 0.72, sx: 0.78, sy: 0.5, sz: 0.74, opacity: 0.35, rough: 0.1, smooth: true }),
      part(UNIT.lowSphere, 0xe8d8c0, { y: h * 0.98, z: 0.14, sx: 0.28, sy: 0.3, sz: 0.26, smooth: true, rough: 0.6 }),
      emit(UNIT.lowSphere, b.eye, { x: 0.08, y: h * 1.0, z: 0.26, sx: 0.1, sy: 0.11, sz: 0.06 }),
      emit(UNIT.lowSphere, b.eye, { x: -0.08, y: h * 1.0, z: 0.26, sx: 0.1, sy: 0.11, sz: 0.06 }),
      part(UNIT.box, 0x2a1a14, { y: h * 0.93, z: 0.28, sx: 0.1, sy: 0.03, sz: 0.03 }),
      // Bubbles rising past the glass.
      ...[0, 1, 2, 3].map((i) => emit(UNIT.lowSphere, 0xdff6ff, {
        x: -0.2 + i * 0.14, y: h * (0.9 + (i % 3) * 0.06), z: 0.2,
        sx: 0.06 - i * 0.008, sy: 0.06 - i * 0.008, sz: 0.03, opacity: 0.6,
      })),
      // Twin air tanks and the hose that loops to the helmet.
      ...[1, -1].map((sg) => part(UNIT.capsule, 0x88a0aa, {
        x: sg * 0.26, y: h * 0.5, z: -0.52, sx: 0.32, sy: h * 0.3, sz: 0.32, metal: 0.8, rough: 0.35,
      })),
      ...[1, -1].map((sg) => part(UNIT.hex, 0xc9a24a, {
        x: sg * 0.26, y: h * 0.74, z: -0.52, sx: 0.16, sy: 0.1, sz: 0.16, ...brass,
      })),
      part(UNIT.torus, 0x24303a, { x: 0.34, y: h * 0.78, z: -0.24, rx: 1.2, ry: 0.5, sx: 0.5, sy: 0.5, sz: 0.5, ...rubber }),
      part(UNIT.cyl, 0x24303a, { x: 0.5, y: h * 0.86, z: 0.0, rz: 0.8, rx: 0.4, sx: 0.09, sy: 0.5, sz: 0.09, ...rubber }),
      // Arms in stiff sleeves, with heavy cuffs and mitts.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.capsule, b.body, { x: sg * 0.62, y: h * 0.44, rz: sg * 0.24, sx: 0.28, sy: h * 0.22, sz: 0.28, ...canvas, smooth: true }),
        ...Array.from({ length: 4 }, (_, i) => part(UNIT.pipe, shadeHex(b.body, 0.85), {
          x: sg * (0.62 + i * 0.02), y: h * (0.34 + i * 0.07), rz: sg * 0.24, sx: 0.3, sy: 0.07, sz: 0.3, ...canvas,
        })),
        part(UNIT.pipe, 0xc9a24a, { x: sg * 0.7, y: h * 0.26, sx: 0.34, sy: 0.14, sz: 0.34, ...brass }),
        part(UNIT.lowSphere, 0x88a0aa, { x: sg * 0.72, y: h * 0.16, sx: 0.34, sy: 0.32, sz: 0.34, smooth: true, metal: 0.7, rough: 0.4 }),
      ]),
      // Weighted boots — enormous, and the reason he moves like that.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.capsule, b.body, { x: sg * 0.26, y: h * 0.16, sx: 0.34, sy: h * 0.12, sz: 0.34, ...canvas, smooth: true }),
        part(UNIT.bevelBox, 0x3a4a52, { x: sg * 0.26, y: 0.12, z: 0.1, sx: 0.5, sy: 0.24, sz: 0.72, metal: 0.6, rough: 0.55 }),
        part(UNIT.slab, 0xc9a24a, { x: sg * 0.26, y: 0.25, z: 0.1, sx: 0.52, sy: 0.05, sz: 0.74, ...brass }),
        part(UNIT.slab, 0x1a2228, { x: sg * 0.26, y: 0.02, z: 0.1, sx: 0.52, sy: 0.04, sz: 0.74, ...rubber }),
      ]),
    ];
  },

  texasvegas(b, h) {
    // A cowboy assembled entirely out of casino. The hat is the silhouette,
    // the coat is a lit sign, and every piece of trim is something the Strip
    // would have hung over a door.
    const leather = 0x2a1c16, chrome = 0xd8dce4, felt = 0x1a1a20;
    const cloth = { metal: 0.0, rough: 0.86 };
    const hide = { metal: 0.05, rough: 0.6 };
    const shiny = { metal: 1.0, rough: 0.18 };
    return [
      // Body and the long coat, open at the front, piped in neon.
      part(UNIT.bevelBox, b.body, { y: h * 0.55, sx: 0.88, sy: h * 0.4, sz: 0.5, ...cloth }),
      ...[1, -1].flatMap((sg) => [
        part(UNIT.slab, shadeHex(b.body, 1.45), { x: sg * 0.44, y: h * 0.42, rz: sg * 0.06, sx: 0.24, sy: h * 0.64, sz: 0.62, ...cloth }),
        part(UNIT.wedge, shadeHex(b.body, 1.2), { x: sg * 0.5, y: h * 0.12, rz: sg * 0.1, ry: sg > 0 ? 0 : Math.PI, sx: 0.22, sy: 0.3, sz: 0.5, ...cloth }),
        emit(B, b.accent, { x: sg * 0.57, y: h * 0.42, z: 0.02, sx: 0.035, sy: h * 0.62, sz: 0.54 }),
        emit(B, b.accent, { x: sg * 0.44, y: h * 0.1, sx: 0.26, sy: 0.035, sz: 0.62 }),
      ]),
      // Waistcoat, string tie, and the shirt underneath.
      part(UNIT.slab, 0xe8e2d4, { y: h * 0.6, z: 0.26, sx: 0.42, sy: h * 0.3, sz: 0.05, ...cloth }),
      part(UNIT.bevelBox, felt, { y: h * 0.56, z: 0.24, sx: 0.62, sy: h * 0.28, sz: 0.1, ...cloth }),
      ...[1, -1].map((sg) => part(C, 0x8a1a2a, { x: sg * 0.06, y: h * 0.7, z: 0.3, rz: sg * 0.5, sx: 0.03, sy: 0.22, sz: 0.03, ...cloth })),
      part(UNIT.disc, chrome, { y: h * 0.76, z: 0.31, rx: Math.PI / 2, sx: 0.12, sy: 0.04, sz: 0.12, ...shiny }),
      // Belt buckle the size of a road sign.
      part(UNIT.bevelBox, leather, { y: h * 0.36, sx: 0.94, sy: 0.14, sz: 0.56, ...hide }),
      part(UNIT.bevelBox, 0xc9a227, { y: h * 0.36, z: 0.3, sx: 0.42, sy: 0.3, sz: 0.08, ...shiny }),
      emit(B, b.eye, { y: h * 0.36, z: 0.35, sx: 0.3, sy: 0.18, sz: 0.02 }),
      // Cartridge loops and two chips tucked in the belt.
      ...Array.from({ length: 8 }, (_, i) => part(C, 0xb08a3a, {
        x: -0.36 + i * 0.1, y: h * 0.36, z: -0.26, rx: Math.PI / 2, sx: 0.05, sy: 0.14, sz: 0.05, ...shiny,
      })),
      // Face under an enormous hat: shadowed, only the jaw and eyes lit.
      part(UNIT.lowSphere, 0xe8c9a0, { y: h * 0.84, sx: 0.5, sy: 0.56, sz: 0.5, rough: 0.7, smooth: true }),
      part(UNIT.wedge, 0xd8b48a, { y: h * 0.76, z: 0.2, ry: Math.PI / 2, rz: Math.PI, sx: 0.36, sy: 0.16, sz: 0.28, rough: 0.7 }),
      part(UNIT.bevelBox, 0x1a1a20, { y: h * 0.87, z: 0.22, sx: 0.44, sy: 0.11, sz: 0.08 }),
      emit(B, b.eye, { y: h * 0.87, z: 0.26, sx: 0.36, sy: 0.05, sz: 0.02 }),
      part(UNIT.slab, 0x4a3a2a, { y: h * 0.73, z: 0.24, sx: 0.32, sy: 0.07, sz: 0.06, rough: 0.9 }),
      part(UNIT.slab, 0x4a3a2a, { y: h * 0.69, z: 0.2, sx: 0.2, sy: 0.09, sz: 0.06, rough: 0.9 }),
      // The hat: crown, dented pinch, curled brim, hatband with a card in it.
      part(UNIT.lowCyl, felt, { y: h * 1.02, sx: 0.68, sy: 0.46, sz: 0.68, ...cloth }),
      part(UNIT.wedge, shadeHex(felt, 1.4), { y: h * 1.2, ry: Math.PI / 2, rz: Math.PI, sx: 0.6, sy: 0.14, sz: 0.3, ...cloth }),
      part(UNIT.lowCyl, felt, { y: h * 0.93, sx: 2.1, sy: 0.08, sz: 1.8, ...cloth }),
      part(UNIT.pipe, shadeHex(felt, 1.6), { y: h * 0.93, sx: 2.12, sy: 0.1, sz: 1.82, ...cloth }),
      part(UNIT.pipe, 0x8a1a2a, { y: h * 0.86, sx: 0.7, sy: 0.14, sz: 0.7, ...cloth }),
      emit(B, b.accent, { y: h * 0.86, z: 0.34, sx: 0.5, sy: 0.05, sz: 0.02 }),
      part(UNIT.slab, 0xe8e2d4, { x: 0.3, y: h * 0.92, z: 0.24, rz: 0.5, sx: 0.16, sy: 0.24, sz: 0.02, ...cloth }),
      // Two long-barrelled revolvers, held out, hammers back.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.capsule, b.body, { x: sg * 0.62, y: h * 0.58, z: 0.2, rx: -0.5, sx: 0.19, sy: h * 0.2, sz: 0.19, ...cloth }),
        part(UNIT.capsule, b.body, { x: sg * 0.66, y: h * 0.44, z: 0.46, rx: -1.1, sx: 0.16, sy: h * 0.18, sz: 0.16, ...cloth }),
        part(UNIT.bevelBox, leather, { x: sg * 0.66, y: h * 0.42, z: 0.62, sx: 0.16, sy: 0.16, sz: 0.16, ...hide }),
        part(UNIT.bevelBox, chrome, { x: sg * 0.66, y: h * 0.46, z: 0.78, sx: 0.11, sy: 0.15, sz: 0.3, ...shiny }),
        part(C, chrome, { x: sg * 0.66, y: h * 0.48, z: 1.12, rx: Math.PI / 2, sx: 0.07, sy: 0.5, sz: 0.07, ...shiny }),
        part(UNIT.lowCyl, chrome, { x: sg * 0.66, y: h * 0.46, z: 0.86, rx: Math.PI / 2, sx: 0.15, sy: 0.16, sz: 0.15, ...shiny }),
        ...Array.from({ length: 6 }, (_, i) => part(C, 0x1a1a20, {
          x: sg * 0.66 + Math.cos(i * 1.047) * 0.05, y: h * 0.46 + Math.sin(i * 1.047) * 0.05, z: 0.86,
          rx: Math.PI / 2, sx: 0.03, sy: 0.17, sz: 0.03,
        })),
        part(UNIT.slab, 0x6a4a2a, { x: sg * 0.66, y: h * 0.4, z: 0.68, rx: 0.4, sx: 0.09, sy: 0.16, sz: 0.1, ...hide }),
        emit(UNIT.lowSphere, b.eye, { x: sg * 0.66, y: h * 0.48, z: 1.38, sx: 0.08, sy: 0.08, sz: 0.06 }),
      ]),
      // Legs, chaps, boots and spurs that actually turn.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.capsule, b.body, { x: sg * 0.28, y: h * 0.2, sx: 0.27, sy: h * 0.16, sz: 0.27, ...cloth }),
        part(UNIT.slab, leather, { x: sg * 0.33, y: h * 0.2, sx: 0.1, sy: h * 0.3, sz: 0.36, ...hide }),
        ...Array.from({ length: 5 }, (_, i) => part(C, 0x6a4a2a, {
          x: sg * 0.37, y: h * (0.32 - i * 0.06), rz: Math.PI / 2, sx: 0.06, sy: 0.1, sz: 0.06, ...hide,
        })),
        part(UNIT.bevelBox, 0x3a2a20, { x: sg * 0.28, y: h * 0.05, z: 0.1, sx: 0.32, sy: 0.2, sz: 0.54, ...hide }),
        part(UNIT.slab, 0x1a1410, { x: sg * 0.28, y: h * 0.0, z: 0.1, sx: 0.34, sy: 0.05, sz: 0.56, rough: 0.95 }),
        part(UNIT.ring, chrome, { x: sg * 0.28, y: h * 0.07, z: -0.2, rx: Math.PI / 2, ry: Math.PI / 2, sx: 0.24, sy: 0.24, sz: 0.24, ...shiny }),
        ...Array.from({ length: 6 }, (_, i) => part(UNIT.cone, chrome, {
          x: sg * 0.28, y: h * 0.07 + Math.sin(i * 1.047) * 0.11, z: -0.2 + Math.cos(i * 1.047) * 0.11,
          rx: -1.57, rz: i * 1.047, sx: 0.05, sy: 0.09, sz: 0.05, ...shiny,
        })),
      ]),
    ];
  },

  gorbus(b, h) {
    // An apologetic mass of slime that has been swallowing the Alpha Wing for
    // years and is embarrassed about it. Everything he has taken is still
    // suspended inside him, drifting, perfectly preserved.
    const jelly = { metal: 0.1, rough: 0.12, smooth: true };
    const swallowed = { metal: 0.4, rough: 0.6 };
    return [
      // Layered body — a stack of settling lobes, not one sphere.
      part(UNIT.lowSphere, shadeHex(b.body, 1.25), { y: h * 0.18, sx: 2.75, sy: 0.6, sz: 2.35, opacity: 0.82, ...jelly }),
      part(UNIT.lowSphere, b.body, { y: h * 0.42, sx: 2.5, sy: h * 0.5, sz: 2.15, opacity: 0.86, ...jelly }),
      part(UNIT.lowSphere, b.body, { y: h * 0.66, z: 0.06, sx: 1.95, sy: 0.95, sz: 1.75, opacity: 0.86, ...jelly }),
      part(UNIT.lowSphere, b.body, { y: h * 0.82, z: 0.1, sx: 1.5, sy: 1.15, sz: 1.35, opacity: 0.86, ...jelly }),
      // Surface tension: a bright meniscus where each lobe meets the next.
      ...[0.3, 0.55, 0.75].map((t, i) => part(UNIT.pipe, shadeHex(b.body, 1.5), {
        y: h * t, sx: 2.5 - i * 0.5, sy: 0.1, sz: 2.15 - i * 0.42, opacity: 0.5, ...jelly,
      })),
      // Things he has collected, suspended and slowly rotating.
      part(UNIT.bevelBox, 0x8a6a48, { x: -0.5, y: h * 0.36, z: 0.2, ry: 0.4, rz: 0.2, sx: 1.1, sy: 0.1, sz: 0.42, ...swallowed }),
      part(UNIT.bevelBox, 0x8a6a48, { x: -0.5, y: h * 0.54, z: 0.2, ry: 0.4, rz: -0.15, sx: 1.1, sy: 0.1, sz: 0.42, ...swallowed }),
      ...[0, 1, 2, 3].map((i) => part(C, 0x6a5238, {
        x: -0.5 + (i % 2 ? 0.44 : -0.44), y: h * 0.44, z: 0.2 + (i < 2 ? 0.16 : -0.16),
        sx: 0.08, sy: 0.36, sz: 0.08, ...swallowed,
      })),
      part(UNIT.lowSphere, 0xe8e2d4, { x: 0.62, y: h * 0.46, z: 0.3, sx: 0.36, sy: 0.4, sz: 0.36, ...swallowed }),
      part(UNIT.torus, 0xe8e2d4, { x: 0.86, y: h * 0.44, z: 0.3, rx: 0.6, sx: 0.3, sy: 0.3, sz: 0.3, ...swallowed }),
      part(UNIT.bevelBox, 0x3a4450, { x: 0.9, y: h * 0.68, z: -0.3, ry: 0.9, rx: 0.4, sx: 0.5, sy: 0.6, sz: 0.14, ...swallowed }),
      part(UNIT.slab, 0xd8d4c8, { x: -0.9, y: h * 0.62, z: 0.4, ry: -0.5, rz: 0.4, sx: 0.34, sy: 0.44, sz: 0.02, ...swallowed }),
      part(UNIT.hex, 0xc9a227, { x: 0.2, y: h * 0.24, z: -0.5, rx: 1.2, sx: 0.26, sy: 0.08, sz: 0.26, metal: 1, rough: 0.3 }),
      // A whole chair, sideways, near the bottom.
      part(UNIT.slab, 0x6a5238, { x: -0.2, y: h * 0.22, z: 0.6, rz: 1.4, sx: 0.6, sy: 0.06, sz: 0.6, ...swallowed }),
      part(UNIT.slab, 0x6a5238, { x: -0.5, y: h * 0.22, z: 0.6, rz: 1.4, sx: 0.6, sy: 0.06, sz: 0.6, ...swallowed }),
      // Face: two big eyes, a smaller worried third, a mouth that apologises.
      ...[1, -1].flatMap((sg) => [
        emit(UNIT.lowSphere, b.eye, { x: sg * 0.42, y: h * 0.88, z: 0.62, sx: 0.4, sy: 0.4, sz: 0.26 }),
        part(UNIT.lowSphere, 0x102a14, { x: sg * 0.42, y: h * 0.87, z: 0.72, sx: 0.18, sy: 0.2, sz: 0.1 }),
        emit(UNIT.lowSphere, 0xffffff, { x: sg * 0.48, y: h * 0.93, z: 0.75, sx: 0.09, sy: 0.09, sz: 0.05 }),
      ]),
      emit(UNIT.lowSphere, b.eye, { y: h * 1.0, z: 0.58, sx: 0.22, sy: 0.22, sz: 0.16 }),
      part(UNIT.lowSphere, 0x102a14, { y: h * 1.0, z: 0.66, sx: 0.1, sy: 0.11, sz: 0.06 }),
      part(UNIT.slab, 0x1a3a1e, { y: h * 0.7, z: 0.68, rz: 0.06, sx: 0.5, sy: 0.09, sz: 0.05 }),
      part(UNIT.slab, 0x1a3a1e, { x: 0.22, y: h * 0.73, z: 0.66, rz: -0.5, sx: 0.16, sy: 0.07, sz: 0.05 }),
      // Nodules glowing through the body, brighter deeper in.
      ...Array.from({ length: 14 }, (_, i) => emit(UNIT.icosa, b.accent, {
        x: Math.cos(i * 0.9) * (1.25 - (i % 3) * 0.3), y: h * (0.22 + (i % 5) * 0.14),
        z: Math.sin(i * 0.9) * (1.05 - (i % 3) * 0.25),
        sx: 0.26 + (i % 3) * 0.08, sy: 0.26 + (i % 3) * 0.08, sz: 0.26 + (i % 3) * 0.08,
        opacity: 0.85,
      })),
      // Drooping arms that end in blunt paddles.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.capsule, b.body, { x: sg * 1.62, y: h * 0.5, rz: sg * 0.5, sx: 0.46, sy: h * 0.26, sz: 0.46, opacity: 0.88, ...jelly }),
        part(UNIT.capsule, b.body, { x: sg * 1.86, y: h * 0.26, rz: sg * 0.2, sx: 0.42, sy: h * 0.22, sz: 0.42, opacity: 0.88, ...jelly }),
        part(UNIT.lowSphere, b.body, { x: sg * 1.92, y: h * 0.1, z: 0.1, sx: 0.66, sy: 0.42, sz: 0.72, opacity: 0.88, ...jelly }),
        ...[0, 1, 2].map((i) => part(UNIT.capsule, b.body, {
          x: sg * (1.86 + (i - 1) * 0.22), y: h * 0.04, z: 0.4, rx: 1.3,
          sx: 0.16, sy: 0.3, sz: 0.16, opacity: 0.85, ...jelly,
        })),
      ]),
      // Dripping base, and a puddle spreading under him.
      ...Array.from({ length: 9 }, (_, i) => part(UNIT.cone, b.body, {
        x: Math.cos(i * 0.7) * (0.9 + (i % 3) * 0.35), y: h * (0.06 - (i % 2) * 0.02),
        z: Math.sin(i * 0.7) * (0.8 + (i % 3) * 0.3),
        rx: Math.PI, sx: 0.26, sy: 0.34 + (i % 3) * 0.14, sz: 0.26, opacity: 0.82, ...jelly,
      })),
      part(UNIT.lowCyl, b.body, { y: 0.03, sx: 3.4, sy: 0.06, sz: 3.0, opacity: 0.35, ...jelly }),
    ];
  },

  synargwynak(b, h, alt) {
    // Two aliens who tag each other in and have never once been seen together.
    // `alt` is the other one — the fight swaps the mesh mid-round, so they need
    // to read as siblings without reading as the same model recoloured.
    const skin = alt ? shadeHex(b.body, 0.62) : b.body;
    const acc = alt ? b.eye : b.accent;
    const wet = { metal: 0.12, rough: 0.3, smooth: true };
    const suit = { metal: 0.55, rough: 0.4 };
    return [
      // Elongated cranium — one crested, one smooth and bulbous.
      part(UNIT.lowSphere, skin, { y: h * 1.02, sx: 0.86, sy: alt ? 1.15 : 0.95, sz: alt ? 0.9 : 1.05, ...wet }),
      ...(alt
        ? [part(UNIT.wedge, skin, { y: h * 1.32, z: -0.1, rz: Math.PI / 2, sx: 0.6, sy: 0.16, sz: 0.7, ...wet })]
        : [part(UNIT.cone, acc, { y: h * 1.42, z: -0.06, rx: -0.2, sx: 0.28, sy: 0.9, sz: 0.28, ...wet })]),
      // Big lidded eyes with a highlight and a nictating membrane.
      ...[1, -1].flatMap((sg) => [
        emit(UNIT.lowSphere, b.eye, { x: sg * 0.26, y: h * 1.04, z: 0.34, sx: 0.42, sy: 0.56, sz: 0.3 }),
        part(UNIT.lowSphere, shadeHex(skin, 0.7), { x: sg * 0.26, y: h * 1.16, z: 0.3, sx: 0.46, sy: 0.3, sz: 0.3, ...wet }),
        emit(UNIT.lowSphere, 0xffffff, { x: sg * 0.32, y: h * 1.1, z: 0.44, sx: 0.12, sy: 0.14, sz: 0.06 }),
      ]),
      part(B, shadeHex(skin, 0.55), { y: h * 0.9, z: 0.4, sx: 0.28, sy: 0.03, sz: 0.03 }),
      // Slender neck, ribbed.
      ...[0, 1, 2].map((i) => part(UNIT.ring, shadeHex(skin, 0.8), {
        y: h * (0.8 + i * 0.04), sx: 0.3, sy: 0.3, sz: 0.3, ...wet,
      })),
      // Torso in a pressure suit with a chest unit and hose runs.
      part(UNIT.capsule, skin, { y: h * 0.58, sx: 0.62, sy: h * 0.3, sz: 0.5, ...wet }),
      part(UNIT.bevelBox, shadeHex(skin, 0.5), { y: h * 0.6, z: 0.02, sx: 0.72, sy: h * 0.24, sz: 0.5, ...suit }),
      part(UNIT.slab, acc, { y: h * 0.66, z: 0.26, sx: 0.42, sy: 0.3, sz: 0.05, ...suit }),
      emit(UNIT.disc, acc, { y: h * 0.66, z: 0.3, rx: Math.PI / 2, sx: 0.22, sy: 0.02, sz: 0.22 }),
      ...[1, -1].map((sg) => part(UNIT.torus, shadeHex(skin, 0.4), {
        x: sg * 0.34, y: h * 0.62, rx: Math.PI / 2, ry: sg * 0.5, sx: 0.5, sy: 0.5, sz: 0.5, ...suit,
      })),
      // Shoulder yoke and a rank flash — they are here officially.
      part(UNIT.bevelBox, shadeHex(skin, 0.45), { y: h * 0.76, sx: 1.0, sy: 0.16, sz: 0.44, ...suit }),
      ...[0, 1, 2].map((i) => emit(B, acc, {
        x: 0.4, y: h * (0.72 - i * 0.04), z: 0.24, sx: 0.14, sy: 0.02, sz: 0.02,
      })),
      // Four arms: two long, two short and folded — the giveaway silhouette.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.capsule, skin, { x: sg * 0.52, y: h * 0.56, rz: sg * 0.2, sx: 0.18, sy: h * 0.3, sz: 0.18, ...wet }),
        part(UNIT.capsule, skin, { x: sg * 0.64, y: h * 0.24, rz: sg * 0.1, sx: 0.15, sy: h * 0.26, sz: 0.15, ...wet }),
        ...[0, 1, 2].map((i) => part(UNIT.capsule, shadeHex(skin, 1.2), {
          x: sg * (0.6 + i * 0.11), y: h * 0.06, z: 0.06, rz: sg * 0.2,
          sx: 0.07, sy: 0.34 - i * 0.05, sz: 0.07, ...wet,
        })),
        // The folded second pair, tucked against the ribs.
        part(UNIT.capsule, skin, { x: sg * 0.42, y: h * 0.44, z: 0.2, rz: sg * 1.0, sx: 0.12, sy: h * 0.18, sz: 0.12, ...wet }),
        part(UNIT.capsule, skin, { x: sg * 0.3, y: h * 0.56, z: 0.3, rz: sg * -0.6, sx: 0.1, sy: h * 0.14, sz: 0.1, ...wet }),
      ]),
      // Legs: digitigrade, with a heavy boot.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.capsule, skin, { x: sg * 0.24, y: h * 0.3, rx: 0.2, sx: 0.2, sy: h * 0.22, sz: 0.2, ...wet }),
        part(UNIT.capsule, skin, { x: sg * 0.24, y: h * 0.12, z: -0.06, rx: -0.3, sx: 0.16, sy: h * 0.2, sz: 0.16, ...wet }),
        part(UNIT.bevelBox, shadeHex(skin, 0.5), { x: sg * 0.24, y: 0.07, z: 0.14, sx: 0.26, sy: 0.16, sz: 0.5, ...suit }),
      ]),
      // A field device the other one is never holding.
      ...(alt ? [
        part(UNIT.bevelBox, shadeHex(skin, 0.4), { x: 0.78, y: h * 0.1, z: 0.24, sx: 0.22, sy: 0.3, sz: 0.34, ...suit }),
        emit(B, acc, { x: 0.78, y: h * 0.18, z: 0.42, sx: 0.14, sy: 0.06, sz: 0.02 }),
      ] : [
        part(UNIT.cyl, shadeHex(skin, 0.4), { x: -0.8, y: h * 0.12, z: 0.3, rx: 1.2, sx: 0.12, sy: 0.9, sz: 0.12, ...suit }),
        emit(UNIT.lowSphere, acc, { x: -0.84, y: h * 0.42, z: 0.62, sx: 0.2, sy: 0.2, sz: 0.2 }),
      ]),
    ];
  },

  gelatinfingers(b, h) {
    // A tall man in a good suit that never finished setting. He is translucent
    // from the collar up and the fingers are the horror: twenty of them, each
    // longer than his forearm, drooping to the floor and pooling there.
    const suitDark = 0x2a1a20, shirt = 0xe8dce4;
    const gel = { metal: 0.06, rough: 0.14, smooth: true };
    const wool = { metal: 0.0, rough: 0.88 };
    return [
      // The suit: shoulders, lapels, a waistcoat, a pocket square.
      part(UNIT.bevelBox, suitDark, { y: h * 0.5, sx: 1.08, sy: h * 0.5, sz: 0.6, ...wool }),
      part(UNIT.bevelBox, b.body, { y: h * 0.5, sx: 1.14, sy: h * 0.5, sz: 0.64, opacity: 0.58, ...gel }),
      part(UNIT.bevelBox, suitDark, { y: h * 0.74, sx: 1.5, sy: 0.24, sz: 0.62, ...wool }),
      ...[1, -1].map((sg) => part(UNIT.wedge, 0x1a1016, {
        x: sg * 0.26, y: h * 0.62, z: 0.3, rz: sg > 0 ? 0.2 : -0.2, ry: sg > 0 ? 0 : Math.PI,
        sx: 0.3, sy: h * 0.3, sz: 0.08, ...wool,
      })),
      part(UNIT.slab, shirt, { y: h * 0.62, z: 0.31, sx: 0.2, sy: h * 0.24, sz: 0.04, ...wool }),
      part(UNIT.slab, 0x6a1a2a, { x: 0.34, y: h * 0.7, z: 0.32, rz: 0.3, sx: 0.14, sy: 0.1, sz: 0.03, ...wool }),
      ...[0, 1, 2].map((i) => part(UNIT.hex, 0x1a1016, {
        y: h * (0.54 - i * 0.09), z: 0.33, rx: Math.PI / 2, sx: 0.06, sy: 0.03, sz: 0.06, ...wool,
      })),
      // A tie that has begun to run down the shirt.
      part(UNIT.slab, 0x4a1020, { y: h * 0.66, z: 0.33, sx: 0.09, sy: h * 0.18, sz: 0.03, ...wool }),
      part(UNIT.cone, 0x4a1020, { y: h * 0.5, z: 0.33, rx: Math.PI, sx: 0.08, sy: 0.14, sz: 0.03, ...gel }),
      // Head: half-melted, sliding off to one side, features drifting.
      part(UNIT.lowSphere, b.body, { y: h * 0.87, x: 0.04, sx: 0.78, sy: 0.84, sz: 0.76, opacity: 0.66, ...gel }),
      part(UNIT.lowSphere, b.body, { y: h * 0.72, z: 0.1, sx: 0.66, sy: 0.55, sz: 0.55, opacity: 0.66, ...gel }),
      part(UNIT.cone, b.body, { x: -0.24, y: h * 0.66, z: 0.02, rx: Math.PI, sx: 0.22, sy: 0.4, sz: 0.22, opacity: 0.62, ...gel }),
      part(UNIT.lowSphere, b.body, { y: h * 1.0, x: 0.1, sx: 0.5, sy: 0.3, sz: 0.48, opacity: 0.6, ...gel }),
      emit(UNIT.lowSphere, b.eye, { x: 0.18, y: h * 0.9, z: 0.32, sx: 0.2, sy: 0.24, sz: 0.13 }),
      emit(UNIT.lowSphere, b.eye, { x: -0.2, y: h * 0.83, z: 0.32, sx: 0.17, sy: 0.2, sz: 0.13 }),
      part(UNIT.lowSphere, 0x1a0a10, { x: 0.18, y: h * 0.89, z: 0.4, sx: 0.09, sy: 0.11, sz: 0.05 }),
      part(UNIT.lowSphere, 0x1a0a10, { x: -0.2, y: h * 0.82, z: 0.4, sx: 0.08, sy: 0.1, sz: 0.05 }),
      part(UNIT.slab, 0x2a1420, { y: h * 0.72, z: 0.36, rz: 0.16, sx: 0.32, sy: 0.06, sz: 0.04 }),
      // A collar and a hat brim he is still, technically, wearing.
      part(UNIT.pipe, shirt, { y: h * 0.78, sx: 0.6, sy: 0.12, sz: 0.6, ...wool }),
      part(UNIT.lowCyl, 0x1a1016, { y: h * 1.12, x: 0.1, sx: 1.5, sy: 0.06, sz: 1.4, ...wool }),
      part(UNIT.lowCyl, 0x1a1016, { y: h * 1.2, x: 0.1, sx: 0.66, sy: 0.3, sz: 0.66, ...wool }),
      // The fingers. Ten a side, jointed, drooping, pooling on the floor.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.capsule, b.body, { x: sg * 0.72, y: h * 0.56, rz: sg * 0.16, sx: 0.28, sy: h * 0.2, sz: 0.28, opacity: 0.66, ...gel }),
        part(UNIT.lowSphere, b.body, { x: sg * 0.78, y: h * 0.38, sx: 0.3, sy: 0.28, sz: 0.3, opacity: 0.66, ...gel }),
        part(UNIT.capsule, b.body, { x: sg * 0.82, y: h * 0.26, rz: sg * 0.08, sx: 0.24, sy: h * 0.16, sz: 0.24, opacity: 0.66, ...gel }),
        part(UNIT.lowSphere, b.body, { x: sg * 0.84, y: h * 0.14, sx: 0.34, sy: 0.24, sz: 0.34, opacity: 0.68, ...gel }),
        ...Array.from({ length: 5 }, (_, i) => [
          part(C, b.accent, {
            x: sg * (0.72 + i * 0.11), y: h * (0.1 - i * 0.008), z: 0.06 + i * 0.11,
            rx: 0.5 + i * 0.06, rz: sg * (0.08 + i * 0.03),
            sx: 0.1, sy: h * (0.26 - i * 0.02), sz: 0.1, opacity: 0.8, ...gel,
          }),
          part(C, b.accent, {
            x: sg * (0.74 + i * 0.12), y: h * 0.02, z: 0.34 + i * 0.13,
            rx: 1.35, rz: sg * (0.1 + i * 0.04),
            sx: 0.09, sy: h * (0.24 - i * 0.02), sz: 0.09, opacity: 0.8, ...gel,
          }),
          part(UNIT.lowSphere, b.accent, {
            x: sg * (0.76 + i * 0.13), y: 0.05, z: 0.62 + i * 0.14,
            sx: 0.16, sy: 0.07, sz: 0.16, opacity: 0.7, ...gel,
          }),
        ]).flat(),
      ]),
      // Legs and the puddle he is standing in.
      ...[1, -1].map((sg) => part(UNIT.capsule, suitDark, {
        x: sg * 0.3, y: h * 0.18, sx: 0.34, sy: h * 0.22, sz: 0.34, ...wool,
      })),
      ...[1, -1].map((sg) => part(UNIT.bevelBox, 0x14090e, {
        x: sg * 0.3, y: 0.08, z: 0.12, sx: 0.36, sy: 0.16, sz: 0.6, metal: 0.4, rough: 0.35,
      })),
      ...Array.from({ length: 6 }, (_, i) => part(UNIT.cone, b.accent, {
        x: (i - 2.5) * 0.3, y: h * 0.06, z: (i % 2) * 0.24 - 0.12,
        rx: Math.PI, sx: 0.17, sy: 0.3 + (i % 3) * 0.12, sz: 0.17, opacity: 0.78, ...gel,
      })),
      part(UNIT.lowCyl, b.accent, { y: 0.02, sx: 2.6, sy: 0.04, sz: 2.2, opacity: 0.3, ...gel }),
    ];
  },

  doppelganger(b, h) {
    // You, rendered by something that has only ever seen you from the outside.
    // Chrome where the reference was good, unfinished wireframe where it
    // wasn't, and a face that is a blank plate because it has never seen one.
    const chrome = { metal: 1.0, rough: 0.08 };
    const matte = { metal: 0.2, rough: 0.7 };
    const wire = (x, y, z, sx, sy, sz) => emit(B, 0x8fd4ff, { x, y, z, sx, sy, sz, opacity: 0.45 });
    const wireBox = (cx, cy, cz, hx, hy, hz, t = 0.024) => {
      const out = [];
      for (const sy of [1, -1]) for (const sz of [1, -1]) out.push(wire(cx, cy + sy * hy, cz + sz * hz, hx * 2, t, t));
      for (const sx of [1, -1]) for (const sz of [1, -1]) out.push(wire(cx + sx * hx, cy, cz + sz * hz, t, hy * 2, t));
      for (const sx of [1, -1]) for (const sy of [1, -1]) out.push(wire(cx + sx * hx, cy + sy * hy, cz, t, t, hz * 2));
      return out;
    };
    return [
      // Torso: solid and mirrored on the left, wireframe on the right.
      part(UNIT.bevelBox, b.body, { y: h * 0.62, sx: 0.9, sy: h * 0.4, sz: 0.5, ...chrome }),
      part(UNIT.wedge, b.body, { y: h * 0.76, z: 0.18, rx: 0.16, sx: 0.86, sy: 0.3, sz: 0.34, ...chrome }),
      part(UNIT.bevelBox, b.accent, { y: h * 0.8, sx: 1.24, sy: 0.24, sz: 0.56, ...chrome }),
      ...wireBox(0.34, h * 0.62, 0, 0.28, h * 0.19, 0.26),
      // Panel seams and rivets down the chest — a fabricated copy, not a body.
      ...[0, 1, 2].map((i) => part(B, 0x8a97a6, {
        y: h * (0.5 + i * 0.12), z: 0.26, sx: 0.8, sy: 0.02, sz: 0.02, ...matte,
      })),
      ...[1, -1].map((sg) => part(UNIT.hex, 0xb6bcc6, {
        x: sg * 0.4, y: h * 0.72, z: 0.27, rx: Math.PI / 2, sx: 0.1, sy: 0.04, sz: 0.1, ...chrome,
      })),
      // Head: a helmet with a blank mirrored plate for a face.
      part(UNIT.lowSphere, b.head, { y: h * 0.98, sx: 0.56, sy: 0.62, sz: 0.56, smooth: true, ...chrome }),
      part(UNIT.slab, 0xf2f7fc, { y: h * 0.98, z: 0.25, sx: 0.46, sy: 0.5, sz: 0.06, metal: 1.0, rough: 0.02 }),
      part(B, 0x8a97a6, { y: h * 1.0, z: 0.29, rz: 0.4, sx: 0.4, sy: 0.02, sz: 0.01, ...matte }),
      // Two faint lights behind the plate, where eyes would be if it had any.
      emit(UNIT.lowSphere, b.eye, { x: 0.13, y: h * 1.0, z: 0.22, sx: 0.1, sy: 0.07, sz: 0.04, opacity: 0.7 }),
      emit(UNIT.lowSphere, b.eye, { x: -0.13, y: h * 1.0, z: 0.22, sx: 0.1, sy: 0.07, sz: 0.04, opacity: 0.7 }),
      // Neck stack.
      ...[0, 1, 2].map((i) => part(UNIT.ring, 0x8a97a6, {
        y: h * (0.84 + i * 0.03), sx: 0.34, sy: 0.34, sz: 0.34, ...chrome,
      })),
      // Arms: the left one finished, the right one still being drawn.
      part(UNIT.capsule, b.body, { x: 0.66, y: h * 0.66, rz: 0.12, sx: 0.24, sy: h * 0.24, sz: 0.24, ...chrome }),
      part(UNIT.lowSphere, b.accent, { x: 0.7, y: h * 0.52, sx: 0.28, sy: 0.28, sz: 0.28, smooth: true, ...chrome }),
      part(UNIT.capsule, b.body, { x: 0.74, y: h * 0.4, z: 0.16, rx: -0.5, sx: 0.2, sy: h * 0.22, sz: 0.2, ...chrome }),
      part(UNIT.bevelBox, b.head, { x: 0.76, y: h * 0.24, z: 0.34, sx: 0.24, sy: 0.24, sz: 0.2, ...chrome }),
      ...wireBox(-0.72, h * 0.58, 0.06, 0.14, h * 0.2, 0.14),
      ...wireBox(-0.78, h * 0.26, 0.3, 0.12, h * 0.14, 0.12),
      // The weapon it is holding is a copy of yours, and it is not finished.
      ...wireBox(0.8, h * 0.3, 0.7, 0.09, 0.09, 0.42),
      emit(UNIT.cyl, 0x8fd4ff, { x: 0.8, y: h * 0.3, z: 1.16, rx: Math.PI / 2, sx: 0.1, sy: 0.24, sz: 0.1, opacity: 0.5 }),
      // Legs.
      ...[1, -1].flatMap((sg) => [
        part(UNIT.capsule, b.body, { x: sg * 0.28, y: h * 0.3, sx: 0.26, sy: h * 0.24, sz: 0.26, ...chrome }),
        part(UNIT.lowSphere, b.accent, { x: sg * 0.28, y: h * 0.18, sx: 0.28, sy: 0.28, sz: 0.28, smooth: true, ...chrome }),
        part(UNIT.capsule, b.body, { x: sg * 0.28, y: h * 0.08, sx: 0.22, sy: h * 0.2, sz: 0.22, ...chrome }),
        part(UNIT.bevelBox, b.head, { x: sg * 0.28, y: 0.06, z: 0.12, sx: 0.3, sy: 0.14, sz: 0.56, ...chrome }),
      ]),
      // The seam where the copy was stitched together, running head to floor.
      emit(B, 0x8fd4ff, { x: 0.02, y: h * 0.55, z: 0.28, sx: 0.02, sy: h * 0.9, sz: 0.02, opacity: 0.35 }),
    ];
  },

  motherboard(b, h) {
    const chips = [];
    for (let i = 0; i < 14; i++) {
      const cx = -2.0 + (i % 7) * 0.66;
      const cy = h * (0.28 + Math.floor(i / 7) * 0.3);
      chips.push(part(B, 0x0d1424, { x: cx, y: cy, z: 0.42, sx: 0.46, sy: 0.3, sz: 0.09 }));
      chips.push(emit(B, b.accent, { x: cx, y: cy, z: 0.48, sx: 0.34, sy: 0.16, sz: 0.02, opacity: 0.9 }));
    }
    const traces = [];
    for (let i = 0; i < 16; i++) {
      traces.push(emit(B, b.eye, {
        x: -2.2 + i * 0.3, y: h * 0.55, z: 0.38,
        sx: 0.035, sy: h * (0.3 + (i % 3) * 0.2), sz: 0.02, opacity: 0.55,
      }));
    }
    return [
      part(B, b.body, { y: h * 0.5, sx: 4.8, sy: h * 0.94, sz: 0.75 }),
      part(B, shadeHex(b.body, 1.4), { y: h * 0.5, z: 0.36, sx: 4.5, sy: h * 0.88, sz: 0.06 }),
      ...traces, ...chips,
      // heat sinks along the top
      ...Array.from({ length: 12 }, (_, i) => part(B, 0x5a6480, {
        x: -2.2 + i * 0.4, y: h * 0.94, z: 0.1, sx: 0.14, sy: 0.55, sz: 0.6,
      })),
      // capacitor bank
      ...Array.from({ length: 5 }, (_, i) => part(C, 0x2a3350, {
        x: -1.6 + i * 0.8, y: h * 0.14, z: 0.4, sx: 0.34, sy: 0.5, sz: 0.34,
      })),
      // the eye that does the counting
      part(C, 0x0d1424, { y: h * 0.55, z: 0.42, rx: Math.PI / 2, sx: 1.5, sy: 0.3, sz: 1.5 }),
      emit(UNIT.torus, b.eye, { y: h * 0.55, z: 0.56, sx: 1.5, sy: 1.5, sz: 1.5 }),
      emit(S, b.eye, { y: h * 0.55, z: 0.6, sx: 0.8, sy: 0.8, sz: 0.4 }),
      // cable bundles running off into the floor
      ...Array.from({ length: 6 }, (_, i) => part(C, 0x161c2e, {
        x: -2.4 + i * 0.95, y: h * 0.2, z: -0.5, rx: 0.3, sx: 0.2, sy: h * 0.8, sz: 0.2,
      })),
      part(C, b.body, { x: 2.7, y: h * 0.45, sx: 0.55, sy: h * 0.9, sz: 0.55 }),
      part(C, b.body, { x: -2.7, y: h * 0.45, sx: 0.55, sy: h * 0.9, sz: 0.55 }),
    ];
  },

  kimvatch(b, h) {
    return [
      // a dark core with a person's shape barely suggested inside it
      part(OC, b.body, { y: h * 0.55, sx: 2.8, sy: 3.0, sz: 2.8, opacity: 0.72 }),
      emit(UNIT.icosa, b.eye, { y: h * 0.55, sx: 1.9, sy: 1.9, sz: 1.9, opacity: 0.18 }),
      // the doctor, or the shape the process kept
      part(B, 0x05050a, { y: h * 0.52, sx: 0.6, sy: 1.7, sz: 0.45 }),
      part(B, 0x05050a, { x: 0.48, y: h * 0.55, rz: 0.2, sx: 0.18, sy: 1.2, sz: 0.18 }),
      part(B, 0x05050a, { x: -0.48, y: h * 0.55, rz: -0.2, sx: 0.18, sy: 1.2, sz: 0.18 }),
      part(S, 0x05050a, { y: h * 0.8, sx: 0.55, sy: 0.6, sz: 0.55 }),
      emit(B, b.accent, { y: h * 0.78, z: 0.24, sx: 0.34, sy: 0.05, sz: 0.02 }),
      emit(S, b.accent, { y: h * 0.55, sx: 0.5, sy: 0.5, sz: 0.5 }),
      // data spokes
      ...Array.from({ length: 14 }, (_, i) => {
        const a = i * 0.449;
        return emit(B, b.eye, {
          x: Math.cos(a) * 2.3, y: h * (0.26 + (i % 5) * 0.14), z: Math.sin(a) * 2.3,
          ry: -a, sx: 0.9, sy: 0.05, sz: 0.05, opacity: 0.75,
        });
      }),
      // shards in orbit
      ...Array.from({ length: 8 }, (_, i) => {
        const a = i * 0.785;
        return part(UNIT.tetra, shadeHex(b.body, 3.2), {
          x: Math.cos(a) * 3.0, y: h * (0.4 + (i % 3) * 0.22), z: Math.sin(a) * 3.0,
          rx: a, ry: a * 1.3, sx: 0.6, sy: 0.6, sz: 0.6,
        });
      }),
      // Rings stay translucent so the shape of a man is still visible inside.
      emit(UNIT.torus, b.eye, { y: h * 0.55, rx: Math.PI / 2, sx: 4.2, sy: 4.2, sz: 4.2, opacity: 0.42 }),
      emit(UNIT.torus, b.accent, { y: h * 0.55, rx: 0.5, sx: 3.6, sy: 3.6, sz: 3.6, opacity: 0.3 }),
      emit(UNIT.torus, b.eye, { y: h * 0.55, rz: 0.8, sx: 3.2, sy: 3.2, sz: 3.2, opacity: 0.26 }),
    ];
  },
};

export function buildBossMesh(def, alt = false) {
  const b = alt && def.buildB ? def.buildB : def.build;
  const g = new THREE.Group();
  const builder = BOSS_BUILDERS[def.id] || BOSS_BUILDERS.crookking;
  const parts = builder(b, def.height, alt);
  const mesh = assemble(parts);
  g.add(mesh);

  // Bosses cast a contact shadow too — it sells their weight.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(def.radius * 1.5, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.36, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  shadow.renderOrder = -1;
  g.add(shadow);

  g.userData.upper = mesh;
  g.userData.headY = def.height * 0.85;
  return g;
}

// ---------------------------------------------------------------------------
// Props: chest, nodes, pickups, lift
// ---------------------------------------------------------------------------

export function buildChest() {
  const g = new THREE.Group();
  const base = assemble([
    part(B, 0x3a3f4a, { y: 0.42, sx: 1.5, sy: 0.84, sz: 1.0 }),
    part(B, 0x2a2e36, { y: 0.06, sx: 1.62, sy: 0.12, sz: 1.12 }),
    part(B, 0x5a6270, { y: 0.44, z: 0.51, sx: 1.3, sy: 0.5, sz: 0.06 }),
    emit(B, 0x6fd8ff, { y: 0.44, z: 0.53, sx: 0.22, sy: 0.22, sz: 0.04 }),
    emit(B, 0x6fd8ff, { x: 0.72, y: 0.44, sx: 0.04, sy: 0.4, sz: 0.6 }),
    emit(B, 0x6fd8ff, { x: -0.72, y: 0.44, sx: 0.04, sy: 0.4, sz: 0.6 }),
  ]);
  const lid = assemble([
    part(B, 0x4a5260, { y: 0.1, sx: 1.55, sy: 0.24, sz: 1.05 }),
    part(B, 0x6a7484, { y: 0.24, sx: 1.3, sy: 0.08, sz: 0.9 }),
    emit(B, 0x6fd8ff, { y: 0.29, sx: 0.9, sy: 0.03, sz: 0.5 }),
  ]);
  lid.position.y = 0.86;
  g.add(base, lid);
  g.userData.lid = lid;

  // Beam of light that rises out of an opened chest.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.32, 4.2, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 2.4;
  g.add(beam);
  g.userData.beam = beam;
  return g;
}

export function buildNode(color = 0x6fd8ff) {
  const g = new THREE.Group();
  const body = assemble([
    part(C, 0x2f3540, { y: 0.12, sx: 1.5, sy: 0.24, sz: 1.5 }),
    part(B, 0x3d4553, { y: 0.9, sx: 0.7, sy: 1.5, sz: 0.5 }),
    part(B, 0x59657a, { y: 1.68, sx: 0.9, sy: 0.24, sz: 0.7 }),
  ]);
  // Cloned: these are disposed with the floor, and the cached primitives are shared.
  const core = new THREE.Mesh(
    UNIT.icosa.clone(),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  core.scale.setScalar(1.1);
  core.position.y = 1.05;
  const ring = new THREE.Mesh(
    UNIT.torus.clone(),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }),
  );
  ring.scale.setScalar(2.2);
  ring.position.y = 1.05;
  ring.rotation.x = Math.PI / 2;
  g.add(body, core, ring);
  g.userData.core = core;
  g.userData.ring = ring;
  return g;
}

export function buildLift(color = 0x6fd8ff) {
  const g = new THREE.Group();
  const body = assemble([
    part(C, 0x2a2f38, { y: 0.1, sx: 6, sy: 0.2, sz: 6 }),
    part(C, 0x3d4553, { y: 0.24, sx: 5.4, sy: 0.12, sz: 5.4 }),
    ...[0, 1, 2, 3].map((i) => part(B, 0x3d4553, {
      x: Math.cos(i * 1.5708) * 2.5, y: 1.8, z: Math.sin(i * 1.5708) * 2.5,
      sx: 0.3, sy: 3.6, sz: 0.3,
    })),
    part(C, 0x2a2f38, { y: 3.7, sx: 6, sy: 0.24, sz: 6 }),
  ]);
  // Back faces only: seen from outside it reads as a column of light, and from
  // inside — where the player stands to ride it — it doesn't wash the screen.
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.5, 3.5, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.1, side: THREE.BackSide, depthWrite: false,
    }),
  );
  glow.position.y = 1.9;
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.32;
  g.add(body, glow, pad);
  g.userData.glow = glow;
  g.userData.pad = pad;
  return g;
}

export function buildPickup(kind, color) {
  const g = new THREE.Group();
  let mesh;
  if (kind === 'sandwich') {
    mesh = assemble([
      part(B, 0xd9a441, { y: 0, sx: 0.44, sy: 0.1, sz: 0.44 }),
      part(B, 0x7ac74f, { y: 0.08, sx: 0.46, sy: 0.05, sz: 0.46 }),
      part(B, 0xc4553a, { y: 0.14, sx: 0.44, sy: 0.06, sz: 0.44 }),
      part(B, 0xe8b95c, { y: 0.22, sx: 0.44, sy: 0.1, sz: 0.44 }),
    ]);
  } else if (kind === 'health') {
    mesh = assemble([
      emit(B, 0x4affa0, { sx: 0.4, sy: 0.13, sz: 0.13 }),
      emit(B, 0x4affa0, { sx: 0.13, sy: 0.4, sz: 0.13 }),
    ]);
  } else if (kind === 'ammo') {
    mesh = assemble([
      part(B, 0x8a7a40, { sx: 0.36, sy: 0.24, sz: 0.24 }),
      emit(B, 0xffd24a, { y: 0.14, sx: 0.28, sy: 0.04, sz: 0.16 }),
    ]);
  } else if (kind === 'key') {
    mesh = assemble([
      emit(UNIT.torus, color || 0xffd24a, { sx: 0.5, sy: 0.5, sz: 0.5 }),
      emit(B, color || 0xffd24a, { y: -0.3, sx: 0.1, sy: 0.4, sz: 0.1 }),
    ]);
  } else {
    mesh = assemble([emit(IC, color || 0x6fd8ff, { sx: 0.4, sy: 0.4, sz: 0.4 })]);
  }
  g.add(mesh);
  return g;
}

// ---------------------------------------------------------------------------
// Weapon viewmodels
// ---------------------------------------------------------------------------

export function buildWeaponModel(id, weapon) {
  return buildWeapon(id, weapon);
}

/** A shrunken, spinning copy used for the chest slot-machine reel. */
export function buildWeaponIcon(id, weapon) {
  const m = buildWeaponModel(id, weapon);
  m.scale.setScalar(1.0);
  return m;
}
