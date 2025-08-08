import { CONFIG } from './gameConfig.js';

export const AppleType = {
  Normal: 'normal',
  Golden: 'golden',
  Rotten: 'rotten',
};

export class Apple {
  constructor(x, y, type = AppleType.Normal) {
    this.x = x; this.y = y; this.type = type;
  }
  get score() {
    switch (this.type) {
      case AppleType.Golden: return 10;
      case AppleType.Rotten: return -4;
      default: return 3;
    }
  }
  get growth() {
    switch (this.type) {
      case AppleType.Golden: return 3;
      case AppleType.Rotten: return -2;
      default: return 1;
    }
  }
  draw(ctx, tile) {
    ctx.save();
    const cx = this.x * tile + tile / 2;
    const cy = this.y * tile + tile / 2;
    const r = tile * 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (this.type === AppleType.Golden) ctx.fillStyle = CONFIG.colors.goldenApple;
    else if (this.type === AppleType.Rotten) ctx.fillStyle = CONFIG.colors.rottenApple;
    else ctx.fillStyle = CONFIG.colors.apple;
    ctx.shadowColor = CONFIG.colors.textShadow;
    ctx.shadowBlur = 10;
    ctx.fill();
    // leaf
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.3, cy - r * 0.8, r * 0.25, r * 0.12, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class Obstacle {
  constructor(x, y) { this.x = x; this.y = y; }
  draw(ctx, tile) {
    const px = this.x * tile; const py = this.y * tile;
    ctx.save();
    ctx.fillStyle = CONFIG.colors.obstacle;
    ctx.shadowColor = CONFIG.colors.textShadow;
    ctx.shadowBlur = 8;
    ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
    ctx.restore();
  }
}

export class Portal {
  constructor(ax, ay, bx, by) {
    this.a = { x: ax, y: ay };
    this.b = { x: bx, y: by };
    this.cooldown = 0; // steps until reusable
  }
  draw(ctx, tile) {
    const drawOne = (p, color) => {
      const cx = p.x * tile + tile / 2;
      const cy = p.y * tile + tile / 2;
      const r = tile * 0.42;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.17;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    drawOne(this.a, CONFIG.colors.portalA);
    drawOne(this.b, CONFIG.colors.portalB);
  }
}

export class Meteor {
  constructor(x, y, ttlSteps = 6) { this.x = x; this.y = y; this.ttl = ttlSteps; }
  draw(ctx, tile) {
    const cx = this.x * tile + tile / 2;
    const cy = this.y * tile + tile / 2;
    ctx.save();
    ctx.fillStyle = CONFIG.colors.meteor;
    ctx.beginPath();
    ctx.arc(cx, cy, tile * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawGrid(ctx, cols, rows, tile) {
  ctx.save();
  ctx.strokeStyle = CONFIG.colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= cols; x++) {
    ctx.moveTo(x * tile + 0.5, 0);
    ctx.lineTo(x * tile + 0.5, rows * tile);
  }
  for (let y = 0; y <= rows; y++) {
    ctx.moveTo(0, y * tile + 0.5);
    ctx.lineTo(cols * tile, y * tile + 0.5);
  }
  ctx.globalAlpha = 0.22;
  ctx.stroke();
  ctx.restore();
}