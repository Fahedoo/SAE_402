const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { World } = require('./pkg/physics.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'public')));

const MAX_PLAYERS = 4;
const GRAVITY = 1980.0;
const FLOOR_Y = 580.0;
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 50;
const MOVE_SPEED = 220;
const JUMP_SPEED = 450;
const FIXED_DT = 1 / 60;
const SNAPSHOT_HZ = 30;

const PLATFORMS = [
  { x: 100, y: 420, w: 220, h: 15 },
  { x: 420, y: 300, w: 240, h: 15 },
  { x: 0, y: 580, w: 1000, h: 20 },
];

const slots = Array(MAX_PLAYERS).fill(null);
const playerStates = Array.from({ length: MAX_PLAYERS }, () => ({
  connected: false,
  x: 0,
  y: 0,
  onGround: false,
  updatedAt: 0,
}));
const playerInputs = Array.from({ length: MAX_PLAYERS }, () => ({
  left: false,
  right: false,
  jump: false,
  lastJump: false,
}));

let world = null;
let slotToWorldId = Array(MAX_PLAYERS).fill(-1);

function spawnForIndex(index) {
  return {
    x: 120 + index * 120,
    y: 120,
  };
}

function allocateSlot(socketId) {
  for (let i = 0; i < slots.length; i += 1) {
    if (slots[i] === null) {
      slots[i] = socketId;
      return i;
    }
  }
  return -1;
}

function freeSlot(socketId) {
  const idx = slots.indexOf(socketId);
  if (idx !== -1) {
    slots[idx] = null;
  }
  return idx;
}

function emitPlayersState() {
  io.emit('players_state', {
    connected: slots.map((s) => s !== null),
  });
}

function buildWorld() {
  world = new World(GRAVITY, FLOOR_Y);
  slotToWorldId = Array(MAX_PLAYERS).fill(-1);

  for (const p of PLATFORMS) {
    world.add_platform(p.x, p.y, p.w, p.h);
  }

  for (let i = 0; i < MAX_PLAYERS; i += 1) {
    if (!playerStates[i].connected) continue;

    const start = Number.isFinite(playerStates[i].x) && Number.isFinite(playerStates[i].y)
      ? { x: playerStates[i].x, y: playerStates[i].y }
      : spawnForIndex(i);

    const worldId = world.add_player(start.x, start.y, PLAYER_WIDTH, PLAYER_HEIGHT);
    slotToWorldId[i] = worldId;
  }
}

function inputToVx(input) {
  if (input.left && !input.right) return -MOVE_SPEED;
  if (input.right && !input.left) return MOVE_SPEED;
  return 0;
}

function stepWorld() {
  if (!world) return;

  for (let i = 0; i < MAX_PLAYERS; i += 1) {
    if (!playerStates[i].connected) continue;

    const worldId = slotToWorldId[i];
    if (worldId < 0) continue;

    const input = playerInputs[i];
    world.set_player_vx(worldId, inputToVx(input));

    if (input.jump && !input.lastJump) {
      world.player_jump(worldId, JUMP_SPEED);
    }

    input.lastJump = input.jump;
  }

  world.step(FIXED_DT);

  for (let i = 0; i < MAX_PLAYERS; i += 1) {
    if (!playerStates[i].connected) continue;

    const worldId = slotToWorldId[i];
    if (worldId < 0) continue;

    playerStates[i].x = world.get_player_x(worldId);
    playerStates[i].y = world.get_player_y(worldId);
    playerStates[i].onGround = world.get_player_on_ground(worldId);
    playerStates[i].updatedAt = Date.now();
  }
}

buildWorld();

io.on('connection', (socket) => {
  const playerIndex = allocateSlot(socket.id);

  if (playerIndex === -1) {
    socket.emit('room_full');
    socket.disconnect(true);
    return;
  }

  const spawn = spawnForIndex(playerIndex);
  playerStates[playerIndex] = {
    connected: true,
    x: spawn.x,
    y: spawn.y,
    onGround: false,
    updatedAt: Date.now(),
  };
  playerInputs[playerIndex] = {
    left: false,
    right: false,
    jump: false,
    lastJump: false,
  };

  buildWorld();

  socket.emit('assign_player', {
    playerIndex,
    maxPlayers: MAX_PLAYERS,
    spawn,
  });

  emitPlayersState();

  socket.on('player_input', (payload = {}) => {
    if (playerIndex < 0 || playerIndex >= MAX_PLAYERS) return;
    if (!playerStates[playerIndex].connected) return;

    playerInputs[playerIndex].left = !!payload.left;
    playerInputs[playerIndex].right = !!payload.right;
    playerInputs[playerIndex].jump = !!payload.jump;
  });

  socket.on('disconnect', () => {
    const leftIndex = freeSlot(socket.id);
    if (leftIndex !== -1) {
      playerStates[leftIndex] = {
        connected: false,
        x: 0,
        y: 0,
        onGround: false,
        updatedAt: 0,
      };
      playerInputs[leftIndex] = {
        left: false,
        right: false,
        jump: false,
        lastJump: false,
      };
      buildWorld();
      io.emit('player_left', { playerIndex: leftIndex });
      emitPlayersState();
    }
  });
});

// Tick physique autoritaire serveur
setInterval(() => {
  stepWorld();
}, Math.round(1000 * FIXED_DT));

// Snapshot serveur vers tous les clients (20 Hz)
setInterval(() => {
  io.emit('state_snapshot', {
    serverTime: Date.now(),
    players: playerStates,
  });
}, Math.round(1000 / SNAPSHOT_HZ));

const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('Serveur LAN: http://' + HOST + ':' + PORT);
});