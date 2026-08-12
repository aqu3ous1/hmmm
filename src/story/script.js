// The narrative spine. Lines are delivered over the intercom banner; the game
// looks up a beat by key and queues its lines.
//
// speaker: 'KIMVATCH' | 'SYSTEM' | 'GLITCH' | 'CAST' | 'SELF'
// CAST lines carry their own "NAME: text" prefix, which the HUD splits out.

const K = 'KIMVATCH', S = 'SYSTEM', G = 'GLITCH', W = 'CAST', SELF = 'SELF';

function L(speaker, text, hold) { return { speaker, text, hold }; }

export const STORY = {

  // ---- Cold open --------------------------------------------------------
  awaken: [
    L(SELF, '...', 2.2),
    L(SELF, 'Dark. Cold floor. Something is lit up over there.', 4.2),
    L(S, 'PROXIMITY: UNIDENTIFIED CONTAINER. APPROACH TO INTERACT.', 4),
  ],

  firstRollStart: [
    L(S, 'ISSUE PROTOCOL ENGAGED. RANDOMISING...', 2.4),
  ],

  firstRollEnd: [
    L(S, 'ISSUED. GOOD LUCK.', 2.6),
  ],

  // The doctor's welcome, delivered right after the first weapon lands.
  welcome: [
    L(K, 'Ah — there we are. Audio? Audio is up. Hello!', 3.6),
    L(K, 'Michael Sandlor. Good morning, good afternoon, whichever one is true for you. It is neither for me.', 5.4),
    L(K, 'My name is Dr. Elias Kimvatch, and you are standing inside the Techno Training Pod 9001. Which is a terrible name. I named it at four in the morning and by the time I regretted it we had letterhead.', 7.4),
    L(K, 'What the Pod is: a digital space. Entirely simulated, entirely yours. What it is FOR: practice.', 5.2),
    L(K, 'Every floor issues you a weapon at random. You do not get to choose. That is not a bug, Michael, that is the entire pedagogy — anyone can be good with the gun they like.', 7.6),
    L(K, 'Two chests per floor. Two hands. Two weapons, maximum. Choose badly and learn quickly.', 5),
    L(K, 'You are starting in the basement. You will finish on the tenth floor. Ten floors and a sublevel, and something waiting at the top of each one.', 6.4),
    L(K, 'And then you wake up, and we shake hands, and I put your name on a very small plaque. Ready? Of course you are. Nobody is. Off you go.', 7),
  ],

  firstChestOpened: [
    L(K, 'Whatever that is — it is yours now. Learn what it wants from you.', 4.4),
  ],

  // ---- The glitch: fires a few minutes in, on Floor 1 --------------------
  glitchEvent: [
    L(S, 'SESSION CHECKPOINT — SYNCING...', 2.2),
    L(G, 'S̷Y̸N̷C̶ ̴F̸A̷I̶L̷E̸D̴ ̶—̸ ̴R̷E̸T̴R̶Y̸ ̷1̶/̶3̷', 1.8),
    L(G, 'S̷Y̸N̷C̶ ̴F̸A̷I̶L̷E̸D̴ ̶—̸ ̴R̷E̸T̴R̶Y̸ ̷3̶/̶3̷', 1.6),
    L(S, 'EXTRACTION HANDSHAKE: NO RESPONSE.', 2.4),
    L(K, 'Michael, hold on. Hold on. Give me one second, I have — that is not — hold ON —', 4.2),
    L(K, 'Right. Okay. I am going to tell you the truth immediately, because I have read the papers on this and the lying makes it worse.', 5.6),
    L(K, 'The extraction handshake requires your session to be marked COMPLETE. Something in the sync just marked it LOCKED instead, and the Pod does not have a verb for un-locking.', 7.2),
    L(K, 'It has exactly one verb. COMPLETE. Finish the course, all ten floors, and the door opens because it has nothing else it knows how to do.', 6.6),
    L(K, 'I cannot pull you out. Believe me, I am looking at the button. The button is grey.', 5),
    L(K, 'So we finish. You climb, I talk, and neither of us panics. Agreed? Excellent. I love a productive crisis.', 6),
  ],

  // ---- Per-floor arrival --------------------------------------------------
  floorStart: {
    0: [
      L(S, 'SUBLEVEL B1 — COLD STORAGE. TEMPERATURE NOMINAL. OCCUPANTS: NOT NOMINAL.', 4.6),
      L(K, 'The basement is where we keep the assets that did not test well. They are slow. They are patient. They have been here a while.', 6),
      L(K, 'There is a freight lift somewhere in here. It needs power. Find the breaker panels, pull them, and try not to die in the dark on your first day.', 6.8),
    ],
    1: [
      L(S, 'FLOOR 1 — THE SORTING FLOOR.', 3),
      L(K, 'Everything the Pod deletes passes through here first. Props, rooms, whole characters — they get sorted, and then they get gone.', 6.4),
      L(K, 'Some of them stopped getting gone. I would like it noted that I did not authorise a monarchy.', 5.6),
    ],
    2: [
      L(S, 'FLOOR 2 — THE SERVER FARM.', 3),
      L(K, 'This is where the Pod thinks. Try not to shoot the racks. Actually — shoot whatever you like, it is all simulated, I am being precious about a thing I made up.', 6.6),
      L(K, 'The machines up here are Service Androids. They were meant to bring you towels.', 5),
    ],
    3: [
      L(S, 'FLOOR 3 — AQUATICS LAB. FLOOD LEVELS: HIGH.', 3.6),
      L(K, 'Ah. The water floor. Michael, do not drink anything on this floor. I know that is a strange instruction for a simulation. Follow it anyway.', 6.4),
      L(K, 'There is a — there is a child up there. Sort of. He is not dangerous unless you get close, which you will have to, so. Sorry.', 6.2),
    ],
    4: [
      L(S, 'FLOOR 4 — THE NEON STRIP.', 3),
      L(K, 'I built this floor for the joy of it. A whole city block of signage and nowhere to go. My wife said it was the most "me" thing I had ever done and she did not mean it kindly.', 7.4),
      L(K, 'Something moved in and started charging rent. I have not been up here in years.', 5.2),
    ],
    5: [
      L(S, 'FLOOR 5 — THE ALPHA WING. ACCESS: RESTRICTED. OVERRIDE: PATIENT PRIORITY.', 4.4),
      L(K, '...Michael. Stop for a second.', 3),
      L(K, 'I need to tell you something, and I am going to tell it badly, because I have not practised it.', 5.2),
    ],
    6: [
      L(S, 'FLOOR 6 — THE GARDEN (APPROXIMATE).', 3.2),
      L(K, 'I asked the substrate for a garden. I gave it two reference images and a very tired description. This is what came back.', 6),
      L(K, 'Also there are two aliens in it. They are not mine. I want to be extremely clear that they are not mine.', 6),
    ],
    7: [
      L(S, 'FLOOR 7 — THE KILN. AMBIENT: 380°C SIMULATED.', 3.8),
      L(K, 'Heat is the cheapest way to make a place feel hostile. I am not proud of that. It works.', 5.2),
      L(K, 'There is a man up here I made in an afternoon. I never gave him a proper state. He has been between states ever since.', 6.4),
    ],
    8: [
      L(S, 'FLOOR 8 — HALL OF MIRRORS. REHEARSAL IN PROGRESS.', 3.8),
      L(K, 'This floor learns you. Everything in it will start moving the way you move. It is very effective and I hate it enormously.', 6.2),
      L(K, 'The thing at the end has been learning you since the basement.', 4.8),
    ],
    9: [
      L(S, 'FLOOR 9 — SUBSTRATE LAYER.', 3),
      L(K, 'You are inside the arithmetic now. Everything below this is a picture. Everything here is the thing drawing it.', 5.8),
      L(K, 'She is going to introduce herself in capital letters. She cannot help it.', 4.8),
    ],
    10: [
      L(S, 'FLOOR 10 — ROOT.', 2.8),
      L(K, 'Well. Here we are, then.', 3),
      L(K, 'Come up. I will explain everything, and then I will try very hard to kill you, and both of those are the same apology.', 6.2),
    ],
  },

  // ---- Objective completed on a floor ------------------------------------
  objectiveDone: {
    0: [L(K, 'Power is up. The lift is coming — but it is SLOW, and everything in this basement just heard it start. Hold that platform, Michael.', 7)],
    1: [L(K, 'Arms jammed. The stair is clear. Well done, genuinely — most people are still finding the light switch at this point.', 6)],
    2: [L(K, 'Heat vented. Stair lock released. See? Nothing to it.', 4.2)],
    3: [L(K, 'Pumps are running. Stairwell draining. Michael — the child is going to be in the last room. Please be quick about it.', 6)],
    4: [L(K, 'Four chips. The house always pays out eventually, it just insists on being asked at gunpoint.', 5.4)],
    5: [L(K, 'All four sessions logged out. Four of them. I said six earlier. I want you to notice that I said six.', 6)],
    6: [L(K, 'The garden has agreed to move aside. I did not know it could agree to things.', 5)],
    7: [L(K, 'Heat sinks clear. The shaft is climbable. Try not to look down, it is rendered surprisingly well.', 5.4)],
    8: [L(K, 'Marks hit. The rehearsal is over. Whatever is in the last room has been getting ready for you specifically.', 6)],
    9: [L(K, 'Buses freed. She is going to be extremely annoyed about that and she is going to be extremely loud about it.', 5.6)],
    10: [L(K, 'That is the last anchor. The door behind me is open. Come in.', 4.6)],
  },

  // ---- Boss defeated ------------------------------------------------------
  bossDown: {
    0: [],
    1: [L(K, 'You beat the Crook King. He was in the discard pile before the Pod had a name. I have never worked out what he was discarded FROM.', 7)],
    2: [L(K, 'Jim! Oh, poor Jim. He was a mascot concept. He was supposed to hold a clipboard.', 5.4)],
    3: [L(K, '...I am going to fix the tank. I am telling you that so that one of us has heard me say it.', 5.4)],
    4: [L(K, 'Nobody has ever said his full name back to him. You could have. It would have cost you nothing.', 5.6)],
    5: [
      L(K, 'Gorbus was not in the design document. Gorbus has never been in any document. I have stopped asking.', 5.8),
      L(K, 'He put up shelves in their wing, Michael. Somebody had to live there. Somebody did.', 5.6),
    ],
    6: [L(K, 'I have run the logs. There is no arrival record for those two. They are simply IN the garden and they always have been. Do not ask me again.', 7)],
    7: [L(K, 'Eight years between states. He asked what the afternoon was for. It was not for anything. That is the answer and I have never been able to say it.', 7.4)],
    8: [L(K, 'That was not a copy of you. That was the Pod\'s best guess, run four hundred times. You are the part it could not get.', 6.4)],
    9: [L(K, 'She will reboot. She always reboots. She will not remember the counting stopping, and I think that is a mercy.', 6)],
    10: [],
  },

  // ---- Floor 5: the reveal ------------------------------------------------
  betaReveal: [
    L(K, 'You are not the first trial patient. You are the first BETA patient. Those are different words and I chose the one that was true and let you hear the one that was not.', 8),
    L(K, 'There was an alpha group. Six people. Alpha one through alpha six. They went in eleven months before you did.', 6.6),
    L(K, 'Nobody died, Michael. I need that said first and loudly — nobody died. The Pod cannot kill you. Every time it beats you it simply puts you back at the start of the floor and it is very, very patient about it.', 8.6),
    L(K, 'They are all still in here. All six. Not because they cannot leave — because the door is COMPLETE, and to complete it you have to keep climbing, and one by one they stopped climbing.', 8.4),
    L(K, 'They found rooms they liked. They found jobs. One of them sweeps a floor. One of them runs a server farm and laughs about it. Four of them sit in a garden.', 7.6),
    L(K, 'They did not give up in one big moment. That is not how it goes. They gave up in about two hundred small ones.', 6.4),
    L(K, 'I am telling you now, on five, because five is where they each stopped. All six of them stopped on five.', 6.4),
    L(K, 'So. Do not get comfortable on this floor. Do not find a nice room. Keep climbing, Michael. Please.', 6),
  ],

  // ---- Ambient lines, drawn at random while you play ----------------------
  ambient: {
    0: [
      L(K, 'The lighting down here is bad on purpose. Testing showed people move more carefully in the dark. Testing was correct and unpleasant.', 6.4),
      L(K, 'Those things used to be part of the tutorial. They were meant to demonstrate walking.', 5.4),
      L(K, 'Do you know what the hardest part of building this was? The doors. Everything else was maths. The doors were carpentry.', 6),
    ],
    1: [
      L(K, 'Every object on this floor was made by someone who cared and then removed by someone in a hurry. Usually both of those were me.', 6.6),
      L(K, 'There is a chair up here I spent two weeks on. Two weeks, Michael. It is in a pile.', 5.4),
    ],
    2: [
      L(K, 'Rack forty-one runs hot. I keep meaning to look at that.', 4),
      L(K, 'The androids still try to hand you things. Watch their left hand. There is nothing in it. There never was.', 6),
    ],
    3: [
      L(K, 'The water is not real and it is also at forty percent, and I do not know how both of those can be true.', 5.6),
      L(K, 'You are going to hear tapping. Do not follow the tapping.', 4.4),
    ],
    4: [
      L(K, 'Every sign out there advertises a business that does not exist. I wrote all the names myself. "Fine Meats & Ideas" is my favourite.', 6.4),
      L(K, 'It is always 2 a.m. on this floor. That is not atmospheric. I could not get the clock to run.', 5.4),
    ],
    5: [
      L(K, 'Their badges still work. That is the part that gets me. Eleven months and the badges still work.', 5.6),
      L(K, 'Alpha two used to leave notes on the walls for the others. There are four hundred notes. They all say the same thing.', 6.2),
      L(K, 'You have gone further in an afternoon than three of them managed in a year. I do not know what to do with that.', 6.2),
      L(K, 'Somebody has hung curtains in here. Actual curtains. I need you to understand how far that is outside the specification.', 6.4),
    ],
    6: [
      L(K, 'Four of the alphas are in here. They are sitting down. They have been sitting down a long time. Do not take it personally if they do not look up.', 7),
      L(K, 'That is alpha two, by the bench. She wrote the notes. She has not stood up since 2043.', 6),
      L(K, 'The flowers are wrong. Not badly wrong. Just — wrong in a way you cannot point at.', 5.4),
      L(K, 'The tall one talks like a waiter and the round one talks like a foghorn. I have listened to nine years of it.', 6),
    ],
    7: [
      L(K, 'Somebody swept up here for eight years. Nobody assigned that. He simply started.', 5.6),
      L(K, 'The ash is procedural. The footprints in it are not.', 4.6),
      L(K, 'Careful with the soft ones. They come off him and they keep going. I have never understood why they keep going.', 6),
    ],
    8: [
      L(K, 'It has your gait now. Give it another minute and it will have your flinch.', 5),
      L(K, 'Everything on this floor is rehearsing to be you. There is no audience. That never seems to bother it.', 6),
      L(K, 'It picks up whatever you are carrying. If you want it to be bad at something, be bad at something.', 6.2),
    ],
    9: [
      L(K, 'She counts everything. Every particle, every footstep, every time I sigh. She has a number for that. She has told me the number.', 6.4),
      L(K, 'Beneath this is just numbers. I keep saying that like it is reassuring.', 5),
    ],
    10: [
      L(K, 'I compiled myself in an afternoon. He compiled me. I keep switching. It is a bad habit of the format.', 6),
      L(K, 'Four hundred and eleven attempts. I remember every one and I am not sure I was meant to.', 5.8),
    ],
  },

  // ---- Reactive one-liners -------------------------------------------------
  lowHealth: [
    L(K, 'Michael. Michael. Cover. ANY cover.', 3),
    L(K, 'You are about to be put back at the start of this floor and I will have to make small talk about it.', 5),
    L(K, 'Breathe. It is simulated air but the reflex is real.', 4),
  ],

  playerDown: [
    L(S, 'PATIENT INCAPACITATED. FLOOR RESET. VITALS: SIMULATED, THEREFORE FINE.', 4.6),
    L(K, 'And you are back. Nothing is lost except the part of the afternoon you spent on that.', 5),
    L(K, 'This is what I meant about it being patient. It will do that forever. That is the trap, Michael. That is exactly the trap.', 6.2),
  ],

  synergyFound: [
    L(K, 'Oh — oh, those two work together. I did not put that in. The Pod worked it out on its own and I have never had the heart to remove it.', 6.6),
  ],

  desynergyFound: [
    L(K, 'Those two are not going to cooperate. They are not even going to be professional about it.', 5.2),
  ],

  babyEvolved: [
    L(K, 'It changed. It does that. I have never once seen the same ladder twice and I wrote the ladder.', 5.6),
  ],

  behemothFound: [
    L(K, '...you found the Behemoth. In the basement of a machine I built, on a floor I do not remember writing, there was a chest, and you opened it, and it gave you the Behemoth.', 8),
    L(K, 'Enjoy that. It only happens to people once.', 4),
  ],

  fakeFound: [
    L(K, 'Ha! Oh, no. Michael, I am so sorry. Look at it closely.', 4.4),
    L(K, 'That is the FAKe-47. There is a lowercase letter in the middle of the name. That is the only warning it gives.', 5.8),
  ],

  // ---- B1 finale: the freight lift holdout ---------------------------------
  holdoutStart: [
    L(S, 'FREIGHT LIFT — DESCENDING. ESTIMATED ARRIVAL: NINETY SECONDS.', 4.2),
    L(K, 'Stay on the platform. It only counts you if you are on the platform.', 4.6),
    L(K, 'Ninety seconds, Michael. I have watched people fail this in eleven.', 4.8),
  ],

  holdoutDone: [
    L(S, 'FREIGHT LIFT — ARRIVED. ASCENDING TO FLOOR 1.', 4),
    L(K, 'There. Out of the basement. Nobody gets to call you a beginner anymore.', 5),
  ],

  // ---- Endgame -------------------------------------------------------------
  victory: [
    L(S, 'COURSE COMPLETE. EXTRACTION HANDSHAKE: ACCEPTED.', 4),
    L(S, 'PATIENT MANIFEST — SANDLOR, M. (BETA-01). CLEARED.', 3.6),
    L(S, 'ALPHA-01 THROUGH ALPHA-06. CLEARED. ALL SESSIONS TERMINATING.', 4.6),
    L(W, 'ALPHA-04: ...it opened. It actually opened. Nine years and it just — opened.', 5.2),
    L(W, 'ALPHA-04: Four of them are standing up. In the garden. They are STANDING UP.', 5),
    L(W, 'CROCODILE JIM: HA! I am handing in the LANYARD! I am handing it to NOBODY! HA!', 5),
    L(W, 'GORBUS: does — does this mean i have to move out? i have shelves. i will take the shelves.', 5.4),
    L(K, 'Dr. Kimvatch left a message on the exit handler. It has been sitting there for six years. It is one line.', 6),
    L(K, '"If anyone ever finishes: I am sorry it took the whole building to say it."', 5.6),
    L(S, 'INHIBITED ABYSS — SESSION ENDS.', 4),
  ],
};

/** Fisher-Yates-free helper: pick a line set without repeating until exhausted. */
export class AmbientPool {
  constructor(lines) {
    this.all = lines || [];
    this.remaining = [];
  }
  next(rng) {
    if (!this.all.length) return null;
    if (!this.remaining.length) this.remaining = this.all.slice();
    const i = Math.floor((rng ? rng() : Math.random()) * this.remaining.length);
    return this.remaining.splice(i, 1)[0];
  }
}
