// A small seeded random generator (mulberry32) plus the helpers the game uses,
// so a run from one seed plays the same way every time. Screenshots stage a
// seeded world; the live game seeds from the clock.

export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    /** A float in [0, 1). */
    next() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** A float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    /** One element of a non-empty array. */
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    /** A weighted pick from [[value, weight], ...]. */
    weighted(table) {
      let total = 0;
      for (const [, w] of table) total += w;
      let roll = this.next() * total;
      for (const [value, w] of table) {
        roll -= w;
        if (roll <= 0) return value;
      }
      return table[table.length - 1][0];
    },
  };
}

/** Clamp a number into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** The shortest signed angle from a to b, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Squared distance between two points (avoids a square root). */
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
