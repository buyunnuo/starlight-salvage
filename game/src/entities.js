// The things that live in the debris field: the player drone, the four enemy kinds,
// salvage cores, power-ups, bullets, particles and floating score text. This file
// creates them and moves them; world.js decides what they mean (hits, scoring,
// waves) and render.js draws them.

import { BULLET, ENEMY, FIELD, PLAYER, POWERUP, SALVAGE } from './config.js';
import { clamp, dist2 } from './random.js';

export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2 + 80,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.hull,
    energy: PLAYER.energyMax,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    hurtTimer: 0,
    trailTimer: 0,
  };
}

/** A salvage core, drifting slowly. */
export function spawnSalvage(world, x, y) {
  world.salvage.push({
    x, y,
    vx: world.rng.range(-14, 14),
    vy: world.rng.range(-14, 14),
    radius: SALVAGE.radius,
    phase: world.rng.range(0, Math.PI * 2),
    age: 0,
  });
}

/** An enemy of the given kind, placed at x,y with wave-scaled speed. */
export function spawnEnemy(world, kind, x, y, wave) {
  const spec = ENEMY[kind];
  const speedMul = 1 + (wave - 1) * 0.045;
  const e = {
    kind, x, y,
    vx: 0, vy: 0,
    hp: spec.hp,
    radius: spec.radius,
    angle: world.rng.range(0, Math.PI * 2),
    spin: world.rng.range(-1.6, 1.6),
    seed: world.rng.next(),
    fireTimer: world.rng.range(1, 2.4),
    pulse: world.rng.range(0, Math.PI * 2),
    age: 0,
  };
  if (kind === 'drifter') {
    const a = world.rng.range(0, Math.PI * 2);
    const s = spec.speed * speedMul * world.rng.range(0.7, 1.2);
    e.vx = Math.cos(a) * s;
    e.vy = Math.sin(a) * s;
  } else if (kind === 'mine') {
    e.vx = world.rng.range(-8, 8);
    e.vy = world.rng.range(-8, 8);
  }
  world.enemies.push(e);
  return e;
}

/** A power-up of a random kind at x,y. */
export function spawnPowerup(world, x, y) {
  world.powerups.push({
    kind: world.rng.pick(['shield', 'magnet', 'overdrive']),
    x, y,
    vx: world.rng.range(-10, 10),
    vy: world.rng.range(-10, 10),
    radius: POWERUP.radius,
    phase: world.rng.range(0, Math.PI * 2),
    age: 0,
  });
}

export function spawnBullet(world, x, y, angle, speed, hostile) {
  world.bullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: hostile ? BULLET.enemyRadius : PLAYER.bulletRadius,
    hostile,
    life: BULLET.life,
  });
}

export function spawnParticles(world, x, y, { count = 12, color = '#ffc94d', speed = 160, life = 0.6, size = 3 }) {
  for (let i = 0; i < count; i++) {
    const a = world.rng.range(0, Math.PI * 2);
    const s = world.rng.range(speed * 0.25, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: world.rng.range(life * 0.5, life),
      maxLife: life,
      size: world.rng.range(size * 0.5, size * 1.5),
      color,
    });
  }
}

export function addText(world, x, y, str, color) {
  world.texts.push({ x, y, str, color, life: 0.9, maxLife: 0.9 });
}

/** Move the player from input; firing and dashing are decided in world.js. */
export function updatePlayer(world, dt, move, aimAngle) {
  const p = world.player;
  p.angle = aimAngle;
  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.vx = p.dashX * PLAYER.dashSpeed;
    p.vy = p.dashY * PLAYER.dashSpeed;
  } else {
    p.vx += move.x * PLAYER.accel * dt;
    p.vy += move.y * PLAYER.accel * dt;
    const damp = Math.pow(PLAYER.damping, dt * 60);
    p.vx *= damp;
    p.vy *= damp;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > PLAYER.maxSpeed) {
      p.vx = (p.vx / sp) * PLAYER.maxSpeed;
      p.vy = (p.vy / sp) * PLAYER.maxSpeed;
    }
  }
  p.x = clamp(p.x + p.vx * dt, p.radius, FIELD.width - p.radius);
  p.y = clamp(p.y + p.vy * dt, p.radius, FIELD.height - p.radius);
  p.fireTimer -= dt;
  p.dashCooldown -= dt;
  p.hurtTimer -= dt;
  p.energy = Math.min(PLAYER.energyMax, p.energy + PLAYER.energyRegen * dt);
  // Engine trail while moving.
  p.trailTimer -= dt;
  if (Math.hypot(p.vx, p.vy) > 60 && p.trailTimer <= 0) {
    p.trailTimer = 0.03;
    world.particles.push({
      x: p.x - Math.cos(p.angle) * 16,
      y: p.y - Math.sin(p.angle) * 16,
      vx: -p.vx * 0.1 + world.rng.range(-12, 12),
      vy: -p.vy * 0.1 + world.rng.range(-12, 12),
      life: 0.35, maxLife: 0.35,
      size: 3, color: '#4fe3ff',
    });
  }
}

export function updateEnemies(world, dt) {
  const p = world.player;
  const wave = world.wave;
  for (const e of world.enemies) {
    e.age += dt;
    e.pulse += dt * 3;
    if (e.kind === 'mine') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    } else if (e.kind === 'drifter') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.angle += e.spin * dt;
      if (e.x < e.radius || e.x > FIELD.width - e.radius) e.vx *= -1;
      if (e.y < e.radius || e.y > FIELD.height - e.radius) e.vy *= -1;
    } else if (e.kind === 'chaser') {
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      const sp = ENEMY.chaser.speed * (1 + (wave - 1) * 0.045);
      const wobble = Math.sin(e.age * 3) * 0.4;
      const a = Math.atan2(p.y - e.y, p.x - e.x) + wobble;
      e.vx += Math.cos(a) * sp * 2.4 * dt;
      e.vy += Math.sin(a) * sp * 2.4 * dt;
      const s = Math.hypot(e.vx, e.vy);
      if (s > sp) { e.vx = (e.vx / s) * sp; e.vy = (e.vy / s) * sp; }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.angle = Math.atan2(e.vy, e.vx);
    } else if (e.kind === 'shooter') {
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      const sp = ENEMY.shooter.speed * (1 + (wave - 1) * 0.045);
      // Keep about 280 away: approach when far, back off when close, strafe.
      const want = d > 320 ? 1 : d < 220 ? -1 : 0;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      const strafe = Math.sin(e.age * 1.4) * 0.7;
      e.vx += (Math.cos(a) * want + Math.cos(a + Math.PI / 2) * strafe) * sp * 2 * dt;
      e.vy += (Math.sin(a) * want + Math.sin(a + Math.PI / 2) * strafe) * sp * 2 * dt;
      const s = Math.hypot(e.vx, e.vy);
      if (s > sp) { e.vx = (e.vx / s) * sp; e.vy = (e.vy / s) * sp; }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.angle = a;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && d < 560) {
        e.fireTimer = Math.max(1.2, ENEMY.shooter.fireInterval - wave * 0.08);
        spawnBullet(world, e.x, e.y, a, ENEMY.shooter.bulletSpeed, true);
        world.audio?.shoot?.();
      }
    }
    e.x = clamp(e.x, e.radius, FIELD.width - e.radius);
    e.y = clamp(e.y, e.radius, FIELD.height - e.radius);
  }
}

export function updateBullets(world, dt) {
  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  world.bullets = world.bullets.filter(
    (b) => b.life > 0 && b.x > -20 && b.x < FIELD.width + 20 && b.y > -20 && b.y < FIELD.height + 20,
  );
}

export function updateSalvage(world, dt) {
  const p = world.player;
  const attractR = world.magnetTimer > 0 ? SALVAGE.magnetRadius : SALVAGE.attractRadius;
  for (const s of world.salvage) {
    s.age += dt;
    s.phase += dt * 2;
    const d2v = dist2(s.x, s.y, p.x, p.y);
    if (d2v < attractR * attractR) {
      const d = Math.sqrt(d2v) || 1;
      const pull = 420 * (1 - d / attractR) + 60;
      s.vx += ((p.x - s.x) / d) * pull * dt;
      s.vy += ((p.y - s.y) / d) * pull * dt;
    } else {
      s.vx *= 0.995;
      s.vy *= 0.995;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.x = clamp(s.x, s.radius, FIELD.width - s.radius);
    s.y = clamp(s.y, s.radius, FIELD.height - s.radius);
  }
}

export function updatePowerups(world, dt) {
  for (const u of world.powerups) {
    u.age += dt;
    u.phase += dt * 2;
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    u.x = clamp(u.x, u.radius, FIELD.width - u.radius);
    u.y = clamp(u.y, u.radius, FIELD.height - u.radius);
  }
}

export function updateParticles(world, dt) {
  for (const pt of world.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.98;
    pt.vy *= 0.98;
    pt.life -= dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);
  for (const t of world.texts) {
    t.y -= 34 * dt;
    t.life -= dt;
  }
  world.texts = world.texts.filter((t) => t.life > 0);
}
