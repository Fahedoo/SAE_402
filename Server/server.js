const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Initialisation d'Express et du serveur HTTP
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// On dit à Express de servir les fichiers du jeu (HTML/CSS/JS) qui seront dans un dossier "public"
app.use(express.static('public'));

// Cet objet va stocker l'état de tous les joueurs connectés
const players = {};

// Quand un client (navigateur) se connecte au serveur
io.on('connection', (socket) => {
    console.log(`Nouveau joueur connecté : ${socket.id}`);

    // 1. On crée le profil du joueur dans notre objet 'players'
    players[socket.id] = {
        x: Math.floor(Math.random() * 700) + 50, // Position X aléatoire pour tester
        y: 500,                                  // Position Y (le sol)
        role: 'rat'                              // Par défaut, on le met "rat". On gérera le boss plus tard !
    };

    // 2. On envoie au NOUVEAU joueur la liste de TOUS les joueurs déjà présents
    socket.emit('currentPlayers', players);

    // 3. On prévient les AUTRES joueurs qu'un nouveau vient d'arriver
    socket.broadcast.emit('newPlayer', { id: socket.id, playerInfo: players[socket.id] });

    // 4. ÉCOUTE : Quand le joueur appuie sur une touche et envoie sa nouvelle position
    socket.on('playerMovement', (movementData) => {
        // On met à jour la position sur le serveur
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;

        // On "broadcast" (diffuse) cette nouvelle position à tous les autres joueurs
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            x: players[socket.id].x,
            y: players[socket.id].y
        });
    });

    // 5. DÉCONNEXION : Quand le joueur ferme son onglet
    socket.on('disconnect', () => {
        console.log(`Joueur déconnecté : ${socket.id}`);

        // On le supprime de notre liste
        delete players[socket.id];

        // On prévient tout le monde de l'effacer de leur écran
        io.emit('playerDisconnected', socket.id);
    });
});

// Lancement du serveur sur le port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur Socket.io opérationnel sur http://localhost:${PORT}`);
});