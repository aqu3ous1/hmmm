// Inhibited Abyss — entry point and game orchestration.

import * as THREE from '../vendor/three.module.js';

import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { Ambience } from './core/ambience.js';
import { makeRng, hashSeed, clamp, damp, formatTime, swapRemove, weightedPick, TAU } from './core/util.js';

import { floorConfig, FLOOR_COUNT } from './world/floors.js';
import { generateLayout, Level, CELL, WALL_H, GRID } from './world/level.js';
import { objectiveKind } from './world/objectives.js';
import { LORE, ALL_LORE, EGGS, buildTerminal, buildCache, buildCacheKey, buildEgg } from './world/secrets.js';
import { contractFor } from './world/contracts.js';
import {
  disposeTree, mergeGeometries, paintRGB, xform, UNIT,
} from './world/geometry.js';

/**
 * Fold an alpha into a colour.
 *
 * Under additive blending the source contributes `colour × alpha`, so a colour
 * scaled by its intended opacity, drawn at alpha 1, is pixel-identical — and it
 * lets a whole set of differently-transparent panels share one material.
 */
function premultiply(hex, alpha) {
  const r = Math.round(((hex >> 16) & 255) * alpha);
  const g = Math.round(((hex >> 8) & 255) * alpha);
  const b = Math.round((hex & 255) * alpha);
  return (r << 16) | (g << 8) | b;
}

import { Player } from './entities/player.js';
import { Enemy, FlowField } from './entities/enemy.js';
import { Boss } from './entities/boss.js';
import { BOSS_ORDER } from './entities/bossTypes.js';

import { ProjectileSystem } from './combat/projectiles.js';
import { Particles, DamageNumbers } from './fx/particles.js';
import { WEAPONS, makeWeapon, chestPool, RARITY_COLORS, RARITY_NAMES } from './combat/weapons.js';
import { evaluatePairing, pairingSummary } from './combat/synergy.js';
import { WeaponRuntime } from './combat/weaponRuntime.js';

import { Chest, WeaponIconCache } from './props/chest.js';
import { buildNode, buildLift, buildPickup, buildWeaponModel } from './render/models.js';
import { buildHands, holdFor, KIT_HAND_SCALE } from './render/hands.js';

// Where the firing hand sits in the viewmodel holder, for every weapon. Fixed,
// because hands that move around between weapons is what a floating prop looks
// like even once you have modelled the hands.
const HAND_REST = { y: -0.02, z: -0.10 };

import { PostFX } from './render/postfx.js';
import { Director, shot } from './render/director.js';
import { TitleScene } from './render/titleScene.js';
import { EnvironmentBuilder } from './render/env.js';
import { BUILD, BUILD_NAME, BUILD_DATE } from './version.js';
import { HUD, buildCodex, renderLoadoutDetail } from './ui/hud.js';
import { STORY, AmbientPool } from './story/script.js';

const MAX_ENEMIES = 30;
const $ = (id) => document.getElementById(id);
const _hslTmp = { h: 0, s: 0, l: 0 };

class Game {
  constructor() {
    this.canvas = $('view');
    this.hud = new HUD();
    this.cine = new Director(this.hud);
    this.ambience = new Ambience(audio);

    // Accessibility settings. Held here rather than read from the DOM at the
    // call site, so the game logic never has to know a slider exists.
    this.opts = {
      shake: 1,        // screen shake scale
      bob: 1,          // camera bob / sway scale
      flash: 1,        // muzzle flash, screen flash and glitch intensity
      tapHold: false,  // complete hold-to-engage on a single press
      skipCine: false, // play story as dialogue, without the camera
      colour: 'none',
    };
    this.input = new Input(this.canvas);
    this.state = 'title';         // title | playing | paused | dead | floorcard | victory
    this.now = 0;
    this.runTime = 0;
    this.floorTime = 0;
    this.floorIndex = 0;
    this.seed = (Math.random() * 1e9) | 0;

    this.enemies = [];
    this.boss = null;
    this.chests = [];
    this.nodes = [];
    this.secrets = [];
    this.corpses = [];
    this.contract = null;
    this.contractsDone = 0;
    this.floorToken = 0;
    this.foundLore = new Set();
    this.foundEggs = new Set();
    this.cacheKeys = 0;
    this.pickups = [];
    this.vendors = [];
    this.slicks = [];
    this.lift = null;

    this.dialogueQueue = [];
    this.dialogueTimer = 0;
    this.currentLine = null;
    this.ambientTimer = 26;
    this.ambientPools = new Map();

    this.glitchFired = false;
    this.betaRevealFired = false;
    this.seenSynergies = new Set();
    this.seenWeapons = new Set();

    this._initRenderer();
    this._initWorldScene();
    this._initViewmodel();
    this._initPlayer();
    this._wireUI();

    this.damageNumbers = new DamageNumbers($('dmgnums'), this.camera);
    this.runtime = new WeaponRuntime(this);

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._sep = { x: 0, z: 0 };
    this.muzzle = new THREE.Vector3();

    window.addEventListener('resize', () => this._resize());
    this._resize();

    // The menu renders the Pod itself, so it needs the renderer, the post
    // chain and the environment probe — all of which exist by now.
    this._ensureTitleScene();

    this._last = performance.now();
    requestAnimationFrame((t) => this._frame(t));

    setTimeout(() => $('loadingScreen').classList.add('hidden'), 420);
  }

  // =======================================================================
  // Setup
  // =======================================================================

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;   // we render twice per frame; reset manually
    this.renderer.setClearColor(0x000000, 1);
    // The scene renders linear into an HDR target; PostFX owns exposure,
    // tonemapping and the sRGB encode.
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.post = new PostFX(this.renderer);
    // Image-based lighting: without something to reflect, physically shaded
    // materials look worse than Lambert, not better.
    this.env = new EnvironmentBuilder(this.renderer);
  }

  _initWorldScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.06, 260);
    this.camera.rotation.order = 'YXZ';

    // three.js dropped the legacy PI light scaling in r155, so every intensity
    // here is roughly PI times what the old default would have been.
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.hemi = new THREE.HemisphereLight(0x9fc4ff, 0x121820, 0.42);
    this.scene.add(this.ambientLight, this.hemi);

    // Torch that follows the player — the primary readable light source.
    this.torch = new THREE.PointLight(0xfff0d8, 2.4, 15, 1.5);
    this.scene.add(this.torch);

    // A small pool of static lights snapped to the nearest ceiling panels.
    this.roomLights = [];
    for (let i = 0; i < 7; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 15, 1.7);
      l.visible = false;
      this.scene.add(l);
      this.roomLights.push(l);
    }
    this._lightTimer = 0;

    this.projectiles = new ProjectileSystem(this.scene);
    this.particles = new Particles(this.scene);

    this.propGroup = new THREE.Group();
    this.scene.add(this.propGroup);
  }

  _initViewmodel() {
    // Weapons render in their own scene on top so they never clip through walls.
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(62, 1, 0.01, 12);
    this.vmScene.add(new THREE.AmbientLight(0xffffff, 1.7));
    const key = new THREE.DirectionalLight(0xfff4e2, 3.2);
    key.position.set(-0.6, 1.2, 1);
    const rim = new THREE.DirectionalLight(0x8fbfff, 1.8);
    rim.position.set(1, -0.3, -1);
    const fill = new THREE.DirectionalLight(0xffd8a8, 1.1);
    fill.position.set(0.2, -1, 0.6);
    this.vmScene.add(key, rim, fill);

    // Weapon models are authored at roughly world scale; held this close to the
    // lens they have to be shrunk or a rifle fills the whole screen.
    this.vmHolder = new THREE.Group();
    this.vmHolder.scale.setScalar(0.4);
    this.vmScene.add(this.vmHolder);
    this.vmModel = null;
    // Hands live beside the model rather than inside it, so that the model's
    // own scale normalisation and its spin (miniguns) do not drag them along.
    // A hand is a fixed real-world size no matter what it is holding.
    this.vmHands = null;
    this.vmSwing = 0;
    this.vmKick = 0;
    this.vmSwapT = 1;
    this.vmReloadPose = 0;
  }

  _initPlayer() {
    this.player = new Player();
    this.player.fists = makeWeapon('knuckles');
    this.pairing = evaluatePairing(this.player.fists, this.player.fists);
    this.runtime = new WeaponRuntime(this);
  }

  _wireUI() {
    buildCodex();
    // Stamp the build so a stale cache is obvious rather than mysterious.
    this.version = `build ${BUILD} — ${BUILD_NAME} (${BUILD_DATE})`;
    const stamp = $('buildStamp');
    if (stamp) stamp.textContent = `BUILD ${BUILD} · ${BUILD_NAME.toUpperCase()}`;
    console.log(`%cInhibited Abyss — ${this.version}`, 'color:#ffc24a');
    const show = (id) => { for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden'); if (id) $(id).classList.remove('hidden'); };
    this.showScreen = show;

    $('btnStart').onclick = () => { audio.init(); this.startRun(); };
    $('btnHow').onclick = () => { audio.init(); show('howScreen'); this._backTo = 'titleScreen'; };
    $('btnCodex').onclick = () => { audio.init(); show('codexScreen'); this._backTo = 'titleScreen'; };
    $('btnArchive').onclick = () => { audio.init(); this._renderArchive(); show('archiveScreen'); this._backTo = 'titleScreen'; };
    for (const b of document.querySelectorAll('button.back')) {
      b.onclick = () => show(this._backTo || 'titleScreen');
    }
    $('btnResume').onclick = () => this.resume();
    $('btnPauseHow').onclick = () => { show('howScreen'); this._backTo = 'pauseScreen'; };
    $('btnQuit').onclick = () => this.toTitle();
    $('btnRespawn').onclick = () => this.respawn();
    $('btnVictory').onclick = () => this.toTitle();

    $('volMaster').oninput = (e) => audio.setVolume(e.target.value / 100);
    $('volMusic').oninput = (e) => audio.setMusicVolume(e.target.value / 100);
    $('volSfx').oninput = (e) => audio.setSfxVolume(e.target.value / 100);
    $('sens').oninput = (e) => { this.input.sensitivity = (e.target.value / 100) * 0.002; };

    $('optShake').oninput = (e) => { this.opts.shake = e.target.value / 100; };
    $('optBob').oninput = (e) => { this.opts.bob = e.target.value / 100; };
    $('optText').oninput = (e) => {
      document.documentElement.style.setProperty('--uiScale', String(e.target.value / 100));
    };
    $('optFlash').onchange = (e) => {
      this.opts.flash = e.target.checked ? 0.25 : 1;
      // The grain and scanline are part of the same complaint.
      this.post.set('grain', e.target.checked ? 0.004 : 0.016);
      this.post.set('scanline', e.target.checked ? 0.006 : 0.022);
    };
    $('optHold').onchange = (e) => { this.opts.tapHold = e.target.checked; };
    $('optCine').onchange = (e) => { this.opts.skipCine = e.target.checked; };
    $('optColour').onchange = (e) => {
      this.opts.colour = e.target.value;
      this.post.setColourMode(e.target.value);
    };

    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing' && !this.input.locked) this.input.requestLock();
    });
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'playing') this.pause();
    };
  }

  /** Build the menu corridor once, the first time the title screen shows. */
  _ensureTitleScene() {
    if (this.titleScene) return;
    this.titleScene = new TitleScene(this.renderer, this.env);
    this.titleScene.setSize(window.innerWidth, window.innerHeight);
    // Parallax: the corridor leans with the cursor, which makes a static menu
    // feel like a camera someone is holding.
    window.addEventListener('pointermove', (e) => {
      if (!this.titleScene || this.level) return;
      this.titleScene.setPointer(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1,
      );
    });
  }

  /** Tear the menu corridor down once a run starts — it is a lot of geometry. */
  _disposeTitleScene() {
    if (!this.titleScene) return;
    this.titleScene.dispose();
    this.titleScene = null;
  }

  _resize() {
    if (this.titleScene) this.titleScene.setSize(window.innerWidth, window.innerHeight);
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = w / h;
    this.vmCamera.updateProjectionMatrix();
    this.post.setSize(w, h, this.renderer.getPixelRatio());
    this.vw = w; this.vh = h;
  }

  // =======================================================================
  // Run / floor lifecycle
  // =======================================================================

  startRun() {
    this.seed = (Math.random() * 1e9) | 0;
    this.runTime = 0;
    this.floorIndex = 0;
    this.glitchFired = false;
    this.betaRevealFired = false;
    this.seenSynergies.clear();
    this.seenWeapons.clear();
    this.dialogueQueue.length = 0;
    this.currentLine = null;
    this.player = new Player();
    this.player.fists = makeWeapon('knuckles');
    this.runtime = new WeaponRuntime(this);
    this.damageNumbers.camera = this.camera;
    this._refreshPairing();
    this.prologue = true;
    this.loadFloor(0);
  }

  toTitle() {
    this.state = 'title';
    this.input.releaseLock();
    audio.stopMusic(0.8);
    this.hud.hide();
    this._ensureTitleScene();
    this.showScreen('titleScreen');
    this._clearFloor();
  }

  _clearFloor() {
    this.ambience.stop();
    // A cutscene outlives whatever it was framing unless it is cancelled here,
    // and a boss intro that survives the boss is a camera stuck on nothing.
    this.cine?.cancel();
    this.hud.setCinematic(false);
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0;
    if (this.boss) { this.boss.dispose(); this.boss = null; }
    for (const c of this.chests) c.dispose();
    this.chests.length = 0;
    for (const n of (this.stations || [])) {
      disposeTree(n.group); this.propGroup.remove(n.group);
      // Some kinds hang extra scenery off a station (the Hall of Mirrors puts
      // a spotlight column over the live mark); it is not inside the group.
      if (n.beam) { disposeTree(n.beam); this.propGroup.remove(n.beam); n.beam = null; }
    }
    for (const c of (this.carryCores || [])) { disposeTree(c.group); this.propGroup.remove(c.group); }
    if (this.seqManifest) { disposeTree(this.seqManifest.group); this.propGroup.remove(this.seqManifest.group); this.seqManifest = null; }
    if (this.circuitLines) { disposeTree(this.circuitLines); this.propGroup.remove(this.circuitLines); this.circuitLines = null; }
    for (const t of (this.secrets || [])) { disposeTree(t.group); this.propGroup.remove(t.group); }
    this.secrets = [];
    this.cacheKeys = 0;
    this.stations = [];
    this.carryCores = [];
    this.carrying = null;
    this.kind = null;
    this.timedClock = 0;
    this.player.carryPenalty = 1;
    this.hud.setTimer(null);
    this.nodes.length = 0;
    // Corpses outlived the floor they died on: still in the array, still
    // parented into propGroup, still being animated — so for the two seconds
    // it took them to decay they lay in mid-air in the *next* level, at the
    // coordinates of the room they were killed in.
    for (const c of (this.corpses || [])) this._retireCorpse(c);
    this.corpses.length = 0;
    for (const p of this.pickups) { disposeTree(p.group); this.propGroup.remove(p.group); }
    this.pickups.length = 0;
    for (const v of this.vendors) { disposeTree(v.group); this.propGroup.remove(v.group); }
    this.vendors.length = 0;
    for (const s of this.slicks) { disposeTree(s.mesh); this.propGroup.remove(s.mesh); }
    this.slicks.length = 0;
    if (this.lift) { disposeTree(this.lift.group); this.propGroup.remove(this.lift.group); this.lift = null; }
    if (this.iconCache) { this.iconCache.dispose(); this.iconCache = null; }
    if (this.barrierMesh) { disposeTree(this.barrierMesh); this.scene.remove(this.barrierMesh); this.barrierMesh = null; }
    if (this.chestLight) { this.scene.remove(this.chestLight); this.chestLight = null; }
    if (this.level) { this.level.dispose(); this.level = null; }
    this.projectiles.clear();
    this.particles.clear();
    this.damageNumbers.clear();
  }

  loadFloor(index) {
    this.state = 'floorcard';
    this.floorIndex = index;
    const cfg = floorConfig(index);

    this.showScreen('floorScreen');
    $('floorCardNum').textContent = index === 0 ? 'SUBLEVEL B1' : `FLOOR ${index}`;
    $('floorCardName').textContent = cfg.name.toUpperCase();
    $('floorCardSub').textContent = cfg.objective.verb;
    $('floorCardLoad').textContent = 'ASSEMBLING…';
    this.hud.hide();
    this.input.releaseLock();

    // Build on the next frame so the card actually paints first.
    setTimeout(() => {
      this._buildFloor(index, cfg);
      $('floorCardLoad').textContent = 'CLICK TO ENTER';
      const enter = () => {
        window.removeEventListener('click', enter);
        window.removeEventListener('keydown', enter);
        this._enterFloor(cfg);
      };
      window.addEventListener('click', enter);
      window.addEventListener('keydown', enter);
    }, 60);
  }

  _buildFloor(index, cfg) {
    this._disposeTitleScene();
    this._clearFloor();
    // Anything deferred by a timer on the previous floor is now stale.
    this.floorToken++;
    this.floorIndex = index;
    this.prologueActive = false;
    this._lightRamp = null;
    const rng = makeRng(hashSeed(`${this.seed}:${index}`));
    this.rng = rng;

    const layout = generateLayout(cfg, rng);
    this.level = new Level(layout, cfg, rng);
    this.scene.add(this.level.group);

    // Atmosphere
    const pal = cfg.palette;
    this.scene.fog = new THREE.FogExp2(pal.fog, pal.fogDensity);
    this.renderer.setClearColor(pal.fog, 1);
    this.ambientLight.intensity = cfg.ambient * 1.05;
    // Complementary key/fill. The floor's colour belongs to the *fixtures* —
    // they are the thing emitting it. The ambient and hemisphere sit on the
    // opposite side of the wheel so a surface is warm where the lamp reaches it
    // and cool where it doesn't. Tinting every light the same hue is what made
    // the Server Farm one flat green sheet: with nothing to contrast against,
    // a colour stops reading as light and starts reading as paint.
    const keyC = new THREE.Color(pal.light);
    const comp = new THREE.Color().setHSL(
      (keyC.getHSL(_hslTmp).h + 0.5) % 1, Math.min(0.42, _hslTmp.s * 0.7), 0.62);
    this.ambientLight.color.copy(new THREE.Color(0xffffff).lerp(comp, 0.5));
    this.hemi.color.copy(comp);
    this.hemi.groundColor.copy(new THREE.Color(0x14171c));
    this.hemi.intensity = 0.5;
    const envTex = this.env.build(pal);
    this.scene.environment = envTex;
    this.vmScene.environment = envTex;
    this.post.setGrade({
      tint: pal.light,
      bloom: pal.bloom ?? 0.7,
      exposure: pal.exposure ?? 1.08,
      saturation: pal.saturation ?? 1.04,
      contrast: pal.contrast ?? 1.2,
      vignette: pal.vignette ?? 0.52,
    });
    this.torch.color.setHex(0xffeed6);
    // The fixtures carry the palette at full strength — they are the only
    // thing in the room that is actually the floor's colour.
    const fixture = new THREE.Color(0xffffff).lerp(keyC, 0.7);
    for (const l of this.roomLights) l.color.copy(fixture);

    this.iconCache = new WeaponIconCache(this.scene);

    // Player spawn
    const spawnRoom = this.level.rooms[0];
    const spawnPos = this.level.roomCenter(spawnRoom);
    this.player.reset(spawnPos);
    this.player.yaw = rng() * TAU;
    this.player.pitch = 0;

    this.flow = new FlowField(this.level);
    this.flow.rebuild(spawnPos.x, spawnPos.z);

    // Chests
    const chestRooms = this.level.rooms.filter((r) => r.type === 'chest');
    if (index === 0 && this.prologue) {
      // The cold open: the only lit thing in the room is a chest.
      const p = this.level.roomCenter(spawnRoom);
      const c = new Chest(p, this.iconCache, { prologue: true, rollDuration: 4.4, channel: 0 });
      c.addToScene(this.scene);
      this.chests.push(c);
      if (chestRooms.length) this._addChest(chestRooms[chestRooms.length - 1]);
    } else {
      for (const r of chestRooms) this._addChest(r);
      while (this.chests.length < 2) {
        const pool = this.level.rooms.filter((r) => r.type !== 'spawn' && r.type !== 'boss');
        if (!pool.length) break;
        this._addChest(pool[rng.int(0, pool.length - 1)]);
      }
    }

    // Objective
    this._setupObjective(cfg, rng);

    // Boss room: sealed until the objective is done.
    this.bossRoom = this.level.rooms.find((r) => r.type === 'boss') || this.level.rooms[this.level.rooms.length - 1];
    this._sealBossRoom();

    // The optional layer needs to know where everything else went first.
    this._setupSecrets(cfg, rng);
    this._postContract(cfg, rng);

    this.lift = {
      group: buildLift(cfg.palette.trim),
      pos: this.level.roomCenter(this.bossRoom),
      active: false,
    };
    this.lift.group.position.copy(this.lift.pos);
    this.propGroup.add(this.lift.group);

    // Vend-o-Trons
    const vendRooms = rng.shuffle(this.level.rooms.filter((r) => r.type === 'ambush' || r.type === 'normal')).slice(0, 2);
    for (const r of vendRooms) this._addVendor(r, rng);

    // Roaming population
    this.enemyBudget = Math.round(16 + index * 3.2);
    this.spawnTimer = 3;
    if (!(index === 0 && this.prologue)) this._populate(cfg, rng, Math.min(14, 6 + index));

    // Floor state
    this.floorTime = 0;
    this.bossDefeated = false;
    this.bossSpawned = false;
    this.objectiveDone = false;
    this.holdout = null;
    this.ambientTimer = this._ambientGap();
    this.ambientPools.set(index, new AmbientPool(STORY.ambient[index] || []));
    this.hud.setFloor(cfg);
    this._updateObjectiveHud();
  }

  _enterFloor(cfg) {
    this.showScreen(null);
    this.hud.show();
    this.state = 'playing';
    this.input.requestLock();
    audio.init();
    audio.startMusic({ ...cfg.music, pad: true, arp: true, bass: true });
    // The Pod is a machine and every floor is a different part of it.
    this.ambience.start(cfg.id);

    if (this.floorIndex === 0 && this.prologue) {
      // Dark room. Only the chest glows.
      this.prologueActive = true;
      this.ambientLight.intensity = 0.05;
      this.hemi.intensity = 0.09;
      this.torch.intensity = 0.5;
      this.scene.fog.density = 0.15;
      for (const l of this.roomLights) { l.visible = false; l.intensity = 0; }
      this.chestLight = new THREE.PointLight(0x9fe4ff, 5.0, 18, 1.2);
      this.chestLight.position.copy(this.chests[0].pos).add(new THREE.Vector3(0, 1.4, 0));
      this.scene.add(this.chestLight);
      this._playOpening();
      this._queue(STORY.awaken);
    } else {
      this._queue(STORY.floorStart[this.floorIndex] || []);
      this.hud.banner(cfg.name.toUpperCase(), this.floorIndex === 0 ? 'SUBLEVEL B1' : `FLOOR ${this.floorIndex}`, 3.4);
    }
  }

  _addChest(room) {
    const p = this.level.randomPointIn(room, this.rng, 2.5);
    const c = new Chest(p, this.iconCache, { rotation: this.rng() * TAU, channel: this.chests.length });
    c.addToScene(this.scene);
    this.chests.push(c);
  }

  _addVendor(room, rng) {
    const kinds = [
      { id: 'ammo', label: 'AMMO RESUPPLY', cost: 160, color: 0xffd24a },
      { id: 'health', label: 'MEDICAL PATCH', cost: 260, color: 0x4affa0 },
      { id: 'reroll', label: 'RE-ROLL ACTIVE WEAPON', cost: 420, color: 0xff2ea6 },
    ];
    const kind = kinds[rng.int(0, kinds.length - 1)];
    const pos = this.level.randomPointIn(room, rng, 2.5);
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 2.3, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x2f3540, flatShading: true }),
    );
    body.position.y = 1.15;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.7),
      new THREE.MeshBasicMaterial({ color: kind.color, transparent: true, opacity: 0.85 }),
    );
    screen.position.set(0, 1.55, 0.46);
    group.add(body, screen);
    group.position.copy(pos);
    group.rotation.y = rng() * TAU;
    this.propGroup.add(group);
    this.vendors.push({ group, pos, kind, screen, used: 0 });
  }

  _setupObjective(cfg, rng) {
    const obj = cfg.objective;
    this.objective = {
      type: obj.type, label: obj.label, verb: obj.verb,
      total: obj.count, done: 0,
    };
    this.floorCfg = cfg;
    this.kind = objectiveKind(obj.type);
    this.stations = [];
    this.kind.setup(this, cfg, rng);
    // `nodes` is the only kind the rest of the game still reaches into by name.
    this.nodes = this.objective.type === 'nodes' ? this.stations : [];
  }

  /**
   * The optional layer: logs in dead ends, a locked cache whose key is on the
   * far side of the floor, and one oddity that is only there to be found.
   *
   * None of it is on the compass and none of it is required. Being told where
   * a secret is makes it an errand.
   */
  _setupSecrets(cfg, rng) {
    const level = this.level;
    const floor = this.floorIndex;
    // Rank rooms by how far off the critical path they are: a log in the room
    // you have to cross anyway is not a discovery.
    const busy = new Set([
      ...this.stations.map((s) => s.room?.id),
      ...this.chests.map((c) => level.roomAt(c.pos.x, c.pos.z)?.id),
      this.bossRoom?.id, level.rooms[0].id,
    ]);
    const quiet = rng.shuffle(level.rooms.filter((r) => !busy.has(r.id) && r.type !== 'boss'));
    const any = quiet.length ? quiet : rng.shuffle(level.rooms.filter((r) => r.type !== 'boss'));

    const spotIn = (room, margin = 2) => {
      // Prefer a wall, and prefer a wall you have to look for.
      const spots = level._wallSpots(room);
      if (spots.length) {
        const s = spots[rng.int(0, spots.length - 1)];
        return { pos: new THREE.Vector3(s.x, 0, s.z), ry: s.ry };
      }
      return { pos: level.randomPointIn(room, rng, margin), ry: rng() * TAU };
    };

    // --- lore terminals ---
    const entries = LORE[floor] || [];
    entries.forEach((entry, i) => {
      const room = any[i % any.length];
      if (!room) return;
      const { pos, ry } = spotIn(room);
      const group = buildTerminal(cfg.palette.emissive);
      group.position.copy(pos);
      group.rotation.y = ry;
      this.propGroup.add(group);
      this.secrets.push({ kind: 'lore', group, pos, entry, used: this.foundLore.has(entry.id) });
    });

    // --- a locked cache, and its key, as far apart as the floor allows ---
    if (any.length >= 2) {
      const cacheRoom = any[any.length - 1];
      const cs = spotIn(cacheRoom, 2.5);
      const cache = buildCache(cfg.palette.trim);
      cache.position.copy(cs.pos);
      cache.rotation.y = cs.ry;
      this.propGroup.add(cache);
      this.secrets.push({ kind: 'cache', group: cache, pos: cs.pos, opened: false });

      // Key goes in whichever remaining room is furthest from the cache.
      const keyRoom = any.slice(0, -1).reduce((a, b) => {
        const da = Math.hypot(a.cx - cacheRoom.cx, a.cz - cacheRoom.cz);
        const db = Math.hypot(b.cx - cacheRoom.cx, b.cz - cacheRoom.cz);
        return db > da ? b : a;
      });
      const ks = spotIn(keyRoom, 2);
      const key = buildCacheKey(cfg.palette.emissive);
      key.position.copy(ks.pos);
      key.position.y = 0.9;
      this.propGroup.add(key);
      this.secrets.push({ kind: 'key', group: key, pos: key.position.clone(), taken: false });
    }

    // --- one easter egg, in the least likely place on the floor ---
    const egg = EGGS[floor % EGGS.length];
    const eggRoom = any[Math.max(0, any.length - 2)] || any[0];
    if (egg && eggRoom) {
      const es = spotIn(eggRoom, 2);
      const group = buildEgg(egg.id, cfg.palette.emissive);
      group.position.copy(es.pos);
      group.rotation.y = es.ry;
      this.propGroup.add(group);
      this.secrets.push({ kind: 'egg', group, pos: es.pos, egg, found: this.foundEggs.has(egg.id) });
    }
  }

  /**
   * Take the mesh off a dead enemy and let it fall over.
   *
   * Enemies used to blink out of existence the instant their health hit zero,
   * which reads as a bug rather than as a kill — you never got the beat of
   * confirmation that tells you to stop shooting and move on. The rig is
   * detached from the entity (so nothing can path to it, shoot it or be hit by
   * it) and then toppled, sunk and faded on its own short timeline.
   */
  _makeCorpse(enemy) {
    const mesh = enemy.mesh;
    if (!mesh) { enemy.dispose(); return; }
    // Each corpse is a full rig, so it costs what a live enemy costs to draw.
    // Eight is enough that a good burst leaves a pile and few enough that it
    // cannot double the frame's draw calls during the heaviest wave. Retire the
    // oldest rather than refusing the newest: dropping the new one meant that
    // once the pile filled, the kill the player was looking at was the one that
    // vanished on the spot, while eight older ones lay around untouched.
    while (this.corpses.length >= 8) {
      // The most-decayed one, not index 0: _updateCorpses removes by swapping
      // the last element down, so array order stops meaning age after the
      // first expiry and `shift()` would start evicting fresh kills.
      let oldest = 0;
      for (let i = 1; i < this.corpses.length; i++) {
        if (this.corpses[i].t > this.corpses[oldest].t) oldest = i;
      }
      this._retireCorpse(this.corpses[oldest]);
      swapRemove(this.corpses, oldest);
    }
    // Hand the mesh over before dispose() can take it.
    enemy.mesh = null;
    enemy.dispose();

    // Fall away from whatever killed it, with a little spin.
    const p = this.player.pos;
    const away = Math.atan2(mesh.position.x - p.x, mesh.position.z - p.z);
    // Drop the contact shadow. It is one shared material across every enemy on
    // the floor now, so fading it here would fade all of them — and a corpse
    // sinking into the floor has no business casting a crisp shadow anyway.
    const shadow = mesh.children.find((c) => c.userData?.shadow);
    if (shadow) mesh.remove(shadow);
    const materials = [];
    mesh.traverse((o) => {
      if (!o.material) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        // Never write to a material the rest of the floor is also using.
        if (m.userData?.shared) continue;
        if (!materials.includes(m)) { m.transparent = true; materials.push(m); }
      }
    });
    this.corpses.push({
      mesh, materials, t: 0,
      life: enemy.type.family === 'machine' ? 1.5 : 1.9,
      fallAxis: away,
      spin: (Math.random() - 0.5) * 1.6,
      flying: !!enemy.type.flying,
      // Machines drop straight down and spark; flesh folds and sinks.
      machine: enemy.type.family === 'machine',
      sparked: false,
      startY: mesh.position.y,
    });
    this.propGroup.add(mesh);
  }

  _updateCorpses(dt) {
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.t += dt;
      const k = Math.min(1, c.t / c.life);
      const m = c.mesh;

      if (c.flying) {
        // Shot out of the air: drops, tumbling, and hits the floor hard.
        const fall = Math.min(c.startY, 9.8 * c.t * c.t * 0.5);
        m.position.y = c.startY - fall;
        m.rotation.z += dt * c.spin * 3;
        m.rotation.x += dt * 2.4;
        if (m.position.y <= 0.05 && !c.sparked) {
          c.sparked = true;
          this.particles.burst(m.position.x, 0.2, m.position.z, 10,
            { color: [0xffd24a, 0xffffff], speed: 5, size: 0.07, life: 0.4 });
          audio.hit('metal');
        }
      } else {
        // Topple: fast at first, then it settles into the floor.
        const topple = Math.min(1, c.t / (c.life * 0.42));
        const e = 1 - (1 - topple) * (1 - topple);
        m.rotation.x = Math.cos(c.fallAxis) * e * 1.55;
        m.rotation.z = -Math.sin(c.fallAxis) * e * 1.55;
        m.rotation.y += dt * c.spin * 0.35;
        m.position.y = -Math.max(0, k - 0.55) * 1.6;
      }

      if (c.machine && !c.sparked && c.t > c.life * 0.35) {
        c.sparked = true;
        this.particles.burst(m.position.x, m.position.y + 0.6, m.position.z, 8,
          { color: [0x9fe4ff, 0xffffff], speed: 4, size: 0.05, life: 0.35 });
      }

      // Fade out over the last third rather than popping.
      const fade = k < 0.66 ? 1 : 1 - (k - 0.66) / 0.34;
      for (const mat of c.materials) mat.opacity = Math.max(0, fade);

      if (k >= 1) {
        this._retireCorpse(c);
        swapRemove(this.corpses, i);
      }
    }
  }

  /** Free a corpse's rig. Shared by expiry and by the cap evicting the oldest. */
  _retireCorpse(c) {
    if (!c?.mesh) return;
    disposeTree(c.mesh);
    this.propGroup.remove(c.mesh);
    c.mesh = null;
  }

  /**
   * Post this floor's side contract on a board near the spawn.
   *
   * It is deliberately the first interactable you walk past: a contract you
   * find halfway through the floor is one you have already failed by accident,
   * which teaches players to ignore the board.
   */
  _postContract(cfg, rng) {
    const def = contractFor(this.floorIndex, rng);
    this.contract = null;
    // The previous floor's strip would otherwise sit there naming a contract
    // that no longer exists.
    this.hud.setContract(null);
    if (!def) return;
    const spawn = this.level.rooms[0];
    const spots = this.level._wallSpots(spawn);
    const s = spots.length ? spots[rng.int(0, spots.length - 1)] : null;
    const pos = s ? new THREE.Vector3(s.x, 0, s.z) : this.level.randomPointIn(spawn, rng, 2);
    const group = buildTerminal(0xffd24a);
    group.position.copy(pos);
    group.rotation.y = s ? s.ry : rng() * TAU;
    this.propGroup.add(group);
    this.contract = { def, group, pos, state: 'offered', st: null };
    this.secrets.push({ kind: 'contract', group, pos, contract: this.contract });
  }

  /** The posting itself, and the button that accepts it. */
  _showContract(c) {
    $('loreKind').textContent = 'FACILITIES POSTING';
    $('loreTitle').textContent = c.def.title;
    $('loreBody').textContent =
      `${c.def.posted}\n\nGOAL\n  ${c.def.goal}\n\nREWARD\n  ${c.def.reward.label}\n\n`
      + 'Accepting is optional and it can be failed. Nothing is taken from you\n'
      + 'if you decline, and nothing is given to you if you do not finish.';
    const card = $('loreCard');
    let accept = card.querySelector('.acceptRow');
    if (!accept) {
      accept = document.createElement('div');
      accept.className = 'acceptRow';
      accept.innerHTML = '<button id="btnAccept" class="primary">ACCEPT CONTRACT</button>'
        + '<button id="btnDecline">WALK AWAY</button>';
      card.insertBefore(accept, card.querySelector('.hint'));
    }
    accept.style.display = '';
    accept.querySelector('#btnAccept').onclick = () => {
      c.state = 'active';
      c.st = c.def.start(this);
      audio.ui(680);
      this.hud.toast(`CONTRACT ACCEPTED — ${c.def.title}`, 'good', 3);
      this.hud.setContract(c.def.title, c.def.progress?.(this, c.st) || '');
      accept.style.display = 'none';
      this._closeLore();
    };
    accept.querySelector('#btnDecline').onclick = () => {
      accept.style.display = 'none';
      this._closeLore();
    };
    this.showScreen('loreScreen');
    this.state = 'reading';
    this.input.releaseLock?.();
  }

  _updateContract(dt) {
    const c = this.contract;
    if (!c) return;
    const scr = c.group.userData.screen;
    if (c.state === 'offered') {
      scr.material.color.setHex(0xffd24a);
      scr.material.opacity = 0.4 + Math.sin(this.now * 2.6) * 0.18;
      return;
    }
    if (c.state !== 'active') { scr.material.opacity = 0.16; return; }
    scr.material.color.setHex(0x6fd8ff);
    scr.material.opacity = 0.42;

    if (c.def.failed?.(this, c.st)) {
      c.state = 'failed';
      scr.material.color.setHex(0xff4a5a);
      audio.deny();
      this.hud.toast(`CONTRACT FAILED — ${c.def.title}`, 'bad', 3.2);
      this.hud.setContract(null);
      return;
    }
    if (c.def.check(this, c.st)) {
      c.state = 'done';
      this.contractsDone++;
      this._payContract(c.def);
      return;
    }
    this.hud.setContract(c.def.title, c.def.progress?.(this, c.st) || '');
  }

  _payContract(def) {
    const r = def.reward;
    audio.levelUp();
    this.hud.setContract(null);
    this.hud.banner('CONTRACT COMPLETE', def.title, 3.4);
    this.hud.toast(`+ ${r.label}`, 'good', 4);
    if (r.shards) this.player.addShards(r.shards);
    if (r.maxHealth) {
      this.player.maxHealth += r.maxHealth;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + r.maxHealth);
    }
    if (r.heal) this.player.health = Math.min(this.player.maxHealth, this.player.health + r.heal);
    if (r.reroll) {
      // A free reroll of whatever is in the active hand — the Vend-o-Tron
      // charges for this and the price climbs, so it is worth real shards.
      const held = this.player.slots.filter(Boolean).map((w) => w.id);
      const pool = chestPool().filter((id) => !held.includes(id));
      const id = pool[this.rng.int(0, Math.max(0, pool.length - 1))];
      if (id) {
        this._equipWeapon(id);
        this.hud.toast(`REROLLED — ${WEAPONS[id].name}`, 'good', 3);
      }
    }
  }

  _updateSecrets(dt) {
    for (const s of this.secrets) {
      if (s.kind === 'key' && !s.taken) {
        s.group.rotation.y += dt * 1.6;
        s.group.position.y = 0.9 + Math.sin(this.now * 2.2) * 0.09;
        s.group.userData.halo.rotation.z += dt * 0.9;
      } else if (s.kind === 'lore') {
        const scr = s.group.userData.screen;
        scr.material.opacity = s.used ? 0.2 : 0.4 + Math.sin(this.now * 2.6) * 0.16;
      } else if (s.kind === 'cache') {
        s.group.userData.lamp.material.color.setHex(
          s.opened ? 0x4affa0 : (this.cacheKeys > 0 ? 0xffd24a : 0xff4a5a));
      } else if (s.kind === 'egg') {
        s.group.userData.halo.rotation.z += dt * 0.4;
        s.group.userData.halo.material.opacity = s.found ? 0.1 : 0.18 + Math.sin(this.now * 1.4) * 0.1;
      }
    }
  }

  /** Interaction targets for the optional layer. */
  _offerSecrets(consider) {
    const p = this.player;
    for (const s of this.secrets) {
      const d = Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z);
      if (s.kind === 'lore') {
        consider(null, d, s.used ? 'Read it again' : 'Read the terminal', () => this._readLore(s));
      } else if (s.kind === 'key' && !s.taken) {
        consider(null, d, 'Take the cache key', () => {
          s.taken = true;
          s.group.visible = false;
          this.cacheKeys++;
          audio.pickup();
          this.hud.toast('CACHE KEY — SOMETHING ON THIS FLOOR IS LOCKED', 'good', 3.4);
        });
      } else if (s.kind === 'cache' && !s.opened) {
        consider(null, d, this.cacheKeys > 0 ? 'Unlock the cache' : 'Locked — the key is elsewhere', () => {
          if (this.cacheKeys <= 0) {
            audio.deny();
            this.hud.toast('LOCKED', 'bad', 1.4);
            return;
          }
          this.cacheKeys--;
          s.opened = true;
          s.group.userData.lid.rotation.x = -1.1;
          s.group.userData.lid.position.z = -0.35;
          audio.levelUp();
          this._payCache(s);
        });
      } else if (s.kind === 'contract') {
        const c = s.contract;
        if (c.state === 'offered') {
          consider(null, d, `Read the posting — ${c.def.title}`, () => {
            this._showContract(c);
          });
        } else if (c.state === 'active') {
          consider(null, d, `${c.def.title} — ${c.def.progress?.(this, c.st) || 'in progress'}`, () => {
            this._showLore('ACTIVE CONTRACT', c.def.title,
              `${c.def.posted}\n\nGOAL\n  ${c.def.goal}\n\nPROGRESS\n  ${c.def.progress?.(this, c.st) || '—'}\n\nREWARD\n  ${c.def.reward.label}`);
          });
        }
      } else if (s.kind === 'egg' && !s.found) {
        consider(null, d, `Look closer`, () => {
          s.found = true;
          this.foundEggs.add(s.egg.id);
          audio.levelUp();
          this._showLore('CURIOSITY', s.egg.name, s.egg.note);
        });
      }
    }
  }

  /** The archive screen: everything found, and blanks for everything not. */
  _renderArchive() {
    const found = this.foundLore;
    const eggs = this.foundEggs;
    const rows = ALL_LORE.map((e) => {
      const has = found.has(e.id);
      const fl = e.floor === 0 ? 'B1' : `F${e.floor}`;
      return `<div class="archiveRow${has ? '' : ' locked'}">
        <div class="fl">${fl}</div>
        <div class="ti">${has ? e.title : '— NOT RECOVERED —'}</div>
        ${has ? `<div class="bd">${e.body.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</div>` : ''}
      </div>`;
    }).join('');
    const eggRows = EGGS.map((e) => {
      const has = eggs.has(e.id);
      return `<div class="archiveRow${has ? '' : ' locked'}">
        <div class="fl">ODD</div>
        <div class="ti">${has ? e.name : '— NOT FOUND —'}</div>
        ${has ? `<div class="bd">${e.note}</div>` : ''}
      </div>`;
    }).join('');
    $('archiveNote').textContent =
      `${found.size} of ${ALL_LORE.length} logs recovered · ${eggs.size} of ${EGGS.length} curiosities found. None of it was on the map.`;
    $('archiveList').innerHTML = rows + eggRows;
  }

  _readLore(s) {
    if (!s.used) {
      s.used = true;
      this.foundLore.add(s.entry.id);
      audio.ui(720);
      this.hud.toast(`ARCHIVE ${this.foundLore.size}/${ALL_LORE.length}`, 'good', 2);
    }
    this._showLore('RECOVERED LOG', s.entry.title, s.entry.body);
  }

  _showLore(kind, title, body) {
    const row = $('loreCard').querySelector('.acceptRow');
    if (row) row.style.display = 'none';
    $('loreKind').textContent = kind;
    $('loreTitle').textContent = title;
    $('loreBody').textContent = body;
    this.showScreen('loreScreen');
    this.state = 'reading';
    this.input.releaseLock?.();
  }

  _closeLore() {
    this.showScreen(null);
    this.state = 'playing';
    this.input.requestLock();
  }

  /** What a cache is worth: shards, a full heal, and a weapon you did not roll. */
  _payCache(s) {
    const cfg = floorConfig(this.floorIndex);
    const shards = 90 + this.floorIndex * 45;
    this.player.shards += shards;
    this.particles.ring(s.pos.x, 0.6, s.pos.z, { from: 0.5, to: 7, life: 0.9, color: cfg.palette.trim });
    this.hud.toast(`CACHE — ${shards} SHARDS`, 'good', 2.6);
    this._addPickup('health', new THREE.Vector3(s.pos.x + 0.9, 0, s.pos.z), 60);
    // A weapon you did not roll for — biased to something you are not holding.
    const held = this.player.slots.filter(Boolean).map((w) => w.id);
    const pool = chestPool().filter((id) => !held.includes(id));
    const id = pool[this.rng.int(0, Math.max(0, pool.length - 1))];
    if (id) this._dropWeaponPickup(id, new THREE.Vector3(s.pos.x - 1.0, 0, s.pos.z));
  }

  _sealBossRoom() {
    const level = this.level;
    const r = this.bossRoom;
    this.gateCells = [];
    const ring = [];
    for (let x = r.x - 1; x <= r.x + r.w; x++) { ring.push([x, r.z - 1]); ring.push([x, r.z + r.h]); }
    for (let z = r.z - 1; z <= r.z + r.h; z++) { ring.push([r.x - 1, z]); ring.push([r.x + r.w, z]); }
    // Two meshes for the whole seal, not eighty.
    //
    // Each doorway is a field plane, two frame bars, six scan lines and one
    // travelling bar. Built as separate meshes with their own materials that
    // came to ten meshes and ten materials per doorway, and a sealed boss room
    // has eight of them — eighty draw calls sitting on screen for the entire
    // fight, which was the single largest item in the frame after the enemies.
    // Everything static merges into one geometry; the travelling bars all scan
    // in phase, so they merge into a second one that simply moves in Y.
    //
    // The per-bar opacity folds into vertex colour instead. Under additive
    // blending the source contributes `colour × alpha`, so a colour premultiplied
    // by its old opacity against alpha 1 is the same pixel — and it collapses
    // four materials into one.
    const statics = [];
    const scans = [];
    const FIELD = 0xff4a5a, EDGE = 0xff6a5a;
    for (const [cx, cz] of ring) {
      if (level.isSolidCell(cx, cz)) continue;
      this.gateCells.push(cx + cz * GRID);
      level.grid[cx + cz * GRID] = 1;
      const wx = level.cellToWorldX(cx) + CELL / 2;
      const wz = level.cellToWorldZ(cz) + CELL / 2;
      // A barrier, not a fog bank. Filling the whole cell with translucent red
      // reads as a rendering artifact from any distance — a big soft slab of
      // colour with no edges. A thin plane in the doorway with a bright frame
      // and scan bars reads as a door that is shut.
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        // Only face the sides that open onto somewhere you could walk from.
        if (level.isSolidCell(cx + dx, cz + dz)) continue;
        const px = wx + dx * CELL * 0.48, pz = wz + dz * CELL * 0.48;
        const ry = Math.atan2(dx, dz);
        const panel = (y, h2, color, alpha, into) => into.push(paintRGB(
          xform(UNIT.plane, { x: px, y: WALL_H / 2 + y, z: pz, ry, sx: CELL, sy: h2 }),
          premultiply(color, alpha),
        ));
        panel(0, WALL_H, FIELD, 0.13, statics);
        panel(WALL_H / 2 - 0.06, 0.12, EDGE, 0.85, statics);
        panel(-WALL_H / 2 + 0.06, 0.12, EDGE, 0.85, statics);
        for (let k = 0; k < 6; k++) panel(-WALL_H / 2 + 0.5 + k * 0.72, 0.03, EDGE, 0.3, statics);
        // The travelling bar is authored at the panel's mid-height so the
        // whole merged sheet can be slid in Y as one object.
        panel(0, 0.09, EDGE, 1, scans);
      }
    }
    const glass = (parts) => new THREE.Mesh(
      mergeGeometries(parts),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, vertexColors: true, transparent: true,
        depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, toneMapped: false,
      }),
    );
    this.barrierMesh = new THREE.Group();
    if (statics.length) this.barrierMesh.add(glass(statics));
    if (scans.length) {
      const scan = glass(scans);
      scan.userData.scan = true;
      this.barrierMesh.userData.scan = scan;
      this.barrierMesh.add(scan);
    }
    this.scene.add(this.barrierMesh);
    this.bossSealed = true;
  }

  _unsealBossRoom() {
    if (!this.bossSealed) return;
    for (const idx of this.gateCells) this.level.grid[idx] = 0;
    this.bossSealed = false;
    if (this.barrierMesh) {
      disposeTree(this.barrierMesh);
      this.scene.remove(this.barrierMesh);
      this.barrierMesh = null;
    }
    audio.doorOpen();
    this.hud.toast('THE WAY UP IS OPEN', 'good', 2.4);
  }

  // =======================================================================
  // Enemies
  // =======================================================================

  _pickEnemyType(cfg) {
    return weightedPick(this.rng, cfg.enemies).id;
  }

  _populate(cfg, rng, count) {
    const rooms = this.level.rooms.filter((r) => r.type !== 'spawn' && r.type !== 'boss');
    for (let i = 0; i < count; i++) {
      const room = rooms[rng.int(0, rooms.length - 1)];
      if (!room) break;
      this._spawnEnemy(this._pickEnemyType(cfg), this.level.randomPointIn(room, rng, 2));
    }
  }

  _spawnEnemy(typeId, pos) {
    if (this.enemies.length >= MAX_ENEMIES) return null;
    const cfg = floorConfig(this.floorIndex);
    const e = new Enemy(typeId, pos, 0.85 + cfg.difficulty * 0.55);
    this.scene.add(e.mesh);
    this.enemies.push(e);
    return e;
  }

  /** A spawn point out of the player's sight, preferring nearby rooms. */
  _spawnPointNear(target, minDist = 12, maxDist = 42) {
    const rooms = this.level.rooms.filter((r) => r.type !== 'boss' || this.bossSpawned);
    for (let i = 0; i < 26; i++) {
      const room = rooms[this.rng.int(0, rooms.length - 1)];
      if (!room) break;
      const p = this.level.randomPointIn(room, this.rng, 1.6);
      const d = Math.hypot(p.x - target.x, p.z - target.z);
      if (d < minDist || d > maxDist) continue;
      if (this.level.lineOfSight(p.x, p.z, target.x, target.z) && d < 26) continue;
      return p;
    }
    // Fall back to anywhere far enough away.
    for (let i = 0; i < 20; i++) {
      const room = rooms[this.rng.int(0, rooms.length - 1)];
      if (!room) break;
      const p = this.level.randomPointIn(room, this.rng, 1.6);
      if (Math.hypot(p.x - target.x, p.z - target.z) > minDist) return p;
    }
    return null;
  }

  // =======================================================================
  // Frame
  // =======================================================================

  _frame(t) {
    requestAnimationFrame((n) => this._frame(n));
    const dtRaw = (t - this._last) / 1000;
    this._last = t;
    const dt = Math.min(0.05, Math.max(0.0005, dtRaw));
    this.now += dt;

    // The menu is a place, not a gradient: while there is no level, the title
    // corridor is what the renderer is pointed at.
    if (this.titleScene && !this.level) {
      this.titleScene.update(dt);
      this.post.render((target) => {
        this.renderer.setRenderTarget(target);
        this.renderer.clear();
        this.renderer.render(this.titleScene.scene, this.titleScene.camera);
      }, this.now);
      this.input.endFrame();
      return;
    }

    if (this.state === 'playing') {
      this.update(dt);
    } else if (this.state === 'reading') {
      // The world holds still while you read. Only the way out is live.
      if (this.input.pressed('Escape') || this.input.pressed('KeyE')) this._closeLore();
      this.hud.update(dt);
    } else if (this.state === 'paused' || this.state === 'dead') {
      this.hud.update(dt);
    }

    if (this.level) this.render();
    this.input.endFrame();
  }

  update(dt) {
    this.runTime += dt;
    this.floorTime += dt;
    const player = this.player;
    const input = this.input;

    // --- global keys ---
    // A cutscene swallows the controls. Any key skips it — a cinematic you
    // cannot get out of is one the player resents on the second run. Escape is
    // checked here rather than below, because the screen says ANY KEY and
    // Escape is the first key most people reach for; pausing instead would
    // freeze the camera mid-shot and make a liar of the prompt.
    if (this.cine?.active) {
      // Drain the look accumulator on the way out. Returning without it let
      // mouse movement pile up for the length of the cutscene and then land in
      // a single frame the moment it ended, which threw the camera across the
      // room right as the player got control back.
      input.takeLook();
      if (input.anyPressed() || input.mouse.leftPressed) this.cine.skip();
      return;
    }
    if (input.pressed('Escape')) { this.pause(); return; }
    if (input.pressed('KeyM')) {
      audio.setVolume(audio.volume > 0 ? 0 : 0.7);
      this.hud.toast(audio.volume > 0 ? 'AUDIO ON' : 'AUDIO MUTED', 'info', 1);
    }
    const showLoadout = input.down('Tab');
    $('loadoutScreen').classList.toggle('hidden', !showLoadout);
    if (showLoadout) renderLoadoutDetail(player, this.runtime, this.pairing);

    // --- look ---
    // The cutscene case never reaches here — it returns above, draining the
    // look on its way past.
    if (input.locked) {
      const look = input.takeLook();
      player.look(look.yaw, look.pitch);
    }

    // --- weapon selection ---
    if (input.pressed('KeyQ') || input.mouse.wheel) this._swapSlot();
    if (input.pressed('Digit1')) this._selectSlot(0);
    if (input.pressed('Digit2')) this._selectSlot(1);
    if (input.pressed('KeyR')) this.runtime.startReload(this._weaponCtx());
    if (input.pressed('KeyF')) this._dropWeapon();
    if (input.pressed('ControlLeft') || input.pressed('KeyC')) {
      if (player.tryDodge(input.moveAxis())) {
        audio.melee(240, 0.22);
        this.particles.burst(player.pos.x, 0.3, player.pos.z, 8, { color: 0xbfd8ff, speed: 4, size: 0.06, life: 0.3 });
      }
    }

    // --- movement ---
    player.update(dt, input, this.level, this.now);
    this._applySlicks(dt);

    // --- weapon firing ---
    this.runtime.update(dt, this._weaponCtx());

    // --- world ---
    this._updateFlow(dt);
    this._updateEnemies(dt);
    this._updateBoss(dt);
    // Anything already in the air is put on hold too — a bolt fired a frame
    // before a cutscene started would otherwise arrive during it.
    if (!this.cine?.active) this._updateProjectiles(dt);
    this._updateChests(dt);
    this._updateNodes(dt);
    const scan = this.barrierMesh?.userData.scan;
    if (scan) {
      // One bar travelling up each panel: a barrier that is not moving is a
      // wall, and the player needs to read this as something that will open.
      // Every panel's bar is merged into this one sheet and they all scan in
      // phase, so moving the sheet moves all of them.
      const y = ((this.now * 1.6) % 1) * WALL_H - WALL_H / 2;
      scan.position.y = y;
      scan.material.opacity = 0.55 * (1 - Math.abs(y) / (WALL_H / 2)) + 0.12;
    }
    this._updateCorpses(dt);
    this._updateSecrets(dt);
    this._updateContract(dt);
    this._updatePickups(dt);
    this._updateVendors(dt);
    this._updateHoldout(dt);
    this._updateSpawning(dt);
    if (!this.cine?.active) this._updateInteraction(dt);
    this._updateStory(dt);
    this._updateLights(dt);

    this.particles.update(dt);
    this.projectiles.sync(this.now, this.camera.position);

    // --- death ---
    if (!player.alive) { this._onPlayerDown(); return; }

    // --- viewmodel + camera ---
    // A cutscene owns the camera outright while it runs; the player still
    // simulates underneath it so the world does not freeze mid-shot.
    if (!(this.cine && this.cine.update(dt, this.camera))) {
      player.applyCamera(this.camera, dt, this.opts.bob, this.opts.shake);
    }
    this._updateViewmodel(dt);
    this.torch.position.set(this.camera.position.x, this.camera.position.y + 0.2, this.camera.position.z);

    // --- hud ---
    this._updateHud(dt);
    this.hud.setSpread(this._reticleSpread());
  }

  // =======================================================================
  // Weapon context + helpers
  // =======================================================================

  _weaponCtx() {
    const player = this.player;
    // Muzzle sits just in front of the eye so tracers read correctly.
    const f = player.forward(this._tmpA);
    this.muzzle.set(
      this.camera.position.x + f.x * 0.55,
      this.camera.position.y + f.y * 0.55 - 0.12,
      this.camera.position.z + f.z * 0.55,
    );
    return {
      player, level: this.level, now: this.now,
      firing: this.input.locked && this.input.mouse.left && !this.cine?.active,
      firePressed: this.input.mouse.leftPressed && !this.cine?.active,
      muzzle: this.muzzle,
      projectiles: this.projectiles,
      particles: this.particles,
      audio,
      damageNumbers: this.damageNumbers,
      toast: (t, k, l) => this.hud.toast(t, k, l),
      viewKick: (amount, melee) => this._viewKick(amount, melee),
      muzzleFlash: (w, e) => this._muzzleFlash(w, e),
      hitMarker: (crit, head) => this.hud.hitMarker(crit, head),
      swingViewmodel: () => { this.vmSwing = 1; },
      raycastTargets: (o, ux, uy, uz, maxD) => this._raycastTargets(o, ux, uy, uz, maxD),
      targetsInCone: (o, dir, range, arc) => this._targetsInCone(o, dir, range, arc),
      nearestOther: (from, range, exclude) => this._nearestOther(from, range, exclude),
      splash: (x, y, z, r, dmg, w, e) => this._splash(x, y, z, r, dmg, w, e),
      addSlick: (x, z, r, life) => this._addSlick(x, z, r, life),
      onTargetDamaged: (t, res, w, e, opts) => this._onTargetDamaged(t, res, w, e, opts),
      onWeaponEvolved: (w, stage) => this._onWeaponEvolved(w, stage),
    };
  }

  _viewKick(amount, melee = false) {
    const p = this.player;
    p.recoilPitch += amount * 0.016;
    p.recoilYaw += (Math.random() - 0.5) * amount * 0.012;
    this.vmKick = Math.min(1.4, this.vmKick + amount * 0.35);
    if (melee) this.vmSwing = 1;
  }

  _muzzleFlash(w, e) {
    const color = w.tags.includes('energy') ? 0x8ff0ff : 0xffd08a;
    this.particles.flash(this.muzzle.x, this.muzzle.y, this.muzzle.z, color, 2.6, 0.06, 11);
    const f = this.player.forward(this._tmpA);
    this.particles.burst(
      this.muzzle.x + f.x * 0.2, this.muzzle.y + f.y * 0.2, this.muzzle.z + f.z * 0.2,
      3, { color, speed: 3.5, size: 0.05, life: 0.12, gravity: 0, dx: f.x, dz: f.z, push: 3, cone: true },
    );
  }

  /**
   * All damageable targets along a ray, nearest first.
   *
   * Targets are upright cylinders, not spheres: a sphere around the body centre
   * makes leg and head shots miss, which feels broken at close range where the
   * muzzle sits well above an enemy's midpoint.
   */
  _raycastTargets(origin, ux, uy, uz, maxDist) {
    const out = [];
    const a = ux * ux + uz * uz;
    const consider = (t) => {
      if (!t || !t.alive) return;
      const r = t.radius + 0.16;
      const ex = origin.x - t.pos.x, ez = origin.z - t.pos.z;

      let tEnter, tExit;
      if (a < 1e-8) {
        // Straight up or down: inside the footprint or nothing.
        if (ex * ex + ez * ez > r * r) return;
        tEnter = 0; tExit = maxDist;
      } else {
        const b = 2 * (ex * ux + ez * uz);
        const c = ex * ex + ez * ez - r * r;
        const disc = b * b - 4 * a * c;
        if (disc < 0) return;
        const sq = Math.sqrt(disc);
        tEnter = (-b - sq) / (2 * a);
        tExit = (-b + sq) / (2 * a);
        if (tExit < 0) return;
        tEnter = Math.max(tEnter, 0);
      }
      if (tEnter > maxDist) return;

      // Clip the in-cylinder span against the target's vertical extent. This
      // has to come from feetY, not pos.y — flyers hover by offsetting their
      // mesh, so pos.y is the floor underneath them, not the bottom of them.
      const yBottom = t.feetY, yTop = t.feetY + t.height;
      let hit = tEnter;
      let y = origin.y + uy * hit;
      if (y < yBottom || y > yTop) {
        if (Math.abs(uy) < 1e-6) return;
        const tb = (yBottom - origin.y) / uy;
        const tt = (yTop - origin.y) / uy;
        const lo = Math.min(tb, tt), hi = Math.max(tb, tt);
        hit = Math.max(tEnter, lo);
        if (hit > Math.min(tExit, hi) || hit > maxDist) return;
        y = origin.y + uy * hit;
      }

      // Head test: a sphere centred on the model's actual head. Checked
      // separately so a shot can clip the head even when the body cylinder
      // reports a nearer entry point.
      const headshot = rayHitsHead(origin, ux, uy, uz, t, maxDist);

      out.push({
        target: t, dist: headshot ? Math.min(hit, headshot) : hit,
        headshot: !!headshot,
        point: {
          x: origin.x + ux * (headshot || hit),
          y: origin.y + uy * (headshot || hit),
          z: origin.z + uz * (headshot || hit),
        },
      });
    };
    for (const e of this.enemies) consider(e);
    if (this.boss) consider(this.boss);
    out.sort((a2, b2) => a2.dist - b2.dist);
    return out;
  }

  /** Is this world point inside the target's head volume? */
  _isHeadHit(target, x, y, z) {
    const hy = target.headY ? target.headY() : (target.feetY ?? target.pos.y) + target.height * 0.85;
    const r = (target.headRadius ?? target.height * 0.13) + 0.1;
    const dx = x - target.pos.x, dz = z - target.pos.z, dy = y - hy;
    return dx * dx + dy * dy + dz * dz <= r * r;
  }

  _targetsInCone(origin, dir, range, arc) {
    const out = [];
    const check = (t) => {
      if (!t || !t.alive) return;
      const dx = t.pos.x - origin.x, dz = t.pos.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > range + t.radius) return;
      const dy = (t.feetY + t.height * 0.5) - (origin.y + 1.2);
      if (Math.abs(dy) > t.height * 0.9 + 0.8) return;
      if (d > 0.001) {
        const cos = (dx * dir.x + dz * dir.z) / d;
        if (cos < Math.cos(arc / 2)) return;
      }
      if (!this.level.lineOfSight(origin.x, origin.z, t.pos.x, t.pos.z)) return;
      out.push(t);
    };
    for (const e of this.enemies) check(e);
    if (this.boss) check(this.boss);
    out.sort((a, b) =>
      (a.pos.x - origin.x) ** 2 + (a.pos.z - origin.z) ** 2 - ((b.pos.x - origin.x) ** 2 + (b.pos.z - origin.z) ** 2));
    return out;
  }

  _nearestOther(from, range, exclude) {
    let best = null, bestD = range * range;
    for (const e of this.enemies) {
      if (!e.alive || e === from) continue;
      if (exclude && exclude.has(e.id)) continue;
      const d = (e.pos.x - from.pos.x) ** 2 + (e.pos.z - from.pos.z) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best && this.boss && this.boss !== from && this.boss.alive) {
      const d = (this.boss.pos.x - from.pos.x) ** 2 + (this.boss.pos.z - from.pos.z) ** 2;
      if (d < range * range) best = this.boss;
    }
    return best;
  }

  _splash(x, y, z, radius, damage, w, e) {
    for (const t of this.enemies) {
      if (!t.alive) continue;
      // Measured in 3D, so height counts: a blast on the floor reaches a
      // hovering drone only if the drone is actually within the radius.
      const d = Math.hypot(t.pos.x - x, t.feetY + t.height * 0.5 - y, t.pos.z - z);
      if (d > radius) continue;
      const res = t.takeDamage(damage * (1 - d / radius / 1.6), {});
      this._onTargetDamaged(t, res, w, e, {});
    }
    if (this.boss && this.boss.alive) {
      const d = Math.hypot(this.boss.pos.x - x, this.boss.pos.z - z);
      if (d < radius + this.boss.radius) {
        const res = this.boss.takeDamage(damage * 0.7);
        this._onTargetDamaged(this.boss, res, w, e, {});
      }
    }
  }

  _addSlick(x, z, radius, life) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 18),
      new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.24, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.04, z);
    this.propGroup.add(mesh);
    this.slicks.push({ mesh, x, z, radius, life, maxLife: life });
  }

  _applySlicks(dt) {
    for (let i = this.slicks.length - 1; i >= 0; i--) {
      const s = this.slicks[i];
      s.life -= dt;
      s.mesh.material.opacity = 0.24 * Math.max(0, s.life / s.maxLife);
      if (s.life <= 0) {
        disposeTree(s.mesh);
        this.propGroup.remove(s.mesh);
        swapRemove(this.slicks, i);
        continue;
      }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.pos.x - s.x, e.pos.z - s.z) < s.radius) {
          e.slowFactor = 0.45;
          e.slowUntil = this.now + 0.4;
        }
      }
    }
  }

  // =======================================================================
  // Target damage / death bookkeeping
  // =======================================================================

  _onTargetDamaged(target, res, weapon, eff, opts) {
    if (!res || !res.killed) return;
    if (target === this.boss) { this._onBossKilled(); return; }
    this._killEnemy(target, weapon, eff);
  }

  _killEnemy(enemy, weapon, eff) {
    if (enemy._dead) return;
    enemy._dead = true;
    enemy.alive = false;

    const player = this.player;
    player.stats.kills++;
    player.addShards(Math.round(enemy.type.shards * (1 + this.floorIndex * 0.06)));

    // Evolution credit: the Desert Eagle feeds the Baby line under Growing Pains.
    const held = player.weapon;
    this.runtime.registerKill(this._weaponCtx(), held, false);
    if (eff?.traits?.has('feedsEvolution')) {
      const baby = player.slots.find((w) => w && w.id === 'babygun');
      if (baby && baby !== held) this.runtime.registerKill(this._weaponCtx(), baby, true);
    }

    // Jumbo bodies pop.
    if (enemy.jumbified > 0 && enemy.jumboBurst) this._jumboBurst(enemy);

    // Gellumps split.
    if (enemy.type.splitOnDeath && this.enemies.length < MAX_ENEMIES - 2) {
      for (let i = 0; i < enemy.type.splitOnDeath; i++) {
        const a = Math.random() * TAU;
        const p = new THREE.Vector3(enemy.pos.x + Math.cos(a) * 1.1, 0, enemy.pos.z + Math.sin(a) * 1.1);
        if (this.level.isSolidAt(p.x, p.z)) continue;
        const child = this._spawnEnemy('gellump', p);
        if (child) {
          child.maxHp = Math.round(child.maxHp * 0.4);
          child.hp = child.maxHp;
          child.mesh.scale.setScalar(0.65);
          child.type = { ...child.type, splitOnDeath: 0 };
        }
      }
    }

    this.particles.burst(enemy.pos.x, enemy.pos.y + enemy.height * 0.5, enemy.pos.z, 16, {
      color: [enemy.type.build.body, enemy.type.build.head, enemy.type.build.eye],
      speed: 7, size: 0.11, life: 0.8,
    });
    audio.hit(enemy.type.hitSound === 'metal' ? 'metal' : 'flesh');

    // Occasional drops
    const roll = Math.random();
    if (roll < 0.10) this._addPickup('health', enemy.pos, 26);
    else if (roll < 0.24) this._addPickup('ammo', enemy.pos, 0);

    // Wave / objective bookkeeping
    if (this.kind?.onKill) this.kind.onKill(this, enemy);
    if (this.holdout) {
      const i = this.holdout.enemies.indexOf(enemy);
      if (i >= 0) swapRemove(this.holdout.enemies, i);
    }
    if (enemy.carriesKeycard) {
      this._addPickup('key', enemy.pos, 0, floorConfig(this.floorIndex).palette.trim);
      this.hud.toast(`${this.objective.label.slice(0, -1)} DROPPED`, 'good', 1.6);
    }

    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) swapRemove(this.enemies, idx);
    this._makeCorpse(enemy);
  }

  _jumboBurst(enemy) {
    const b = enemy.jumboBurst;
    this.particles.explosion(enemy.pos.x, enemy.pos.y + 1, enemy.pos.z, b.radius, 0x6fffe4);
    audio.explode(0.9);
    for (const t of this.enemies) {
      if (!t.alive || t === enemy) continue;
      const d = Math.hypot(t.pos.x - enemy.pos.x, t.pos.z - enemy.pos.z);
      if (d > b.radius) continue;
      const res = t.takeDamage(b.damage * (1 - d / b.radius / 1.5), {});
      if (b.electric) { t.stunned = Math.max(t.stunned, 1.4); }
      this.damageNumbers.add(t.pos.x, t.headY(), t.pos.z, res.dealt, 'normal');
      this._onTargetDamaged(t, res, null, null, {});
    }
    if (this.boss && this.boss.alive) {
      const d = Math.hypot(this.boss.pos.x - enemy.pos.x, this.boss.pos.z - enemy.pos.z);
      if (d < b.radius + this.boss.radius) {
        const res = this.boss.takeDamage(b.damage * 0.6);
        this._onTargetDamaged(this.boss, res, null, null, {});
      }
    }
    if (b.catered) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * TAU;
        const p = new THREE.Vector3(enemy.pos.x + Math.cos(a) * 1.6, 0, enemy.pos.z + Math.sin(a) * 1.6);
        if (!this.level.isSolidAt(p.x, p.z)) this._addPickup('sandwich', p, 14);
      }
    }
  }

  _addPickup(kind, pos, value, color) {
    const group = buildPickup(kind, color);
    group.position.set(pos.x, 0.7, pos.z);
    this.propGroup.add(group);
    // Objective keys never expire — losing one to a timer would strand the floor.
    const life = kind === 'key' ? Infinity : 45;
    this.pickups.push({ group, kind, value, pos: new THREE.Vector3(pos.x, 0.7, pos.z), life, born: this.now });
  }

  // =======================================================================
  // Subsystem updates
  // =======================================================================

  _updateFlow(dt) {
    this.flow.timer -= dt;
    if (this.flow.timer <= 0) {
      this.flow.timer = 0.22;
      this.flow.rebuild(this.player.pos.x, this.player.pos.z);
    }
  }

  _enemyCtx() {
    return {
      player: this.player, level: this.level, flow: this.flow, now: this.now,
      frozen: !!this.cine?.active,
      audio, particles: this.particles,
      separation: (e) => this._separation(e),
      onMelee: (e, dmg) => this._enemyMelee(e, dmg),
      onRanged: (e, proj) => this._enemyShoot(e, proj),
      onExplode: (e) => this._enemyExplode(e),
      onDeath: (e) => this._killEnemy(e, null, null),
      onJumboExpire: (e) => { if (e.jumboBurst) { this._jumboBurst(e); e.jumboBurst = null; } },
      onTetherTick: (e, dmg) => {
        if (e.tetherDrain) this.player.heal(dmg * 0.35);
      },
    };
  }

  _separation(e) {
    let sx = 0, sz = 0;
    for (const o of this.enemies) {
      if (o === e || !o.alive) continue;
      const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      const want = (e.radius + o.radius) * 1.15;
      if (d2 > want * want || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (want - d) / want;
      sx += (dx / d) * push * 1.5;
      sz += (dz / d) * push * 1.5;
    }
    this._sep.x = sx; this._sep.z = sz;
    return this._sep;
  }

  _updateEnemies(dt) {
    const ctx = this._enemyCtx();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      // Walking backwards over a swap-removed list is only safe while each
      // step removes at most one entry. A death here can cascade — a bloater
      // going off takes its neighbours with it, a jumbo bursts, a chain jumps
      // — so the list can shrink past `i` in a single iteration and leave it
      // pointing at nothing. Re-clamp rather than assume.
      if (i >= this.enemies.length) i = this.enemies.length - 1;
      if (i < 0) break;
      const e = this.enemies[i];
      if (!e) continue;
      if (!e.alive) { this._killEnemy(e, null, null); continue; }
      // Skip AI for distant enemies most frames; they still drift toward you.
      const far = (e.pos.x - this.player.pos.x) ** 2 + (e.pos.z - this.player.pos.z) ** 2 > 70 * 70;
      if (far && (i % 3) !== (this._frameParity | 0)) continue;
      e.update(dt, ctx);
    }
    this._frameParity = (this.now * 60) % 3 | 0;
  }

  _enemyMelee(enemy, damage) {
    const p = this.player;
    if (!this.damagePlayer(damage, enemy)) return;
    const dx = p.pos.x - enemy.pos.x, dz = p.pos.z - enemy.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    p.vel.x += (dx / d) * 4;
    p.vel.z += (dz / d) * 4;
    audio.melee(220, 0.14);
  }

  _enemyShoot(enemy, proj) {
    const p = this.player;
    const ox = enemy.pos.x, oy = enemy.pos.y + enemy.height * 0.72, oz = enemy.pos.z;
    const tx = p.pos.x, ty = p.eyeY() - 0.2, tz = p.pos.z;
    let dx = tx - ox, dy = ty - oy, dz = tz - oz;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    const s = proj.spread || 0.03;
    dx += (Math.random() - 0.5) * s * 2;
    dy += (Math.random() - 0.5) * s;
    dz += (Math.random() - 0.5) * s * 2;
    const n = Math.hypot(dx, dy, dz) || 1;
    this.projectiles.spawn({
      x: ox, y: oy, z: oz,
      vx: (dx / n) * proj.speed, vy: (dy / n) * proj.speed + (proj.arc ? 2.6 : 0), vz: (dz / n) * proj.speed,
      life: 4, damage: enemy.damage, color: proj.color, size: proj.size, radius: proj.size * 1.6,
      hostile: true, gravity: proj.arc ? 9 : 0,
      puddle: proj.puddle,
    });
    audio.shoot({ body: 800, punch: 0.3, tail: 0.08, pitch: 300, volume: 0.2 });
  }

  _enemyExplode(enemy) {
    const t = enemy.type;
    this.particles.explosion(enemy.pos.x, enemy.pos.y + 0.8, enemy.pos.z, t.explodeRadius || 4, 0xbfff2a);
    audio.explode(1.1);
    const d = Math.hypot(enemy.pos.x - this.player.pos.x, enemy.pos.z - this.player.pos.z);
    if (d < (t.explodeRadius || 4)) {
      this.damagePlayer((t.explodeDamage || 40) * (1 - d / (t.explodeRadius || 4) / 1.4), enemy);
    }
    for (const o of this.enemies) {
      if (o === enemy || !o.alive) continue;
      const od = Math.hypot(o.pos.x - enemy.pos.x, o.pos.z - enemy.pos.z);
      if (od < (t.explodeRadius || 4)) {
        const res = o.takeDamage((t.explodeDamage || 40) * 0.5, {});
        this._onTargetDamaged(o, res, null, null, {});
      }
    }
    this._killEnemy(enemy, null, null);
  }

  damagePlayer(amount, source, silent = false) {
    // A cutscene is not a fight. The world keeps simulating underneath one so
    // it does not visibly freeze, but nothing in it is allowed to land a hit.
    if (this.cine?.active) return false;
    const p = this.player;
    if (!p.hurt(amount, source)) return false;
    // Point at whatever did it, so being shot from behind is still readable.
    if (source?.pos) {
      const dx = source.pos.x - p.pos.x, dz = source.pos.z - p.pos.z;
      this.hud.damageFrom(Math.atan2(dx, dz) - p.yaw);
    }
    if (!silent) {
      audio.hurt();
      this.hud.screenFlash(0.18 * this.opts.flash);
      this.hurtFlash = Math.min(1, (this.hurtFlash ?? 0) + 0.3 + amount * 0.005);
    }
    return true;
  }

  // ---- boss ----

  _bossCtx() {
    return {
      frozen: !!this.cine?.active,
      player: this.player, level: this.level, now: this.now,
      particles: this.particles, audio,
      say: (text, kind) => this._sayNow(text, kind),
      spawnBossBullet: (x, y, z, dx, dy, dz, speed, dmg, color, homing) => {
        this.projectiles.spawn({
          x, y, z, vx: dx * speed, vy: dy * speed, vz: dz * speed,
          life: 6, damage: dmg, color, size: 0.19, radius: 0.24,
          hostile: true, homing: homing || 0,
        });
      },
      damagePlayer: (dmg, src, silent) => this.damagePlayer(dmg, src, silent),
      summon: (typeId, count, origin) => {
        for (let i = 0; i < count; i++) {
          const a = Math.random() * TAU;
          const r = 4 + Math.random() * 6;
          const p = new THREE.Vector3(origin.x + Math.cos(a) * r, 0, origin.z + Math.sin(a) * r);
          if (this.level.isSolidAt(p.x, p.z)) continue;
          const e = this._spawnEnemy(typeId, p);
          if (e) this.particles.ring(p.x, 0.08, p.z, { from: 0.2, to: 2, life: 0.4, color: 0xff2ea6 });
        }
      },
      shockEnemies: (x, z, radius) => {
        for (const e of this.enemies) {
          const d = Math.hypot(e.pos.x - x, e.pos.z - z);
          if (d < radius) e.knock((e.pos.x - x) / (d || 1), (e.pos.z - z) / (d || 1), 12);
        }
      },
      onDeath: () => this._onBossKilled(),
    };
  }

  _updateBoss(dt) {
    // Spawn on entering the unsealed boss room. Floors with no named boss
    // (the B1 holdout) are driven entirely by _updateHoldout instead.
    if (!this.bossSpawned && this.objectiveDone && !this.bossSealed && BOSS_ORDER[this.floorIndex]) {
      const r = this.level.roomAt(this.player.pos.x, this.player.pos.z);
      if (r && r === this.bossRoom) this._spawnBoss();
    }
    if (!this.boss) return;
    if (!this.boss.alive) return;
    this.boss.update(dt, this._bossCtx());
  }

  _spawnBoss() {
    const bossId = BOSS_ORDER[this.floorIndex];
    if (!bossId) { this.bossSpawned = true; return; }
    const cfg = floorConfig(this.floorIndex);
    const center = this.level.roomCenter(this.bossRoom);
    const pos = center.clone();
    // Stand the boss on the far side of the room from the door you came in.
    const away = new THREE.Vector3(center.x - this.player.pos.x, 0, center.z - this.player.pos.z).normalize();
    pos.add(away.multiplyScalar(Math.min(8, this.bossRoom.w * CELL * 0.25)));
    if (this.level.isSolidAt(pos.x, pos.z)) pos.copy(center);

    this.boss = new Boss(bossId, pos, 0.8 + cfg.difficulty * 0.32);
    this.boss.addToScene(this.scene);
    this.bossSpawned = true;

    // Re-seal behind you: the boss room is a commitment.
    this._reseal();

    // Cross into the boss theme rather than stopping and restarting: the old
    // stop-then-setTimeout left half a second of silence at the exact moment
    // the fight was supposed to land.
    audio.crossfadeMusic({ ...this.boss.def.music, pad: false }, 1.1);
    // Duck the room: a bed under a boss fight is clutter, and bringing it back
    // afterwards is most of what makes the room feel quiet again.
    this.ambience.setLevel(0.25, 1.2);
    audio.bossRoar(1);
    this.particles.ring(pos.x, 0.1, pos.z, { from: 1, to: 16, life: 0.9, color: this.boss.def.build.accent });
    this._playBossIntro();
  }

  /**
   * The boss reveal. Three shots: the door sealing behind you, an arc around
   * whatever is waiting, and a settle back to eye level as it starts talking.
   * The boss's own intro lines carry the shots, so a boss with three lines
   * gets three beats and a boss with one gets one.
   */
  /**
   * The moment the door stops being a door.
   *
   * The camera leaves Michael's eyes and looks at *him* for the first time —
   * he is the only thing in the Pod that is a person, and the shot is the only
   * place the game says so. Then it climbs, so the ten floors above are a
   * physical fact rather than a number in a corner.
   */
  _playLockCutscene() {
    if (!this.cine || this.opts.skipCine) { this._queue(STORY.glitchEvent, true); return; }
    const at = () => this.player.pos;
    this.hud.setCinematic(true);
    this.cine.play([
      // Snap round to face him, close, handheld.
      {
        from: () => { const p = at(); return [p.x + 2.6, 1.7, p.z + 2.6]; },
        to: () => { const p = at(); return [p.x + 1.5, 1.6, p.z + 1.5]; },
        look: () => { const p = at(); return [p.x, 1.5, p.z]; },
        time: 2.6, shake: 0.05,
        line: ['POD SYSTEM', 'SESSION CHECKPOINT — SYNCING…'],
      },
      {
        from: () => { const p = at(); return [p.x + 1.5, 1.6, p.z + 1.5]; },
        to: () => { const p = at(); return [p.x + 0.9, 1.55, p.z + 0.9]; },
        look: () => { const p = at(); return [p.x, 1.5, p.z]; },
        time: 2.2, shake: 0.11,
        line: ['', 'S̷Y̸N̷C̶ ̴F̸A̷I̶L̷E̸D̴ — RETRY 3/3'],
      },
      // Pull up and away: the shaft above him, and everything left to climb.
      {
        from: () => { const p = at(); return [p.x + 0.9, 1.55, p.z + 0.9]; },
        to: () => { const p = at(); return [p.x + 1.2, 9.5, p.z + 3.4]; },
        look: () => { const p = at(); return [p.x, 1.2, p.z]; },
        time: 4.4,
        line: ['DR. KIMVATCH', 'The extraction handshake needs your session marked COMPLETE. Something just marked it LOCKED instead.'],
        hold: 0.5,
      },
      {
        from: () => { const p = at(); return [p.x + 1.2, 9.5, p.z + 3.4]; },
        to: () => { const p = at(); return [p.x + 1.2, 6.0, p.z + 2.6]; },
        look: () => { const p = at(); return [p.x, 1.5, p.z]; },
        time: 3.6,
        line: ['DR. KIMVATCH', 'It has exactly one verb. Finish the course — all ten floors — and the door opens because it has nothing else it knows how to do.'],
        hold: 0.4,
      },
      // Back to his eyes, and hand the controls over mid-sentence.
      {
        from: () => { const p = at(); return [p.x + 1.2, 6.0, p.z + 2.6]; },
        to: () => { const p = at(); return [p.x, p.y + 1.7, p.z]; },
        look: () => { const p = at(); return [p.x, 1.5, p.z - 4]; },
        time: 1.6,
        line: ['DR. KIMVATCH', 'So we finish. You climb, I talk, and neither of us panics.'],
      },
    ], {
      onDone: () => {
        this.hud.setCinematic(false);
        this.hud.banner('SESSION LOCKED', 'THE ONLY EXIT IS THE TOP', 4);
        // The rest of the script still plays — the cutscene is the headline.
        this._queue(STORY.glitchEvent.slice(4), true);
      },
    });
  }

  /**
   * The beta reveal, on floor five, where all six alphas stopped.
   *
   * Shot on the floor's own husks rather than on Michael: the reveal is about
   * them, and pointing the camera at one while Kimvatch explains what it used
   * to be does more than eight lines of dialogue ever could.
   */
  _playRevealCutscene() {
    if (!this.cine || this.opts.skipCine) { this._queue(STORY.betaReveal, true); return; }
    // Find something to look at — a husk if the floor has one, otherwise him.
    const husk = this.enemies.find((e) => e.type.id === 'husk' && e.alive);
    const subject = husk || this.player;
    const at = () => subject.pos;
    const me = () => this.player.pos;
    this.hud.setCinematic(true);
    this.cine.play([
      shot.push(at, {
        dist: 7, height: 2.6, close: 3.2, time: 4.2, hold: 0.4,
        line: ['DR. KIMVATCH', 'You are not the first trial patient. You are the first BETA patient.'],
      }),
      shot.orbit(at, {
        radius: 4.5, height: 1.9, from: 0.6, to: 2.2, time: 4.6, hold: 0.3,
        line: ['DR. KIMVATCH', 'There was an alpha group. Six people. They went in eleven months before you did, and they are all still in here.'],
      }),
      {
        from: () => { const p = at(); return [p.x + 3, 2.0, p.z + 3]; },
        to: () => { const p = at(); return [p.x + 1.3, 1.7, p.z + 1.3]; },
        look: () => { const p = at(); return [p.x, 1.5, p.z]; },
        time: 4.4, hold: 0.4,
        line: ['DR. KIMVATCH', 'Nobody died. The Pod cannot kill you. Every time it beats you it puts you back at the start of the floor, and it is very patient about it.'],
      },
      {
        from: () => { const p = at(); return [p.x + 1.3, 1.7, p.z + 1.3]; },
        to: () => { const p = me(); return [p.x + 2.4, 3.4, p.z + 3.4]; },
        look: () => { const p = me(); return [p.x, 1.5, p.z]; },
        time: 4.6, hold: 0.4,
        line: ['DR. KIMVATCH', 'They did not give up in one big moment. They gave up in about two hundred small ones. All six of them stopped on five.'],
      },
      {
        from: () => { const p = me(); return [p.x + 2.4, 3.4, p.z + 3.4]; },
        to: () => { const p = me(); return [p.x, p.y + 1.7, p.z]; },
        look: () => { const p = me(); return [p.x, 1.5, p.z - 4]; },
        time: 2.0,
        line: ['DR. KIMVATCH', 'So do not get comfortable on this floor. Keep climbing, Michael. Please.'],
      },
    ], {
      onDone: () => {
        this.hud.setCinematic(false);
        this.hud.banner('THE ALPHA WING', 'ALL SIX OF THEM STOPPED HERE', 4.4);
      },
    });
  }

  _playBossIntro() {
    const boss = this.boss;
    const def = boss.def;
    if (this.opts.skipCine) {
      this.hud.banner(def.name, def.title, 4.4);
      this._queue((def.lines.intro || []).map((t) => ({
        speaker: 'BOSS', text: t, hold: Math.max(3, t.length * 0.045),
      })), true);
      audio.bossRoar(1.2);
      return;
    }
    const at = () => boss.pos;
    const lines = def.lines.intro || [];
    const speak = (i) => (lines[i] ? [def.name, lines[i]] : null);

    const shots = [
      // Look back at the door you just came through, as it closes.
      shot.hold(
        () => [this.player.pos.x, this.player.pos.y + 1.7, this.player.pos.z],
        () => [this.player.pos.x * 2 - boss.pos.x, 2.2, this.player.pos.z * 2 - boss.pos.z],
        { time: 1.5, line: null },
      ),
      shot.orbit(at, {
        radius: def.build.scale ? 7 + def.build.scale * 2 : 8,
        height: 4.5, from: -0.6, to: 1.1,
        time: Math.max(2.6, (lines[0] || '').length * 0.05), line: speak(0), hold: 0.4, shake: 0.02,
      }),
    ];
    if (lines[1]) {
      shots.push(shot.push(at, {
        dist: 9, height: 2.4, close: 4.5,
        time: Math.max(2.4, lines[1].length * 0.048), line: speak(1), hold: 0.3,
      }));
    }
    if (lines[2]) {
      shots.push(shot.orbit(at, {
        radius: 6.5, height: 2.2, from: 2.4, to: 3.6,
        time: Math.max(2.2, lines[2].length * 0.046), line: speak(2), hold: 0.3,
      }));
    }
    // Settle: drift back to where the player is actually standing.
    shots.push({
      from: () => [boss.pos.x, boss.pos.y + 2.4, boss.pos.z + 6],
      to: () => [this.player.pos.x, this.player.pos.y + 1.7, this.player.pos.z],
      look: () => [boss.pos.x, boss.pos.y + 1.4, boss.pos.z],
      time: 1.1,
    });

    this.hud.setCinematic(true);
    this.cine.play(shots, {
      onDone: () => {
        this.hud.setCinematic(false);
        this.hud.banner(def.name, def.title, 3.2);
        audio.bossRoar(1.2);
      },
    });
  }

  /**
   * The cold open, as a shot rather than a fade-up: the camera finds Michael
   * in the dark, drifts to the one lit thing in the room, and hands control
   * back with the chest already in frame.
   */
  _playOpening() {
    const chest = this.chests[0];
    if (!chest || !this.cine || this.opts.skipCine) return;
    const c = chest.pos;
    this.cine.play([
      shot.hold(
        () => [c.x + 5, 3.6, c.z + 6],
        () => [c.x, 1.0, c.z],
        { time: 3.4, line: ['', 'Sublevel B1. Cold Storage.'] },
      ),
      {
        from: () => [c.x + 5, 3.6, c.z + 6],
        to: () => [c.x + 1.4, 1.5, c.z + 3.2],
        look: () => [c.x, 0.9, c.z],
        time: 3.6,
        line: ['MICHAEL SANDLOR', 'Hello?'],
        hold: 0.6,
      },
      {
        from: () => [c.x + 1.4, 1.5, c.z + 3.2],
        to: () => [this.player.pos.x, this.player.pos.y + 1.7, this.player.pos.z],
        look: () => [c.x, 1.0, c.z],
        time: 1.4,
      },
    ], {
      onDone: () => {
        this.hud.setCinematic(false);
        this.hud.toast('E — OPEN THE CHEST', 'info', 4);
      },
    });
    this.hud.setCinematic(true);
  }

  _reseal() {
    if (this.bossSealed) return;
    for (const idx of this.gateCells) this.level.grid[idx] = 1;
    this.bossSealed = true;
    const boxes = new THREE.Group();
    for (const idx of this.gateCells) {
      const cx = idx % GRID, cz = (idx / GRID) | 0;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(CELL, WALL_H, CELL),
        new THREE.MeshBasicMaterial({
          color: 0xff4a5a, transparent: true, opacity: 0.1,
          depthWrite: false, blending: THREE.AdditiveBlending,
        }),
      );
      b.position.set(this.level.cellToWorldX(cx) + CELL / 2, WALL_H / 2, this.level.cellToWorldZ(cz) + CELL / 2);
      boxes.add(b);
    }
    this.barrierMesh = boxes;
    this.scene.add(boxes);
    audio.doorOpen();
  }

  _onBossKilled() {
    if (!this.boss || this.bossDefeated) return;
    this.bossDefeated = true;
    this.boss.alive = false;
    const def = this.boss.def;
    this.player.stats.bossKills++;
    this.player.addShards(def.shards);

    this.particles.explosion(this.boss.pos.x, this.boss.pos.y + 1.4, this.boss.pos.z, 8, def.build.accent);
    this.particles.ring(this.boss.pos.x, 0.1, this.boss.pos.z, { from: 1, to: 22, life: 1.2, color: def.build.accent });
    audio.explode(2);
    // The room comes back up. After four minutes of boss theme, the floor's
    // own hum returning is the sound of it being over.
    this.ambience.setLevel(1, 2.4);
    audio.levelUp();
    // …and so does the floor's own theme. There was a way *into* the boss
    // fight musically and no way out of it: the boss theme simply kept playing
    // over the corpse, the loot, the lift and halfway into the next floor,
    // which is the aural equivalent of a fight that never gets an ending.
    // Slower and quieter than the floor's normal bed, with the arpeggio
    // dropped, so the aftermath is an exhale rather than a reset.
    const bed = this.floorCfg?.music;
    if (bed) {
      audio.crossfadeMusic({
        ...bed, pad: true, arp: false, bass: true,
        bpm: Math.round((bed.bpm ?? 96) * 0.82), intensity: 0.34,
      }, 2.2);
    }
    this.hud.screenFlash(0.6);
    this.hud.banner('BOSS DOWN', def.name, 3.6);

    // Clear the room's minions as a reward. Drain from the end rather than
    // indexing, because a death here can cascade and take more than one.
    while (this.enemies.length) this._killEnemy(this.enemies[this.enemies.length - 1], null, null);

    const lines = def.lines.death.map((t) => ({ speaker: 'BOSS', text: t, hold: Math.max(3, t.length * 0.05) }));
    this._queue(lines, true);
    this._queue(STORY.bossDown[this.floorIndex] || []);

    // Both of these fire seconds later, by which time the player may have
    // ridden the lift or quit to the title. Without the token check, the drop
    // lands on a level that no longer exists and the dispose runs against a
    // boss belonging to the next floor.
    const token = this.floorToken;
    setTimeout(() => {
      if (token !== this.floorToken) return;
      if (this.boss) { this.boss.dispose(); this.boss = null; }
    }, 2200);

    if (def.dropWeapon) {
      const p = this.boss.pos.clone();
      setTimeout(() => {
        if (token !== this.floorToken || !this.level) return;
        this._dropWeaponPickup(def.dropWeapon, p);
      }, 1800);
    }

    this._unsealBossRoom();
    this.lift.active = true;
    audio.setMusicIntensity(0.35);
    this.hud.toast('THE LIFT IS LIVE', 'good', 3);
  }

  _dropWeaponPickup(weaponId, pos) {
    const group = buildWeaponModel(weaponId, null);
    group.position.set(pos.x, 1.1, pos.z);
    group.scale.setScalar(1.1);
    this.propGroup.add(group);
    this.pickups.push({
      group, kind: 'weapon', weaponId, value: 0,
      pos: new THREE.Vector3(pos.x, 1.1, pos.z), life: 999, born: this.now,
    });
  }

  // ---- projectiles ----

  _updateProjectiles(dt) {
    const ctx = {
      level: this.level,
      player: this.player,
      findEnemyHit: (p) => {
        let best = null, bestD = Infinity;
        const check = (t) => {
          if (!t || !t.alive) return;
          if (p.hitList && p.hitList.has(t.id)) return;
          const dx = p.x - t.pos.x, dz = p.z - t.pos.z;
          const dy = p.y - (t.feetY + t.height * 0.5);
          const rr = (p.radius + t.radius) ** 2;
          if (dx * dx + dz * dz > rr) return;
          if (Math.abs(dy) > t.height * 0.7) return;
          const d = dx * dx + dz * dz;
          if (d < bestD) { bestD = d; best = t; }
        };
        for (const e of this.enemies) check(e);
        if (this.boss) check(this.boss);
        return best;
      },
      findHomingTarget: (p) => {
        let best = null, bestD = 26 * 26;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const d = (e.pos.x - p.x) ** 2 + (e.pos.z - p.z) ** 2;
          if (d < bestD) { bestD = d; best = e; }
        }
        return best || (this.boss?.alive ? this.boss : null);
      },
      // Returns true when the projectile is spent and should be removed.
      onEnemyHit: (p, target) => {
        if (p.traits?.has('sandwich')) { this._sandwichHit(p, target); return true; }
        const eff = this._effForProjectile(p);
        const weapon = this._weaponById(p.weaponId);
        if (!weapon || !eff) {
          const res = target.takeDamage(p.damage, {});
          this.damageNumbers.add(target.pos.x, target.headY(), target.pos.z, res.dealt);
          this._onTargetDamaged(target, res, null, null, {});
          return true;
        }
        const vlen = Math.hypot(p.vx, p.vy, p.vz) || 1;
        this.runtime.applyHit(this._weaponCtx(), weapon, eff, target, p.damage, {
          ux: p.vx / vlen, uy: p.vy / vlen, uz: p.vz / vlen,
          headshot: this._isHeadHit(target, p.x, p.y, p.z),
          point: { x: p.x, y: p.y, z: p.z },
        });
        // Ricocheting blades keep going; pierce rounds keep going until spent.
        if (p.bounces > 0) return false;
        return p.pierce <= 0;
      },
      onPlayerHit: (p) => {
        this.damagePlayer(p.damage, null);
        this.particles.burst(p.x, p.y, p.z, 5, { color: p.color, speed: 3, size: 0.06, life: 0.3 });
        if (p.puddle) this._addSlick(p.x, p.z, 2.4, 5);
      },
      onWallHit: (p, nx, nz, bounced) => {
        this.particles.burst(p.x, p.y, p.z, bounced ? 3 : 5, {
          color: p.color, speed: 3, size: 0.05, life: 0.25, cone: true,
        });
        if (!bounced && p.traits?.has('sandwich')) this._sandwichLand(p);
        if (!bounced && p.traits?.has('explosive')) {
          this.particles.explosion(p.x, p.y, p.z, p.params?.splashRadius || 1.8, 0xffa04a);
          this._splash(p.x, p.y, p.z, p.params?.splashRadius || 1.8, p.params?.splashDamage || 12,
            this._weaponById(p.weaponId), this._effForProjectile(p));
        }
        if (!bounced && p.traits?.has('jumbify')) {
          this.particles.burst(p.x, p.y, p.z, 8, { color: 0x6fffe4, speed: 3, size: 0.08, life: 0.4 });
        }
        if (p.puddle) this._addSlick(p.x, p.z, 2.2, 5);
        if (p.traits?.has('splitBounce') && bounced && !p._split) {
          p._split = true;
          for (let i = -1; i <= 1; i += 2) {
            const a = Math.atan2(p.vx, p.vz) + i * 0.5;
            const sp = Math.hypot(p.vx, p.vz);
            this.projectiles.spawn({
              x: p.x, y: p.y, z: p.z, vx: Math.sin(a) * sp, vy: 0, vz: Math.cos(a) * sp,
              life: p.life, damage: p.damage * 0.7, color: p.color, size: p.size * 0.8,
              radius: p.radius * 0.8, hostile: false, weaponId: p.weaponId,
              bounces: p.bounces, bounceGain: p.bounceGain, spin: 22,
              traits: p.traits, params: p.params,
            });
          }
        }
      },
      onExpire: (p) => {
        if (p.traits?.has('sandwich')) this._sandwichLand(p);
      },
    };
    this.projectiles.update(dt, ctx);
  }

  _weaponById(id) {
    for (const w of [this.player.slots[0], this.player.slots[1], this.player.fists]) {
      if (w && w.id === id) return w;
    }
    return null;
  }

  _effForProjectile(p) {
    const w = this._weaponById(p.weaponId);
    return w ? this.runtime.eff(w) : null;
  }

  _sandwichHit(p, target) {
    const spoiled = p.traits?.has('spoiled');
    const res = target.takeDamage(p.damage, {});
    this.player.stats.damageDealt += res.dealt;
    this.damageNumbers.add(target.pos.x, target.headY(), target.pos.z, res.dealt);
    // Enemies stop to eat.
    target.distracted = Math.max(target.distracted, p.params?.distractTime || 3);
    this.particles.burst(p.x, p.y, p.z, 6, { color: spoiled ? 0x7a8a3a : 0xd9a441, speed: 3.5, size: 0.07, life: 0.5 });
    this._onTargetDamaged(target, res, null, null, {});
  }

  _sandwichLand(p) {
    if (this.level.isSolidAt(p.x, p.z)) return;
    const spoiled = p.traits?.has('spoiled');
    this._addPickup('sandwich', { x: p.x, z: p.z }, spoiled ? -6 : (p.params?.healAmount || 12));
  }

  // ---- chests / interaction ----

  _updateChests(dt) {
    for (const c of this.chests) c.update(dt, this.now, audio, this.particles);
  }

  _updateNodes(dt) {
    if (!this.kind) return;
    this.kind.update(this, dt);
  }

  _waveSize(cfg) {
    const [lo, hi] = cfg.waveSize;
    return lo + Math.round((hi - lo) * Math.min(1, this.objective.done / Math.max(1, this.objective.total)));
  }

  _updatePickups(dt) {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i];
      it.life -= dt;
      it.group.rotation.y += dt * 1.6;
      it.group.position.y = it.pos.y + Math.sin(this.now * 2.4 + i) * 0.12;
      if (it.life <= 0) {
        disposeTree(it.group); this.propGroup.remove(it.group); swapRemove(this.pickups, i); continue;
      }
      if (it.kind === 'weapon') continue; // requires a deliberate E press
      const d = Math.hypot(it.pos.x - p.pos.x, it.pos.z - p.pos.z);
      if (d > 1.5) continue;
      this._collect(it);
      disposeTree(it.group); this.propGroup.remove(it.group); swapRemove(this.pickups, i);
    }
  }

  _collect(item) {
    const p = this.player;
    switch (item.kind) {
      case 'health':
        p.heal(item.value || 25);
        audio.pickup();
        this.hud.toast(`+${item.value || 25} HP`, 'good', 1);
        break;
      case 'ammo': {
        const w = p.weapon;
        if (w && isFinite(w.magSize)) {
          w.reserveAmmo += Math.round(w.magSize * 2.5);
          this.hud.toast('AMMO', 'info', 1);
        } else {
          p.addShards(30);
          this.hud.toast('+30 SHARDS', 'info', 1);
        }
        audio.pickup();
        break;
      }
      case 'sandwich': {
        if (item.value < 0) {
          this.damagePlayer(-item.value, null);
          this.hud.toast('THAT SANDWICH WAS WRONG', 'bad', 1.6);
        } else {
          p.heal(item.value);
          this.hud.toast(`SANDWICH +${item.value}`, 'good', 1);
        }
        audio.pickup();
        break;
      }
      case 'key':
        this.objective.done++;
        audio.levelUp();
        this.hud.toast(`${this.objective.label} ${this.objective.done}/${this.objective.total}`, 'good', 2.2);
        this._checkObjective();
        break;
      default: break;
    }
  }

  _updateVendors(dt) {
    for (const v of this.vendors) {
      v.screen.rotation.y = 0;
      v.screen.material.opacity = 0.6 + Math.sin(this.now * 3) * 0.2;
    }
  }

  _checkObjective() {
    if (this.objectiveDone) return;
    if (this.objective.done < this.objective.total) return;
    this.objectiveDone = true;
    this._queue(STORY.objectiveDone[this.floorIndex] || []);
    const cfg = floorConfig(this.floorIndex);
    if (cfg.finale === 'holdout') {
      this._startHoldout();
    } else {
      this._unsealBossRoom();
      this.hud.banner('OBJECTIVE COMPLETE', 'THE WAY UP IS OPEN', 3.4);
    }
    this._updateObjectiveHud();
  }

  _startHoldout() {
    this._unsealBossRoom();
    this.holdout = { time: 92, enemies: [], spawnTimer: 0, started: false };
    this._queue(STORY.holdoutStart);
    this.hud.banner('HOLD THE PLATFORM', 'THE FREIGHT LIFT IS COMING', 4);
    audio.setMusicIntensity(1);
  }

  _updateHoldout(dt) {
    const h = this.holdout;
    if (!h) return;
    const onPad = Math.hypot(this.player.pos.x - this.lift.pos.x, this.player.pos.z - this.lift.pos.z) < 3.2;
    if (!h.started) {
      if (!onPad) {
        this.hud.setWave('<b>GET TO THE FREIGHT LIFT</b><br/>It will not wait for you politely.');
        return;
      }
      h.started = true;
      audio.bossRoar(1);
    }
    if (onPad) h.time -= dt;
    this.hud.setWave(onPad
      ? `<b>HOLDING — ${Math.ceil(h.time)}s</b><br/>Stay on the platform.`
      : `<b>PAUSED — ${Math.ceil(h.time)}s</b><br/>Return to the platform.`);

    h.spawnTimer -= dt;
    if (h.spawnTimer <= 0 && this.enemies.length < MAX_ENEMIES) {
      h.spawnTimer = 1.35;
      const cfg = floorConfig(this.floorIndex);
      const p = this._spawnPointNear(this.lift.pos, 9, 34);
      if (p) {
        const e = this._spawnEnemy(this._pickEnemyType(cfg), p);
        if (e) h.enemies.push(e);
      }
    }

    if (h.time <= 0) {
      this.holdout = null;
      this.hud.setWave(null);
      this.lift.active = true;
      this._queue(STORY.holdoutDone);
      this.hud.banner('LIFT ARRIVED', 'PRESS E TO ASCEND', 3.6);
      audio.doorOpen();
      audio.setMusicIntensity(0.4);
    }
  }

  _updateSpawning(dt) {
    // Ambient pressure so a floor never feels empty between objectives.
    if (this.boss || this.holdout) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const cfg = floorConfig(this.floorIndex);
    this.spawnTimer = Math.max(2.2, 7 - this.floorIndex * 0.35);
    if (this.enemies.length >= Math.min(MAX_ENEMIES, this.enemyBudget)) return;

    // Keycard floors seed elites that carry the objective item.
    if (this.objective.type === 'keycards' && !this.objectiveDone) {
      const outstanding = this.enemies.filter((e) => e.carriesKeycard).length;
      const spawned = (this.keycardsSpawned || 0);
      if (outstanding + this.objective.done < this.objective.total && spawned < this.objective.total) {
        const p = this._spawnPointNear(this.player.pos, 16, 55);
        if (p) {
          const e = this._spawnEnemy(this._pickEnemyType(cfg), p);
          if (e) {
            e.carriesKeycard = true;
            e.maxHp = Math.round(e.maxHp * 2.6);
            e.hp = e.maxHp;
            e.mesh.scale.setScalar(1.28);
            e.speed *= 0.92;
            this.keycardsSpawned = spawned + 1;
            this.hud.toast(`A CARRIER IS ON THE FLOOR (${spawned + 1}/${this.objective.total})`, 'info', 3);
            audio.glitch(0.5);
          }
        }
        return;
      }
    }

    const p = this._spawnPointNear(this.player.pos, 18, 60);
    if (p) this._spawnEnemy(this._pickEnemyType(cfg), p);
  }

  // ---- interaction ----

  _updateInteraction(dt) {
    const p = this.player;
    const pressed = this.input.pressed('KeyE');
    let prompt = null;
    let best = null, bestD = 3.4;

    const consider = (obj, dist, text, action) => {
      if (dist > bestD) return;
      bestD = dist; best = { text, action };
    };

    for (const c of this.chests) {
      if (!c.interactable) continue;
      const d = Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z);
      consider(c, d, c.prompt(), () => this._interactChest(c));
    }
    if (this.kind && !this.objectiveDone) {
      this.kind.offer(this, (d, text, action) => consider(null, d, text, action));
    }
    this._offerSecrets(consider);
    for (const v of this.vendors) {
      const d = Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z);
      consider(v, d, `${v.kind.label} — ${v.kind.cost} shards`, () => this._useVendor(v));
    }
    for (const it of this.pickups) {
      if (it.kind !== 'weapon') continue;
      const d = Math.hypot(it.pos.x - p.pos.x, it.pos.z - p.pos.z);
      consider(it, d, `Take the ${WEAPONS[it.weaponId].name}`, () => this._takeWeaponPickup(it));
    }
    if (this.lift?.active) {
      const d = Math.hypot(this.lift.pos.x - p.pos.x, this.lift.pos.z - p.pos.z);
      consider(this.lift, d, this.floorIndex >= FLOOR_COUNT - 1 ? 'Leave the Pod' : `Ascend to floor ${this.floorIndex + 1}`, () => this._useLift());
    }

    if (best) prompt = best.text;
    this.hud.setInteract(prompt);
    if (pressed && best) best.action();
  }

  _interactChest(c) {
    if (c.state === 'closed') {
      const exclude = this.player.slots.filter(Boolean).map((w) => w.id);
      c.open(this.rng, this.floorIndex, exclude, audio);
      this._queue(STORY.firstRollStart, false, true);
    } else if (c.canClaim) {
      const id = c.claim();
      this._equipWeapon(id);
      $('revealScreen').classList.add('hidden');
      this._revealFor = null;
      if (c.isPrologue && this.prologueActive) this._endPrologue();
    }
  }

  /**
   * The cold open ends the moment the first weapon lands in your hands: the
   * room lights come up, the floor populates, and the doctor starts talking.
   */
  _endPrologue() {
    this.prologueActive = false;
    const cfg = floorConfig(0);
    if (this.chestLight) {
      this.scene.remove(this.chestLight);
      this.chestLight.dispose?.();
      this.chestLight = null;
    }
    this._lightRamp = { t: 0, ambient: cfg.ambient * 1.05, hemi: 0.42, fog: cfg.palette.fogDensity };
    this._queue(STORY.welcome, true);
    this.hud.banner('COLD STORAGE', 'SUBLEVEL B1', 3.4);
    this._populate(cfg, this.rng, 7);
  }

  /** Complete the floor's objective outright. Used by the test harness. */
  forceObjective() {
    if (this.kind?.force) this.kind.force(this);
    else { this.objective.done = this.objective.total; }
    this._checkObjective();
  }

  _useVendor(v) {
    const p = this.player;
    if (!p.spendShards(v.kind.cost)) { audio.deny(); this.hud.toast('NOT ENOUGH SHARDS', 'bad', 1.4); return; }
    audio.pickup();
    switch (v.kind.id) {
      case 'ammo': {
        for (const w of p.slots) {
          if (w && isFinite(w.magSize)) { w.reserveAmmo += w.magSize * 6; w.ammo = w.magSize; }
        }
        this.hud.toast('AMMO RESUPPLIED', 'good', 1.6);
        break;
      }
      case 'health':
        p.heal(p.maxHealth);
        p.debt = 0;
        this.hud.toast('PATCHED UP', 'good', 1.6);
        break;
      case 'reroll': {
        const slot = p.activeSlot;
        const exclude = p.slots.filter(Boolean).map((w) => w.id);
        const pool = Object.keys(WEAPONS).filter((id) => id !== 'knuckles' && !exclude.includes(id));
        const id = pool[this.rng.int(0, pool.length - 1)];
        p.slots[slot] = makeWeapon(id);
        this._refreshPairing();
        this._showReveal(id, false);
        setTimeout(() => $('revealScreen').classList.add('hidden'), 4200);
        this.hud.toast(`RE-ROLLED: ${WEAPONS[id].name}`, 'info', 2.4);
        break;
      }
      default: break;
    }
    v.kind = { ...v.kind, cost: Math.round(v.kind.cost * 1.55) };
  }

  _takeWeaponPickup(item) {
    this._equipWeapon(item.weaponId);
    disposeTree(item.group);
    this.propGroup.remove(item.group);
    const i = this.pickups.indexOf(item);
    if (i >= 0) swapRemove(this.pickups, i);
  }

  _useLift() {
    if (this.floorIndex >= FLOOR_COUNT - 1) { this._victory(); return; }
    audio.doorOpen();
    this.prologue = false;
    this.loadFloor(this.floorIndex + 1);
  }

  // ---- weapons ----

  _equipWeapon(id) {
    const p = this.player;
    const w = makeWeapon(id);
    const slot = p.slots[0] === null ? 0 : (p.slots[1] === null ? 1 : p.activeSlot);
    const replaced = p.slots[slot];
    p.slots[slot] = w;
    p.activeSlot = slot;
    this._refreshPairing();
    this._setViewmodel(w);
    audio.pickup();
    this.hud.toast(`EQUIPPED: ${w.name}`, 'good', 2);

    if (!this.seenWeapons.has(id)) {
      this.seenWeapons.add(id);
      if (id === 'behemoth') this._queue(STORY.behemothFound, true);
      else if (id === 'fake47') this._queue(STORY.fakeFound, true);
      else if (this.seenWeapons.size === 1) this._queue(STORY.firstChestOpened);
    }

    if (replaced) {
      this.hud.toast(`DROPPED: ${replaced.name}`, 'info', 1.8);
      this._dropWeaponPickup(replaced.id, p.pos);
    }
  }

  _dropWeapon() {
    const p = this.player;
    const w = p.slots[p.activeSlot];
    if (!w) { audio.deny(); return; }
    p.slots[p.activeSlot] = null;
    this._dropWeaponPickup(w.id, p.pos);
    this._refreshPairing();
    this._setViewmodel(p.weapon);
    this.hud.toast(`DROPPED: ${w.name}`, 'info', 1.6);
    audio.ui(280);
  }

  _swapSlot() {
    const p = this.player;
    if (p.swapCooldown > 0) return;
    p.activeSlot = 1 - p.activeSlot;
    p.swapCooldown = 0.25;
    this.vmSwapT = 0;
    this._setViewmodel(p.weapon);
    this.runtime.lastFireTime = -99;
    audio.ui(620);
    this._updateRevealReplaceLabel();
  }

  _selectSlot(i) {
    const p = this.player;
    if (p.activeSlot === i) return;
    p.activeSlot = i;
    p.swapCooldown = 0.2;
    this.vmSwapT = 0;
    this._setViewmodel(p.weapon);
    this.runtime.lastFireTime = -99;
    audio.ui(620);
    this._updateRevealReplaceLabel();
  }

  _refreshPairing() {
    const p = this.player;
    const [a, b] = p.pairing();
    const before = new Set(this.pairing?.active.map((r) => r.id) || []);
    this.pairing = evaluatePairing(a, b);
    this.runtime.refresh(p, this.pairing);
    const summary = pairingSummary(this.pairing);
    this.hud.setSynergies(summary);
    for (const r of summary) {
      if (before.has(r.id)) continue;
      this.hud.toast(`${r.kind === 'desynergy' ? '⚠ ' : '✦ '}${r.name}`, r.kind === 'desynergy' ? 'bad' : 'good', 3);
      if (!this.seenSynergies.has(r.id)) {
        this.seenSynergies.add(r.id);
        this._sayNow(`${r.kind === 'desynergy' ? '⚠' : '✦'} ${r.name} — ${r.text}`, 'SYSTEM', 4.5);
        if (this.seenSynergies.size === 1) {
          this._queue(r.kind === 'desynergy' ? STORY.desynergyFound : STORY.synergyFound);
        }
      }
    }
    this._setViewmodel(p.weapon);
  }

  _onWeaponEvolved(weapon, stage) {
    this.hud.banner(stage.name.toUpperCase(), 'IT GREW UP', 3.6);
    this.hud.toast(stage.name, 'good', 3);
    this._sayNow(stage.line, 'SYSTEM', 4.5);
    this._queue(STORY.babyEvolved);
    this._refreshPairing();
    this._setViewmodel(this.player.weapon);
    this.particles.burst(this.player.pos.x, this.player.eyeY(), this.player.pos.z, 20, {
      color: stage.color, speed: 4, size: 0.1, life: 0.9, gravity: 2,
    });
  }

  _showReveal(id, canTake = true) {
    const def = WEAPONS[id];
    $('revealScreen').classList.remove('hidden');
    $('revealRarity').textContent = `${RARITY_NAMES[def.rarity]} · ${def.kind === 'melee' ? 'MELEE' : 'RANGED'}`;
    $('revealRarity').style.color = `#${RARITY_COLORS[def.rarity].toString(16).padStart(6, '0')}`;
    $('revealName').textContent = def.name;
    $('revealDesc').textContent = def.desc;
    $('revealTip').textContent = def.tip || '';
    $('revealFlavor').textContent = def.flavor || '';
    $('revealTake').style.display = canTake ? '' : 'none';
    this._updateRevealReplaceLabel();
  }

  _updateRevealReplaceLabel() {
    const p = this.player;
    const slot = p.slots[0] === null ? 0 : (p.slots[1] === null ? 1 : p.activeSlot);
    const cur = p.slots[slot];
    $('revealReplace').textContent = cur ? `slot ${slot + 1} (${cur.name})` : `empty slot ${slot + 1}`;
  }

  // ---- viewmodel ----

  _setViewmodel(weapon) {
    if (this.vmModel) {
      disposeTree(this.vmModel);
      this.vmHolder.remove(this.vmModel);
      this.vmModel = null;
    }
    if (this.vmHands) {
      disposeTree(this.vmHands);
      this.vmHolder.remove(this.vmHands);
      this.vmHands = null;
    }
    if (!weapon) return;
    this.vmModel = buildWeaponModel(weapon.id, weapon);

    // Auto-frame. The models now range from a 6cm knife to a six-barrel rotary,
    // and every one of them has its origin at the grip rather than at its
    // centre, so a single hand-tuned holder transform cannot hold them all.
    // Normalise each model to a standard on-screen size and centre it here,
    // and the holder only has to worry about where the hands go.
    const box = new THREE.Box3().setFromObject(this.vmModel);
    const size = box.getSize(this._tmpA);
    const centre = box.getCenter(this._tmpB);

    // Scale on visual bulk, not on length. Normalising by the longest axis
    // alone treats a rifle and a six-barrel rotary as the same size because
    // both are about 1.7 long — and the rotary is three times as thick, so it
    // ended up filling the screen. Cross-section dominates what the frame
    // actually costs, so it dominates here too.
    const bulk = Math.max(size.x, size.y) * 2.8 + size.z * 0.32;
    const hold = holdFor(weapon.id, weapon.kind);
    // `frame` lets a weapon opt out of filling the screen. Only the knuckle
    // duster needs it: it is worn rather than held, so the hand is necessarily
    // wider than the weapon, and normalising the brass to fill the frame put a
    // fist the size of the frame behind it.
    const k = (weapon.kind === 'melee' ? 1.55 : 1.35)
      * (hold.frame ?? 1) / Math.max(0.001, bulk);
    this.vmModel.scale.setScalar(k);

    // Frame on the grip, not on the bounding box.
    //
    // Anchoring on the centroid centres whatever the model happens to be
    // mostly made of, which for the Staggeringly Large Knife is 1.7 units of
    // blade — so the handle, and both hands holding it, ended up off the
    // bottom-right corner. Every real first-person viewmodel does the
    // opposite: the hands sit at a fixed place on screen and the weapon
    // extends forward from them, so a long gun reaches further into the frame
    // rather than shoving its own grip out of it. `HAND_REST` is that fixed
    // place, and it is the same for all twenty-two weapons.
    const grip = hold.grip || [0, 0];
    this.vmModel.position.set(
      -centre.x * k,
      HAND_REST.y - grip[0] * k,
      HAND_REST.z - grip[1] * k,
    );
    this.vmModel.userData.frameScale = k;

    this.vmHolder.add(this.vmModel);

    // --- hands ------------------------------------------------------------
    // Siblings of the model, not children of it. The model carries its own
    // spin (the Behemoth's barrel cluster) and its own framing scale; a hand
    // parented into that would rotate with the barrels and shrink when the
    // weapon did. Placing the rig alongside means a model-space point `q`
    // lands at `vmModel.position + k * q`, which is all the arithmetic below.
    const hands = buildHands(hold);
    const mp = this.vmModel.position;
    // Depth and height fall out for free now the model is grip-anchored: the
    // grip is at HAND_REST, so the firing hand goes there and never moves
    // between weapons. Laterally the rig follows the model's own centring, so
    // a gun with an off-centre magazine does not leave the hands beside it.
    hands.position.set(mp.x, HAND_REST.y, HAND_REST.z);

    // Size the hands off the weapon's own scale rather than fixing them.
    //
    // The framing scale `k` does not preserve real-world size — it normalises
    // visual bulk — so a mop ends up drawn at half the units-per-metre of a
    // rifle. Fixed-size hands are therefore right for exactly one weapon and
    // wrong for the other twenty-one; on the mop they came out looking like
    // oven gloves. Tracking `k` makes the hand match the grip it is closing on,
    // which is the thing the eye actually checks, and `hs` carries how big a
    // hand is in that particular model's units. The clamp is only a guard
    // against a model with a degenerate bounding box, not a tuning knob.
    const handScale = clamp(k * (hold.hs ?? KIT_HAND_SCALE), 0.4, 8);
    for (const limb of [hands.userData.right, hands.userData.left]) {
      if (!limb) continue;
      limb.scale.setScalar(handScale);
      // Cap how far the forearm reaches back, in holder space rather than in
      // the hand's own units. The arm is authored proportional to the hand, so
      // on a knuckle duster — where the hand has to be scaled up five-fold to
      // fit brass authored three times a real hand's span — the forearm came
      // out two and a half units long, ran straight through the near plane and
      // filled the entire screen with a pale blue slab. Thickness still tracks
      // the hand so the wrist join holds; only the length is bounded.
      const reach = limb.userData.armLen * handScale;
      limb.userData.arm.scale.set(1, 1, Math.min(1, 0.78 / Math.max(0.01, reach)));
    }
    const left = hands.userData.left;
    if (left) {
      // The rig's origin is the grip, so a model-space point `q` sits at
      // `(q - grip) * k` from here. Forgetting to subtract the grip put the
      // off hand a fifth of the weapon's length behind where it belonged —
      // on the magazine, for a rifle.
      if (hold.support || hold.fz != null) {
        const my = hold.support ? hold.support[0] : box.min.y + size.y * hold.fy;
        const mz = hold.support ? hold.support[1] : box.min.z + size.z * hold.fz;
        left.position.set(0, (my - grip[0]) * k, (mz - grip[1]) * k);
      } else {
        // The cupped pistol grip has no point on the weapon to reach for — it
        // closes on the firing hand — so buildHands authored its offset in hand
        // units. Scale it, or the two hands drift apart on a big pistol and
        // interpenetrate on a small one.
        left.position.multiplyScalar(handScale);
      }
      // Remember the rest pose: the reload animation moves the off hand away
      // from it and has to be able to put it back.
      hands.userData.leftRest = left.position.clone();
      hands.userData.leftRestRot = left.rotation.clone();
      // And where the magazine well is — just forward of the grip and below
      // the receiver, which is where a magazine lives on nearly everything.
      hands.userData.leftMag = new THREE.Vector3(
        0.03, (box.min.y - grip[0]) * k - 0.04, (size.z * 0.10) * k,
      );
    }
    this.vmReloadPose = 0;
    this.vmHands = hands;
    this.vmHolder.add(hands);
    this.vmSwapT = 0;
  }

  _updateViewmodel(dt) {
    if (!this.vmModel) this._setViewmodel(this.player.weapon);
    const p = this.player;
    const w = p.weapon;
    this.vmSwing = Math.max(0, this.vmSwing - dt * 4.5);
    this.vmKick = damp(this.vmKick, 0, 11, dt);
    this.vmSwapT = Math.min(1, this.vmSwapT + dt * 4.5);

    const speed = Math.hypot(p.vel.x, p.vel.z);
    const bob = Math.sin(p.bob * 2) * Math.min(0.03, speed * 0.0042);
    const sway = Math.cos(p.bob) * Math.min(0.028, speed * 0.004);
    const melee = w?.kind === 'melee';
    const heavy = w?.tags?.includes('heavy');

    // Base rest pose, then additive motion.
    // The models are pre-normalised in _setViewmodel, so these are purely
    // about where the hands sit, not about how big any particular gun is.
    const baseX = melee ? 0.2 : 0.22;
    const baseY = melee ? -0.24 : -0.26;
    const baseZ = melee ? -0.62 : -0.68;
    this.vmHolder.scale.setScalar(0.6);

    const swapDip = (1 - this.vmSwapT) * 0.5;
    const swingAmt = this.vmSwing * this.vmSwing;

    this.vmHolder.position.set(
      baseX + sway - swingAmt * 0.24,
      baseY + bob - swapDip - swingAmt * 0.14,
      baseZ + this.vmKick * 0.1,
    );
    this.vmHolder.rotation.set(
      -p.pitch * 0.06 + this.vmKick * 0.34 + swingAmt * 1.5 - swapDip * 1.1,
      // Canted so the muzzle angles in toward the centre of the screen and the
      // gun is seen from its side. Dead-on you are looking at a breech: the
      // Behemoth's six barrels, the AK's gas tube and every rail on every
      // weapon only read in profile, which is why every shooter does this.
      Math.PI + (melee ? 0.26 : 0.22) - swingAmt * 0.5,
      0.02 + sway * 1.2 + swingAmt * 0.5,
    );

    let reloadT = -1;
    if (w?.reloading) {
      const e = this.runtime.eff(w);
      const t = 1 - clamp((w.reloadEnd - this.now) / Math.max(0.05, e.reload), 0, 1);
      reloadT = t;
      const dip = Math.sin(t * Math.PI);
      this.vmHolder.position.y -= dip * 0.24;
      this.vmHolder.rotation.x += dip * 0.7;
      this.vmHolder.rotation.z += dip * 0.3;
    }
    this._poseHands(reloadT, dt);
    if (w && w.spin > 0.01) {
      this.vmModel.rotation.z = (this.vmModel.rotation.z + dt * w.spin * 26) % TAU;
    } else if (this.vmModel) {
      this.vmModel.rotation.z = 0;
    }
    if (w && w.charge > 0.01) {
      this.vmHolder.position.z -= w.charge * 0.08;
      this.vmHolder.rotation.x -= w.charge * 0.14;
    }
    this._animateWeaponParts(w, dt);
  }

  /**
   * Move the off hand for a reload.
   *
   * A magazine that ejects and a fresh one that appears while the support hand
   * stays welded to the handguard is worse than no hands at all — it draws the
   * eye straight to the thing that is not happening. So the hand leaves the
   * rail, drops to the well, and comes back, and it is critically damped on the
   * way out of it so a cancelled reload does not snap.
   *
   * `t` is reload progress 0..1, or -1 when not reloading.
   */
  _poseHands(t, dt) {
    const h = this.vmHands;
    if (!h) return;
    const left = h.userData.left;
    if (!left || !h.userData.leftRest) return;

    // Out fast, hold at the well, back slower — the same asymmetry a real
    // magazine change has, and the reason a linear sine looks robotic. The
    // timings are pinned to _animateWeaponParts: the magazine bottoms out at
    // 0.45 (inside the hold), seats at 0.85, and the slide slams at 0.88, so
    // the hand is back on the rail exactly as the gun goes live. A support
    // hand still floating out in space over that slam is the frame everyone
    // notices.
    const target = t < 0 ? 0
      : t < 0.28 ? t / 0.28
        : t < 0.52 ? 1
          : Math.max(0, 1 - (t - 0.52) / 0.34);
    this.vmReloadPose = damp(this.vmReloadPose, clamp(target, 0, 1), 16, dt);
    const k = this.vmReloadPose;
    left.position.lerpVectors(h.userData.leftRest, h.userData.leftMag, k);
    // The wrist rolls as it comes off the rail; a hand that translates without
    // rotating reads as a sprite being slid around. Rotations are set from the
    // stored rest pose rather than accumulated, or the hand would keep turning
    // for as long as the player kept reloading.
    // rx is the roll about whatever the hand is gripping, so unwinding it is
    // literally the hand coming off the rail; ry swings it inboard toward the
    // well. Set from the stored rest pose rather than accumulated, or the hand
    // would keep turning for as long as the player kept reloading.
    const r0 = h.userData.leftRestRot;
    left.rotation.set(r0.x - k * 0.75, r0.y + k * 0.45, r0.z);
  }

  /**
   * Drive a weapon's moving parts. The whole gun rocking backwards reads as a
   * camera effect; a slide travelling inside a frame that stays put is what
   * actually reads as a firearm working, and it is the same one number.
   */
  _animateWeaponParts(w, dt) {
    const anim = this.vmModel?.userData?.anim;
    if (!anim) return;
    const kick = this.vmKick;

    // Reload phase, shared by every animated part: 0 → 1 across the reload.
    let rl = -1;
    if (w?.reloading) {
      const e = this.runtime.eff(w);
      rl = 1 - clamp((w.reloadEnd - this.now) / Math.max(0.05, e.reload), 0, 1);
    }

    if (anim.slide) {
      // Cycles back on the kick and returns under spring. During a reload it
      // locks back for the whole magazine change and slams forward at the end
      // — which is the beat that tells you the gun is live again, and doing it
      // on the last 12% means the sound and the motion land together.
      let back = kick * (anim.slide.userData.recoil || 0.06) * 9;
      if (rl >= 0) back = Math.max(back, rl < 0.88 ? 0.1 : 0.1 * (1 - (rl - 0.88) / 0.12));
      anim.slide.position.z = -back;
    }
    if (anim.bolt) {
      let back = kick * 0.09 * 9;
      if (rl >= 0) back = Math.max(back, rl < 0.86 ? 0.09 : 0.09 * (1 - (rl - 0.86) / 0.14));
      anim.bolt.position.z = -back;
      anim.bolt.position.x = kick * 0.01 + (rl >= 0 && rl < 0.86 ? 0.012 : 0);
    }
    if (anim.spin) {
      // The Behemoth spools up while firing and coasts down after.
      this._vmSpin = (this._vmSpin || 0) + dt * (0.6 + kick * 90) * 6;
      anim.spin.rotation.z = this._vmSpin % TAU;
    }
    if (anim.coil) {
      this._vmCoil = (this._vmCoil || 0) + dt * (1.4 + (w?.charge || 0) * 8);
      anim.coil.rotation.z = this._vmCoil % TAU;
      const pulse = 1 + Math.sin(this._vmCoil * 3) * 0.04;
      anim.coil.scale.set(pulse, pulse, 1);
    }
    if (anim.discs) {
      this._vmDisc = (this._vmDisc || 0) + dt * (2 + kick * 120);
      anim.discs.rotation.x = this._vmDisc % TAU;
    }
    if (anim.reel) {
      this._vmReel = (this._vmReel || 0) + dt * kick * 60;
      anim.reel.rotation.x = this._vmReel % TAU;
    }
    if (anim.mag) {
      // Drops out and slaps back in over the reload, and rocks forward on the
      // way out the way a magazine actually leaves a well.
      let drop = 0;
      if (rl >= 0) drop = rl < 0.45 ? (rl / 0.45) : Math.max(0, 1 - (rl - 0.45) / 0.4);
      anim.mag.position.y = -drop * 0.55;
      anim.mag.position.z = -drop * 0.08;
      anim.mag.rotation.x = drop * 0.5;
    }
    if (anim.discs && rl >= 0) {
      // The blade magazine tips out to be refilled.
      anim.discs.position.y = -Math.sin(Math.min(1, rl / 0.7) * Math.PI) * 0.22;
    }
    if (anim.reel && rl >= 0) {
      // Reel Talk winds the line back in on a reload rather than on a kick.
      this._vmReel = (this._vmReel || 0) + dt * 9;
      anim.reel.rotation.x = this._vmReel % TAU;
    }
    if (anim.flicker) {
      // The Null Pointer's ghost half is only sometimes there.
      const on = Math.sin(this.now * 7.3) + Math.sin(this.now * 3.1) > -0.4;
      anim.flicker.visible = on;
    }
  }

  /**
   * How far the four reticle arms should sit from centre, in pixels.
   *
   * Built from the same numbers the shot actually uses: the weapon's cone,
   * whatever the synergy layer did to it, plus movement and recoil. A reticle
   * that does not move while you sprint is a reticle that is lying.
   */
  _reticleSpread() {
    const w = this.player.weapon;
    if (!w) return 0;
    const e = this.runtime.eff(w);
    const base = (e.spread || 0) * 900;
    const speed = Math.hypot(this.player.vel.x, this.player.vel.z);
    const move = Math.min(9, speed * 1.15) * (this.player.sprinting ? 1.5 : 1);
    const kick = this.vmKick * 60;
    return base + move + kick;
  }

  // ---- lighting ----

  _updateLights(dt) {
    this._lightTimer -= dt;
    this.torch.intensity = damp(this.torch.intensity, this.prologueActive ? 0.6 : 2.4, 1.6, dt);

    // Bring the room up after the cold open resolves.
    if (this._lightRamp) {
      const r = this._lightRamp;
      r.t = Math.min(1, r.t + dt * 0.42);
      this.ambientLight.intensity = damp(this.ambientLight.intensity, r.ambient, 1.4, dt);
      this.hemi.intensity = damp(this.hemi.intensity, r.hemi, 1.4, dt);
      this.scene.fog.density = damp(this.scene.fog.density, r.fog, 1.4, dt);
      if (r.t >= 1) this._lightRamp = null;
    }
    if (this.prologueActive) return;

    if (this._lightTimer > 0) return;
    this._lightTimer = 0.45;
    const pts = this.level.lightPoints;
    const px = this.player.pos.x, pz = this.player.pos.z;
    const near = [];
    for (const pt of pts) {
      const d = (pt.x - px) ** 2 + (pt.z - pz) ** 2;
      if (d > 42 * 42) continue;
      near.push({ pt, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.roomLights.length; i++) {
      const l = this.roomLights[i];
      const n = near[i];
      if (!n) { l.visible = false; l.intensity = 0; continue; }
      l.position.set(n.pt.x, n.pt.y, n.pt.z);
      l.visible = true;
      l.intensity = 2.6;
    }
  }

  // ---- story ----

  /**
   * Seconds until the next unprompted line. Roughly 40s in the basement and
   * five minutes by Root, so his absence becomes noticeable on its own.
   */
  _ambientGap() {
    const base = 34 + this.floorIndex * 25;
    return base + Math.random() * (18 + this.floorIndex * 6);
  }

  _queue(lines, priority = false, quiet = false) {
    if (!lines || !lines.length) return;
    const items = lines.map((l) => (typeof l === 'string' ? { speaker: 'KIMVATCH', text: l, hold: 4 } : l));
    if (priority) this.dialogueQueue.unshift(...items);
    else this.dialogueQueue.push(...items);
  }

  _sayNow(text, speaker = 'KIMVATCH', hold = 4) {
    this.dialogueQueue.unshift({ speaker, text, hold });
    if (this.dialogueTimer > 1.2) this.dialogueTimer = 0.4;
  }

  _updateStory(dt) {
    // Scripted beats. The two that change what the game *is* — the lock and
    // the reveal — get the camera, because a line at the bottom of the screen
    // during a firefight is a line the player reads while aiming.
    if (!this.glitchFired && this.floorIndex >= 1 && (this.floorTime > 95 || this.runTime > 400)) {
      this.glitchFired = true;
      this.hud.glitchBurst(2.2 * this.opts.flash);
      this.glitchFx = 1;
      audio.glitch(2);
      this.player.shake = 1.2 * this.opts.shake;
      this._playLockCutscene();
    }
    if (!this.betaRevealFired && this.floorIndex === 5 && this.floorTime > 26) {
      this.betaRevealFired = true;
      this._playRevealCutscene();
    }
    if (this.player.health < this.player.maxHealth * 0.25 && this.now - (this._lastLowHp || -99) > 45) {
      this._lastLowHp = this.now;
      const nags = this.floorIndex >= 7 ? STORY.lowHealthLate : STORY.lowHealth;
      this._queue([nags[(Math.random() * nags.length) | 0]], true);
    }

    // Ambient chatter. The doctor talks constantly in the basement and barely
    // at all near the top — the widening gap is the character arc.
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0 && !this.dialogueQueue.length && !this.currentLine) {
      this.ambientTimer = this._ambientGap();
      const pool = this.ambientPools.get(this.floorIndex);
      const line = pool?.next(Math.random);
      // On the upper floors he sometimes simply doesn't answer.
      const silentChance = clamp((this.floorIndex - 5) * 0.11, 0, 0.5);
      if (line && Math.random() >= silentChance) this._queue([line]);
      else if (this.floorIndex >= 7 && Math.random() < 0.4) {
        this._queue([STORY.silence[(Math.random() * STORY.silence.length) | 0]]);
      }
    }

    // Playback
    if (this.currentLine) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) {
        this.currentLine = null;
        this.hud.hideIntercom();
      }
      return;
    }
    if (!this.dialogueQueue.length) return;
    const line = this.dialogueQueue.shift();
    this.currentLine = line;
    this.dialogueTimer = line.hold ?? Math.max(2.6, line.text.length * 0.045);
    const cls = {
      KIMVATCH: '', COLD: 'cold', SYSTEM: 'system', GLITCH: 'glitch',
      BOSS: 'boss', SELF: 'self', CAST: 'boss',
    }[line.speaker] ?? '';
    const label = {
      KIMVATCH: 'DR. KIMVATCH', COLD: 'DR. KIMVATCH', SYSTEM: 'POD SYSTEM',
      GLITCH: '/// ERROR ///', BOSS: '', SELF: 'MICHAEL SANDLOR', CAST: '',
    }[line.speaker] ?? 'DR. KIMVATCH';
    // Boss lines carry their own speaker prefix; split it out for the label.
    let text = line.text;
    let speaker = label;
    if ((line.speaker === 'BOSS' || line.speaker === 'CAST') && text.includes(':')) {
      const i = text.indexOf(':');
      speaker = text.slice(0, i);
      text = text.slice(i + 1).trim();
    }
    this.hud.intercom(speaker, text, cls);
    if (line.speaker === 'GLITCH') {
      audio.glitch(1); this.hud.glitchBurst(0.5 * this.opts.flash);
      this.glitchFx = Math.max(this.glitchFx ?? 0, 0.85);
    } else if (line.speaker === 'COLD') {
      audio.radioBlip(0.45);
    } else {
      audio.radioBlip();
    }
  }

  // ---- hud ----

  _updateObjectiveHud() {
    const o = this.objective;
    if (!o) return;
    let text = `${o.verb} — ${o.label} ${o.done}/${o.total}`;
    if (this.objectiveDone) {
      if (this.lift?.active) text = 'Take the lift up.';
      else if (this.holdout) text = 'Hold the freight lift platform.';
      else text = 'Reach the sealed room. Something is waiting.';
    }
    this.hud.setObjective(text, o.total ? o.done / o.total : 1);
  }

  _updateHud(dt) {
    const p = this.player;
    this.hud.update(dt);
    this.hud.setHealth(p.health, p.maxHealth, p.debt);
    this.hud.setStats(p.shards, this.runTime, p.stats.kills);
    this.hud.setLoadout(p, this.runtime);
    this.hud.setBoss(this.boss && this.boss.alive ? this.boss : null);
    // Low health and fresh hits both bleed into the composite pass.
    const lowHp = clamp(1 - p.health / (p.maxHealth * 0.42), 0, 1);
    this.hurtFlash = Math.max((this.hurtFlash ?? 0) - dt * 3.2, lowHp * 0.75);
    this.post.set('hurt', clamp(this.hurtFlash, 0, 1));
    this.glitchFx = Math.max(0, (this.glitchFx ?? 0) - dt * 1.4);
    this.post.set('glitch', clamp(this.glitchFx, 0, 1));
    this.hud.setDamageVignette(lowHp * 0.4);
    this._updateObjectiveHud();
    this.damageNumbers.update(dt, this.vw, this.vh);

    const statuses = [];
    if (p.debt > 1) statuses.push({ label: `LEDGER DEBT ${Math.round(p.debt)}`, color: '#ff2e6e' });
    if (p.dodgeCooldown > 0) statuses.push({ label: `ROLL ${p.dodgeCooldown.toFixed(1)}s`, color: '#6d7d90' });
    else statuses.push({ label: 'ROLL READY', color: '#4affa0' });
    if (p.iFrames > 0) statuses.push({ label: 'INVULNERABLE', color: '#6fd8ff' });
    if (p.slowFactor < 1) statuses.push({ label: 'SLOWED', color: '#ff9a3c' });
    const w = p.weapon;
    if (w && this.now < w.jammedUntil) statuses.push({ label: 'JAMMED', color: '#ff4a5a' });
    if (w && w.ramp > 0.05) statuses.push({ label: `RAMP ×${(1 + w.ramp).toFixed(1)}`, color: '#4affa0' });
    if (w && w.spin > 0.02 && w.spin < 1) statuses.push({ label: `SPIN ${(w.spin * 100) | 0}%`, color: '#ffd24a' });
    this.hud.setStatuses(statuses);

    // Chest reveal card
    const landed = this.chests.find((c) => c.canClaim &&
      Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 7);
    if (landed) {
      if (this._revealFor !== landed) { this._revealFor = landed; this._showReveal(landed.resultId, true); }
    } else if (this._revealFor) {
      this._revealFor = null;
      $('revealScreen').classList.add('hidden');
    }

    // Compass hint toward the current goal
    this.hud.setCompass(this._compassText());

    // Music intensity tracks nearby threat.
    let threat = 0;
    for (const e of this.enemies) {
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      if (d < 26) threat += 1 - d / 26;
    }
    if (this.boss?.alive) threat += 6;
    audio.setMusicIntensity(clamp(0.28 + threat * 0.12, 0.28, 1));
  }

  _compassText() {
    const p = this.player;
    let target = null, label = '';
    if (this.lift?.active) { target = this.lift.pos; label = 'LIFT'; }
    else if (this.objectiveDone) { target = this.level.roomCenter(this.bossRoom); label = 'SEALED ROOM'; }
    else {
      let bestD = Infinity;
      if (this.objective.type === 'carry' && !this.carrying) {
        for (const c of (this.carryCores || [])) {
          if (c.taken) continue;
          const d = Math.hypot(c.group.position.x - p.pos.x, c.group.position.z - p.pos.z);
          if (d < bestD) { bestD = d; target = c.group.position; label = 'PUMP CORE'; }
        }
      } else if (this.objective.type === 'sequence' && !this.seqKnown) {
        target = this.seqManifest.pos; label = 'MANIFEST';
      } else if (this.objective.type === 'hunt') {
        // Deliberately no marker: finding them is the objective. Point at the
        // room instead of the valve, so you are given a direction, not a pin.
        for (const st of this.stations) {
          if (st.state === 'done') continue;
          const c = this.level.roomCenter(st.room);
          const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z);
          if (d < bestD) { bestD = d; target = c; label = 'RACK BANK'; }
        }
      } else if (this.stations && this.stations.length) {
        for (const n of this.stations) {
          if (n.state === 'done' || n.on) continue;
          const d = Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z);
          if (d < bestD) { bestD = d; target = n.pos; label = this.objective.label; }
        }
        if (!target && this.objective.type === 'circuit') {
          for (const n of this.stations) {
            const d = Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z);
            if (d < bestD) { bestD = d; target = n.pos; label = this.objective.label; }
          }
        }
      }
      if (!target) {
        for (const e of this.enemies) {
          if (!e.carriesKeycard) continue;
          const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
          if (d < bestD) { bestD = d; target = e.pos; label = 'CARRIER'; }
        }
        for (const it of this.pickups) {
          if (it.kind !== 'key') continue;
          const d = Math.hypot(it.pos.x - p.pos.x, it.pos.z - p.pos.z);
          if (d < bestD) { bestD = d; target = it.pos; label = 'DROPPED CARD'; }
        }
      }
    }
    if (!target) return '';
    const ang = Math.atan2(target.x - p.pos.x, target.z - p.pos.z);
    let rel = ang - (p.yaw + Math.PI);
    while (rel > Math.PI) rel -= TAU;
    while (rel < -Math.PI) rel += TAU;
    const dist = Math.round(Math.hypot(target.x - p.pos.x, target.z - p.pos.z));
    const arrow = Math.abs(rel) < 0.35 ? '▲' : rel > 0 ? '▶' : '◀';
    return `${arrow} ${label} · ${dist}m`;
  }

  // ---- lifecycle events ----

  _onPlayerDown() {
    this.state = 'dead';
    this.player.stats.deaths++;
    this.input.releaseLock();
    audio.stopMusic(0.6);
    audio.explode(1.4);
    this.hud.screenFlash(0.8);
    this.showScreen('deathScreen');
    const cfg = floorConfig(this.floorIndex);
    $('deathTitle').textContent = 'INCAPACITATED';
    $('deathBody').innerHTML = `
      <div>The Pod cannot kill you. It can only be patient.</div>
      <div style="color:var(--dim)">${cfg.name} — attempt ${this.player.stats.deaths + 1}</div>
      <div style="margin-top:14px">${this.player.stats.kills} kills · ${formatTime(this.runTime)} elapsed</div>`;
    this._queue(STORY.playerDown, true);
  }

  respawn() {
    // Restart the floor: the layout persists, the population resets.
    const cfg = floorConfig(this.floorIndex);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.dispose();
      swapRemove(this.enemies, i);
    }
    if (this.boss) {
      this.boss.dispose();
      this.boss = null;
      this.bossSpawned = false;
      this.bossDefeated = false;
    }
    // The boss room re-seals behind you when the fight starts. After a wipe it
    // has to open again, or the floor is unwinnable.
    if (this.objectiveDone && !this.bossDefeated && this.bossSealed) this._unsealBossRoom();
    this.projectiles.clear();
    this.particles.clear();
    for (const n of (this.stations || [])) {
      if (n.state === 'defending' || n.state === 'charging') { n.state = 'idle'; n.charge = 0; n.waveEnemies = []; }
    }
    // A wipe drops whatever you were carrying back at the store.
    if (this.carrying) {
      this.carrying.group.position.copy(this.carrying.pos);
      this.carrying = null;
      this.player.carryPenalty = 1;
    }
    // …and stops the Kiln's clock, which is otherwise unwinnable after a death.
    if (this.timedClock > 0) {
      this.timedClock = 0;
      this.hud.setTimer(null);
      for (const n of (this.stations || [])) if (n.state === 'open') n.state = 'idle';
      this.timedOpen = 0;
      this.objective.done = 0;
    }
    if (this.holdout) this.holdout = { time: 92, enemies: [], spawnTimer: 0, started: false };

    this.player.reset(this.level.roomCenter(this.level.rooms[0]));
    for (const w of this.player.slots) {
      if (!w) continue;
      w.ammo = isFinite(w.magSize) ? w.magSize : w.ammo;
      w.reserveAmmo = Math.max(w.reserveAmmo, Math.round((isFinite(w.magSize) ? w.magSize : 0) * 4));
      w.reloading = false;
      w.spin = 0; w.charge = 0; w.ramp = 0; w.jammedUntil = 0;
    }
    this._populate(cfg, this.rng, Math.min(12, 5 + this.floorIndex));
    this.state = 'playing';
    this.showScreen(null);
    this.hud.show();
    this.input.requestLock();
    audio.startMusic({ ...cfg.music });
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releaseLock();
    const s = this.player.stats;
    $('pauseStats').innerHTML = `
      <div>${floorConfig(this.floorIndex).name} · ${formatTime(this.runTime)}</div>
      <div>${s.kills} kills · ${s.bossKills} bosses · ${this.player.totalShards} shards earned</div>
      <div>${s.deaths} incapacitations</div>`;
    this.showScreen('pauseScreen');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.showScreen(null);
    this.state = 'playing';
    this.hud.show();
    this.input.requestLock();
  }

  _victory() {
    this.state = 'victory';
    this.input.releaseLock();
    audio.stopMusic(1.5);
    this.showScreen('victoryScreen');
    const s = this.player.stats;
    $('victoryBody').innerHTML = `
      <div style="font-size:15px;color:var(--ink)">Michael Sandlor — extracted.</div>
      <div>Alpha-01 through Alpha-06 — extracted.</div>
      <div style="margin-top:16px">${formatTime(this.runTime)} · ${s.kills} kills · ${s.bossKills} bosses · ${s.deaths} incapacitations</div>
      <div style="color:var(--dim);margin-top:10px">"If anyone ever finishes: I am sorry it took the whole building to say it."</div>`;
    this._queue(STORY.victory, true);
  }

  // =======================================================================
  // Render
  // =======================================================================

  render() {
    this.renderer.info.reset();
    const drawWorld = (target) => {
      this.renderer.setRenderTarget(target);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      const firstPerson = (this.state === 'playing' || this.state === 'paused')
        && !this.cine?.active;
      if (firstPerson) {
        this.renderer.clearDepth();
        this.renderer.render(this.vmScene, this.vmCamera);
      }
    };
    this.post.render(drawWorld, this.now);
    this.renderer.setRenderTarget(null);
  }
}

/**
 * Ray vs. the target's head sphere. Returns the hit distance, or 0 for a miss
 * (0 is never a real hit here — the muzzle is always outside the head).
 */
function rayHitsHead(origin, ux, uy, uz, target, maxDist) {
  const hy = target.headY ? target.headY() : (target.feetY ?? target.pos.y) + target.height * 0.85;
  const r = (target.headRadius ?? target.height * 0.13) + 0.08;
  const ex = origin.x - target.pos.x;
  const ey = origin.y - hy;
  const ez = origin.z - target.pos.z;
  const b = 2 * (ex * ux + ey * uy + ez * uz);
  const c = ex * ex + ey * ey + ez * ez - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return 0;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / 2;
  if (t < 0) t = (-b + sq) / 2;
  if (t < 0 || t > maxDist) return 0;
  return t;
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
