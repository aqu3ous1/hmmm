// First-person hands.
//
// Every weapon in this game floated. Not "floated a bit" — a Desert Eagle hung
// in the lower-right of the frame with nothing holding it, cycling its own
// slide, and the player spent the entire run looking at it. It is the single
// loudest tell that a shooter is a prototype, and no amount of picatinny rail
// on the gun itself fixes it, because the problem is not the gun.
//
// So: a pair of hands, and specifically *Michael Sandlor's* hands. He is a beta
// test patient who did not consent to any of this, and the viewmodel is the one
// piece of art the player cannot look away from — so it carries the story. The
// sleeve is a surgical-blue patient gown, not tactical gloves. There is an
// admissions band on the left wrist. There is a cannula taped into the back of
// the left hand with the line cut short, because somebody pulled him off the
// drip in a hurry. The knuckles are split. None of that costs a draw call and
// all of it is on screen for six hours.
//
// Frame convention, matching weaponKit.js:
//
//     +Z forward (muzzle)   +Y up   +X right   origin at the grip
//
// A hand is authored in a canonical frame where it grips a bar lying along the
// **X axis**: palm behind at -Z, fingers stacking along X and curling over the
// top and down the front. Poses then rotate that whole frame — a pistol grip is
// the same fist turned ninety degrees so the bar runs vertically.

import * as THREE from '../../vendor/three.module.js';
import { UNIT, assemble } from '../world/geometry.js';

const B = UNIT.box, BB = UNIT.bevelBox, SL = UNIT.slab;
const CY = UNIT.cyl, TP = UNIT.taper, SP = UNIT.lowSphere;

// Skin under the pod's cold light: pale, slightly grey, a long way from a
// holiday. Warm enough to separate from the gunmetal, desaturated enough that
// it does not read as a cartoon.
//
// These are deliberately much darker than a swatch of skin looks on a colour
// picker. The viewmodel has its own three-light rig aimed at dark gunmetal,
// and the first pass used honest mid-tone albedos — which clipped to flat
// white and turned both hands into featureless blobs with no readable fingers.
// Albedo is not colour; albedo times the light is colour.
const SKIN = 0x3c2c23;
const SKIN_HI = 0x48352a;      // knuckles and the backs of the fingers
const NAIL = 0x4c3f34;
const BRUISE = 0x281319;       // split knuckles
const GOWN = 0x1d2c34;         // surgical blue, laundered a hundred times
const GOWN_DK = 0x131f26;
const BAND = 0x45443f;         // admissions wristband
const BAND_INK = 0x330f20;     // the barcode stripe
const TAPE = 0x464238;         // surgical tape, yellowed
const TUBE = 0x2c3538;

const FLESH = { metal: 0, rough: 0.68, smooth: true };
const CLOTH = { metal: 0, rough: 0.93 };
// Roughness 0.55 rather than a truer 0.45 for a plastic band: assemble()
// quantises roughness to 0.2 steps, and 0.55 lands in the same bucket as
// FLESH's 0.68, so the nails, the wristband and the cannula merge into the
// skin's draw call instead of doubling the rig's cost. Nobody has ever seen
// the difference between those two numbers on a fingernail.
const PLASTIC = { metal: 0, rough: 0.55, smooth: true };

const pt = (geo, color, mat, o = {}) => ({ geo, color, ...mat, ...o });

/**
 * One finger, curling around a bar of radius `r` whose axis is +X.
 *
 * Three segments swept through an arc rather than three boxes in a row: a
 * straight finger laid over a round handguard is what "blocked out" looks like,
 * and the arc is the same part count. `curl` runs 0 (straight out along +Z) to
 * 1 (closed fist), and the sweep is what sells a hand actually holding a thing
 * instead of hovering next to one.
 */
function finger(out, { x, y = 0, z = 0, r = 0.019, len = 1, curl = 1, splay = 0, girth = 1 }) {
  const segs = [0.040, 0.030, 0.024];
  // Start on the front-top of the bar and sweep down and back underneath.
  let a = -0.55 - splay;                 // angle from +Z, positive = downward
  const total = (1.9 + curl * 1.6);
  let px = x, py = y + Math.sin(-a) * r, pz = z + Math.cos(a) * r;
  for (let i = 0; i < 3; i++) {
    const L = segs[i] * len;
    const step = total / 3 * (0.8 + i * 0.2);
    const mid = a + step * 0.5;
    // Segment centre sits half a length along its own direction.
    const cx = px, cy = py - Math.sin(mid) * L * 0.5, cz = pz + Math.cos(mid) * L * 0.5;
    const w = (0.019 - i * 0.0022) * girth;
    out.push(pt(BB, i === 0 ? SKIN_HI : SKIN, FLESH, {
      x: cx, y: cy, z: cz, rx: mid,
      sx: w * 2, sy: w * 2.05, sz: L,
    }));
    // Knuckle: a bead at every joint, because the joint is the only place a
    // finger changes direction and the only place the eye checks.
    out.push(pt(SP, i === 0 ? SKIN_HI : SKIN, FLESH, {
      x: px, y: py, z: pz, sx: w * 2.15, sy: w * 2.15, sz: w * 2.15,
    }));
    px = cx; py = cy - Math.sin(mid) * L * 0.5; pz = cz + Math.cos(mid) * L * 0.5;
    a += step;
  }
  // Fingernail on the last segment, facing outward from the curl.
  out.push(pt(SL, NAIL, PLASTIC, {
    x: px, y: py + Math.cos(a) * 0.012, z: pz + Math.sin(a) * 0.012,
    rx: a, sx: 0.013, sy: 0.004, sz: 0.016,
  }));
}

/** A straight finger, for the one on the trigger. */
function triggerFinger(out, { x, y = 0, z = 0, reach = 0.058 }) {
  const bend = 0.42;
  out.push(pt(BB, SKIN_HI, FLESH, {
    x, y: y + 0.004, z: z + reach * 0.42, rx: -0.12,
    sx: 0.038, sy: 0.037, sz: reach,
  }));
  out.push(pt(SP, SKIN_HI, FLESH, { x, y: y + 0.006, z, sx: 0.041, sy: 0.041, sz: 0.041 }));
  // The distal pad hooks down onto the trigger face.
  out.push(pt(BB, SKIN, FLESH, {
    x, y: y - 0.012, z: z + reach * 0.86, rx: bend + 0.5,
    sx: 0.033, sy: 0.033, sz: 0.030,
  }));
  out.push(pt(SP, SKIN, FLESH, {
    x, y: y + 0.002, z: z + reach * 0.82, sx: 0.036, sy: 0.036, sz: 0.036,
  }));
}

/**
 * A hand and the forearm behind it, gripping a bar along +X.
 *
 * `side` is +1 for the right hand and -1 for the left; the left is the right
 * mirrored through X, which is what real hands are and saves authoring a second
 * one that would inevitably drift out of agreement with the first.
 */
function handParts(side, {
  r = 0.020,            // radius of the thing being gripped
  curl = 1,             // 0 open, 1 closed
  trigger = false,      // straighten the index finger onto a trigger
  fingers = 4,
  cannula = false,      // taped IV port on the back of this hand
} = {}) {
  const out = [];
  const S = side;

  // --- palm -------------------------------------------------------------
  // Behind the bar, tilted so the heel of the hand sits lower than the
  // knuckles. A flat slab reads as a mitten; the taper is the whole trick.
  out.push(pt(BB, SKIN, FLESH, {
    x: -S * 0.006, y: -0.004, z: -r - 0.019, rx: 0.10,
    sx: 0.086, sy: 0.070, sz: 0.046,
  }));
  // Thenar mound — the pad at the base of the thumb. Its absence is why a
  // blocked-out hand looks like a glove with nothing in it.
  out.push(pt(SP, SKIN, FLESH, {
    x: S * 0.036, y: -0.012, z: -r - 0.012, sx: 0.044, sy: 0.052, sz: 0.048,
  }));
  // Hypothenar, the opposite edge, smaller.
  out.push(pt(SP, SKIN, FLESH, {
    x: -S * 0.040, y: -0.014, z: -r - 0.016, sx: 0.032, sy: 0.046, sz: 0.042,
  }));
  // Knuckle ridge across the front of the palm.
  out.push(pt(BB, SKIN_HI, FLESH, {
    x: 0, y: 0.014, z: -r + 0.004, sx: 0.084, sy: 0.030, sz: 0.026,
  }));

  // --- fingers ----------------------------------------------------------
  // Index nearest the thumb, ring and pinky progressively shorter and more
  // splayed, which is the difference between a hand and a comb.
  const lay = [
    { dx: 0.030, len: 1.00, splay: 0.00, girth: 1.00 },
    { dx: 0.008, len: 1.06, splay: 0.05, girth: 1.02 },
    { dx: -0.014, len: 0.98, splay: 0.12, girth: 0.94 },
    { dx: -0.036, len: 0.86, splay: 0.22, girth: 0.84 },
  ];
  for (let i = 0; i < fingers; i++) {
    const f = lay[i];
    if (i === 0 && trigger) {
      triggerFinger(out, { x: S * f.dx, y: 0.006, z: -r + 0.006 });
      continue;
    }
    finger(out, {
      x: S * f.dx, y: 0.008, z: 0, r,
      len: f.len, curl, splay: f.splay, girth: f.girth,
    });
  }

  // --- thumb ------------------------------------------------------------
  // Two segments running up and across the far side of the bar, angled in.
  out.push(pt(BB, SKIN, FLESH, {
    x: S * 0.048, y: 0.006, z: -r + 0.002, rx: -0.30, rz: -S * 0.72,
    sx: 0.028, sy: 0.048, sz: 0.030,
  }));
  out.push(pt(SP, SKIN_HI, FLESH, {
    x: S * 0.058, y: 0.028, z: -r + 0.008, sx: 0.030, sy: 0.030, sz: 0.030,
  }));
  out.push(pt(BB, SKIN_HI, FLESH, {
    x: S * 0.050, y: 0.046, z: -r + 0.014, rx: -0.45, rz: -S * 0.36,
    sx: 0.025, sy: 0.040, sz: 0.026,
  }));
  out.push(pt(SL, NAIL, PLASTIC, {
    x: S * 0.044, y: 0.062, z: -r + 0.026, rx: -0.5,
    sx: 0.014, sy: 0.005, sz: 0.016,
  }));

  // --- split knuckles ---------------------------------------------------
  // He has been punching things since B1. Two small dark patches sitting just
  // proud of the knuckle ridge, no geometry cost worth mentioning.
  out.push(pt(SL, BRUISE, FLESH, {
    x: S * 0.020, y: 0.026, z: -r + 0.002, sx: 0.020, sy: 0.009, sz: 0.014,
  }));
  out.push(pt(SL, BRUISE, FLESH, {
    x: -S * 0.008, y: 0.028, z: -r + 0.001, sx: 0.015, sy: 0.008, sz: 0.013,
  }));

  // --- wrist stub -------------------------------------------------------
  // Only the stub. The forearm is a separate object posed in viewmodel space
  // rather than baked into the grip frame: a fist that rotates ninety degrees
  // to take a pistol grip should not swing its owner's elbow through the
  // ceiling with it, which is exactly what happened when the arm rode along.
  const wz = -r - 0.044;
  out.push(pt(CY, SKIN, FLESH, {
    x: 0, y: -0.012, z: wz, rx: Math.PI / 2 - 0.16,
    sx: 0.062, sy: 0.034, sz: 0.058,
  }));

  // --- cannula ----------------------------------------------------------
  if (cannula) {
    out.push(pt(SL, TAPE, CLOTH, {
      x: -S * 0.010, y: 0.020, z: -r - 0.026, rx: 0.10,
      sx: 0.042, sy: 0.004, sz: 0.034,
    }));
    out.push(pt(CY, TUBE, PLASTIC, {
      x: -S * 0.010, y: 0.026, z: -r - 0.030, rx: 0.6, rz: 0.4,
      sx: 0.010, sy: 0.052, sz: 0.010,
    }));
    // The line was cut, not unplugged.
    out.push(pt(CY, TUBE, PLASTIC, {
      x: -S * 0.026, y: 0.044, z: -r - 0.048, rx: 1.1, rz: 0.7,
      sx: 0.008, sy: 0.040, sz: 0.008,
    }));
  }

  return out;
}

/**
 * A forearm, authored running straight back along -Z from the wrist.
 *
 * -Z is toward the camera in viewmodel space (the holder carries the 180°
 * cant that points the muzzle away), so an arm built this way leaves the
 * bottom of the frame by default and each pose only has to nudge it.
 */
function armParts(side, { len = 0.46, band = false } = {}) {
  const out = [];
  const S = side;
  // Sleeve. Tapered narrow-at-the-wrist so it reads as a cuff opening rather
  // than a length of pipe, and long enough to actually leave the frame — an
  // arm that stops in mid-air is a mannequin part.
  out.push(pt(TP, GOWN, CLOTH, {
    x: 0, y: -0.010, z: -0.028 - len * 0.5, rx: -Math.PI / 2,
    sx: 0.086, sy: len, sz: 0.080,
  }));
  // Cuff at the wrist end, and a seam running up the outside of the sleeve.
  out.push(pt(CY, GOWN_DK, CLOTH, {
    x: 0, y: -0.008, z: -0.034, rx: Math.PI / 2,
    sx: 0.079, sy: 0.026, sz: 0.074,
  }));
  out.push(pt(B, GOWN_DK, CLOTH, {
    x: S * 0.038, y: 0.004, z: -0.030 - len * 0.46,
    sx: 0.009, sy: 0.020, sz: len * 0.88,
  }));
  // A worn patch on the elbow side, so the sleeve is not one flat colour over
  // its whole length.
  out.push(pt(SL, GOWN_DK, CLOTH, {
    x: -S * 0.030, y: -0.030, z: -0.030 - len * 0.72,
    sx: 0.034, sy: 0.030, sz: len * 0.24,
  }));

  // --- admissions band --------------------------------------------------
  if (band) {
    out.push(pt(CY, BAND, PLASTIC, {
      x: 0, y: -0.006, z: -0.016, rx: Math.PI / 2,
      sx: 0.074, sy: 0.017, sz: 0.070,
    }));
    // The printed stripe. It is two millimetres of geometry and it is the
    // reason the hand is a patient's hand and not a soldier's.
    out.push(pt(SL, BAND_INK, PLASTIC, {
      x: -S * 0.030, y: -0.006, z: -0.016,
      sx: 0.008, sy: 0.024, sz: 0.014,
    }));
    out.push(pt(SL, BAND_INK, PLASTIC, {
      x: -S * 0.014, y: -0.036, z: -0.016,
      sx: 0.020, sy: 0.008, sz: 0.014,
    }));
  }
  return out;
}

// How each weapon is held.
//
//   grip:    [y, z] in the weapon's own coordinates — where the firing hand
//            closes. Nearly every gun here uses weaponKit's pistolGrip at its
//            default (-0.12, -0.06), so that is the fallback; assuming the
//            model origin instead left the hand floating above the receiver.
//   fy, fz:  the off hand, as fractions of the weapon's bounding box
//            (0 = bottom/back, 1 = top/muzzle). Fractions for guns, because
//            they are all roughly the same shape and a fraction survives the
//            model being re-authored.
//   support: [y, z] absolute, for the melee weapons, where a fraction of a
//            bounding box dominated by a 1.7-long blade means nothing.
//   hs:      how big a hand is in *this model's* units, relative to the gun
//            kit's. The seventeen guns are all built out of weaponKit and so
//            agree with each other, which is why they share one number; the
//            five melee weapons were each authored freehand and do not agree
//            with anything. The knuckle duster is the extreme case — its four
//            finger holes are 0.072 apart, three times a real hand's spacing —
//            and with one global hand size the fist simply sat behind the
//            brass instead of wearing it.
//
// A table rather than a heuristic, because "where does the off hand go" is a
// design decision per weapon — a mop is not held like a rifle, and a rifle is
// not held like a Desert Eagle — and guessing it from a bounding box produced
// exactly the kind of nearly-right that reads as broken.
const G = [-0.12, -0.06];   // weaponKit's pistolGrip default

const HOLD = {
  // long guns: off hand under the handguard, out toward the muzzle
  ak47: { pose: 'rifle', grip: G, fz: 0.72, fy: 0.56 },
  fake47: { pose: 'rifle', grip: G, fz: 0.72, fy: 0.56 },
  roombroom: { pose: 'rifle', grip: G, fz: 0.68, fy: 0.54 },
  behemoth: { pose: 'rifle', grip: [-0.16, -0.1], fz: 0.50, fy: 0.44 },
  prototype: { pose: 'rifle', grip: G, fz: 0.66, fy: 0.54 },
  harpoon: { pose: 'rifle', grip: G, fz: 0.66, fy: 0.56 },
  nimbo: { pose: 'rifle', grip: G, fz: 0.62, fy: 0.54 },
  compliance: { pose: 'rifle', grip: G, fz: 0.66, fy: 0.54 },
  intern: { pose: 'rifle', grip: G, fz: 0.62, fy: 0.52 },
  actuary: { pose: 'rifle', grip: G, fz: 0.66, fy: 0.54 },
  zapper: { pose: 'rifle', grip: G, fz: 0.60, fy: 0.52 },
  sanguine: { pose: 'rifle', grip: G, fz: 0.62, fy: 0.56 },
  nullptr: { pose: 'rifle', grip: G, fz: 0.60, fy: 0.56 },
  sawblade: { pose: 'rifle', grip: [-0.14, -0.12], fz: 0.58, fy: 0.30 },
  // pistols: off hand cups the firing hand rather than reaching for a barrel
  deagle: { pose: 'cup', grip: G },
  babygun: { pose: 'solo', grip: G },
  sandwich: { pose: 'cup', grip: G },
  grappler: { pose: 'cup', grip: G },
  // melee: the grip is wherever that particular object's handle happens to be
  knuckles: { pose: 'fist', grip: [-0.056, -0.075], hs: 3.3, frame: 0.62 },
  bigknife: { pose: 'haft', grip: [0.24, -0.32], support: [0.24, -0.60], hs: 2.2 },
  tinyknife: { pose: 'solo', grip: [0.016, -0.038], hs: 0.8 },
  mop: { pose: 'haft', grip: [0.06, -0.10], support: [-0.02, 0.42], hs: 1.05 },
};

const DEFAULT_HOLD = { pose: 'rifle', grip: G, fz: 0.64, fy: 0.52 };

/** The gun kit's hand size, shared by every weapon built out of weaponKit. */
export const KIT_HAND_SCALE = 1.8;

/** What a weapon id is held like, with a sane fallback for anything new. */
export function holdFor(id, kind) {
  return HOLD[id]
    || (kind === 'melee' ? { pose: 'solo', grip: [0, 0] } : DEFAULT_HOLD);
}

/**
 * Build the pair of hands for a hold.
 *
 * Returns a Group with `left` and `right` child Groups on its userData so the
 * viewmodel can drive them separately — the off hand has to leave the
 * handguard and go to the magazine well during a reload, and an off hand that
 * stays welded to the barrel while a magazine flies out on its own is worse
 * than no hands at all.
 */
export function buildHands(hold) {
  const group = new THREE.Group();
  const pose = hold.pose;

  /**
   * One limb: a container holding a posed hand and, independently, a posed
   * arm. Two rotations instead of one, because the wrist and the elbow do not
   * agree about anything.
   *
   * The hand's euler runs in 'YZX' order, which is not decoration. In that
   * order the rotations compose as Ry · Rz · Rx, so:
   *
   *   rx  rolls the hand about the bar it is gripping (applied first, about
   *       the canonical bar axis, and still about the bar after the others)
   *   ry  swings the bar from X onto Z — a handguard or a mop shaft
   *   rz  swings the bar from X onto Y — a pistol grip
   *
   * With the default XYZ order the roll landed *before* the yaw and every
   * two-handed weapon ended up held across the shaft rather than along it: the
   * mop went through both fists sideways like a tightrope pole.
   */
  const limb = (side, handOpts, handRot, armRot, armOpts) => {
    const g = new THREE.Group();
    // No unshareMaterials here, deliberately: nothing ever writes to a hand's
    // material, so the shared cache is exactly right. Cloning them would mint
    // a fresh set on every weapon swap and hand disposeTree something real to
    // free, for no behaviour at all.
    const h = assemble(handParts(side, handOpts));
    h.rotation.set(handRot[0], handRot[1], handRot[2], 'YZX');
    const a = assemble(armParts(side, armOpts));
    a.rotation.set(armRot[0], armRot[1], armRot[2]);
    g.add(h, a);
    g.userData.hand = h;
    g.userData.arm = a;
    g.userData.armLen = armOpts?.len ?? 0.46;
    return g;
  };

  // --- firing hand ------------------------------------------------------
  // The canonical fist grips a bar along X; rolling it -90° about Z stands that
  // bar upright, which is a pistol grip — and every weapon here has one.
  const grip = -Math.PI / 2;
  const rightHandOpts = pose === 'fist' ? { r: 0.026, curl: 1 }
    : pose === 'haft' ? { r: 0.026, curl: 1 }
      : { r: 0.021, curl: 1, trigger: true };
  // A duster is worn, not gripped: its four holes lie in the XY plane with the
  // fingers passing through along Z, which is the canonical frame untouched.
  // Standing it upright like a pistol grip put the fist at right angles to the
  // brass it was supposed to be wearing.
  const rightHandRot = pose === 'fist' ? [0, 0, 0.12]
    : pose === 'haft' ? [2.0, -Math.PI / 2, 0]
      : [0, 0, grip];
  // The firing arm comes back and out toward the right shoulder, dropping
  // away below the frame. The signs matter and are not obvious: the holder
  // carries a 180° yaw so the muzzle points away from the camera, which means
  // holder-local -X is screen right and holder-local -Z is toward the lens.
  // Getting them wrong sent both forearms up over the barrel like antennae.
  const right = limb(1, rightHandOpts, rightHandRot, [-0.70, 0.40, 0], { len: 0.50 });
  group.add(right);

  // --- support hand -----------------------------------------------------
  let left = null;
  if (pose !== 'solo' && pose !== 'fist') {
    if (pose === 'cup') {
      // Thumbs-forward: the off hand wraps the firing hand from the weak side,
      // rolled over so the heels of both palms meet behind the grip. Loosely
      // curled, because it is closing on a hand and not on a rail.
      left = limb(-1, { r: 0.032, curl: 0.5 }, [0.12, 0, grip + 0.60],
        [-0.62, -0.42, 0], { len: 0.50, band: true });
      left.position.set(-0.050, -0.026, -0.014);
    } else if (pose === 'haft') {
      // Both hands on the same shaft, the off hand further along it, rolled
      // the other way — which is how anyone actually holds a broom.
      left = limb(-1, { r: 0.026, curl: 1, cannula: true },
        [1.1, -Math.PI / 2, 0],
        [-0.50, -0.40, 0], { len: 0.48, band: true });
    } else {
      // Under the handguard: the bar has to run along the barrel, so yaw it
      // onto Z, then roll the palm up so the hand cradles the forestock from
      // below instead of hanging off the side of it.
      left = limb(-1, { r: 0.027, curl: 0.94, cannula: true },
        [1.35, -Math.PI / 2, 0],
        [-0.42, -0.55, 0], { len: 0.52, band: true });
    }
    group.add(left);
  }

  group.userData = { right, left, pose };
  return group;
}
