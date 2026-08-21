import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = 8187;
const server = spawn('node', ['tools/serve.mjs', '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });
await page.evaluate(async () => { window.__T = await import('/vendor/three.module.js'); });
if (process.argv.includes('--isolate')) await page.evaluate(() => { window.__ISOLATE = true; });
await page.click('#btnStart');
await page.waitForFunction(() => document.getElementById('floorCardLoad').textContent.includes('CLICK'), { timeout: 20000 });
await page.mouse.click(500, 300);
await page.waitForTimeout(400);
for (const [mode, stance, label] of [
  ['shoulder', 'stand', 'tp-stand'],
  ['shoulder', 'crouch', 'tp-crouch'],
  ['shoulder', 'prone', 'tp-prone'],
  ['far', 'stand', 'tp-far'],
  ['off', 'stand', 'fp-ads'],
]) {
  await page.evaluate(({ mode, stance, label }) => {
    const g = window.game;
    g.cine?.cancel(); g.hud.setCinematic(false);
    g.opts.thirdPerson = mode;
    g.player.stance = stance;
    g.player.aim = label === 'fp-ads' ? 1 : 0.2;
    g.player.aiming = label === 'fp-ads';
    // Walk out of the spawn alcove first — the player starts standing on a
    // chest, which sits exactly between the third-person camera and the body.
    g.input.locked = true;
    for (let i = 0; i < 150; i++) {
      g.input.keys.add('KeyW');
      g.now += 1/60; g.player.stance = stance; g.update(1/60); g.input.endFrame();
    }
    g.input.keys.clear();
    for (let i = 0; i < 60; i++) { g.now += 1/60; g.player.stance = stance; g.update(1/60); g.input.endFrame(); }
    // Spawn sits right on top of a chest; walk away from it before looking.
    for (const c of g.chests) c.group.visible = false;
    if (window.__ISOLATE) {
      g.level.group.visible = false;
      g.level.decorGroup.visible = false;
      g.propGroup.visible = false;
      g.scene.fog.density = 0.0001;
      g.hud.hide();
      g.ambientLight.intensity = 1.6;
    }
  }, { mode, stance, label });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `tools/shots/${label}.png` });
  const diag = await page.evaluate(() => {
    const g = window.game;
    const b = g.playerBody;
    return {
      state: g.state, mode: g.opts.thirdPerson, tp: (g._tpDist ?? -1).toFixed(2),
      body: !!b, vis: b?.visible,
      bpos: b ? [b.position.x.toFixed(2), b.position.y.toFixed(2), b.position.z.toFixed(2)].join(',') : '-',
      ppos: [g.player.pos.x.toFixed(2), g.player.pos.y.toFixed(2), g.player.pos.z.toFixed(2)].join(','),
      cam: [g.camera.position.x.toFixed(2), g.camera.position.y.toFixed(2), g.camera.position.z.toFixed(2)].join(','),
      fov: g.camera.fov.toFixed(1),
      ndc: (() => {
        const THREE = window.__T;
        if (!b) return '-';
        const v = b.position.clone(); v.y += 1;
        v.project(g.camera);
        return [v.x.toFixed(2), v.y.toFixed(2), v.z.toFixed(2)].join(',');
      })(),
      parent: b?.parent === g.scene ? 'scene' : (b?.parent ? 'other' : 'none'),
      kids: b ? b.children.length : 0,
      childVis: b ? b.children.map((c) => (c.visible ? 1 : 0)).join('') : '-',
    };
  });
  console.log('wrote', label, JSON.stringify(diag));
}
await browser.close();
server.kill();
