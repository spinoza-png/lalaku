import { Game } from './game.js';
import { CONFIG } from './gameConfig.js';

const canvas = document.getElementById('game-canvas');
const ui = {
  score: document.getElementById('score'),
  mult: document.getElementById('mult'),
  hunger: document.getElementById('hunger'),
  length: document.getElementById('length'),
  speed: document.getElementById('speed'),
  event: document.getElementById('event'),
  power: document.getElementById('power'),
};

const menu = document.getElementById('menu');
const gameover = document.getElementById('gameover');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalStats = document.getElementById('final-stats');

let game = null;

function start() {
  menu.classList.add('hidden');
  gameover.classList.add('hidden');
  game = new Game(canvas, ui, onGameOver);
  game.start();
}

function onGameOver(summary) {
  finalStats.textContent = `Score ${summary.score} • Max Mult ${summary.maxMultiplier} • Length ${summary.length} • Time ${summary.time.toFixed(1)}s • Events ${summary.eventsTriggered}`;
  gameover.classList.remove('hidden');
}

startBtn.addEventListener('click', start);
restartBtn.addEventListener('click', start);

// Optional: allow pressing Enter on menu
window.addEventListener('keydown', (e) => {
  if (menu && !menu.classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ')) {
    start();
  }
});

// Allow quick restart
window.addEventListener('keydown', (e) => {
  if (game && game.isGameOver() && (e.key === 'r' || e.key === 'R')) {
    start();
  }
});