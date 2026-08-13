// Renders every enemy (or boss) side by side, so silhouettes can be compared.
//   node tools/lineup.mjs [--bosses]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const BOSSES = process.argv.includes('--bosses');
const argOf = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? Number(process.argv[i + 1]) : d; };
const FROM = argOf('from', 0);
const COUNT = argOf('count', 0);        // 0 = all
const TAG = process.argv.includes('--from') ? `-${FROM}` : '';
const PORT = 8178;
mkdirSync('tools/shots', { recursive: true });
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 460 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, (e.stack || '').split('\n')[1] || ''));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()); });

await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });

const names = await page.evaluate(async ({ bosses, from, count }) => {
  const THREE = await import('/vendor/three.module.js');
  const M = await import('/src/render/models.js');
  const g = window.game;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10141a);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const k = new THREE.DirectionalLight(0xffffff, 2.6); k.position.set(2, 4, 3); scene.add(k);
  const r = new THREE.DirectionalLight(0x8fbfff, 1.3); r.position.set(-3, 1, -2); scene.add(r);

  let items, build, span;
  if (bosses) {
    const B = await import('/src/entities/bossTypes.js');
    items = Object.values(B.BOSSES);
    build = (d) => M.buildBossMesh(d);
    span = 7;
  } else {
    const E = await import('/src/entities/enemyTypes.js');
    items = Object.values(E.ENEMY_TYPES);
    build = (t) => M.buildEnemyMesh(t);
    span = 2.1;
  }
  if (count > 0) items = items.slice(from, from + count);
  const total = items.length;
  const out = [];
  items.forEach((it, i) => {
    const m = build(it);
    m.position.set((i - (total - 1) / 2) * span, 0, 0);
    m.rotation.y = 0.32;   // models face +Z; camera sits on +Z
    scene.add(m);
    out.push(it.name);
  });
  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 40),
    new THREE.MeshLambertMaterial({ color: 0x2a3038 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  const dist = (bosses ? 7.5 : 2.4) * Math.max(3, total) * 0.9;
  const cam = new THREE.PerspectiveCamera(30, 1400 / 460, 0.1, 400);
  cam.position.set(0, bosses ? 2.6 : 1.3, dist);
  cam.lookAt(0, bosses ? 1.7 : 0.85, 0);

  g.post.enabled = false;
  g.renderer.setRenderTarget(null);
  g.renderer.autoClear = true;
  g.renderer.render(scene, cam);
  g._lineupHold = { scene, cam };
  return out;
}, { bosses: BOSSES, from: FROM, count: COUNT });

// Keep re-rendering the lineup instead of the game.
await page.evaluate(() => {
  const g = window.game;
  g.render = () => {
    g.renderer.setRenderTarget(null);
    g.renderer.autoClear = true;
    g.renderer.render(g._lineupHold.scene, g._lineupHold.cam);
  };
  g.hud.hide();
  document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
});
await page.waitForTimeout(1200);
const out = (BOSSES ? 'tools/shots/lineup-bosses' : 'tools/shots/lineup-enemies') + TAG + '.png';
await page.screenshot({ path: out });
console.log('wrote', out);
console.log(names.join(' · '));
await browser.close(); server.kill();
