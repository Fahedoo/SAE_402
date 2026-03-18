const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Remplace le "./" par "../" pour remonter d'un dossier !
const { World } = require('../physics/pkg/physics.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../Public')));

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
// --- GESTION DES LEVIERS (Générés par le serveur) ---
// ==========================================
let leversData = [];
let cheeseActive = false;

function spawnLevers() {
    leversData = [];
    cheeseActive = false;
    
    // Entre 2 et 4 leviers
    const numLevers = Math.floor(Math.random() * 3) + 2; 
    
    // Index des plateformes valides (on exclut 0:Sol et 9:Fromage)
    const validPlatforms = [1, 2, 3, 4, 5, 6, 7, 8];

    // On mélange les plateformes pour ne pas toujours avoir les mêmes
    validPlatforms.sort(() => 0.5 - Math.random());

    for (let i = 0; i < numLevers; i++) {
        const platIndex = validPlatforms[i];
        const plat = platformsData[platIndex];
        
        // Choisir un X aléatoire sur cette plateforme (marge de 20px)
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

// Génération initiale
spawnLevers();

const players = {};
const playerWasmIds = {};
const MAX_PLAYERS = 4;

let gameConfig = { nbPlayers: 2, modeAmi: true, isStarted: false };
let tomatoes = [];
let nextTomatoId = 1;


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
        
        // Envoi des leviers et du statut du fromage au nouveau connecté
        socket.emit('gameState', { levers: leversData, cheeseActive });

        io.emit('currentPlayers', players);
    });
    
    socket.on('updateConfig', (newConfig) => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            if (newConfig.nbPlayers === 2 && Object.keys(players).length > 2) {
                return; 
            }
            gameConfig = { ...gameConfig, ...newConfig };
            io.emit('configUpdated', gameConfig);
        }
    });

    socket.on('requestStart', () => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            gameConfig.isStarted = true;
            // Quand on lance la partie, on régénère de nouveaux leviers
            spawnLevers(); 
            io.emit('gameStarted', gameConfig);
            io.emit('gameState', { levers: leversData, cheeseActive });
        }
    });

    // ==========================================
    // --- NOUVELLE INTERACTION LEVIER ---
    // ==========================================
    socket.on('interact', () => {
        const p = players[socket.id];
        let wasmId = playerWasmIds[socket.id];
        if (!p || wasmId === undefined) return;

        // On récupère la vraie position du rat
        const px = world.get_player_x(wasmId);
        const py = world.get_player_y(wasmId);

        let stateChanged = false;

        leversData.forEach(lev => {
            // Hitbox d'interaction (le rat doit être à moins de 50px du levier)
            if (Math.abs(px - lev.x) < 50 && Math.abs(py - lev.y) < 50) {
                lev.active = !lev.active;
                stateChanged = true;
            }
        });

        if (stateChanged) {
            // Vérifie si TOUS les leviers sont sur "true"
            cheeseActive = leversData.every(l => l.active);
            
            // Broadcast l'état mis à jour à tout le monde
            io.emit('gameState', { levers: leversData, cheeseActive });
            
            if (cheeseActive) {
                console.log("🧀 TOUS LES LEVIERS SONT ACTIFS ! Le fromage est débloqué !");
            }
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
        
        // ⚠️ NOUVEAU : Séparation précise de la course et de la grimpe
        let onGround = world.get_player_on_ground(wasmId);
        let isMovingAnimation = onGround && Math.abs(player.vx) > 0;
        let isClimbingAnimation = player.isOverLadder && (!onGround || Math.abs(player.vy_input) > 0);

        stateToBroadcast.players[socketId] = {
            id: socketId,
            x: world.get_player_x(wasmId),
            y: world.get_player_y(wasmId),
            pseudo: player.pseudo, 
            color: player.color,
            direction: player.direction, 
            isMoving: isMovingAnimation,
            isClimbing: isClimbingAnimation, // ⚠️ On envoie ça à Selma !
            on_ground: onGround
        };
    }

    io.emit('worldState', stateToBroadcast);

}, 1000 / 60);

const PORT = process.env.PORT || 3050;
server.listen(PORT, () => {
    console.log(`Serveur Multi (Wasm Hardcore) opérationnel sur http://localhost:${PORT}`);
});