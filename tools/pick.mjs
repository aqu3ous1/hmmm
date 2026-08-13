// Identifies which mesh is under a set of screen points — for tracking down
// "what is that big flat surface".
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = 8179;
const FLOOR = Number(process.argv[2] || 4);
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });
await page.click('#btnStart');
await page.waitForFunction(() => document.getElementById('floorCardLoad').textContent.includes('CLICK'), { timeout: 20000 });
await page.mouse.click(512, 300);
await page.waitForTimeout(400);
const info = await page.evaluate(async (floor) => {
  const THREE = await import('/vendor/three.module.js');
  const F = await import('/src/world/floors.js');
  const g = window.game;
  g.prologue = false; g._buildFloor(floor, F.floorConfig(floor)); g._enterFloor(F.floorConfig(floor));
  g.prologueActive = false; g._lightRamp = null; g.hud.hide();
  const room = g.level.rooms.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
  const c = g.level.roomCenter(room);
  g.player.pos.set(c.x, 0, c.z + Math.min(9, room.h * 0.9));
  g.player.yaw = 0; g.player.pitch = -0.04;
  for (let i = 0; i < 40; i++) { g.now += 1 / 60; g.update(1 / 60); g.input.endFrame(); }
  const candidates = g.level.rooms.filter((r) => r !== g.bossRoom && r.type !== 'spawn');
  const room2 = (candidates.length ? candidates : g.level.rooms).reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
  const c2 = g.level.roomCenter(room2);
  g.player.pos.set(c2.x, 0, c2.z + Math.min(9, room2.h * 0.9));
  for (let i = 0; i < 20; i++) { g.now += 1 / 60; g.update(1 / 60); g.input.endFrame(); }
  const rc = new THREE.Raycaster();
  const pts = [[0, -0.6], [0, -0.3], [0, 0.55], [-0.8, 0.5]];
  const out = [];
  for (const [x, y] of pts) {
    rc.setFromCamera(new THREE.Vector2(x, y), g.camera);
    const hits = rc.intersectObjects(g.scene.children, true).filter((h) => h.object.visible);
    const h = hits[0];
    out.push(h
      ? `(${x},${y}) -> ${h.object.material.type} color=#${h.object.material.color?.getHexString?.()} vc=${!!h.object.material.vertexColors} d=${h.distance.toFixed(1)} tris=${h.object.geometry.index ? h.object.geometry.index.count / 3 : '?'}`
      : `(${x},${y}) -> nothing`);
  }
  // Paint whatever fills the lower screen bright green so it is unmistakable.
  rc.setFromCamera(new THREE.Vector2(0, -0.6), g.camera);
  const first = rc.intersectObjects(g.scene.children, true).filter((h) => h.object.visible)[0];
  if (first) { first.object.material.color.setHex(0x00ff00); out.push('painted: ' + first.object.material.type); }
  g.render();
  return out;
}, FLOOR);
await page.waitForTimeout(600);
await page.screenshot({ path: 'tools/shots/pick.png' });
console.log(info.join('\n'));
await browser.close(); server.kill();
