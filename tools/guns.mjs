// Contact sheet of every weapon model, lit like a studio turntable.
//
//   node tools/guns.mjs                # all of them, 4 across
//   node tools/guns.mjs ak47 deagle    # just these
//   node tools/guns.mjs --angle 0.9    # rotate the camera around them
//
// Reviewing gun models one at a time is how you end up with twenty-two
// weapons that each look fine alone and completely inconsistent together.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ANGLE = Number(opt('angle', 0.6));
const OUT = opt('out', 'tools/shots/guns.png');
const only = args.filter((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--angle' && args[args.indexOf(a) - 1] !== '--out');
const PORT = 8177;

mkdirSync('tools/shots', { recursive: true });
const server = spawn('node', ['tools/serve.mjs', '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()); });

await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });

const report = await page.evaluate(async ({ angle, only }) => {
  const THREE = await import('/vendor/three.module.js');
  const { buildWeapon } = await import('/src/render/weaponModels.js');
  const { WEAPONS, makeWeapon } = await import('/src/combat/weapons.js');
  const { EnvironmentBuilder } = await import('/src/render/env.js');

  const ids = only.length ? only : Object.keys(WEAPONS);
  const cols = 4;
  const rows = Math.ceil(ids.length / cols);

  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 260 * rows;
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0b0d11';
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setScissorTest(true);

  const env = new EnvironmentBuilder(renderer);
  const envTex = env.build({ light: 0xdfe8ff, wallAccent: 0x555b66, floor: 0x2a2e35, trim: 0xaab4c4 });

  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.6); key.position.set(3, 5, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc4ff, 1.1); fill.position.set(-4, 1, -2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 2.0); rim.position.set(-1, 2, -6); scene.add(rim);

  const cam = new THREE.PerspectiveCamera(30, 1280 / (260 * rows), 0.01, 40);
  const holder = new THREE.Group();
  scene.add(holder);

  const counts = {};
  const cellW = 1280 / cols, cellH = 260;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    let model;
    try { model = buildWeapon(id, makeWeapon(id)); } catch (e) { counts[id] = 'ERR ' + e.message; continue; }
    counts[id] = model.userData.partCount;
    holder.clear(); holder.add(model);

    // Frame it: fit the camera to the model's own bounds so a tiny knife and
    // a minigun are both legible.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.06, size.length() * 0.5);
    const dist = radius / Math.tan((30 * Math.PI / 180) / 2) * 0.62;
    cam.aspect = cellW / cellH;
    cam.position.set(
      mid.x + Math.sin(angle) * dist, mid.y + dist * 0.34, mid.z - Math.cos(angle) * dist);
    cam.lookAt(mid);
    cam.updateProjectionMatrix();

    const col = i % cols, row = Math.floor(i / cols);
    const px = col * cellW, py = canvas.height - (row + 1) * cellH;
    renderer.setViewport(px, py, cellW, cellH);
    renderer.setScissor(px, py, cellW, cellH);
    renderer.render(scene, cam);
  }

  // Labels, drawn over the render.
  const url = canvas.toDataURL('image/png');
  const c2 = document.createElement('canvas');
  c2.width = canvas.width; c2.height = canvas.height;
  const ctx = c2.getContext('2d');
  await new Promise((res) => { const im = new Image(); im.onload = () => { ctx.drawImage(im, 0, 0); res(); }; im.src = url; });
  ctx.font = '600 15px ui-monospace, monospace';
  for (let i = 0; i < ids.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const x = col * cellW + 12, y = row * cellH + 24;
    const label = `${ids[i]}  ·  ${counts[ids[i]]} parts`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 6, y - 16, ctx.measureText(label).width + 14, 22);
    ctx.fillStyle = '#cfe4ff';
    ctx.fillText(label, x, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.strokeRect(col * cellW, row * cellH, cellW, cellH);
  }
  window.__sheet = c2.toDataURL('image/png');
  canvas.remove();
  return counts;
}, { angle: ANGLE, only });

const data = await page.evaluate(() => window.__sheet);
const buf = Buffer.from(data.split(',')[1], 'base64');
const { writeFileSync } = await import('node:fs');
writeFileSync(OUT, buf);

const bad = Object.entries(report).filter(([, v]) => typeof v !== 'number' || v < 25);
console.log(`wrote ${OUT}`);
console.log(Object.entries(report).map(([k, v]) => `${k}=${v}`).join('  '));
if (bad.length) console.log('THIN OR BROKEN:', bad.map(([k, v]) => `${k}(${v})`).join(', '));

await browser.close();
server.kill();
