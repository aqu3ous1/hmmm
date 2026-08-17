// Contact sheet of every enemy or boss, each framed to its own bounds.
//
//   node tools/cast.mjs                 # the 18 enemies
//   node tools/cast.mjs --bosses        # the 10 bosses
//   node tools/cast.mjs --angle 1.2     # walk the camera around them
//
// The old lineup tool put them all in one row at one scale, which meant the
// Gellump was a smudge and the Motherboard was off-frame. Reviewing models you
// cannot see is how they stay bad.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const BOSSES = args.includes('--bosses');
const ANGLE = Number(opt('angle', 0.5));
const OUT = opt('out', BOSSES ? 'tools/shots/cast-bosses.png' : 'tools/shots/cast-enemies.png');
const PORT = 8179;

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

const report = await page.evaluate(async ({ bosses, angle }) => {
  const THREE = await import('/vendor/three.module.js');
  const M = await import('/src/render/models.js');
  const { EnvironmentBuilder } = await import('/src/render/env.js');

  let items;
  if (bosses) {
    const B = await import('/src/entities/bossTypes.js');
    items = B.BOSS_ORDER.filter(Boolean).map((id) => ({ id, def: B.BOSSES[id], name: B.BOSSES[id].name }));
  } else {
    const E = await import('/src/entities/enemyTypes.js');
    items = Object.values(E.ENEMY_TYPES).map((t) => ({ id: t.id, type: t, name: t.name }));
  }

  const cols = bosses ? 3 : 5;
  const rows = Math.ceil(items.length / cols);
  const cellH = bosses ? 330 : 260;
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = cellH * rows;
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9999';
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setScissorTest(true);

  const env = new EnvironmentBuilder(renderer);
  const envTex = env.build({ light: 0xdfe8ff, wallAccent: 0x555b66, floor: 0x24282f, trim: 0xaab4c4 });
  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.4); key.position.set(3, 5, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc4ff, 1.0); fill.position.set(-4, 2, -1); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 2.2); rim.position.set(-1, 3, -6); scene.add(rim);

  const cellW = 1280 / cols;
  const cam = new THREE.PerspectiveCamera(32, cellW / cellH, 0.02, 80);
  const holder = new THREE.Group();
  scene.add(holder);

  const counts = {};
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let mesh;
    try {
      mesh = bosses ? M.buildBossMesh(it.def) : M.buildEnemyMesh(it.type);
    } catch (e) { counts[it.id] = 'ERR ' + e.message; continue; }
    let tris = 0;
    mesh.traverse((n) => { if (n.geometry?.index) tris += n.geometry.index.count / 3; });
    counts[it.id] = Math.round(tris);
    holder.clear(); holder.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.3, Math.max(size.x, size.y, size.z) * 0.62);
    const dist = radius / Math.tan((32 * Math.PI / 180) / 2) * 0.95;
    cam.position.set(mid.x + Math.sin(angle) * dist, mid.y + dist * 0.16, mid.z + Math.cos(angle) * dist);
    cam.lookAt(mid);
    cam.updateProjectionMatrix();

    const col = i % cols, row = Math.floor(i / cols);
    const px = col * cellW, py = canvas.height - (row + 1) * cellH;
    renderer.setViewport(px, py, cellW, cellH);
    renderer.setScissor(px, py, cellW, cellH);
    renderer.setClearColor(0x0d1015, 1);
    renderer.clear();
    renderer.render(scene, cam);
  }

  const url = canvas.toDataURL('image/png');
  const c2 = document.createElement('canvas');
  c2.width = canvas.width; c2.height = canvas.height;
  const ctx = c2.getContext('2d');
  await new Promise((res) => { const im = new Image(); im.onload = () => { ctx.drawImage(im, 0, 0); res(); }; im.src = url; });
  ctx.font = '600 14px ui-monospace, monospace';
  for (let i = 0; i < items.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const x = col * cellW + 10, y = row * cellH + 22;
    const label = `${items[i].name}  ·  ${counts[items[i].id]} tri`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 5, y - 15, ctx.measureText(label).width + 12, 21);
    ctx.fillStyle = '#cfe4ff';
    ctx.fillText(label, x, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.strokeRect(col * cellW, row * cellH, cellW, cellH);
  }
  window.__sheet = c2.toDataURL('image/png');
  canvas.remove();
  return counts;
}, { bosses: BOSSES, angle: ANGLE });

const data = await page.evaluate(() => window.__sheet);
writeFileSync(OUT, Buffer.from(data.split(',')[1], 'base64'));
console.log(`wrote ${OUT}`);
console.log(Object.entries(report).map(([k, v]) => `${k}=${v}`).join('  '));

await browser.close();
server.kill();
