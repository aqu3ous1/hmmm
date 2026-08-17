// Side contracts.
//
// The climb has exactly one shape: do the floor's thing, kill the floor's
// boss, take the lift. That is a spine, and a spine on its own is a corridor.
// Contracts are the optional load: one is posted on every floor, you accept it
// or you don't, and taking one changes how you play the next twenty minutes
// rather than just adding a number to a total.
//
// Every contract is:
//   - phrased as something the Pod's facilities department would actually post
//   - checkable from state the game already tracks (no new bookkeeping)
//   - failable, so accepting one is a decision instead of free money
//
// The reward is deliberately not "more damage". You get shards, a rerolled
// hand, medical capacity or a straight refill — things that change what you
// can afford to do, not things that change what your gun does.

const S = (n) => `${n} shards`;

/**
 * A contract definition.
 *
 * `start(g)`  snapshot whatever the goal is measured against
 * `check(g)`  → true when done
 * `failed(g)` → true when it can no longer be completed (optional)
 * `progress(g)` → "3/12" for the HUD (optional)
 */
export const CONTRACTS = [
  {
    id: 'nohit',
    title: 'CLEAN SHEET',
    posted: 'Facilities notes that damage to the patient is technically damage to the equipment.',
    goal: 'Reach the boss room without taking a hit',
    reward: { shards: 220, label: S(220) },
    start(g) { return { hp: g.player.health, hits: g.player.stats.timesHit || 0 }; },
    check(g, st) { return g.objectiveDone && (g.player.stats.timesHit || 0) <= st.hits; },
    failed(g, st) { return (g.player.stats.timesHit || 0) > st.hits; },
    progress(g, st) { return (g.player.stats.timesHit || 0) > st.hits ? 'FAILED' : 'CLEAN'; },
  },
  {
    id: 'archivist',
    title: 'ARCHIVIST',
    posted: 'Records requests that recovered logs be read rather than walked past.',
    goal: 'Read every terminal on this floor',
    reward: { shards: 160, heal: 40, label: `${S(160)} · a patch` },
    start(g) { return { total: g.secrets.filter((s) => s.kind === 'lore').length }; },
    check(g, st) {
      const read = g.secrets.filter((s) => s.kind === 'lore' && s.used).length;
      return st.total > 0 && read >= st.total;
    },
    progress(g, st) {
      const read = g.secrets.filter((s) => s.kind === 'lore' && s.used).length;
      return `${read}/${st.total}`;
    },
  },
  {
    id: 'locksmith',
    title: 'LOCKSMITH',
    posted: 'A cache on this floor is logged as sealed. Its key is logged as "somewhere".',
    goal: 'Find the key and open the cache',
    reward: { shards: 200, reroll: true, label: `${S(200)} · a reroll` },
    start() { return {}; },
    check(g) { return g.secrets.some((s) => s.kind === 'cache' && s.opened); },
  },
  {
    id: 'thrifty',
    title: 'THRIFT',
    posted: 'The Vend-o-Tron network would like a quiet shift, for once.',
    goal: 'Clear the floor without buying anything',
    reward: { shards: 260, label: S(260) },
    start(g) { return { spent: g.player.stats.shardsSpent || 0 }; },
    check(g, st) { return g.objectiveDone && (g.player.stats.shardsSpent || 0) <= st.spent; },
    failed(g, st) { return (g.player.stats.shardsSpent || 0) > st.spent; },
    progress(g, st) { return (g.player.stats.shardsSpent || 0) > st.spent ? 'FAILED' : 'HELD'; },
  },
  {
    id: 'headhunter',
    title: 'HEADHUNTER',
    posted: 'Ammunition budget is over. Accuracy is, apparently, free.',
    goal: 'Land 15 headshots on this floor',
    reward: { shards: 180, maxHealth: 10, label: `${S(180)} · +10 max health` },
    start(g) { return { hs: g.player.stats.headshots || 0 }; },
    check(g, st) { return (g.player.stats.headshots || 0) - st.hs >= 15; },
    progress(g, st) { return `${Math.min(15, (g.player.stats.headshots || 0) - st.hs)}/15`; },
  },
  {
    id: 'curator',
    title: 'CURATOR',
    posted: 'An item on this floor is not on any manifest. Records would like it looked at.',
    goal: 'Find the curiosity hidden on this floor',
    reward: { shards: 150, heal: 60, label: `${S(150)} · a full patch` },
    start() { return {}; },
    check(g) { return g.secrets.some((s) => s.kind === 'egg' && s.found); },
  },
  {
    id: 'ironhand',
    title: 'IRON HAND',
    posted: 'The Pod issues fists to everyone. Facilities notes they are under-used.',
    goal: 'Kill 8 things with a melee weapon',
    reward: { shards: 210, label: S(210) },
    start(g) { return { k: g.player.stats.meleeKills || 0 }; },
    check(g, st) { return (g.player.stats.meleeKills || 0) - st.k >= 8; },
    progress(g, st) { return `${Math.min(8, (g.player.stats.meleeKills || 0) - st.k)}/8`; },
  },
  {
    id: 'pacing',
    title: 'BRISK',
    posted: 'Your session is running long. This is not a complaint. It is an observation.',
    goal: 'Finish the objective within six minutes of arriving',
    reward: { shards: 240, label: S(240) },
    start(g) { return { t: g.floorTime }; },
    check(g, st) { return g.objectiveDone && g.floorTime - st.t <= 360; },
    failed(g, st) { return !g.objectiveDone && g.floorTime - st.t > 360; },
    progress(g, st) {
      const left = 360 - (g.floorTime - st.t);
      return left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'FAILED';
    },
  },
];

/** Deterministic pick for a floor, so a seed always posts the same board. */
export function contractFor(floorIndex, rng) {
  // The basement is the tutorial; it posts nothing.
  if (floorIndex === 0) return null;
  const pool = CONTRACTS.filter((c) => !(floorIndex < 3 && (c.id === 'ironhand' || c.id === 'headhunter')));
  return pool[rng.int(0, pool.length - 1)];
}
