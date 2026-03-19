const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Remplace le "./" par "../" pour remonter d'un dossier !
const { World } = require('../physics/pkg/physics.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../public')));

const LEVEL_WIDTH = 1000; 
const world = new World(1980.0, 850.0, LEVEL_WIDTH); 

// Tes plateformes (parfaitement identiques)
const platformsData = [
    { x: 0,   y: 800, w: LEVEL_WIDTH, h: 20, slope: 0 }, // 0
    { x: 50,  y: 650, w: 300, h: 15, slope: 0 }, // 1
    { x: 550, y: 650, w: 300, h: 15, slope: 0 }, // 2
    { x: 200, y: 500, w: 400, h: 15, slope: 0 }, // 3
    { x: 650, y: 500, w: 250, h: 15, slope: 0 }, // 4
    { x: 50,  y: 350, w: 250, h: 15, slope: 0 }, // 5
    { x: 350, y: 350, w: 450, h: 15, slope: 0 }, // 6
    { x: 150, y: 200, w: 350, h: 15, slope: 0 }, // 7
    { x: 550, y: 200, w: 300, h: 15, slope: 0 }, // 8
    { x: 300, y: 150, w: 400, h: 15, slope: 0 }  // 9 (Chef + Fromage)
];

platformsData.forEach(p => {
    world.add_platform(p.x, p.y, p.w, p.h, p.slope);
});

function getPlatY(index, targetX) {
    const p = platformsData[index];
    return p.y + (p.slope * ((targetX - p.x) / p.w));
}

// Tes 12 échelles, avec tes nouvelles positions X exactes !
const serverLadders = [
    { x: 100, w: 30, y_top: getPlatY(1, 100), y_bottom: getPlatY(0, 100) },
    { x: 710, w: 30, y_top: getPlatY(2, 710), y_bottom: getPlatY(0, 710) },
    { x: 250, w: 30, y_top: getPlatY(3, 250), y_bottom: getPlatY(1, 250) },
    { x: 560, w: 30, y_top: getPlatY(3, 560), y_bottom: getPlatY(2, 560) },
    { x: 740, w: 30, y_top: getPlatY(4, 740), y_bottom: getPlatY(2, 740) },
    { x: 210, w: 30, y_top: getPlatY(5, 210), y_bottom: getPlatY(3, 210) },
    { x: 450, w: 30, y_top: getPlatY(6, 450), y_bottom: getPlatY(3, 450) },
    { x: 680, w: 30, y_top: getPlatY(6, 680), y_bottom: getPlatY(4, 680) },
    { x: 180, w: 30, y_top: getPlatY(7, 180), y_bottom: getPlatY(5, 180) },
    { x: 650, w: 30, y_top: getPlatY(8, 650), y_bottom: getPlatY(6, 650) },
    { x: 350, w: 30, y_top: getPlatY(9, 350), y_bottom: getPlatY(7, 350) },
    { x: 600, w: 30, y_top: getPlatY(9, 600), y_bottom: getPlatY(8, 600) }
];

// Remplace l'ancienne boucle par celle-ci pour envoyer les 4 variables
serverLadders.forEach(lad => {
    world.add_ladder(lad.x, lad.w, lad.y_top, lad.y_bottom);
});

// ==========================================
// --- GESTION DES LEVIERS ---
// ==========================================
let leversData = [];
let cheeseActive = false;

function spawnLevers() {
    leversData = [];
    cheeseActive = false;
    const numLevers = Math.floor(Math.random() * 3) + 2; 
    const validPlatforms = [1, 2, 3, 4, 5, 6, 7, 8];
    validPlatforms.sort(() => 0.5 - Math.random());

    for (let i = 0; i < numLevers; i++) {
        const platIndex = validPlatforms[i];
        const plat = platformsData[platIndex];
        const randomX = plat.x + 20 + Math.random() * (plat.w - 40);
        leversData.push({ 
            id: `lever_${i}`, 
            x: randomX, 
            y: plat.y, 
            active: false 
        });
    }
    console.log(`🧀 Génération de ${numLevers} leviers aléatoires !`);
}

spawnLevers();

const players = {};
const playerWasmIds = {};
const MAX_PLAYERS = 4;

let gameConfig = { nbPlayers: 2, modeAmi: true, isStarted: false };
let tomatoes = [];
let knives = []; // <--- AJOUT : Nouveau tableau pour les missiles
let nextItemId = 1;

// --- BOUCLE DE SPAWN (Tomates + Missiles) ---
setInterval(() => {
    if (!gameConfig.isStarted || Object.keys(players).length === 0) return;

    // Gestion des Tomates (Pluie classique)
    if (tomatoes.length < 10) {
        const newTomato = {
            id: nextItemId++,
            x: Math.floor(Math.random() * 750) + 20,
            y: -10,
            speed: Math.floor(Math.random() * 3) + 2
        };
        tomatoes.push(newTomato);
        io.emit('newTomato', newTomato);
    }

    // Gestion des Missiles/Couteaux (Plus rares et plus rapides)
    if (Math.random() > 0.7 && knives.length < 3) {
        const newKnife = {
            id: nextItemId++,
            x: Math.floor(Math.random() * 900) + 50,
            y: -50,
            speed: 7 // Vitesse missile
        };
        knives.push(newKnife);
        io.emit('newKnife', newKnife); // Assure-toi d'écouter ça côté client
    }
}, 2000);

io.on('connection', (socket) => {
    console.log(`Nouveau rat connecté : ${socket.id}`);

    socket.on('login', (data) => {
        if (Object.keys(players).length >= gameConfig.nbPlayers) {
            socket.emit('loginFailed', `La cuisine est pleine ! Limitée à ${gameConfig.nbPlayers} rats.`);
            return;
        }

        const isChef = Object.keys(players).length === 0;
        const spawnX = 80 + (Object.keys(players).length * 40);
        const wasmId = world.add_player(spawnX, 600, 30, 30); 
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
        socket.emit('configUpdated', gameConfig);
        socket.emit('currentTomatoes', tomatoes);
        socket.emit('gameState', { levers: leversData, cheeseActive });
        io.emit('currentPlayers', players);
    });
    
    socket.on('updateConfig', (newConfig) => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            if (newConfig.nbPlayers === 2 && Object.keys(players).length > 2) return; 
            gameConfig = { ...gameConfig, ...newConfig };
            io.emit('configUpdated', gameConfig);
        }
    });

    socket.on('requestStart', () => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            gameConfig.isStarted = true;
            spawnLevers(); 
            io.emit('gameStarted', gameConfig);
            io.emit('gameState', { levers: leversData, cheeseActive });
        }
    });

    socket.on('interact', () => {
        const p = players[socket.id];
        let wasmId = playerWasmIds[socket.id];
        if (!p || wasmId === undefined) return;
        const px = world.get_player_x(wasmId);
        const py = world.get_player_y(wasmId);
        let stateChanged = false;

        leversData.forEach(lev => {
            if (Math.abs(px - lev.x) < 50 && Math.abs(py - lev.y) < 50) {
                lev.active = !lev.active;
                stateChanged = true;
            }
        });

        if (stateChanged) {
            cheeseActive = leversData.every(l => l.active);
            io.emit('gameState', { levers: leversData, cheeseActive });
        }
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
            if (world.set_player_dropping) world.set_player_dropping(wasmId, data.vy > 0);
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
                knives = [];
            } else if (wasAdmin) {
                players[Object.keys(players)[0]].isAdmin = true;
            }
            io.emit('playerDisconnected', socket.id);
            io.emit('currentPlayers', players);
        }
    });
});

// --- BOUCLE PRINCIPALE (60 FPS) ---
setInterval(() => {
    if (!gameConfig.isStarted) return;

    for (let socketId in players) {
        const player = players[socketId];
        const wasmId = player.wasmId;
        const px = world.get_player_x(wasmId);
        const py = world.get_player_y(wasmId);
        const onGround = world.get_player_on_ground(wasmId); 
        
        player.isOverLadder = false;
        for(const lad of serverLadders) {
            if (Math.abs(px - lad.x) <= 10 && py > lad.y_top - 30 && py < lad.y_bottom) {   
                player.isOverLadder = true;
                break;
            }
        }

        if (player.isOverLadder && world.set_player_vy) {
            world.set_player_vy(wasmId, player.vy_input);
        }

        if (cheeseActive && onGround) {
            if (px > 460 && px < 560 && Math.abs(py - 120) < 5) {
                io.emit('gameWon', player.pseudo); 
                gameConfig.isStarted = false; 
                tomatoes = []; 
                knives = [];
                return; 
            }
        }
    }

    world.step(1 / 60);

    // --- GESTION DES COLLISIONS (TOMATES & COUTEAUX) ---
    const allProjectiles = [
        { list: tomatoes, name: 'tomate', event: 'removeTomato' },
        { list: knives, name: 'couteau', event: 'removeKnife' }
    ];

    allProjectiles.forEach(proj => {
        for (let i = proj.list.length - 1; i >= 0; i--) {
            let item = proj.list[i];
            item.y += item.speed;

            let isHit = false;
            for (let socketId in players) {
                let p = players[socketId];
                let pX = world.get_player_x(p.wasmId);
                let pY = world.get_player_y(p.wasmId);

                // Hitbox simplifiée
                if (Math.abs(item.x - (pX + 15)) < 30 && Math.abs(item.y - (pY + 15)) < 30) {
                    isHit = true;
                    break;
                }
            }

            if (isHit) {
                gameConfig.isStarted = false;
                tomatoes = []; knives = [];
                io.emit('gameOver');
                return; 
            }

            if (item.y >= 850) {
                io.emit(proj.event, item.id);
                proj.list.splice(i, 1);
            }
        }
    });

    // --- BROADCAST ÉTAT DU MONDE ---
    const stateToBroadcast = { 
        players: {},
        tomatoes: tomatoes, // On ajoute les tomates ici
        knives: knives      // On ajoute les couteaux ici
    };

    for (let socketId in players) {
        let wasmId = playerWasmIds[socketId];
        let player = players[socketId];
        let onGround = world.get_player_on_ground(wasmId);
        stateToBroadcast.players[socketId] = {
            id: socketId,
            x: world.get_player_x(wasmId),
            y: world.get_player_y(wasmId),
            pseudo: player.pseudo, 
            color: player.color,
            direction: player.direction, 
            isMoving: onGround && Math.abs(player.vx) > 0,
            isClimbing: player.isOverLadder && (!onGround || Math.abs(player.vy_input) > 0),
            on_ground: onGround
        };
    }
    io.emit('worldState', stateToBroadcast);

}, 1000 / 60);

const PORT = process.env.PORT || 3050;
server.listen(PORT, () => {
    console.log(`Serveur Multi opérationnel sur http://localhost:${PORT}`);
});