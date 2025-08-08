export const CONFIG = {
  grid: { cols: 45, rows: 35, tile: 20 },
  timing: {
    baseStepsPerSecond: 7.0,
    minStepsPerSecond: 3.5,
    maxStepsPerSecond: 18.0,
    hungerDrainPerSecond: 4.0, // % per second
    hungerEatRefill: 28, // %
    comboWindowSec: 3.0,
    eventMinCooldown: 8.0,
    eventMaxCooldown: 16.0,
    powerupDurationSec: 6.0,
  },
  colors: {
    grid: '#13172a',
    gridSubtle: '#0f1326',
    snakeHead: '#9ae6b4',
    snakeBody: '#34d399',
    snakeGhost: '#7dd3fc',
    apple: '#f87171',
    goldenApple: '#fbbf24',
    rottenApple: '#a3a3a3',
    obstacle: '#475569',
    portalA: '#a78bfa',
    portalB: '#7dd3fc',
    fog: 'rgba(15,18,32,0.96)',
    meteor: '#fb7185',
    textShadow: 'rgba(255,255,255,0.06)'
  },
  gameplay: {
    initialLength: 4,
    initialHunger: 100,
    obstacleDensity: 0.05, // fraction of grid occupied progressively
    extraObstaclePerScore: 0.0025,
    aiSnakes: 0, // set to 1 later for extra challenge
    portalTeleportCooldownSteps: 3,
  }
};