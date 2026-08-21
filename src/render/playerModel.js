// Michael Sandlor, seen from outside.
//
// The third-person camera needed a body, and a body is not a placeholder
// capsule — it is the first time in the whole game the player sees who they
// have been. So it is the same person the viewmodel has been showing them all
// along: the same laundered surgical gown, the same admissions band, the same
// cannula still taped into the back of the left hand. Bare feet, because
// nobody gave him shoes.
//
// Albedos here are *not* the ones in hands.js. Those are tuned against the
// viewmodel's own three-light rig, which is aimed at near-black gunmetal and
// runs about two and a half times hot; the world is lit normally and needs
// honest mid-tones. Same character, two exposures.

import * as THREE from '../../vendor/three.module.js';
import { UNIT, assemble } from '../world/geometry.js';
import { PLAYER_HEIGHT } from '../entities/player.js';

const BB = UNIT.bevelBox, SL = UNIT.slab, SP = UNIT.lowSphere;
const CY = UNIT.cyl, TP = UNIT.taper, B = UNIT.box;

const SKIN = 0xb2896d;
const SKIN_DK = 0x8f6a53;
const HAIR = 0x3a2c24;
const GOWN = 0x6f93a6;
const GOWN_DK = 0x50707f;
const GOWN_HI = 0x87a8b8;
const BAND = 0xd8d4c8;
const BAND_INK = 0x9a2f5c;
const TAPE = 0xd6c9ad;
const EYE = 0x1d2226;

const FLESH = { metal: 0, rough: 0.7, smooth: true };
const CLOTH = { metal: 0, rough: 0.94 };
const TRIM = { metal: 0, rough: 0.5, smooth: true };

const pt = (geo, color, mat, o = {}) => ({ geo, color, ...mat, ...o });

/**
 * One limb segment with a joint bead at its root, angled from an origin.
 *
 * Everything on this body is built this way rather than as a stack of boxes,
 * because at third-person distance the only thing that separates a person from
 * a coat rack is that their limbs bend somewhere and are round where they bend.
 */
function segment(out, { x, y, z, len, w, color, mat, pitch = 0, roll = 0, bead = true }) {
  const cy = y - Math.cos(pitch) * len * 0.5;
  const cz = z + Math.sin(pitch) * len * 0.5;
  out.push(pt(BB, color, mat, {
    x: x + Math.sin(roll) * len * 0.5, y: cy, z: cz,
    rx: pitch, rz: roll,
    sx: w, sy: len, sz: w * 0.94,
  }));
  if (bead) out.push(pt(SP, color, mat, { x, y, z, sx: w * 1.05, sy: w * 1.05, sz: w * 1.05 }));
  return {
    x: x + Math.sin(roll) * len,
    y: y - Math.cos(pitch) * len,
    z: z + Math.sin(pitch) * len,
  };
}

/** The head, built once and reused by every stance. */
function headParts() {
  const out = [];
  out.push(pt(BB, SKIN, FLESH, { y: 0, sx: 0.20, sy: 0.24, sz: 0.21 }));
  // Jaw and brow, so the skull is not a die.
  out.push(pt(BB, SKIN_DK, FLESH, { y: -0.09, z: 0.015, sx: 0.175, sy: 0.085, sz: 0.19 }));
  out.push(pt(SL, SKIN_DK, FLESH, { y: 0.055, z: 0.098, sx: 0.175, sy: 0.028, sz: 0.03 }));
  // Hair: a flat cap plus a fringe, cut by somebody who was not a barber.
  out.push(pt(BB, HAIR, CLOTH, { y: 0.10, z: -0.012, sx: 0.212, sy: 0.075, sz: 0.222 }));
  out.push(pt(SL, HAIR, CLOTH, { y: 0.075, z: 0.10, sx: 0.20, sy: 0.055, sz: 0.03 }));
  out.push(pt(SL, HAIR, CLOTH, { x: 0.104, y: 0.04, sx: 0.02, sy: 0.10, sz: 0.19 }));
  out.push(pt(SL, HAIR, CLOTH, { x: -0.104, y: 0.04, sx: 0.02, sy: 0.10, sz: 0.19 }));
  // Eyes, set deep enough to catch a shadow.
  for (const s of [1, -1]) {
    out.push(pt(SL, EYE, TRIM, { x: s * 0.048, y: 0.02, z: 0.101, sx: 0.042, sy: 0.026, sz: 0.014 }));
  }
  // Ears and a nose. Three parts, and without them the head reads as a prop.
  for (const s of [1, -1]) {
    out.push(pt(SP, SKIN, FLESH, { x: s * 0.104, y: -0.005, z: -0.01, sx: 0.03, sy: 0.055, sz: 0.045 }));
  }
  out.push(pt(BB, SKIN, FLESH, { y: -0.015, z: 0.105, sx: 0.035, sy: 0.055, sz: 0.04 }));
  // A monitoring electrode still stuck to his temple, wire trailing.
  out.push(pt(SL, TAPE, CLOTH, { x: -0.086, y: 0.055, z: 0.03, rz: 0.3, sx: 0.03, sy: 0.03, sz: 0.012 }));
  out.push(pt(CY, GOWN_DK, TRIM, { x: -0.10, y: 0.02, z: 0.01, rz: 0.5, rx: 0.4, sx: 0.008, sy: 0.09, sz: 0.008 }));
  return out;
}

/**
 * Build the player rig.
 *
 * Returns a Group whose userData exposes the pieces the animator drives. The
 * split is the same one the enemies use — torso, head, two arms, two legs —
 * so the same walk-cycle thinking applies and there is one fewer idea in the
 * codebase.
 */
export function buildPlayerModel() {
  const rig = new THREE.Group();
  // Everything hangs off an inner group so the outer one is free for the
  // controller to position and for the prone pose to rotate. The inner group
  // also carries the correction below.
  const stack = new THREE.Group();
  rig.add(stack);

  // --- torso ------------------------------------------------------------
  // The gown is a smock: wide at the shoulders, loose at the hem, open at the
  // back. The open back is the detail that makes it a hospital gown rather
  // than a shirt, and it is the one you see most in third person.
  const torso = [];
  torso.push(pt(BB, GOWN, CLOTH, { y: 0.30, sx: 0.40, sy: 0.40, sz: 0.24 }));
  // Shoulder yoke. Narrow: the first pass made it wider than the chest and he
  // came out looking like he was wearing shoulder pads under the gown.
  torso.push(pt(BB, GOWN_HI, CLOTH, { y: 0.50, sx: 0.425, sy: 0.13, sz: 0.245 }));
  // Hem. Barely flared — a full taper reads as a bell and this is a smock, not
  // a dress.
  torso.push(pt(TP, GOWN, CLOTH, { y: 0.07, rx: Math.PI, sx: 0.415, sy: 0.22, sz: 0.255 }));
  torso.push(pt(SL, GOWN_DK, CLOTH, { y: -0.04, sx: 0.425, sy: 0.03, sz: 0.265 }));
  // The open back: two panels with a real gap between them and bare skin
  // showing through it, with the tie strings crossing.
  //
  // The depths matter and were wrong first time round. The torso's own back
  // face is at z -0.12, so a skin strip *behind* that plane is the only way it
  // is visible at all — put it in front and the gown simply covers it, which
  // is what happened: the whole back read as one dark slab and the single
  // detail that says "hospital" rather than "shirt" was invisible.
  torso.push(pt(SL, SKIN_DK, FLESH, { y: 0.30, z: -0.128, sx: 0.10, sy: 0.42, sz: 0.02 }));
  torso.push(pt(SL, GOWN_DK, CLOTH, { x: 0.125, y: 0.30, z: -0.138, sx: 0.17, sy: 0.42, sz: 0.03 }));
  torso.push(pt(SL, GOWN_DK, CLOTH, { x: -0.125, y: 0.30, z: -0.138, sx: 0.17, sy: 0.42, sz: 0.03 }));
  for (const y of [0.44, 0.20]) {
    torso.push(pt(B, GOWN_HI, CLOTH, { y, z: -0.152, rz: 0.5, sx: 0.20, sy: 0.012, sz: 0.012 }));
    torso.push(pt(B, GOWN_HI, CLOTH, { y, z: -0.152, rz: -0.5, sx: 0.20, sy: 0.012, sz: 0.012 }));
  }
  // Collar and neck.
  torso.push(pt(CY, GOWN_HI, CLOTH, { y: 0.575, sx: 0.20, sy: 0.05, sz: 0.20 }));
  torso.push(pt(CY, SKIN_DK, FLESH, { y: 0.625, sx: 0.115, sy: 0.10, sz: 0.115 }));
  // A patient number stencilled on the chest, because of course there is one.
  torso.push(pt(SL, GOWN_DK, CLOTH, { y: 0.40, z: 0.129, sx: 0.13, sy: 0.05, sz: 0.006 }));

  const body = assemble(torso);
  const head = assemble(headParts());
  head.position.y = 0.80;
  stack.add(body, head);

  // --- arms -------------------------------------------------------------
  // Built pointing straight down from the shoulder; the animator rotates the
  // whole group, so the rest pose has to be the neutral one.
  const arm = (side) => {
    const out = [];
    const S = side;
    // Short gown sleeve, then bare forearm.
    out.push(pt(TP, GOWN, CLOTH, { y: -0.09, sx: 0.155, sy: 0.20, sz: 0.155 }));
    out.push(pt(SP, GOWN_HI, CLOTH, { y: 0.015, sx: 0.17, sy: 0.15, sz: 0.17 }));
    const elbow = segment(out, {
      x: 0, y: -0.19, z: 0, len: 0.20, w: 0.098,
      color: SKIN, mat: FLESH, bead: false,
    });
    segment(out, {
      x: elbow.x, y: elbow.y, z: elbow.z, len: 0.20, w: 0.088,
      color: SKIN, mat: FLESH,
    });
    // Fist at the end. Nobody counts fingers at this distance; they do notice
    // an arm that stops in a flat plane.
    out.push(pt(BB, SKIN, FLESH, { y: -0.435, sx: 0.10, sy: 0.11, sz: 0.095 }));
    out.push(pt(SP, SKIN_DK, FLESH, { y: -0.475, sx: 0.085, sy: 0.07, sz: 0.09 }));
    if (S < 0) {
      // Admissions band and the cut cannula, on the same wrist as the
      // viewmodel puts them. Continuity is the whole point of a third-person
      // body in a first-person game.
      out.push(pt(CY, BAND, TRIM, { y: -0.375, sx: 0.104, sy: 0.028, sz: 0.104 }));
      out.push(pt(SL, BAND_INK, TRIM, { x: -0.05, y: -0.375, sx: 0.012, sy: 0.03, sz: 0.03 }));
      out.push(pt(SL, TAPE, CLOTH, { y: -0.43, z: 0.05, sx: 0.06, sy: 0.05, sz: 0.012 }));
      out.push(pt(CY, GOWN_DK, TRIM, { y: -0.40, z: 0.075, rx: 0.7, sx: 0.012, sy: 0.10, sz: 0.012 }));
    }
    const g = assemble(out);
    g.position.set(S * 0.228, 0.545, 0);
    return g;
  };
  const armL = arm(-1);
  const armR = arm(1);
  stack.add(armL, armR);

  // --- legs -------------------------------------------------------------
  // The knee is a real joint, not a bend baked into one mesh.
  //
  // It was one group first, and a crouch then folded only at the hip: both
  // shins swung out straight in front of him and he read as sitting on an
  // invisible chair. A shin that stays under the body is the entire difference
  // between crouching and sitting down, and it costs one extra group per leg
  // on the only model in the game there is exactly one of.
  const leg = (side) => {
    const thigh = [];
    segment(thigh, { x: 0, y: 0, z: 0, len: 0.30, w: 0.135, color: SKIN, mat: FLESH, bead: false });
    thigh.push(pt(SP, SKIN, FLESH, { y: -0.30, sx: 0.128, sy: 0.128, sz: 0.128 }));

    const shin = [];
    segment(shin, { x: 0, y: 0, z: 0, len: 0.28, w: 0.115, color: SKIN, mat: FLESH, bead: false });
    // Bare foot. He was not given shoes, and the soles are filthy.
    shin.push(pt(BB, SKIN, FLESH, { y: -0.30, z: 0.05, sx: 0.115, sy: 0.075, sz: 0.235 }));
    shin.push(pt(SL, 0x4a3c34, FLESH, { y: -0.334, z: 0.05, sx: 0.108, sy: 0.02, sz: 0.225 }));
    for (let i = 0; i < 4; i++) {
      shin.push(pt(SP, SKIN, FLESH, {
        x: (i - 1.5) * 0.026 * side, y: -0.30, z: 0.163,
        sx: 0.024, sy: 0.024, sz: 0.028,
      }));
    }
    const hipG = assemble(thigh);
    const kneeG = assemble(shin);
    kneeG.position.y = -0.30;
    hipG.add(kneeG);
    hipG.position.set(side * 0.115, 0.08, 0);
    hipG.userData.knee = kneeG;
    return hipG;
  };
  const legL = leg(-1);
  const legR = leg(1);
  stack.add(legL, legR);

  // Stand him on the floor at the right size.
  //
  // Authored freehand, the parts came out 1.50 metres tall with the origin at
  // mid-shin — so in game he was both a head shorter than the 1.72 the
  // collision capsule uses and buried to the knees in the floor, which from
  // behind reads as the camera being broken rather than the model. Measured
  // with tools/body.mjs rather than guessed: the raw rig spans -0.564 to
  // +0.938.
  const RAW_MIN = -0.564, RAW_MAX = 0.938;
  const s = PLAYER_HEIGHT / (RAW_MAX - RAW_MIN);
  stack.scale.setScalar(s);
  stack.position.y = -RAW_MIN * s;

  rig.userData = { body, head, armL, armR, legL, legR, stack, scale: s };
  return rig;
}

/**
 * Pose the rig.
 *
 * Three stances, one walk cycle, and an aim override. Everything is set
 * absolutely from the inputs rather than accumulated, so the pose is a pure
 * function of the state — a rig that integrates its own rotations drifts, and
 * a drifting rig is impossible to debug once it is behind the player where
 * they can only half see it.
 *
 *   stance   'stand' | 'crouch' | 'prone'
 *   t        gait phase in radians; the caller advances it by speed
 *   speed    planar metres/second, for the amplitude
 *   pitch    look pitch, so the head tracks where the camera is aimed
 *   aim      0..1 how far the weapon is raised
 *   airborne suppress the walk cycle and tuck the legs
 */
export function posePlayerModel(rig, {
  stance = 'stand', t = 0, speed = 0, pitch = 0, aim = 0, airborne = false, hurt = 0,
} = {}) {
  const u = rig.userData;
  if (!u) return;
  const { body, head, armL, armR, legL, legR } = u;

  // Stance drives the whole body's height and lean. `crouch` folds at hip and
  // knee; `prone` lays the rig down, which the caller has to account for when
  // it places the camera.
  const crouch = stance === 'crouch' ? 1 : 0;
  const prone = stance === 'prone' ? 1 : 0;

  // Prone is a rotation, *not* a translation, and the two must not both fire.
  //
  // The first version dropped every part along local Y and then rotated the
  // rig — but once the rig is on its face, local "down" points backwards, so
  // the drop shoved his limbs out behind him and scattered the body across the
  // floor. Rotating alone is enough; the only extra is lifting the root so the
  // chest rests on the ground instead of through it.
  //
  // The sign matters too: this model's face looks down +Z, so laying it down
  // needs a *positive* pitch to put the head forward and the face to the floor.
  // Negative laid him on his back with his head behind him.
  rig.rotation.order = 'YXZ';
  rig.rotation.x = prone * 1.42;
  rig.position.y = prone * 0.34 * (u.scale ?? 1);
  const drop = crouch * 0.34;
  body.position.y = -drop;
  head.position.y = 0.80 - drop;
  legL.position.y = 0.08 - drop;
  legR.position.y = 0.08 - drop;
  armL.position.y = 0.545 - drop;
  armR.position.y = 0.545 - drop;

  // Gait. Amplitude tracks speed so a standing player is still rather than
  // marching on the spot, and a crawl swings less than a sprint.
  const amp = Math.min(1, speed / 6) * (prone ? 0.35 : crouch ? 0.55 : 1);
  const swing = airborne ? 0 : Math.sin(t) * 0.85 * amp;
  const lift = airborne ? 0 : Math.max(0, Math.cos(t)) * 0.5 * amp;

  legL.rotation.order = 'YXZ';
  legR.rotation.order = 'YXZ';
  const kneeL = legL.userData.knee, kneeR = legR.userData.knee;
  if (airborne) {
    // Tucked, one leg further forward than the other.
    legL.rotation.x = -0.85; legR.rotation.x = -0.35;
    kneeL.rotation.x = 1.0; kneeR.rotation.x = 0.5;
  } else if (prone) {
    // Straight out behind, toes turned outward.
    legL.rotation.x = 0.10; legR.rotation.x = -0.06;
    kneeL.rotation.x = 0.30 + Math.sin(t) * 0.12 * amp;
    kneeR.rotation.x = 0.24 - Math.sin(t) * 0.12 * amp;
  } else {
    // Hip swings, knee trails: the shin bends *back* on the recovery half of
    // the stride and stays straight on the planted half, which is the whole
    // reason a walk cycle reads as walking.
    legL.rotation.x = swing - crouch * 0.62;
    legR.rotation.x = -swing - crouch * 0.62;
    kneeL.rotation.x = crouch * 1.15 + Math.max(0, -swing) * 1.1;
    kneeR.rotation.x = crouch * 1.15 + Math.max(0, swing) * 1.1;
  }
  legL.rotation.z = prone * 0.26 + crouch * 0.14;
  legR.rotation.z = -prone * 0.26 - crouch * 0.14;

  // Torso counter-rotates against the legs; without it the walk reads as a
  // mannequin being slid along the floor.
  body.rotation.order = 'YXZ';
  body.rotation.y = -swing * 0.16;
  body.rotation.x = crouch * 0.30 + prone * 0.10 + Math.min(0.18, speed * 0.02);

  // The head looks where the camera looks, clamped so the neck stays a neck.
  head.rotation.order = 'YXZ';
  // Prone puts his chin on the floor unless the neck lifts to compensate for
  // the rig's own pitch.
  head.rotation.x = clampPose(-pitch * 0.55 - prone * 1.0, -1.2, 0.9);
  head.rotation.y = swing * 0.10;

  // Arms. Raised into a two-handed hold as `aim` comes up, swinging against
  // the legs when it is down.
  armR.rotation.order = 'YXZ';
  armL.rotation.order = 'YXZ';
  if (prone) {
    // Propped on the elbows with the weapon out front. In the rig's own frame
    // that is the arms swung nearly all the way up past the head, because the
    // rig itself is already face-down.
    armR.rotation.set(-2.32, -0.18, -0.30, 'YXZ');
    armL.rotation.set(-2.40, 0.26, 0.34, 'YXZ');
  } else {
    const holdX = -1.15 - aim * 0.35;
    armR.rotation.x = lerpPose(-swing * 0.7, holdX, aim);
    armL.rotation.x = lerpPose(swing * 0.7, holdX, aim);
    armR.rotation.z = lerpPose(0.06, -0.34, aim) + hurt * 0.2;
    armL.rotation.z = lerpPose(-0.06, 0.40, aim) - hurt * 0.2;
    armR.rotation.y = lerpPose(0, -0.25, aim);
    armL.rotation.y = lerpPose(0, 0.42, aim);
  }
}

const clampPose = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerpPose = (a, b, t) => a + (b - a) * (t < 0 ? 0 : t > 1 ? 1 : t);
