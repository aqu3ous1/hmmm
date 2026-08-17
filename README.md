# Inhibited Abyss

A 3D first-person roguelite shooter — *Enter the Gungeon*'s random-weapon chest
runs crossed with *Call of Duty: Zombies*' wave defence, wrapped around a story
about a man who cannot log out.

You are **Michael Sandlor**, the first *beta* patient of the **Techno Training
Pod 9001**. You wake in the dark with one chest lit in front of you. Eleven
floors later you find out what that word — beta — was standing in front of.

Runs in any modern browser. No build step, no network calls, no asset files:
every mesh, every sound, every level and the whole post-processing chain are
generated at runtime from the three.js core.

---

## Running it

The game is ES modules, so it needs to be served over HTTP (opening
`index.html` from disk will be blocked by the browser's module CORS rules).

```bash
npm start          # http://localhost:8080
```

Headphones recommended — the music and every sound effect are synthesised live
in the Web Audio API and react to what's happening around you.

### If the server seems to be serving an old version

It almost certainly isn't — your browser is. **Do not use
`python3 -m http.server`** for this project: it sends `Last-Modified` but no
`Cache-Control`, so browsers fall back to *heuristic* caching for `.js` and
`.css`. A normal refresh then re-fetches `index.html` and quietly reuses every
cached ES module underneath it, which looks exactly like a stale deploy.

`npm start` runs `tools/serve.mjs`, a small dependency-free static server that
sends `Cache-Control: no-store` and the correct MIME types, so a plain refresh
always gets what is on disk.

To confirm which build you are looking at, without guessing:

- the **title screen** shows `BUILD n · NAME` in the bottom-right corner;
- the console logs `Inhibited Abyss — build n — name (date)` at boot;
- the server prints the build and the git commit when it starts;
- `npm run check:serve` boots the game through that server headlessly and
  reports the build it actually loaded.

Both values come from `src/version.js`. If the stamp on screen doesn't match
what you just shipped, it's a cache — hard-reload (`Ctrl`/`Cmd` + `Shift` + `R`),
or open DevTools ▸ Network ▸ *Disable cache*.

If you are hosting this somewhere else, make sure that host sends `no-store`
(or a real cache-busting scheme) for `.js` and `.css`. Versioning only the entry
points is not enough here — nested module imports are resolved relative and
would still be served from cache.

---

## Controls

| Key | Action |
| --- | --- |
| `W A S D` | Move |
| Mouse | Look |
| Left click | Fire / swing |
| `Shift` | Sprint |
| `Space` | Jump |
| `Ctrl` / `C` | **Dodge roll** — brief invulnerability, 1s cooldown |
| `R` | Reload |
| `Q` | Swap weapon · `1` `2` select a slot directly |
| `E` | Interact — chests, panels, vendors, the lift |
| `F` | Drop the active weapon |
| `Tab` | Hold for full loadout and synergy breakdown |
| `M` | Mute · `Esc` pause |

---

## The rules of the climb

**Two weapons, never the ones you asked for.** Each floor has two chests. Each
chest runs a slot-machine reel — weapons rise out of it flashing faster and
faster, slow down, and lock onto one, which hangs in the air for a beat before
it drops into your hands. You have two hands. Something always gets left behind.

**Synergies are found, not chosen.** Certain pairs of weapons power each other
up. Certain pairs refuse to cooperate and *both* get worse — those are the meme
pairs, and the only fix is to swap one out. There are 15 synergies and 9
desynergies, and they don't apply to every gun, so the mixing and matching is
the game.

**Every floor asks for something different.** The final room stays sealed until
you finish that floor's objective, and no two floors want the same thing:

| Floor | What it wants |
| --- | --- |
| **B1** Cold Storage | Engage three breaker panels and hold the ground around each |
| **1** The Sorting Floor | Find the manifest, then jam four arms in the order it gives |
| **2** The Server Farm | Four cooling valves, unmarked, tucked in the corners of the racks |
| **3** Aquatics Lab | Carry four pump cores to the drains — both hands, so no shooting |
| **4** The Neon Strip | Take four House Chips off the elites carrying them |
| **5** The Alpha Wing | Log out four abandoned sessions |
| **6** The Garden | Watch the bloom sequence, then play it back |
| **7** The Kiln | Hold all four heat sinks open at once, against a clock |
| **8** Hall of Mirrors | Hit five stage marks and end the rehearsal |
| **9** Substrate Layer | Free every bus — each one drags its two neighbours with it |
| **10** Root | Sever three anchors and open the last door |

Get a sequence wrong, let the Kiln's clock run out, or touch the wrong bloom,
and the floor notices.

**There is a layer under all of that.** Every floor hides maintenance logs in
dead ends, one locked cache whose key is deliberately as far from it as the
floor allows, and one thing that is only there to be found. None of it is on
the compass and none of it is required. The **Archive** on the title screen
keeps what you have recovered, and blanks for what you haven't.

**Headshots pay.** Every enemy and boss carries a head hitbox taken straight
from its model. Landing one is 2.5x on most weapons, 3.2x on the Desert Eagle
and 3x on the Actuary — with its own sound, its own spray, and its own callout,
so you never have to read a number to know you got it. The Actuarial Table
synergy adds another 60% on top.

**Shards are the currency.** Kills pay out. Vend-o-Trons sell ammo, medical
patches, and a re-roll of whatever is in your active hand — prices climb each
time you use one.

**Dying costs the floor, not the run.** The Pod cannot kill you. It just puts
you back at the start of the floor, forever, patiently. That is the whole
problem, and the story knows it.

A floor runs about 20–30 minutes at a moderate pace. The full climb is a long
sitting.

---

## The floors

| | Floor | Boss |
| --- | --- | --- |
| **B1** | Cold Storage | *(prologue — ends with the freight-lift holdout)* |
| **1** | The Sorting Floor | The Crook King |
| **2** | The Server Farm | Laughing Crocodile Jim |
| **3** | Aquatics Lab | Fish Kid |
| **4** | The Neon Strip | Texas Vegas Raider the Fearsome |
| **5** | The Alpha Wing | Gorbus The Slimebody |
| **6** | The Garden (approximate) | Synar & Gwynak |
| **7** | The Kiln | The Man With Gelatin Fingers |
| **8** | Hall of Mirrors | Doppelgänger |
| **9** | Substrate Layer | MOTHERBOARD, She Who Computes |
| **10** | Root | Dr. Kimvatch (Root Process) |

Each floor has its own palette, fog, prop set, enemy roster, music mode and
tempo, its own objective, and its own pieces of the story. Boss fights open
with a cutscene — the door sealing behind you, an arc around whatever is in
the room, and a settle back to eye level as it starts talking. Any key skips
it. Two bosses have bespoke mechanics:
**Synar & Gwynak** tag each other in and out of the ring mid-fight, and the
**Doppelgänger** mirrors whatever weapon *you* are currently holding.

---

## The arsenal

Twenty-two weapons, each with something only it does.

**Reliable** — Knuckles (free, fast, +18% move speed) · AK-47 · Desert Eagle ·
Room Broom (shotgun).

**Blades** — Staggeringly Large Knife (cleaves a wide arc) · Staggeringly Tiny
Knife (4× damage from behind) · Sanguine Ledger (drains health to heal you, then
quietly collects the debt back) · Custodian's Mop (kills leave a slowing slick).

**Strange** — Nimbo Jumbus (turns enemies into harmless jumbos that then burst)
· Sandwich Machine (misses become healing pickups; enemies stop to eat them) ·
The Grappler (yanks light enemies in, yanks *you* to walls and heavy ones) ·
Reel Talk (harpoon; pierces and bleeds) · Bug Zapper Mk. Eleven (chain
lightning) · Circular Reasoning (ricocheting sawblades that gain damage per
bounce) · The Actuary (charge rifle, pierces everything at full charge).

**Jokes that bite** — FAKe-47 (looks exactly like an AK until it matters) · The
Intern (ramps up the longer you hold the trigger) · Compliance Officer (damage
scales with your unspent shards) · Null Pointer (sometimes hits nothing;
sometimes deletes the target outright) · Kimvatch's Prototype (rerolls its own
behaviour every single shot).

**Baby's First Gun** evolves through six stages as it earns kills — Toddler's
Trusty Blaster, Teen Angst Cannon, Working Adult's Sidearm, Midlife Crisis
Magnum, and finally **Grandpa's Last Gun**.

**The Behemoth** is the best gun in the Pod. It is not common.

The title screen has a full **Weapon Codex** if you want to read them all first.

---

## Layout

```
index.html          markup for the HUD and every screen
styles.css          the Pod's own instrumentation look
vendor/             three.js r169 (module build) + its licence
src/
  main.js           game orchestration: floors, waves, interaction, screens
  version.js        the build stamp shown on the title screen
  core/             input (pointer lock), procedural audio, math + RNG
  world/            floor configs, level generation, per-floor objectives,
                    the optional lore/cache/curio layer, geometry helpers
  entities/         player controller, enemy AI + flow-field pathing, bosses
  combat/           weapon data, synergy resolution, firing runtime, projectiles
  props/            the chest and its slot-machine reveal
  render/           every mesh in the game, the gun parts bin, the cutscene
                    director, the environment probe + the post-processing chain
  fx/               particles, rings, tracers, damage numbers
  story/            Dr. Kimvatch's script and the floor beats
  ui/               HUD bindings, codex, loadout panel
tools/              dev server, headless smoke test, visual probes, perf probe
```

Some notes on how it works, in case you want to poke at it:

- **Levels** are carved out of a coarse tile grid. Collision, line of sight,
  bullet raycasts, and the boss-room seal are all just grid lookups, which is
  why doorways, pillars and odd room shapes all behave the same way.
- **Enemies** navigate a breadth-first flow field rebuilt from the player's tile
  a few times a second, so they route around corners instead of hugging walls.
- **Weapons** keep their special behaviour in a `traits` list rather than in
  closures, which lets the synergy layer rewrite stats and add or remove traits
  without any weapon knowing that happened.
- **Rendering** goes through a hand-written post chain (`src/render/postfx.js`):
  the scene draws into an HDR target, a three-level bloom ladder picks up
  everything emissive, and one composite pass does ACES tonemapping, per-floor
  colour grading, vignette, chromatic aberration, grain and scanlines. The
  damage response and the story's glitch beats are uniforms on that pass.
- **Level surfaces** are emitted as individual quads carrying baked per-corner
  ambient occlusion in their vertex colours, and only the wall faces that
  actually front open space are built at all — fewer triangles than boxes, and
  far more depth.
- **Every enemy and boss is modelled individually** rather than from a shared
  humanoid template, because silhouette is the only thing that reads at combat
  distance. Each model also declares where its head is, and the headshot test
  uses that volume directly. Surfaces come from the enemy's family, so flesh,
  machine, creature and anomaly reflect light differently instead of being the
  same plastic in four colours.
- **Weapons are built from a parts bin** (`src/render/weaponKit.js`): receivers,
  barrels, picatinny rails, fasteners, magazines, grips, sights, optics and
  muzzle devices, assembled into 22 guns of 25–136 parts each. Slides, bolts,
  cylinders, drums and magazines are separate sub-assemblies, so they cycle when
  you fire and drop when you reload.
- **Structure is neutral and the light carries the colour.** Deriving the floor,
  the walls and the ceiling from the floor's palette hue — and then multiplying
  that hue again through the ambient, the hemisphere, the fixtures, the
  reflections and the grade — is what turned the Server Farm into one flat green
  sheet. Now the fixtures are the floor's colour and everything filling in
  around them sits opposite on the wheel.
- **Audio** is entirely synthesised: gunshots are filtered noise bursts shaped
  per weapon, and the score is a scheduled arpeggiator whose scale, tempo and
  timbre come from the floor config, with density that rises as enemies close in.

---

## Tests

```bash
npm install          # playwright, dev-only
npm test             # the full climb
npm run check:serve  # boots through the real dev server, reports the build
```

Boots the game in headless Chromium, opens the prologue chest through the real
interaction path, then plays every floor: fights with whatever the chests hand
it, force-completes each objective, spins both chests, triggers every attack
pattern of every boss, kills it, and rides the lift up. It fails on any console
error or page exception, checks that all 24 synergy rules resolve to finite
stats, and verifies that aiming at a head does meaningfully more damage than
aiming at a torso.

`--shots` writes screenshots to `tools/shots/`.

Two more probes, for looking at things rather than asserting on them:

```bash
node tools/look.mjs --all                 # one screenshot per floor
node tools/look.mjs --floor 4 --weapon nimbo
node tools/look.mjs --floor 2 --raw       # same frame with post-processing off
node tools/cast.mjs                       # contact sheet of all 18 enemies
node tools/cast.mjs --bosses              # …and the 10 bosses
node tools/guns.mjs                       # …and all 22 weapons
node tools/guns.mjs ak47 deagle --angle 1.2
node tools/vm.mjs behemoth                # one weapon's viewmodel, isolated
node tools/pick.mjs 4                     # what mesh is under these screen points
node tools/perf.mjs                       # draw calls, triangles, frame timing
```

Note that headless Chromium falls back to a software rasteriser, so the frame
rate those tools report is not representative — the useful numbers are the draw
call and triangle counts (roughly 20–60 draws and ~190k triangles per floor).
