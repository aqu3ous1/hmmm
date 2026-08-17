// Hand rig probe.
//
//   node tools/hands.mjs            # numbers + a render of the bare rig
//   node tools/hands.mjs ak47       # numbers for how a weapon is framed
//
// Eyeballing a viewmodel from a screenshot is how you spend an afternoon
// nudging offsets that were never the problem. This prints the actual boxes.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const WEAPON = process.argv[2] || 'ak47';
const PORT = 8179;
mkdirSync('tools/shots', { recursive: true });

const server = spawn('node', ['tools/serve.mjs', '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game, { timeout: 20000 });

// `--all` checks every weapon numerically instead of rendering one: a hand
// that lands a metre from the gun is obvious in a table and invisible in a
// screenshot you did not think to take.
if (process.argv.includes('--all')) {
  const rows = await page.evaluate(async () => {
    const THREE = await import('/vendor/three.module.js');
    const { buildWeapon } = await import('/src/render/weaponModels.js');
    const { buildHands, holdFor } = await import('/src/render/hands.js');
    const { WEAPONS, makeWeapon } = await import('/src/combat/weapons.js');
    const lines = [];
    for (const id of Object.keys(WEAPONS)) {
      try {
        const w = makeWeapon(id);
        const m = buildWeapon(id, w);
        const wb = new THREE.Box3().setFromObject(m);
        const ws = wb.getSize(new THREE.Vector3());
        const bulk = Math.max(ws.x, ws.y) * 2.8 + ws.z * 0.32;
        const k = (w.kind === 'melee' ? 1.55 : 1.35) / Math.max(0.001, bulk);
        const hold = holdFor(id, w.kind);
        const hands = buildHands(hold);
        const grip = hold.grip || [0, 0];
        const L = hands.userData.left;
        let sep = 0, lp = '     -      ';
        if (L) {
          if (hold.support || hold.fz != null) {
            const my = hold.support ? hold.support[0] : wb.min.y + ws.y * hold.fy;
            const mz = hold.support ? hold.support[1] : wb.min.z + ws.z * hold.fz;
            L.position.set(0, (my - grip[0]) * k, (mz - grip[1]) * k);
          }
          sep = L.position.length();
          lp = `${L.position.y.toFixed(2)},${L.position.z.toFixed(2)}`;
        }
        // The gun's framed half-length: the off hand must land inside it.
        const reach = ws.z * k * 0.55;
        const bad = L && (sep > reach + 0.05);
        lines.push(`${bad ? '!!' : '  '} ${id.padEnd(11)} pose ${hold.pose.padEnd(6)} k ${k.toFixed(2)}`
          + ` framed ${(ws.z * k).toFixed(2)}  offhand ${lp}  |d| ${sep.toFixed(2)} (max ${reach.toFixed(2)})`);
      } catch (e) {
        lines.push(`!! ${id}: ${e.message}`);
      }
    }
    return lines.join('\n');
  });
  console.log(rows);
  await browser.close();
  server.kill();
  process.exit(0);
}

const out = await page.evaluate(async (id) => {
  const THREE = await import('/vendor/three.module.js');
  const { buildWeapon } = await import('/src/render/weaponModels.js');
  const { buildHands, holdFor } = await import('/src/render/hands.js');
  const { WEAPONS, makeWeapon } = await import('/src/combat/weapons.js');

  const fmt = (v) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
  const lines = [];

  const hands = buildHands(holdFor(id, WEAPONS[id].kind));
  const hb = new THREE.Box3().setFromObject(hands);
  lines.push(`hand rig box: min ${fmt(hb.min)}  max ${fmt(hb.max)}  size ${fmt(hb.getSize(new THREE.Vector3()))}`);
  for (const key of ['right', 'left']) {
    const l = hands.userData[key];
    if (!l) { lines.push(`  ${key}: none`); continue; }
    const lb = new THREE.Box3().setFromObject(l.userData.hand);
    const ab = new THREE.Box3().setFromObject(l.userData.arm);
    lines.push(`  ${key} hand size ${fmt(lb.getSize(new THREE.Vector3()))} at ${fmt(lb.getCenter(new THREE.Vector3()))}`);
    lines.push(`  ${key} arm  size ${fmt(ab.getSize(new THREE.Vector3()))} at ${fmt(ab.getCenter(new THREE.Vector3()))}`);
  }

  const m = buildWeapon(id, makeWeapon(id));
  const wb = new THREE.Box3().setFromObject(m);
  const ws = wb.getSize(new THREE.Vector3());
  const bulk = Math.max(ws.x, ws.y) * 2.8 + ws.z * 0.32;
  const k = (WEAPONS[id].kind === 'melee' ? 1.55 : 1.35) / Math.max(0.001, bulk);
  lines.push(`weapon ${id}: box min ${fmt(wb.min)} max ${fmt(wb.max)} size ${fmt(ws)}`);
  lines.push(`  frameScale k = ${k.toFixed(3)}  =>  framed size ${fmt(ws.clone().multiplyScalar(k))}`);
  const hold = holdFor(id, WEAPONS[id].kind);
  if (hold.fz != null) {
    lines.push(`  support point (model) y ${(wb.min.y + ws.y * hold.fy).toFixed(3)} z ${(wb.min.z + ws.z * hold.fz).toFixed(3)}`
      + `  => framed ${((wb.min.y + ws.y * hold.fy) * k).toFixed(3)}, ${((wb.min.z + ws.z * hold.fz) * k).toFixed(3)}`);
  }
  return lines.join('\n');
}, WEAPON);

console.log(out);
await browser.close();
server.kill();
