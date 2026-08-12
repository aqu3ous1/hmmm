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

export function buildEnemyMesh(type) {
  const b = type.build;
  const rig = new THREE.Group();
  const scale = (b.bulk || 1);
  const h = type.height;

  let upper, legL, legR;

  switch (b.shape) {
    case 'humanoid': {
      const torsoH = h * 0.38, legH = h * 0.42, headR = h * 0.13;
      const upperParts = [
        part(B, b.body, { y: legH + torsoH / 2, sx: 0.62 * scale, sy: torsoH, sz: 0.36 * scale }),
        part(B, b.body, { y: legH + torsoH * 0.92, sx: 0.78 * scale, sy: torsoH * 0.28, sz: 0.4 * scale }),
        part(S, b.head, { y: legH + torsoH + headR * 0.9, sx: headR * 2, sy: headR * 2.2, sz: headR * 2 }),
        // arms
        part(B, b.body, { x: 0.42 * scale, y: legH + torsoH * 0.62, z: 0.08, sx: 0.16, sy: torsoH * 0.95, sz: 0.16, rx: -0.5 }),
        part(B, b.body, { x: -0.42 * scale, y: legH + torsoH * 0.62, z: 0.08, sx: 0.16, sy: torsoH * 0.95, sz: 0.16, rx: -0.5 }),
      ];
      const eyeY = legH + torsoH + headR * 0.95;
      upperParts.push(emit(S, b.eye, { x: headR * 0.42, y: eyeY, z: headR * 0.85, sx: 0.1, sy: 0.1, sz: 0.06 }));
      upperParts.push(emit(S, b.eye, { x: -headR * 0.42, y: eyeY, z: headR * 0.85, sx: 0.1, sy: 0.1, sz: 0.06 }));
      if (b.chrome) upperParts.push(emit(B, b.eye, { y: legH + torsoH * 0.5, z: 0.19 * scale, sx: 0.22, sy: 0.06, sz: 0.02 }));
      if (b.neon) {
        upperParts.push(emit(B, b.neon, { x: 0.33 * scale, y: legH + torsoH * 0.7, z: 0.19, sx: 0.05, sy: torsoH * 0.7, sz: 0.02 }));
        upperParts.push(emit(B, b.neon, { x: -0.33 * scale, y: legH + torsoH * 0.7, z: 0.19, sx: 0.05, sy: torsoH * 0.7, sz: 0.02 }));
      }
      if (b.ember) {
        for (let i = 0; i < 4; i++) {
          upperParts.push(emit(IC, 0xff6a2a, {
            x: (Math.random() - 0.5) * 0.6, y: legH + torsoH * Math.random(), z: (Math.random() - 0.5) * 0.4,
            sx: 0.09, sy: 0.09, sz: 0.09,
          }));
        }
      }
      upper = assemble(upperParts);
      legL = assemble([part(B, b.body, { x: 0.17 * scale, y: -legH / 2, sx: 0.2, sy: legH, sz: 0.2 })]);
      legR = assemble([part(B, b.body, { x: -0.17 * scale, y: -legH / 2, sx: 0.2, sy: legH, sz: 0.2 })]);
      legL.position.y = legH;
      legR.position.y = legH;
      rig.userData.legPivot = legH;
      break;
    }

    case 'blob': {
      const bulge = b.bulge || 1.2;
      upper = assemble([
        part(S, b.body, { y: h * 0.5, sx: h * 0.62 * bulge, sy: h * 0.62, sz: h * 0.58 * bulge }),
        part(S, b.head, { y: h * 0.84, sx: h * 0.3, sy: h * 0.3, sz: h * 0.3 }),
        emit(S, b.eye, { x: h * 0.08, y: h * 0.88, z: h * 0.15, sx: 0.13, sy: 0.13, sz: 0.08 }),
        emit(S, b.eye, { x: -h * 0.08, y: h * 0.88, z: h * 0.15, sx: 0.13, sy: 0.13, sz: 0.08 }),
      ]);
      legL = assemble([part(C, b.body, { x: h * 0.16, y: -h * 0.09, sx: 0.2, sy: h * 0.2, sz: 0.2 })]);
      legR = assemble([part(C, b.body, { x: -h * 0.16, y: -h * 0.09, sx: 0.2, sy: h * 0.2, sz: 0.2 })]);
      legL.position.y = h * 0.2; legR.position.y = h * 0.2;
      rig.userData.legPivot = h * 0.2;
      break;
    }

    case 'quad': {
      upper = assemble([
        part(B, b.body, { y: h * 0.6, sx: 0.55, sy: 0.44, sz: 1.15 }),
        part(S, b.head, { y: h * 0.68, z: 0.62, sx: 0.44, sy: 0.42, sz: 0.5 }),
        emit(S, b.eye, { x: 0.14, y: h * 0.74, z: 0.82, sx: 0.11, sy: 0.11, sz: 0.06 }),
        emit(S, b.eye, { x: -0.14, y: h * 0.74, z: 0.82, sx: 0.11, sy: 0.11, sz: 0.06 }),
        ...(b.fin ? [part(CN, b.head, { y: h * 0.88, z: -0.1, rx: 0, sx: 0.3, sy: 0.6, sz: 0.1 })] : []),
      ]);
      legL = assemble([
        part(B, b.body, { x: 0.26, y: -h * 0.28, z: 0.38, sx: 0.15, sy: h * 0.56, sz: 0.15 }),
        part(B, b.body, { x: 0.26, y: -h * 0.28, z: -0.38, sx: 0.15, sy: h * 0.56, sz: 0.15 }),
      ]);
      legR = assemble([
        part(B, b.body, { x: -0.26, y: -h * 0.28, z: 0.38, sx: 0.15, sy: h * 0.56, sz: 0.15 }),
        part(B, b.body, { x: -0.26, y: -h * 0.28, z: -0.38, sx: 0.15, sy: h * 0.56, sz: 0.15 }),
      ]);
      legL.position.y = h * 0.56; legR.position.y = h * 0.56;
      rig.userData.legPivot = h * 0.56;
      break;
    }

    case 'drone': {
      upper = assemble([
        part(OC, b.body, { y: h, sx: 0.8, sy: 0.7, sz: 0.8 }),
        emit(S, b.eye, { y: h, z: 0.34, sx: 0.26, sy: 0.26, sz: 0.16 }),
        part(B, b.body, { y: h + 0.3, sx: 1.5, sy: 0.06, sz: 0.12 }),
        part(B, b.body, { y: h + 0.3, sx: 0.12, sy: 0.06, sz: 1.5 }),
        emit(S, b.eye, { x: 0.72, y: h + 0.3, sx: 0.14, sy: 0.1, sz: 0.14 }),
        emit(S, b.eye, { x: -0.72, y: h + 0.3, sx: 0.14, sy: 0.1, sz: 0.14 }),
      ]);
      legL = new THREE.Group(); legR = new THREE.Group();
      rig.userData.legPivot = 0;
      rig.userData.flying = true;
      break;
    }

    case 'turret': {
      upper = assemble([
        part(C, b.body, { y: 0.22, sx: 1.1, sy: 0.44, sz: 1.1 }),
        part(B, b.body, { y: 0.72, sx: 0.62, sy: 0.66, sz: 0.62 }),
        part(C, 0x2a2a30, { y: 0.8, z: 0.5, rx: Math.PI / 2, sx: 0.2, sy: 0.9, sz: 0.2 }),
        emit(S, b.eye, { y: 0.95, z: 0.3, sx: 0.2, sy: 0.14, sz: 0.14 }),
      ]);
      legL = new THREE.Group(); legR = new THREE.Group();
      rig.userData.legPivot = 0;
      break;
    }

    default:
      upper = assemble([part(B, b.body, { y: h / 2, sx: 0.6, sy: h, sz: 0.6 })]);
      legL = new THREE.Group(); legR = new THREE.Group();
      rig.userData.legPivot = 0;
  }

  if (b.ghost !== undefined) {
    upper.traverse((o) => {
      if (o.material) { o.material.transparent = true; o.material.opacity = b.ghost; }
    });
  }

  rig.add(upper, legL, legR);
  rig.userData.upper = upper;
  rig.userData.legL = legL;
  rig.userData.legR = legR;
  rig.userData.glitch = !!b.glitch;
  return rig;
}

// ---------------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------------

export function buildBossMesh(def) {
  const b = def.build;
  const g = new THREE.Group();
  const h = def.height;
  let parts = [];

  switch (b.shape) {
    case 'king':
      parts = [
        part(B, b.body, { y: h * 0.45, sx: 2.0, sy: h * 0.5, sz: 1.2 }),
        part(B, b.body, { y: h * 0.14, sx: 1.5, sy: h * 0.3, sz: 1.0 }),
        part(S, b.body, { y: h * 0.82, sx: 1.0, sy: 1.1, sz: 1.0 }),
        // crown
        part(C, b.accent, { y: h * 0.99, sx: 1.0, sy: 0.24, sz: 1.0 }),
        ...[0, 1, 2, 3, 4].map((i) => part(CN, b.accent, {
          x: Math.cos(i * 1.256) * 0.45, y: h * 1.08, z: Math.sin(i * 1.256) * 0.45,
          sx: 0.22, sy: 0.5, sz: 0.22,
        })),
        emit(S, b.eye, { x: 0.28, y: h * 0.85, z: 0.44, sx: 0.2, sy: 0.2, sz: 0.1 }),
        emit(S, b.eye, { x: -0.28, y: h * 0.85, z: 0.44, sx: 0.2, sy: 0.2, sz: 0.1 }),
        part(B, b.body, { x: 1.25, y: h * 0.48, sx: 0.4, sy: h * 0.46, sz: 0.4, rz: 0.25 }),
        part(B, b.body, { x: -1.25, y: h * 0.48, sx: 0.4, sy: h * 0.46, sz: 0.4, rz: -0.25 }),
        part(B, b.body, { x: 0.45, y: h * 0.12, sx: 0.4, sy: h * 0.26, sz: 0.4 }),
        part(B, b.body, { x: -0.45, y: h * 0.12, sx: 0.4, sy: h * 0.26, sz: 0.4 }),
        emit(B, b.accent, { y: h * 0.5, z: 0.62, sx: 1.2, sy: 0.08, sz: 0.04 }),
      ];
      break;

    case 'croc':
      parts = [
        part(B, b.body, { y: h * 0.5, sx: 1.5, sy: h * 0.42, sz: 2.4 }),
        part(B, b.body, { y: h * 0.56, z: 1.7, sx: 1.0, sy: 0.55, sz: 1.6 }),
        part(B, b.accent, { y: h * 0.4, z: 1.8, sx: 0.92, sy: 0.22, sz: 1.5 }),
        emit(S, b.eye, { x: 0.34, y: h * 0.72, z: 1.2, sx: 0.28, sy: 0.28, sz: 0.28 }),
        emit(S, b.eye, { x: -0.34, y: h * 0.72, z: 1.2, sx: 0.28, sy: 0.28, sz: 0.28 }),
        ...Array.from({ length: 7 }, (_, i) => part(CN, b.accent, {
          y: h * 0.78, z: -1.0 + i * 0.42, sx: 0.28, sy: 0.5, sz: 0.28,
        })),
        part(B, b.body, { y: h * 0.34, z: -2.0, sx: 0.7, sy: 0.5, sz: 1.4 }),
        part(B, b.body, { x: 0.85, y: h * 0.22, z: 0.6, sx: 0.34, sy: h * 0.4, sz: 0.34 }),
        part(B, b.body, { x: -0.85, y: h * 0.22, z: 0.6, sx: 0.34, sy: h * 0.4, sz: 0.34 }),
        part(B, b.body, { x: 0.85, y: h * 0.22, z: -0.8, sx: 0.34, sy: h * 0.4, sz: 0.34 }),
        part(B, b.body, { x: -0.85, y: h * 0.22, z: -0.8, sx: 0.34, sy: h * 0.4, sz: 0.34 }),
      ];
      break;

    case 'gunslinger':
      parts = [
        part(B, b.body, { y: h * 0.55, sx: 0.9, sy: h * 0.4, sz: 0.5 }),
        part(S, 0xe8c9a0, { y: h * 0.84, sx: 0.5, sy: 0.55, sz: 0.5 }),
        part(C, b.body, { y: h * 0.97, sx: 0.62, sy: 0.34, sz: 0.62 }),
        part(C, b.body, { y: h * 0.9, sx: 1.6, sy: 0.07, sz: 1.6 }),
        emit(B, b.eye, { y: h * 0.86, z: 0.24, sx: 0.4, sy: 0.05, sz: 0.02 }),
        emit(B, b.accent, { y: h * 0.62, z: 0.27, sx: 0.6, sy: 0.1, sz: 0.02 }),
        part(B, 0x2a2a30, { x: 0.62, y: h * 0.52, z: 0.2, sx: 0.16, sy: 0.16, sz: 0.7, rx: 0.2 }),
        part(B, 0x2a2a30, { x: -0.62, y: h * 0.52, z: 0.2, sx: 0.16, sy: 0.16, sz: 0.7, rx: 0.2 }),
        part(B, b.body, { x: 0.28, y: h * 0.18, sx: 0.26, sy: h * 0.36, sz: 0.26 }),
        part(B, b.body, { x: -0.28, y: h * 0.18, sx: 0.26, sy: h * 0.36, sz: 0.26 }),
        emit(B, b.accent, { x: 0.5, y: h * 0.55, sx: 0.06, sy: h * 0.3, sz: 0.06 }),
        emit(B, b.accent, { x: -0.5, y: h * 0.55, sx: 0.06, sy: h * 0.3, sz: 0.06 }),
      ];
      break;

    case 'fishkid':
      parts = [
        part(B, b.body, { y: h * 0.42, sx: 0.75, sy: h * 0.38, sz: 0.45 }),
        part(S, 0xbfe8f0, { y: h * 0.78, sx: 0.95, sy: 0.95, sz: 0.95, opacity: 0.45 }),
        part(S, b.accent, { y: h * 0.76, sx: 0.55, sy: 0.55, sz: 0.55 }),
        emit(S, b.eye, { x: 0.16, y: h * 0.79, z: 0.24, sx: 0.16, sy: 0.16, sz: 0.1 }),
        emit(S, b.eye, { x: -0.16, y: h * 0.79, z: 0.24, sx: 0.16, sy: 0.16, sz: 0.1 }),
        part(C, 0x88a0aa, { y: h * 0.55, sx: 0.5, sy: 0.12, sz: 0.5 }),
        part(B, b.body, { x: 0.5, y: h * 0.44, sx: 0.18, sy: h * 0.34, sz: 0.18, rz: 0.3 }),
        part(B, b.body, { x: -0.5, y: h * 0.44, sx: 0.18, sy: h * 0.34, sz: 0.18, rz: -0.3 }),
        part(B, b.body, { x: 0.2, y: h * 0.12, sx: 0.2, sy: h * 0.26, sz: 0.2 }),
        part(B, b.body, { x: -0.2, y: h * 0.12, sx: 0.2, sy: h * 0.26, sz: 0.2 }),
        part(CN, b.accent, { y: h * 0.42, z: -0.4, rx: Math.PI / 2, sx: 0.7, sy: 0.6, sz: 0.1 }),
      ];
      break;

    case 'custodian':
      parts = [
        part(B, b.body, { y: h * 0.48, sx: 1.5, sy: h * 0.46, sz: 0.9 }),
        part(B, b.body, { y: h * 0.76, sx: 1.1, sy: h * 0.14, sz: 0.8 }),
        part(S, 0x1a1410, { y: h * 0.9, sx: 0.7, sy: 0.75, sz: 0.7 }),
        emit(B, b.eye, { y: h * 0.9, z: 0.34, sx: 0.5, sy: 0.08, sz: 0.02 }),
        ...Array.from({ length: 5 }, (_, i) => emit(IC, b.accent, {
          x: (i - 2) * 0.32, y: h * 0.5 + Math.sin(i) * 0.2, z: 0.48, sx: 0.16, sy: 0.16, sz: 0.16,
        })),
        part(B, b.body, { x: 0.95, y: h * 0.5, sx: 0.34, sy: h * 0.44, sz: 0.34 }),
        part(B, b.body, { x: -0.95, y: h * 0.5, sx: 0.34, sy: h * 0.44, sz: 0.34 }),
        part(C, 0x6a5a48, { x: 1.15, y: h * 0.4, z: 0.3, sx: 0.12, sy: h * 0.9, sz: 0.12, rz: 0.2 }),
        part(B, 0x9a8a70, { x: 1.35, y: h * 0.02, z: 0.3, sx: 0.7, sy: 0.16, sz: 0.5 }),
        part(B, b.body, { x: 0.4, y: h * 0.13, sx: 0.36, sy: h * 0.28, sz: 0.36 }),
        part(B, b.body, { x: -0.4, y: h * 0.13, sx: 0.36, sy: h * 0.28, sz: 0.36 }),
      ];
      break;

    case 'tester':
      parts = [
        part(B, b.body, { y: h * 0.55, sx: 0.8, sy: h * 0.4, sz: 0.44 }),
        part(S, b.accent, { y: h * 0.85, sx: 0.5, sy: 0.54, sz: 0.5 }),
        emit(B, b.eye, { y: h * 0.86, z: 0.25, sx: 0.36, sy: 0.07, sz: 0.02 }),
        emit(B, b.accent, { y: h * 0.6, z: 0.24, sx: 0.3, sy: 0.16, sz: 0.02 }),
        part(B, b.body, { x: 0.52, y: h * 0.56, sx: 0.18, sy: h * 0.36, sz: 0.18 }),
        part(B, b.body, { x: -0.52, y: h * 0.56, sx: 0.18, sy: h * 0.36, sz: 0.18 }),
        part(B, b.body, { x: 0.2, y: h * 0.17, sx: 0.22, sy: h * 0.34, sz: 0.22 }),
        part(B, b.body, { x: -0.2, y: h * 0.17, sx: 0.22, sy: h * 0.34, sz: 0.22 }),
        part(B, 0x2a2a30, { x: 0.62, y: h * 0.5, z: 0.34, sx: 0.14, sy: 0.14, sz: 0.9 }),
      ];
      break;

    case 'motherboard':
      parts = [
        part(B, b.body, { y: h * 0.5, sx: 4.4, sy: h * 0.9, sz: 0.7 }),
        emit(B, b.accent, { y: h * 0.5, z: 0.38, sx: 4.0, sy: h * 0.8, sz: 0.03, opacity: 0.25 }),
        ...Array.from({ length: 12 }, (_, i) => emit(B, b.accent, {
          x: -1.9 + (i % 6) * 0.76, y: h * (0.25 + Math.floor(i / 6) * 0.36), z: 0.4,
          sx: 0.5, sy: 0.28, sz: 0.05,
        })),
        ...Array.from({ length: 8 }, (_, i) => emit(B, b.eye, {
          x: -2.0 + i * 0.57, y: h * 0.72, z: 0.42, sx: 0.05, sy: 0.5, sz: 0.03,
        })),
        emit(S, b.eye, { y: h * 0.55, z: 0.5, sx: 0.9, sy: 0.9, sz: 0.4 }),
        part(C, b.body, { x: 2.4, y: h * 0.45, sx: 0.5, sy: h * 0.85, sz: 0.5 }),
        part(C, b.body, { x: -2.4, y: h * 0.45, sx: 0.5, sy: h * 0.85, sz: 0.5 }),
      ];
      break;

    case 'gorbus':
      parts = [
        part(S, b.body, { y: h * 0.5, sx: 2.4, sy: h * 0.62, sz: 2.0 }),
        part(S, b.body, { y: h * 0.86, sx: 1.3, sy: 1.1, sz: 1.2 }),
        emit(S, b.eye, { x: 0.4, y: h * 0.92, z: 0.55, sx: 0.34, sy: 0.34, sz: 0.2 }),
        emit(S, b.eye, { x: -0.4, y: h * 0.92, z: 0.55, sx: 0.34, sy: 0.34, sz: 0.2 }),
        emit(S, b.eye, { y: h * 1.02, z: 0.5, sx: 0.22, sy: 0.22, sz: 0.14 }),
        ...Array.from({ length: 9 }, (_, i) => emit(IC, b.accent, {
          x: Math.cos(i * 0.7) * 1.2, y: h * (0.3 + (i % 3) * 0.2), z: Math.sin(i * 0.7) * 1.0,
          sx: 0.35, sy: 0.35, sz: 0.35,
        })),
        part(C, b.body, { x: 0.7, y: h * 0.12, sx: 0.5, sy: h * 0.28, sz: 0.5 }),
        part(C, b.body, { x: -0.7, y: h * 0.12, sx: 0.5, sy: h * 0.28, sz: 0.5 }),
        part(B, b.body, { x: 1.7, y: h * 0.5, sx: 0.42, sy: h * 0.4, sz: 0.42, rz: 0.4 }),
        part(B, b.body, { x: -1.7, y: h * 0.5, sx: 0.42, sy: h * 0.4, sz: 0.42, rz: -0.4 }),
      ];
      break;

    case 'warden':
      parts = [
        part(B, b.body, { y: h * 0.42, sx: 2.2, sy: h * 0.5, sz: 1.4 }),
        part(B, b.accent, { y: h * 0.68, sx: 2.5, sy: 0.12, sz: 1.6 }),
        part(C, b.body, { y: h * 0.85, sx: 1.3, sy: h * 0.3, sz: 1.3 }),
        emit(UNIT.torus, b.eye, { y: h * 0.86, z: 0.6, rx: 0, sx: 1.1, sy: 1.1, sz: 1.1 }),
        emit(S, b.eye, { y: h * 0.86, z: 0.62, sx: 0.4, sy: 0.4, sz: 0.2 }),
        ...Array.from({ length: 6 }, (_, i) => emit(B, b.accent, {
          x: -1.0 + i * 0.4, y: h * 0.42, z: 0.72, sx: 0.1, sy: h * 0.36, sz: 0.03,
        })),
        part(B, b.body, { x: 1.5, y: h * 0.45, sx: 0.5, sy: h * 0.5, sz: 0.5, rz: 0.15 }),
        part(B, b.body, { x: -1.5, y: h * 0.45, sx: 0.5, sy: h * 0.5, sz: 0.5, rz: -0.15 }),
        part(B, b.body, { y: h * 0.09, sx: 1.8, sy: h * 0.18, sz: 1.2 }),
        emit(UNIT.torus, b.accent, { y: h * 1.1, rx: Math.PI / 2, sx: 2.4, sy: 2.4, sz: 2.4 }),
      ];
      break;

    case 'alien':
    case 'alien2': {
      const tall = b.shape === 'alien';
      parts = [
        part(B, b.body, { y: h * 0.5, sx: tall ? 0.7 : 1.05, sy: h * 0.42, sz: tall ? 0.44 : 0.62 }),
        part(S, b.body, { y: h * 0.84, sx: tall ? 0.85 : 1.15, sy: tall ? 1.0 : 0.85, sz: 0.8 }),
        // Synar has two big eyes; Gwynak famously has eleven.
        ...(tall
          ? [
            emit(S, b.eye, { x: 0.24, y: h * 0.86, z: 0.34, sx: 0.3, sy: 0.42, sz: 0.16 }),
            emit(S, b.eye, { x: -0.24, y: h * 0.86, z: 0.34, sx: 0.3, sy: 0.42, sz: 0.16 }),
          ]
          : Array.from({ length: 11 }, (_, i) => {
            const a = i * 0.571;
            return emit(S, b.eye, {
              x: Math.cos(a) * 0.36, y: h * 0.84 + Math.sin(a) * 0.26, z: 0.42,
              sx: 0.15, sy: 0.15, sz: 0.1,
            });
          })),
        emit(B, b.accent, { y: h * 0.55, z: 0.24, sx: 0.34, sy: 0.05, sz: 0.02 }),
        part(B, b.body, { x: tall ? 0.5 : 0.72, y: h * 0.52, sx: 0.15, sy: h * 0.42, sz: 0.15, rz: 0.16 }),
        part(B, b.body, { x: tall ? -0.5 : -0.72, y: h * 0.52, sx: 0.15, sy: h * 0.42, sz: 0.15, rz: -0.16 }),
        part(B, b.body, { x: 0.2, y: h * 0.15, sx: 0.2, sy: h * 0.3, sz: 0.2 }),
        part(B, b.body, { x: -0.2, y: h * 0.15, sx: 0.2, sy: h * 0.3, sz: 0.2 }),
        ...(tall
          ? [part(CN, b.accent, { y: h * 1.08, sx: 0.2, sy: 0.5, sz: 0.2 })]
          : [
            part(CN, b.accent, { x: 0.3, y: h * 1.02, rz: 0.3, sx: 0.16, sy: 0.4, sz: 0.16 }),
            part(CN, b.accent, { x: -0.3, y: h * 1.02, rz: -0.3, sx: 0.16, sy: 0.4, sz: 0.16 }),
          ]),
      ];
      break;
    }

    case 'gelatin':
      parts = [
        part(S, b.body, { y: h * 0.46, sx: 1.7, sy: h * 0.52, sz: 1.3, opacity: 0.78 }),
        part(S, b.body, { y: h * 0.82, sx: 1.0, sy: 0.95, sz: 0.95, opacity: 0.78 }),
        part(B, 0x2a1a20, { y: h * 0.5, sx: 1.4, sy: h * 0.3, sz: 0.24 }),
        emit(S, b.eye, { x: 0.24, y: h * 0.86, z: 0.4, sx: 0.2, sy: 0.24, sz: 0.12 }),
        emit(S, b.eye, { x: -0.24, y: h * 0.86, z: 0.4, sx: 0.2, sy: 0.24, sz: 0.12 }),
        // Long, drooping fingers — the whole point of him.
        ...Array.from({ length: 10 }, (_, i) => {
          const side = i < 5 ? 1 : -1;
          const k = i % 5;
          return part(C, b.accent, {
            x: side * (0.95 + k * 0.09), y: h * 0.34 - k * 0.06, z: 0.1 + k * 0.11,
            rx: 0.2, rz: side * 0.12,
            sx: 0.12, sy: h * (0.5 - k * 0.045), sz: 0.12,
            opacity: 0.85,
          });
        }),
        part(B, b.body, { x: 0.95, y: h * 0.6, sx: 0.34, sy: h * 0.34, sz: 0.34, opacity: 0.8 }),
        part(B, b.body, { x: -0.95, y: h * 0.6, sx: 0.34, sy: h * 0.34, sz: 0.34, opacity: 0.8 }),
        part(C, b.body, { x: 0.36, y: h * 0.12, sx: 0.4, sy: h * 0.26, sz: 0.4, opacity: 0.8 }),
        part(C, b.body, { x: -0.36, y: h * 0.12, sx: 0.4, sy: h * 0.26, sz: 0.4, opacity: 0.8 }),
      ];
      break;

    case 'root':
      parts = [
        part(OC, b.body, { y: h * 0.55, sx: 2.6, sy: 2.8, sz: 2.6 }),
        emit(UNIT.icosa, b.eye, { y: h * 0.55, sx: 1.5, sy: 1.5, sz: 1.5, opacity: 0.5 }),
        emit(S, b.accent, { y: h * 0.55, sx: 0.7, sy: 0.7, sz: 0.7 }),
        ...Array.from({ length: 10 }, (_, i) => {
          const a = i * 0.628;
          return emit(B, b.eye, {
            x: Math.cos(a) * 2.1, y: h * (0.3 + (i % 4) * 0.18), z: Math.sin(a) * 2.1,
            ry: -a, sx: 0.7, sy: 0.06, sz: 0.06,
          });
        }),
        emit(UNIT.torus, b.eye, { y: h * 0.55, rx: Math.PI / 2, sx: 3.6, sy: 3.6, sz: 3.6 }),
        emit(UNIT.torus, b.accent, { y: h * 0.55, rx: 0, sx: 3.2, sy: 3.2, sz: 3.2 }),
      ];
      break;

    default:
      parts = [part(B, b.body, { y: h / 2, sx: 2, sy: h, sz: 2 })];
  }

  const mesh = assemble(parts);
  g.add(mesh);
  g.userData.upper = mesh;
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
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.5, 3.5, 20, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
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
