import { startGame } from './game-core.js';

startGame({
  wasmImportPath: '../wasm.js',
  spritePath: '../assets/sprites/rats/rat_cours.png',
  canvasIds: ['ecranDeJeu', 'game'],
});
