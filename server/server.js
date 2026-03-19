const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { World } = require('../physics/pkg/physics.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../public')));

// --- DONNÉES DES NIVEAUX ---
const CONFIG_ENNEMI = {
    width: 900,
    platforms: [
        { x: 42, y: 800, w: 819, h: 18, slope: -50 },
        { x: 42, y: 620, w: 646, h: 18, slope: 45 },
        { x: 109, y: 520, w: 751, h: 18, slope: -50 },
        { x: 42, y: 353, w: 755, h: 18, slope: 50 },
        { x: 42, y: 275, w: 817, h: 18, slope: -65 },
        { x: 63, y: 125, w: 672, h: 18, slope: 30 },
        { x: 300, y: 70, w: 170, h: 18, slope: 0 }
    ],
    laddersX: [600, 150, 650, 100, 600, 420],
    ladderPairs: [[1,0], [2,1], [3,2], [4,3], [5,4], [6,5]]
};

const CONFIG_COOP = {
    width: 1000,
    platforms: [
        { x: 0, y: 800, w: 1000, h: 20, slope: 0 },
        { x: 50, y: 650, w: 300, h: 15, slope: 0 },
        { x: 550, y: 650, w: 300, h: 15, slope: 0 },
        { x: 200, y: 500, w: 400, h: 15, slope: 0 },
        { x: 650, y: 500, w: 250, h: 15, slope: 0 },
        { x: 50, y: 350, w: 250, h: 15, slope: 0 },
        { x: 350, y: 350, w: 450, h: 15, slope: 0 },
        { x: 150, y: 200, w: 350, h: 15, slope: 0 },
        { x: 550, y: 200, w: 300, h: 15, slope: 0 },
        { x: 300, y: 150, w: 400, h: 15, slope: 0 }
    ],
    ladders: [
        {x:100, t:1, b:0}, {x:710, t:2, b:0}, {x:250, t:3, b:1}, {x:560, t:3, b:2},
        {x:740, t:4, b:2}, {x:210, t:5, b:3}, {x:450, t:6, b:3}, {x:680, t:6, b:4},
        {x:180, t:7, b:5}, {x:650, t:8, b:6}, {x:350, t:9, b:7}, {x:600, t:9, b:8}
    ]
};

// --- ÉTAT GLOBAL ---
let gameConfig = { nbPlayers: 2, modeAmi: true, isStarted: false };
let players = {}, playerWasmIds = {};
let tomatoes = [], knives = [], hearts = [], levers = [];
let world, cheeseActive = false, nextItemId = 1;

const heartSpawns = [{x:200,y:760}, {x:500,y:620}, {x:300,y:475}, {x:650,y:360}, {x:250,y:225}];

// --- INITIALISATION DYNAMIQUE ---
function initLevel() {
    const cfg = gameConfig.modeAmi ? CONFIG_COOP : CONFIG_ENNEMI;
    world = new World(1980.0, 850.0, cfg.width);
    
    // Plateformes
    cfg.platforms.forEach(p => world.add_platform(p.x, p.y, p.w, p.h, p.slope));
    
    // Échelles
    if (gameConfig.modeAmi) {
        cfg.ladders.forEach(l => {
            world.add_ladder(l.x, 30, cfg.platforms[l.t].y, cfg.platforms[l.b].y);
        });
    } else {
        cfg.ladderPairs.forEach((pair, i) => {
            const x = cfg.laddersX[i];
            const pT = cfg.platforms[pair[0]], pB = cfg.platforms[pair[1]];
            const yT = pT.y + (pT.slope * ((x - pT.x) / pT.w));
            const yB = pB.y + (pB.slope * ((x - pB.x) / pB.w));
            world.add_ladder(x, 30, yT, yB);
        });
    }
    resetItems();
}

function resetItems() {
    tomatoes = []; knives = []; hearts = []; levers = [];
    cheeseActive = !gameConfig.modeAmi; 
}

function spawnLevers() {
    if (!gameConfig.modeAmi) return;
    levers = [];
    [1,2,3,4,5,6,7,8].sort(()=>.5-Math.random()).slice(0,3).forEach((idx, i) => {
        const p = CONFIG_COOP.platforms[idx];
        levers.push({ id: `L${i}`, x: p.x + 20 + Math.random()*(p.w-40), y: p.y, active: false });
    });
}

initLevel();

// --- LOGIQUE SOCKET ---
io.on('connection', (socket) => {
    socket.on('login', (data) => {
        if (Object.keys(players).length >= gameConfig.nbPlayers) return;
        const wasmId = world.add_player(100, 750, 30, 30);
        playerWasmIds[socket.id] = wasmId;
        players[socket.id] = {
            id: socket.id, pseudo: data.pseudo, color: data.color, isAdmin: Object.keys(players).length === 0,
            wasmId, vx: 0, vy_input: 0, lives: 3, isDead: false, invulUntil: 0, isOverLadder: false
        };
        socket.emit('loginSuccess', players[socket.id]);
        io.emit('currentPlayers', players);
    });

    socket.on('updateConfig', (newCfg) => {
        if (players[socket.id]?.isAdmin) {
            const modeChanged = newCfg.modeAmi !== gameConfig.modeAmi;
            gameConfig = { ...gameConfig, ...newCfg };
            if (modeChanged) initLevel();
            io.emit('configUpdated', gameConfig);
        }
    });

// CÔTÉ SERVEUR (index.js / server.js)
socket.on('requestStart', () => {
    if (players[socket.id] && players[socket.id].isAdmin) {
        // 1. On réinitialise le niveau (important pour changer les plateformes)
        initLevel(); 
        
        // 2. On repositionne les joueurs
        Object.keys(players).forEach(id => {
            const p = players[id];

            // On supprime l'ancien ID physique du moteur WASM
            if (world.disconnect_player) {
                world.disconnect_player(p.wasmId);
            }

            // On crée un NOUVEAU corps physique à la position de départ (100, 750)
            const newWasmId = world.add_player(100, 750, 30, 30);
            
            // On met à jour les infos du joueur
            p.wasmId = newWasmId;
            p.x = 100;
            p.y = 750;
            p.isDead = false;
            p.lives = 3;
            p.vx = 0;
            p.vy_input = 0;
            p.invulUntil = 0;
        });

        // 3. On active les boucles de jeu et on spawn les leviers si besoin
        gameConfig.isStarted = true;
        if (gameConfig.modeAmi) spawnLevers();

        // 4. On prévient les clients (bien utiliser gameConfig.modeAmi ici)
        io.emit('gameStarted', { modeAmi: gameConfig.modeAmi });
        
        console.log("Partie démarrée en mode :", gameConfig.modeAmi ? "COOP" : "ENNEMI");
    }
});

    socket.on('playerInput', (data) => {
        const p = players[socket.id];
        if (!p || p.isDead) return;
        if (data.action === 'move') { world.set_player_vx(p.wasmId, data.vx); p.vx = data.vx; p.direction = data.vx !== 0 ? Math.sign(data.vx) : p.direction; }
        if (data.action === 'move_v') { p.vy_input = data.vy; if (world.set_player_dropping) world.set_player_dropping(p.wasmId, data.vy > 0); }
        if (data.action === 'jump') world.player_jump(p.wasmId, 450);
    });

    socket.on('interact', () => {
        if (!gameConfig.modeAmi) return;
        const p = players[socket.id];
        const px = world.get_player_x(p.wasmId), py = world.get_player_y(p.wasmId);
        let changed = false;
        levers.forEach(l => { if (Math.abs(px - l.x) < 50 && Math.abs(py - l.y) < 50) { l.active = !l.active; changed = true; }});
        if (changed) { cheeseActive = levers.every(l => l.active); io.emit('gameState', { levers, cheeseActive }); }
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            const wasAdmin = players[socket.id].isAdmin;
            if (world.disconnect_player) world.disconnect_player(players[socket.id].wasmId);
            delete players[socket.id];
            if (Object.keys(players).length === 0) { gameConfig.isStarted = false; resetItems(); }
            else if (wasAdmin) players[Object.keys(players)[0]].isAdmin = true;
            io.emit('playerDisconnected', socket.id);
            io.emit('currentPlayers', players);
        }
    });
});

// --- BOUCLE DE SPAWN ---
setInterval(() => {
    if (!gameConfig.isStarted) return;
    // Tomates
    if (tomatoes.length < (gameConfig.modeAmi ? 10 : 8)) {
        tomatoes.push({ id: nextItemId++, x: Math.random()*800+20, y: -20, speed: Math.random()*3+2 });
    }
    // Couteaux (logique mixte)
    const maxKnives = gameConfig.modeAmi ? 3 : 3;
    if (knives.length < maxKnives && Math.random() > 0.7) {
        knives.push({ id: nextItemId++, x: Math.random()*800+50, y: -50, speed: 7 });
    }
    // Cœurs (Ennemi uniquement)
    if (!gameConfig.modeAmi && hearts.length < 1 && Math.random() > 0.8) {
        const s = heartSpawns[Math.floor(Math.random()*heartSpawns.length)];
        hearts.push({ id: nextItemId++, x: s.x, y: s.y });
    }
}, 2000);

// --- UPDATE PHYSIQUE (60 FPS) ---
setInterval(() => {
    if (!gameConfig.isStarted) return;

    for (let id in players) {
        let p = players[id];
        let px = world.get_player_x(p.wasmId), py = world.get_player_y(p.wasmId);
        // Échelles
        p.isOverLadder = false;
        const cfg = gameConfig.modeAmi ? CONFIG_COOP : CONFIG_ENNEMI;
        const ladders = gameConfig.modeAmi ? cfg.ladders : cfg.laddersX.map((x, i) => ({x, t:cfg.ladderPairs[i][0], b:cfg.ladderPairs[i][1]}));
        
        for(let l of ladders) {
            let yT = gameConfig.modeAmi ? cfg.platforms[l.t].y : cfg.platforms[l.t].y + (CONFIG_ENNEMI.platforms[l.t].slope * ((l.x - CONFIG_ENNEMI.platforms[l.t].x) / CONFIG_ENNEMI.platforms[l.t].w));
            if (Math.abs(px - l.x) <= 15 && py > yT - 30 && py < 850) { p.isOverLadder = true; break; }
        }
        if (p.isOverLadder) world.set_player_vy(p.wasmId, p.vy_input);
    }

    world.step(1/60);

    // Collisions
    for (let id in players) {
        let p = players[id]; if (p.isDead) continue;
        let px = world.get_player_x(p.wasmId), py = world.get_player_y(p.wasmId);

        // Projectiles
        [tomatoes, knives].forEach((list, type) => {
            for (let i = list.length-1; i>=0; i--) {
                let m = list[i];
                if (Math.abs(px - m.x) < 30 && Math.abs(py - m.y) < 30) {
                    if (gameConfig.modeAmi) { // Mode Coop : Mort immédiate
                        gameConfig.isStarted = false; io.emit('gameOver'); return;
                    } else if (Date.now() > p.invulUntil) { // Mode Ennemi : Système de vies
                        p.lives--; p.invulUntil = Date.now() + 1000;
                        if (p.lives <= 0) { p.isDead = true; world.set_player_vx(p.wasmId, 0); }
                        list.splice(i, 1);
                    }
                }
            }
        });

        // Coeurs (Ennemi)
        hearts.forEach((h, i) => { if (Math.abs(px-h.x)<30 && Math.abs(py-h.y)<30) { if(p.lives<3) p.lives++; hearts.splice(i,1); }});

        // Victoire
        if (cheeseActive && px > 300 && px < 600 && py < 150) {
            io.emit('gameWon', p.pseudo); gameConfig.isStarted = false; return;
        }
    }

    // Update positions projectiles
    [tomatoes, knives].forEach(list => list.forEach(m => m.y += m.speed));
    tomatoes = tomatoes.filter(m => m.y < 850);
    knives = knives.filter(m => m.y < 850);

    // Broadcast
    const state = { players: {}, tomatoes, knives, hearts };
    for (let id in players) {
        let p = players[id], w = p.wasmId;
        state.players[id] = {
            id, x: world.get_player_x(w), y: world.get_player_y(w),
            pseudo: p.pseudo, color: p.color, lives: p.lives, isDead: p.isDead,
            isInvul: Date.now() < p.invulUntil, on_ground: world.get_player_on_ground(w)
        };
    }
    io.emit('worldState', state);
}, 1000/60);

server.listen(3025, () => console.log("Serveur Fusionné sur 3025"));