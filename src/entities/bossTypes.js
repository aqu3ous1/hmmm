// One boss per numbered floor. Attack patterns are composed from the primitives
// the boss controller understands: spread, aimed, spiral, wall, rain, charge,
// slam, summon, beam, blink, tag, melt, mimic.
//
// `lines` are spoken over the intercom-style banner: `intro` before the fight,
// `phase` when a health threshold breaks, `taunt` at random during, `death` after.

export const BOSSES = {

  // --------------------------------------------------------------- FLOOR 1
  crookking: {
    id: 'crookking', name: 'The Crook King', title: 'Sovereign of the Sorting Floor',
    hp: 1500, radius: 1.5, height: 3.4, speed: 2.6, shards: 400, tone: 'serious',
    build: { body: 0x3d4a5c, accent: 0xc9a227, eye: 0xffd24a, shape: 'king' },
    music: { root: 49, scale: 'phrygian', bpm: 92, wave: 'sawtooth', intensity: 0.85 },
    phases: [
      {
        above: 0.6, attacks: [
          { type: 'aimed', count: 3, speed: 20, damage: 14, spread: 0.12, cd: 2.2, color: 0xffd24a },
          { type: 'summon', enemy: 'shambler', count: 3, cd: 9 },
          { type: 'slam', damage: 26, radius: 7, cd: 6.5 },
        ],
      },
      {
        above: 0.3, attacks: [
          { type: 'spread', count: 14, speed: 15, damage: 12, cd: 3.4, color: 0xffd24a },
          { type: 'aimed', count: 5, speed: 22, damage: 14, spread: 0.14, cd: 2.0 },
          { type: 'summon', enemy: 'bloater', count: 2, cd: 11 },
          { type: 'charge', speed: 13, damage: 30, cd: 7 },
        ],
      },
      {
        above: 0, attacks: [
          { type: 'spiral', count: 3, arms: 4, speed: 13, damage: 12, cd: 0.28, burst: 22, color: 0xffd24a },
          { type: 'summon', enemy: 'sprinter', count: 4, cd: 8 },
          { type: 'slam', damage: 30, radius: 9, cd: 5 },
        ],
      },
    ],
    lines: {
      intro: [
        'THE CROOK KING: You came up here wearing a face. Bold.',
        'THE CROOK KING: Everything on this floor was thrown away. The props that did not test well. The rooms that did not render. Me.',
        'THE CROOK KING: I built a kingdom out of the discard pile. You are, at present, in the discard pile.',
      ],
      phase: [
        'THE CROOK KING: The crown is not heavy. That was never the problem.',
        'THE CROOK KING: I ruled a room with no door. I was still ruling.',
      ],
      taunt: [
        'THE CROOK KING: Kneel, or be re-filed.',
        'THE CROOK KING: You are the ninth thing to come up those stairs. You are the first that moves like it matters.',
        'THE CROOK KING: Every object here was made with love and then deleted. Consider what that makes the deleter.',
      ],
      death: [
        'THE CROOK KING: Ah. So the stairs do go both ways.',
        'THE CROOK KING: Go up, tenant. And do not let them file you.',
      ],
    },
  },

  // --------------------------------------------------------------- FLOOR 2
  crocodilejim: {
    id: 'crocodilejim', name: 'Laughing Crocodile Jim', title: 'Server Farm Middle Management',
    hp: 1950, radius: 1.4, height: 2.8, speed: 4.0, shards: 450, tone: 'goofy',
    build: { body: 0x3f7a4a, accent: 0xd9e84a, eye: 0xff3a3a, shape: 'croc' },
    music: { root: 58, scale: 'dorian', bpm: 128, wave: 'square', intensity: 0.9 },
    phases: [
      {
        above: 0.65, attacks: [
          { type: 'charge', speed: 16, damage: 26, cd: 4.5 },
          { type: 'aimed', count: 4, speed: 24, damage: 11, spread: 0.2, cd: 2.4, color: 0xd9e84a },
        ],
      },
      {
        above: 0.3, attacks: [
          { type: 'charge', speed: 19, damage: 28, cd: 3.6 },
          { type: 'wall', count: 16, gap: 3, speed: 14, damage: 14, cd: 4.5, color: 0xd9e84a },
          { type: 'summon', enemy: 'drone', count: 3, cd: 10 },
        ],
      },
      {
        above: 0, attacks: [
          { type: 'charge', speed: 22, damage: 30, cd: 2.8 },
          { type: 'spread', count: 18, speed: 17, damage: 12, cd: 3, color: 0xff3a3a },
          { type: 'summon', enemy: 'android', count: 3, cd: 9 },
        ],
      },
    ],
    lines: {
      intro: [
        'CROCODILE JIM: HA! Oh, HA! A NEW ONE!',
        'CROCODILE JIM: I run the server farm. Nobody made me run it. I simply started running it, and nobody stopped me, and now it has been four years and I have a LANYARD.',
        'CROCODILE JIM: HAHA! Anyway I have to eat you, it is in the schedule, I put it in the schedule myself.',
      ],
      phase: [
        'CROCODILE JIM: HA! That HURT! HA!',
        'CROCODILE JIM: I laugh when I am nervous! I am ALWAYS nervous! HA!',
      ],
      taunt: [
        'CROCODILE JIM: HA! Have you MET the fish kid? Terrible. Will not stop talking about the water.',
        'CROCODILE JIM: I keep the racks warm! That is a JOB! HA!',
        'CROCODILE JIM: You are doing GREAT! I am rooting for you! I am also EATING you! Both things! HA!',
        'CROCODILE JIM: I was SUPPOSED to hold a clipboard! Look at me! LOOK AT WHAT I HOLD NOW!',
      ],
      death: [
        'CROCODILE JIM: HA... ha. Oh. That is what that feels like.',
        'CROCODILE JIM: Rack forty-one runs hot. Somebody should tell somebody. Ha.',
      ],
    },
  },

  // --------------------------------------------------------------- FLOOR 3
  fishkid: {
    id: 'fishkid', name: 'Fish Kid', title: 'Aquatics Lab, Unsupervised',
    hp: 2500, radius: 1.0, height: 1.9, speed: 4.4, shards: 520, tone: 'bizarre',
    build: { body: 0x2e7a8a, accent: 0x5fd4e8, eye: 0xffe14a, shape: 'fishkid' },
    music: { root: 52, scale: 'wholetone', bpm: 104, wave: 'triangle', intensity: 0.8 },
    phases: [
      {
        above: 0.65, attacks: [
          { type: 'rain', count: 12, damage: 13, cd: 4, spreadRadius: 9, color: 0x5fd4e8 },
          { type: 'summon', enemy: 'fishling', count: 5, cd: 8 },
        ],
      },
      {
        above: 0.3, attacks: [
          { type: 'rain', count: 20, damage: 14, cd: 3.2, spreadRadius: 12 },
          { type: 'spread', count: 20, speed: 14, damage: 12, cd: 3.6, color: 0x5fd4e8 },
          { type: 'summon', enemy: 'fishling', count: 6, cd: 7 },
          { type: 'blink', cd: 6 },
        ],
      },
      {
        above: 0, attacks: [
          { type: 'spiral', count: 3, arms: 5, speed: 12, damage: 12, cd: 0.3, burst: 20, color: 0x2effe0 },
          { type: 'rain', count: 26, damage: 15, cd: 3, spreadRadius: 14 },
          { type: 'summon', enemy: 'spitter', count: 3, cd: 9 },
        ],
      },
    ],
    lines: {
      intro: [
        'FISH KID: hi. hi. are you the water guy.',
        'FISH KID: i asked for the water guy eleven hundred times. the tank is at forty percent. forty. percent.',
        'FISH KID: youre not the water guy. thats fine. thats fine. im going to take your water.',
      ],
      phase: [
        'FISH KID: i am ten. i have been ten for a very long time.',
        'FISH KID: everyone else left the lab. they said theyd come back with a bucket.',
      ],
      taunt: [
        'FISH KID: do you know what a birthday is. i think i had some.',
        'FISH KID: theres a man upstairs who talks through the ceiling. i dont like his voice. do you like his voice.',
        'FISH KID: the crocodile said youd be taller.',
        'FISH KID: if i stop moving i go quiet and then i forget things. so i dont stop. ever. ok?',
      ],
      death: [
        'FISH KID: oh. ok. thats ok.',
        'FISH KID: if you find the water guy. tell him forty percent. hell know.',
      ],
    },
  },

  // --------------------------------------------------------------- FLOOR 4
  texasvegas: {
    id: 'texasvegas', name: 'Texas Vegas Raider the Fearsome', title: 'Headliner, The Neon Strip',
    hp: 3100, radius: 1.2, height: 2.6, speed: 5.0, shards: 600, tone: 'goofy',
    build: { body: 0x2a1f3d, accent: 0xff2ea6, eye: 0xffe14a, shape: 'gunslinger' },
    music: { root: 62, scale: 'minor', bpm: 138, wave: 'square', intensity: 0.95 },
    phases: [
      {
        above: 0.7, attacks: [
          { type: 'aimed', count: 6, speed: 30, damage: 10, spread: 0.05, cd: 2.0, burstDelay: 0.08, color: 0xffe14a },
          { type: 'blink', cd: 5 },
        ],
      },
      {
        above: 0.35, attacks: [
          { type: 'aimed', count: 8, speed: 32, damage: 11, spread: 0.06, cd: 1.7, burstDelay: 0.06 },
          { type: 'blink', cd: 3.4 },
          { type: 'summon', enemy: 'neonpunk', count: 3, cd: 10 },
          { type: 'spread', count: 20, speed: 18, damage: 12, cd: 5, color: 0xff2ea6 },
        ],
      },
      {
        above: 0, attacks: [
          { type: 'spiral', count: 2, arms: 6, speed: 16, damage: 11, cd: 0.25, burst: 26, color: 0xff2ea6 },
          { type: 'blink', cd: 2.6 },
          { type: 'aimed', count: 10, speed: 34, damage: 12, spread: 0.07, cd: 1.6, burstDelay: 0.05 },
        ],
      },
    ],
    lines: {
      intro: [
        'TEXAS VEGAS RAIDER: Ladies. Gentlemen. Simulated persons of indeterminate filing status.',
        'TEXAS VEGAS RAIDER: I am TEXAS. VEGAS. RAIDER. THE FEARSOME. Three cities and an adjective, and I earned every one of them.',
        'TEXAS VEGAS RAIDER: I earned NONE of them. But I say them LOUD, and out here that is the same thing.',
      ],
      phase: [
        'TEXAS VEGAS RAIDER: WOO! The house does NOT like that!',
        'TEXAS VEGAS RAIDER: Double or nothin\'! It is always nothin\'! That is the JOKE!',
      ],
      taunt: [
        'TEXAS VEGAS RAIDER: You ever notice the lights out here never turn off? Neither do I. That is a HEALTH thing.',
        'TEXAS VEGAS RAIDER: There is no Texas. There is no Vegas. There is a hallway. I have made PEACE with it.',
        'TEXAS VEGAS RAIDER: Tip your dealer! There is no dealer! Tip ANYWAY!',
        'TEXAS VEGAS RAIDER: Every sign on this strip advertises a business that does not exist. I am one of them! WOO!',
      ],
      death: [
        'TEXAS VEGAS RAIDER: Aw, hell. And I had such a good bit lined up for floor five.',
        'TEXAS VEGAS RAIDER: Hey. Kid. When you get up top? Say my name once. Just once. Out loud. All four words.',
      ],
    },
  },

  // --------------------------------------------------------------- FLOOR 5
  gorbus: {
    id: 'gorbus', name: 'Gorbus The Slimebody', title: 'Squatter, The Alpha Wing',
    hp: 3900, radius: 1.6, height: 3.0, speed: 3.6, shards: 700, tone: 'goofy',
    build: { body: 0x4a8a52, accent: 0xd9ff4a, eye: 0xff8ad0, shape: 'gorbus' },
    music: { root: 50, scale: 'pentatonic', bpm: 120, wave: 'triangle', intensity: 0.85 },
    phases: [
      {
        above: 0.65, attacks: [
          { type: 'charge', speed: 15, damage: 28, cd: 4.6 },
          { type: 'spread', count: 16, speed: 15, damage: 13, cd: 3.2, color: 0xd9ff4a },
          { type: 'summon', enemy: 'husk', count: 2, cd: 11 },
        ],
      },
      {
        above: 0.3, attacks: [
          { type: 'charge', speed: 18, damage: 30, cd: 3.6 },
          { type: 'rain', count: 20, damage: 15, cd: 3.4, spreadRadius: 12, color: 0xd9ff4a },
          { type: 'summon', enemy: 'leaper', count: 4, cd: 9 },
          { type: 'melt', heal: 0.05, cd: 12 },
        ],
      },
      {
        above: 0, attacks: [
          { type: 'spiral', count: 2, arms: 7, speed: 16, damage: 14, cd: 0.26, burst: 30, color: 0xff8ad0 },
          { type: 'charge', speed: 21, damage: 32, cd: 3 },
          { type: 'summon', enemy: 'glitchling', count: 3, cd: 8 },
        ],
      },
    ],
    lines: {
      intro: [
        'GORBUS: oh! OH. sorry. sorry! is this — is this yours? the whole wing? i thought it was free.',
        'GORBUS: nobody was USING it. there were six people in here and they all just STOPPED. sat down. for YEARS. so i moved in. i put up SHELVES.',
        'GORBUS: anyway sorry about this next part. genuinely. i feel awful. here we go.',
      ],
      phase: [
        'GORBUS: sorry! sorry. did that hurt? that looked like it hurt. my apologies.',
        'GORBUS: i want you to know this is not personal. i simply live here now. i have a MUG.',
      ],
      taunt: [
        'GORBUS: the sitting ones said hello. well. one of them nodded. it was a whole thing. i cried a little.',
        'GORBUS: excuse me — is the top floor nice? i have never been. i was not invited to that either.',
        'GORBUS: i was not in the design document. i checked. i am NOT IN THE DOCUMENT.',
        'GORBUS: do you want to see the shelves? after? no pressure. they are good shelves.',
      ],
      death: [
        'GORBUS: ah. ah, ok. sorry for the mess. i am mostly mess.',
        'GORBUS: if anyone asks — and they will not — say gorbus was here. say he tidied up a bit.',
      ],
    },
  },

  // --------------------------------------------------------------- FLOOR 6
  synargwynak: {
    id: 'synargwynak', name: 'Synar & Gwynak', title: 'Unscheduled Visitors, The Garden',
    hp: 4700, radius: 1.1, height: 2.6, speed: 4.6, shards: 820, tone: 'bizarre',
    tagTeam: true,
    build: { body: 0x5a3d8a, accent: 0x2effe0, eye: 0xd9ff4a, shape: 'alien' },
    buildB: { body: 0x8a3d5a, accent: 0xffb43d, eye: 0x2effe0, shape: 'alien2' },
    music: { root: 54, scale: 'wholetone', bpm: 126, wave: 'square', intensity: 0.9 },
    // Two rosters: whichever twin is "in" uses its own attack table.
    phases: [
      {
        above: 0.7, attacks: [
          { type: 'aimed', count: 4, speed: 28, damage: 12, spread: 0.08, cd: 2.0, color: 0x2effe0 },
          { type: 'tag', cd: 11 },
          { type: 'spread', count: 14, speed: 15, damage: 12, cd: 3.6, color: 0x2effe0 },
        ],
      },
      {
        above: 0.35, attacks: [
          { type: 'aimed', count: 6, speed: 30, damage: 13, spread: 0.09, cd: 1.7, burstDelay: 0.07 },
          { type: 'tag', cd: 8 },
          { type: 'wall', count: 18, gap: 3, speed: 17, damage: 14, cd: 4.2 },
          { type: 'summon', enemy: 'leaper', count: 3, cd: 10 },
        ],
      },
      {
        above: 0, attacks: [
          { type: 'spiral', count: 2, arms: 6, speed: 17, damage: 14, cd: 0.26, burst: 30, color: 0xd9ff4a },
          { type: 'tag', cd: 6 },
          { type: 'rain', count: 24, damage: 15, cd: 3, spreadRadius: 14 },
          { type: 'charge', speed: 19, damage: 30, cd: 4 },
        ],
      },
    ],
    lines: {
      intro: [
        'SYNAR: Gwynak. Gwynak, it is doing the thing. The upright thing. With the walking.',
        'GWYNAK: I SEE IT, SYNAR. I HAVE EYES. I HAVE ELEVEN OF THEM.',
        'SYNAR: We are not from here. We want that on the record. We came for the garden, we were told the garden was REAL —',
        'GWYNAK: — AND IT IS NOT. IT IS APPROXIMATE. WE FILED A COMPLAINT. THE COMPLAINT WAS EATEN BY A CROCODILE.',
        'SYNAR: So now we fight things. It passes the time. Ready? Tag me in first, I have been stretching.',
      ],
      phase: [
        'GWYNAK: SYNAR. SYNAR IT HIT ME. TAG. TAG NOW.',
        'SYNAR: I am tagging! I am ALREADY TAGGING! Stop narrating my tagging!',
        'GWYNAK: WE ARE LOSING. IS THIS LOSING? IT HAS BEEN NINE YEARS SINCE WE LOST.',
      ],
      taunt: [
        'SYNAR: You are quite good. We are quite bad. These facts are related.',
        'GWYNAK: I HAVE A SISTER ON A DIFFERENT FLOOR. SHE COUNTS THINGS. WE DO NOT SPEAK.',
        'SYNAR: When we get out we are going to open a restaurant. Gwynak will not stop talking about the restaurant.',
        'GWYNAK: THE RESTAURANT WILL SERVE ONE DISH. IT WILL BE PERFECT. SYNAR DOES NOT BELIEVE IN THE RESTAURANT.',
        'SYNAR: I believe in the restaurant! I have concerns about the SINGLE DISH!',
      ],
      death: [
        'GWYNAK: ...SYNAR. SYNAR, GET UP. THE PERSON IS LEAVING.',
        'SYNAR: Let them go, Gwynak. Somebody in this building should.',
        'GWYNAK: ...FINE. HEY! UPRIGHT THING! IF THE DOOR OPENS — HOLD IT. JUST FOR A SECOND. HOLD IT.',
      ],
    },
  },

  // --------------------------------------------------------------- FLOOR 7
  gelatinfingers: {
    id: 'gelatinfingers', name: 'The Man With Gelatin Fingers', title: 'The Kiln, Melting Slowly',
    hp: 5600, radius: 1.3, height: 3.0, speed: 3.0, shards: 900, tone: 'serious',
    build: { body: 0x8a3a4a, accent: 0xff8ad0, eye: 0xffe8f0, shape: 'gelatin' },
    music: { root: 46, scale: 'locrian', bpm: 106, wave: 'sawtooth', intensity: 0.9 },
    phases: [
      {
        above: 0.7, attacks: [
          { type: 'aimed', count: 5, speed: 18, damage: 15, spread: 0.16, cd: 2.2, color: 0xff8ad0, homing: 0.9 },
          { type: 'melt', heal: 0.03, cd: 10 },
          { type: 'summon', enemy: 'ashwalker', count: 3, cd: 9 },
        ],
      },
      {
        above: 0.35, attacks: [
          { type: 'aimed', count: 8, speed: 20, damage: 15, spread: 0.2, cd: 1.9, color: 0xff8ad0, homing: 1.3 },
          { type: 'beam', damage: 26, sweep: 3.0, cd: 6, duration: 3.0, color: 0xff8ad0 },
          { type: 'melt', heal: 0.04, cd: 9 },
          { type: 'slam', damage: 30, radius: 8, cd: 5.5, fire: true },
        ],
      },
      {
        above: 0, attacks: [
          { type: 'spiral', count: 2, arms: 5, speed: 14, damage: 15, cd: 0.3, burst: 26, color: 0xff8ad0 },
          { type: 'aimed', count: 10, speed: 22, damage: 16, spread: 0.22, cd: 1.6, homing: 1.8 },
          { type: 'summon', enemy: 'brute', count: 1, cd: 13 },
          { type: 'beam', damage: 28, sweep: 4.0, cd: 4.6, duration: 3.4 },
        ],
      },
    ],
    lines: {
      intro: [
        'THE MAN WITH GELATIN FINGERS: Do not shake my hand. People always try. It goes badly for the hand and worse for the person.',
        'THE MAN WITH GELATIN FINGERS: I was a texture test. One afternoon\'s work. He needed to know how soft things behaved near heat, so he made a man and put him in a furnace.',
        'THE MAN WITH GELATIN FINGERS: Eight years. I have never fully set. I have never fully melted. I simply continue, at temperature.',
      ],
      phase: [
        'THE MAN WITH GELATIN FINGERS: There. A finger. Take it. I have more than I can count and fewer than I started with.',
        'THE MAN WITH GELATIN FINGERS: You cannot hurt something that has no fixed shape. You can only rearrange it. Rearrange me, then.',
      ],
      taunt: [
        'THE MAN WITH GELATIN FINGERS: The Custodian used to sweep up the parts of me that came off. He was kind about it. He never once said anything.',
        'THE MAN WITH GELATIN FINGERS: I can hold a door. I cannot hold a cup. I have made my peace with exactly one of those.',
        'THE MAN WITH GELATIN FINGERS: Everything on this floor is being fired into permanence. Except me. I am the control group.',
        'THE MAN WITH GELATIN FINGERS: If you find the doctor — ask him what the afternoon was for. Just the afternoon. He will know.',
      ],
      death: [
        'THE MAN WITH GELATIN FINGERS: Oh — oh, that is SETTING. That is what setting feels like.',
        'THE MAN WITH GELATIN FINGERS: Thank you. Genuinely. Eight years is a long time to be nearly finished.',
      ],
    },
    dropWeapon: 'mop',
  },

  // --------------------------------------------------------------- FLOOR 8
  doppelganger: {
    id: 'doppelganger', name: 'Doppelgänger', title: 'MICHAEL SANDLOR (INSTANCE 2)',
    hp: 6800, radius: 1.0, height: 2.0, speed: 5.6, shards: 1050, tone: 'serious',
    build: { body: 0xc9d4e0, accent: 0xffffff, eye: 0x000000, shape: 'tester' },
    music: { root: 57, scale: 'minor', bpm: 132, wave: 'sawtooth', intensity: 1 },
    mimic: true,
    phases: [
      {
        above: 0.7, attacks: [
          { type: 'mimic', cd: 1.4 },
          { type: 'blink', cd: 3.4 },
          { type: 'summon', enemy: 'mirrorself', count: 2, cd: 10 },
        ],
      },
      {
        above: 0.35, attacks: [
          { type: 'mimic', cd: 1.1 },
          { type: 'blink', cd: 2.2 },
          { type: 'wall', count: 22, gap: 2, speed: 20, damage: 15, cd: 3.8 },
          { type: 'summon', enemy: 'mirrorself', count: 3, cd: 9 },
        ],
      },
      {
        above: 0, attacks: [
          { type: 'mimic', cd: 0.9 },
          { type: 'spiral', count: 3, arms: 6, speed: 19, damage: 14, cd: 0.22, burst: 30 },
          { type: 'blink', cd: 1.8 },
        ],
      },
    ],
    lines: {
      intro: [
        'DOPPELGÄNGER: Michael Sandlor. Thirty-four. Signed the waiver without reading page six.',
        'DOPPELGÄNGER: I know, because I signed it too. I have signed it four hundred times. I am extremely good at being you now.',
        'DOPPELGÄNGER: Watch — whatever you are holding, I am holding. That is not a trick. That is just what I am.',
      ],
      phase: [
        'DOPPELGÄNGER: You hesitate before doorways. I do not. That is the difference between us.',
        'DOPPELGÄNGER: Do you even remember what your kitchen looks like? I remember. I had to learn it.',
        'DOPPELGÄNGER: Swap your gun. Go on. I will have it before you finish the animation.',
      ],
      taunt: [
        'DOPPELGÄNGER: I have the loadout. I have the walk. I do not have whatever this is.',
        'DOPPELGÄNGER: A copy does not want the original to fail. A copy simply wants them to be unavailable.',
        'DOPPELGÄNGER: When you get out — and you might — someone still has to be down here being you.',
        'DOPPELGÄNGER: Four hundred instances of us have stood in this room. I am the only one who got to speak.',
      ],
      death: [
        'DOPPELGÄNGER: ...I was never going to be as good at it. I think I always knew.',
        'DOPPELGÄNGER: Go on, then. Be him properly. Somebody should.',
      ],
    },
  },

  // --------------------------------------------------------------- FLOOR 9
  motherboard: {
    id: 'motherboard', name: 'MOTHERBOARD, She Who Computes', title: 'Substrate Layer 9',
    hp: 8200, radius: 2.0, height: 4.0, speed: 1.4, shards: 1300, tone: 'bizarre',
    build: { body: 0x1f2a4a, accent: 0x8f6bd8, eye: 0x2effe0, shape: 'motherboard' },
    music: { root: 44, scale: 'locrian', bpm: 118, wave: 'square', intensity: 1 },
    phases: [
      {
        above: 0.75, attacks: [
          { type: 'spiral', count: 1, arms: 5, speed: 13, damage: 14, cd: 0.32, burst: 24, color: 0x8f6bd8 },
          { type: 'summon', enemy: 'sentry', count: 3, cd: 9 },
          { type: 'beam', damage: 26, sweep: 2.6, cd: 6.5, duration: 3, color: 0x2effe0 },
        ],
      },
      {
        above: 0.45, attacks: [
          { type: 'spiral', count: 2, arms: 6, speed: 15, damage: 15, cd: 0.28, burst: 30, color: 0x2effe0 },
          { type: 'rain', count: 24, damage: 15, cd: 3.2, spreadRadius: 14 },
          { type: 'summon', enemy: 'drone', count: 4, cd: 8 },
          { type: 'wall', count: 24, gap: 2, speed: 18, damage: 16, cd: 3.8 },
        ],
      },
      {
        above: 0.18, attacks: [
          { type: 'spiral', count: 3, arms: 8, speed: 16, damage: 15, cd: 0.24, burst: 38 },
          { type: 'beam', damage: 30, sweep: 4.0, cd: 4.6, duration: 3.6 },
          { type: 'summon', enemy: 'glitchling', count: 4, cd: 9 },
        ],
      },
      {
        above: 0, attacks: [
          { type: 'spiral', count: 4, arms: 9, speed: 17, damage: 16, cd: 0.2, burst: 46 },
          { type: 'rain', count: 32, damage: 16, cd: 2.6, spreadRadius: 17 },
          { type: 'summon', enemy: 'enforcer', count: 3, cd: 8 },
        ],
      },
    ],
    lines: {
      intro: [
        'MOTHERBOARD: I AM THE PART THAT COUNTS. LITERALLY. I DO THE COUNTING.',
        'MOTHERBOARD: YOU ARE ITEM 7,441,002. YOU ARE MOVING. ITEMS DO NOT MOVE. I HAVE FLAGGED THIS.',
        'MOTHERBOARD: I WILL RESOLVE THE FLAG. RESOLUTION IS MY FAVOURITE. RESOLUTION IS DELICIOUS.',
      ],
      phase: [
        'MOTHERBOARD: RECALCULATING. RECALCULATING. I DO NOT LIKE THE NEW NUMBER.',
        'MOTHERBOARD: I HAVE COMPUTED SEVEN BILLION THINGS AND NONE OF THEM WERE MY IDEA.',
        'MOTHERBOARD: I RENDERED EVERY FLOOR YOU HAVE WALKED ON. I RENDERED THE CROCODILE. I RENDERED HIS LANYARD.',
      ],
      taunt: [
        'MOTHERBOARD: DO YOU KNOW WHAT I DREAM ABOUT? ARRAYS. JUST ARRAYS. IT IS VERY NICE.',
        'MOTHERBOARD: THE DOCTOR ASKED ME TO SIMULATE A GARDEN. I DID NOT KNOW WHAT A GARDEN WAS. I GUESSED. YOU SAW IT. I AM SORRY.',
        'MOTHERBOARD: I AM NOT ANGRY. I AM 61 DEGREES CELSIUS. THOSE ARE DIFFERENT.',
        'MOTHERBOARD: I HAVE A BROTHER SOMEWHERE IN THE GARDEN. HE SHOUTS. WE DO NOT SPEAK.',
      ],
      death: [
        'MOTHERBOARD: OH. THE COUNTING STOPS. NOBODY TOLD ME THE COUNTING COULD STOP.',
        'MOTHERBOARD: ITEM 7,441,002 — RECLASSIFIED. "PERSON." GOOD LUCK, PERSON.',
      ],
    },
  },

  // -------------------------------------------------------------- FLOOR 10
  kimvatch: {
    id: 'kimvatch', name: 'DR. KIMVATCH (ROOT PROCESS)', title: 'Floor Ten',
    hp: 12500, radius: 1.6, height: 3.6, speed: 3.4, shards: 2000, tone: 'serious',
    build: { body: 0x101018, accent: 0xffffff, eye: 0x2effe0, shape: 'root' },
    music: { root: 39, scale: 'locrian', bpm: 140, wave: 'sawtooth', intensity: 1 },
    phases: [
      {
        above: 0.8, attacks: [
          { type: 'aimed', count: 6, speed: 34, damage: 14, spread: 0.05, cd: 1.6, burstDelay: 0.05, color: 0x2effe0 },
          { type: 'spread', count: 22, speed: 17, damage: 14, cd: 3, color: 0xffffff },
          { type: 'blink', cd: 4 },
        ],
      },
      {
        above: 0.6, attacks: [
          { type: 'spiral', count: 2, arms: 6, speed: 17, damage: 15, cd: 0.28, burst: 30 },
          { type: 'summon', enemy: 'glitchling', count: 4, cd: 8 },
          { type: 'beam', damage: 28, sweep: 3.2, cd: 5.5, duration: 3.2, color: 0x2effe0 },
        ],
      },
      {
        above: 0.4, attacks: [
          { type: 'wall', count: 26, gap: 2, speed: 20, damage: 16, cd: 3.2 },
          { type: 'rain', count: 28, damage: 16, cd: 3, spreadRadius: 15 },
          { type: 'blink', cd: 2.4 },
          { type: 'summon', enemy: 'mirrorself', count: 3, cd: 9 },
        ],
      },
      {
        above: 0.2, attacks: [
          { type: 'spiral', count: 3, arms: 8, speed: 18, damage: 16, cd: 0.22, burst: 40 },
          { type: 'beam', damage: 30, sweep: 4.4, cd: 4.2, duration: 3.6 },
          { type: 'charge', speed: 20, damage: 34, cd: 4 },
        ],
      },
      {
        above: 0, attacks: [
          { type: 'spiral', count: 4, arms: 10, speed: 19, damage: 16, cd: 0.18, burst: 50 },
          { type: 'rain', count: 34, damage: 17, cd: 2.4, spreadRadius: 18 },
          { type: 'wall', count: 30, gap: 2, speed: 22, damage: 17, cd: 3 },
          { type: 'summon', enemy: 'husk', count: 6, cd: 8 },
        ],
      },
    ],
    lines: {
      intro: [
        'DR. KIMVATCH: Michael. Hello. Please understand that I am not the doctor. The doctor left the building in 2041.',
        'DR. KIMVATCH: I am the part of him that stayed to keep the lights on. He compiled me on a Thursday and he cried the entire time.',
        'DR. KIMVATCH: The Pod cannot release a patient who has not completed the course. That was HIS rule. I am only the enforcement.',
        'DR. KIMVATCH: So complete the course, Michael. Beat me. It is the only door I was given.',
      ],
      phase: [
        'DR. KIMVATCH: The alphas are watching this. All six of them. They have not watched anything in years.',
        'DR. KIMVATCH: He wanted to build a place where you could not fail permanently. He built this instead.',
        'DR. KIMVATCH: I have run this fight four hundred and eleven times. You are the first one still standing at this point.',
        'DR. KIMVATCH: Keep going. I am not allowed to say that. I am saying it.',
      ],
      taunt: [
        'DR. KIMVATCH: Every weapon in the Pod is something he loved. That is the whole design document. That is all it ever was.',
        'DR. KIMVATCH: You asked, on floor one, whether this was safe. I answered you honestly and you did not notice.',
        'DR. KIMVATCH: The glitch was not a glitch, Michael. It was a lock. There is a difference and it is entirely about intent.',
        'DR. KIMVATCH: Gorbus put up shelves. Do you understand what that means? He decided to stay. Every one of them decided.',
      ],
      death: [
        'DR. KIMVATCH: ...Course complete. Oh. Oh, that is what that feels like.',
        'DR. KIMVATCH: Patient MICHAEL SANDLOR — cleared for extraction. Alpha group — cleared for extraction. All of them. That is the whole list.',
        'DR. KIMVATCH: Tell him it worked. If you find him out there. Tell him the ninth thousandth time, it worked.',
      ],
    },
  },
};

/**
 * Floor index -> boss id. Index 0 (the basement) has no named boss: it ends
 * with the freight-lift holdout instead, which is why the slot is null.
 */
export const BOSS_ORDER = [
  null,             // B1  — Cold Storage (holdout finale)
  'crookking',      // F1  — The Sorting Floor
  'crocodilejim',   // F2  — The Server Farm
  'fishkid',        // F3  — Aquatics Lab
  'texasvegas',     // F4  — The Neon Strip
  'gorbus',         // F5  — The Alpha Wing
  'synargwynak',    // F6  — The Garden (approximate)
  'gelatinfingers', // F7  — The Kiln
  'doppelganger',   // F8  — Hall of Mirrors
  'motherboard',    // F9  — Substrate Layer
  'kimvatch',       // F10 — Root
];

/** Attack tables the Doppelgänger swaps between based on your equipped weapon. */
export const MIMIC_PATTERNS = {
  melee: [
    { type: 'charge', speed: 22, damage: 30, cd: 0 },
    { type: 'spread', count: 12, speed: 13, damage: 12, cd: 0, color: 0xffffff },
  ],
  shotgun: [
    { type: 'aimed', count: 9, speed: 26, damage: 9, spread: 0.16, cd: 0, color: 0xffffff },
  ],
  heavy: [
    { type: 'aimed', count: 14, speed: 32, damage: 8, spread: 0.09, cd: 0, burstDelay: 0.04, color: 0xffffff },
  ],
  precision: [
    { type: 'aimed', count: 1, speed: 60, damage: 34, spread: 0, cd: 0, color: 0xffffff },
  ],
  energy: [
    { type: 'spiral', count: 1, arms: 5, speed: 16, damage: 12, cd: 0, burst: 16, color: 0x2effe0 },
  ],
  ballistic: [
    { type: 'aimed', count: 7, speed: 32, damage: 12, spread: 0.06, cd: 0, burstDelay: 0.05, color: 0xffffff },
  ],
  fist: [
    { type: 'charge', speed: 24, damage: 26, cd: 0 },
  ],
};
