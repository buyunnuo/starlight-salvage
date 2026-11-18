// The game itself: state, the fixed-step update, collisions, scoring, waves and
// the win/lose flow. Screens: title, playing, paused, victory, gameover.
// Rendering lives in render.js; entities.js moves things; waves.js directs spawns.

import { BULLET, ENEMY, FIELD, PLAYER, POWERUP, SALVAGE, WAVES } from './config.js';
import { createRandom, dist2 } from './random.js';
import {
  addText, createPlayer, spawnBullet, spawnParticles, spawnPowerup, spawnSalvage,
  updateBullets, updateEnemies, updateParticles, updatePlayer, updatePowerups, updateSalvage,
} from './entities.js';
import { startWave, updateDirector } from './waves.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE } from './input.js';

export function createWorld(seed, audio, best) {
  const rng = createRandom(seed);
  const stars = [];
  for (let layer = 0; layer < 3; layer++) {
    const count = [90, 60, 36][layer];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rng.range(0, FIELD.width),
        y: rng.range(0, FIELD.height),
        r: rng.range(0.6, 1.4 + layer * 0.5),
        phase: rng.range(0, Math.PI * 2),
        layer,
      });
    }
  }
  return {
    rng,
    audio,
    best,
    screen: 'title',
    time: 0,
    timePlayed: 0,
    wave: 0,
    spawnQueue: [],
    spawnTimer: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    kills: 0,
    collected: 0,
    shotsFired: 0,
    shotsHit: 0,
    shake: 0,
    flash: 0,
    banner: '',
    bannerTimer: 0,
    shieldTimer: 0,
    magnetTimer: 0,
    overdriveTimer: 0,
    salvageTimer: 2.5,
    clearTimer: 0,
    endTimer: 0, // grace after victory/game over before restart accepts input
    player: createPlayer(),
    bullets: [],
    enemies: [],
    salvage: [],
    powerups: [],
    particles: [],
    texts: [],
    stars,
  };
}

/** Begin a fresh run from the title screen. */
export function startRun(world) {
  const best = world.best;
  const fresh = createWorld(Math.floor(Math.random() * 4294967296), world.audio, best);
  Object.assign(world, fresh);
  world.screen = 'playing';
  world.audio?.unlock?.();
  world.audio?.startMusic?.();
  startWave(world, 1);
}

/** Fire one plasma bolt toward the aim point, if the energy allows. */
function tryFire(world, aim) {
  const p = world.player;
  if (p.fireTimer > 0) return;
  const overdrive = world.overdriveTimer > 0;
  const cost = overdrive ? 0 : PLAYER.fireCost;
  if (p.energy < cost) return;
  const angle = Math.atan2(aim.y - p.y, aim.x - p.x);
  spawnBullet(world, p.x + Math.cos(angle) * 20, p.y + Math.sin(angle) * 20, angle, PLAYER.bulletSpeed, false);
  p.energy -= cost;
  p.fireTimer = overdrive ? 0.08 : PLAYER.fireInterval;
  world.shotsFired++;
  world.audio?.shoot?.();
}

/** Dash toward the aim point: a burst of speed and brief invulnerability. */
function tryDash(world, aim) {
  const p = world.player;
  if (p.dashCooldown > 0 || p.dashTimer > 0) return;
  let dx = aim.x - p.x;
  let dy = aim.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len < 4) { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
  else { dx /= len; dy /= len; }
  p.dashX = dx;
  p.dashY = dy;
  p.dashTimer = PLAYER.dashTime;
  p.dashCooldown = PLAYER.dashCooldown;
  world.audio?.dash?.();
  spawnParticles(world, p.x, p.y, { count: 10, color: '#4fe3ff', speed: 200, life: 0.4, size: 3 });
}

/** Hurt the player unless invulnerable or shielded. */
function damagePlayer(world, amount) {
  if (world.screen !== 'playing') return;
  const p = world.player;
  if (p.hurtTimer > 0 || p.dashTimer > 0) return;
  if (world.shieldTimer > 0) {
    world.shieldTimer = 0;
    p.hurtTimer = 0.6;
    world.audio?.powerup?.();
    addText(world, p.x, p.y - 30, 'SHIELD DOWN', '#7dffd4');
    spawnParticles(world, p.x, p.y, { count: 16, color: '#7dffd4', speed: 220, life: 0.5, size: 3 });
    return;
  }
  p.hull -= amount;
  p.hurtTimer = PLAYER.hurtInvuln;
  world.combo = 1;
  world.comboTimer = 0;
  world.flash = 1;
  world.shake = 12;
  world.audio?.hit?.();
  spawnParticles(world, p.x, p.y, { count: 18, color: '#ff5470', speed: 260, life: 0.6, size: 4 });
  if (p.hull <= 0) {
    p.hull = 0;
    world.audio?.stopMusic?.();
    world.audio?.explosion?.();
    world.audio?.gameOver?.();
    spawnParticles(world, p.x, p.y, { count: 60, color: '#4fe3ff', speed: 380, life: 1.1, size: 4 });
    spawnParticles(world, p.x, p.y, { count: 40, color: '#ffc94d', speed: 300, life: 0.9, size: 3 });
    world.shake = 20;
    world.screen = 'gameover';
    world.endTimer = 0;
    if (world.score > world.best) world.best = world.score;
  }
}

/** A mine goes off: hurts the player nearby and chains into other enemies. */
function explodeMine(world, mine) {
  const R = ENEMY.mine.blastRadius;
  world.audio?.explosion?.();
  world.shake = Math.max(world.shake, 10);
  spawnParticles(world, mine.x, mine.y, { count: 34, color: '#ff5470', speed: 340, life: 0.8, size: 4 });
  spawnParticles(world, mine.x, mine.y, { count: 18, color: '#ffc94d', speed: 220, life: 0.6, size: 3 });
  const p = world.player;
  const pd = Math.hypot(p.x - mine.x, p.y - mine.y);
  if (pd < R + p.radius) damagePlayer(world, ENEMY.mine.damage);
  // Chain: other enemies caught in the blast take heavy damage.
  const caught = [];
  for (const e of world.enemies) {
    if (e === mine) continue;
    if (Math.hypot(e.x - mine.x, e.y - mine.y) < R + e.radius) caught.push(e);
  }
  for (const e of caught) hurtEnemy(world, e, 3);
}

function hurtEnemy(world, enemy, damage) {
  enemy.hp -= damage;
  if (enemy.hp > 0) return;
  const idx = world.enemies.indexOf(enemy);
  if (idx === -1) return;
  world.enemies.splice(idx, 1);
  world.kills++;
  const spec = ENEMY[enemy.kind];
  world.score += spec.points;
  addText(world, enemy.x, enemy.y - 18, `+${spec.points}`, '#eef3ff');
  spawnParticles(world, enemy.x, enemy.y, {
    count: 18,
    color: enemy.kind === 'mine' ? '#ff5470' : enemy.kind === 'chaser' ? '#c07bff' : enemy.kind === 'shooter' ? '#ff9d5c' : '#9aa7bd',
    speed: 240, life: 0.7, size: 4,
  });
  if (enemy.kind === 'mine') {
    explodeMine(world, enemy);
  } else {
    world.audio?.explosion?.();
  }
  // Drops: usually a salvage core, sometimes a power-up.
  const roll = world.rng.next();
  if (roll < POWERUP.dropChance) {
    spawnPowerup(world, enemy.x, enemy.y);
  } else if (roll < POWERUP.dropChance + 0.35) {
    spawnSalvage(world, enemy.x, enemy.y);
  }
}

function collectSalvage(world, s) {
  const idx = world.salvage.indexOf(s);
  if (idx === -1) return;
  world.salvage.splice(idx, 1);
  if (world.comboTimer > 0) world.combo = Math.min(world.combo + 1, SALVAGE.comboMax);
  else world.combo = 1;
  world.comboTimer = SALVAGE.comboWindow;
  const points = SALVAGE.points * world.combo;
  world.score += points;
  world.collected++;
  addText(world, s.x, s.y - 14, `+${points}`, '#ffc94d');
  spawnParticles(world, s.x, s.y, { count: 10, color: '#ffc94d', speed: 140, life: 0.45, size: 3 });
  world.audio?.pickup?.(world.combo);
}

function collectPowerup(world, u) {
  const idx = world.powerups.indexOf(u);
  if (idx === -1) return;
  world.powerups.splice(idx, 1);
  if (u.kind === 'shield') {
    world.shieldTimer = POWERUP.shieldSeconds;
    addText(world, u.x, u.y - 14, 'SHIELD UP', '#7dffd4');
  } else if (u.kind === 'magnet') {
    world.magnetTimer = POWERUP.magnetSeconds;
    addText(world, u.x, u.y - 14, 'MAGNET', '#ff8ad8');
  } else {
    world.overdriveTimer = POWERUP.overdriveSeconds;
    addText(world, u.x, u.y - 14, 'OVERDRIVE', '#ffe14d');
  }
  world.audio?.powerup?.();
  spawnParticles(world, u.x, u.y, { count: 14, color: '#7dffd4', speed: 180, life: 0.5, size: 3 });
}

/** Circle collision tests for one fixed step of play. */
function collide(world) {
  const p = world.player;
  // Player bullets vs enemies.
  for (const b of [...world.bullets]) {
    if (b.hostile) continue;
    for (const e of [...world.enemies]) {
      if (dist2(b.x, b.y, e.x, e.y) < (b.radius + e.radius) * (b.radius + e.radius)) {
        world.bullets.splice(world.bullets.indexOf(b), 1);
        world.shotsHit++;
        spawnParticles(world, b.x, b.y, { count: 6, color: '#8ef1ff', speed: 140, life: 0.3, size: 2 });
        hurtEnemy(world, e, 1);
        break;
      }
    }
  }
  // Enemy bullets vs the player.
  for (const b of [...world.bullets]) {
    if (!b.hostile) continue;
    if (dist2(b.x, b.y, p.x, p.y) < (b.radius + p.radius) * (b.radius + p.radius)) {
      world.bullets.splice(world.bullets.indexOf(b), 1);
      damagePlayer(world, BULLET.enemyDamage);
    }
  }
  // Enemies vs the player.
  for (const e of [...world.enemies]) {
    if (dist2(e.x, e.y, p.x, p.y) < (e.radius + p.radius) * (e.radius + p.radius)) {
      if (e.kind === 'mine') {
        world.enemies.splice(world.enemies.indexOf(e), 1);
        explodeMine(world, e);
      } else {
        damagePlayer(world, ENEMY[e.kind].damage);
        // Knock the enemy back so one touch is not a grind.
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        e.x += Math.cos(a) * 26;
        e.y += Math.sin(a) * 26;
        e.vx = Math.cos(a) * 140;
        e.vy = Math.sin(a) * 140;
      }
    }
  }
  // Salvage vs the player.
  for (const s of [...world.salvage]) {
    const r = SALVAGE.collectRadius + s.radius;
    if (dist2(s.x, s.y, p.x, p.y) < r * r) collectSalvage(world, s);
  }
  // Power-ups vs the player.
  for (const u of [...world.powerups]) {
    const r = u.radius + p.radius + 6;
    if (dist2(u.x, u.y, p.x, p.y) < r * r) collectPowerup(world, u);
  }
}

/** One fixed step of play. */
function stepPlay(world, dt, input) {
  world.time += dt;
  world.timePlayed += dt;
  const p = world.player;
  const actions = input.takeActions();
  const aim = input.aim();
  const aimAngle = Math.atan2(aim.y - p.y, aim.x - p.x);
  if (actions & ACTION_PAUSE) {
    world.screen = 'paused';
    world.audio?.stopMusic?.();
    return;
  }
  if (actions & ACTION_DASH) tryDash(world, aim);
  if (input.firing()) tryFire(world, aim);

  updatePlayer(world, dt, input.move(), aimAngle);
  updateEnemies(world, dt);
  updateBullets(world, dt);
  updateSalvage(world, dt);
  updatePowerups(world, dt);
  updateParticles(world, dt);

  world.comboTimer -= dt;
  if (world.comboTimer <= 0) world.combo = 1;
  world.shieldTimer -= dt;
  world.magnetTimer -= dt;
  world.overdriveTimer -= dt;
  world.bannerTimer -= dt;
  world.shake = Math.max(0, world.shake - dt * 30);
  world.flash = Math.max(0, world.flash - dt * 2.2);

  // Salvage keeps trickling in so the field never runs dry.
  world.salvageTimer -= dt;
  if (world.salvageTimer <= 0) {
    world.salvageTimer = 2.5;
    if (world.salvage.length < 12) {
      spawnSalvage(world, world.rng.range(80, FIELD.width - 80), world.rng.range(80, FIELD.height - 80));
    }
  }

  collide(world);
  if (world.screen !== 'playing') return; // died this step

  // Wave flow: trickle spawns, then wait for the field to clear. Only the active
  // wave can clear; the banner pause between waves must not re-award the bonus.
  const busy = updateDirector(world, dt);
  if (world.waveState === 'active' && !busy) {
    if (world.wave >= WAVES) {
      // Hull left over is a bonus: surviving clean pays.
      world.score += Math.round(world.player.hull * 2);
      world.screen = 'victory';
      world.endTimer = 0;
      world.audio?.stopMusic?.();
      world.audio?.victory?.();
      if (world.score > world.best) world.best = world.score;
      return;
    }
    const bonus = 100 * world.wave;
    world.score += bonus;
    world.banner = `WAVE ${world.wave} CLEAR  +${bonus}`;
    world.bannerTimer = 2.4;
    world.audio?.waveClear?.();
    world.clearTimer = 2.4;
    world.waveState = 'clear';
    // Pause spawning while the banner shows; the next wave starts below.
    world.spawnQueue = [];
  }
  if (world.waveState === 'clear') {
    world.clearTimer -= dt;
    if (world.clearTimer <= 0) startWave(world, world.wave + 1);
  }
}

/** Advance the world one fixed step, given the frame's input. */
export function update(world, dt, input) {
  if (world.screen === 'title') {
    const actions = input.takeActions();
    world.time += dt;
    updateParticles(world, dt);
    // A few cores drift behind the title for life.
    world.salvageTimer -= dt;
    if (world.salvageTimer <= 0 && world.salvage.length < 6) {
      world.salvageTimer = 1.2;
      spawnSalvage(world, world.rng.range(80, FIELD.width - 80), world.rng.range(80, FIELD.height - 80));
    }
    updateSalvage(world, dt);
    if (actions & ACTION_CONFIRM) {
      world.audio?.unlock?.();
      world.audio?.click?.();
      startRun(world);
    }
    return;
  }
  if (world.screen === 'playing') {
    stepPlay(world, dt, input);
    return;
  }
  if (world.screen === 'paused') {
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) {
      world.screen = 'playing';
      world.audio?.startMusic?.();
    }
    return;
  }
  if (world.screen === 'victory' || world.screen === 'gameover') {
    const actions = input.takeActions();
    world.time += dt;
    world.endTimer += dt;
    updateParticles(world, dt);
    // A click held from the killing blow must not instantly restart the run.
    if (world.endTimer > 0.8 && (actions & ACTION_CONFIRM)) {
      world.audio?.click?.();
      startRun(world);
    }
    return;
  }
}

/** Enemies still to deal with in this wave, for the HUD. */
export function enemiesLeft(world) {
  return world.spawnQueue.length + world.enemies.length;
}
