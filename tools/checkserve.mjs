// Boots the game through tools/serve.mjs (the real dev server, not the test
// harness's own) and reports the build it actually loaded.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 8098;
const server = spawn('node', ['tools/serve.mjs', '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 506 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.game, { timeout: 20000 });
await page.waitForFunction(() => document.getElementById('loadingScreen').classList.contains('hidden'), { timeout: 5000 });
await page.waitForTimeout(300);

const info = await page.evaluate(() => ({
  version: window.game.version,
  stamp: document.getElementById('buildStamp')?.textContent,
  hasPostFX: !!window.game.post,
  hasHeadHitbox: typeof window.game._isHeadHit === 'function',
}));
console.log('loaded:', JSON.stringify(info, null, 1));
await page.screenshot({ path: 'tools/shots/served-title.png' });

if (errors.length) { console.error('errors:', errors.slice(0, 5)); process.exitCode = 1; }
else console.log('✓ served build boots clean');

await browser.close();
server.kill();
