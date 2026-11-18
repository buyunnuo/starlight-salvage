// The wave director: each wave is a queue of enemies trickled in from the field
// edges, plus a few salvage cores to start it. Wave 1 is gentle; by wave 10 the
// field is full of chasers, drifters, shooters and mines.

import { FIELD, WAVE } from './config.js';
import { spawnEnemy, spawnSalvage } from './entities.js';

/** Build the spawn queue for wave n: a shuffled list of kinds. */
export function buildQueue(world, n) {
  const count = WAVE.count(n);
  const table = WAVE.table(n);
  const queue = [];
  for (let i = 0; i < count; i++) queue.push(world.rng.weighted(table));
  // Shuffle so kinds do not arrive in clumps.
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(world.rng.next() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

/** A spawn point on a field edge, away from the player. */
function spawnPoint(world) {
  const p = world.player;
  for (let tries = 0; tries < 8; tries++) {
    const side = world.rng.int(0, 3);
    let x;
    let y;
    if (side === 0) { x = world.rng.range(40, FIELD.width - 40); y = 40; }
    else if (side === 1) { x = world.rng.range(40, FIELD.width - 40); y = FIELD.height - 40; }
    else if (side === 2) { x = 40; y = world.rng.range(40, FIELD.height - 40); }
    else { x = FIELD.width - 40; y = world.rng.range(40, FIELD.height - 40); }
    if (Math.hypot(x - p.x, p.y - y) > 260) return { x, y };
  }
  return { x: 60, y: 60 };
}

/** Start wave n: fresh queue, a trickle timer, and opening salvage. */
export function startWave(world, n) {
  world.wave = n;
  world.waveState = 'active';
  world.spawnQueue = buildQueue(world, n);
  world.spawnTimer = 0.6;
  world.banner = `WAVE ${n}`;
  world.bannerTimer = 2.2;
  for (let i = 0; i < 4; i++) {
    spawnSalvage(world, world.rng.range(120, FIELD.width - 120), world.rng.range(120, FIELD.height - 120));
  }
}

/** Trickle the queue; returns true while the wave still has anything left to do. */
export function updateDirector(world, dt) {
  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = WAVE.interval(world.wave);
      const kind = world.spawnQueue.shift();
      const { x, y } = spawnPoint(world);
      spawnEnemy(world, kind, x, y, world.wave);
    }
  }
  return world.spawnQueue.length > 0 || world.enemies.length > 0;
}
