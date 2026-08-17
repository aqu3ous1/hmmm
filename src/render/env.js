// Procedural image-based lighting.
//
// Flat-shaded Lambert made every surface in the game read as the same material:
// chrome, flesh, glass and painted steel were indistinguishable. Physically
// shaded materials fix that, but they need something to reflect — so this
// builds a small environment (a graded sky, a floor, and a few bright light
// cards) into a cube target and pre-filters it with PMREM. Metal picks up the
// cards as highlights, rough plastic picks up the gradient, and the per-floor
// palette drives both, which keeps every level's mood in the reflections too.

import * as THREE from '../../vendor/three.module.js';

export class EnvironmentBuilder {
  constructor(renderer) {
    this.renderer = renderer;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileCubemapShader();
    this.current = null;
    this._scene = new THREE.Scene();
    this._built = false;
  }

  _buildScene(pal) {
    const s = this._scene;
    while (s.children.length) s.remove(s.children[0]);

    // Mostly neutral. The floor palette already drives ambient, hemisphere,
    // fixture colour and the grade — letting it drive reflections at full
    // strength as well stacks the same hue five times and floods the frame.
    const NEUTRAL = new THREE.Color(0.5, 0.53, 0.58);
    const tinted = (hex, k, mix) => new THREE.Color(hex).multiplyScalar(k).lerp(NEUTRAL, mix);
    const sky = tinted(pal.light, 0.3, 0.55);
    const horizon = tinted(pal.wallAccent, 1.3, 0.5);
    const ground = tinted(pal.floor, 0.9, 0.6);

    // A big inverted sphere with a vertical gradient baked into vertex colours
    // stands in for the room the reflections come from.
    const geo = new THREE.SphereGeometry(40, 24, 16);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 40;                     // -1 .. 1
      if (y > 0) c.copy(horizon).lerp(sky, Math.min(1, y * 1.6));
      else c.copy(horizon).lerp(ground, Math.min(1, -y * 1.4));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide,
    }));
    s.add(shell);

    // Light cards. These are what actually show up as highlights along a
    // barrel or a shoulder plate, so they are placed like a photographer would.
    const card = (w, h, x, y, z, colour, intensity) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(intensity) }),
      );
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      s.add(m);
    };
    const key = new THREE.Color(0xffffff).lerp(new THREE.Color(pal.light), 0.35);
    const fill = new THREE.Color(0xdfe9f5).lerp(new THREE.Color(pal.trim), 0.45);
    card(30, 12, 0, 22, -14, key, 2.6);      // ceiling strip, main
    card(20, 8, -18, 14, 12, fill, 1.2);     // cool bounce, left
    card(16, 6, 20, 10, 10, key, 0.9);       // rim, right
    card(26, 4, 0, -12, 16, ground, 0.4);    // floor bounce
    return s;
  }

  /** Rebuild the environment for a floor's palette. Returns the env texture. */
  build(pal) {
    const scene = this._buildScene(pal);
    if (this.current) this.current.dispose();
    this.current = this.pmrem.fromScene(scene, 0.04, 0.1, 120);
    this._built = true;
    return this.current.texture;
  }

  get texture() { return this.current ? this.current.texture : null; }

  dispose() {
    if (this.current) this.current.dispose();
    this.pmrem.dispose();
  }
}
