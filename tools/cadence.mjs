// Prints the intercom cadence per floor, and the tone of the lines he still has,
// so the arc can be checked without playing eleven floors.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = 8180;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });
const rows = await page.evaluate(async () => {
  const g = window.game;
  const S = await import('/src/story/script.js');
  const out = [];
  for (let f = 0; f <= 10; f++) {
    g.floorIndex = f;
    let min = Infinity, max = 0;
    for (let i = 0; i < 400; i++) { const v = g._ambientGap(); min = Math.min(min, v); max = Math.max(max, v); }
    const pool = S.STORY.ambient[f] || [];
    const cold = pool.filter((l) => l.speaker === 'COLD').length;
    const silent = Math.max(0, Math.min(0.5, (f - 5) * 0.11));
    out.push(`F${String(f).padStart(2)}  gap ${min.toFixed(0)}-${max.toFixed(0)}s   lines ${pool.length} (${cold} cold)   silence ${(silent * 100).toFixed(0)}%`);
  }
  return out;
});
console.log(rows.join('\n'));
await browser.close(); server.kill();
