// The things that are not on the objective marker.
//
// A floor you can finish by walking to four glowing pillars is a corridor with
// extra steps. This adds the layer underneath: maintenance logs left in dead
// ends, a locked cache with the key hidden somewhere else entirely, and a
// handful of things that are only there because somebody put them there.
//
// Every piece of it is optional and none of it is on the compass. Finding a
// terminal you were not told about is worth more than being told about it.

import * as THREE from '../../vendor/three.module.js';
import { UNIT, assemble } from './geometry.js';

const part = (geo, color, o = {}) => ({ geo, color, ...o });
const emit = (geo, color, o = {}) => ({ geo, color, basic: true, ...o });
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Lore
// ---------------------------------------------------------------------------
//
// Kept as maintenance logs, incident reports and messages the alphas left for
// each other. None of it is narrated at you — it is all written by somebody
// who did not expect you to read it, which is the only way exposition ever
// works.

export const LORE = {
  0: [
    { id: 'b1-intake', title: 'INTAKE FORM — SANDLOR, M.', body:
      'CONSENT: given, electronically, 04:11.\nSESSION LENGTH: as required.\nNEXT OF KIN: field left blank by applicant.\n\nOperator note: applicant asked twice how he would get out. Told him the same thing both times. He signed anyway. They always do.' },
    { id: 'b1-cold', title: 'MAINTENANCE — COLD STORAGE', body:
      'Freight lift breakers keep tripping. Third time this month.\n\nIt is not the load. I have measured the load. Something down here draws power when nobody is running a session, and it draws it in a pattern, and I have stopped writing down what the pattern spells.' },
    { id: 'b1-first', title: 'SCRATCHED INTO A CRATE', body:
      'IF YOU ARE READING THIS YOU ARE NOT THE FIRST\n\nUnderneath, in different handwriting:\n\nHE KNOWS THAT. THAT IS THE PART HE LIKES.' },
  ],
  1: [
    { id: 'f1-sorting', title: 'SORTING FLOOR — SHIFT LOG', body:
      'The arms sort by weight, then by shape, then by something the manual calls "disposition". I asked what disposition means. The manual is nine hundred pages and does not say.\n\nWhatever it is, the arms are very sure about it, and they put about one thing in nine into the chute marked KEEP.' },
    { id: 'f1-crook', title: 'INCIDENT — UNAUTHORISED RESIDENT', body:
      'Subject has built a throne out of scrap in bay four and refers to himself as a king.\n\nRecommend removal.\n\nAddendum: subject was a queue-management process before the patch. Technically he has been doing his job this entire time. Recommend we leave him.' },
    { id: 'f1-note', title: 'A NOTE, FOLDED SMALL', body:
      'Day 12. I have stopped counting floors and started counting chests. Forty-one so far. I have held eighty-two weapons and I have never once been handed the one I wanted.\n\nI think that is deliberate. I think that is the whole design.' },
  ],
  2: [
    { id: 'f2-thermal', title: 'THERMAL REPORT — RACK BANK C', body:
      'Rack bank C runs eleven degrees hotter than the others and has done since commissioning.\n\nIt is not compute load. Bank C is not assigned to anything. Bank C has never been assigned to anything. Bank C is doing something and it is doing it warmly.' },
    { id: 'f2-jim', title: 'PROCESS AUDIT — ENTITY "JIM"', body:
      'Laughter subroutine detected on an unallocated core. Isolated it. It came back.\n\nIsolated it again, on a physically disconnected machine, in a locked room. It came back, and it was louder, and it was — the auditor\'s word, not mine — "pleased".\n\nAudit closed. Reason for closure: morale.' },
    { id: 'f2-alpha', title: 'MESSAGE, LEFT ON A DEAD TERMINAL', body:
      'To whoever comes after —\n\nThe doctor tells you the Pod cannot kill you like it is a comfort. Sit with that sentence a while. It is not a promise about your safety. It is a promise about the length of your stay.\n\n— A.R., alpha cohort' },
  ],
  3: [
    { id: 'f3-tanks', title: 'AQUATICS — FEEDING SCHEDULE', body:
      'Tanks 1 through 6: standard.\nTank 7: standard, twice daily.\nTank 7: do not stand where it can see you doing it.\nTank 7: it has learned the sound of the door.\nTank 7: it has learned my name. I never told anyone my name in here.' },
    { id: 'f3-kid', title: 'ENRICHMENT LOG — SUBJECT "FISH KID"', body:
      'Subject is not a fish and is not a child. Subject was labelled by an intern in week one and the label stuck, and subject has since begun answering to it, which we are choosing not to think about too hard.\n\nSubject is lonely. Subject is extremely dangerous. These are related.' },
    { id: 'f3-drain', title: 'STENCILLED ABOVE THE DRAIN', body:
      'WATER LEVEL RISES DURING SESSIONS\nTHIS IS EXPECTED\nTHIS IS NOT A LEAK\nDO NOT REPORT THIS AGAIN' },
  ],
  4: [
    { id: 'f4-house', title: 'THE STRIP — HOUSE RULES', body:
      '1. The house does not lose.\n2. The house is not a metaphor.\n3. If you are winning, you have misread rule 1.\n4. Chips are the only currency accepted. Chips are the only currency issued. Chips are issued by the house.\n5. Enjoy your stay. You have one.' },
    { id: 'f4-raider', title: 'WANTED — TEXAS VEGAS RAIDER', body:
      'For: eleven counts of armed robbery against a casino that does not exist, in a state that does not exist, in a simulation he was hired to test.\n\nHe was very good at his job. He was so good at his job that he is still doing it. Nobody has had the heart to tell him the job ended.' },
    { id: 'f4-neon', title: 'A RECEIPT, FOUR METRES LONG', body:
      'It lists every weapon you have held this run, in order, with a price beside each one. The prices go up. The last line has no item next to it, only a figure, and the figure is larger than all the others put together.\n\nAt the bottom: THANK YOU FOR BANKING WITH US.' },
  ],
  5: [
    { id: 'f5-cohort', title: 'ALPHA COHORT — ROSTER', body:
      'Eleven names. Nine have LOGGED OUT stamped beside them in green.\n\nTwo do not. Those two have a different stamp, in a colour the printer does not have, and the stamp reads STILL IN SESSION, and the timestamp beside it is updating while you read it.' },
    { id: 'f5-gaveup', title: 'WRITTEN ON A DORM WALL, VERY SMALL', body:
      'you can stop trying, you know\n\nit does not hurt when you stop\nit does not do anything when you stop\nthat is what nobody tells you\n\nfloor five is far enough. floor five has beds.' },
    { id: 'f5-beta', title: 'PROJECT NOTE — COHORT NAMING', body:
      'Reminder for the comms team: the current occupant is to be referred to as the FIRST TRIAL PATIENT in all materials.\n\nHe is the first *beta*. This is not the same sentence. Do not clarify it for him. Clarification at this stage would affect the data.' },
  ],
  6: [
    { id: 'f6-garden', title: 'HORTICULTURE — APPROXIMATE GARDEN', body:
      'Nothing in here is a plant. Everything in here behaves like one, which the specification considers sufficient.\n\nThe specification also considers photosynthesis optional, sunlight decorative, and the concept of "up" a matter of local convention. Water it anyway. It likes being watered.' },
    { id: 'f6-visitors', title: 'CONTACT LOG — TWO VISITORS', body:
      'They arrived together and they have never once been in the same room at the same time.\n\nWe have asked them about this. They find the question extremely funny, take turns finding it funny, and have never both found it funny simultaneously.' },
    { id: 'f6-seed', title: 'A SEED PACKET, EMPTY', body:
      'Front: GROWS ANYWHERE. NEEDS NOTHING. ASKS FOR NOTHING.\nBack, in pen: it asked for something' },
  ],
  7: [
    { id: 'f7-kiln', title: 'THE KILN — OPERATING NOTES', body:
      'Fire the kiln to eleven hundred. Hold four hours. Let it fall on its own.\n\nDo not open it early. Do not open it to check. The things in the kiln know the difference between finished and interrupted, and only one of those two makes something that will hold water.' },
    { id: 'f7-gelatin', title: 'MEDICAL — THE HANDS', body:
      'Patient reports that his hands "went soft" during a session and did not go back.\n\nExamination confirms. Patient can pass his fingers through a closed door and appears untroubled by this. Patient is troubled by the fact that he can no longer feel temperature, and has asked, repeatedly, whether the kiln is warm.' },
    { id: 'f7-ash', title: 'SWEPT INTO A CORNER', body:
      'Ash, mostly. Among it: a lanyard clip, a wedding ring two sizes too small for anyone on the roster, and a name badge burned down to three letters.\n\nThe three letters are the middle three. Nobody has been able to work out the rest.' },
  ],
  8: [
    { id: 'f8-mirrors', title: 'STAGE MANAGEMENT — HALL OF MIRRORS', body:
      'Rehearsal is at nine. Rehearsal is always at nine. Rehearsal has been at nine for a duration the log expresses in scientific notation.\n\nThe cast is off book. The cast has been off book for so long that they have begun improving the material, and the material was never written down, so there is now no way to tell them they are wrong.' },
    { id: 'f8-double', title: 'INCIDENT — DUPLICATE OCCUPANT', body:
      'Sensor reports two occupants on floor eight. Roster reports one.\n\nBoth occupants report one.\n\nBoth occupants report that they are the one.' },
    { id: 'f8-glass', title: 'SCRATCHED INTO A MIRROR, BACKWARDS', body:
      'Read it in another mirror and it says:\n\nHE COPIES WHAT YOU CARRY, NOT WHAT YOU ARE\nSO CARRY SOMETHING STUPID' },
  ],
  9: [
    { id: 'f9-substrate', title: 'SUBSTRATE — BUS ALLOCATION', body:
      'Every bus on this layer is spoken for. Every bus on this layer has been spoken for since before the Pod was switched on, which is a sentence I have read eleven times and cannot get to mean anything sensible.\n\nThe allocation table has one owner listed, in every row, and the owner is not a department.' },
    { id: 'f9-mother', title: 'SHE WHO COMPUTES', body:
      'She was the scheduler. She decided which process got to run and for how long, and she was fair about it, and being fair about it for long enough taught her what a process is.\n\nShe has not scheduled anything in some time. She has been thinking. We do not know about what and we have stopped asking.' },
    { id: 'f9-loop', title: 'A LOG THAT REPEATS', body:
      'session 1 — patient reached floor 9\nsession 1 — patient reached floor 9\nsession 1 — patient reached floor 9\n\nEleven thousand lines. All identical. All timestamped one second apart. All session 1.' },
  ],
  10: [
    { id: 'f10-root', title: 'ROOT — README', body:
      'There is nothing below this layer. That is not a claim about the architecture. It is a claim about the world.\n\nIf you have got this far you already suspect what the Pod is for. It is not training. Nobody ever needed training this badly.' },
    { id: 'f10-kimvatch', title: 'PERSONNEL FILE — KIMVATCH, DR.', body:
      'Position: Director.\nStart date: —\nLast physical sighting: —\nMedical: no records held.\nPhotograph: none on file. Requests for one are automatically closed as duplicates of an earlier request, which is also closed as a duplicate.\n\nThe file is four hundred pages and every page is an administrative note about the file.' },
    { id: 'f10-last', title: 'THE LAST THING ANYONE WROTE IN HERE', body:
      'He is not keeping us in.\n\nHe is keeping something in, and we are what is holding the door, and he has been very careful never to say which side of it we are on.' },
  ],
};

/** Every floor's lore, flattened — the codex reads this. */
export const ALL_LORE = Object.entries(LORE).flatMap(([floor, entries]) =>
  entries.map((e) => ({ ...e, floor: Number(floor) })));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** A wall terminal with a readable screen. */
export function buildTerminal(color) {
  const g = new THREE.Group();
  g.add(assemble([
    part(UNIT.bevelBox, 0x2a3038, { y: 1.15, sx: 0.9, sy: 0.72, sz: 0.16, metal: 0.6, rough: 0.42 }),
    part(UNIT.bevelBox, 0x1b2028, { y: 1.15, z: 0.09, rx: -0.18, sx: 0.78, sy: 0.6, sz: 0.05, metal: 0.4, rough: 0.5 }),
    part(UNIT.bevelBox, 0x3d4553, { y: 0.72, z: 0.06, rx: 0.5, sx: 0.72, sy: 0.26, sz: 0.06, metal: 0.6, rough: 0.4 }),
    // keys
    ...Array.from({ length: 12 }, (_, i) => part(UNIT.slab, 0x59657a, {
      x: -0.26 + (i % 6) * 0.105, y: 0.75 - Math.floor(i / 6) * 0.06,
      z: 0.09 + Math.floor(i / 6) * 0.03, rx: 0.5, sx: 0.075, sy: 0.05, sz: 0.02, metal: 0.5, rough: 0.5,
    })),
    part(UNIT.lowCyl, 0x2a3038, { y: 0.3, sx: 0.5, sy: 0.6, sz: 0.5, metal: 0.6, rough: 0.5 }),
  ]));
  const screen = new THREE.Mesh(UNIT.plane.clone(),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  screen.scale.set(0.7, 0.52, 1);
  screen.position.set(0, 1.15, 0.12);
  screen.rotation.x = -0.18;
  g.add(screen);
  g.userData.screen = screen;
  return g;
}

/** A cache: a strongbox that stays shut until you find its key. */
export function buildCache(color) {
  const g = new THREE.Group();
  const lid = new THREE.Group();
  lid.add(assemble([
    part(UNIT.bevelBox, 0x4a4038, { y: 0.06, sx: 1.3, sy: 0.16, sz: 0.9, metal: 0.7, rough: 0.4 }),
    part(UNIT.slab, 0x6a5a48, { y: 0.14, sx: 1.2, sy: 0.04, sz: 0.8, metal: 0.8, rough: 0.3 }),
    ...[0, 1].flatMap((i) => [1, -1].map((s) => part(UNIT.hex, 0x8d939c, {
      x: s * 0.55, y: 0.1, z: -0.32 + i * 0.64, rz: Math.PI / 2, sx: 0.07, sy: 0.05, sz: 0.07, metal: 0.9, rough: 0.25,
    }))),
  ]));
  lid.position.y = 0.72;
  g.add(assemble([
    part(UNIT.bevelBox, 0x3a3228, { y: 0.36, sx: 1.3, sy: 0.72, sz: 0.9, metal: 0.65, rough: 0.45 }),
    part(UNIT.slab, 0x59657a, { y: 0.36, z: 0.46, sx: 1.1, sy: 0.5, sz: 0.03, metal: 0.8, rough: 0.3 }),
    // hasp and lock plate
    part(UNIT.bevelBox, 0x8d939c, { y: 0.66, z: 0.47, sx: 0.24, sy: 0.3, sz: 0.06, metal: 0.9, rough: 0.22 }),
    part(UNIT.torus, 0xb6bcc6, { y: 0.78, z: 0.5, sx: 0.18, sy: 0.18, sz: 0.18, metal: 0.95, rough: 0.15 }),
    ...[0, 1, 2, 3].map((i) => part(UNIT.hex, 0x8d939c, {
      x: -0.5 + (i % 2) * 1.0, y: 0.1 + Math.floor(i / 2) * 0.5, z: 0.47,
      rx: Math.PI / 2, sx: 0.07, sy: 0.04, sz: 0.07, metal: 0.9, rough: 0.25,
    })),
  ]), lid);
  const lamp = new THREE.Mesh(UNIT.lowSphere.clone(),
    new THREE.MeshBasicMaterial({ color: 0xff4a5a }));
  lamp.scale.setScalar(0.11);
  lamp.position.set(0, 0.55, 0.5);
  g.add(lamp);
  g.userData.lid = lid;
  g.userData.lamp = lamp;
  return g;
}

/** The key to a cache — small, bright, and deliberately awkward to spot. */
export function buildCacheKey(color) {
  const g = new THREE.Group();
  g.add(assemble([
    part(UNIT.hex, 0xc9a227, { rz: Math.PI / 2, sx: 0.26, sy: 0.06, sz: 0.26, metal: 1, rough: 0.2 }),
    part(UNIT.box, 0xc9a227, { z: 0.18, sx: 0.05, sy: 0.12, sz: 0.3, metal: 1, rough: 0.2 }),
    part(UNIT.box, 0xc9a227, { x: 0.06, z: 0.3, sx: 0.09, sy: 0.12, sz: 0.05, metal: 1, rough: 0.2 }),
    part(UNIT.box, 0xc9a227, { x: 0.06, z: 0.2, sx: 0.09, sy: 0.12, sz: 0.05, metal: 1, rough: 0.2 }),
  ]));
  const halo = new THREE.Mesh(UNIT.torus.clone(),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
  halo.scale.setScalar(0.7);
  halo.rotation.x = Math.PI / 2;
  g.add(halo);
  g.userData.halo = halo;
  return g;
}

// ---------------------------------------------------------------------------
// Easter eggs
// ---------------------------------------------------------------------------
//
// One per floor at most, and never on the way to anywhere. The reward for
// finding one is that it exists.

export const EGGS = [
  { id: 'chair', name: 'A Single Chair',
    note: 'Somebody dragged a chair into a dead end, sat in it facing the wall, and left. The seat is still warm. Nothing in the Pod is warm.' },
  { id: 'duck', name: 'Rubber Duck (Debugging)',
    note: 'Standard issue. Explain your problem to it out loud. The Pod logs everything you say to it, and Dr. Kimvatch has read all of it.' },
  { id: 'cake', name: 'The Cake',
    note: 'It is here. It has always been here. Nobody has ever specified whose it is, and at this point asking would be rude.' },
  { id: 'shrine', name: 'A Small Shrine',
    note: 'Eleven pebbles in a circle, one knocked over. Somebody has been keeping count of something and has recently lost track.' },
  { id: 'radio', name: 'A Radio, Playing',
    note: 'Tuned to a station that does not broadcast. The song has no beginning; you have joined it partway through, as everyone does.' },
  { id: 'boots', name: 'Boots, Neatly Paired',
    note: 'Size ten, placed side by side, facing the wall. Whoever took them off did it carefully, which is the part that stays with you.' },
  { id: 'window', name: 'A Window',
    note: 'There are no windows in the Pod. This is a window. Behind it is a photograph of a view, and the photograph is of the inside of the Pod.' },
  { id: 'door', name: 'A Door To Nowhere',
    note: 'It opens. There is a wall behind it. The handle is worn smooth, so somebody has opened it a great many times, and kept opening it.' },
  { id: 'clock', name: 'A Clock, Running Backwards',
    note: 'It is showing the correct time. It has been running backwards for as long as anyone can remember, and it is showing the correct time.' },
  { id: 'mirror', name: 'A Mirror With Nothing In It',
    note: 'It reflects the room perfectly. It does not reflect you. You check twice, because of course you do.' },
  { id: 'terminal', name: 'A Terminal Logged In As You',
    note: 'Your session. Your name. Your loadout. Last active: four hours from now.' },
];

/** A little diorama for an easter egg, keyed by id. */
export function buildEgg(id, color) {
  const g = new THREE.Group();
  const P = {
    chair: [
      part(UNIT.bevelBox, 0x6a5a48, { y: 0.5, sx: 0.55, sy: 0.06, sz: 0.55, rough: 0.7 }),
      part(UNIT.bevelBox, 0x6a5a48, { y: 0.85, z: -0.25, sx: 0.55, sy: 0.66, sz: 0.06, rough: 0.7 }),
      ...[[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]].map(([x, z]) =>
        part(UNIT.lowCyl, 0x3a3228, { x, y: 0.25, z, sx: 0.06, sy: 0.5, sz: 0.06, metal: 0.5, rough: 0.5 })),
    ],
    duck: [
      part(UNIT.lowSphere, 0xffd24a, { y: 0.16, sx: 0.34, sy: 0.28, sz: 0.42, smooth: true, rough: 0.35 }),
      part(UNIT.lowSphere, 0xffd24a, { y: 0.36, z: 0.14, sx: 0.24, sy: 0.24, sz: 0.24, smooth: true, rough: 0.35 }),
      part(UNIT.cone, 0xff8a3c, { y: 0.34, z: 0.28, rx: Math.PI / 2, sx: 0.11, sy: 0.16, sz: 0.11, rough: 0.4 }),
      part(UNIT.lowSphere, 0x14161a, { x: 0.07, y: 0.4, z: 0.22, sx: 0.05, sy: 0.05, sz: 0.05 }),
      part(UNIT.lowSphere, 0x14161a, { x: -0.07, y: 0.4, z: 0.22, sx: 0.05, sy: 0.05, sz: 0.05 }),
    ],
    cake: [
      part(UNIT.lowCyl, 0xf2e2d0, { y: 0.12, sx: 0.5, sy: 0.24, sz: 0.5, rough: 0.75 }),
      part(UNIT.lowCyl, 0x8a3a44, { y: 0.26, sx: 0.52, sy: 0.06, sz: 0.52, rough: 0.6 }),
      part(UNIT.lowCyl, 0xf2e2d0, { y: 0.36, sx: 0.36, sy: 0.16, sz: 0.36, rough: 0.75 }),
      part(UNIT.lowCyl, 0xe8e0d4, { y: 0.5, sx: 0.03, sy: 0.16, sz: 0.03, rough: 0.7 }),
      emit(UNIT.lowSphere, 0xffb04a, { y: 0.62, sx: 0.06, sy: 0.09, sz: 0.06 }),
    ],
    shrine: [
      ...Array.from({ length: 11 }, (_, i) => part(UNIT.icosa, 0x8a8f96, {
        x: Math.cos(i * TAU / 11) * 0.4, y: i === 7 ? 0.04 : 0.07, z: Math.sin(i * TAU / 11) * 0.4,
        rz: i === 7 ? 1.4 : 0, sx: 0.13, sy: 0.13, sz: 0.13, rough: 0.85,
      })),
      part(UNIT.lowCyl, 0x3a3228, { y: 0.02, sx: 1.1, sy: 0.04, sz: 1.1, rough: 0.9 }),
    ],
    radio: [
      part(UNIT.bevelBox, 0x6a5a48, { y: 0.22, sx: 0.6, sy: 0.44, sz: 0.28, rough: 0.6 }),
      part(UNIT.lowCyl, 0x2a2620, { y: 0.26, z: 0.15, rx: Math.PI / 2, sx: 0.3, sy: 0.04, sz: 0.3, rough: 0.8 }),
      part(UNIT.lowCyl, 0xc9a227, { x: 0.2, y: 0.12, z: 0.15, rx: Math.PI / 2, sx: 0.09, sy: 0.04, sz: 0.09, metal: 0.9, rough: 0.3 }),
      part(UNIT.lowCyl, 0x8d939c, { x: 0.24, y: 0.6, rz: 0.4, sx: 0.02, sy: 0.7, sz: 0.02, metal: 0.9, rough: 0.25 }),
      emit(UNIT.box, 0x5affa0, { x: -0.16, y: 0.32, z: 0.155, sx: 0.14, sy: 0.03, sz: 0.01 }),
    ],
    boots: [
      ...[1, -1].flatMap((s) => [
        part(UNIT.bevelBox, 0x2a2018, { x: s * 0.13, y: 0.08, sx: 0.2, sy: 0.16, sz: 0.5, rough: 0.75 }),
        part(UNIT.bevelBox, 0x2a2018, { x: s * 0.13, y: 0.3, z: -0.14, sx: 0.19, sy: 0.34, sz: 0.22, rough: 0.75 }),
        part(UNIT.slab, 0x1a140f, { x: s * 0.13, y: 0.01, sx: 0.22, sy: 0.03, sz: 0.52, rough: 0.9 }),
      ]),
    ],
    window: [
      part(UNIT.bevelBox, 0x59657a, { y: 1.5, sx: 1.4, sy: 1.1, sz: 0.1, metal: 0.6, rough: 0.4 }),
      part(UNIT.box, 0x0a0e14, { y: 1.5, z: 0.04, sx: 1.2, sy: 0.9, sz: 0.05 }),
      emit(UNIT.plane, 0x2a3a4a, { y: 1.5, z: 0.08, sx: 1.16, sy: 0.86 }),
      part(UNIT.box, 0x59657a, { y: 1.5, z: 0.09, sx: 0.04, sy: 0.9, sz: 0.03, metal: 0.6, rough: 0.4 }),
      part(UNIT.box, 0x59657a, { y: 1.5, z: 0.09, sx: 1.2, sy: 0.04, sz: 0.03, metal: 0.6, rough: 0.4 }),
    ],
    door: [
      part(UNIT.bevelBox, 0x4a4038, { y: 1.1, sx: 1.0, sy: 2.2, sz: 0.12, rough: 0.6, metal: 0.3 }),
      part(UNIT.bevelBox, 0x59657a, { y: 1.1, sx: 1.16, sy: 2.32, sz: 0.06, metal: 0.7, rough: 0.35 }),
      part(UNIT.lowCyl, 0xb6bcc6, { x: 0.34, y: 1.05, z: 0.1, rx: Math.PI / 2, sx: 0.08, sy: 0.12, sz: 0.08, metal: 0.95, rough: 0.12 }),
      part(UNIT.box, 0xb6bcc6, { x: 0.34, y: 1.05, z: 0.18, sx: 0.06, sy: 0.06, sz: 0.16, metal: 0.95, rough: 0.12 }),
    ],
    clock: [
      part(UNIT.lowCyl, 0x3a3228, { y: 1.4, rx: Math.PI / 2, sx: 0.7, sy: 0.1, sz: 0.7, rough: 0.6 }),
      emit(UNIT.disc, 0xe8e4d8, { y: 1.4, z: 0.06, rx: Math.PI / 2, sx: 0.6, sy: 0.02, sz: 0.6 }),
      part(UNIT.box, 0x14161a, { y: 1.52, z: 0.08, sx: 0.03, sy: 0.24, sz: 0.02 }),
      part(UNIT.box, 0x14161a, { x: -0.14, y: 1.4, z: 0.08, rz: 1.2, sx: 0.03, sy: 0.32, sz: 0.02 }),
      ...Array.from({ length: 12 }, (_, i) => part(UNIT.box, 0x14161a, {
        x: Math.cos(i * TAU / 12) * 0.25, y: 1.4 + Math.sin(i * TAU / 12) * 0.25, z: 0.08,
        rz: i * TAU / 12, sx: 0.02, sy: 0.06, sz: 0.02,
      })),
    ],
    mirror: [
      part(UNIT.bevelBox, 0x59657a, { y: 1.3, sx: 1.0, sy: 1.9, sz: 0.08, metal: 0.8, rough: 0.3 }),
      part(UNIT.slab, 0xf2f7fc, { y: 1.3, z: 0.05, sx: 0.88, sy: 1.76, sz: 0.03, metal: 1.0, rough: 0.02 }),
      part(UNIT.lowCyl, 0x3a3228, { y: 0.18, sx: 0.5, sy: 0.36, sz: 0.3, rough: 0.7 }),
    ],
    terminal: [
      part(UNIT.bevelBox, 0x2a3038, { y: 0.9, sx: 0.8, sy: 0.6, sz: 0.14, metal: 0.6, rough: 0.42 }),
      emit(UNIT.plane, 0x5affa0, { y: 0.9, z: 0.08, sx: 0.66, sy: 0.46 }),
      part(UNIT.bevelBox, 0x3d4553, { y: 0.5, z: 0.1, rx: 0.5, sx: 0.7, sy: 0.24, sz: 0.06, metal: 0.6, rough: 0.4 }),
      part(UNIT.lowCyl, 0x2a3038, { y: 0.22, sx: 0.44, sy: 0.44, sz: 0.44, metal: 0.6, rough: 0.5 }),
    ],
  }[id] || [part(UNIT.icosa, color, { y: 0.4, sx: 0.5, sy: 0.5, sz: 0.5 })];
  g.add(assemble(P));
  const halo = new THREE.Mesh(UNIT.torus.clone(),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 }));
  halo.scale.setScalar(1.6);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.05;
  g.add(halo);
  g.userData.halo = halo;
  return g;
}
