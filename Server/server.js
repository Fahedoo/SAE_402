const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir les fichiers du dossier public
app.use(express.static(path.join(__dirname, '../public')));
// Exposer explicitement les assets
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

const players = {};
const MAX_PLAYERS = 4;

let tomatoes = [];
let nextTomatoId = 1;
let levers = { lever1: false, lever2: false };

// --- GÉNÉRATION DE TOMATES ---
setInterval(() => {
    if (Object.keys(players).length === 0 || tomatoes.length >= 10) return;

    const newTomato = {
        id: nextTomatoId++,
        x: Math.floor(Math.random() * 750) + 20,
        y: -10,
        speed: Math.floor(Math.random() * 3) + 2
    };

    tomatoes.push(newTomato);
    io.emit('newTomato', newTomato);
}, 2000);

// --- PHYSIQUE DES TOMATES (60 FPS) ---
setInterval(() => {
    if (tomatoes.length === 0) return;
    for (let i = tomatoes.length - 1; i >= 0; i--) {
        tomatoes[i].y += tomatoes[i].speed;
        if (tomatoes[i].y >= 530) {
            io.emit('removeTomato', tomatoes[i].id);
            tomatoes.splice(i, 1);
        }
    }
}, 1000 / 60);

io.on('connection', (socket) => {
    console.log(`Nouveau client connecté : ${socket.id}`);

    socket.on('login', (data) => {
        if (Object.keys(players).length >= MAX_PLAYERS) {
            socket.emit('loginFailed', 'Serveur plein.');
            return;
        }

        players[socket.id] = {
            id: socket.id,
            pseudo: data.pseudo || 'Anonyme',
            color: data.color || 'gris',
            x: 100,
            y: 500
        };

        socket.emit('loginSuccess', players[socket.id]);
        socket.emit('currentPlayers', players);
        socket.emit('currentTomatoes', tomatoes);
        socket.emit('currentLevers', levers);
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    socket.on('toggleLever', (leverId) => {
        if (levers[leverId] !== undefined) {
            levers[leverId] = !levers[leverId];
            io.emit('leverStateChanged', { leverId, state: levers[leverId] });
        }
    });

    socket.on('playerMovement', (movementData) => {
        if (!players[socket.id]) return;
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            x: movementData.x,
            y: movementData.y
        });
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            delete players[socket.id];
            io.emit('playerDisconnected', socket.id);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Serveur Chef's Rage opérationnel sur http://localhost:${PORT}`);
});