const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURATION DES DOSSIERS ---
// On sert les fichiers qui sont dans le dossier "Public" (Attention à la majuscule "P" sur Linux !)
app.use(express.static(path.join(__dirname, '../Public')));
// On expose aussi le dossier assets
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

        // Déterminer si c'est le premier (Chef) ou pas
        const isChef = playersCount === 0;

        // Création du profil joueur
        players[socket.id] = {
            id: socket.id,
            pseudo: data.pseudo || 'Anonyme',
            color: data.color || 'gray',
            isAdmin: isChef // Le premier devient Chef
        };

        // On confirme au joueur que c'est bon et on lui donne son rôle
        socket.emit('loginSuccess', players[socket.id]);

        // On envoie la liste de tous les joueurs à tout le monde pour remplir les SLOTS
        io.emit('currentPlayers', players);

        // On envoie la config actuelle au SEUL nouveau joueur
        socket.emit('configUpdated', gameConfig);

        console.log(`${players[socket.id].pseudo} est entré (Chef: ${isChef})`);
    });

    // 2. SYNCHRONISATION DES RÉGLAGES DU LOBBY
    // Quand le Chef change le mode ou le nombre de joueurs
    socket.on('updateConfig', (newConfig) => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            gameConfig = { ...gameConfig, ...newConfig };
            // On prévient tous les autres pour que leurs cartes changent de couleur
            socket.broadcast.emit('configUpdated', gameConfig);
            console.log("Nouvelle config reçue du Chef :", gameConfig);
        }
    });

    // 3. LE TOP DÉPART
    socket.on('requestStart', () => {
        if (players[socket.id] && players[socket.id].isAdmin) {
            gameConfig.isStarted = true;
            // On crie à tout le monde de lancer le jeu !
            io.emit('gameStarted', gameConfig);
            console.log("🚀 Le Chef a lancé le service !");
        }
    });

    // 4. LES INTERACTIONS (Touche E)
    socket.on('toggleLever', () => {
        if (!players[socket.id]) return;
        // On renvoie juste l'info pour l'instant
        io.emit('leverTriggered', { by: players[socket.id].pseudo });
    });

    // 5. DÉCONNEXION
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`${players[socket.id].pseudo} a quitté la brigade.`);
            delete players[socket.id];

            // Si le chef part, on peut nommer le suivant (optionnel pour l'instant)
            io.emit('currentPlayers', players);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur opérationnel sur http://localhost:${PORT}`);
});