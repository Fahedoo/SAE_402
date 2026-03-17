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
app.use(express.static(path.join(__dirname, '../public')));
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

// 2. INITIALISATION DE L'UNIVERS PHYSIQUE WASM
const world = new World(1980.0, 580.0); // Gravité, Niveau du sol

// /!\ N'oublie pas de rajouter tes plateformes ici quand Selma aura le Level Design
// world.add_platform(100, 400, 200, 20); 

// --- ÉTAT DU SERVEUR ET MÉCANIQUES ---
const players = {};
const playerWasmIds = {}; // Dictionnaire de traduction Socket.io <-> Wasm
const MAX_PLAYERS = 4;

let gameConfig = {
    nbPlayers: 2,
    modeAmi: true,
    isStarted: false
};

// Objets du jeu
let tomatoes = [];
let nextTomatoId = 1;
let levers = { lever1: false, lever2: false };

// --- BOUCLE DE GÉNÉRATION DES TOMATES (Toutes les 2 secondes) ---
setInterval(() => {
    if (!gameConfig.isStarted || Object.keys(players).length === 0) return;
    if (tomatoes.length >= 10) return; // Max 10 tomates

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

    // LOGIC: LOGIN
    socket.on('login', (data) => {
        const playersCount = Object.keys(players).length;

        if (playersCount >= MAX_PLAYERS) {
            socket.emit('loginFailed', 'La cuisine est pleine ! (4 rats max)');
            return;
        }

        const isChef = playersCount === 0;

        // ON AJOUTE LE JOUEUR DANS LE WASM
        const wasmId = world.add_player(100, 100, 30, 30); // x, y, largeur, hauteur
        playerWasmIds[socket.id] = wasmId;

        players[socket.id] = {
            id: socket.id,
            pseudo: data.pseudo || 'Anonyme',
            color: data.color || 'gray',
            isAdmin: isChef,
            wasmId: wasmId
        };

        // Envoi des infos au nouveau joueur
        socket.emit('loginSuccess', players[socket.id]);
        socket.emit('currentPlayers', players);
        socket.emit('configUpdated', gameConfig);
        socket.emit('currentTomatoes', tomatoes);
        socket.emit('currentLevers', levers);

        // Prévenir les autres
        socket.broadcast.emit('newPlayer', players[socket.id]);
        console.log(`${players[socket.id].pseudo} est entré (Chef: ${isChef})`);
    });

    // LOBBY : SYNCHRONISATION DES RÉGLAGES
    socket.on('updateConfig', (newConfig) => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            gameConfig = { ...gameConfig, ...newConfig };
            socket.broadcast.emit('configUpdated', gameConfig);
        }
    });

    // LOBBY : LE TOP DÉPART
    socket.on('requestStart', () => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            gameConfig.isStarted = true;
            io.emit('gameStarted', gameConfig);
            console.log("🚀 Le Chef a lancé le service !");
        }
    });

    // COOP : INTERACTION LEVIER
    socket.on('toggleLever', (leverId) => {
        if (!players[socket.id] || levers[leverId] === undefined) return;

        levers[leverId] = !levers[leverId]; // Inverse l'état
        console.log(`Levier ${leverId} basculé: ${levers[leverId]} par ${players[socket.id].pseudo}`);
        io.emit('leverStateChanged', { leverId, state: levers[leverId] });
    });

    // GAMEPLAY : RÉCEPTION DES INPUTS (Le client n'envoie plus de X/Y)
    socket.on('playerInput', (data) => {
        let wasmId = playerWasmIds[socket.id];
        if (wasmId === undefined) return;

        if (data.action === 'move') {
            world.set_player_vx(wasmId, data.vx); // Ex: 200 pour droite, -200 pour gauche, 0 pour stop
        } else if (data.action === 'jump') {
            world.player_jump(wasmId, 450); // Force du saut
        }
    });

    // DÉCONNEXION
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`${players[socket.id].pseudo} a quitté la brigade.`);
            const wasAdmin = players[socket.id].isAdmin;

            delete players[socket.id];
            delete playerWasmIds[socket.id]; // On le retire de notre dico Wasm

            if (Object.keys(players).length === 0) {
                gameConfig.isStarted = false;
                tomatoes = []; // On nettoie les tomates
            } else if (wasAdmin) {
                const remainingIds = Object.keys(players);
                players[remainingIds[0]].isAdmin = true;
            }

            io.emit('playerDisconnected', socket.id);
            io.emit('currentPlayers', players);
        }
    });
});

// --- LE CŒUR BATTANT DU JEU (Boucle 60 FPS) ---
setInterval(() => {
    if (!gameConfig.isStarted) return;

    // 1. On fait avancer la physique des joueurs (Wasm)
    world.step(1 / 60);

    // 2. On fait avancer les tomates (JS basique car pas dans le Wasm de Fahed)
    if (tomatoes.length > 0) {
        for (let i = tomatoes.length - 1; i >= 0; i--) {
            tomatoes[i].y += tomatoes[i].speed;
            if (tomatoes[i].y >= 530) {
                io.emit('removeTomato', tomatoes[i].id);
                tomatoes.splice(i, 1);
            }
        }
    }

    // 3. On prépare le paquet de données à envoyer aux clients
    const stateToBroadcast = {
        players: {},
        // Optionnel: tu pourrais aussi renvoyer la position exacte des tomates ici si tu veux 
        // être sûr que personne ne désynchronise, mais c'est lourd pour le réseau.
    };

    for (let socketId in players) {
        let wasmId = playerWasmIds[socketId];
        stateToBroadcast.players[socketId] = {
            x: world.get_player_x(wasmId),
            y: world.get_player_y(wasmId),
            on_ground: world.get_player_on_ground(wasmId),
            direction: players[socketId].direction // Si tu as besoin de savoir vers où il regarde
        };
    }

    // 4. On diffuse la réalité à 60 images par seconde
    io.emit('worldState', stateToBroadcast);

}, 1000 / 60);

// --- LANCEMENT ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur Multi (Wasm Hardcore) opérationnel sur http://localhost:${PORT}`);
});