// Weapon viewmodel viewer: renders one weapon in the hands against an empty
// scene, so the model and its framing can be iterated on in isolation.
//
//   node tools/vm.mjs behemoth

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const WEAPONS_ARG = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const LIST = WEAPONS_ARG.length ? WEAPONS_ARG : ['ak47'];
const PORT = 8175;
mkdirSync('tools/shots', { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });
await page.click('#btnStart');
await page.waitForFunction(() => document.getElementById('floorCardLoad').textContent.includes('CLICK'), { timeout: 20000 });
await page.mouse.click(512, 300);
await page.waitForTimeout(400);

for (const WEAPON of LIST) {
  await page.evaluate(async (id) => {
    const g = window.game;
    // Probes want the game, not the film.
    g.cine?.cancel();
    g.hud.setCinematic(false);
    const W = await import('/src/combat/weapons.js');
    g.hud.hide();
    g.level.group.visible = false;
    g.propGroup.visible = false;
    for (const c of g.chests) c.group.visible = false;
    for (const e of g.enemies) e.mesh.visible = false;
    g.scene.fog.density = 0.0001;
    g.player.slots[0] = W.makeWeapon(id);
    g.player.activeSlot = 0;
    g._refreshPairing();
    // Force a rebuild: the viewmodel only reloads when the weapon changes, and
    // swapping the slot in place does not trip that check.
    g._setViewmodel(g.player.weapon);
    for (let i = 0; i < 30; i++) { g.now += 1 / 60; g.update(1 / 60); g.input.endFrame(); }
  }, WEAPON);

  await page.waitForTimeout(500);
  const out = `tools/shots/vm-${WEAPON}.png`;
  await page.screenshot({ path: out });
  console.log('wrote', out);
}

await browser.close();
server.kill();
