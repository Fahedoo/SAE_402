const DEFAULT_CONFIG = {
  wasmImportPath: '/wasm.js',
  spritePath: null,
  canvasIds: ['game', 'ecranDeJeu'],
  gravity: 1980.0,
  floorY: 580.0,
  playerWidth: 50,
  playerHeight: 50,
  moveSpeed: 220,
  jumpSpeed: 450,
  maxPlayers: 4,
  spawnStartX: 120,
  spawnGapX: 120,
  spawnY: 120,
  sendRateHz: 30,
  renderSmoothing: 18,
  localRenderSmoothing: 28,
  localLeadSeconds: 0.06,
  socketOptions: {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 300,
    timeout: 10000,
  },
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

function spawnForIndex(config, index) {
  return {
    x: config.spawnStartX + index * config.spawnGapX,
    y: config.spawnY,
  };
}

function localInputFor(keys) {
  return {
    left: !!keys.ArrowLeft || !!keys.KeyQ || !!keys.KeyA,
    right: !!keys.ArrowRight || !!keys.KeyD,
    jump: !!keys.ArrowUp || !!keys.KeyZ || !!keys.KeyW || !!keys.Space,
  };
}

function vxFromInput(input, moveSpeed) {
  if (input.left && !input.right) return -moveSpeed;
  if (input.right && !input.left) return moveSpeed;
  return 0;
}

function smoothToward(current, target, dt, smoothingHz) {
  const t = 1 - Math.exp(-Math.max(0, smoothingHz) * Math.max(0, dt));
  return current + (target - current) * t;
}

function ensureArrayLength(arr, len, factory) {
  const out = arr.slice(0, len);
  while (out.length < len) out.push(factory(out.length));
  return out;
}

export async function startGame(userConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  const canvas = findCanvas(config.canvasIds);
  if (!canvas) throw new Error('Canvas introuvable.');
  const ctx = canvas.getContext('2d');

  const socket = window.io ? window.io(config.socketOptions) : null;

  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  let maxPlayers = config.maxPlayers;
  let myPlayerIndex = 0;
  let socketReady = false;
  let assigned = false;

  let connectedPlayers = Array(maxPlayers).fill(false);
  connectedPlayers[0] = true;

  let remotePlayers = Array.from({ length: maxPlayers }, (_, i) => {
    const s = spawnForIndex(config, i);
    return {
      x: s.x,
      y: s.y,
      renderX: s.x,
      renderY: s.y,
      connected: false,
    };
  });

  let assignedSpawn = spawnForIndex(config, 0);

  function resizeNetworkArrays(nextMax) {
    maxPlayers = nextMax;
    connectedPlayers = ensureArrayLength(connectedPlayers, maxPlayers, () => false);

    remotePlayers = ensureArrayLength(
      remotePlayers,
      maxPlayers,
      (i) => {
        const s = spawnForIndex(config, i);
        return {
          x: s.x,
          y: s.y,
          renderX: s.x,
          renderY: s.y,
          connected: false,
        };
      }
    );
  }

  let resolveAssignment = null;
  const assignmentPromise = new Promise((resolve) => {
    resolveAssignment = resolve;
  });

  if (socket) {
    socket.on('connect', () => {
      socketReady = true;
    });

    socket.on('disconnect', () => {
      socketReady = false;
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connect_error:', err && err.message ? err.message : err);
    });

    socket.on('assign_player', ({ playerIndex, maxPlayers: mp, spawn }) => {
      if (Number.isInteger(mp) && mp > 0 && mp !== maxPlayers) {
        resizeNetworkArrays(mp);
      }

      if (Number.isInteger(playerIndex) && playerIndex >= 0 && playerIndex < maxPlayers) {
        myPlayerIndex = playerIndex;
      }

      if (spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.y)) {
        assignedSpawn = { x: spawn.x, y: spawn.y };
      } else {
        assignedSpawn = spawnForIndex(config, myPlayerIndex);
      }

      connectedPlayers[myPlayerIndex] = true;
      remotePlayers[myPlayerIndex].connected = true;
      remotePlayers[myPlayerIndex].x = assignedSpawn.x;
      remotePlayers[myPlayerIndex].y = assignedSpawn.y;
      remotePlayers[myPlayerIndex].renderX = assignedSpawn.x;
      remotePlayers[myPlayerIndex].renderY = assignedSpawn.y;
      assigned = true;
      console.log('Tu es le joueur', myPlayerIndex);

      if (resolveAssignment) {
        resolveAssignment();
        resolveAssignment = null;
      }
    });

    socket.on('players_state', ({ connected }) => {
      if (!Array.isArray(connected)) return;
      connectedPlayers = connected.slice(0, maxPlayers);
      while (connectedPlayers.length < maxPlayers) connectedPlayers.push(false);
    });

    socket.on('player_left', ({ playerIndex }) => {
      if (!Number.isInteger(playerIndex)) return;
      if (playerIndex < 0 || playerIndex >= maxPlayers) return;
      connectedPlayers[playerIndex] = false;
      remotePlayers[playerIndex].connected = false;
    });

    socket.on('state_snapshot', (snap) => {
      if (!snap || !Array.isArray(snap.players)) return;

      const snapPlayers = snap.players.slice(0, maxPlayers);

      for (let i = 0; i < snapPlayers.length; i += 1) {
        const p = snapPlayers[i];
        if (!p) continue;

        if (!p.connected) {
          connectedPlayers[i] = false;
          remotePlayers[i].connected = false;
          continue;
        }

        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;

        connectedPlayers[i] = true;
        remotePlayers[i].connected = true;
        remotePlayers[i].x = p.x;
        remotePlayers[i].y = p.y;
      }
    });
  }

  // On attend un peu lassignation serveur avant de creer le joueur local
  await Promise.race([
    assignmentPromise,
    new Promise((resolve) => setTimeout(resolve, 1200)),
  ]);

  if (!assigned) {
    myPlayerIndex = 0;
    connectedPlayers[0] = true;
    assignedSpawn = spawnForIndex(config, 0);
    remotePlayers[0].connected = true;
    remotePlayers[0].x = assignedSpawn.x;
    remotePlayers[0].y = assignedSpawn.y;
    remotePlayers[0].renderX = assignedSpawn.x;
    remotePlayers[0].renderY = assignedSpawn.y;
    console.warn('Aucune assignation recue, fallback local active.');
  }

  const spriteRat = new Image();
  if (config.spritePath) spriteRat.src = config.spritePath;

  let lastTime = performance.now();

  let sendAccumulator = 0;
  const sendInterval = 1 / Math.max(1, config.sendRateHz);

  function drawPlayerAt(x, y, color) {
    if (config.spritePath && spriteRat.complete && spriteRat.naturalWidth > 0) {
      ctx.drawImage(spriteRat, x, y, config.playerWidth, config.playerHeight);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, config.playerWidth, config.playerHeight);
    }
  }

  function loop(now) {
    const frameDt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    sendAccumulator += frameDt;

    const input = localInputFor(keys);

    if (socket && socketReady && sendAccumulator >= sendInterval) {
      sendAccumulator = 0;
      socket.emit('player_input', {
        left: input.left,
        right: input.right,
        jump: input.jump,
      });
    }

    // Rendue
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of config.platforms) {
      ctx.fillStyle = p.y >= config.floorY ? '#555' : '#8B4513';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    // Tous les joueurs (etat autoritaire serveur)
    for (let i = 0; i < maxPlayers; i += 1) {
      if (!connectedPlayers[i]) continue;
      if (!remotePlayers[i].connected) continue;

      const isLocal = i === myPlayerIndex;
      const targetX = isLocal
        ? remotePlayers[i].x + vxFromInput(input, config.moveSpeed) * config.localLeadSeconds
        : remotePlayers[i].x;
      const targetY = remotePlayers[i].y;
      const smoothing = isLocal ? config.localRenderSmoothing : config.renderSmoothing;

      remotePlayers[i].renderX = smoothToward(remotePlayers[i].renderX, targetX, frameDt, smoothing);
      remotePlayers[i].renderY = smoothToward(remotePlayers[i].renderY, targetY, frameDt, smoothing);

      drawPlayerAt(
        remotePlayers[i].renderX,
        remotePlayers[i].renderY,
        isLocal ? '#2ecc71' : '#3498db'
      );
    }

    // HUD
    const connectedCount = connectedPlayers.filter(Boolean).length;
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.fillText(
      'Moi: ' + myPlayerIndex + ' | Connectes: ' + connectedCount + '/' + maxPlayers +
      ' | Socket: ' + (socketReady ? 'OK' : 'OFF'),
      12,
      20
    );

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}