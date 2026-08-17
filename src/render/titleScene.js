// The title screen, as a place rather than as a gradient.
//
// The menu used to be words on a radial gradient, which tells a player nothing
// about what they are about to load. This builds a real corridor of the Pod —
// the same panel language, light strips and ceiling fixtures the game uses —
// with one lit chest at the far end and the camera drifting slowly toward it.
// It is the first shot of the game, and it is the same shot the cold open
// opens on, so the menu is a promise the first thirty seconds keeps.
//
// Everything here is procedural and shares the game's post-processing chain,
// so the bloom, grade, grain and scanlines are the ones you play with.

import * as THREE from '../../vendor/three.module.js';
import { UNIT, assemble, disposeTree } from '../world/geometry.js';

const part = (geo, color, o = {}) => ({ geo, color, ...o });
const emit = (geo, color, o = {}) => ({ geo, color, basic: true, ...o });

const CONCRETE = { metal: 0.1, rough: 0.85 };
const PLATE = { metal: 0.55, rough: 0.45 };
const STEEL = { metal: 0.85, rough: 0.3 };

export class TitleScene {
  constructor(renderer, env) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 90);
    this.t = 0;
    this.parallax = { x: 0, y: 0 };
    this._target = { x: 0, y: 0 };

    const pal = {
      fog: 0x04060a, light: 0x9fc4ff, trim: 0x6fd8ff,
      wall: 0x2a2f38, floor: 0x1c2028, wallAccent: 0x3a4250,
    };
    this.scene.fog = new THREE.FogExp2(pal.fog, 0.05);
    if (env) this.scene.environment = env.build(pal);

    this._buildCorridor();
    this._buildChest();
    this._buildLights();
    this._buildDust();
    this._buildShafts();
  }

  /** A receding corridor: floor, walls, ceiling, ribs, and light strips. */
  _buildCorridor() {
    const parts = [];
    const HALF = 3.4, H = 4.4, LEN = 64;

    // Floor and ceiling, with plate seams every two metres.
    parts.push(part(UNIT.box, 0x22262d, { y: -0.05, z: -LEN / 2 + 6, sx: HALF * 2, sy: 0.1, sz: LEN, ...CONCRETE }));
    parts.push(part(UNIT.box, 0x14171c, { y: H, z: -LEN / 2 + 6, sx: HALF * 2, sy: 0.1, sz: LEN, ...CONCRETE }));
    for (let i = 0; i < 32; i++) {
      const z = 6 - i * 2;
      parts.push(part(UNIT.box, 0x0d0f13, { y: 0.012, z, sx: HALF * 2, sy: 0.02, sz: 0.07, ...CONCRETE }));
    }
    parts.push(part(UNIT.box, 0x0d0f13, { y: 0.014, z: -LEN / 2 + 6, sx: 0.08, sy: 0.02, sz: LEN, ...CONCRETE }));

    for (const s of [1, -1]) {
      // Wall, skirting, cornice.
      parts.push(part(UNIT.box, 0x2e343d, { x: s * HALF, y: H / 2, z: -LEN / 2 + 6, sx: 0.2, sy: H, sz: LEN, ...CONCRETE }));
      parts.push(part(UNIT.slab, 0x3a4250, { x: s * (HALF - 0.12), y: 0.22, z: -LEN / 2 + 6, sx: 0.1, sy: 0.44, sz: LEN, ...PLATE }));
      parts.push(part(UNIT.slab, 0x3a4250, { x: s * (HALF - 0.12), y: H - 0.3, z: -LEN / 2 + 6, sx: 0.1, sy: 0.3, sz: LEN, ...PLATE }));
      // Panel joints and the occasional vent.
      for (let i = 0; i < 28; i++) {
        const z = 6 - i * 2.2;
        parts.push(part(UNIT.box, 0x14171c, { x: s * (HALF - 0.11), y: H * 0.55, z, sx: 0.04, sy: H * 0.62, sz: 0.05, ...CONCRETE }));
        if (i % 5 === 2) {
          for (let g = 0; g < 5; g++) {
            parts.push(part(UNIT.box, 0x0f1216, {
              x: s * (HALF - 0.13), y: 1.3 + g * 0.16, z, sx: 0.04, sy: 0.07, sz: 0.7, ...CONCRETE,
            }));
          }
        }
        // Structural ribs every few metres.
        if (i % 4 === 0) {
          parts.push(part(UNIT.bevelBox, 0x424b58, { x: s * (HALF - 0.18), y: H / 2, z, sx: 0.22, sy: H, sz: 0.34, ...PLATE }));
          parts.push(part(UNIT.bevelBox, 0x424b58, { y: H - 0.16, z, sx: HALF * 2, sy: 0.3, sz: 0.3, ...PLATE }));
          for (let b = 0; b < 4; b++) {
            parts.push(part(UNIT.hex, 0x8d939c, {
              x: s * (HALF - 0.3), y: 0.6 + b * 1.1, z, rz: Math.PI / 2, sx: 0.09, sy: 0.05, sz: 0.09, ...STEEL,
            }));
          }
        }
      }
      // Conduit runs along the top of each wall.
      parts.push(part(UNIT.lowCyl, 0x232830, { x: s * (HALF - 0.36), y: H - 0.5, z: -LEN / 2 + 6, rx: Math.PI / 2, sx: 0.13, sy: LEN, sz: 0.13, ...PLATE }));
      parts.push(part(UNIT.lowCyl, 0x232830, { x: s * (HALF - 0.52), y: H - 0.62, z: -LEN / 2 + 6, rx: Math.PI / 2, sx: 0.09, sy: LEN, sz: 0.09, ...PLATE }));
    }
    this.scene.add(assemble(parts));

    // Emissive strips: skirting, cornice and the ceiling run.
    const glow = [];
    for (const s of [1, -1]) {
      glow.push(emit(UNIT.box, 0x6fd8ff, { x: s * (HALF - 0.19), y: 0.16, z: -26, sx: 0.03, sy: 0.07, sz: 64, opacity: 0.9 }));
      glow.push(emit(UNIT.box, 0x2f5f80, { x: s * (HALF - 0.19), y: H - 0.46, z: -26, sx: 0.03, sy: 0.05, sz: 64, opacity: 0.6 }));
    }
    this.scene.add(assemble(glow));
  }

  /** The chest at the end of the corridor, and the beam over it. */
  _buildChest() {
    const g = new THREE.Group();
    g.position.set(0, 0, -19);
    const body = [
      part(UNIT.bevelBox, 0x3a3228, { y: 0.42, sx: 1.9, sy: 0.85, sz: 1.25, metal: 0.55, rough: 0.5 }),
      part(UNIT.slab, 0x59657a, { y: 0.42, z: 0.64, sx: 1.7, sy: 0.6, sz: 0.05, ...PLATE }),
      part(UNIT.bevelBox, 0x4a4038, { y: 0.95, sx: 1.95, sy: 0.28, sz: 1.3, metal: 0.65, rough: 0.42 }),
      part(UNIT.slab, 0x6a5a48, { y: 1.1, sx: 1.8, sy: 0.06, sz: 1.15, ...PLATE }),
      ...[1, -1].flatMap((s) => [0, 1].map((i) => part(UNIT.hex, 0x9aa0aa, {
        x: s * 0.82, y: 0.95, z: -0.45 + i * 0.9, rz: Math.PI / 2, sx: 0.11, sy: 0.07, sz: 0.11, ...STEEL,
      }))),
      part(UNIT.bevelBox, 0x8d939c, { y: 0.86, z: 0.66, sx: 0.34, sy: 0.42, sz: 0.09, ...STEEL }),
      part(UNIT.torus, 0xb6bcc6, { y: 1.04, z: 0.7, sx: 0.24, sy: 0.24, sz: 0.24, ...STEEL }),
      part(UNIT.lowCyl, 0x2a2f38, { y: 0.06, sx: 2.3, sy: 0.12, sz: 1.6, ...PLATE }),
    ];
    g.add(assemble(body));

    // The beam: nested cones, additive, the thing your eye lands on.
    const beam = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(0.5 + i * 0.42, 7.5, 22, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x9fe4ff, transparent: true, opacity: 0.16 - i * 0.032,
          side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
        }),
      );
      m.position.y = 4.9;
      beam.add(m);
    }
    g.add(beam);
    this.beam = beam;

    const core = new THREE.Mesh(UNIT.lowSphere.clone(),
      new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.95 }));
    core.scale.setScalar(0.42);
    core.position.y = 1.5;
    g.add(core);
    this.core = core;

    const halo = new THREE.Mesh(UNIT.torus.clone(),
      new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.6 }));
    halo.scale.setScalar(1.5);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.5;
    g.add(halo);
    this.halo = halo;

    this.scene.add(g);
    this.chest = g;
  }

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0xb8c8e0, 0.22));
    const hemi = new THREE.HemisphereLight(0x8fb4e0, 0x14171c, 0.35);
    this.scene.add(hemi);

    // Ceiling fixtures marching down the corridor, plus their housings.
    const panels = [], housings = [];
    this.fixtures = [];
    for (let i = 0; i < 9; i++) {
      const z = 4 - i * 5.5;
      panels.push(emit(UNIT.plane, 0xbfe0ff, { y: 4.06, z, rx: Math.PI / 2, sx: 2.4, sy: 0.7, opacity: 0.92 }));
      housings.push(part(UNIT.bevelBox, 0x3a4250, { y: 4.16, z, sx: 2.7, sy: 0.18, sz: 0.95, ...PLATE }));
      const l = new THREE.PointLight(0x9fc4ff, 2.2, 13, 1.6);
      l.position.set(0, 3.7, z);
      this.scene.add(l);
      this.fixtures.push({ light: l, base: 2.2, phase: i * 1.7 });
    }
    this.scene.add(assemble(panels), assemble(housings));

    // The chest's own light, which is what actually draws the eye.
    this.chestLight = new THREE.PointLight(0x9fe4ff, 7, 18, 1.3);
    this.chestLight.position.set(0, 2.6, -19);
    this.scene.add(this.chestLight);
  }

  /** Dust in the light. Nothing sells depth like something in the air. */
  _buildDust() {
    const N = 420;
    const geo = UNIT.lowSphere.clone();
    const mat = new THREE.MeshBasicMaterial({ color: 0xbfd8f0, transparent: true, opacity: 0.3, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.frustumCulled = false;
    this.motes = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const p = {
        x: (Math.random() - 0.5) * 6.4,
        y: Math.random() * 4.2,
        z: -1 - Math.random() * 38,
        s: 0.006 + Math.random() * 0.014,
        vy: 0.04 + Math.random() * 0.09,
        drift: (Math.random() - 0.5) * 0.05,
        seed: Math.random() * 100,
      };
      this.motes.push(p);
      m.makeScale(p.s, p.s, p.s).setPosition(p.x, p.y, p.z);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(mesh);
    this.dust = mesh;
    this._m = m;
  }

  /** Light shafts under each fixture — the corridor should feel like it has air in it. */
  _buildShafts() {
    this.shafts = [];
    for (let i = 0; i < 9; i++) {
      const z = 4 - i * 5.5;
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 4.2, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x8fc4ff, transparent: true, opacity: 0.05,
          side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
        }),
      );
      m.position.set(0, 2.1, z);
      m.rotation.x = Math.PI;
      this.scene.add(m);
      this.shafts.push({ mesh: m, phase: i * 1.7 });
    }
  }

  /** Mouse parallax, in normalised screen coords. */
  setPointer(nx, ny) {
    this._target.x = Math.max(-1, Math.min(1, nx));
    this._target.y = Math.max(-1, Math.min(1, ny));
  }

  setSize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    const t = this.t;

    // A long slow dolly that loops without a visible cut: the corridor is
    // uniform enough that resetting the camera at the far end is invisible.
    const cycle = 26;
    const k = (t % cycle) / cycle;
    const z = 3.5 - k * 13;

    this.parallax.x += (this._target.x - this.parallax.x) * Math.min(1, dt * 2.2);
    this.parallax.y += (this._target.y - this.parallax.y) * Math.min(1, dt * 2.2);

    this.camera.position.set(
      this.parallax.x * 0.6 + Math.sin(t * 0.23) * 0.16,
      1.45 + this.parallax.y * -0.28 + Math.sin(t * 0.31) * 0.05,
      z,
    );
    this.camera.lookAt(
      this.parallax.x * 0.9,
      1.15 + this.parallax.y * -0.45,
      -19,
    );
    // A breath of roll, so it never feels locked to an axis.
    this.camera.rotation.z = Math.sin(t * 0.19) * 0.008;

    // Chest: the beam breathes, the core bobs, the halo turns.
    if (this.beam) {
      const pulse = 0.9 + Math.sin(t * 1.1) * 0.1;
      this.beam.scale.set(pulse, 1, pulse);
      this.beam.rotation.y = t * 0.12;
    }
    if (this.core) {
      this.core.position.y = 1.5 + Math.sin(t * 1.4) * 0.08;
      const s = 0.42 + Math.sin(t * 2.6) * 0.03;
      this.core.scale.setScalar(s);
    }
    if (this.halo) {
      this.halo.rotation.z = t * 0.7;
      this.halo.scale.setScalar(1.5 + Math.sin(t * 1.7) * 0.12);
      this.halo.position.y = 1.5 + Math.sin(t * 1.4) * 0.08;
    }
    if (this.chestLight) {
      this.chestLight.intensity = 7 + Math.sin(t * 2.1) * 0.9;
    }

    // Fixtures flicker, one of them badly. A corridor where every light is
    // perfect is a corridor nobody has been maintaining for eleven years.
    for (let i = 0; i < this.fixtures.length; i++) {
      const f = this.fixtures[i];
      let v = f.base * (0.94 + Math.sin(t * 1.3 + f.phase) * 0.06);
      if (i === 5) {
        const n = Math.sin(t * 21 + Math.sin(t * 7) * 3);
        v *= n > 0.1 ? 1 : 0.18;
      }
      f.light.intensity = v;
      const sh = this.shafts[i];
      if (sh) sh.mesh.material.opacity = 0.05 * (v / f.base);
    }

    // Dust drifts up through the shafts and wraps around.
    const m = this._m;
    for (let i = 0; i < this.motes.length; i++) {
      const p = this.motes[i];
      p.y += p.vy * dt;
      p.x += Math.sin(t * 0.6 + p.seed) * p.drift * dt * 6;
      if (p.y > 4.3) { p.y = -0.1; p.x = (Math.random() - 0.5) * 6.4; }
      m.makeScale(p.s, p.s, p.s).setPosition(p.x, p.y, p.z);
      this.dust.setMatrixAt(i, m);
    }
    this.dust.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    disposeTree(this.scene);
  }
}
