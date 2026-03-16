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
    { x: 100, y: 420, w: 220, h: 15 },
    { x: 420, y: 300, w: 240, h: 15 },
    { x: 0, y: 580, w: 1000, h: 20 },
  ],
};

function findCanvas(canvasIds) {
  for (const id of canvasIds) {
    const canvas = document.getElementById(id);
    if (canvas) return canvas;
  }
  return null;
}

function localInputFor(keys, playerIndex) {
  if (playerIndex === 0) {
    return {
      left: !!keys.ArrowLeft,
      right: !!keys.ArrowRight,
      jump: !!keys.ArrowUp,
    };
  }

  return {
    left: !!keys.KeyQ,
    right: !!keys.KeyD,
    jump: !!keys.KeyZ,
  };
}

function vxFromInput(input, moveSpeed) {
  if (input.left && !input.right) return -moveSpeed;
  if (input.right && !input.left) return moveSpeed;
  return 0;
}

export async function startGame(userConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  const canvas = findCanvas(config.canvasIds);
  if (!canvas) {
    throw new Error('Canvas introuvable.');
  }
  const ctx = canvas.getContext('2d');

  const socket = window.io ? window.io() : null;
  const { initPhysics } = await import(config.wasmImportPath);

  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  const netInputs = [
    { left: false, right: false, jump: false },
    { left: false, right: false, jump: false },
  ];
  const jumpLatch = [false, false];

  let myPlayerIndex = -1;
  let lastSent = '';
  let socketReady = false;

  if (socket) {
    socket.on('connect', () => {
      socketReady = true;
    });

    socket.on('disconnect', () => {
      socketReady = false;
      myPlayerIndex = -1;
    });

    socket.on('assign_player', ({ playerIndex }) => {
      myPlayerIndex = playerIndex;
      console.log('Tu es le joueur', playerIndex);
    });

    socket.on('input', ({ playerIndex, left, right, jump }) => {
      if (playerIndex < 0 || playerIndex > 1) return;
      netInputs[playerIndex] = { left: !!left, right: !!right, jump: !!jump };
    });

    socket.on('player_left', ({ playerIndex }) => {
      if (playerIndex < 0 || playerIndex > 1) return;
      netInputs[playerIndex] = { left: false, right: false, jump: false };
    });

    socket.on('room_full', () => {
      alert('Salle pleine (2 joueurs max).');
    });
  }

  const spriteRat = new Image();
  spriteRat.src = config.spritePath;

  const world = await initPhysics(config.gravity, config.floorY);

  for (const p of config.platforms) {
    world.add_platform(p.x, p.y, p.w, p.h);
  }

  const p0 = world.add_player(180, 120, config.playerWidth, config.playerHeight);
  const p1 = world.add_player(280, 120, config.playerWidth, config.playerHeight);
  const players = [p0, p1];

  const FIXED_DT = 1 / 60;
  let lastTime = performance.now();
  let accumulator = 0;

  function loop(now) {
    const frameDt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += frameDt;

    const networkMode = !!socket && socketReady && myPlayerIndex !== -1;

    if (networkMode) {
      const local = localInputFor(keys, myPlayerIndex);
      const signature = `${local.left}-${local.right}-${local.jump}`;
      if (signature !== lastSent) {
        socket.emit('input', local);
        lastSent = signature;
      }
      netInputs[myPlayerIndex] = local;
    } else {
      // Fallback local: evite un jeu "fige" si Socket.IO est charge
      // mais qu'aucune assignation reseau n'a encore eu lieu.
      netInputs[0] = localInputFor(keys, 0);
      netInputs[1] = localInputFor(keys, 1);
    }

    for (let i = 0; i < players.length; i += 1) {
      const input = netInputs[i];
      world.set_player_vx(players[i], vxFromInput(input, config.moveSpeed));

      if (input.jump && !jumpLatch[i]) {
        world.player_jump(players[i], config.jumpSpeed);
      }
      jumpLatch[i] = input.jump;
    }

    while (accumulator >= FIXED_DT) {
      world.step(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of config.platforms) {
      ctx.fillStyle = p.y >= config.floorY ? '#555' : '#8B4513';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    const drawPlayer = (id, fallbackColor) => {
      const x = world.get_player_x(id);
      const y = world.get_player_y(id);

      if (spriteRat.complete && spriteRat.naturalWidth > 0) {
        ctx.drawImage(spriteRat, x, y, config.playerWidth, config.playerHeight);
      } else {
        ctx.fillStyle = fallbackColor;
        ctx.fillRect(x, y, config.playerWidth, config.playerHeight);
      }
    };

    drawPlayer(p0, '#e74c3c');
    drawPlayer(p1, '#3498db');

    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.fillText('J0: Fleches | J1: Q/D/Z', 12, 20);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}
