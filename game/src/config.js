// Starlight Salvage — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many waves a run lasts; clearing wave 10 wins the game. */
export const WAVES = 10;

export const PLAYER = {
  radius: 14,
  accel: 2400,
  maxSpeed: 340,
  damping: 0.86, // velocity kept per step at zero input (applied as pow(damping, dt*60))
  hull: 100,
  fireCost: 8,
  fireInterval: 0.16,
  bulletSpeed: 720,
  bulletRadius: 5,
  energyMax: 100,
  energyRegen: 30,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 1.4,
  dashInvuln: 0.45,
  hurtInvuln: 1.0,
};

export const SALVAGE = {
  radius: 10,
  points: 10,
  collectRadius: 30,
  attractRadius: 80,
  magnetRadius: 260,
  comboWindow: 3.5,
  comboMax: 8,
};

export const ENEMY = {
  mine: { radius: 16, hp: 1, points: 15, damage: 25, blastRadius: 100 },
  drifter: { radius: 22, hp: 3, points: 20, damage: 15, speed: 70 },
  chaser: { radius: 15, hp: 2, points: 30, damage: 20, speed: 150 },
  shooter: { radius: 16, hp: 2, points: 40, damage: 15, speed: 110, bulletSpeed: 240, fireInterval: 2.2 },
};

export const BULLET = {
  enemyRadius: 6,
  enemyDamage: 15,
  life: 4,
};

export const POWERUP = {
  radius: 13,
  dropChance: 0.12,
  shieldSeconds: 14,
  magnetSeconds: 10,
  overdriveSeconds: 8,
};

/** Wave director: how a wave is built from its number (1-based). */
export const WAVE = {
  /** Enemies in wave n. */
  count(n) { return 6 + n * 3; },
  /** Seconds between spawns in wave n. */
  interval(n) { return Math.max(0.95 - n * 0.06, 0.35); },
  /** Speed multiplier for wave n. */
  speed(n) { return 1 + (n - 1) * 0.045; },
  /** Which kinds may appear in wave n, with weights. */
  table(n) {
    const t = [['mine', 3]];
    if (n >= 2) t.push(['chaser', 2 + n]);
    if (n >= 3) t.push(['drifter', 2 + n]);
    if (n >= 4) t.push(['shooter', 1 + n]);
    return t;
  },
};

export const PALETTE = {
  backdrop: '#070a18',
  nebulaA: '#1b2a5e',
  nebulaB: '#3a1b5e',
  nebulaC: '#0e3a4a',
  star: '#dfe8ff',
  player: '#4fe3ff',
  playerCore: '#eafcff',
  bullet: '#8ef1ff',
  enemyBullet: '#ff9d5c',
  salvage: '#ffc94d',
  salvageCore: '#fff3c4',
  mine: '#ff5470',
  drifter: '#9aa7bd',
  chaser: '#c07bff',
  shooter: '#ff9d5c',
  shield: '#7dffd4',
  magnet: '#ff8ad8',
  overdrive: '#ffe14d',
  panel: '#10182e',
  panelEdge: '#2a3a5e',
  text: '#eef3ff',
  muted: '#8b96b5',
  danger: '#ff5470',
  gold: '#ffc94d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'starlight-salvage.best';
