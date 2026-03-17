import { startGame } from './script/game-core.js';

startGame({
  wasmImportPath: '/wasm.js',
  spritePath: './assets/sprites/rats/rat_cours.png',
  canvasIds: ['game', 'ecranDeJeu'],
  floorY: 580.0,
  platforms: [
    { x: 100, y: 420, w: 220, h: 15 },
    { x: 420, y: 300, w: 240, h: 15 },
    { x: 0, y: 580, w: 1000, h: 20 },
  ],
});