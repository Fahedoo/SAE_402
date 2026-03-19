const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { World } = require('./pkg/physics');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../public')));

const LEVEL_WIDTH = 900;
const world = new World(1980.0, 850.0, LEVEL_WIDTH);

const platformsData = [
    { x: 42, y: 800, w: LEVEL_WIDTH - 81, h: 18, slope: -50 },
    { x: 42, y: 620, w: LEVEL_WIDTH - 254, h: 18, slope: 45 },
    { x: 109, y: 520, w: LEVEL_WIDTH - 149, h: 18, slope: -50 },
    { x: 42, y: 353, w: LEVEL_WIDTH - 145, h: 18, slope: 50 },
    { x: 42, y: 275, w: LEVEL_WIDTH - 83, h: 18, slope: -65 },
    { x: 63, y: 125, w: LEVEL_WIDTH - 228, h: 18, slope: 30 },
    { x: 300, y: 70, w: 170, h: 18, slope: 0 }
];

platformsData.forEach(p => {
    world.add_platform(p.x, p.y, p.w, p.h, p.slope);
});

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
let hearts = [];
let knives = [];
let nextItemId = 1;

const heartSpawns = [
    { x: 200, y: 760 },
    { x: 500, y: 620 },
    { x: 300, y: 475 },
    { x: 650, y: 360 },
    { x: 250, y: 225 }
];

setInterval(() => {
    if (!gameConfig.isStarted || Object.keys(players).length === 0 || gameConfig.modeAmi) return;
    if (tomatoes.length >= 8) return;
    tomatoes.push({ id: nextItemId++, x: Math.floor(Math.random() * 800) + 20, y: -20, speed: Math.random() * 2 + 2 });
}, 1500);

setInterval(() => {
    if (!gameConfig.isStarted || Object.keys(players).length === 0 || gameConfig.modeAmi) return;
    if (knives.length >= 3) return;
    knives.push({ id: nextItemId++, x: Math.floor(Math.random() * 800) + 20, y: -40, speed: Math.random() * 3 + 7 });
}, 4000);

setInterval(() => {
    if (!gameConfig.isStarted || Object.keys(players).length === 0 || gameConfig.modeAmi) return;
    if (hearts.length >= 1) return;
    const spawn = heartSpawns[Math.floor(Math.random() * heartSpawns.length)];
    hearts.push({ id: nextItemId++, x: spawn.x, y: spawn.y });
}, 15000);

io.on('connection', (socket) => {
    console.log(`Nouveau rat connecté : ${socket.id}`);

    socket.emit('takenColors', Object.values(players).map(p => p.color));

    socket.on('login', (data) => {
        if (Object.keys(players).length >= gameConfig.nbPlayers) {
            socket.emit('loginFailed', `La cuisine est pleine ! Limitée à ${gameConfig.nbPlayers} rats.`);
            return;
        }

        if (Object.values(players).some(p => p.color === data.color)) {
            socket.emit('loginFailed', `Ce pelage est déjà pris par un autre joueur !`);
            return;
        }

        const isChef = Object.keys(players).length === 0;
        const spawnX = 80 + (Object.keys(players).length * 40);
        const wasmId = world.add_player(spawnX, 750, 30, 30);

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
            isOverLadder: false,
            lives: 3,
            isDead: false,
            invulnerableUntil: 0
        };

        socket.emit('loginSuccess', players[socket.id]);
        socket.emit('configUpdated', gameConfig);
        io.emit('currentPlayers', players);
        io.emit('takenColors', Object.values(players).map(p => p.color));
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
            io.emit('gameStarted', gameConfig);
        }
    });

    // === BLOC CLAVIER NETTOYÉ ===
    document.addEventListener('keydown', (e) => {
        if (isPaused || !document.getElementById('screen-game').classList.contains('active')) return;

        const key = e.key.toLowerCase();

        // 🏃 MOUVEMENTS (Q / D)
        if (key === 'd' || key === 'arrowright') socket.emit('playerInput', { action: 'move', vx: 200 });
        if (key === 'q' || key === 'a' || key === 'arrowleft') socket.emit('playerInput', { action: 'move', vx: -200 });

        // 🪜 ÉCHELLES (W / S)
        if (key === 'w' || key === 's' || key === 'arrowup' || key === 'arrowdown') {
            const vy = (key === 's' || key === 'arrowdown') ? 200 : -200;
            socket.emit('playerInput', { action: 'move_v', vy: vy });
        }

        // 🦘 SAUT (Z ou Flèche Haut)
        if ((key === 'z' || e.key === 'ArrowUp') && !e.repeat) {
            playSound(sfx.jump);
            socket.emit('playerInput', { action: 'jump' });
        }

        // ⚙️ LEVIER (E)
        if (key === 'e') {
            socket.emit('toggleLever', 'lever1');
        }

        // 🚀 POUVOIR (Espace)
        if (e.code === "Space") {
            e.preventDefault();
            console.log("Envoi du pouvoir au serveur...");
            socket.emit('playerInput', { action: 'usePowerup' });
        }
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            const wasAdmin = players[socket.id].isAdmin;
            const wasmId = players[socket.id].wasmId;

            // 🌟 NOUVEAU : On informe le Wasm de transformer ce joueur en fantôme traversable
            if (world.disconnect_player) {
                world.disconnect_player(wasmId);
            }

            delete players[socket.id];
            delete playerWasmIds[socket.id];

            if (Object.keys(players).length === 0) {
                gameConfig.isStarted = false;
                tomatoes = []; hearts = []; knives = [];
            } else if (wasAdmin) {
                players[Object.keys(players)[0]].isAdmin = true;
            }

            io.emit('playerDisconnected', socket.id);
            io.emit('currentPlayers', players);
            io.emit('takenColors', Object.values(players).map(p => p.color));
        }
    });
});

setInterval(() => {
    if (!gameConfig.isStarted || gameConfig.modeAmi) return;

    for (let socketId in players) {
        const player = players[socketId];
        const wasmId = player.wasmId;
        const px = world.get_player_x(wasmId);
        const py = world.get_player_y(wasmId);

        player.isOverLadder = false;
        if (!player.isDead) {
            for (const lad of serverLadders) {
                if (Math.abs(px - lad.x) <= 10 && py > lad.y_top - 30 && py < lad.y_bottom) {
                    player.isOverLadder = true;
                    break;
                }
            }
            if (player.isOverLadder && world.set_player_vy) {
                world.set_player_vy(wasmId, player.vy_input);
            }
        }
    }

    world.step(1 / 60);

    if (tomatoes.length > 0) {
        for (let i = tomatoes.length - 1; i >= 0; i--) {
            tomatoes[i].y += tomatoes[i].speed;
            if (tomatoes[i].y >= 850) tomatoes.splice(i, 1);
        }
    }
    if (knives.length > 0) {
        for (let i = knives.length - 1; i >= 0; i--) {
            knives[i].y += knives[i].speed;
            if (knives[i].y >= 850) knives.splice(i, 1);
        }
    }

    for (let socketId in players) {
        let player = players[socketId];
        if (player.isDead) continue;

        let px = world.get_player_x(player.wasmId);
        let py = world.get_player_y(player.wasmId);

        for (let i = tomatoes.length - 1; i >= 0; i--) {
            let t = tomatoes[i];
            if (px < t.x + 20 && px + 30 > t.x && py < t.y + 20 && py + 30 > t.y) {
                if (Date.now() > player.invulnerableUntil) {
                    player.lives--;
                    player.invulnerableUntil = Date.now() + 1000;
                    if (player.lives <= 0) {
                        player.isDead = true;
                        world.set_player_vx(player.wasmId, 0);
                    }
                }
                tomatoes.splice(i, 1);
            }
        }

        for (let i = knives.length - 1; i >= 0; i--) {
            let k = knives[i];
            if (px < k.x + 15 && px + 30 > k.x && py < k.y + 40 && py + 30 > k.y) {
                if (Date.now() > player.invulnerableUntil) {
                    player.lives--;
                    player.invulnerableUntil = Date.now() + 1000;
                    if (player.lives <= 0) {
                        player.isDead = true;
                        world.set_player_vx(player.wasmId, 0);
                    }
                }
                knives.splice(i, 1);
            }
        }

        for (let i = hearts.length - 1; i >= 0; i--) {
            let h = hearts[i];
            if (px < h.x + 30 && px + 30 > h.x && py < h.y + 30 && py + 30 > h.y) {
                if (player.lives < 3) player.lives++;
                hearts.splice(i, 1);
            }
        }
    }

    const stateToBroadcast = { players: {}, tomatoes: tomatoes, hearts: hearts, knives: knives };

    let ratsOnCheese = 0;
    let firstRatPseudo = "";
    let totalRats = Object.keys(players).length;
    let aliveRats = 0;

    for (let socketId in players) {
        let wasmId = playerWasmIds[socketId];
        let player = players[socketId];
        let px = world.get_player_x(wasmId);
        let py = world.get_player_y(wasmId);

        let onGround = world.get_player_on_ground(wasmId);
        let isMovingAnimation = onGround && Math.abs(player.vx) > 0;
        let isClimbingAnimation = player.isOverLadder && (!onGround || Math.abs(player.vy_input) > 0);

        if (!player.isDead) aliveRats++;

        stateToBroadcast.players[socketId] = {
            id: socketId, x: px, y: py,
            pseudo: player.pseudo, color: player.color, direction: player.direction,
            isMoving: isMovingAnimation, isClimbing: isClimbingAnimation, on_ground: onGround,
            lives: player.lives,
            isDead: player.isDead,
            isInvulnerable: Date.now() < player.invulnerableUntil
        };

        if (!player.isDead && px < 400 && px > 290 && py < 50) {
            ratsOnCheese++;
            if (ratsOnCheese === 1) firstRatPseudo = player.pseudo;
        }
    }

    if (totalRats > 0) {
        if (aliveRats === 0) {
            io.emit('gameOver');
            gameConfig.isStarted = false;
            tomatoes = []; hearts = []; knives = [];
        }
        else if (!gameConfig.modeAmi && ratsOnCheese > 0) {
            io.emit('gameWon', firstRatPseudo);
            gameConfig.isStarted = false;
            tomatoes = []; hearts = []; knives = [];
        }
    }

    io.emit('worldState', stateToBroadcast);

}, 1000 / 60);

const PORT = process.env.PORT || 3015;
server.listen(PORT, () => {
    console.log(`Serveur Multi (Wasm Hardcore) opérationnel sur http://localhost:${PORT}`);
});