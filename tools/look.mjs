// Visual check: drop the camera into a chosen floor with a chosen weapon and
// some enemies, and write a screenshot. Iterating on the look without playing.
//
//   node tools/look.mjs [--floor 2] [--weapon ak47] [--out shot.png]

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const FLOOR = Number(opt('floor', 0));
const WEAPON = opt('weapon', 'ak47');
const OUT = opt('out', `tools/shots/look-f${FLOOR}.png`);
const ALL = args.includes('--all');
const RAW = args.includes('--raw');
const PORT = 8174;

mkdirSync('tools/shots', { recursive: true });
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()); });

await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });
await page.click('#btnStart');
await page.waitForFunction(() => document.getElementById('floorCardLoad').textContent.includes('CLICK'), { timeout: 20000 });
await page.mouse.click(512, 300);
await page.waitForTimeout(400);

async function stage(floor, weapon) {
  await page.evaluate(async ({ floor, weapon }) => {
    const g = window.game;
    const W = await import('/src/combat/weapons.js');
    const THREE = await import('/vendor/three.module.js');
    if (g.floorIndex !== floor) {
      g.prologue = false;
      g._buildFloor(floor, (await import('/src/world/floors.js')).floorConfig(floor));
      g._enterFloor((await import('/src/world/floors.js')).floorConfig(floor));
    }
    // Skip the cold-open dim; otherwise leave lighting exactly as the game set it.
    g.prologueActive = false;
    g._lightRamp = null;
    const cfg = (await import('/src/world/floors.js')).floorConfig(floor);

    g.player.slots[0] = W.makeWeapon(weapon);
    g.player.slots[1] = W.makeWeapon(weapon === 'ak47' ? 'sanguine' : 'ak47');
    g.player.activeSlot = 0;
    g._refreshPairing();

    // Stand in the biggest room, facing its middle, with a crowd in front.
    const candidates = g.level.rooms.filter((r) => r !== g.bossRoom && r.type !== 'spawn');
    const room = (candidates.length ? candidates : g.level.rooms)
      .reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
    const c = g.level.roomCenter(room);
    g.player.pos.set(c.x, 0, c.z + Math.min(9, room.h * 0.9));
    g.player.yaw = 0; g.player.pitch = -0.04;
    for (let i = g.enemies.length - 1; i >= 0; i--) { g.enemies[i].dispose(); g.enemies.splice(i, 1); }
    const pool = cfg.enemies;
    for (let i = 0; i < 7; i++) {
      const t = pool[i % pool.length].id;
      const p = new THREE.Vector3(c.x + (i - 3) * 1.9, 0, c.z + 2 - (i % 3) * 2.2);
      if (!g.level.isSolidAt(p.x, p.z)) g._spawnEnemy(t, p);
    }
    g.hud.intercom('DR. KIMVATCH', 'Every weapon in the Pod is something he loved. That is the whole design document.', '');
    for (let i = 0; i < 40; i++) { g.now += 1 / 60; g.update(1 / 60); g.input.endFrame(); }
  }, { floor, weapon });
  if (RAW) await page.evaluate(() => { window.game.post.enabled = false; });
  await page.waitForTimeout(900);
}

if (ALL) {
  const weapons = ['ak47', 'behemoth', 'bigknife', 'roombroom', 'nimbo', 'actuary', 'sawblade', 'deagle', 'harpoon', 'zapper', 'babygun'];
  for (let f = 0; f <= 10; f++) {
    await stage(f, weapons[f % weapons.length]);
    await page.screenshot({ path: `tools/shots/look-f${String(f).padStart(2, '0')}.png` });
    console.log('captured floor', f);
  }
} else {
  await stage(FLOOR, WEAPON);
  await page.screenshot({ path: OUT });
  console.log('wrote', OUT);
}

await browser.close();
server.kill();
