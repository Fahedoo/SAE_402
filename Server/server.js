const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir les fichiers statiques depuis public/
app.use(express.static(path.join(__dirname, '..', 'public')));

const slots = [null, null]; // slot 0 et slot 1

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
  if (idx !== -1) slots[idx] = null;
  return idx;
}

io.on('connection', (socket) => {
  const playerIndex = allocateSlot(socket.id);

  if (playerIndex === -1) {
    socket.emit('room_full');
    socket.disconnect(true);
    return;
  }

  socket.emit('assign_player', { playerIndex });
  io.emit('players_state', { connected: slots.map((s) => s !== null) });

  socket.on('input', (payload) => {
    io.emit('input', {
      playerIndex,
      left: !!payload.left,
      right: !!payload.right,
      jump: !!payload.jump,
    });
  });

  socket.on('disconnect', () => {
    const leftIndex = freeSlot(socket.id);
    if (leftIndex !== -1) {
      io.emit('player_left', { playerIndex: leftIndex });
      io.emit('players_state', { connected: slots.map((s) => s !== null) });
    }
  });
});

const PORT = 3030;
server.listen(PORT, () => {
  console.log(`Serveur lance sur http://localhost:${PORT}`);
});