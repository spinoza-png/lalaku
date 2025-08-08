import { CONFIG } from './gameConfig.js';
import { withGridWrap, roundRectPath } from './utils.js';

export class Snake {
  constructor(cols, rows, initialLength) {
    this.cols = cols; this.rows = rows;
    this.body = [];
    const startX = Math.floor(cols / 2);
    const startY = Math.floor(rows / 2);
    for (let i = 0; i < initialLength; i++) {
      this.body.unshift({ x: startX - i, y: startY });
    }
    this.direction = { x: 1, y: 0 };
    this.pendingDirections = [];
    this.growBy = 0;
    this.hunger = CONFIG.gameplay.initialHunger; // percent
    this.alive = true;
    this.ghostSteps = 0;
    this.invertControls = false;
    this.lastMoveDir = { x: 1, y: 0 };
    this.justTeleportedCooldown = 0; // prevent immediate re-teleport
  }

  head() { return this.body[0]; }

  setDirection(vec) {
    const lastDir = this.pendingDirections.length ? this.pendingDirections[this.pendingDirections.length - 1] : this.direction;
    // avoid reversing
    if (lastDir.x + vec.x === 0 && lastDir.y + vec.y === 0) return;
    this.pendingDirections.push(vec);
  }

  applyHungerDrain(dt) {
    this.hunger = Math.max(0, this.hunger - CONFIG.timing.hungerDrainPerSecond * dt);
    if (this.hunger <= 0) this.alive = false;
  }

  applyRefill(amountPercent) {
    this.hunger = Math.min(100, this.hunger + amountPercent);
  }

  grantGhost(steps) { this.ghostSteps = Math.max(this.ghostSteps, steps); }
  setInvert(active) { this.invertControls = active; }

  updateOneStep(wrap = true) {
    if (!this.alive) return;
    const nextDir = this.pendingDirections.shift();
    if (nextDir) this.direction = nextDir;

    let newHead = { x: this.head().x + this.direction.x, y: this.head().y + this.direction.y };
    this.lastMoveDir = this.direction;

    if (wrap) {
      newHead = withGridWrap(newHead.x, newHead.y, this.cols, this.rows);
    }

    // Move
    this.body.unshift(newHead);

    if (this.growBy > 0) {
      this.growBy -= 1;
    } else {
      this.body.pop();
    }

    if (this.ghostSteps > 0) this.ghostSteps -= 1;
    if (this.justTeleportedCooldown > 0) this.justTeleportedCooldown -= 1;
  }

  grow(n) {
    if (n > 0) this.growBy += n;
    else if (n < 0) {
      for (let i = 0; i < Math.min(this.body.length - 1, -n); i++) this.body.pop();
      if (this.body.length <= 1) this.alive = false;
    }
  }

  occupies(x, y, skipHead = false) {
    return this.body.some((p, idx) => (skipHead && idx === 0) ? false : (p.x === x && p.y === y));
  }

  collideSelfOrWalls(wallsSet) {
    const h = this.head();
    // Walls
    if (wallsSet && wallsSet.has(`${h.x},${h.y}`)) {
      if (this.ghostSteps <= 0) this.alive = false;
      return !this.alive;
    }
    // Self collision
    for (let i = 1; i < this.body.length; i++) {
      const p = this.body[i];
      if (p.x === h.x && p.y === h.y) {
        if (this.ghostSteps <= 0) this.alive = false;
        return !this.alive;
      }
    }
    return false;
  }

  draw(ctx, tile) {
    ctx.save();
    for (let i = this.body.length - 1; i >= 0; i--) {
      const p = this.body[i];
      const px = p.x * tile; const py = p.y * tile;
      const r = i === 0 ? 4 : 3;
      ctx.fillStyle = (this.ghostSteps > 0) ? CONFIG.colors.snakeGhost : (i === 0 ? CONFIG.colors.snakeHead : CONFIG.colors.snakeBody);
      ctx.shadowColor = CONFIG.colors.textShadow;
      ctx.shadowBlur = i === 0 ? 16 : 8;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(px + 2, py + 2, tile - 4, tile - 4, r);
      } else {
        roundRectPath(ctx, px + 2, py + 2, tile - 4, tile - 4, r);
      }
      ctx.fill();
    }
    ctx.restore();
  }
}