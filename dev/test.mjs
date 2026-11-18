// Playwright harness for Starlight Salvage (Node 22, playwright-core + the Chromium
// downloaded to ~/.cache/ms-playwright). Run from this folder:
//   node test.mjs
// It serves nothing itself: start `node serve.ts` (port 8080) in the project root first.
// It (1) screenshots the four staged scenes to ../screenshots/ as JPEGs (the dossier
// takes PNG or JPEG, each <= 256 KiB, first by name the cover), (2) plays the real
// game — launch, move, shoot, pause, die, restart — and (3) reports any console or
// page error. Exit code 0 means every check passed.

import { chromium } from 'playwright-core';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const shotsDir = join(root, 'screenshots');
mkdirSync(shotsDir, { recursive: true });

const BASE = 'http://localhost:8080';
const SEED = 42;
const failures = [];
const notes = [];
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures.push(name);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
page.on('requestfailed', (req) => errors.push('requestfailed: ' + req.url()));

// --- The four staged screenshots -------------------------------------------
const shots = ['title', 'play', 'win', 'over'];
for (let i = 0; i < shots.length; i++) {
  const shot = shots[i];
  await page.goto(`${BASE}/?shot=${shot}&seed=${SEED}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
  const name = `0${i + 1}-${shot}.jpg`;
  const path = join(shotsDir, name);
  await page.screenshot({ path, type: 'jpeg', quality: 82 });
  const size = statSync(path).size;
  check(`shot ${shot} saved (${name})`, size > 10000 && size <= 262144, `${Math.round(size / 1024)} KiB`);
  const state = await page.evaluate(() => ({
    screen: window.__game.world.screen,
    score: window.__game.world.score,
    wave: window.__game.world.wave,
    enemies: window.__game.world.enemies.length,
    salvage: window.__game.world.salvage.length,
  }));
  notes.push(`${shot}: screen=${state.screen} score=${state.score} wave=${state.wave} enemies=${state.enemies} salvage=${state.salvage}`);
}
for (const n of notes) console.log('      ' + n);

// --- Play the real game ------------------------------------------------------
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(800);
let w = await page.evaluate(() => ({ screen: window.__game.world.screen, best: window.__game.world.best }));
check('title screen on load', w.screen === 'title', JSON.stringify(w));

await page.keyboard.press('Enter');
await page.waitForTimeout(600);
w = await page.evaluate(() => ({ screen: window.__game.world.screen, wave: window.__game.world.wave }));
check('Enter launches wave 1', w.screen === 'playing' && w.wave === 1, JSON.stringify(w));

// Move, aim and shoot for a few seconds.
await page.keyboard.down('d');
await page.mouse.move(900, 300);
await page.mouse.down();
await page.waitForTimeout(2500);
await page.mouse.up();
await page.keyboard.up('d');
await page.keyboard.press('Shift'); // dash
w = await page.evaluate(() => ({
  screen: window.__game.world.screen,
  score: window.__game.world.score,
  hull: window.__game.world.player.hull,
  energy: Math.round(window.__game.world.player.energy),
  bullets: window.__game.world.bullets.length,
  shotsFired: window.__game.world.shotsFired,
  kills: window.__game.world.kills,
}));
check('playing: shots fired, still alive', w.screen === 'playing' && w.shotsFired > 0 && w.hull > 0, JSON.stringify(w));
await page.screenshot({ path: '/tmp/live-play.jpg', type: 'jpeg', quality: 82 });

// Pause and resume.
await page.keyboard.press('p');
await page.waitForTimeout(300);
w = await page.evaluate(() => window.__game.world.screen);
check('P pauses', w === 'paused', w);
await page.keyboard.press('p');
await page.waitForTimeout(300);
w = await page.evaluate(() => window.__game.world.screen);
check('P resumes', w === 'playing', w);

// Mute toggles without error.
await page.keyboard.press('m');
await page.waitForTimeout(200);
const muted = await page.evaluate(() => window.__game.audio.muted);
check('M mutes', muted === true, String(muted));
await page.keyboard.press('m');

// Die: put a mine on the player with 1 hull left.
await page.evaluate(() => {
  const w2 = window.__game.world;
  w2.player.hull = 1;
  const mine = w2.enemies.find((e) => e.kind === 'mine') ?? w2.enemies[0];
  if (mine) { mine.x = w2.player.x; mine.y = w2.player.y; }
});
await page.waitForTimeout(800);
w = await page.evaluate(() => ({ screen: window.__game.world.screen, score: window.__game.world.score }));
check('lethal hit ends the run', w.screen === 'gameover', JSON.stringify(w));
await page.screenshot({ path: '/tmp/live-over.jpg', type: 'jpeg', quality: 82 });

// Restart from the game-over screen.
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
w = await page.evaluate(() => ({ screen: window.__game.world.screen, wave: window.__game.world.wave, hull: window.__game.world.player.hull }));
check('Enter restarts after game over', w.screen === 'playing' && w.wave === 1 && w.hull === 100, JSON.stringify(w));

// No console errors, page errors or failed requests anywhere.
check('no console/page/request errors', errors.length === 0, errors.join(' | ').slice(0, 400));

await browser.close();
console.log(failures.length === 0 ? '\nALL CHECKS PASSED' : `\n${failures.length} CHECK(S) FAILED: ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
