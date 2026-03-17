const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// 1. IMPORT DU WASM DE FAHED
const { World } = require('./pkg/physics');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURATION DES DOSSIERS ---
app.use(express.static(path.join(__dirname, '../Public')));

// 2. INITIALISATION DE L'UNIVERS PHYSIQUE WASM
// ⚠️ CORRECTION MAJEURE : Le sol du Wasm est abaissé à 850 (le canvas fait 900 de haut)
const world = new World(1980.0, 850.0); 

// --- AJOUT DES PLATEFORMES (Alignées sur le Canvas de Selma) ---
const LEVEL_WIDTH = 900; 
function addWasmSlope(start_x, start_y, width, thickness, slope) {
    // On simule les pentes par des plateformes plates au milieu de la pente
    const midY = start_y + (slope / 2);
    world.add_platform(start_x, midY, width, thickness);
}

addWasmSlope(42, 800, LEVEL_WIDTH - 81, 18, -50); // Bas (0)
addWasmSlope(42, 620, LEVEL_WIDTH - 254, 18, 45); // Étage 2 (1)
addWasmSlope(109, 520, LEVEL_WIDTH - 149, 18, -50); // Étage 3 (2)
addWasmSlope(42, 353, LEVEL_WIDTH - 145, 18, 50); // Étage 4 (3)
addWasmSlope(42, 275, LEVEL_WIDTH - 83, 18, -65); // Étage 5 (4)
addWasmSlope(63, 125, LEVEL_WIDTH - 228, 18, 30); // Sommet Chef (5)
world.add_platform(300, 70, 170, 18); // Le fromage ! (6) - Plateforme plate

// --- DÉFINITION DES ÉCHELLES DE SELMA ---
const serverLadders = [
    { x: 600, w: 30, y_top: 659, y_bottom: 768 }, 
    { x: 150, w: 30, y_top: 507, y_bottom: 631 }, 
    { x: 650, w: 30, y_top: 386, y_bottom: 483 }, 
    { x: 100, w: 30, y_top: 285, y_bottom: 360 }, // Échelle 4
    { x: 600, w: 30, y_top: 130, y_bottom: 226 }, // Échelle 5
    { x: 420, w: 30, y_top: 70, y_bottom: 125 }   // Échelle Fromage
];

// --- ÉTAT DU SERVEUR ---
const players = {};
const playerWasmIds = {};
const MAX_PLAYERS = 4;

let gameConfig = { nbPlayers: 2, modeAmi: true, isStarted: false };
let tomatoes = [];
let nextTomatoId = 1;
let levers = { lever1: false, lever2: false };

// --- GÉNÉRATION DES TOMATES ---
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

// --- GESTION DES CONNEXIONS ---
io.on('connection', (socket) => {
    console.log(`Nouveau rat connecté : ${socket.id}`);

    socket.on('login', (data) => {
        if (Object.keys(players).length >= MAX_PLAYERS) {
            socket.emit('loginFailed', 'La cuisine est pleine ! (4 rats max)');
            return;
        }

        const isChef = Object.keys(players).length === 0;
        
        // ⚠️ CORRECTION SPAWN : On fait spawner le joueur tout en bas (X: 100, Y: 750)
        const wasmId = world.add_player(100, 750, 30, 30); 
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

    // --- GAMEPLAY : RÉCEPTION DES INPUTS ---
    socket.on('playerInput', (data) => {
        let wasmId = playerWasmIds[socket.id];
        let player = players[socket.id];
        if (wasmId === undefined || !player) return;

        if (data.action === 'move') {
            world.set_player_vx(wasmId, data.vx); 
            player.vx = data.vx; 
            
            // Mise à jour direction
            if (data.vx > 0) player.direction = 1;
            else if (data.vx < 0) player.direction = -1;

        } else if (data.action === 'move_v') {
            player.vy_input = data.vy; // Grimpe

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

// --- LE CŒUR BATTANT DU JEU (Boucle 60 FPS) ---
setInterval(() => {
    if (!gameConfig.isStarted) return;

    // 1. Logique des échelles (Avant la physique)
    for (let socketId in players) {
        const player = players[socketId];
        const wasmId = player.wasmId;
        const px = world.get_player_x(wasmId);
        const py = world.get_player_y(wasmId);
        
        player.isOverLadder = false;
        for(const lad of serverLadders) {
            // Tolérance X pour attraper l'échelle (px + 15 / px - 15)
            if (px + 15 > lad.x && px - 15 < lad.x + lad.w && py > lad.y_top - 30 && py < lad.y_bottom) {   
                player.isOverLadder = true;
                break;
            }
        }

        // GRIMPE ! Utilise la fonction de Fahed
        if (player.isOverLadder && world.set_player_vy) {
            world.set_player_vy(wasmId, player.vy_input);
        }
    }

    // 2. Physique Wasm
    world.step(1 / 60);

    // 3. Tomates (On détruit les tomates plus bas car le sol est à 850)
    if (tomatoes.length > 0) {
        for (let i = tomatoes.length - 1; i >= 0; i--) {
            tomatoes[i].y += tomatoes[i].speed;
            if (tomatoes[i].y >= 850) {
                io.emit('removeTomato', tomatoes[i].id);
                tomatoes.splice(i, 1);
            }
        }
    }

    // 4. Préparation des données pour Selma
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