// Where the draw calls actually go.
//
//   node tools/draws.mjs          # floor 0
//   node tools/draws.mjs 6        # a specific floor
//
// The smoke test reports renderer.info.render.calls at one moment, which
// swings between 42 and 436 depending on which way the camera happens to be
// pointing. That number tells you there is a problem and nothing about where
// it is. This walks the scene graph instead and attributes every mesh to the
// thing that put it there, which is the number you can act on.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const FLOOR = Number(process.argv[2] || 0);
const PORT = 8181;

const server = spawn('node', ['tools/serve.mjs', '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });
await page.click('#btnStart');
await page.waitForFunction(() => document.getElementById('floorCardLoad').textContent.includes('CLICK'), { timeout: 20000 });
await page.mouse.click(450, 300);
await page.waitForTimeout(400);

const out = await page.evaluate(async (floor) => {
  const g = window.game;
  g.cine?.cancel();
  g.hud.setCinematic(false);
  if (g.floorIndex !== floor) {
    const { floorConfig } = await import('/src/world/floors.js');
    g._buildFloor(floor, floorConfig(floor));
    g.state = 'play';
  }
  for (let i = 0; i < 120; i++) { g.now += 1 / 60; g.update(1 / 60); g.input.endFrame(); }

  // Attribute every mesh to the system that created it. Anything reachable
  // from a named field on the game gets that field's name; the rest is
  // reported as unattributed rather than quietly folded into a total.
  const owners = new Map([
    [g.level.group, 'level'],
    [g.level.decorGroup, 'level decor'],
    [g.propGroup, 'props'],
    [g.particles.group, 'particles'],
    [g.projectiles.group, 'projectiles'],
  ]);
  const claim = (obj, label) => { if (obj && obj.isObject3D && !owners.has(obj)) owners.set(obj, label); };
  for (const [key, val] of Object.entries(g)) {
    if (!val) continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (!item) continue;
        claim(item.group, key);
        claim(item.mesh, key);
        claim(item.isObject3D ? item : null, key);
      }
    } else if (typeof val === 'object') {
      claim(val.group, key);
      claim(val.mesh, key);
      claim(val.isObject3D ? val : null, key);
    }
  }
  const tally = new Map();
  const bump = (k, n = 1) => tally.set(k, (tally.get(k) || 0) + n);
  const walk = (node, label) => {
    const own = owners.get(node) || label;
    if (node.isMesh || node.isSprite || node.isLine || node.isPoints) bump(own || 'unattributed');
    for (const c of node.children) walk(c, own);
  };
  for (const c of g.scene.children) {
    if (c.isLight || c.isCamera) continue;
    walk(c, owners.get(c) || null);
  }

  let vm = 0;
  g.vmScene.traverse((o) => { if (o.isMesh) vm++; });

  // What one of each live enemy costs, so the per-unit number is visible
  // rather than inferred from a total.
  const perType = new Map();
  for (const e of g.enemies) {
    let n = 0;
    e.mesh?.traverse((o) => { if (o.isMesh) n++; });
    perType.set(e.type?.id || e.type?.name || '?', n);
  }

  const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, r) => s + r[1], 0);
  return {
    floor: g.floorIndex, name: g.floorCfg?.name,
    live: g.renderer.info.render.calls,
    tris: g.renderer.info.render.triangles,
    vm, total,
    rows: rows.filter((r) => r[1] > 0),
    perType: [...perType.entries()].sort((a, b) => b[1] - a[1]),
  };
}, FLOOR);

console.log(`floor ${out.floor} — ${out.name}`);
console.log(`  rendered this frame: ${out.live} draws, ${out.tris} tris`);
console.log(`  meshes in world scene: ${out.total}   viewmodel scene: ${out.vm}`);
for (const [k, v] of out.rows) console.log(`    ${String(v).padStart(5)}  ${k}`);
console.log('  meshes per enemy type:');
for (const [k, v] of out.perType) console.log(`    ${String(v).padStart(5)}  ${k}`);

await browser.close();
server.kill();
