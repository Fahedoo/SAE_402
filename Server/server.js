const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURATION DES DOSSIERS ---
app.use(express.static(path.join(__dirname, '../Public')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// --- ÉTAT DU SERVEUR ---
const players = {};
const MAX_PLAYERS = 4;
let gameConfig = {
    nbPlayers: 2,
    modeAmi: true,
    isStarted: false
};

io.on('connection', (socket) => {
    console.log(`Nouveau rat connecté : ${socket.id}`);

    // 1. LOGIQUE DE CONNEXION (LOGIN)
    socket.on('login', (data) => {
        const playersCount = Object.keys(players).length;

        if (playersCount >= MAX_PLAYERS) {
            socket.emit('loginFailed', 'La cuisine est pleine ! (4 rats max)');
            return;
        }

        const isChef = playersCount === 0;

        players[socket.id] = {
            id: socket.id,
            pseudo: data.pseudo || 'Anonyme',
            color: data.color || 'gray',
            isAdmin: isChef,
            x: 100,
            y: 736, // Position par défaut au sol
            direction: -1,
            isMoving: false
        };

        socket.emit('loginSuccess', players[socket.id]);
        io.emit('currentPlayers', players);
        socket.emit('configUpdated', gameConfig);

        console.log(`${players[socket.id].pseudo} est entré (Chef: ${isChef})`);
    });

    // 2. SYNCHRONISATION DES RÉGLAGES DU LOBBY
    socket.on('updateConfig', (newConfig) => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            gameConfig = { ...gameConfig, ...newConfig };
            socket.broadcast.emit('configUpdated', gameConfig);
            console.log("Nouvelle config reçue du Chef :", gameConfig);
        }
    });

    // 3. LE TOP DÉPART
    socket.on('requestStart', () => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            gameConfig.isStarted = true;
            io.emit('gameStarted', gameConfig);
            console.log("🚀 Le Chef a lancé le service !");
        }
    });

    // 4. LES INTERACTIONS (Touche E)
    socket.on('toggleLever', () => {
        if (!players[socket.id]) return;
        io.emit('leverTriggered', { by: players[socket.id].pseudo });
    });

    // 5. SYNCHRONISATION DES MOUVEMENTS (TEMPS RÉEL)
    socket.on('playerMovement', (movementData) => {
        if (!players[socket.id]) return;

        // Mise à jour locale sur le serveur
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        players[socket.id].direction = movementData.direction;
        players[socket.id].isMoving = movementData.isMoving;

        // On renvoie l'info aux autres avec l'ID, le pseudo et la couleur
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            x: players[socket.id].x,
            y: players[socket.id].y,
            direction: players[socket.id].direction,
            isMoving: players[socket.id].isMoving,
            pseudo: players[socket.id].pseudo,
            color: players[socket.id].color
        });
    });

    // 6. DÉCONNEXION
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`${players[socket.id].pseudo} a quitté la brigade.`);
            const wasAdmin = players[socket.id].isAdmin;
            delete players[socket.id];

            // Si c'était le dernier joueur, on reset la partie
            if (Object.keys(players).length === 0) {
                gameConfig.isStarted = false;
            } else if (wasAdmin) {
                // Si le chef part, on nomme le premier restant comme nouveau chef
                const remainingIds = Object.keys(players);
                players[remainingIds[0]].isAdmin = true;
            }

            io.emit('playerDisconnected', socket.id);
            io.emit('currentPlayers', players);
        }
    });
});

const PORT = process.env.PORT || 3050;
server.listen(PORT, () => {
    console.log(`Serveur opérationnel sur http://localhost:${PORT}`);
});