// Staging for screenshots: ?shot=title|play|win|over&seed=N paints one scene of the
// real game, deterministically from the seed, and sets window.__shotReady when the
// frame is painted twice. The scenes are the game's own screens, driven by its own
// update loop with a scripted input — never a mock render.

import { FIELD, STEP } from './config.js';
import { createWorld, startRun, update } from './world.js';
import { spawnSalvage } from './entities.js';
import { startWave } from './waves.js';

/** A scripted player: chases the nearest salvage, aims at the nearest enemy, fires. */
function botInput(world) {
  const p = world.player;
  let target = null;
  let best = Infinity;
  for (const s of world.salvage) {
    const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
    if (d < best) { best = d; target = s; }
  }
  let aim = { x: p.x, y: p.y - 100 };
  let aimBest = Infinity;
  for (const e of world.enemies) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < aimBest) { aimBest = d; aim = e; }
  }
  return {
    move() {
      if (!target) return { x: 0, y: 0 };
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len };
    },
    aim() { return { x: aim.x, y: aim.y }; },
    firing() {
      // Fire in bursts: hold fire while energy is low so the bar recharges.
      return world.enemies.length > 0 && world.player.energy > 40;
    },
    takeActions() { return 0; },
  };
}

/** Run the world forward n fixed steps under the bot. */
function simulate(world, steps) {
  const input = botInput(world);
  for (let i = 0; i < steps; i++) update(world, STEP, input);
}

/** Stage one of the four screenshot scenes on the given world. */
export function stageShot(world, shot, seed) {
  if (shot === 'title') {
    // Title screen over a living field: a few cores drifting, stars twinkling.
    world.time = 3.2;
    for (let i = 0; i < 5; i++) {
      spawnSalvage(world, 200 + i * 180, 420 + (i % 2) * 90);
    }
    return;
  }
  // The other three scenes play a real run first.
  startRun(world);
  if (shot === 'play') {
    // A busy mid-run scene: wave 3, several kinds on the field, the HUD scoring.
    // The bot can die, so retry a shorter run until one stays alive.
    for (let attempt = 0; attempt < 3; attempt++) {
      simulate(world, 60 * 4);
      if (world.screen === 'playing' && world.wave < 3) {
        world.enemies.length = 0;
        world.spawnQueue.length = 0;
        startWave(world, 3);
        simulate(world, 60 * 4);
      }
      if (world.screen === 'playing') break;
      startRun(world);
    }
    world.banner = '';
    world.bannerTimer = 0;
    return;
  }
  if (shot === 'win') {
    simulate(world, 60 * 5);
    world.collected = 41;
    world.kills = 26;
    world.shotsFired = 120;
    world.shotsHit = 86;
    world.timePlayed = 386;
    world.wave = 10;
    world.player.hull = 64;
    // The hull bonus is part of the score, as in a real run: 2712 + 64*2 = 2840.
    world.score = 2712 + Math.round(world.player.hull * 2);
    world.screen = 'victory';
    world.endTimer = 2;
    if (world.score > world.best) world.best = world.score;
    return;
  }
  if (shot === 'over') {
    simulate(world, 60 * 6);
    world.score = 930;
    world.collected = 14;
    world.kills = 9;
    world.timePlayed = 148;
    world.wave = 4;
    world.player.hull = 0;
    world.screen = 'gameover';
    world.endTimer = 2;
    if (world.score > world.best) world.best = world.score;
    return;
  }
}
