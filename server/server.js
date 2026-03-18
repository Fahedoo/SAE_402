const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { World } = require('./pkg/physics');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../Public')));

const world = new World(1980.0, 850.0); 

const LEVEL_WIDTH = 900; 
// ⚠️ On envoie maintenant le "slope" direct au Wasm de Fahed !
const platformsData = [
    { x: 42,   y: 800, w: LEVEL_WIDTH-81, h: 18, slope: -50 }, // Bas (0)
    { x: 42,   y: 620, w: LEVEL_WIDTH-254, h: 18, slope: 45  }, // Étage 2 (1)
    { x: 109,  y: 520, w: LEVEL_WIDTH-149, h: 18, slope: -50 }, // Étage 3 (2)
    { x: 42,   y: 353, w: LEVEL_WIDTH-145, h: 18, slope: 50  }, // Étage 4 (3)
    { x: 42,   y: 275, w: LEVEL_WIDTH-83, h: 18, slope: -65  }, // Étage 5 (4)
    { x: 63,   y: 125, w: LEVEL_WIDTH - 228, h: 18, slope: 30 }, // Sommet Chef (5)
    { x: 300,  y: 70,  w: 170, h: 18, slope: 0 } // Le fromage ! (6)
];

// Initialisation des plateformes physiques
platformsData.forEach(p => {
    world.add_platform(p.x, p.y, p.w, p.h, p.slope);
});

// ⚠️ La Mathématique Ultime : Le serveur calcule la hauteur parfaite de l'échelle !
function getPlatY(index, targetX) {
    const p = platformsData[index];
    return p.y + (p.slope * ((targetX - p.x) / p.w));
}

const serverLadders = [
    { x: 600, w: 30, y_top: getPlatY(1, 600), y_bottom: getPlatY(0, 600) },
    { x: 150, w: 30, y_top: getPlatY(2, 150), y_bottom: getPlatY(1, 150) },
    { x: 650, w: 30, y_top: getPlatY(3, 650), y_bottom: getPlatY(2, 650) },
    { x: 100, w: 30, y_top: getPlatY(4, 100), y_bottom: getPlatY(3, 100) },
    { x: 600, w: 30, y_top: getPlatY(5, 600), y_bottom: getPlatY(4, 600) },
    { x: 420, w: 30, y_top: getPlatY(6, 420), y_bottom: getPlatY(5, 420) } 
];

const players = {};
const playerWasmIds = {};
const MAX_PLAYERS = 4;

let gameConfig = { nbPlayers: 2, modeAmi: true, isStarted: false };
let tomatoes = [];
let nextTomatoId = 1;
let levers = { lever1: false, lever2: false };

setInterval(() => {
    if (!gameConfig.isStarted || Object.keys(players).length === 0) return;
    if (tomatoes.length >= 10) return; 

    const newTomato = {
        id: nextTomatoId++,
        x: Math.floor(Math.random() * 750) + 20,
        y: -10,
        speed: Math.floor(Math.random() * 3) + 2
    };

    tomatoes.push(newTomato);
    io.emit('newTomato', newTomato);
}, 2000);

io.on('connection', (socket) => {
    console.log(`Nouveau rat connecté : ${socket.id}`);

    socket.on('login', (data) => {
        if (Object.keys(players).length >= MAX_PLAYERS) {
            socket.emit('loginFailed', 'La cuisine est pleine ! (4 rats max)');
            return;
        }

        const isChef = Object.keys(players).length === 0;
        
        // Spawn décalé en l'air
        const spawnX = 80 + (Object.keys(players).length * 40);
        const wasmId = world.add_player(spawnX, 500, 30, 30); 
        playerWasmIds[socket.id] = wasmId;

        players[socket.id] = {
            id: socket.id,
            pseudo: data.pseudo || 'Anonyme',
            color: data.color || 'gray',
            isAdmin: isChef,
            wasmId: wasmId,
            direction: 1, 
            vx: 0,
            vy_input: 0,
            isOverLadder: false
        };

        socket.emit('loginSuccess', players[socket.id]);
        socket.emit('currentPlayers', players);
        socket.emit('configUpdated', gameConfig);
        socket.emit('currentTomatoes', tomatoes);
        socket.emit('currentLevers', levers);

        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    socket.on('updateConfig', (newConfig) => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            gameConfig = { ...gameConfig, ...newConfig };
            socket.broadcast.emit('configUpdated', gameConfig);
        }
    });

    socket.on('requestStart', () => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            gameConfig.isStarted = true;
            io.emit('gameStarted', gameConfig);
        }
    });

    socket.on('toggleLever', (leverId) => {
        if (!players[socket.id] || levers[leverId] === undefined) return;
        levers[leverId] = !levers[leverId]; 
        io.emit('leverStateChanged', { leverId, state: levers[leverId] });
    });

    socket.on('playerInput', (data) => {
        let wasmId = playerWasmIds[socket.id];
        let player = players[socket.id];
        if (wasmId === undefined || !player) return;

        if (data.action === 'move') {
            world.set_player_vx(wasmId, data.vx); 
            player.vx = data.vx; 
            if (data.vx > 0) player.direction = 1;
            else if (data.vx < 0) player.direction = -1;
        } else if (data.action === 'move_v') {
            player.vy_input = data.vy; 
        } else if (data.action === 'jump') {
            world.player_jump(wasmId, 450); 
        }
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            const wasAdmin = players[socket.id].isAdmin;
            delete players[socket.id];
            delete playerWasmIds[socket.id]; 

            if (Object.keys(players).length === 0) {
                gameConfig.isStarted = false;
                tomatoes = []; 
            } else if (wasAdmin) {
                players[Object.keys(players)[0]].isAdmin = true;
            }

            io.emit('playerDisconnected', socket.id);
            io.emit('currentPlayers', players);
        }
    });
});

setInterval(() => {
    if (!gameConfig.isStarted) return;

    for (let socketId in players) {
        const player = players[socketId];
        const wasmId = player.wasmId;
        const px = world.get_player_x(wasmId);
        const py = world.get_player_y(wasmId);
        
        player.isOverLadder = false;
        for(const lad of serverLadders) {
            if (px + 15 > lad.x && px - 15 < lad.x + lad.w && py > lad.y_top - 30 && py < lad.y_bottom) {   
                player.isOverLadder = true;
                break;
            }
        }

        if (player.isOverLadder && world.set_player_vy) {
            world.set_player_vy(wasmId, player.vy_input);
        }
    }

    world.step(1 / 60);

    if (tomatoes.length > 0) {
        for (let i = tomatoes.length - 1; i >= 0; i--) {
            tomatoes[i].y += tomatoes[i].speed;
            if (tomatoes[i].y >= 850) {
                io.emit('removeTomato', tomatoes[i].id);
                tomatoes.splice(i, 1);
            }
        }
    }

    const stateToBroadcast = { players: {} };

    for (let socketId in players) {
        let wasmId = playerWasmIds[socketId];
        let player = players[socketId];
        
        let isMovingAnimation = (world.get_player_on_ground(wasmId) && Math.abs(player.vx) > 0) 
                             || (player.isOverLadder && Math.abs(player.vy_input) > 0);

        stateToBroadcast.players[socketId] = {
            id: socketId,
            x: world.get_player_x(wasmId),
            y: world.get_player_y(wasmId),
            pseudo: player.pseudo, 
            color: player.color,
            direction: player.direction, 
            isMoving: isMovingAnimation
        };
    }

    io.emit('worldState', stateToBroadcast);

}, 1000 / 60);

const PORT = process.env.PORT || 3020;
server.listen(PORT, () => {
    console.log(`Serveur Multi (Wasm Hardcore) opérationnel sur http://localhost:${PORT}`);
});