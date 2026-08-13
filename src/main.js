// Inhibited Abyss — entry point and game orchestration.

import * as THREE from '../vendor/three.module.js';

import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { makeRng, hashSeed, clamp, damp, formatTime, swapRemove, weightedPick, TAU } from './core/util.js';

import { floorConfig, FLOOR_COUNT } from './world/floors.js';
import { generateLayout, Level, CELL, WALL_H, GRID } from './world/level.js';
import { disposeTree } from './world/geometry.js';

import { Player } from './entities/player.js';
import { Enemy, FlowField } from './entities/enemy.js';
import { Boss } from './entities/boss.js';
import { BOSS_ORDER } from './entities/bossTypes.js';

import { ProjectileSystem } from './combat/projectiles.js';
import { Particles, DamageNumbers } from './fx/particles.js';
import { WEAPONS, makeWeapon, RARITY_COLORS, RARITY_NAMES } from './combat/weapons.js';
import { evaluatePairing, pairingSummary } from './combat/synergy.js';
import { WeaponRuntime } from './combat/weaponRuntime.js';

import { Chest, WeaponIconCache } from './props/chest.js';
import { buildNode, buildLift, buildPickup, buildWeaponModel } from './render/models.js';

import { PostFX } from './render/postfx.js';
import { HUD, buildCodex, renderLoadoutDetail } from './ui/hud.js';
import { STORY, AmbientPool } from './story/script.js';

const MAX_ENEMIES = 30;
const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.canvas = $('view');
    this.hud = new HUD();
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
  }

  _initWorldScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.06, 260);
    this.camera.rotation.order = 'YXZ';

    // three.js dropped the legacy PI light scaling in r155, so every intensity
    // here is roughly PI times what the old default would have been.
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.hemi = new THREE.HemisphereLight(0x9fc4ff, 0x121820, 0.9);
    this.scene.add(this.ambientLight, this.hemi);

    // Torch that follows the player — the primary readable light source.
    this.torch = new THREE.PointLight(0xfff0d8, 3.6, 19, 1.15);
    this.scene.add(this.torch);

    // A small pool of static lights snapped to the nearest ceiling panels.
    this.roomLights = [];
    for (let i = 0; i < 7; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 20, 1.2);
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
    this.vmSwing = 0;
    this.vmKick = 0;
    this.vmSwapT = 1;
  }

  _initPlayer() {
    this.player = new Player();
    this.player.fists = makeWeapon('knuckles');
    this.pairing = evaluatePairing(this.player.fists, this.player.fists);
    this.runtime = new WeaponRuntime(this);
  }

  _wireUI() {
    buildCodex();
    const show = (id) => { for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden'); if (id) $(id).classList.remove('hidden'); };
    this.showScreen = show;

    $('btnStart').onclick = () => { audio.init(); this.startRun(); };
    $('btnHow').onclick = () => { audio.init(); show('howScreen'); this._backTo = 'titleScreen'; };
    $('btnCodex').onclick = () => { audio.init(); show('codexScreen'); this._backTo = 'titleScreen'; };
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

    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing' && !this.input.locked) this.input.requestLock();
    });
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'playing') this.pause();
    };
  }

  _resize() {
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
    this.showScreen('titleScreen');
    this._clearFloor();
  }

  _clearFloor() {
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0;
    if (this.boss) { this.boss.dispose(); this.boss = null; }
    for (const c of this.chests) c.dispose();
    this.chests.length = 0;
    for (const n of this.nodes) { disposeTree(n.group); this.propGroup.remove(n.group); }
    this.nodes.length = 0;
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
    this._clearFloor();
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
    this.ambientLight.intensity = cfg.ambient * 2.0;
    this.hemi.color.setHex(pal.light);
    this.hemi.groundColor.setHex(pal.floor);
    this.hemi.intensity = 0.9;
    this.post.setGrade({
      tint: pal.light,
      bloom: pal.bloom ?? 0.7,
      exposure: pal.exposure ?? 1.08,
      saturation: pal.saturation ?? 1.1,
      contrast: pal.contrast ?? 1.06,
      vignette: pal.vignette ?? 0.52,
    });
    this.torch.color.setHex(0xfff0d8);
    for (const l of this.roomLights) l.color.setHex(pal.light);

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
    if (obj.type === 'nodes') {
      const rooms = this.level.rooms.filter((r) => r.type === 'objective');
      const picks = rooms.length >= obj.count ? rooms
        : rooms.concat(rng.shuffle(this.level.rooms.filter((r) => r.type !== 'spawn' && r.type !== 'boss' && r.type !== 'objective')));
      for (let i = 0; i < obj.count; i++) {
        const room = picks[i % picks.length];
        if (!room) break;
        const pos = this.level.randomPointIn(room, rng, 2.5);
        const group = buildNode(cfg.palette.trim);
        group.position.copy(pos);
        this.propGroup.add(group);
        this.nodes.push({
          group, pos, room, index: i,
          state: 'idle',        // idle | charging | defending | done
          charge: 0, wave: 0, waveEnemies: [], spawnedThisWave: 0,
        });
      }
    } else if (obj.type === 'keycards') {
      this.keycardsSpawned = 0;
      this.eliteTimer = 4;
    }
  }

  _sealBossRoom() {
    const level = this.level;
    const r = this.bossRoom;
    this.gateCells = [];
    const ring = [];
    for (let x = r.x - 1; x <= r.x + r.w; x++) { ring.push([x, r.z - 1]); ring.push([x, r.z + r.h]); }
    for (let z = r.z - 1; z <= r.z + r.h; z++) { ring.push([r.x - 1, z]); ring.push([r.x + r.w, z]); }
    const boxes = [];
    for (const [cx, cz] of ring) {
      if (level.isSolidCell(cx, cz)) continue;
      this.gateCells.push(cx + cz * GRID);
      level.grid[cx + cz * GRID] = 1;
      const wx = level.cellToWorldX(cx) + CELL / 2;
      const wz = level.cellToWorldZ(cz) + CELL / 2;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(CELL, WALL_H, CELL),
        new THREE.MeshBasicMaterial({ color: 0xff4a5a, transparent: true, opacity: 0.16, depthWrite: false }),
      );
      b.position.set(wx, WALL_H / 2, wz);
      boxes.push(b);
    }
    this.barrierMesh = new THREE.Group();
    for (const b of boxes) this.barrierMesh.add(b);
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

    if (this.state === 'playing') {
      this.update(dt);
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
    if (input.pressed('Escape')) { this.pause(); return; }
    if (input.pressed('KeyM')) {
      audio.setVolume(audio.volume > 0 ? 0 : 0.7);
      this.hud.toast(audio.volume > 0 ? 'AUDIO ON' : 'AUDIO MUTED', 'info', 1);
    }
    const showLoadout = input.down('Tab');
    $('loadoutScreen').classList.toggle('hidden', !showLoadout);
    if (showLoadout) renderLoadoutDetail(player, this.runtime, this.pairing);

    // --- look ---
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
    this._updateProjectiles(dt);
    this._updateChests(dt);
    this._updateNodes(dt);
    this._updatePickups(dt);
    this._updateVendors(dt);
    this._updateHoldout(dt);
    this._updateSpawning(dt);
    this._updateInteraction(dt);
    this._updateStory(dt);
    this._updateLights(dt);

    this.particles.update(dt);
    this.projectiles.sync(this.now);

    // --- death ---
    if (!player.alive) { this._onPlayerDown(); return; }

    // --- viewmodel + camera ---
    player.applyCamera(this.camera, dt);
    this._updateViewmodel(dt);
    this.torch.position.set(this.camera.position.x, this.camera.position.y + 0.2, this.camera.position.z);

    // --- hud ---
    this._updateHud(dt);
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
      firing: this.input.locked && this.input.mouse.left,
      firePressed: this.input.mouse.leftPressed,
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

      // Clip the in-cylinder span against the target's vertical extent.
      const yBottom = t.pos.y, yTop = t.pos.y + t.height;
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
    const hy = target.headY ? target.headY() : target.pos.y + target.height * 0.85;
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
      const dy = (t.pos.y + t.height * 0.5) - (origin.y + 1.2);
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
      const d = Math.hypot(t.pos.x - x, t.pos.z - z);
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
    for (const n of this.nodes) {
      const i = n.waveEnemies.indexOf(enemy);
      if (i >= 0) swapRemove(n.waveEnemies, i);
    }
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
    enemy.dispose();
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
      const e = this.enemies[i];
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
    const p = this.player;
    if (!p.hurt(amount, source)) return false;
    if (!silent) {
      audio.hurt();
      this.hud.screenFlash(0.18);
      this.hurtFlash = Math.min(1, (this.hurtFlash ?? 0) + 0.3 + amount * 0.005);
    }
    return true;
  }

  // ---- boss ----

  _bossCtx() {
    return {
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

    audio.stopMusic(0.4);
    setTimeout(() => audio.startMusic({ ...this.boss.def.music, pad: false }), 500);
    audio.bossRoar(1);
    this.hud.banner(this.boss.def.name, this.boss.def.title, 4.4);
    this.particles.ring(pos.x, 0.1, pos.z, { from: 1, to: 16, life: 0.9, color: this.boss.def.build.accent });
    this._queue(this.boss.def.lines.intro.map((t) => ({ speaker: 'BOSS', text: t, hold: Math.max(3, t.length * 0.045) })), true);
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
        new THREE.MeshBasicMaterial({ color: 0xff4a5a, transparent: true, opacity: 0.2, depthWrite: false }),
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
    audio.levelUp();
    this.hud.screenFlash(0.6);
    this.hud.banner('BOSS DOWN', def.name, 3.6);

    // Clear the room's minions as a reward.
    for (let i = this.enemies.length - 1; i >= 0; i--) this._killEnemy(this.enemies[i], null, null);

    const lines = def.lines.death.map((t) => ({ speaker: 'BOSS', text: t, hold: Math.max(3, t.length * 0.05) }));
    this._queue(lines, true);
    this._queue(STORY.bossDown[this.floorIndex] || []);

    setTimeout(() => {
      if (this.boss) { this.boss.dispose(); this.boss = null; }
    }, 2200);

    if (def.dropWeapon) {
      const p = this.boss.pos.clone();
      setTimeout(() => this._dropWeaponPickup(def.dropWeapon, p), 1800);
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
          const dy = p.y - (t.pos.y + t.height * 0.5);
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
    const cfg = floorConfig(this.floorIndex);
    for (const n of this.nodes) {
      const core = n.group.userData.core;
      const ring = n.group.userData.ring;
      core.rotation.y += dt * 1.4;
      core.rotation.x += dt * 0.7;
      ring.rotation.z += dt * 0.8;
      ring.scale.setScalar(2.2 + Math.sin(this.now * 2 + n.index) * 0.2);

      if (n.state === 'done') {
        core.material.color.setHex(0x4affa0);
        core.scale.setScalar(0.7);
        continue;
      }
      if (n.state === 'charging') {
        core.material.color.setHex(0xffd24a);
        core.scale.setScalar(1.1 + n.charge * 0.5);
      }
      if (n.state === 'defending') {
        core.material.color.setHex(0xff4a5a);
        core.scale.setScalar(1.1 + Math.sin(this.now * 9) * 0.14);

        // Feed the wave.
        if (n.waveEnemies.length === 0 && n.spawnedThisWave >= this._waveSize(cfg)) {
          n.wave++;
          n.spawnedThisWave = 0;
          if (n.wave >= cfg.waveCount) {
            n.state = 'done';
            this.objective.done++;
            this.particles.ring(n.pos.x, 0.1, n.pos.z, { from: 1, to: 10, life: 0.8, color: 0x4affa0 });
            audio.levelUp();
            this.hud.toast(`${this.objective.label} ${this.objective.done}/${this.objective.total}`, 'good', 2.4);
            this._checkObjective();
            continue;
          }
          this.hud.toast(`WAVE ${n.wave + 1} / ${cfg.waveCount}`, 'bad', 2);
          audio.bossRoar(2);
        }
        if (n.spawnedThisWave < this._waveSize(cfg) && this.enemies.length < MAX_ENEMIES) {
          n.spawnTimer = (n.spawnTimer || 0) - dt;
          if (n.spawnTimer <= 0) {
            n.spawnTimer = 0.55;
            const p = this._spawnPointNear(n.pos, 8, 34) || this._spawnPointNear(this.player.pos, 10, 40);
            if (p) {
              const e = this._spawnEnemy(this._pickEnemyType(cfg), p);
              if (e) { n.waveEnemies.push(e); n.spawnedThisWave++; }
            }
          }
        }
      }
    }
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
    for (const n of this.nodes) {
      if (n.state === 'done' || n.state === 'defending') continue;
      const d = Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z);
      consider(n, d, n.state === 'charging' ? 'Hold to engage…' : `Engage ${this.objective.label.toLowerCase()}`, () => this._startNode(n));
    }
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

    // Node hold-to-charge: 1.4 seconds of holding E while standing at it.
    for (const n of this.nodes) {
      if (n.state !== 'charging') continue;
      const d = Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z);
      if (d < 3.4 && this.input.down('KeyE')) {
        n.charge = Math.min(1, n.charge + dt / 1.4);
        if (Math.random() < dt * 18) audio.ui(400 + n.charge * 500);
        if (n.charge >= 1) this._nodeEngaged(n);
      } else {
        n.charge = Math.max(0, n.charge - dt * 1.6);
        if (n.charge <= 0) n.state = 'idle';
      }
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
    this._lightRamp = { t: 0, ambient: cfg.ambient * 2.0, hemi: 0.9, fog: cfg.palette.fogDensity };
    this._queue(STORY.welcome, true);
    this.hud.banner('COLD STORAGE', 'SUBLEVEL B1', 3.4);
    this._populate(cfg, this.rng, 7);
  }

  _startNode(n) {
    if (n.state !== 'idle') return;
    n.state = 'charging';
    n.charge = 0;
    audio.ui(500);
  }

  _nodeEngaged(n) {
    n.state = 'defending';
    n.wave = 0;
    n.spawnedThisWave = 0;
    n.waveEnemies = [];
    n.spawnTimer = 0;
    const cfg = floorConfig(this.floorIndex);
    audio.bossRoar(1.6);
    this.particles.ring(n.pos.x, 0.1, n.pos.z, { from: 1, to: 12, life: 0.8, color: 0xff4a5a });
    this.hud.banner('DEFEND THE PANEL', `${cfg.waveCount} WAVES`, 3);
    audio.setMusicIntensity(1);
    this.hud.toast('WAVE 1 / ' + cfg.waveCount, 'bad', 2);
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
    if (!weapon) return;
    this.vmModel = buildWeaponModel(weapon.id, weapon);
    this.vmHolder.add(this.vmModel);
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
    const baseX = heavy ? 0.17 : melee ? 0.17 : 0.2;
    const baseY = melee ? -0.15 : -0.12;
    const baseZ = heavy ? -0.68 : -0.5;
    this.vmHolder.scale.setScalar(melee ? 0.32 : 0.38);

    const swapDip = (1 - this.vmSwapT) * 0.5;
    const swingAmt = this.vmSwing * this.vmSwing;

    this.vmHolder.position.set(
      baseX + sway - swingAmt * 0.24,
      baseY + bob - swapDip - swingAmt * 0.14,
      baseZ + this.vmKick * 0.1,
    );
    this.vmHolder.rotation.set(
      -p.pitch * 0.06 + this.vmKick * 0.34 + swingAmt * 1.5 - swapDip * 1.1,
      Math.PI + (melee ? -0.18 : -0.05) - swingAmt * 0.5,
      0.02 + sway * 1.2 + swingAmt * 0.5,
    );

    if (w?.reloading) {
      const e = this.runtime.eff(w);
      const t = 1 - clamp((w.reloadEnd - this.now) / Math.max(0.05, e.reload), 0, 1);
      const dip = Math.sin(t * Math.PI);
      this.vmHolder.position.y -= dip * 0.24;
      this.vmHolder.rotation.x += dip * 0.7;
      this.vmHolder.rotation.z += dip * 0.3;
    }
    if (w && w.spin > 0.01) {
      this.vmModel.rotation.z = (this.vmModel.rotation.z + dt * w.spin * 26) % TAU;
    } else if (this.vmModel) {
      this.vmModel.rotation.z = 0;
    }
    if (w && w.charge > 0.01) {
      this.vmHolder.position.z -= w.charge * 0.08;
      this.vmHolder.rotation.x -= w.charge * 0.14;
    }
  }

  // ---- lighting ----

  _updateLights(dt) {
    this._lightTimer -= dt;
    this.torch.intensity = damp(this.torch.intensity, this.prologueActive ? 0.6 : 3.6, 1.6, dt);

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
      l.intensity = 3.4;
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
    // Scripted beats
    if (!this.glitchFired && this.floorIndex >= 1 && (this.floorTime > 95 || this.runTime > 400)) {
      this.glitchFired = true;
      this._queue(STORY.glitchEvent, true);
      this.hud.glitchBurst(2.2);
      this.glitchFx = 1;
      audio.glitch(2);
      this.player.shake = 1.2;
    }
    if (!this.betaRevealFired && this.floorIndex === 5 && this.floorTime > 26) {
      this.betaRevealFired = true;
      this._queue(STORY.betaReveal, true);
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
      audio.glitch(1); this.hud.glitchBurst(0.5);
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
      if (this.objective.type === 'nodes') {
        for (const n of this.nodes) {
          if (n.state === 'done') continue;
          const d = Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z);
          if (d < bestD) { bestD = d; target = n.pos; label = this.objective.label; }
        }
      } else {
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
    for (const n of this.nodes) {
      if (n.state === 'defending' || n.state === 'charging') { n.state = 'idle'; n.charge = 0; n.waveEnemies = []; }
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
      if (this.state === 'playing' || this.state === 'paused') {
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
  const hy = target.headY ? target.headY() : target.pos.y + target.height * 0.85;
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
