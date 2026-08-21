// Why an enemy costs the draw calls it costs.
//
//   node tools/buckets.mjs
//
// assemble() batches by material class, so a rig's draw count is exactly the
// number of distinct (emissive, glow, opacity, basic, metal, rough, smooth,
// env) tuples in it — after quantisation. "A Brute is eighteen meshes" is a
// symptom; this prints the tuples, so the question becomes which surfaces are
// actually distinguishable rather than which numbers happen to differ.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 8183;
const server = spawn('node', ['tools/serve.mjs', '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });

const out = await page.evaluate(async () => {
  const { buildEnemyMesh, buildBossMesh } = await import('/src/render/models.js');
  const { ENEMY_TYPES } = await import('/src/entities/enemyTypes.js');
  const { BOSSES } = await import('/src/entities/bossTypes.js');

  const rows = [];
  const describe = (root) => {
    // Group meshes by the material they ended up sharing within this rig.
    const seen = new Map();
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const m = o.material;
      // Opacity belongs in the key, not in an "alpha" suffix. Collapsing every
      // unlit part into one `basic` row hid the real shape of the problem: the
      // Glitchling's ghosts run at four different alphas and each one is its
      // own material, so a probe that prints "basic" once under-reports it by
      // three draw calls per rig group.
      const a = (m.opacity ?? 1) < 1 ? ` a${(m.opacity ?? 1).toFixed(2)}` : '';
      const key = m.isMeshBasicMaterial
        ? `basic${a}`
        : `m${(m.metalness ?? 0).toFixed(2)} r${(m.roughness ?? 0).toFixed(2)}`
          + `${m.flatShading ? '' : ' smooth'}${a}`
          + `${m.emissive && m.emissive.getHex() ? ' emis' : ''}`;
      seen.set(key, (seen.get(key) || 0) + (o.geometry?.index?.count ?? 0) / 3);
    });
    return seen;
  };

  for (const t of Object.values(ENEMY_TYPES)) {
    const rig = buildEnemyMesh(t);
    let n = 0;
    rig.traverse((o) => { if (o.isMesh) n++; });
    rows.push({ kind: 'enemy', id: t.id, meshes: n, buckets: [...describe(rig).entries()] });
  }
  for (const b of Object.values(BOSSES)) {
    const rig = buildBossMesh(b);
    let n = 0;
    rig.traverse((o) => { if (o.isMesh) n++; });
    rows.push({ kind: 'boss', id: b.id || b.name, meshes: n, buckets: [...describe(rig).entries()] });
  }
  return rows;
});

let total = 0;
for (const kind of ['enemy', 'boss']) {
  console.log(`\n=== ${kind} ===`);
  for (const r of out.filter((x) => x.kind === kind).sort((a, b) => b.meshes - a.meshes)) {
    total += r.meshes;
    console.log(`${String(r.meshes).padStart(3)}  ${r.id}`);
    for (const [k, tris] of r.buckets.sort((a, b) => b[1] - a[1])) {
      console.log(`       ${String(Math.round(tris)).padStart(6)} tris  ${k}`);
    }
  }
}
console.log(`\ntotal meshes across the cast: ${total}`);

await browser.close();
server.kill();
