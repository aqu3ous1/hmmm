// Headless smoke test: boots the game, plays a scripted stretch of every floor,
// and fails on any console error or unhandled rejection.
//
//   node tools/smoke.mjs [--floors 11] [--shots] [--seconds 6]

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1]?.startsWith('--') ? true : args[i + 1]) : def;
};
const FLOORS = Number(opt('floors', 11));
const SECONDS = Number(opt('seconds', 5));
const SHOTS = args.includes('--shots');
const PORT = 8171;

mkdirSync('tools/shots', { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  stdio: 'ignore', detached: false,
});
await new Promise((r) => setTimeout(r, 700));

const errors = [];
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') errors.push(`[console] ${t}`);
    else if (process.env.VERBOSE) console.log(`  · ${m.type()}: ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`));

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.game, { timeout: 20000 });
  console.log('✓ booted');

  // Start a run.
  await page.click('#btnStart');
  await page.waitForFunction(() => window.game.state === 'floorcard', { timeout: 10000 });
  await page.waitForFunction(() => document.getElementById('floorCardLoad').textContent.includes('CLICK'), { timeout: 20000 });
  await page.mouse.click(640, 400);
  await page.waitForFunction(() => window.game.state === 'playing', { timeout: 10000 });
  console.log('✓ floor B1 entered');

  // Pointer lock is unavailable headless; drive the input flags directly.
  const unlockInput = async () => page.evaluate(() => { window.game.input.locked = true; });

  // The software rasteriser runs at ~6fps, so wall-clock play would take
  // forever. Step the simulation directly at a fixed 60Hz instead and render
  // only occasionally — the update path is what we're testing.
  // The software rasteriser runs at ~6fps, so wall-clock play would take
  // forever. Step the simulation directly at a fixed 60Hz instead and render
  // only occasionally — the update path is what we're testing.
  //
  // `aim` turns the bot into a real player: it tracks the nearest target, pulses
  // the semi-auto trigger, dodges, and jumps.
  const play = async (seconds, { fire = true, move = true, aim = true } = {}) => {
    await unlockInput();
    const chunks = Math.max(1, Math.round(seconds / 0.5));
    for (let c = 0; c < chunks; c++) {
      await page.evaluate(({ fire, move, aim, c }) => {
        const g = window.game;
        const dt = 1 / 60;
        for (let i = 0; i < 30; i++) {
          const k = c * 30 + i;
          if (g.state !== 'playing') break;
          g.input.locked = true;
          g.input.mouse.left = fire;
          // Semi-auto weapons need a fresh press each shot.
          g.input.mouse.leftPressed = fire && k % 5 === 0;
          if (move) {
            g.input.keys.add('KeyW');
            if (k % 40 < 20) g.input.keys.add('KeyA'); else g.input.keys.delete('KeyA');
            if (k % 97 === 0) g.input.pressedThisFrame.add('KeyC');
            if (k % 53 === 0) g.input.pressedThisFrame.add('Space');
          }
          if (aim) {
            // Snap toward the closest target we can actually see — chasing one
            // through a wall just walks the bot into geometry.
            let best = null, bestD = Infinity;
            const consider = (t) => {
              if (!t || !t.alive) return;
              const d = (t.pos.x - g.player.pos.x) ** 2 + (t.pos.z - g.player.pos.z) ** 2;
              if (d >= bestD) return;
              if (!g.level.lineOfSight(g.player.pos.x, g.player.pos.z, t.pos.x, t.pos.z)) return;
              bestD = d; best = t;
            };
            for (const e of g.enemies) consider(e);
            consider(g.boss);
            if (best) {
              const dx = best.pos.x - g.player.pos.x, dz = best.pos.z - g.player.pos.z;
              g.player.yaw = Math.atan2(-dx, -dz) + (Math.random() - 0.5) * 0.06;
              const dist = Math.hypot(dx, dz) || 1;
              g.player.pitch = Math.atan2((best.pos.y + best.height * 0.65) - g.player.eyeY(), dist);
            } else {
              g.input.mouse.dx = Math.sin(k * 0.31) * 22;
            }
          } else {
            g.input.mouse.dx = Math.sin(k * 0.31) * 22;
          }
          g.now += dt;
          g.update(dt);
          g.input.endFrame();
        }
      }, { fire, move, aim, c });
      await page.waitForTimeout(16);
    }
    await page.evaluate(() => {
      window.game.input.mouse.left = false;
      window.game.input.keys.clear();
    });
  };

  const stats = async () => page.evaluate(() => {
    const g = window.game;
    return {
      state: g.state, floor: g.floorIndex, hp: Math.round(g.player.health),
      enemies: g.enemies.length, kills: g.player.stats.kills,
      shards: g.player.shards, weapon: g.player.weapon?.name, dealt: g.player.stats.damageDealt,
      objective: `${g.objective.done}/${g.objective.total}`,
      boss: g.boss ? Math.round(g.boss.hpFraction * 100) + '%' : '—',
      tris: g.renderer.info.render.triangles, calls: g.renderer.info.render.calls,
      fps: g._fpsSample || 0,
    };
  });

  // --- Weapon bench: every weapon must damage a dummy standing in front of it.
  // This is the real coverage for the 22 firing paths; the wandering bot below
  // only proves the pieces hold together in a live floor.
  const bench = await page.evaluate(async () => {
    const g = window.game;
    const THREE = await import('/vendor/three.module.js');
    const W = await import('/src/combat/weapons.js');
    const rows = [];

    for (const id of Object.keys(W.WEAPONS)) {
      // Clear the field and stand the player somewhere open.
      for (let i = g.enemies.length - 1; i >= 0; i--) { g.enemies[i].dispose(); g.enemies.splice(i, 1); }
      g.projectiles.clear();
      const room = g.level.rooms.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
      const c = g.level.roomCenter(room);
      g.player.pos.set(c.x, 0, c.z + 4);
      g.player.yaw = 0; g.player.pitch = 0;   // faces -Z
      g.player.health = g.player.maxHealth = 100000;
      g.player.shards = 4000;

      g.player.slots[0] = W.makeWeapon(id === 'knuckles' ? 'ak47' : id);
      if (id === 'knuckles') { g.player.slots[0] = null; g.player.slots[1] = null; }
      g.player.activeSlot = 0;
      g._refreshPairing();

      const before = g.player.stats.damageDealt;
      // Within reach of even the shortest melee weapon (Tiny Knife: 1.9m).
      const dummies = [];
      for (let i = 0; i < 4; i++) {
        const spot = new THREE.Vector3(c.x + (i - 1.5) * 0.45, 0, c.z + 4 - 1.5 - i * 0.1);
        if (g.level.isSolidAt(spot.x, spot.z)) continue;
        const d = g._spawnEnemy('shambler', spot);
        if (d) { d.maxHp = d.hp = 40000; d.speed = 0; dummies.push(d); }
      }
      if (!dummies.length) { rows.push(`${id}: no room for dummy`); continue; }

      g.input.locked = true;
      for (let i = 0; i < 200; i++) {
        g.input.mouse.left = true;
        g.input.mouse.leftPressed = i % 7 === 0;
        // Charge weapons need the trigger released to actually fire.
        if (g.player.weapon.eff?.traits.has('charge') && i % 70 === 69) g.input.mouse.left = false;
        // Keep the dummies pinned in place and topped up.
        for (const d of dummies) {
          d.vel.set(0, 0, 0);
          d.hp = Math.min(d.hp + 1, 40000);
          d.jumbified = 0; d.distracted = 0; d.stunned = 0;
        }
        g.now += 1 / 60;
        g.update(1 / 60);
        g.input.endFrame();
      }
      g.input.mouse.left = false;
      const dealt = g.player.stats.damageDealt - before;
      rows.push(`${id}|${dealt.toFixed(1)}`);
    }

    // Restore a sane state for the rest of the run.
    for (let i = g.enemies.length - 1; i >= 0; i--) { g.enemies[i].dispose(); g.enemies.splice(i, 1); }
    g.player.slots[0] = null; g.player.slots[1] = null;
    g.player.maxHealth = 100; g.player.health = 100; g.player.shards = 0;
    g.player.stats.kills = 0; g.player.stats.damageDealt = 0;
    g._refreshPairing();
    g.player.pos.copy(g.level.roomCenter(g.level.rooms[0]));
    return rows;
  });

  {
    const dead = [];
    for (const row of bench) {
      const [id, dealt] = row.split('|');
      if (dealt === undefined) { dead.push(row); continue; }
      if (Number(dealt) <= 0) dead.push(`${id} dealt no damage`);
    }
    if (dead.length) errors.push(`weapon bench: ${dead.join('; ')}`);
    else console.log(`✓ all ${bench.length} weapons deal damage`);
    if (process.env.VERBOSE) for (const r of bench) console.log('   ', r);
  }

  // --- Headshots: aiming at the model's head must hurt more than the body. ---
  const headTest = await page.evaluate(async () => {
    const g = window.game;
    const THREE = await import('/vendor/three.module.js');
    const W = await import('/src/combat/weapons.js');
    const rows = [];

    for (const id of ['ak47', 'deagle', 'actuary']) {
      const measure = (aimHead) => {
        for (let i = g.enemies.length - 1; i >= 0; i--) { g.enemies[i].dispose(); g.enemies.splice(i, 1); }
        g.projectiles.clear();
        const room = g.level.rooms.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
        const c = g.level.roomCenter(room);
        g.player.pos.set(c.x, 0, c.z + 5);
        g.player.yaw = 0;
        g.player.health = g.player.maxHealth = 100000;
        g.player.slots[0] = W.makeWeapon(id);
        g.player.slots[1] = null;
        g.player.activeSlot = 0;
        g._refreshPairing();

        const dummy = g._spawnEnemy('shambler', new THREE.Vector3(c.x, 0, c.z));
        dummy.maxHp = dummy.hp = 500000;
        dummy.speed = 0;
        // Aim exactly at the head centre, or at the middle of the torso.
        const targetY = aimHead ? dummy.headY() : dummy.pos.y + dummy.height * 0.45;
        const dist = 5;
        g.player.pitch = Math.atan2(targetY - g.player.eyeY(), dist);

        const before = g.player.stats.damageDealt;
        g.input.locked = true;
        for (let i = 0; i < 240; i++) {
          dummy.vel.set(0, 0, 0);
          dummy.pos.set(c.x, 0, c.z);
          dummy.hp = 500000;
          g.input.mouse.left = true;
          g.input.mouse.leftPressed = i % 9 === 0;
          if (g.player.weapon.eff?.traits.has('charge') && i % 80 === 79) g.input.mouse.left = false;
          g.player.pitch = Math.atan2(targetY - g.player.eyeY(), dist);
          g.now += 1 / 60;
          g.update(1 / 60);
          g.input.endFrame();
        }
        g.input.mouse.left = false;
        return g.player.stats.damageDealt - before;
      };
      const body = measure(false);
      const head = measure(true);
      rows.push({ id, body: +body.toFixed(0), head: +head.toFixed(0) });
    }

    for (let i = g.enemies.length - 1; i >= 0; i--) { g.enemies[i].dispose(); g.enemies.splice(i, 1); }
    g.player.slots[0] = null; g.player.slots[1] = null;
    g.player.maxHealth = 100; g.player.health = 100;
    g.player.stats.kills = 0; g.player.stats.damageDealt = 0;
    g._refreshPairing();
    g.player.pos.copy(g.level.roomCenter(g.level.rooms[0]));
    g.player.pitch = 0;
    return rows;
  });
  for (const r of headTest) {
    const ratio = r.body > 0 ? r.head / r.body : 0;
    console.log(`   ${r.id}: body ${r.body} vs head ${r.head}  (x${ratio.toFixed(2)})`);
    if (ratio < 1.5) errors.push(`headshots not paying off for ${r.id}: body ${r.body}, head ${r.head}`);
  }
  if (headTest.every((r) => r.head / Math.max(1, r.body) >= 1.5)) console.log('✓ headshots deal bonus damage');

  // --- Floor 0: open the prologue chest via the real interaction path. ---
  await play(1.5, { fire: false, aim: false });
  await page.evaluate(() => {
    const g = window.game;
    const c = g.chests[0];
    g.player.pos.set(c.pos.x + 1.2, 0, c.pos.z);
  });
  await page.evaluate(() => window.game._interactChest(window.game.chests[0]));
  await play(7, { fire: false, move: false, aim: false });
  console.log('✓ slot machine landed on', await page.evaluate(() => window.game.chests[0].resultId));
  await page.evaluate(() => window.game._interactChest(window.game.chests[0]));
  console.log('✓ weapon claimed:', await page.evaluate(() => window.game.player.weapon.name));
  if (SHOTS) await page.screenshot({ path: 'tools/shots/00-prologue.png' });

  // --- Walk every floor. ---
  let lastDealt = 0;
  const quietFloors = [];
  for (let f = 0; f < FLOORS; f++) {
    await page.evaluate(() => { window.game.player.maxHealth = 100000; window.game.player.health = 100000; });
    await play(SECONDS);
    const s = await stats();
    console.log(`  floor ${s.floor}: ${s.enemies} live, ${s.kills} kills, ${Math.round(s.dealt)} dmg, ${s.weapon}, ${s.calls} draws, ${s.tris} tris`);
    // The bot has no pathfinding and gets whatever the chests hand it, so a
    // single quiet floor is noise. The weapon bench above is the authoritative
    // per-weapon check; here we only care that combat works across the climb.
    if (s.dealt <= lastDealt) {
      quietFloors.push(`${s.floor} (${s.weapon})`);
      console.log(`    · no damage dealt on floor ${s.floor} — slow weapon or nothing in reach`);
    }
    lastDealt = s.dealt;
    if (SHOTS) await page.screenshot({ path: `tools/shots/f${String(f).padStart(2, '0')}-combat.png` });

    // Force-complete the objective, then walk into the boss room.
    await page.evaluate(() => {
      const g = window.game;
      for (const n of g.nodes) n.state = 'done';
      g.objective.done = g.objective.total;
      g._checkObjective();
      if (g.holdout) { g.holdout.time = 0.05; g.holdout.started = true; g.player.pos.copy(g.lift.pos); }
    });
    await play(1.2, { fire: false, move: false, aim: false });

    // Give every chest a spin so the reveal path runs on each floor.
    await page.evaluate(() => {
      const g = window.game;
      for (const c of g.chests) {
        if (c.state === 'closed') { g.player.pos.set(c.pos.x + 1, 0, c.pos.z); g._interactChest(c); break; }
      }
    });
    await play(6, { fire: false, move: false, aim: false });
    await page.evaluate(() => {
      const g = window.game;
      const c = g.chests.find((x) => x.canClaim);
      if (c) g._interactChest(c);
    });

    await page.evaluate(() => {
      const g = window.game;
      g.player.pos.copy(g.level.roomCenter(g.bossRoom));
      g.player.health = g.player.maxHealth;
    });
    await play(0.5, { fire: false, move: false, aim: false });

    const bossName = await page.evaluate(() => window.game.boss?.def.name || null);
    if (bossName) {
      console.log(`  ↳ boss: ${bossName}`);
      // Exercise every attack primitive this boss has, then finish it.
      await page.evaluate(() => {
        const g = window.game;
        const b = g.boss;
        for (let ph = 0; ph < b.def.phases.length; ph++) {
          for (const atk of b.def.phases[ph].attacks) {
            b.action = null;
            b._begin(atk, g._bossCtx(), 12);
            for (let k = 0; k < 40; k++) {
              if (!b.action) break;
              b._runAction(1 / 30, g._bossCtx(), 6, 6, 9);
            }
          }
        }
        b.action = null;
      });
      await play(3, { fire: true, move: false });
      if (SHOTS) await page.screenshot({ path: `tools/shots/f${String(f).padStart(2, '0')}-boss.png` });
      await page.evaluate(() => {
        const g = window.game;
        g.boss.hp = 1;
        const res = g.boss.takeDamage(999999);
        g._onTargetDamaged(g.boss, res, null, null, {});
      });
      await play(1.5, { fire: false, move: false, aim: false });
    } else if (f === 0) {
      console.log('  ↳ B1 holdout (no named boss) — expected');
    } else {
      errors.push(`floor ${f}: no boss spawned`);
    }

    if (f === FLOORS - 1) break;

    // Take the lift up.
    await page.evaluate(() => {
      const g = window.game;
      g.lift.active = true;
      g._useLift();
    });
    await page.waitForFunction(() => document.getElementById('floorCardLoad').textContent.includes('CLICK'), { timeout: 30000 });
    await page.mouse.click(640, 400);
    await page.waitForFunction(() => window.game.state === 'playing', { timeout: 15000 });
  }

  if (quietFloors.length > FLOORS / 2) {
    errors.push(`bot dealt no damage on ${quietFloors.length}/${FLOORS} floors: ${quietFloors.join(', ')}`);
  }
  if (lastDealt <= 0) errors.push('bot dealt no damage over the whole run');

  // --- Victory path ---
  await page.evaluate(() => window.game._victory());
  await page.waitForTimeout(500);
  const vic = await page.evaluate(() => window.game.state);
  console.log('✓ final state:', vic);
  if (SHOTS) await page.screenshot({ path: 'tools/shots/99-victory.png' });

  // --- Synergy matrix: equip every documented pair and confirm it resolves. ---
  const synReport = await page.evaluate(() => {
    const g = window.game;
    const mod = g.constructor;
    return import('/src/combat/synergy.js').then(async (S) => {
      const W = await import('/src/combat/weapons.js');
      const out = [];
      for (const rule of S.SYNERGIES) {
        let a, b;
        if (rule.ids) { a = W.makeWeapon(rule.ids[0]); b = W.makeWeapon(rule.ids[1]); }
        else {
          a = W.makeWeapon(rule.id1);
          const partner = Object.values(W.WEAPONS).find((w) =>
            w.id !== rule.id1 && (rule.tag ? w.tags.includes(rule.tag) : w.id === 'babygun'));
          if (!partner) { out.push(`${rule.id}: no partner`); continue; }
          b = W.makeWeapon(partner.id);
        }
        if (rule.id === 'oldschool') a.params.stage = 5;
        const p = S.evaluatePairing(a, b);
        const hit = p.active.some((r) => r.id === rule.id);
        const ea = S.effective(a, p), eb = S.effective(b, p);
        if (!hit) out.push(`MISS ${rule.id}`);
        if (!isFinite(ea.damage) || !isFinite(eb.damage)) out.push(`NaN ${rule.id}`);
      }
      return out;
    });
  });
  if (synReport.length) errors.push(`synergy issues: ${synReport.join(', ')}`);
  else console.log(`✓ all ${await page.evaluate(() => import('/src/combat/synergy.js').then((m) => m.SYNERGIES.length))} synergy rules resolve`);

} catch (e) {
  errors.push(`[harness] ${e.message}\n${e.stack}`);
} finally {
  if (browser) await browser.close();
  server.kill();
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):\n`);
  for (const e of errors.slice(0, 25)) console.error('  ' + e.split('\n').slice(0, 4).join('\n    ') + '\n');
  process.exit(1);
}
console.log('\n✓ smoke test passed');
