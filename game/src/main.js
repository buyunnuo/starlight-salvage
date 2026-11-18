// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// victory and game over.
//
// ?seed=N fixes the run's randomness. ?shot=title|play|win|over (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_MUTE } from './input.js';
import { createRenderer } from './render.js';
import { createWorld, update } from './world.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const MAX_STEPS = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const input = createInput(canvas);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

let savedBest = readBest();
const world = createWorld(seed, audio, savedBest);

function saveBest() {
  if (world.best === savedBest) return;
  savedBest = world.best;
  try {
    window.localStorage.setItem(BEST_KEY, String(world.best));
  } catch { /* private mode or no storage: the run still counts */ }
}

function announce() {
  const screen = world.screen;
  const text =
    screen === 'title'
      ? 'Starlight Salvage. Press Enter to launch.'
      : screen === 'playing'
        ? `Wave ${world.wave}. Score ${world.score}. Hull ${Math.ceil(world.player.hull)}.`
        : screen === 'paused'
          ? 'Paused.'
          : screen === 'victory'
            ? `Field cleared! Score ${world.score}.`
            : `Drone lost on wave ${world.wave}. Score ${world.score}.`;
  status.textContent = text;
}

// Exposed for debugging and for the screenshot driver: the live world.
window.__game = { world, input, audio };

if (shot) {
  stageShot(world, shot, seed);
  renderer.render(world);
  renderer.render(world);
  announce();
  window.__shotReady = true;
} else {
  let last = performance.now();
  let acc = 0;
  let announcedScreen = '';
  function frame(now) {
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    acc += dt;
    let steps = 0;
    // Mute is handled here so it works on every screen.
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.setMuted(!audio.muted);
    input.requeue(actions & ~ACTION_MUTE);
    while (acc >= STEP && steps < MAX_STEPS) {
      update(world, STEP, input);
      acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0;
    const t = renderer.transform();
    input.setTransform(t.scale, t.offsetX, t.offsetY);
    renderer.render(world);
    saveBest();
    if (world.screen !== announcedScreen) {
      announcedScreen = world.screen;
      announce();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
