// Every mesh in the game is built from primitives here — there are no external
// art assets. Enemies are assembled as a small rig (upper body + two legs) so
// the animation code has something to swing.

import * as THREE from '../../vendor/three.module.js';
import { UNIT, assemble } from '../world/geometry.js';

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

/**
 * @returns {{upper:Array, legL:Array, legR:Array, pivot:number,
 *            headY:number, headR:number, flying?:boolean, wobble?:number}}
 */
const ENEMY_BUILDERS = {

  // -- undead ---------------------------------------------------------------

  shambler(b, h) {
    const legH = h * 0.44, torso = h * 0.34;
    const headY = legH + torso + 0.14;
    return {
      pivot: legH, headY, headR: 0.2,
      upper: [
        // hunched torso, one shoulder dropped
        part(B, b.body, { y: legH + torso * 0.5, rx: 0.2, sx: 0.6, sy: torso, sz: 0.34 }),
        part(B, b.body, { y: legH + torso * 0.94, rz: 0.13, sx: 0.82, sy: 0.19, sz: 0.4 }),
        // exposed ribs
        ...[0, 1, 2].map((i) => part(B, 0xb9c4a8, {
          y: legH + torso * (0.42 + i * 0.17), z: 0.16, rx: 0.2, sx: 0.44 - i * 0.05, sy: 0.05, sz: 0.06,
        })),
        // coat flaps
        part(B, shadeHex(b.body, 0.7), { x: 0.2, y: legH * 0.72, z: -0.04, rz: 0.16, sx: 0.28, sy: torso * 0.95, sz: 0.3 }),
        part(B, shadeHex(b.body, 0.7), { x: -0.24, y: legH * 0.66, z: -0.02, rz: -0.2, sx: 0.26, sy: torso * 0.8, sz: 0.28 }),
        // head, tilted, with a sunken jaw
        part(S, b.head, { y: headY, rz: 0.18, sx: 0.4, sy: 0.44, sz: 0.38 }),
        part(B, shadeHex(b.head, 0.72), { y: headY - 0.15, z: 0.1, rz: 0.18, sx: 0.24, sy: 0.12, sz: 0.2 }),
        emit(S, b.eye, { x: 0.11, y: headY + 0.03, z: 0.17, sx: 0.09, sy: 0.09, sz: 0.05 }),
        emit(S, b.eye, { x: -0.09, y: headY + 0.05, z: 0.17, sx: 0.07, sy: 0.07, sz: 0.05 }),
        // long dangling arms, uneven
        part(B, b.body, { x: 0.4, y: legH + torso * 0.5, z: 0.1, rx: -0.5, sx: 0.15, sy: torso * 1.15, sz: 0.15 }),
        part(B, b.head, { x: 0.46, y: legH + torso * 0.5 - torso * 0.6, z: 0.4, sx: 0.14, sy: 0.16, sz: 0.14 }),
        part(B, b.body, { x: -0.38, y: legH + torso * 0.56, z: 0.04, rx: -0.28, sx: 0.14, sy: torso * 1.0, sz: 0.14 }),
      ],
      legL: [part(B, b.body, { x: 0.16, y: -legH / 2, sx: 0.19, sy: legH, sz: 0.19 }),
        part(B, shadeHex(b.body, 0.6), { x: 0.16, y: -legH + 0.05, z: 0.05, sx: 0.2, sy: 0.11, sz: 0.3 })],
      legR: [part(B, b.body, { x: -0.16, y: -legH / 2, sx: 0.18, sy: legH, sz: 0.18 }),
        part(B, shadeHex(b.body, 0.6), { x: -0.16, y: -legH + 0.05, z: 0.05, sx: 0.19, sy: 0.11, sz: 0.29 })],
    };
  },

  sprinter(b, h) {
    const legH = h * 0.52, torso = h * 0.26;
    const headY = legH + torso * 0.9;
    return {
      pivot: legH, headY, headR: 0.17,
      upper: [
        // narrow torso thrown forward, ribs showing through torn cloth
        part(B, b.body, { y: legH + torso * 0.5, z: 0.16, rx: 0.62, sx: 0.36, sy: torso, sz: 0.22 }),
        ...[0, 1, 2].map((i) => part(B, 0xd8bfae, {
          y: legH + torso * (0.35 + i * 0.22), z: 0.26 + i * 0.09, rx: 0.62,
          sx: 0.3 - i * 0.04, sy: 0.04, sz: 0.05,
        })),
        // shoulders sit high and wide of the body
        part(B, b.body, { x: 0.22, y: legH + torso * 0.86, z: 0.3, sx: 0.2, sy: 0.14, sz: 0.16 }),
        part(B, b.body, { x: -0.22, y: legH + torso * 0.86, z: 0.3, sx: 0.2, sy: 0.14, sz: 0.16 }),
        // head clears the torso entirely — the giveaway silhouette
        part(S, b.head, { y: headY, z: 0.52, sx: 0.31, sy: 0.32, sz: 0.33 }),
        part(B, shadeHex(b.head, 0.45), { y: headY - 0.14, z: 0.62, rx: 0.4, sx: 0.19, sy: 0.17, sz: 0.14 }),
        emit(S, b.eye, { x: 0.09, y: headY + 0.04, z: 0.66, sx: 0.1, sy: 0.1, sz: 0.06 }),
        emit(S, b.eye, { x: -0.09, y: headY + 0.04, z: 0.66, sx: 0.1, sy: 0.1, sz: 0.06 }),
        ...[0, 1, 2, 3].map((i) => part(CN, shadeHex(b.head, 0.35), {
          x: (i - 1.5) * 0.11, y: headY + 0.19, z: 0.46, rx: -0.8, sx: 0.08, sy: 0.26, sz: 0.08,
        })),
        // arms flung wide and back — unmistakable from any angle
        ...[1, -1].flatMap((sgn) => [
          part(B, b.body, {
            x: sgn * 0.4, y: legH + torso * 0.66, z: -0.02,
            rz: sgn * 0.5, rx: -0.7, sx: 0.1, sy: torso * 0.9, sz: 0.1,
          }),
          part(B, b.body, {
            x: sgn * 0.56, y: legH + torso * 0.2, z: -0.34,
            rz: sgn * 0.3, rx: -0.4, sx: 0.09, sy: torso * 0.85, sz: 0.09,
          }),
          part(S, b.head, { x: sgn * 0.62, y: legH - torso * 0.12, z: -0.5, sx: 0.13, sy: 0.15, sz: 0.13 }),
        ]),
        // torn cloth trailing behind
        part(B, shadeHex(b.body, 0.6), { y: legH + torso * 0.2, z: -0.2, rx: -0.5, sx: 0.3, sy: 0.36, sz: 0.24 }),
      ],
      legL: [part(B, b.body, { x: 0.13, y: -legH * 0.34, z: 0.08, rx: 0.4, sx: 0.12, sy: legH * 0.62, sz: 0.12 }),
        part(B, b.body, { x: 0.13, y: -legH * 0.8, z: 0.02, rx: -0.25, sx: 0.11, sy: legH * 0.55, sz: 0.11 })],
      legR: [part(B, b.body, { x: -0.13, y: -legH * 0.34, z: -0.06, rx: -0.4, sx: 0.12, sy: legH * 0.62, sz: 0.12 }),
        part(B, b.body, { x: -0.13, y: -legH * 0.8, z: 0.02, rx: 0.25, sx: 0.11, sy: legH * 0.55, sz: 0.11 })],
    };
  },

  bloater(b, h) {
    const legH = h * 0.2;
    const headY = h * 0.92;
    return {
      pivot: legH, headY, headR: 0.24, wobble: 1,
      upper: [
        // the sac
        part(S, b.body, { y: h * 0.5, sx: 1.5, sy: 1.32, sz: 1.42 }),
        part(S, shadeHex(b.body, 1.25), { y: h * 0.42, z: 0.34, sx: 1.1, sy: 0.9, sz: 0.9 }),
        // glowing seams
        ...[0, 1, 2, 3].map((i) => emit(B, b.eye, {
          y: h * (0.32 + i * 0.13), z: 0.6 - i * 0.04, rz: 0.1 * (i % 2 ? 1 : -1),
          sx: 0.9 - i * 0.12, sy: 0.05, sz: 0.05, opacity: 0.9,
        })),
        // pustules
        ...[[0.5, 0.62, 0.4], [-0.55, 0.5, 0.3], [0.2, 0.78, -0.5], [-0.3, 0.35, -0.45]].map(([px, py, pz]) =>
          part(S, shadeHex(b.head, 1.1), { x: px, y: h * py, z: pz, sx: 0.3, sy: 0.28, sz: 0.3 })),
        // tiny head sunk into the mass
        part(S, b.head, { y: headY, sx: 0.4, sy: 0.36, sz: 0.4 }),
        emit(S, b.eye, { x: 0.12, y: headY + 0.02, z: 0.19, sx: 0.09, sy: 0.09, sz: 0.05 }),
        emit(S, b.eye, { x: -0.12, y: headY + 0.02, z: 0.19, sx: 0.09, sy: 0.09, sz: 0.05 }),
        // stubby arms
        part(C, b.body, { x: 0.78, y: h * 0.56, rz: 0.7, sx: 0.24, sy: 0.6, sz: 0.24 }),
        part(C, b.body, { x: -0.78, y: h * 0.56, rz: -0.7, sx: 0.24, sy: 0.6, sz: 0.24 }),
      ],
      legL: [part(C, b.body, { x: 0.32, y: -legH / 2, sx: 0.32, sy: legH, sz: 0.32 })],
      legR: [part(C, b.body, { x: -0.32, y: -legH / 2, sx: 0.32, sy: legH, sz: 0.32 })],
    };
  },

  husk(b, h) {
    const legH = h * 0.46, torso = h * 0.32;
    const headY = legH + torso + 0.16;
    return {
      pivot: legH, headY, headR: 0.19, ghost: 0.62,
      upper: [
        part(B, b.body, { y: legH + torso * 0.5, sx: 0.54, sy: torso, sz: 0.3 }),
        part(B, b.body, { y: legH + torso * 0.96, sx: 0.74, sy: 0.16, sz: 0.36 }),
        part(S, b.head, { y: headY, sx: 0.36, sy: 0.4, sz: 0.36 }),
        // hollow face — a dark recess instead of eyes
        part(B, 0x0a0e14, { y: headY, z: 0.17, sx: 0.26, sy: 0.14, sz: 0.06 }),
        emit(S, b.eye, { x: 0.07, y: headY, z: 0.18, sx: 0.05, sy: 0.05, sz: 0.04 }),
        emit(S, b.eye, { x: -0.07, y: headY, z: 0.18, sx: 0.05, sy: 0.05, sz: 0.04 }),
        // headset — still logged in
        part(C, 0x2a3038, { y: headY + 0.06, rz: Math.PI / 2, sx: 0.42, sy: 0.44, sz: 0.42 }),
        part(B, 0x2a3038, { x: 0.21, y: headY, sx: 0.09, sy: 0.16, sz: 0.16 }),
        part(B, 0x2a3038, { x: -0.21, y: headY, sx: 0.09, sy: 0.16, sz: 0.16 }),
        // session lanyard and badge
        part(B, 0x3a4450, { y: legH + torso * 0.82, z: 0.15, sx: 0.3, sy: 0.02, sz: 0.02 }),
        emit(B, 0xd9b24a, { y: legH + torso * 0.58, z: 0.17, sx: 0.16, sy: 0.22, sz: 0.02 }),
        part(B, b.body, { x: 0.36, y: legH + torso * 0.5, rz: 0.1, sx: 0.13, sy: torso * 1.05, sz: 0.13 }),
        part(B, b.body, { x: -0.36, y: legH + torso * 0.5, rz: -0.1, sx: 0.13, sy: torso * 1.05, sz: 0.13 }),
      ],
      legL: [part(B, b.body, { x: 0.15, y: -legH / 2, sx: 0.16, sy: legH, sz: 0.16 })],
      legR: [part(B, b.body, { x: -0.15, y: -legH / 2, sx: 0.16, sy: legH, sz: 0.16 })],
    };
  },

  // -- machines -------------------------------------------------------------

  android(b, h) {
    const legH = h * 0.46, torso = h * 0.32;
    const headY = legH + torso + 0.2;
    return {
      pivot: legH, headY, headR: 0.18,
      upper: [
        // smooth tapered chassis
        part(B, b.body, { y: legH + torso * 0.52, sx: 0.5, sy: torso, sz: 0.3 }),
        part(B, b.head, { y: legH + torso * 0.52, z: 0.16, sx: 0.42, sy: torso * 0.82, sz: 0.05 }),
        part(B, b.body, { y: legH + torso * 1.0, sx: 0.72, sy: 0.14, sz: 0.34 }),
        // service light in the chest
        emit(S, b.eye, { y: legH + torso * 0.62, z: 0.2, sx: 0.12, sy: 0.12, sz: 0.05 }),
        // neck ring + visor head
        part(C, 0x2f353d, { y: legH + torso + 0.02, sx: 0.16, sy: 0.12, sz: 0.16 }),
        part(B, b.head, { y: headY, sx: 0.34, sy: 0.3, sz: 0.32 }),
        part(B, 0x1b2028, { y: headY + 0.01, z: 0.16, sx: 0.3, sy: 0.16, sz: 0.04 }),
        emit(B, b.eye, { y: headY + 0.01, z: 0.18, sx: 0.26, sy: 0.06, sz: 0.02 }),
        // segmented arms with open tray hands
        ...[1, -1].flatMap((s) => [
          part(C, 0x2f353d, { x: s * 0.32, y: legH + torso * 0.92, rz: Math.PI / 2, sx: 0.14, sy: 0.12, sz: 0.14 }),
          part(B, b.body, { x: s * 0.34, y: legH + torso * 0.62, sx: 0.11, sy: torso * 0.5, sz: 0.11 }),
          part(C, 0x2f353d, { x: s * 0.34, y: legH + torso * 0.36, rz: Math.PI / 2, sx: 0.12, sy: 0.1, sz: 0.12 }),
          part(B, b.head, { x: s * 0.34, y: legH + torso * 0.12, rx: -0.9, sx: 0.13, sy: torso * 0.42, sz: 0.1 }),
        ]),
      ],
      legL: [part(B, b.body, { x: 0.14, y: -legH * 0.52, sx: 0.14, sy: legH, sz: 0.14 }),
        part(B, 0x2f353d, { x: 0.14, y: -legH + 0.04, z: 0.06, sx: 0.16, sy: 0.09, sz: 0.28 })],
      legR: [part(B, b.body, { x: -0.14, y: -legH * 0.52, sx: 0.14, sy: legH, sz: 0.14 }),
        part(B, 0x2f353d, { x: -0.14, y: -legH + 0.04, z: 0.06, sx: 0.16, sy: 0.09, sz: 0.28 })],
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
    return {
      pivot: legH, headY, headR: 0.18, chrome: true,
      upper: [
        part(B, b.body, { y: legH + torso * 0.5, sx: 0.52, sy: torso, sz: 0.3 }),
        part(B, b.head, { y: legH + torso * 0.99, sx: 0.72, sy: 0.14, sz: 0.34 }),
        // seam lines down the chest
        part(B, 0x8a97a6, { y: legH + torso * 0.5, z: 0.16, sx: 0.03, sy: torso * 0.9, sz: 0.02 }),
        part(B, 0x8a97a6, { y: legH + torso * 0.5, z: 0.16, sx: 0.4, sy: 0.02, sz: 0.02 }),
        // blank face plate — no eyes at all
        part(S, b.head, { y: headY, sx: 0.34, sy: 0.4, sz: 0.34 }),
        part(B, 0xf2f7fc, { y: headY, z: 0.16, sx: 0.28, sy: 0.3, sz: 0.05 }),
        // the copy is always holding a copy of a gun
        part(B, 0x8a97a6, { x: 0.34, y: legH + torso * 0.55, z: 0.3, sx: 0.1, sy: 0.11, sz: 0.72 }),
        part(B, b.body, { x: 0.34, y: legH + torso * 0.52, z: -0.02, rx: -0.7, sx: 0.13, sy: torso * 0.9, sz: 0.13 }),
        part(B, b.body, { x: -0.34, y: legH + torso * 0.52, z: 0.02, rx: -0.5, sx: 0.13, sy: torso * 0.9, sz: 0.13 }),
      ],
      legL: [part(B, b.body, { x: 0.15, y: -legH / 2, sx: 0.16, sy: legH, sz: 0.16 })],
      legR: [part(B, b.body, { x: -0.15, y: -legH / 2, sx: 0.16, sy: legH, sz: 0.16 })],
    };
  },

  // -- creatures ------------------------------------------------------------

  leaper(b, h) {
    const bodyY = h * 0.62;
    return {
      pivot: h * 0.5, headY: bodyY + 0.1, headR: 0.22,
      upper: [
        // low crouched body, tail up
        part(B, b.body, { y: bodyY, rx: -0.14, sx: 0.5, sy: 0.4, sz: 1.05 }),
        part(B, shadeHex(b.body, 1.2), { y: bodyY + 0.16, rx: -0.14, sx: 0.34, sy: 0.14, sz: 0.85 }),
        // wedge head with a sensory crest instead of eyes
        part(B, b.head, { y: bodyY + 0.08, z: 0.62, rx: 0.16, sx: 0.38, sy: 0.3, sz: 0.44 }),
        part(CN, b.head, { y: bodyY + 0.06, z: 0.88, rx: Math.PI / 2, sx: 0.3, sy: 0.32, sz: 0.24 }),
        ...[0, 1, 2].map((i) => part(CN, shadeHex(b.head, 1.3), {
          x: (i - 1) * 0.11, y: bodyY + 0.26, z: 0.6, rx: -0.7, sx: 0.08, sy: 0.3, sz: 0.08,
        })),
        emit(B, b.eye, { y: bodyY + 0.04, z: 0.83, sx: 0.24, sy: 0.04, sz: 0.03 }),
        // segmented tail
        ...[0, 1, 2].map((i) => part(B, b.body, {
          y: bodyY + 0.16 + i * 0.16, z: -0.6 - i * 0.24, rx: 0.5,
          sx: 0.16 - i * 0.03, sy: 0.16 - i * 0.03, sz: 0.34,
        })),
        // small forelimbs with hooks
        part(B, b.body, { x: 0.22, y: bodyY - 0.28, z: 0.4, rx: 0.5, sx: 0.09, sy: 0.42, sz: 0.09 }),
        part(B, b.body, { x: -0.22, y: bodyY - 0.28, z: 0.4, rx: 0.5, sx: 0.09, sy: 0.42, sz: 0.09 }),
      ],
      // powerful folded hind legs
      legL: [part(B, b.body, { x: 0.28, y: -0.16, z: -0.3, rx: -0.6, sx: 0.17, sy: 0.5, sz: 0.17 }),
        part(B, b.body, { x: 0.28, y: -0.4, z: -0.06, rx: 0.55, sx: 0.14, sy: 0.46, sz: 0.14 })],
      legR: [part(B, b.body, { x: -0.28, y: -0.16, z: -0.3, rx: -0.6, sx: 0.17, sy: 0.5, sz: 0.17 }),
        part(B, b.body, { x: -0.28, y: -0.4, z: -0.06, rx: 0.55, sx: 0.14, sy: 0.46, sz: 0.14 })],
    };
  },

  spitter(b, h) {
    const legH = h * 0.3;
    const headY = h * 0.78;
    return {
      pivot: legH, headY, headR: 0.34, wobble: 0.6,
      upper: [
        part(S, b.body, { y: h * 0.46, rx: 0.24, sx: 0.85, sy: 0.8, sz: 0.95 }),
        // back nodules
        ...[0, 1, 2].map((i) => part(S, shadeHex(b.body, 1.3), {
          x: (i - 1) * 0.24, y: h * 0.62, z: -0.3, sx: 0.28, sy: 0.28, sz: 0.28,
        })),
        // sagging sac head with a wide maw
        part(S, b.head, { y: headY, sx: 0.72, sy: 0.62, sz: 0.68 }),
        part(S, shadeHex(b.head, 0.8), { y: headY - 0.2, z: 0.12, sx: 0.6, sy: 0.4, sz: 0.55 }),
        part(B, 0x121808, { y: headY - 0.12, z: 0.3, rx: 0.3, sx: 0.44, sy: 0.2, sz: 0.14 }),
        ...[0, 1, 2, 3].map((i) => part(CN, 0xe8f4c0, {
          x: (i - 1.5) * 0.11, y: headY - 0.2, z: 0.34, rx: Math.PI, sx: 0.05, sy: 0.12, sz: 0.05,
        })),
        emit(S, b.eye, { x: 0.2, y: headY + 0.14, z: 0.28, sx: 0.12, sy: 0.12, sz: 0.08 }),
        emit(S, b.eye, { x: -0.2, y: headY + 0.14, z: 0.28, sx: 0.12, sy: 0.12, sz: 0.08 }),
        // drips
        emit(S, b.head, { y: headY - 0.34, z: 0.26, sx: 0.09, sy: 0.16, sz: 0.09, opacity: 0.8 }),
        // thin arms
        part(C, b.body, { x: 0.5, y: h * 0.42, rz: 0.5, sx: 0.12, sy: 0.7, sz: 0.12 }),
        part(C, b.body, { x: -0.5, y: h * 0.42, rz: -0.5, sx: 0.12, sy: 0.7, sz: 0.12 }),
      ],
      legL: [part(C, b.body, { x: 0.24, y: -legH / 2, sx: 0.2, sy: legH, sz: 0.2 })],
      legR: [part(C, b.body, { x: -0.24, y: -legH / 2, sx: 0.2, sy: legH, sz: 0.2 })],
    };
  },

  brute(b, h) {
    const legH = h * 0.34, torso = h * 0.4;
    const headY = legH + torso * 1.02;
    return {
      pivot: legH, headY, headR: 0.26,
      upper: [
        // narrower ribcage than the shoulders, so the frame reads as a wedge
        part(B, b.body, { y: legH + torso * 0.46, rx: 0.16, sx: 0.95, sy: torso * 0.92, sz: 0.72 }),
        part(B, shadeHex(b.body, 0.55), { y: legH + torso * 0.5, z: 0.38, rx: 0.16, sx: 0.72, sy: torso * 0.6, sz: 0.14 }),
        // bolted chest plate with exposed muscle either side
        ...[0, 1, 2].map((i) => part(B, shadeHex(b.head, 1.15), {
          y: legH + torso * (0.28 + i * 0.22), z: 0.44, rx: 0.16, sx: 0.66 - i * 0.08, sy: 0.07, sz: 0.05,
        })),
        // slabs of shoulder that frame the head instead of burying it
        ...[1, -1].map((sgn) => part(B, b.head, {
          x: sgn * 0.72, y: legH + torso * 0.9, rz: sgn * -0.34, sx: 0.5, sy: 0.34, sz: 0.62,
        })),
        ...[1, -1].flatMap((sgn) => [0, 1].map((i) => part(CN, shadeHex(b.head, 1.3), {
          x: sgn * (0.6 + i * 0.22), y: legH + torso * 1.06, z: (i - 0.5) * 0.3,
          rz: sgn * -0.5, sx: 0.16, sy: 0.36, sz: 0.16,
        }))),
        // head, clear of the shoulders and lit
        part(S, b.head, { y: headY, z: 0.16, sx: 0.5, sy: 0.46, sz: 0.48 }),
        part(B, 0x24140e, { y: headY - 0.12, z: 0.36, sx: 0.34, sy: 0.14, sz: 0.1 }),
        ...[0, 1, 2, 3].map((i) => part(CN, 0xe8dcc0, {
          x: (i - 1.5) * 0.09, y: headY - 0.14, z: 0.4, rx: Math.PI, sx: 0.05, sy: 0.1, sz: 0.05,
        })),
        emit(S, b.eye, { x: 0.15, y: headY + 0.06, z: 0.36, sx: 0.11, sy: 0.09, sz: 0.07 }),
        emit(S, b.eye, { x: -0.15, y: headY + 0.06, z: 0.36, sx: 0.11, sy: 0.09, sz: 0.07 }),
        // the arm: dropped low, thick, ending in a fist bigger than its head
        part(B, b.body, { x: 0.98, y: legH + torso * 0.66, rz: 0.22, sx: 0.44, sy: torso * 0.6, sz: 0.44 }),
        part(B, shadeHex(b.body, 1.15), { x: 1.14, y: legH + torso * 0.16, rz: 0.12, sx: 0.52, sy: torso * 0.62, sz: 0.52 }),
        part(S, b.head, { x: 1.2, y: legH - 0.16, sx: 0.86, sy: 0.76, sz: 0.86 }),
        ...[0, 1, 2].map((i) => part(CN, shadeHex(b.head, 1.35), {
          x: 1.2 + (i - 1) * 0.22, y: legH - 0.34, z: 0.3, rx: 1.4, sx: 0.14, sy: 0.3, sz: 0.14,
        })),
        // the other arm is almost vestigial
        part(B, b.body, { x: -0.64, y: legH + torso * 0.56, rz: -0.26, sx: 0.22, sy: torso * 0.72, sz: 0.22 }),
        part(S, b.head, { x: -0.76, y: legH + torso * 0.16, sx: 0.3, sy: 0.28, sz: 0.3 }),
      ],
      legL: [part(B, b.body, { x: 0.34, y: -legH * 0.5, sx: 0.36, sy: legH, sz: 0.4 }),
        part(B, b.head, { x: 0.34, y: -legH + 0.09, z: 0.12, sx: 0.42, sy: 0.18, sz: 0.62 })],
      legR: [part(B, b.body, { x: -0.34, y: -legH * 0.5, sx: 0.36, sy: legH, sz: 0.4 }),
        part(B, b.head, { x: -0.34, y: -legH + 0.09, z: 0.12, sx: 0.42, sy: 0.18, sz: 0.62 })],
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

export function buildEnemyMesh(type) {
  const b = type.build;
  const h = type.height;
  const builder = ENEMY_BUILDERS[type.id] || ENEMY_BUILDERS.shambler;
  const spec = builder(b, h);

  const rig = new THREE.Group();
  const upper = assemble(spec.upper);
  const legL = assemble(spec.legL || []);
  const legR = assemble(spec.legR || []);
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
    return [
      // welded junk throne worn as armour
      part(B, b.body, { y: h * 0.44, sx: 2.1, sy: h * 0.46, sz: 1.15 }),
      part(B, shadeHex(b.body, 0.7), { y: h * 0.46, z: -0.7, sx: 2.5, sy: h * 0.62, sz: 0.3 }),
      ...[0, 1, 2, 3, 4].map((i) => part(B, shadeHex(b.body, 0.6), {
        x: (i - 2) * 0.55, y: h * (0.78 + (i % 2) * 0.09), z: -0.72,
        rz: (i - 2) * 0.12, sx: 0.34, sy: 0.7, sz: 0.24,
      })),
      part(B, b.body, { y: h * 0.16, sx: 1.6, sy: h * 0.3, sz: 1.0 }),
      // chest of scavenged "medals"
      part(B, shadeHex(b.body, 1.3), { y: h * 0.5, z: 0.6, sx: 1.5, sy: h * 0.3, sz: 0.1 }),
      ...[0, 1, 2, 3].map((i) => emit(IC, b.accent, {
        x: -0.5 + i * 0.34, y: h * (0.42 + (i % 2) * 0.12), z: 0.68, sx: 0.2, sy: 0.2, sz: 0.14,
      })),
      // hunched head with slot eyes
      part(S, shadeHex(b.body, 0.75), { y: h * 0.78, z: 0.12, sx: 1.05, sy: 1.0, sz: 1.0 }),
      part(B, 0x0d1116, { y: h * 0.78, z: 0.58, sx: 0.72, sy: 0.24, sz: 0.1 }),
      emit(B, b.eye, { x: 0.2, y: h * 0.78, z: 0.62, sx: 0.22, sy: 0.09, sz: 0.03 }),
      emit(B, b.eye, { x: -0.2, y: h * 0.78, z: 0.62, sx: 0.22, sy: 0.09, sz: 0.03 }),
      // a crown that has been repaired too many times
      part(C, b.accent, { y: h * 0.99, sx: 1.15, sy: 0.24, sz: 1.15 }),
      ...[0, 1, 2, 3, 4, 5].map((i) => part(CN, b.accent, {
        x: Math.cos(i * 1.047) * 0.52, y: h * (1.09 + (i % 2) * 0.04), z: Math.sin(i * 1.047) * 0.52,
        rz: (i % 3 - 1) * 0.24, sx: 0.24, sy: 0.5 + (i % 2) * 0.18, sz: 0.24,
      })),
      // arms; one holds a pipe sceptre
      part(B, b.body, { x: 1.28, y: h * 0.5, rz: 0.22, sx: 0.44, sy: h * 0.44, sz: 0.44 }),
      part(B, b.body, { x: -1.3, y: h * 0.46, rz: -0.3, sx: 0.42, sy: h * 0.44, sz: 0.42 }),
      part(C, shadeHex(b.body, 0.5), { x: 1.5, y: h * 0.62, rz: 0.12, sx: 0.16, sy: h * 1.0, sz: 0.16 }),
      emit(IC, b.accent, { x: 1.62, y: h * 1.1, sx: 0.42, sy: 0.5, sz: 0.42 }),
      part(S, shadeHex(b.body, 1.2), { x: -1.42, y: h * 0.2, sx: 0.5, sy: 0.46, sz: 0.5 }),
      // legs and a dragging cape
      part(B, b.body, { x: 0.5, y: h * 0.1, sx: 0.46, sy: h * 0.22, sz: 0.46 }),
      part(B, b.body, { x: -0.5, y: h * 0.1, sx: 0.46, sy: h * 0.22, sz: 0.46 }),
      part(B, shadeHex(b.body, 0.55), { y: h * 0.34, z: -1.0, rx: 0.14, sx: 2.2, sy: h * 0.68, sz: 0.12 }),
    ];
  },

  crocodilejim(b, h) {
    return [
      // upright, heavy-tailed lizard
      part(B, b.body, { y: h * 0.52, rx: 0.16, sx: 1.4, sy: h * 0.5, sz: 1.0 }),
      part(B, shadeHex(b.body, 1.35), { y: h * 0.46, z: 0.5, rx: 0.16, sx: 1.0, sy: h * 0.34, sz: 0.16 }),
      // long snout with a full set of teeth
      part(B, b.body, { y: h * 0.82, z: 0.5, rx: 0.1, sx: 0.82, sy: 0.5, sz: 0.8 }),
      part(B, b.body, { y: h * 0.86, z: 1.24, rx: 0.05, sx: 0.66, sy: 0.3, sz: 0.95 }),
      part(B, shadeHex(b.body, 1.2), { y: h * 0.72, z: 1.2, rx: -0.12, sx: 0.62, sy: 0.24, sz: 0.9 }),
      ...Array.from({ length: 8 }, (_, i) => part(CN, 0xf4f0e2, {
        x: (i % 4 - 1.5) * 0.19, y: h * 0.79, z: 0.95 + Math.floor(i / 4) * 0.5,
        rx: i < 4 ? Math.PI : 0, sx: 0.11, sy: 0.24, sz: 0.11,
      })),
      emit(S, b.eye, { x: 0.3, y: h * 0.98, z: 0.52, sx: 0.3, sy: 0.3, sz: 0.3 }),
      emit(S, b.eye, { x: -0.3, y: h * 0.98, z: 0.52, sx: 0.3, sy: 0.3, sz: 0.3 }),
      part(B, 0x101418, { x: 0.3, y: h * 1.0, z: 0.66, sx: 0.1, sy: 0.14, sz: 0.06 }),
      part(B, 0x101418, { x: -0.3, y: h * 1.0, z: 0.66, sx: 0.1, sy: 0.14, sz: 0.06 }),
      // THE LANYARD
      part(B, 0x1f4a8a, { y: h * 0.62, z: 0.46, rz: 0.5, sx: 0.5, sy: 0.05, sz: 0.05 }),
      part(B, 0x1f4a8a, { y: h * 0.62, z: 0.46, rz: -0.5, sx: 0.5, sy: 0.05, sz: 0.05 }),
      emit(B, 0xd9e84a, { y: h * 0.44, z: 0.56, sx: 0.3, sy: 0.4, sz: 0.03 }),
      // dorsal ridge running into the tail
      ...Array.from({ length: 8 }, (_, i) => part(CN, b.accent, {
        y: h * (0.78 - i * 0.055), z: -0.2 - i * 0.35, rx: -0.35,
        sx: 0.36 - i * 0.03, sy: 0.5 - i * 0.04, sz: 0.3,
      })),
      part(B, b.body, { y: h * 0.3, z: -1.6, rx: 0.4, sx: 0.7, sy: 0.6, sz: 1.6 }),
      // clawed arms
      ...[1, -1].flatMap((sgn) => [
        part(B, b.body, { x: sgn * 0.86, y: h * 0.56, rz: sgn * 0.24, sx: 0.34, sy: h * 0.4, sz: 0.34 }),
        part(B, b.body, { x: sgn * 1.0, y: h * 0.3, z: 0.24, rx: -0.6, sx: 0.3, sy: h * 0.34, sz: 0.3 }),
        ...[0, 1, 2].map((i) => part(CN, 0xf4f0e2, {
          x: sgn * (0.86 + i * 0.14), y: h * 0.15, z: 0.46, rx: 1.5, sx: 0.09, sy: 0.28, sz: 0.09,
        })),
      ]),
      part(B, b.body, { x: 0.52, y: h * 0.16, sx: 0.46, sy: h * 0.34, sz: 0.5 }),
      part(B, b.body, { x: -0.52, y: h * 0.16, sx: 0.46, sy: h * 0.34, sz: 0.5 }),
    ];
  },

  fishkid(b, h) {
    return [
      // an oversized diving suit with a child somewhere inside it
      part(B, b.body, { y: h * 0.4, sx: 0.9, sy: h * 0.44, sz: 0.6 }),
      part(B, shadeHex(b.body, 0.7), { y: h * 0.22, sx: 0.96, sy: 0.12, sz: 0.66 }),
      ...[0, 1].map((i) => part(B, shadeHex(b.body, 1.3), {
        y: h * (0.34 + i * 0.16), z: 0.31, sx: 0.5, sy: 0.06, sz: 0.04,
      })),
      // air tank and hose
      part(C, 0x88a0aa, { x: 0.22, y: h * 0.5, z: -0.42, sx: 0.3, sy: h * 0.44, sz: 0.3 }),
      part(C, 0x88a0aa, { x: -0.22, y: h * 0.5, z: -0.42, sx: 0.3, sy: h * 0.44, sz: 0.3 }),
      part(C, 0x3a4a52, { x: 0.34, y: h * 0.74, z: -0.1, rz: 0.9, sx: 0.08, sy: 0.7, sz: 0.08 }),
      // glass helmet with a very small person in it
      part(C, 0x9aacb6, { y: h * 0.66, sx: 0.62, sy: 0.12, sz: 0.62 }),
      part(S, b.accent, { y: h * 0.86, sx: 0.5, sy: 0.5, sz: 0.5 }),
      emit(S, b.eye, { x: 0.14, y: h * 0.88, z: 0.2, sx: 0.15, sy: 0.15, sz: 0.1 }),
      emit(S, b.eye, { x: -0.14, y: h * 0.88, z: 0.2, sx: 0.15, sy: 0.15, sz: 0.1 }),
      part(B, 0x0d2228, { y: h * 0.79, z: 0.22, sx: 0.16, sy: 0.06, sz: 0.06 }),
      part(S, 0xbfe8f0, { y: h * 0.86, sx: 1.0, sy: 1.02, sz: 1.0, opacity: 0.32 }),
      part(UNIT.torus, 0x9aacb6, { y: h * 0.86, rx: Math.PI / 2, sx: 1.02, sy: 1.02, sz: 1.02 }),
      // water line inside the helmet, at forty percent
      emit(B, b.accent, { y: h * 0.76, sx: 0.9, sy: 0.03, sz: 0.9, opacity: 0.5 }),
      // arms and enormous boots
      part(B, b.body, { x: 0.56, y: h * 0.42, rz: 0.26, sx: 0.24, sy: h * 0.4, sz: 0.24 }),
      part(B, b.body, { x: -0.56, y: h * 0.42, rz: -0.26, sx: 0.24, sy: h * 0.4, sz: 0.24 }),
      part(S, 0x88a0aa, { x: 0.64, y: h * 0.2, sx: 0.3, sy: 0.28, sz: 0.3 }),
      part(S, 0x88a0aa, { x: -0.64, y: h * 0.2, sx: 0.3, sy: 0.28, sz: 0.3 }),
      part(B, b.body, { x: 0.24, y: h * 0.1, sx: 0.28, sy: h * 0.2, sz: 0.28 }),
      part(B, b.body, { x: -0.24, y: h * 0.1, sx: 0.28, sy: h * 0.2, sz: 0.28 }),
      part(B, 0x3a4a52, { x: 0.24, y: h * 0.04, z: 0.08, sx: 0.42, sy: 0.16, sz: 0.62 }),
      part(B, 0x3a4a52, { x: -0.24, y: h * 0.04, z: 0.08, sx: 0.42, sy: 0.16, sz: 0.62 }),
    ];
  },

  texasvegas(b, h) {
    return [
      part(B, b.body, { y: h * 0.55, sx: 0.9, sy: h * 0.4, sz: 0.5 }),
      // long coat with neon piping, open at the front
      ...[1, -1].map((sgn) => part(B, shadeHex(b.body, 1.5), {
        x: sgn * 0.44, y: h * 0.42, rz: sgn * 0.06, sx: 0.24, sy: h * 0.62, sz: 0.6,
      })),
      ...[1, -1].map((sgn) => emit(B, b.accent, {
        x: sgn * 0.56, y: h * 0.42, z: 0.02, sx: 0.04, sy: h * 0.6, sz: 0.52,
      })),
      emit(B, b.accent, { y: h * 0.62, z: 0.27, sx: 0.62, sy: 0.06, sz: 0.02 }),
      // belt buckle the size of a sign
      part(B, 0x2a2a30, { y: h * 0.36, z: 0.24, sx: 0.9, sy: 0.16, sz: 0.1 }),
      emit(B, b.eye, { y: h * 0.36, z: 0.3, sx: 0.4, sy: 0.26, sz: 0.03 }),
      // face under an enormous hat
      part(S, 0xe8c9a0, { y: h * 0.84, sx: 0.5, sy: 0.55, sz: 0.5 }),
      part(B, 0x1a1a20, { y: h * 0.86, z: 0.22, sx: 0.42, sy: 0.1, sz: 0.06 }),
      emit(B, b.eye, { y: h * 0.86, z: 0.25, sx: 0.36, sy: 0.05, sz: 0.02 }),
      part(B, 0x6a4a3a, { y: h * 0.74, z: 0.22, sx: 0.3, sy: 0.08, sz: 0.06 }),
      part(C, b.body, { y: h * 1.0, sx: 0.66, sy: 0.42, sz: 0.66 }),
      part(C, b.body, { y: h * 0.92, sx: 2.0, sy: 0.08, sz: 1.7 }),
      emit(B, b.accent, { y: h * 1.0, z: 0.3, sx: 0.5, sy: 0.05, sz: 0.02 }),
      // two revolvers, held out
      ...[1, -1].flatMap((sgn) => [
        part(B, b.body, { x: sgn * 0.62, y: h * 0.56, z: 0.2, rx: -0.5, sx: 0.2, sy: h * 0.34, sz: 0.2 }),
        part(B, 0xc9c9d2, { x: sgn * 0.66, y: h * 0.46, z: 0.6, sx: 0.12, sy: 0.14, sz: 0.6 }),
        emit(S, b.eye, { x: sgn * 0.66, y: h * 0.46, z: 0.9, sx: 0.09, sy: 0.09, sz: 0.06 }),
      ]),
      // boots with spurs
      part(B, b.body, { x: 0.28, y: h * 0.16, sx: 0.28, sy: h * 0.32, sz: 0.28 }),
      part(B, b.body, { x: -0.28, y: h * 0.16, sx: 0.28, sy: h * 0.32, sz: 0.28 }),
      part(B, 0x3a2a20, { x: 0.28, y: h * 0.04, z: 0.08, sx: 0.34, sy: 0.18, sz: 0.5 }),
      part(B, 0x3a2a20, { x: -0.28, y: h * 0.04, z: 0.08, sx: 0.34, sy: 0.18, sz: 0.5 }),
      emit(UNIT.torus, b.eye, { x: 0.28, y: h * 0.06, z: -0.16, rx: 0, sx: 0.26, sy: 0.26, sz: 0.26 }),
      emit(UNIT.torus, b.eye, { x: -0.28, y: h * 0.06, z: -0.16, rx: 0, sx: 0.26, sy: 0.26, sz: 0.26 }),
    ];
  },

  gorbus(b, h) {
    return [
      // an apologetic mass of slime
      part(S, b.body, { y: h * 0.44, sx: 2.5, sy: h * 0.58, sz: 2.1, opacity: 0.9 }),
      part(S, b.body, { y: h * 0.78, z: 0.1, sx: 1.5, sy: 1.2, sz: 1.35, opacity: 0.9 }),
      part(S, shadeHex(b.body, 1.25), { y: h * 0.2, sx: 2.7, sy: 0.5, sz: 2.3, opacity: 0.85 }),
      // things he has collected, suspended inside him
      part(B, 0x8a6a48, { x: -0.5, y: h * 0.36, z: 0.2, ry: 0.4, sx: 1.1, sy: 0.1, sz: 0.4 }),
      part(B, 0x8a6a48, { x: -0.5, y: h * 0.54, z: 0.2, ry: 0.4, sx: 1.1, sy: 0.1, sz: 0.4 }),
      part(C, 0xe8e2d4, { x: 0.62, y: h * 0.44, z: 0.3, sx: 0.32, sy: 0.34, sz: 0.32 }),
      part(UNIT.torus, 0xe8e2d4, { x: 0.82, y: h * 0.44, z: 0.3, sx: 0.26, sy: 0.26, sz: 0.26 }),
      // face: two big eyes and a smaller worried third
      emit(S, b.eye, { x: 0.42, y: h * 0.86, z: 0.62, sx: 0.36, sy: 0.36, sz: 0.24 }),
      emit(S, b.eye, { x: -0.42, y: h * 0.86, z: 0.62, sx: 0.36, sy: 0.36, sz: 0.24 }),
      emit(S, b.eye, { y: h * 0.99, z: 0.58, sx: 0.2, sy: 0.2, sz: 0.14 }),
      part(B, 0x1a3a1e, { y: h * 0.7, z: 0.66, rz: 0.06, sx: 0.5, sy: 0.08, sz: 0.06 }),
      // glowing nodules through the body
      ...Array.from({ length: 10 }, (_, i) => emit(IC, b.accent, {
        x: Math.cos(i * 0.9) * 1.25, y: h * (0.24 + (i % 4) * 0.16), z: Math.sin(i * 0.9) * 1.05,
        sx: 0.3, sy: 0.3, sz: 0.3, opacity: 0.9,
      })),
      // drooping arms and a dripping base
      part(C, b.body, { x: 1.62, y: h * 0.48, rz: 0.5, sx: 0.48, sy: h * 0.46, sz: 0.48, opacity: 0.9 }),
      part(C, b.body, { x: -1.62, y: h * 0.48, rz: -0.5, sx: 0.48, sy: h * 0.46, sz: 0.48, opacity: 0.9 }),
      part(S, b.body, { x: 1.85, y: h * 0.22, sx: 0.6, sy: 0.55, sz: 0.6, opacity: 0.9 }),
      part(S, b.body, { x: -1.85, y: h * 0.22, sx: 0.6, sy: 0.55, sz: 0.6, opacity: 0.9 }),
      ...Array.from({ length: 6 }, (_, i) => part(CN, b.body, {
        x: Math.cos(i * 1.047) * 0.9, y: h * 0.06, z: Math.sin(i * 1.047) * 0.8,
        rx: Math.PI, sx: 0.3, sy: 0.34, sz: 0.3, opacity: 0.85,
      })),
    ];
  },

  synargwynak(b, h, alt) {
    if (!alt) {
      // Synar: tall, narrow, two enormous eyes, a single swept crest.
      return [
        part(B, b.body, { y: h * 0.5, sx: 0.72, sy: h * 0.46, sz: 0.44 }),
        part(B, shadeHex(b.body, 1.3), { y: h * 0.52, z: 0.24, sx: 0.5, sy: h * 0.34, sz: 0.05 }),
        emit(B, b.accent, { y: h * 0.62, z: 0.26, sx: 0.34, sy: 0.05, sz: 0.02 }),
        part(S, b.body, { y: h * 0.88, sx: 0.9, sy: 1.05, sz: 0.85 }),
        emit(S, b.eye, { x: 0.24, y: h * 0.9, z: 0.34, sx: 0.32, sy: 0.46, sz: 0.18 }),
        emit(S, b.eye, { x: -0.24, y: h * 0.9, z: 0.34, sx: 0.32, sy: 0.46, sz: 0.18 }),
        part(B, shadeHex(b.body, 0.6), { y: h * 0.78, z: 0.36, sx: 0.22, sy: 0.05, sz: 0.05 }),
        part(CN, b.accent, { y: h * 1.16, z: -0.1, rx: -0.3, sx: 0.22, sy: 0.8, sz: 0.22 }),
        ...[1, -1].flatMap((sgn) => [
          part(B, b.body, { x: sgn * 0.5, y: h * 0.62, rz: sgn * 0.3, sx: 0.14, sy: h * 0.4, sz: 0.14 }),
          part(B, b.body, { x: sgn * 0.68, y: h * 0.3, rz: sgn * -0.24, sx: 0.12, sy: h * 0.36, sz: 0.12 }),
          part(CN, b.accent, { x: sgn * 0.6, y: h * 0.1, rx: Math.PI, sx: 0.14, sy: 0.32, sz: 0.14 }),
        ]),
        part(B, b.body, { x: 0.2, y: h * 0.16, sx: 0.2, sy: h * 0.34, sz: 0.2 }),
        part(B, b.body, { x: -0.2, y: h * 0.16, sx: 0.2, sy: h * 0.34, sz: 0.2 }),
      ];
    }
    // Gwynak: squat, wide, eleven eyes, two horns, thick arms.
    return [
      part(B, b.body, { y: h * 0.42, sx: 1.5, sy: h * 0.44, sz: 0.9 }),
      part(S, b.body, { y: h * 0.78, sx: 1.5, sy: 1.05, sz: 1.15 }),
      ...Array.from({ length: 11 }, (_, i) => {
        const a = i * 0.571;
        return emit(S, b.eye, {
          x: Math.cos(a) * 0.42, y: h * 0.78 + Math.sin(a) * 0.3, z: 0.5,
          sx: 0.17, sy: 0.17, sz: 0.12,
        });
      }),
      part(B, 0x2a0f1a, { y: h * 0.62, z: 0.52, sx: 0.66, sy: 0.1, sz: 0.06 }),
      part(CN, b.accent, { x: 0.42, y: h * 1.06, rz: 0.42, sx: 0.24, sy: 0.62, sz: 0.24 }),
      part(CN, b.accent, { x: -0.42, y: h * 1.06, rz: -0.42, sx: 0.24, sy: 0.62, sz: 0.24 }),
      ...[1, -1].flatMap((sgn) => [
        part(B, b.body, { x: sgn * 0.92, y: h * 0.5, rz: sgn * 0.18, sx: 0.34, sy: h * 0.42, sz: 0.34 }),
        part(S, shadeHex(b.body, 1.2), { x: sgn * 1.02, y: h * 0.24, sx: 0.44, sy: 0.42, sz: 0.44 }),
      ]),
      part(B, b.body, { x: 0.34, y: h * 0.14, sx: 0.34, sy: h * 0.3, sz: 0.34 }),
      part(B, b.body, { x: -0.34, y: h * 0.14, sx: 0.34, sy: h * 0.3, sz: 0.34 }),
      emit(B, b.accent, { y: h * 0.42, z: 0.46, sx: 0.9, sy: 0.05, sz: 0.02 }),
    ];
  },

  gelatinfingers(b, h) {
    return [
      // a tall figure in a suit that never finished setting
      part(B, 0x2a1a20, { y: h * 0.5, sx: 1.1, sy: h * 0.5, sz: 0.6 }),
      part(B, b.body, { y: h * 0.5, sx: 1.14, sy: h * 0.5, sz: 0.64, opacity: 0.62 }),
      ...[1, -1].map((sgn) => part(B, 0x1a1016, {
        x: sgn * 0.26, y: h * 0.52, z: 0.3, sx: 0.3, sy: h * 0.46, sz: 0.06,
      })),
      part(B, 0xe8dce4, { y: h * 0.62, z: 0.31, sx: 0.2, sy: h * 0.22, sz: 0.04 }),
      // half-melted head
      part(S, b.body, { y: h * 0.85, sx: 0.78, sy: 0.82, sz: 0.76, opacity: 0.72 }),
      part(S, b.body, { y: h * 0.72, z: 0.1, sx: 0.6, sy: 0.5, sz: 0.5, opacity: 0.72 }),
      emit(S, b.eye, { x: 0.18, y: h * 0.88, z: 0.32, sx: 0.19, sy: 0.22, sz: 0.12 }),
      emit(S, b.eye, { x: -0.2, y: h * 0.84, z: 0.32, sx: 0.16, sy: 0.19, sz: 0.12 }),
      part(B, 0x2a1420, { y: h * 0.72, z: 0.34, rz: 0.14, sx: 0.3, sy: 0.05, sz: 0.06 }),
      // shoulders sagging under their own weight
      part(B, b.body, { y: h * 0.72, sx: 1.5, sy: 0.24, sz: 0.6, opacity: 0.7 }),
      // the fingers: absurdly long, drooping to the floor
      ...[1, -1].flatMap((sgn) => [
        part(C, b.body, { x: sgn * 0.72, y: h * 0.52, rz: sgn * 0.16, sx: 0.28, sy: h * 0.44, sz: 0.28, opacity: 0.7 }),
        ...Array.from({ length: 5 }, (_, i) => part(C, b.accent, {
          x: sgn * (0.66 + i * 0.13),
          y: h * (0.26 - i * 0.035),
          z: 0.1 + i * 0.14,
          rx: 0.24 + i * 0.05, rz: sgn * (0.1 + i * 0.04),
          sx: 0.11, sy: h * (0.46 - i * 0.05), sz: 0.11, opacity: 0.82,
        })),
      ]),
      // dripping base
      ...Array.from({ length: 5 }, (_, i) => part(CN, b.accent, {
        x: (i - 2) * 0.32, y: h * 0.05, z: (i % 2) * 0.2 - 0.1,
        rx: Math.PI, sx: 0.18, sy: 0.3, sz: 0.18, opacity: 0.8,
      })),
      part(B, 0x2a1a20, { x: 0.3, y: h * 0.14, sx: 0.34, sy: h * 0.3, sz: 0.34 }),
      part(B, 0x2a1a20, { x: -0.3, y: h * 0.14, sx: 0.34, sy: h * 0.3, sz: 0.34 }),
    ];
  },

  doppelganger(b, h) {
    return [
      part(B, b.body, { y: h * 0.55, sx: 0.8, sy: h * 0.4, sz: 0.44 }),
      part(B, b.accent, { y: h * 0.74, sx: 1.0, sy: 0.14, sz: 0.5 }),
      // seams, as if it were assembled rather than born
      part(B, 0x7f8b99, { y: h * 0.55, z: 0.23, sx: 0.03, sy: h * 0.36, sz: 0.02 }),
      part(B, 0x7f8b99, { y: h * 0.55, z: 0.23, sx: 0.6, sy: 0.03, sz: 0.02 }),
      part(B, 0x7f8b99, { y: h * 0.4, z: 0.23, sx: 0.6, sy: 0.03, sz: 0.02 }),
      // blank face
      part(S, b.accent, { y: h * 0.86, sx: 0.5, sy: 0.56, sz: 0.5 }),
      part(B, 0xffffff, { y: h * 0.86, z: 0.23, sx: 0.42, sy: 0.44, sz: 0.06 }),
      part(B, 0x9aa6b4, { y: h * 0.86, z: 0.27, sx: 0.03, sy: 0.4, sz: 0.02 }),
      // a chromatic after-image, one step behind
      emit(B, 0x2effe0, { x: -0.1, y: h * 0.55, z: -0.16, sx: 0.8, sy: h * 0.4, sz: 0.02, opacity: 0.22 }),
      emit(B, 0xff2ea6, { x: 0.1, y: h * 0.55, z: -0.16, sx: 0.8, sy: h * 0.4, sz: 0.02, opacity: 0.22 }),
      // rifle, held exactly the way you hold yours
      part(B, b.body, { x: 0.5, y: h * 0.56, z: 0.14, rx: -0.5, sx: 0.18, sy: h * 0.34, sz: 0.18 }),
      part(B, b.body, { x: -0.5, y: h * 0.5, z: 0.3, rx: -0.9, sx: 0.18, sy: h * 0.32, sz: 0.18 }),
      part(B, 0x7f8b99, { x: 0.34, y: h * 0.5, z: 0.5, sx: 0.13, sy: 0.15, sz: 1.05 }),
      part(B, 0x5f6b79, { x: 0.34, y: h * 0.6, z: 0.34, sx: 0.09, sy: 0.1, sz: 0.5 }),
      emit(S, 0xffffff, { x: 0.34, y: h * 0.5, z: 1.02, sx: 0.1, sy: 0.1, sz: 0.08 }),
      part(B, b.body, { x: 0.2, y: h * 0.17, sx: 0.22, sy: h * 0.34, sz: 0.22 }),
      part(B, b.body, { x: -0.2, y: h * 0.17, sx: 0.22, sy: h * 0.34, sz: 0.22 }),
      part(B, b.accent, { x: 0.2, y: h * 0.02, z: 0.08, sx: 0.26, sy: 0.1, sz: 0.4 }),
      part(B, b.accent, { x: -0.2, y: h * 0.02, z: 0.08, sx: 0.26, sy: 0.1, sz: 0.4 }),
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

const GUNMETAL = 0x2e333c;
const DARK = 0x1c2027;
const WOOD = 0x7a5230;

export function buildWeaponModel(id, weapon) {
  let parts;
  switch (id) {
    case 'knuckles':
      parts = [
        part(B, 0xd8a882, { x: 0, y: 0, z: 0, sx: 0.34, sy: 0.26, sz: 0.42 }),
        part(B, 0xd8a882, { x: 0, y: 0.14, z: 0.1, sx: 0.34, sy: 0.14, sz: 0.28 }),
        part(B, 0xc9a227, { x: 0, y: 0.06, z: 0.24, sx: 0.36, sy: 0.16, sz: 0.08 }),
        emit(B, 0xffd24a, { x: 0, y: 0.06, z: 0.29, sx: 0.3, sy: 0.05, sz: 0.02 }),
      ];
      break;

    case 'ak47':
      parts = [
        part(B, GUNMETAL, { y: 0, z: -0.05, sx: 0.09, sy: 0.14, sz: 1.0 }),
        part(B, WOOD, { y: -0.02, z: -0.55, sx: 0.08, sy: 0.13, sz: 0.42 }),
        part(B, WOOD, { y: 0.0, z: 0.32, sx: 0.08, sy: 0.11, sz: 0.3 }),
        part(B, GUNMETAL, { y: 0.02, z: 0.62, sx: 0.05, sy: 0.06, sz: 0.36 }),
        part(B, DARK, { y: -0.22, z: 0.08, sx: 0.09, sy: 0.3, sz: 0.16, rx: 0.28 }),
        part(B, DARK, { y: -0.2, z: -0.12, sx: 0.1, sy: 0.28, sz: 0.24, rx: -0.35 }),
        part(B, GUNMETAL, { y: 0.11, z: 0.15, sx: 0.05, sy: 0.06, sz: 0.1 }),
      ];
      break;

    case 'fake47':
      parts = [
        part(B, 0x3a3f48, { y: 0, z: -0.05, sx: 0.09, sy: 0.14, sz: 1.0 }),
        part(B, 0x8a6a48, { y: -0.02, z: -0.55, sx: 0.08, sy: 0.13, sz: 0.42 }),
        part(B, 0x8a6a48, { y: 0.0, z: 0.32, sx: 0.08, sy: 0.11, sz: 0.3 }),
        // The tell: the barrel is very slightly bent.
        part(B, 0x3a3f48, { y: 0.02, z: 0.62, sx: 0.05, sy: 0.06, sz: 0.36, ry: 0.09 }),
        part(B, DARK, { y: -0.22, z: 0.08, sx: 0.09, sy: 0.3, sz: 0.16, rx: 0.28 }),
        part(B, DARK, { y: -0.2, z: -0.12, sx: 0.1, sy: 0.28, sz: 0.24, rx: -0.35 }),
        part(B, 0xd8d8d8, { x: 0.05, y: 0.02, z: -0.1, sx: 0.01, sy: 0.06, sz: 0.2 }),
      ];
      break;

    case 'deagle':
      parts = [
        part(B, 0xb8bcc4, { y: 0.02, z: 0.12, sx: 0.1, sy: 0.16, sz: 0.72 }),
        part(B, 0x8d939c, { y: 0.12, z: 0.16, sx: 0.07, sy: 0.06, sz: 0.62 }),
        part(B, DARK, { y: -0.24, z: -0.16, sx: 0.09, sy: 0.34, sz: 0.18, rx: 0.24 }),
        part(B, 0xb8bcc4, { y: -0.06, z: -0.12, sx: 0.11, sy: 0.14, sz: 0.2 }),
        emit(B, 0xff9a3c, { y: 0.16, z: 0.44, sx: 0.03, sy: 0.03, sz: 0.03 }),
      ];
      break;

    case 'roombroom':
      parts = [
        part(B, DARK, { y: 0, z: 0, sx: 0.11, sy: 0.13, sz: 1.1 }),
        part(C, GUNMETAL, { y: 0.05, z: 0.5, rx: Math.PI / 2, sx: 0.11, sy: 0.6, sz: 0.11 }),
        part(C, GUNMETAL, { y: -0.05, z: 0.5, rx: Math.PI / 2, sx: 0.11, sy: 0.6, sz: 0.11 }),
        part(B, WOOD, { y: -0.03, z: -0.5, sx: 0.09, sy: 0.14, sz: 0.42 }),
        part(B, DARK, { y: -0.2, z: -0.05, sx: 0.09, sy: 0.28, sz: 0.16, rx: 0.25 }),
      ];
      break;

    case 'bigknife':
      parts = [
        part(B, 0xdde4ec, { y: 0.3, z: 0.5, sx: 0.06, sy: 0.5, sz: 1.9 }),
        part(B, 0xf4f8fc, { y: 0.52, z: 0.5, sx: 0.03, sy: 0.08, sz: 1.85 }),
        part(B, 0x3a2a1a, { y: 0.0, z: -0.42, sx: 0.11, sy: 0.11, sz: 0.5 }),
        part(B, 0x8a7a40, { y: 0.1, z: -0.16, sx: 0.22, sy: 0.1, sz: 0.14 }),
        emit(B, 0x9fe4ff, { y: 0.06, z: 0.5, sx: 0.02, sy: 0.03, sz: 1.6 }),
      ];
      break;

    case 'tinyknife':
      parts = [
        part(B, 0xdde4ec, { y: 0.03, z: 0.1, sx: 0.02, sy: 0.05, sz: 0.14 }),
        part(B, 0x3a2a1a, { y: 0, z: -0.02, sx: 0.03, sy: 0.04, sz: 0.11 }),
        emit(B, 0xff8ad0, { y: 0.03, z: 0.16, sx: 0.008, sy: 0.012, sz: 0.03 }),
      ];
      break;

    case 'sanguine':
      parts = [
        part(B, 0x6a1520, { y: 0.24, z: 0.55, sx: 0.05, sy: 0.28, sz: 1.5 }),
        emit(B, 0xff3a4a, { y: 0.24, z: 0.55, sx: 0.02, sy: 0.06, sz: 1.45 }),
        part(B, 0x2a1218, { y: 0, z: -0.35, sx: 0.08, sy: 0.08, sz: 0.42 }),
        part(B, 0x8a2030, { y: 0.06, z: -0.12, sx: 0.3, sy: 0.07, sz: 0.1 }),
        emit(S, 0xff3a4a, { y: 0.06, z: -0.12, sx: 0.1, sy: 0.1, sz: 0.1 }),
      ];
      break;

    case 'mop':
      parts = [
        part(C, 0x8a7248, { y: 0.2, z: 0.3, rx: Math.PI / 2.1, sx: 0.06, sy: 1.7, sz: 0.06 }),
        part(B, 0xd4d8dc, { y: 0.6, z: 1.0, sx: 0.28, sy: 0.34, sz: 0.2 }),
        ...Array.from({ length: 6 }, (_, i) => part(B, 0xe8ecf0, {
          x: -0.1 + i * 0.04, y: 0.46, z: 1.02, sx: 0.02, sy: 0.3, sz: 0.03,
        })),
      ];
      break;

    case 'nimbo':
      parts = [
        part(B, 0x2a3a5a, { y: 0, z: 0, sx: 0.16, sy: 0.18, sz: 0.7 }),
        part(C, 0x4a6a9a, { y: 0.06, z: 0.42, rx: Math.PI / 2, sx: 0.26, sy: 0.3, sz: 0.26 }),
        emit(UNIT.torus, 0x6fffe4, { y: 0.06, z: 0.56, sx: 0.34, sy: 0.34, sz: 0.34 }),
        emit(S, 0xaaffff, { y: 0.06, z: 0.5, sx: 0.16, sy: 0.16, sz: 0.16 }),
        part(B, DARK, { y: -0.22, z: -0.14, sx: 0.09, sy: 0.32, sz: 0.16, rx: 0.24 }),
        emit(B, 0x6fffe4, { x: 0.09, y: 0.06, z: -0.1, sx: 0.02, sy: 0.06, sz: 0.34 }),
        emit(B, 0x6fffe4, { x: -0.09, y: 0.06, z: -0.1, sx: 0.02, sy: 0.06, sz: 0.34 }),
      ];
      break;

    case 'sandwich':
      parts = [
        part(B, 0xb8bcc4, { y: 0.02, z: 0, sx: 0.3, sy: 0.34, sz: 0.6 }),
        part(B, 0x8d939c, { y: 0.24, z: -0.05, sx: 0.24, sy: 0.16, sz: 0.34 }),
        part(C, 0x6a7080, { y: 0.02, z: 0.42, rx: Math.PI / 2, sx: 0.22, sy: 0.28, sz: 0.22 }),
        emit(B, 0xffd24a, { y: 0.14, z: 0.2, sx: 0.16, sy: 0.03, sz: 0.1 }),
        part(B, DARK, { y: -0.24, z: -0.12, sx: 0.09, sy: 0.3, sz: 0.16, rx: 0.22 }),
        part(B, 0xd9a441, { y: 0.02, z: 0.5, sx: 0.16, sy: 0.05, sz: 0.16 }),
      ];
      break;

    case 'grappler':
      parts = [
        part(B, 0x3a4450, { y: 0, z: 0, sx: 0.16, sy: 0.2, sz: 0.66 }),
        part(C, 0x5a6470, { y: 0.14, z: -0.1, rx: Math.PI / 2, sx: 0.3, sy: 0.12, sz: 0.3 }),
        part(B, 0x8d939c, { y: 0.02, z: 0.42, sx: 0.1, sy: 0.1, sz: 0.3 }),
        part(CN, 0xc9a227, { y: 0.02, z: 0.62, rx: -Math.PI / 2, sx: 0.16, sy: 0.24, sz: 0.16 }),
        emit(B, 0x6fd8ff, { y: 0.12, z: 0.16, sx: 0.04, sy: 0.02, sz: 0.2 }),
        part(B, DARK, { y: -0.22, z: -0.16, sx: 0.09, sy: 0.3, sz: 0.16, rx: 0.24 }),
      ];
      break;

    case 'harpoon':
      parts = [
        part(B, 0x1e4a52, { y: 0, z: 0, sx: 0.13, sy: 0.16, sz: 0.9 }),
        part(C, 0x2e6a76, { y: 0.06, z: 0.3, rx: Math.PI / 2, sx: 0.09, sy: 0.9, sz: 0.09 }),
        part(CN, 0xc4d8dc, { y: 0.06, z: 0.8, rx: -Math.PI / 2, sx: 0.11, sy: 0.3, sz: 0.11 }),
        part(C, 0x5fd4e8, { y: 0.16, z: -0.2, rx: Math.PI / 2, sx: 0.26, sy: 0.1, sz: 0.26 }),
        emit(B, 0x5fd4e8, { y: -0.06, z: 0.1, sx: 0.03, sy: 0.02, sz: 0.4 }),
        part(B, DARK, { y: -0.22, z: -0.2, sx: 0.09, sy: 0.3, sz: 0.16, rx: 0.24 }),
      ];
      break;

    case 'zapper':
      parts = [
        part(B, 0x2a2f38, { y: 0, z: -0.05, sx: 0.14, sy: 0.16, sz: 0.72 }),
        part(C, 0x4a5260, { y: 0.06, z: 0.36, rx: Math.PI / 2, sx: 0.18, sy: 0.32, sz: 0.18 }),
        ...[0, 1, 2, 3].map((i) => emit(B, 0x8ff0ff, {
          x: Math.cos(i * 1.5708) * 0.13, y: 0.06 + Math.sin(i * 1.5708) * 0.13, z: 0.56,
          sx: 0.025, sy: 0.025, sz: 0.16,
        })),
        emit(S, 0xd8ffff, { y: 0.06, z: 0.62, sx: 0.1, sy: 0.1, sz: 0.1 }),
        part(B, DARK, { y: -0.22, z: -0.16, sx: 0.09, sy: 0.3, sz: 0.16, rx: 0.24 }),
      ];
      break;

    case 'sawblade':
      parts = [
        part(B, 0x3a3020, { y: 0, z: -0.05, sx: 0.14, sy: 0.18, sz: 0.76 }),
        part(C, 0x6a5a30, { y: 0.16, z: 0.05, rx: Math.PI / 2, sx: 0.36, sy: 0.1, sz: 0.36 }),
        part(C, 0xc4c8cc, { y: 0.16, z: 0.06, rx: Math.PI / 2, sx: 0.3, sy: 0.12, sz: 0.3 }),
        part(B, 0x8d939c, { y: 0.0, z: 0.44, sx: 0.09, sy: 0.09, sz: 0.3 }),
        emit(B, 0xffd24a, { y: 0.1, z: 0.3, sx: 0.03, sy: 0.02, sz: 0.16 }),
        part(B, DARK, { y: -0.22, z: -0.14, sx: 0.09, sy: 0.3, sz: 0.16, rx: 0.24 }),
      ];
      break;

    case 'actuary':
      parts = [
        part(B, 0x1a1f28, { y: 0, z: 0, sx: 0.11, sy: 0.15, sz: 1.3 }),
        part(B, 0x2e3a48, { y: 0.13, z: -0.1, sx: 0.08, sy: 0.1, sz: 0.6 }),
        part(C, 0x8d939c, { y: 0, z: 0.78, rx: Math.PI / 2, sx: 0.09, sy: 0.5, sz: 0.09 }),
        emit(UNIT.torus, 0x8ff0ff, { y: 0, z: 0.92, sx: 0.2, sy: 0.2, sz: 0.2 }),
        emit(B, 0x8ff0ff, { x: 0.06, y: 0.06, z: 0.2, sx: 0.02, sy: 0.02, sz: 0.7 }),
        emit(B, 0x8ff0ff, { x: -0.06, y: 0.06, z: 0.2, sx: 0.02, sy: 0.02, sz: 0.7 }),
        part(B, DARK, { y: -0.24, z: -0.3, sx: 0.09, sy: 0.32, sz: 0.16, rx: 0.24 }),
        part(B, 0x1a1f28, { y: -0.04, z: -0.7, sx: 0.1, sy: 0.2, sz: 0.34 }),
      ];
      break;

    case 'intern':
      parts = [
        part(B, 0xb8c4d0, { y: 0, z: 0, sx: 0.18, sy: 0.22, sz: 0.6 }),
        part(B, 0xe8eef4, { y: 0.16, z: -0.1, sx: 0.2, sy: 0.12, sz: 0.3 }),
        part(C, 0x8d939c, { y: 0, z: 0.38, rx: Math.PI / 2, sx: 0.07, sy: 0.3, sz: 0.07 }),
        emit(B, 0x4affa0, { y: 0.15, z: 0.06, sx: 0.1, sy: 0.03, sz: 0.14 }),
        part(B, DARK, { y: -0.22, z: -0.14, sx: 0.09, sy: 0.3, sz: 0.16, rx: 0.24 }),
      ];
      break;

    case 'compliance':
      parts = [
        part(B, 0x1f2a3a, { y: 0, z: 0.05, sx: 0.12, sy: 0.18, sz: 0.8 }),
        part(B, 0x2e3d52, { y: 0.14, z: 0.1, sx: 0.09, sy: 0.08, sz: 0.66 }),
        part(B, 0xc9a227, { y: 0.02, z: -0.28, sx: 0.14, sy: 0.14, sz: 0.16 }),
        emit(B, 0xffd24a, { y: 0.02, z: -0.36, sx: 0.1, sy: 0.1, sz: 0.02 }),
        part(B, DARK, { y: -0.24, z: -0.2, sx: 0.09, sy: 0.32, sz: 0.17, rx: 0.24 }),
        emit(B, 0xffd24a, { y: 0.19, z: 0.3, sx: 0.03, sy: 0.02, sz: 0.2 }),
      ];
      break;

    case 'nullptr':
      parts = [
        part(B, 0x141820, { y: 0, z: 0.05, sx: 0.12, sy: 0.16, sz: 0.7 }),
        emit(B, 0x2effe0, { y: 0.1, z: 0.05, sx: 0.03, sy: 0.02, sz: 0.55 }),
        part(C, 0x2a3038, { y: 0, z: 0.42, rx: Math.PI / 2, sx: 0.14, sy: 0.22, sz: 0.14 }),
        emit(UNIT.torus, 0x2effe0, { y: 0, z: 0.52, sx: 0.18, sy: 0.18, sz: 0.18 }),
        part(B, DARK, { y: -0.22, z: -0.2, sx: 0.09, sy: 0.3, sz: 0.16, rx: 0.24 }),
      ];
      break;

    case 'prototype':
      parts = [
        part(B, 0x4a4a52, { y: 0, z: 0, sx: 0.15, sy: 0.19, sz: 0.68 }),
        part(B, 0x8a4a2e, { y: 0.14, z: 0.1, sx: 0.1, sy: 0.1, sz: 0.3 }),
        part(C, 0xc9a227, { y: -0.02, z: 0.42, rx: Math.PI / 2, sx: 0.12, sy: 0.28, sz: 0.12 }),
        emit(S, 0xff8ad0, { y: 0.16, z: -0.14, sx: 0.12, sy: 0.12, sz: 0.12 }),
        emit(B, 0x6fd8ff, { x: 0.09, y: 0, z: 0.1, sx: 0.02, sy: 0.05, sz: 0.3 }),
        part(B, 0xd8d8d8, { x: -0.1, y: 0.05, z: 0.05, sx: 0.02, sy: 0.02, sz: 0.4, rz: 0.3 }),
        part(B, DARK, { y: -0.22, z: -0.14, sx: 0.09, sy: 0.3, sz: 0.16, rx: 0.24 }),
      ];
      break;

    case 'babygun': {
      const stage = weapon ? (weapon.params.stage | 0) : 0;
      const col = weapon?.stageColor || 0xffd6e7;
      const len = 0.4 + stage * 0.14;
      parts = [
        part(B, col, { y: 0, z: 0, sx: 0.12 + stage * 0.01, sy: 0.16 + stage * 0.012, sz: len }),
        part(B, stage >= 3 ? 0x2e333c : 0xfff4f8, { y: 0.11, z: 0.02, sx: 0.08, sy: 0.07, sz: len * 0.7 }),
        part(C, stage >= 4 ? 0xd8dce0 : col, { y: 0, z: len * 0.62, rx: Math.PI / 2, sx: 0.08 + stage * 0.012, sy: 0.24, sz: 0.08 + stage * 0.012 }),
        part(B, DARK, { y: -0.2, z: -0.1, sx: 0.09, sy: 0.28, sz: 0.15, rx: 0.24 }),
        emit(B, stage >= 5 ? 0xd8c47a : 0xffffff, { y: 0.14, z: len * 0.3, sx: 0.03, sy: 0.02, sz: 0.12 }),
      ];
      if (stage >= 5) {
        parts.push(part(B, 0x6a5230, { y: -0.02, z: -0.34, sx: 0.1, sy: 0.14, sz: 0.3 }));
        parts.push(emit(B, 0xd8c47a, { x: 0.07, y: 0, z: 0, sx: 0.01, sy: 0.06, sz: len * 0.8 }));
      }
      break;
    }

    case 'behemoth':
      parts = [
        part(B, 0x24282e, { y: 0, z: -0.1, sx: 0.3, sy: 0.32, sz: 1.0 }),
        part(C, 0x3a4048, { y: 0.02, z: 0.5, rx: Math.PI / 2, sx: 0.28, sy: 0.8, sz: 0.28 }),
        ...[0, 1, 2, 3, 4, 5].map((i) => part(C, 0x5a6270, {
          x: Math.cos(i * 1.047) * 0.11, y: 0.02 + Math.sin(i * 1.047) * 0.11, z: 0.62,
          rx: Math.PI / 2, sx: 0.07, sy: 0.66, sz: 0.07,
        })),
        part(C, 0x6a7280, { y: 0.28, z: -0.16, rx: Math.PI / 2, sx: 0.46, sy: 0.3, sz: 0.46 }),
        emit(B, 0xff6a2a, { x: 0.16, y: 0.02, z: -0.1, sx: 0.03, sy: 0.1, sz: 0.6 }),
        emit(B, 0xff6a2a, { x: -0.16, y: 0.02, z: -0.1, sx: 0.03, sy: 0.1, sz: 0.6 }),
        part(B, DARK, { y: -0.26, z: -0.4, sx: 0.11, sy: 0.34, sz: 0.2, rx: 0.2 }),
        part(B, 0x24282e, { y: -0.02, z: -0.72, sx: 0.24, sy: 0.28, sz: 0.3 }),
      ];
      break;

    default:
      parts = [part(B, GUNMETAL, { sx: 0.12, sy: 0.16, sz: 0.7 })];
  }

  const g = assemble(parts, { material: 'phong' });
  g.userData.parts = parts;
  return g;
}

/** A shrunken, spinning copy used for the chest slot-machine reel. */
export function buildWeaponIcon(id, weapon) {
  const m = buildWeaponModel(id, weapon);
  m.scale.setScalar(1.0);
  return m;
}
