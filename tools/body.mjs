// Turntable of the player body, so it can be iterated on without playing.
//
//   node tools/body.mjs           # four angles
//   node tools/body.mjs --pose crouch

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const POSE = opt('pose', 'stand');
const PORT = 8185;
mkdirSync('tools/shots', { recursive: true });

const server = spawn('node', ['tools/serve.mjs', '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 420 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });

const info = await page.evaluate(async (pose) => {
  const THREE = await import('/vendor/three.module.js');
  const { buildPlayerModel } = await import('/src/render/playerModel.js');
  const { posePlayerModel } = await import('/src/render/playerModel.js')
    .then((m) => m).catch(() => ({}));
  const { EnvironmentBuilder } = await import('/src/render/env.js');

  const canvas = document.createElement('canvas');
  canvas.width = 1100; canvas.height = 420;
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0b0d11';
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(1100, 420, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d11);
  try { scene.environment = new EnvironmentBuilder(renderer).build(); } catch (e) { /* optional */ }
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.1); key.position.set(2, 4, 3);
  const rim = new THREE.DirectionalLight(0x86c2ff, 1.1); rim.position.set(-3, 1.5, -2);
  scene.add(key, rim);

  const angles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
  let tris = 0, meshes = 0;
  for (let i = 0; i < angles.length; i++) {
    const rig = buildPlayerModel();
    if (posePlayerModel) posePlayerModel(rig, { stance: pose, t: 0, speed: 0 });
    rig.rotation.y = angles[i];
    rig.position.x = (i - 1.5) * 1.1;
    scene.add(rig);
    if (i === 0) {
      rig.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        tris += (o.geometry.index?.count ?? 0) / 3;
      });
      const bb = new THREE.Box3().setFromObject(rig);
      window.__box = `min y ${bb.min.y.toFixed(3)} max y ${bb.max.y.toFixed(3)}`
        + ` height ${(bb.max.y - bb.min.y).toFixed(3)}`
        + ` width ${(bb.max.x - bb.min.x).toFixed(3)}`;
    }
  }

  const cam = new THREE.PerspectiveCamera(30, 1100 / 420, 0.1, 40);
  cam.position.set(0, 1.0, 6.4);
  cam.lookAt(0, 0.85, 0);
  renderer.render(scene, cam);
  return { url: canvas.toDataURL('image/png'), tris: Math.round(tris), meshes, box: window.__box };
}, POSE);

const { writeFileSync } = await import('node:fs');
writeFileSync(`tools/shots/body-${POSE}.png`, Buffer.from(info.url.split(',')[1], 'base64'));
console.log(`wrote tools/shots/body-${POSE}.png — ${info.meshes} meshes, ${info.tris} tris`);
console.log(`  ${info.box}`);

await browser.close();
server.kill();
