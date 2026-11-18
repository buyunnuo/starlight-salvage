// All sound is synthesized with the Web Audio API — no audio files, no network.
// Each effect is a few oscillators or a burst of filtered noise. The context is
// created lazily on the first user gesture (browsers block audio before one),
// and a quiet pulsing bass runs under play. M toggles mute.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicNodes = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** An oscillator that glides from one frequency to another, then stops. */
  function tone({ type = 'sine', from = 440, to = null, dur = 0.12, vol = 0.2, when = 0 }) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A burst of white noise through a low-pass filter. */
  function noise({ dur = 0.2, vol = 0.25, freq = 1200, when = 0 }) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.2), t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  const api = {
    /** Call from any user gesture so later sounds are allowed. */
    unlock() { ensure(); },
    get muted() { return muted; },
    setMuted(value) {
      muted = !!value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    shoot() { tone({ type: 'square', from: 880, to: 220, dur: 0.09, vol: 0.10 }); },
    pickup(combo) {
      const base = 520 + Math.min(combo, 8) * 60;
      tone({ type: 'sine', from: base, to: base * 1.5, dur: 0.12, vol: 0.16 });
    },
    explosion() {
      noise({ dur: 0.35, vol: 0.30, freq: 900 });
      tone({ type: 'sine', from: 160, to: 40, dur: 0.3, vol: 0.28 });
    },
    hit() {
      tone({ type: 'sawtooth', from: 140, to: 60, dur: 0.18, vol: 0.22 });
      noise({ dur: 0.12, vol: 0.18, freq: 700 });
    },
    dash() { noise({ dur: 0.16, vol: 0.14, freq: 3200 }); },
    powerup() {
      tone({ type: 'triangle', from: 440, to: 880, dur: 0.14, vol: 0.18 });
      tone({ type: 'triangle', from: 660, to: 1320, dur: 0.16, vol: 0.14, when: 0.08 });
    },
    waveClear() {
      tone({ type: 'triangle', from: 523, dur: 0.16, vol: 0.16 });
      tone({ type: 'triangle', from: 784, dur: 0.22, vol: 0.16, when: 0.12 });
    },
    victory() {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone({ type: 'triangle', from: f, dur: 0.22, vol: 0.18, when: i * 0.13 }));
    },
    gameOver() {
      [392, 330, 262, 196].forEach((f, i) =>
        tone({ type: 'sawtooth', from: f, dur: 0.26, vol: 0.12, when: i * 0.16 }));
    },
    click() { tone({ type: 'sine', from: 700, to: 500, dur: 0.05, vol: 0.10 }); },
    /** Start the quiet bass pulse under play; stop() ends it. */
    startMusic() {
      if (!ensure() || musicNodes) return;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 55;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.03;
      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      musicNodes = { osc, lfo, gain };
    },
    stopMusic() {
      if (!musicNodes) return;
      try {
        musicNodes.osc.stop();
        musicNodes.lfo.stop();
        musicNodes.gain.disconnect();
      } catch { /* already stopped */ }
      musicNodes = null;
    },
  };
  return api;
}
