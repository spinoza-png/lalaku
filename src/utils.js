export function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  }
}

export class RNG {
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
    this.rand = mulberry32(this.seed);
  }
  next() { return this.rand(); }
  range(min, max) { return min + (max - min) * this.next(); }
  int(min, maxInclusive) { return Math.floor(this.range(min, maxInclusive + 1)); }
  chance(p) { return this.next() < p; }
  pick(array) { return array.length ? array[this.int(0, array.length - 1)] : undefined; }
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const nowSec = () => performance.now() / 1000;

export function withGridWrap(x, y, cols, rows) {
  let nx = (x + cols) % cols;
  let ny = (y + rows) % rows;
  return { x: nx, y: ny };
}

export function posKey(x, y) { return `${x},${y}`; }
export function parsePos(key) { const [x, y] = key.split(',').map(Number); return { x, y }; }

export function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }