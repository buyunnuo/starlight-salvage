# Starlight Salvage

A top-down arena survival game built for the [make.fun](https://make.fun/bounty/best-game-01) **best-game-01** bounty — "Make the best game". Pilot a salvage drone through a debris field, collect glowing cores, dodge mines, and clear all 10 waves.

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/buyunnuo/starlight-salvage/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/buyunnuo/starlight-salvage/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit http://localhost:8080). No build step, no network requests, no audio or image files — everything is drawn on canvas and synthesized with WebAudio.

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move the drone |
| Mouse | Aim |
| Click / Space | Fire (costs energy, recharges) |
| Shift / Right-click | Dash — brief invulnerability, recharges |
| P | Pause |
| M | Mute |
| Enter | Start / restart |

**Rules.** Collect amber salvage cores to score — chaining pickups without taking a hit raises the combo multiplier. Mines sit still and explode (chain reactions included); drifters tumble, chasers hunt you, shooters fire back. Destroying enemies drops cores and sometimes power-ups: **Shield** (absorbs a hit), **Magnet** (pulls cores in), **Overdrive** (free rapid fire). Clear a wave to advance; clear wave 10 to win, with a bonus for hull left. Lose all hull and the run ends. Your best score is kept in the browser.

## Development

```sh
node serve.ts                 # play at http://localhost:8080
node --check game/src/main.js # syntax-check a module
MAKEFUN_OUTPUT_DIR=out node main.ts   # build the submission output locally
```

Screenshots are staged from the game itself: open `game/index.html?shot=title|play|win|over&seed=N` and the scene paints deterministically from the seed (the title screen, a mid-run fight, the victory screen, and the game-over screen).

## Structure

```
game/
  index.html        shell: canvas + status line, loads src/main.js
  src/
    main.js         boot, fixed-step loop, best-score persistence, ?shot= staging
    config.js       tuning: field, player, waves, scoring, palette
    random.js       seeded RNG (mulberry32) and small helpers
    audio.js        synthesized WebAudio sounds (no audio files)
    input.js        keyboard + mouse, mapped into field coordinates
    entities.js     spawning and per-frame behaviour of everything in the field
    waves.js        the 10-wave composition and the spawn director
    world.js        the run: screens, collisions, scoring, combo, power-ups
    render.js       canvas drawing: starfield, entities, HUD, screens
    shots.js        deterministic staging for the four screenshots
main.ts             the entry program: copies game/ + screenshots/ to /output,
                    writes /output/dossier.json via the vendored library
serve.ts            a tiny static server for local play
vendor/
  makefun-game.ts   the make.fun dossier library (vendored from the kit)
```

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?ref=2stct04d&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
