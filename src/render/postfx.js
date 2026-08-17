// Post-processing chain, written against the three.js core (the addon
// EffectComposer isn't vendored).
//
//   scene ──▶ HDR target ──▶ bright pass ──▶ two blur ladders ──▶ composite
//
// The composite does exposure, ACES tonemapping, bloom, colour grading,
// vignette, chromatic aberration, grain and scanlines in one pass. Everything
// emissive in the game — trim strips, muzzle flashes, enemy eyes, the chest
// beam — depends on this to actually glow.

import * as THREE from '../../vendor/three.module.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BRIGHT_FRAG = /* glsl */`
uniform sampler2D tDiffuse;
uniform float threshold;
uniform float softKnee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Soft knee so the bloom ramps in instead of popping at the threshold.
  float knee = threshold * softKnee + 1e-5;
  float soft = clamp(lum - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee);
  float contrib = max(soft, lum - threshold) / max(lum, 1e-5);
  gl_FragColor = vec4(c * contrib, 1.0);
}`;

const BLUR_FRAG = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec2 direction;
varying vec2 vUv;
void main() {
  // 9-tap gaussian collapsed to 5 bilinear samples.
  vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
  vec2 o1 = direction * 1.3846153846;
  vec2 o2 = direction * 3.2307692308;
  sum += texture2D(tDiffuse, vUv + o1).rgb * 0.3162162162;
  sum += texture2D(tDiffuse, vUv - o1).rgb * 0.3162162162;
  sum += texture2D(tDiffuse, vUv + o2).rgb * 0.0702702703;
  sum += texture2D(tDiffuse, vUv - o2).rgb * 0.0702702703;
  gl_FragColor = vec4(sum, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tDiffuse;
uniform sampler2D tBloom0;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform float bloomStrength;
uniform float exposure;
uniform float vignette;
uniform float grain;
uniform float aberration;
uniform float scanline;
uniform float time;
uniform float hurt;          // red pulse when the player is hit
uniform float glitch;        // scanline tearing during story glitches
uniform vec3 tint;           // per-floor colour grade
uniform float saturation;
uniform mat3 colourFilter;   // colour-vision correction (identity by default)
uniform float contrast;
uniform vec2 resolution;
varying vec2 vUv;

// Narkowicz's ACES approximation — cheap, and keeps highlights from going pink.
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = vUv;
  vec2 center = uv - 0.5;
  float r2 = dot(center, center);

  // Horizontal tearing on glitch beats.
  if (glitch > 0.001) {
    float band = floor(uv.y * 90.0);
    float jitter = (hash(vec2(band, floor(time * 24.0))) - 0.5);
    uv.x += jitter * 0.045 * glitch * step(0.72, hash(vec2(band, floor(time * 13.0))));
  }

  // Lens-style chromatic aberration, stronger toward the edges.
  vec2 ca = center * (aberration * (0.35 + r2) + glitch * 0.006);
  vec3 base;
  base.r = texture2D(tDiffuse, uv + ca).r;
  base.g = texture2D(tDiffuse, uv).g;
  base.b = texture2D(tDiffuse, uv - ca).b;

  vec3 bloom =
      texture2D(tBloom0, uv).rgb * 0.5 +
      texture2D(tBloom1, uv).rgb * 0.32 +
      texture2D(tBloom2, uv).rgb * 0.18;

  // --- scene-referred (linear) stage ---
  vec3 color = base + bloom * bloomStrength;
  color *= exposure;
  color *= tint;
  color = aces(color);

  // Linear -> sRGB. Raw ShaderMaterials don't get three's automatic encode,
  // and everything below this line is deliberately display-referred: applying
  // contrast around a 0.5 pivot in linear space crushes every shadow to black.
  color = max(color, vec3(0.0));
  color = mix(color * 12.92,
              1.055 * pow(max(color, vec3(0.0031308)), vec3(1.0 / 2.4)) - 0.055,
              step(vec3(0.0031308), color));

  // --- display-referred grade ---
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(lum), color, saturation);
  color = clamp((color - 0.42) * contrast + 0.42, 0.0, 1.0);

  // Colour-vision assist. Applied after the grade so it operates on exactly
  // what reaches the screen. The identity matrix is the default and costs one
  // multiply, so there is no branch and no separate shader variant.
  color = clamp(colourFilter * color, 0.0, 1.0);

  // Damage response: desaturate and push red in from the edges.
  if (hurt > 0.001) {
    float edge = smoothstep(0.16, 0.52, r2);
    color = mix(color, vec3(lum), hurt * 0.2);
    color = mix(color, vec3(0.62, 0.04, 0.10), hurt * edge * 0.55);
  }

  color *= 1.0 - vignette * smoothstep(0.12, 0.82, r2);

  float n = hash(uv * resolution + fract(time) * 91.7) - 0.5;
  color += n * grain;

  // Very fine scanlines — the Pod is a screen you are standing inside.
  color *= 1.0 - scanline * (0.5 + 0.5 * sin(uv.y * resolution.y * 3.14159));

  gl_FragColor = vec4(color, 1.0);
}`;

/** Fullscreen triangle — one less vertex and no seam down the diagonal. */
function fullscreenGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -1, -1, 0, 3, -1, 0, -1, 3, 0,
  ]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
    0, 0, 2, 0, 0, 2,
  ]), 2));
  return g;
}

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.quadGeo = fullscreenGeometry();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();
    this.quad = new THREE.Mesh(this.quadGeo, null);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    const rtOpts = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    };
    this.sceneRT = new THREE.WebGLRenderTarget(2, 2, rtOpts);
    this.sceneRT.texture.colorSpace = THREE.LinearSRGBColorSpace;

    // Three bloom ladders at 1/2, 1/4 and 1/8 resolution.
    this.levels = [];
    for (let i = 0; i < 3; i++) {
      const a = new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false });
      const b = new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false });
      a.texture.colorSpace = THREE.LinearSRGBColorSpace;
      b.texture.colorSpace = THREE.LinearSRGBColorSpace;
      this.levels.push({ a, b, div: 2 << i });
    }

    this.brightMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: BRIGHT_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, threshold: { value: 1.05 }, softKnee: { value: 0.55 } },
    });
    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, direction: { value: new THREE.Vector2() } },
    });
    this.compositeMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tDiffuse: { value: null },
        tBloom0: { value: null },
        tBloom1: { value: null },
        tBloom2: { value: null },
        bloomStrength: { value: 0.7 },
        exposure: { value: 1.0 },
        vignette: { value: 0.5 },
        grain: { value: 0.016 },
        aberration: { value: 0.0012 },
        scanline: { value: 0.022 },
        time: { value: 0 },
        hurt: { value: 0 },
        glitch: { value: 0 },
        tint: { value: new THREE.Color(1, 1, 1) },
        saturation: { value: 1.08 },
        colourFilter: { value: new THREE.Matrix3() },
        contrast: { value: 1.06 },
        resolution: { value: new THREE.Vector2(2, 2) },
      },
    });
  }

  setSize(width, height, pixelRatio) {
    const w = Math.max(2, Math.floor(width * pixelRatio));
    const h = Math.max(2, Math.floor(height * pixelRatio));
    this.sceneRT.setSize(w, h);
    for (const l of this.levels) {
      const lw = Math.max(2, Math.floor(w / l.div));
      const lh = Math.max(2, Math.floor(h / l.div));
      l.a.setSize(lw, lh);
      l.b.setSize(lw, lh);
    }
    this.compositeMat.uniforms.resolution.value.set(w, h);
  }

  /** Per-floor look. `tint` shifts the grade toward the floor's key colour. */
  setGrade({ tint = 0xffffff, saturation = 1.06, contrast = 1.05, exposure = 1.0, bloom = 0.7, vignette = 0.5 } = {}) {
    const u = this.compositeMat.uniforms;
    u.tint.value.setHex(tint);
    // Normalise so a tint only shifts hue, never overall brightness.
    const t = u.tint.value;
    const avg = (t.r + t.g + t.b) / 3 || 1;
    t.multiplyScalar(1 / avg);
    t.lerp(new THREE.Color(1, 1, 1), 0.86);
    u.saturation.value = saturation;
    u.contrast.value = contrast;
    u.exposure.value = exposure;
    u.bloomStrength.value = bloom;
    u.vignette.value = vignette;
  }

  /**
   * Colour-vision mode.
   *
   * These are daltonisation matrices, not simulations: they rotate the parts
   * of the spectrum a given viewer cannot separate into ones they can, so red
   * enemy tells and green objective markers stop landing on the same
   * perceived colour. `mono` gives up on hue entirely and leans on the fact
   * that every readable element in this game also differs in brightness.
   */
  setColourMode(mode) {
    const M = {
      none: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      // Red/green: push the lost red-green difference into blue and lightness.
      deut: [0.62, 0.38, 0.0, 0.3, 0.7, 0.0, 0.0, 0.28, 0.72],
      prot: [0.57, 0.43, 0.0, 0.56, 0.44, 0.0, 0.0, 0.24, 0.76],
      // Blue/yellow: fold the blue-yellow axis toward red-green.
      trit: [0.95, 0.05, 0.0, 0.0, 0.43, 0.57, 0.0, 0.48, 0.52],
      mono: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722],
    }[mode] || null;
    if (!M) return;
    // Matrix3.set takes row-major, which is what is written above.
    this.compositeMat.uniforms.colourFilter.value.set(
      M[0], M[1], M[2], M[3], M[4], M[5], M[6], M[7], M[8]);
  }

  set(name, value) {
    const u = this.compositeMat.uniforms[name];
    if (u) u.value = value;
  }

  _blit(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  /**
   * `drawScene(renderTarget)` must render the world (and the viewmodel) into
   * the supplied target — the caller owns clearing and depth handling.
   */
  render(drawScene, time) {
    if (!this.enabled) { drawScene(null); return; }

    drawScene(this.sceneRT);

    // Bright pass into the first ladder, then successively coarser blurs.
    this.brightMat.uniforms.tDiffuse.value = this.sceneRT.texture;
    this._blit(this.brightMat, this.levels[0].a);

    for (let i = 0; i < this.levels.length; i++) {
      const l = this.levels[i];
      if (i > 0) {
        // Downsample from the previous level's result.
        this.blurMat.uniforms.tDiffuse.value = this.levels[i - 1].a.texture;
        this.blurMat.uniforms.direction.value.set(1 / this.levels[i - 1].a.width, 0);
        this._blit(this.blurMat, l.a);
      }
      this.blurMat.uniforms.tDiffuse.value = l.a.texture;
      this.blurMat.uniforms.direction.value.set(1.2 / l.a.width, 0);
      this._blit(this.blurMat, l.b);

      this.blurMat.uniforms.tDiffuse.value = l.b.texture;
      this.blurMat.uniforms.direction.value.set(0, 1.2 / l.a.height);
      this._blit(this.blurMat, l.a);
    }

    const u = this.compositeMat.uniforms;
    u.tDiffuse.value = this.sceneRT.texture;
    u.tBloom0.value = this.levels[0].a.texture;
    u.tBloom1.value = this.levels[1].a.texture;
    u.tBloom2.value = this.levels[2].a.texture;
    u.time.value = time;
    this._blit(this.compositeMat, null);
  }

  dispose() {
    this.sceneRT.dispose();
    for (const l of this.levels) { l.a.dispose(); l.b.dispose(); }
    this.quadGeo.dispose();
    this.brightMat.dispose();
    this.blurMat.dispose();
    this.compositeMat.dispose();
  }
}
