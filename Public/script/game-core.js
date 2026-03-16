import { initPhysics } from './wasm.js';

const DEFAULT_CONFIG = {
  wasmImportPath: './wasm.js',
  spritePath: './assets/sprites/rats/rat_cours.png',
  canvasIds: ['game', 'ecranDeJeu'],
  gravity: 1980.0,
  floorY: 580.0,
  playerWidth: 50,
  playerHeight: 50,
  moveSpeed: 220,
  jumpSpeed: 450,
  platforms: [
    { x: 50, y: 400, w: 250, h: 20 },  { x: 350, y: 300, w: 400, h: 20 },
    { x: 100, y: 200, w: 300, h: 20 }, { x: 400, y: 100, w: 200, h: 20 },
    { x: 0, y: 580, w: 1000, h: 20 },
  ],
};

// --- Éléments de Gameplay Loïc ---
const listeLeviers = [
    { id: 0, x: 80, y: 350, w: 30, h: 50, active: false },
    { id: 1, x: 650, y: 250, w: 30, h: 50, active: false }
];
const fromage = { x: 500, y: 60, w: 40, h: 40 };

function localInputFor(keys, playerIndex) {
  const isP0 = playerIndex === 0;
  return {
    left: isP0 ? !!keys.ArrowLeft : !!keys.KeyQ,
    right: isP0 ? !!keys.ArrowRight : !!keys.KeyD,
    jump: isP0 ? !!keys.ArrowUp : !!keys.KeyZ,
    action: !!keys.KeyE || !!keys.Space
  };
}

export async function startGame(userConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const canvas = document.getElementById(config.canvasIds[1]) || document.getElementById(config.canvasIds[0]);
  const ctx = canvas.getContext('2d');
  const socket = window.io ? window.io() : null;

  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  const netInputs = [{}, {}];
  const jumpLatch = [false, false];
  let myPlayerIndex = -1;

  // --- Chargement Sprites ---
  const spriteRat = new Image(); spriteRat.src = config.spritePath;
  const spriteFromage = new Image(); spriteFromage.src = './assets/sprites/items/fromagewin.png';

  // --- Initialisation Physique (Fahed) ---
  const world = await initPhysics(config.gravity, config.floorY);
  config.platforms.forEach(p => world.add_platform(p.x, p.y, p.w, p.h));
  const players = [
    world.add_player(100, 400, config.playerWidth, config.playerHeight),
    world.add_player(280, 400, config.playerWidth, config.playerHeight)
  ];

  if (socket) {
    socket.on('assign_player', ({ playerIndex }) => { 
        myPlayerIndex = playerIndex; 
        console.log("Connecté en tant que Joueur " + playerIndex);
    });
    socket.on('input', (data) => { netInputs[data.playerIndex] = data; });
    socket.on('lever_update', (data) => { if(listeLeviers[data.id]) listeLeviers[data.id].active = data.state; });
  }

  const FIXED_DT = 1 / 60;
  let lastTime = performance.now();
  let accumulator = 0;

  function loop(now) {
    accumulator += Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (socket && myPlayerIndex !== -1) {
      const input = localInputFor(keys, myPlayerIndex);
      socket.emit('input', input);
      netInputs[myPlayerIndex] = input;
    }

    // --- Logique Physique & Courte Échelle ---
    for (let i = 0; i < players.length; i++) {
      const input = netInputs[i];
      if (!input || input.left === undefined) continue;

      let currentJump = config.jumpSpeed;
      const other = players[i === 0 ? 1 : 0];
      
      // Mécanique Courte Échelle (Loïc)
      const dy = world.get_player_y(players[i]) - world.get_player_y(other);
      const dx = Math.abs(world.get_player_x(players[i]) - world.get_player_x(other));
      if (dy < -30 && dy > -60 && dx < 40) {
          currentJump = 700; // Boost de saut
      }

      const vx = (input.right ? 1 : input.left ? -1 : 0) * config.moveSpeed;
      world.set_player_vx(players[i], vx);
      
      if (input.jump && !jumpLatch[i]) world.player_jump(players[i], currentJump);
      jumpLatch[i] = input.jump;

      // Interaction Leviers
      if (input.action && i === myPlayerIndex) {
          listeLeviers.forEach(l => {
              const dist = Math.sqrt(Math.pow(world.get_player_x(players[i]) - l.x, 2) + Math.pow(world.get_player_y(players[i]) - l.y, 2));
              if (dist < 60) socket.emit('toggle_lever', { id: l.id });
          });
          keys.KeyE = false; keys.Space = false; // Anti-spam
      }
    }

    while (accumulator >= FIXED_DT) { world.step(FIXED_DT); accumulator -= FIXED_DT; }

    // --- Rendu Graphique ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#8B4513';
    config.platforms.forEach(p => ctx.fillRect(p.x, p.y, p.w, p.h));

    listeLeviers.forEach(l => {
        ctx.fillStyle = l.active ? '#00ff00' : '#ff0000';
        ctx.fillRect(l.x, l.y, l.w, l.h);
    });

    if (spriteFromage.complete) ctx.drawImage(spriteFromage, fromage.x, fromage.y, fromage.w, fromage.h);

    players.forEach((pId, idx) => {
        const x = world.get_player_x(pId);
        const y = world.get_player_y(pId);
        if (spriteRat.complete) ctx.drawImage(spriteRat, x, y, config.playerWidth, config.playerHeight);
        if (idx === myPlayerIndex) {
            ctx.strokeStyle = 'yellow'; ctx.lineWidth = 2;
            ctx.strokeRect(x, y, config.playerWidth, config.playerHeight);
        }
    });

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}