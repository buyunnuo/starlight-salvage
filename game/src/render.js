// Everything the player sees: the starfield and nebula, the field's entities, the
// HUD, and the title / pause / victory / game-over screens. The canvas is a fixed
// 1280x720 logical field scaled to the window with letterboxing; main tells input
// the same transform so the mouse aims true.

import { FIELD, FONT, PALETTE, PLAYER, SALVAGE, WAVES } from './config.js';
import { enemiesLeft } from './world.js';

/** A pre-rendered radial glow sprite, drawn with drawImage (fast, no shadowBlur). */
function makeGlow(color, size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dpr = 1;

  // Glow sprites, one per colour that glows.
  const glow = {
    salvage: makeGlow(PALETTE.salvage, 96),
    mine: makeGlow(PALETTE.mine, 128),
    player: makeGlow(PALETTE.player, 96),
    bullet: makeGlow(PALETTE.bullet, 48),
    enemyBullet: makeGlow(PALETTE.enemyBullet, 48),
    chaser: makeGlow(PALETTE.chaser, 96),
    shooter: makeGlow(PALETTE.shooter, 96),
    shield: makeGlow(PALETTE.shield, 96),
    magnet: makeGlow(PALETTE.magnet, 96),
    overdrive: makeGlow(PALETTE.overdrive, 96),
    white: makeGlow('#ffffff', 96),
  };

  // The nebula is painted once onto an offscreen canvas.
  const nebula = document.createElement('canvas');
  nebula.width = FIELD.width;
  nebula.height = FIELD.height;
  {
    const g = nebula.getContext('2d');
    g.fillStyle = PALETTE.backdrop;
    g.fillRect(0, 0, FIELD.width, FIELD.height);
    const blobs = [
      [300, 180, 420, PALETTE.nebulaA],
      [1020, 520, 460, PALETTE.nebulaB],
      [980, 120, 300, PALETTE.nebulaC],
      [180, 560, 320, PALETTE.nebulaB],
    ];
    for (const [x, y, r, color] of blobs) {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.55;
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scale = Math.min(w / FIELD.width, h / FIELD.height);
    offsetX = (w - FIELD.width * scale) / 2;
    offsetY = (h - FIELD.height * scale) / 2;
  }

  function begin() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  }

  function drawBackground(world) {
    ctx.drawImage(nebula, 0, 0);
    for (const s of world.stars) {
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(world.time * (0.6 + s.layer * 0.4) + s.phase));
      ctx.globalAlpha = tw * (0.5 + s.layer * 0.2);
      ctx.fillStyle = PALETTE.star;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGlow(sprite, x, y, size, alpha = 0.8) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  function drawPlayer(world) {
    // The drone is gone on the game-over screen: it blew up.
    if (world.screen === 'gameover') return;
    const p = world.player;
    const blink = p.hurtTimer > 0 && Math.floor(world.time * 16) % 2 === 0;
    if (blink) return; // hurt flicker
    drawGlow(glow.player, p.x, p.y, 72, 0.55);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // Hull: a sleek dart.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -11);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Shield ring while it lasts.
    if (world.shieldTimer > 0) {
      ctx.strokeStyle = PALETTE.shield;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(world.time * 6);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Dash cooldown ring while it recharges.
    if (p.dashCooldown > 0 && p.dashTimer <= 0) {
      const frac = 1 - p.dashCooldown / PLAYER.dashCooldown;
      ctx.strokeStyle = 'rgba(79,227,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 21, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnemy(world, e) {
    if (e.kind === 'mine') {
      const pulse = 1 + 0.18 * Math.sin(e.pulse);
      drawGlow(glow.mine, e.x, e.y, 84 * pulse, 0.6);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = PALETTE.mine;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + e.angle * 0.2;
        const r = i % 2 === 0 ? e.radius + 7 : e.radius - 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd7de';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (e.kind === 'drifter') {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = PALETTE.drifter;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const r = e.radius * (0.72 + 0.28 * Math.sin(i * 2.7 + e.seed * 9));
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(-e.radius * 0.3, -e.radius * 0.3, e.radius * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (e.kind === 'chaser') {
      drawGlow(glow.chaser, e.x, e.y, 64, 0.5);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = PALETTE.chaser;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(5, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (e.kind === 'shooter') {
      drawGlow(glow.shooter, e.x, e.y, 64, 0.5);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = PALETTE.shooter;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * e.radius;
        const y = Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a1503';
      ctx.fillRect(4, -3, 14, 6);
      ctx.fillStyle = '#ffe9d6';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Health pips for tough enemies.
    if (e.hp > 1 && e.kind !== 'mine') {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < e.hp; i++) {
        ctx.beginPath();
        ctx.arc(e.x - (e.hp - 1) * 5 + i * 10, e.y - e.radius - 10, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawSalvage(world, s) {
    const pulse = 1 + 0.15 * Math.sin(s.phase);
    drawGlow(glow.salvage, s.x, s.y, 56 * pulse, 0.7);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.phase * 0.5);
    ctx.fillStyle = PALETTE.salvage;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.salvageCore;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPowerup(world, u) {
    const color = u.kind === 'shield' ? PALETTE.shield : u.kind === 'magnet' ? PALETTE.magnet : PALETTE.overdrive;
    const sprite = u.kind === 'shield' ? glow.shield : u.kind === 'magnet' ? glow.magnet : glow.overdrive;
    drawGlow(sprite, u.x, u.y, 64, 0.7);
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.fillStyle = '#0a0f22';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, u.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.kind === 'shield' ? 'S' : u.kind === 'magnet' ? 'M' : 'O', 0, 1);
    ctx.restore();
  }

  function drawField(world) {
    for (const s of world.salvage) drawSalvage(world, s);
    for (const u of world.powerups) drawPowerup(world, u);
    for (const e of world.enemies) drawEnemy(world, e);
    for (const b of world.bullets) {
      const sprite = b.hostile ? glow.enemyBullet : glow.bullet;
      drawGlow(sprite, b.x, b.y, b.hostile ? 30 : 26, 0.8);
      ctx.fillStyle = b.hostile ? PALETTE.enemyBullet : PALETTE.bullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawPlayer(world);
    for (const t of world.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.color;
      ctx.font = `bold 17px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function bar(x, y, w, h, frac, color, back = 'rgba(255,255,255,0.14)') {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  }

  function drawHud(world) {
    const p = world.player;
    ctx.textBaseline = 'alphabetic';
    // Top-left: hull + power-up chips. The panel is near-opaque so the field
    // never shows through the numbers.
    ctx.fillStyle = 'rgba(10,15,34,0.92)';
    ctx.fillRect(18, 16, 250, 64);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(18, 16, 250, 64);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('HULL', 30, 38);
    const hullColor = p.hull > 50 ? '#7dff8a' : p.hull > 25 ? PALETTE.gold : PALETTE.danger;
    bar(88, 26, 164, 14, p.hull / PLAYER.hull, hullColor);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`${Math.ceil(p.hull)}`, 88, 58);
    let chipX = 128;
    if (world.shieldTimer > 0) {
      ctx.fillStyle = PALETTE.shield;
      ctx.fillText(`SHIELD ${Math.ceil(world.shieldTimer)}s`, chipX, 58);
      chipX += 96;
    }
    if (world.magnetTimer > 0) {
      ctx.fillStyle = PALETTE.magnet;
      ctx.fillText(`MAGNET ${Math.ceil(world.magnetTimer)}s`, chipX, 58);
      chipX += 96;
    }
    if (world.overdriveTimer > 0) {
      ctx.fillStyle = PALETTE.overdrive;
      ctx.fillText(`OVERDRIVE ${Math.ceil(world.overdriveTimer)}s`, chipX, 58);
    }
    // Top-centre: wave and hostiles left.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(`WAVE ${world.wave} / ${WAVES}`, FIELD.width / 2, 38);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `14px ${FONT}`;
    ctx.fillText(`${enemiesLeft(world)} hostiles left`, FIELD.width / 2, 60);
    // Top-right: score, combo, best.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText(`${world.score}`, FIELD.width - 20, 42);
    ctx.fillStyle = world.combo > 1 ? PALETTE.gold : PALETTE.muted;
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(world.combo > 1 ? `COMBO x${world.combo}` : 'COMBO x1', FIELD.width - 20, 66);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`BEST ${world.best}`, FIELD.width - 20, 86);
    // Bottom-centre: energy and dash.
    const bw = 260;
    const bx = (FIELD.width - bw) / 2;
    const by = FIELD.height - 30;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText('ENERGY', FIELD.width / 2, by - 6);
    bar(bx, by, bw, 9, p.energy / PLAYER.energyMax, p.energy >= PLAYER.fireCost ? PALETTE.player : PALETTE.danger);
    ctx.fillStyle = p.dashCooldown <= 0 ? PALETTE.player : PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(p.dashCooldown <= 0 ? 'DASH READY  [SHIFT / RIGHT-CLICK]' : 'DASH RECHARGING', FIELD.width / 2, by + 26);
    // Wave banner.
    if (world.bannerTimer > 0 && world.banner) {
      ctx.globalAlpha = Math.min(1, world.bannerTimer);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 44px ${FONT}`;
      ctx.fillText(world.banner, FIELD.width / 2, 190);
      ctx.globalAlpha = 1;
    }
    // Low-hull warning.
    if (p.hull > 0 && p.hull <= 30) {
      const a = 0.10 + 0.08 * Math.sin(world.time * 6);
      ctx.fillStyle = `rgba(255,84,112,${a})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10,15,34,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }

  function drawTitle(world) {
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 68px ${FONT}`;
    ctx.fillText('STARLIGHT', FIELD.width / 2, 218);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('SALVAGE', FIELD.width / 2, 292);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `19px ${FONT}`;
    ctx.fillText('Pilot the salvage drone. Collect the cores. Dodge the mines.', FIELD.width / 2, 336);
    ctx.fillText('Clear all 10 waves to win the field.', FIELD.width / 2, 364);
    panel(FIELD.width / 2 - 300, 396, 600, 132);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `16px ${FONT}`;
    ctx.fillText('MOVE  —  WASD or Arrow keys', FIELD.width / 2, 428);
    ctx.fillText('FIRE  —  Mouse aim + Click or Space  (costs energy)', FIELD.width / 2, 456);
    ctx.fillText('DASH  —  Shift or Right-click  (brief shield while dashing)', FIELD.width / 2, 484);
    ctx.fillText('PAUSE  —  P     MUTE  —  M', FIELD.width / 2, 512);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(world.best > 0 ? `BEST SCORE  ${world.best}` : 'NO RUNS YET — FLY YOUR FIRST', FIELD.width / 2, 566);
    const blink = 0.65 + 0.35 * Math.sin(world.time * 4);
    ctx.globalAlpha = blink;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('PRESS ENTER OR CLICK TO LAUNCH', FIELD.width / 2, 616);
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(7,10,24,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 52px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 330);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `18px ${FONT}`;
    ctx.fillText('Press P or Enter to keep flying', FIELD.width / 2, 380);
  }

  function fmtTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function drawVictory(world) {
    ctx.fillStyle = 'rgba(7,10,24,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 58px ${FONT}`;
    ctx.fillText('FIELD CLEARED!', FIELD.width / 2, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    ctx.fillText('All 10 waves survived. The salvage is yours.', FIELD.width / 2, 252);
    panel(FIELD.width / 2 - 260, 290, 520, 190);
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`SCORE  ${world.score}`, FIELD.width / 2, 336);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `18px ${FONT}`;
    ctx.fillText(`Time  ${fmtTime(world.timePlayed)}      Cores  ${world.collected}      Kills  ${world.kills}`, FIELD.width / 2, 376);
    const acc = world.shotsFired > 0 ? Math.round((world.shotsHit / world.shotsFired) * 100) : 0;
    ctx.fillText(`Accuracy  ${acc}%      Best  ${world.best}`, FIELD.width / 2, 408);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText('HULL BONUS  +' + Math.round(world.player.hull * 2), FIELD.width / 2, 448);
    const blink = 0.65 + 0.35 * Math.sin(world.time * 4);
    ctx.globalAlpha = blink;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('PRESS ENTER TO FLY AGAIN', FIELD.width / 2, 540);
    ctx.globalAlpha = 1;
  }

  function drawGameOver(world) {
    ctx.fillStyle = 'rgba(20,6,12,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `bold 58px ${FONT}`;
    ctx.fillText('DRONE LOST', FIELD.width / 2, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    ctx.fillText(`The field claimed you on wave ${world.wave}.`, FIELD.width / 2, 252);
    panel(FIELD.width / 2 - 260, 290, 520, 150);
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`SCORE  ${world.score}`, FIELD.width / 2, 336);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `18px ${FONT}`;
    ctx.fillText(`Cores  ${world.collected}      Kills  ${world.kills}      Best  ${world.best}`, FIELD.width / 2, 376);
    const blink = 0.65 + 0.35 * Math.sin(world.time * 4);
    ctx.globalAlpha = blink;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('PRESS ENTER TO FLY AGAIN', FIELD.width / 2, 500);
    ctx.globalAlpha = 1;
  }

  return {
    resize,
    /** The current CSS-pixel scale and offsets, for input's mouse mapping. */
    transform() { return { scale, offsetX, offsetY }; },
    render(world) {
      resize();
      begin();
      const shx = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
      const shy = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
      ctx.save();
      ctx.translate(shx, shy);
      drawBackground(world);
      if (world.screen === 'title') {
        drawField(world);
        drawTitle(world);
      } else if (world.screen === 'playing' || world.screen === 'paused') {
        drawField(world);
        drawHud(world);
        if (world.screen === 'paused') drawPaused();
      } else if (world.screen === 'victory') {
        drawField(world);
        drawHud(world);
        drawVictory(world);
      } else if (world.screen === 'gameover') {
        drawField(world);
        drawHud(world);
        drawGameOver(world);
      }
      ctx.restore();
      // Damage flash sits above everything.
      if (world.flash > 0) {
        ctx.fillStyle = `rgba(255,60,80,${world.flash * 0.28})`;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
    },
  };
}
