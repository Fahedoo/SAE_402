const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Initialisation d'Express et du serveur HTTP
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const path = require('path');

// On dit à Express de servir les fichiers du jeu (HTML/CSS/JS) qui seront dans un dossier "public"
app.use(express.static(path.join(__dirname, '../public')));
// On dit à Express d'exposer aussi le dossier assets !
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

// Cet objet va stocker l'état de tous les joueurs connectés
const players = {};
const MAX_PLAYERS = 4;

// État des objets interactifs (tomates et leviers)
let tomatoes = [];
let nextTomatoId = 1;
let levers = { lever1: false, lever2: false };

// --- BOUCLE SERVEUR : Génération de tomates ---
setInterval(() => {
    // S'il n'y a personne, on ne génère pas de tomates
    if (Object.keys(players).length === 0) return;

    // Limite max de 10 tomates en jeu
    if (tomatoes.length >= 10) return;

    const newTomato = {
        id: nextTomatoId++,
        x: Math.floor(Math.random() * 750) + 20, // X aléatoire, évite les bords
        y: -10, // Apparaît en haut (tombe du ciel)
        speed: Math.floor(Math.random() * 3) + 2 // Vitesse de chute
    };

    tomatoes.push(newTomato);
    io.emit('newTomato', newTomato);
}, 2000);

// Chute des tomates et suppression si sorties de l'écran (60 FPS serveur simplifié)
setInterval(() => {
    if (tomatoes.length === 0) return;
    
    for (let i = tomatoes.length - 1; i >= 0; i--) {
        tomatoes[i].y += tomatoes[i].speed;
        
        // Si elle touche le sol, on la supprime
        if (tomatoes[i].y >= 530) {
            io.emit('removeTomato', tomatoes[i].id);
            tomatoes.splice(i, 1);
        } else {
            // Optionnel : on pourrait re-sync toutes les positions de tomates de temps en temps
        }
    }
}, 1000 / 60);

// Quand un client (navigateur) se connecte au serveur
io.on('connection', (socket) => {
    console.log(`Nouveau client connecté : ${socket.id}`);

    // LOGIC: LOGIN
    socket.on('login', (data) => {
        // Vérifier si la partie est pleine
        if (Object.keys(players).length >= MAX_PLAYERS) {
            socket.emit('loginFailed', 'Le serveur est plein (4 joueurs max).');
            return;
        }

        console.log(`Joueur logué: ${data.pseudo} avec la couleur ${data.color}`);

        // 1. On crée le profil du joueur dans notre objet 'players'
        players[socket.id] = {
            id: socket.id,
            pseudo: data.pseudo || 'Anonyme',
            color: data.color || 'brun',
            x: Math.floor(Math.random() * 700) + 50, // Position X aléatoire pour tester
            y: 500,                                  // Position Y (le sol)
            role: 'rat'                              // Par défaut, on le met "rat"
        };

        // On lui envoie un message de succès
        socket.emit('loginSuccess', players[socket.id]);

        // 2. On envoie au NOUVEAU joueur la liste de TOUS les joueurs (y compris lui-même, géré par le client ou non)
        socket.emit('currentPlayers', players);

        // NOUVEAU : On lui envoie l'état actuel des tomates et des leviers
        socket.emit('currentTomatoes', tomatoes);
        socket.emit('currentLevers', levers);

        // 3. On prévient les AUTRES joueurs qu'un nouveau vient d'arriver
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // ÉCOUTE : Mode Coop - Interaction avec un levier
    socket.on('toggleLever', (leverId) => {
        if (!players[socket.id]) return;
        if (levers[leverId] !== undefined) {
            levers[leverId] = !levers[leverId]; // Inverse l'état
            console.log(`Levier ${leverId} basculé: ${levers[leverId]} par ${players[socket.id].pseudo}`);
            // Diffuse à tout le monde (y compris l'expéditeur pour validation)
            io.emit('leverStateChanged', { leverId, state: levers[leverId] });
        }
    });

    // 4. ÉCOUTE : Quand le joueur appuie sur une touche et envoie sa nouvelle position
    socket.on('playerMovement', (movementData) => {
        if (!players[socket.id]) return; // Ignorer si pas logué

        let myPlayer = players[socket.id];
        let oldX = myPlayer.x;
        let oldY = myPlayer.y;

        // Mise à jour (brouillon)
        myPlayer.x = movementData.x;
        myPlayer.y = movementData.y;

        // --- BODY BLOCK LÉGER ---
        // Vérification de collision avec les autres joueurs
        const PLAYER_SIZE = 30;
        let collision = false;

        for (let otherId in players) {
            if (otherId === socket.id) continue;
            let other = players[otherId];

            // AABB Collision standard
            if (myPlayer.x < other.x + PLAYER_SIZE &&
                myPlayer.x + PLAYER_SIZE > other.x &&
                myPlayer.y < other.y + PLAYER_SIZE &&
                myPlayer.y + PLAYER_SIZE > other.y) {
                
                collision = true;
                break;
            }
        }

        if (collision) {
            // Rejette le mouvement serveur
            myPlayer.x = oldX;
            myPlayer.y = oldY;
            // Force le client à reprendre sa position validée
            socket.emit('playerMoved', { id: socket.id, x: myPlayer.x, y: myPlayer.y });
            return;
        }

        // On "broadcast" (diffuse) cette nouvelle position à tous les autres joueurs
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            x: myPlayer.x,
            y: myPlayer.y
        });
    });

    // 5. DÉCONNEXION : Quand le joueur ferme son onglet
    socket.on('disconnect', () => {
        console.log(`Client déconnecté : ${socket.id}`);

        // S'il était logué
        if (players[socket.id]) {
            console.log(`Joueur ${players[socket.id].pseudo} nous a quitté.`);
            // On le supprime de notre liste
            delete players[socket.id];

            // On prévient tout le monde de l'effacer de leur écran
            io.emit('playerDisconnected', socket.id);
        }
    });
});

// Lancement du serveur sur le port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur Socket.io opérationnel sur http://localhost:${PORT}`);
});