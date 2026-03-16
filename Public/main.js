import { initPhysics } from './wasm.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const socket = window.io();

const platforms = [
  { x: 100, y: 420, w: 200, h: 15 },
  { x: 400, y: 300, w: 250, h: 15 },
  { x: 0, y: 580, w: 800, h: 20 },
];

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

let myPlayerIndex = -1;

// Inputs réseau reçus pour les 2 joueurs
const netInputs = [
  { left: false, right: false, jump: false },
  { left: false, right: false, jump: false },
];

const jumpLatch = [false, false];
let lastSent = null;

socket.on('assign_player', ({ playerIndex }) => {
  myPlayerIndex = playerIndex;
  console.log('Tu es le joueur', myPlayerIndex);
});

socket.on('input', ({ playerIndex, left, right, jump }) => {
  if (playerIndex < 0 || playerIndex > 1) return;
  netInputs[playerIndex] = { left, right, jump };
});

socket.on('player_left', ({ playerIndex }) => {
  if (playerIndex < 0 || playerIndex > 1) return;
  netInputs[playerIndex] = { left: false, right: false, jump: false };
});

socket.on('room_full', () => {
  alert('Salle pleine (2 joueurs max).');
});

function getLocalInputForAssignedPlayer() {
  // J0: fleches, J1: Q D Z
  if (myPlayerIndex === 0) {
    return {
      left: !!keys.ArrowLeft,
      right: !!keys.ArrowRight,
      jump: !!keys.ArrowUp,
    };
  }
  if (myPlayerIndex === 1) {
    return {
      left: !!keys.KeyQ,
      right: !!keys.KeyD,
      jump: !!keys.KeyZ,
    };
  }
  return { left: false, right: false, jump: false };
}

async function main() {
  const world = await initPhysics(1980.0, 580.0);

  for (const p of platforms) {
    world.add_platform(p.x, p.y, p.w, p.h);
  }

  const p0 = world.add_player(200, 100, 24, 32);
  const p1 = world.add_player(260, 100, 24, 32);
  const players = [p0, p1];

  const FIXED_DT = 1 / 60;
  let lastTime = performance.now();
  let accumulator = 0;

  function loop(now) {
    const frameDt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += frameDt;

    // Envoi des inputs locaux (seulement si changement)
    if (myPlayerIndex !== -1) {
      const local = getLocalInputForAssignedPlayer();
      const signature = `${local.left}-${local.right}-${local.jump}`;
      if (signature !== lastSent) {
        socket.emit('input', local);
        lastSent = signature;
      }
      // Applique aussi localement (réactivité)
      netInputs[myPlayerIndex] = local;
    }

    // Appliquer inputs sur les 2 joueurs
    for (let i = 0; i < players.length; i += 1) {
      const inp = netInputs[i];
      let vx = 0;
      if (inp.left) vx = -200;
      if (inp.right) vx = 200;
      world.set_player_vx(players[i], vx);

      if (inp.jump && !jumpLatch[i]) {
        world.player_jump(players[i], 450);
      }
      jumpLatch[i] = inp.jump;
    }

    while (accumulator >= FIXED_DT) {
      world.step(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    // Rendu
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of platforms) {
      ctx.fillStyle = p.y >= 580 ? '#555' : '#8B4513';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(world.get_player_x(p0), world.get_player_y(p0), 24, 32);

    ctx.fillStyle = '#3498db';
    ctx.fillRect(world.get_player_x(p1), world.get_player_y(p1), 24, 32);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main();