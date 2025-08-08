import { CONFIG } from './gameConfig.js';
import { RNG, clamp, nowSec, posKey, parsePos, withGridWrap } from './utils.js';
import { Apple, AppleType, Obstacle, Portal, Meteor, drawGrid } from './entities.js';
import { Snake } from './snake.js';

const GameState = { Menu: 'menu', Playing: 'playing', Paused: 'paused', Over: 'over' };

export class Game {
  constructor(canvas, ui, onGameOver) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.onGameOver = onGameOver;

    this.cols = CONFIG.grid.cols; this.rows = CONFIG.grid.rows; this.tile = CONFIG.grid.tile;
    this.canvas.width = this.cols * this.tile; this.canvas.height = this.rows * this.tile;

    this.rng = new RNG(Date.now());

    this.reset();

    this.keydown = (e) => this.onKeyDown(e);
    window.addEventListener('keydown', this.keydown);
  }

  reset() {
    this.state = GameState.Menu;
    this.snake = new Snake(this.cols, this.rows, CONFIG.gameplay.initialLength);
    this.score = 0;
    this.multiplier = 1;
    this.maxMultiplier = 1;
    this.comboTimer = 0;
    this.stepsPerSecond = CONFIG.timing.baseStepsPerSecond;
    this.time = 0;

    this.apples = new Map();
    this.obstacles = new Map();
    this.portal = null;
    this.meteors = [];

    this.fogActive = false;
    this.invertActive = false;

    this.eventTimer = this.randomEventCooldown();
    this.eventsTriggered = 0;

    this.powerUp = null; // 'ghost'

    this.framePrev = nowSec();
    this.accum = 0; // seconds accumulated toward next step
    this.paused = false;

    // Populate initial world
    this.generateObstacles();
    for (let i = 0; i < 3; i++) this.spawnApple();
    this.spawnPortal();
  }

  randomEventCooldown() { return this.rng.range(CONFIG.timing.eventMinCooldown, CONFIG.timing.eventMaxCooldown); }

  start() {
    this.state = GameState.Playing;
    this.loop();
  }

  isGameOver() { return this.state === GameState.Over; }

  loop() {
    if (this.state === GameState.Over) return;
    const t = nowSec();
    const dt = Math.min(0.06, t - this.framePrev);
    this.framePrev = t;

    if (!this.paused && this.state === GameState.Playing) {
      this.update(dt);
      this.render();
    } else if (this.state === GameState.Playing) {
      this.render();
      this.drawPausedOverlay();
    }

    requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    this.time += dt;
    // Hunger and combo
    this.snake.applyHungerDrain(dt);
    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.multiplier = 1;

    // Events
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.triggerRandomEvent();
      this.eventTimer = this.randomEventCooldown();
    }

    // Step accumulator
    const stepInterval = 1 / this.stepsPerSecond;
    this.accum += dt;
    while (this.accum >= stepInterval) {
      this.stepOne();
      this.accum -= stepInterval;
    }

    if (!this.snake.alive) this.gameOver('Snake died');

    // UI
    this.updateUI();
  }

  stepOne() {
    // Move
    this.snake.updateOneStep(true);

    // Portal teleport
    if (this.portal && this.snake.justTeleportedCooldown <= 0) {
      const h = this.snake.head();
      const a = this.portal.a; const b = this.portal.b;
      let teleported = false;
      if (h.x === a.x && h.y === a.y) {
        this.snake.body[0] = { x: b.x, y: b.y };
        teleported = true;
      } else if (h.x === b.x && h.y === b.y) {
        this.snake.body[0] = { x: a.x, y: a.y };
        teleported = true;
      }
      if (teleported) {
        this.snake.justTeleportedCooldown = CONFIG.gameplay.portalTeleportCooldownSteps;
      }
    }

    // Meteor decay
    this.meteors.forEach(m => m.ttl -= 1);
    this.meteors = this.meteors.filter(m => m.ttl > 0);

    // Collisions
    const head = this.snake.head();
    const headKey = posKey(head.x, head.y);

    // Meteor collision is lethal regardless of ghost
    if (this.meteors.some(m => m.x === head.x && m.y === head.y)) {
      this.snake.alive = false;
      return;
    }

    // Obstacles / self
    const hit = this.snake.collideSelfOrWalls(this.obstacles);
    if (hit) return;

    // Apples
    const apple = this.apples.get(headKey);
    if (apple) {
      this.consumeApple(apple, headKey);
    }

    // Dynamic difficulty: add obstacles slowly
    const targetObstacleCount = Math.floor(this.cols * this.rows * (CONFIG.gameplay.obstacleDensity + this.score * CONFIG.gameplay.extraObstaclePerScore));
    if (this.obstacles.size < targetObstacleCount && this.rng.chance(0.2)) {
      this.spawnObstacle();
    }

    // Occasionally reshuffle portals
    if (this.rng.chance(0.03)) this.spawnPortal(true);
  }

  consumeApple(apple, key) {
    this.apples.delete(key);
    // Growth
    this.snake.grow(apple.growth);
    // Score and combo
    const comboActive = this.comboTimer > 0;
    if (comboActive) this.multiplier = Math.min(this.multiplier + 1, 12);
    else this.multiplier = 1;
    this.maxMultiplier = Math.max(this.maxMultiplier, this.multiplier);
    this.score += Math.max(0, Math.floor(apple.score * this.multiplier));
    this.comboTimer = CONFIG.timing.comboWindowSec;

    // Hunger refill (not for rotten)
    if (apple.type !== AppleType.Rotten) this.snake.applyRefill(CONFIG.timing.hungerEatRefill);

    // Speed adjustments
    if (apple.type === AppleType.Golden) this.stepsPerSecond = clamp(this.stepsPerSecond + 0.6, CONFIG.timing.minStepsPerSecond, CONFIG.timing.maxStepsPerSecond);
    else if (apple.type === AppleType.Rotten) this.stepsPerSecond = clamp(this.stepsPerSecond - 0.4, CONFIG.timing.minStepsPerSecond, CONFIG.timing.maxStepsPerSecond);

    // Chance to drop power-up
    if (!this.powerUp && this.rng.chance(0.18 + 0.02 * this.multiplier)) {
      this.powerUp = 'ghost';
    }

    // Respawn apples to maintain 3-5 on board
    const target = this.rng.int(3, 5);
    while (this.apples.size < target) this.spawnApple();
  }

  updateUI() {
    this.ui.score.textContent = String(this.score);
    this.ui.mult.textContent = `x${this.multiplier}`;
    this.ui.hunger.textContent = `${Math.round(this.snake.hunger)}%`;
    this.ui.length.textContent = String(this.snake.body.length);
    this.ui.speed.textContent = this.stepsPerSecond.toFixed(1);
    this.ui.power.textContent = this.powerUp ? this.powerUp : 'None';
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grid
    drawGrid(ctx, this.cols, this.rows, this.tile);

    // Obstacles
    for (const k of this.obstacles.keys()) {
      const { x, y } = parsePos(k);
      new Obstacle(x, y).draw(ctx, this.tile);
    }

    // Portals
    if (this.portal) this.portal.draw(ctx, this.tile);

    // Meteors
    this.meteors.forEach(m => m.draw(ctx, this.tile));

    // Apples
    for (const a of this.apples.values()) a.draw(ctx, this.tile);

    // Snake
    this.snake.draw(ctx, this.tile);

    // Fog
    if (this.fogActive) this.drawFog();
  }

  drawFog() {
    const ctx = this.ctx; const tile = this.tile;
    const head = this.snake.head();
    const cx = head.x * tile + tile / 2;
    const cy = head.y * tile + tile / 2;
    const maxR = Math.max(this.canvas.width, this.canvas.height);
    const grad = ctx.createRadialGradient(cx, cy, tile * 3, cx, cy, maxR);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, CONFIG.colors.fog);

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  drawPausedOverlay() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 28px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', this.canvas.width / 2, this.canvas.height / 2);
    ctx.restore();
  }

  gameOver(reason) {
    this.state = GameState.Over;
    this.onGameOver({
      score: this.score,
      maxMultiplier: this.maxMultiplier,
      length: this.snake.body.length,
      time: this.time,
      eventsTriggered: this.eventsTriggered,
      reason,
    });
  }

  onKeyDown(e) {
    if (this.state !== GameState.Playing) return;
    const key = e.key;
    if (key === 'p' || key === 'P') { this.paused = !this.paused; return; }
    if (key === ' ' || key === 'Spacebar') { this.usePowerUp(); return; }

    let dir = null;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') dir = { x: 0, y: -1 };
    else if (key === 'ArrowDown' || key === 's' || key === 'S') dir = { x: 0, y: 1 };
    else if (key === 'ArrowLeft' || key === 'a' || key === 'A') dir = { x: -1, y: 0 };
    else if (key === 'ArrowRight' || key === 'd' || key === 'D') dir = { x: 1, y: 0 };

    if (dir) {
      if (this.invertActive) dir = { x: -dir.x, y: -dir.y };
      this.snake.setDirection(dir);
    }
  }

  usePowerUp() {
    if (!this.powerUp) return;
    if (this.powerUp === 'ghost') {
      // grant 8 steps of ghost
      this.snake.grantGhost(Math.round(CONFIG.timing.powerupDurationSec * this.stepsPerSecond));
    }
    this.powerUp = null;
  }

  canPlace(x, y) {
    const k = posKey(x, y);
    if (this.obstacles.has(k)) return false;
    if (this.snake.occupies(x, y)) return false;
    if (this.portal && ((this.portal.a.x === x && this.portal.a.y === y) || (this.portal.b.x === x && this.portal.b.y === y))) return false;
    return !this.apples.has(k);
  }

  randomEmptyCell() {
    for (let tries = 0; tries < 2000; tries++) {
      const x = this.rng.int(0, this.cols - 1);
      const y = this.rng.int(0, this.rows - 1);
      if (this.canPlace(x, y)) return { x, y };
    }
    // fallback
    return { x: this.rng.int(0, this.cols - 1), y: this.rng.int(0, this.rows - 1) };
  }

  generateObstacles() {
    // ring border? Keep wrap on, so we do sparse rocks instead
    const cells = Math.floor(this.cols * this.rows * CONFIG.gameplay.obstacleDensity);
    for (let i = 0; i < cells; i++) this.spawnObstacle();
  }

  spawnObstacle() {
    const { x, y } = this.randomEmptyCell();
    this.obstacles.set(posKey(x, y), 1);
  }

  spawnApple() {
    const { x, y } = this.randomEmptyCell();
    const typeRoll = this.rng.next();
    let type = AppleType.Normal;
    if (typeRoll > 0.88) type = AppleType.Golden; else if (typeRoll < 0.12) type = AppleType.Rotten;
    const a = new Apple(x, y, type);
    this.apples.set(posKey(x, y), a);
  }

  spawnPortal(reshuffle = false) {
    if (reshuffle || !this.portal) {
      const a = this.randomEmptyCell();
      const b = this.randomEmptyCell();
      this.portal = new Portal(a.x, a.y, b.x, b.y);
    }
  }

  triggerRandomEvent() {
    const events = [
      () => this.eventInvertControls(),
      () => this.eventFog(),
      () => this.eventMeteorShower(),
      () => this.eventTimeShift(),
      () => this.eventPortalShuffle(),
      () => this.eventAppleBloom(),
    ];
    const pick = this.rng.pick(events);
    pick();
    this.eventsTriggered += 1;
  }

  setEventLabel(text, color = '#e6e8f0') {
    this.ui.event.textContent = text;
    this.ui.event.style.color = color;
    // fade label after 3s
    const el = this.ui.event;
    if (this._eventLabelTimeout) clearTimeout(this._eventLabelTimeout);
    this._eventLabelTimeout = setTimeout(() => { el.textContent = '—'; el.style.color = ''; }, 3000);
  }

  eventInvertControls() {
    this.invertActive = true;
    this.snake.setInvert(true);
    this.setEventLabel('Event: Inverted Controls', '#fbbf24');
    setTimeout(() => { this.invertActive = false; this.snake.setInvert(false); }, 6000);
  }

  eventFog() {
    this.fogActive = true;
    this.setEventLabel('Event: Blackout Fog', '#93c5fd');
    setTimeout(() => { this.fogActive = false; }, 8000);
  }

  eventMeteorShower() {
    // spawn hazardous cells that expire
    const count = this.rng.int(6, 12);
    for (let i = 0; i < count; i++) {
      const { x, y } = this.randomEmptyCell();
      this.meteors.push(new Meteor(x, y, this.rng.int(4, 8)));
    }
    this.setEventLabel('Event: Meteor Shower', '#fb7185');
  }

  eventTimeShift() {
    const faster = this.rng.chance(0.5);
    if (faster) {
      this.stepsPerSecond = clamp(this.stepsPerSecond + 3.0, CONFIG.timing.minStepsPerSecond, CONFIG.timing.maxStepsPerSecond);
      this.setEventLabel('Event: Speed Surge', '#34d399');
      setTimeout(() => { this.stepsPerSecond = clamp(this.stepsPerSecond - 3.0, CONFIG.timing.minStepsPerSecond, CONFIG.timing.maxStepsPerSecond); }, 6000);
    } else {
      this.stepsPerSecond = clamp(this.stepsPerSecond - 3.0, CONFIG.timing.minStepsPerSecond, CONFIG.timing.maxStepsPerSecond);
      this.setEventLabel('Event: Time Slow', '#60a5fa');
      setTimeout(() => { this.stepsPerSecond = clamp(this.stepsPerSecond + 3.0, CONFIG.timing.minStepsPerSecond, CONFIG.timing.maxStepsPerSecond); }, 6000);
    }
  }

  eventPortalShuffle() {
    this.spawnPortal(true);
    this.setEventLabel('Event: Portals Shift', '#a78bfa');
  }

  eventAppleBloom() {
    const toSpawn = this.rng.int(3, 6);
    for (let i = 0; i < toSpawn; i++) this.spawnApple();
    this.setEventLabel('Event: Apple Bloom', '#fca5a5');
  }
}