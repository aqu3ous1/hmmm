// Screenshot of the title screen with the menu corridor running behind it.
//
//   node tools/title.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = 8184;
const server = spawn('node', ['tools/serve.mjs', '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });
await page.mouse.move(760, 300);
await page.waitForTimeout(2500);
const dbg = await page.evaluate(() => {
  const g = window.game;
  return {
    hasTitle: !!g.titleScene,
    hasLevel: !!g.level,
    state: g.state,
    camZ: g.titleScene ? +g.titleScene.camera.position.z.toFixed(2) : null,
    children: g.titleScene ? g.titleScene.scene.children.length : null,
    canvasZ: g.canvas ? getComputedStyle(g.canvas).zIndex : 'no canvas',
  };
});
console.log(JSON.stringify(dbg));
await page.screenshot({ path: 'tools/shots/title.png' });
console.log('wrote tools/shots/title.png');
await browser.close(); server.kill();
