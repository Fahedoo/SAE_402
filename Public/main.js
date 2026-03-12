// ==========================================
// 1. INITIALISATION & ÉTAT (LA TOUR DE CONTRÔLE)
// ==========================================
const socket = io(); // Connexion au serveur de Raphaël

let currentPseudo = "";
let selectedColor = "gray";
let nbPlayers = 2;
let modeAmi = true;
let isPaused = false;
let isAdmin = false; // Pour savoir si on est le Chef (Joueur 1)

// ==========================================
// 2. NAVIGATION (SPA)
// ==========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// ==========================================
// 3. LOGIQUE CONNEXION (LOGIN)
// ==========================================

// Sélection de la couleur du rat
document.querySelectorAll('.color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        selectedColor = opt.getAttribute('data-color');
    });
});

// Clic sur "REJOINDRE LA BRIGADE"
document.getElementById('btn-to-lobby').addEventListener('click', () => {
    const input = document.getElementById('pseudo');
    currentPseudo = input.value.trim();
    
    if (currentPseudo !== "") {
        // ON DEMANDE LA PERMISSION À RAPH
        socket.emit('login', { pseudo: currentPseudo, color: selectedColor });
    } else {
        alert("Hé commis ! Entre un nom !");
    }
});

// RÉPONSE DE RAPH APRÈS LE LOGIN
socket.on('loginSuccess', (playerData) => {
    console.log("Login réussi !", playerData);
    showScreen('screen-lobby');
});

socket.on('loginFailed', (message) => {
    alert(message); // Affiche "Serveur plein" par exemple
});

// ==========================================
// 4. LOGIQUE LOBBY (SYNCHRONISATION)
// ==========================================

// Mise à jour des cases (Slots) quand la liste des joueurs change
function updatePlayersSlots(playersObj) {
    const playersList = Object.values(playersObj);
    
    // On vide les 4 slots
    for (let i = 1; i <= 4; i++) {
        const slot = document.getElementById(`slot-${i}`);
        slot.innerText = "EN ATTENTE...";
        slot.classList.remove('active');
    }

    // On remplit avec les joueurs connectés
    playersList.forEach((player, index) => {
        const slotNum = index + 1;
        const slotEl = document.getElementById(`slot-${slotNum}`);
        if (slotEl) {
            slotEl.innerText = player.pseudo.toUpperCase() + (player.id === socket.id ? " (MOI)" : "");
            slotEl.classList.add('active');
        }
    });

    // GESTION DU RÔLE : Le premier de la liste est le Chef (Admin)
    if (playersList[0] && playersList[0].id === socket.id) {
        isAdmin = true;
        console.log("Tu es le Chef de Brigade !");
    } else {
        isAdmin = false;
        setGuestMode(); // On bloque les boutons pour les autres
    }
}

// Bloquer l'interface pour les invités (Commis)
function setGuestMode() {
    document.getElementById('btn-start-service').style.display = 'none';
    const waitMsg = document.getElementById('wait-message');
    if(waitMsg) waitMsg.style.display = 'block';

    document.querySelectorAll('.choice-card').forEach(card => {
        card.style.pointerEvents = 'none';
        card.style.opacity = '0.5';
    });
}

// ÉCOUTEURS POUR LE LOBBY
socket.on('currentPlayers', (players) => updatePlayersSlots(players));
socket.on('newPlayer', () => socket.emit('get_players_update')); // Optionnel selon Raph
socket.on('playerDisconnected', () => socket.emit('get_players_update'));

// Choix 2/4 Joueurs (Seul l'admin clique, mais on prévoit la synchro)
const opt2 = document.getElementById('opt-2-players');
const opt4 = document.getElementById('opt-4-players');
const extraSlots = document.querySelectorAll('.extra-slot');

opt2.addEventListener('click', () => {
    if(!isAdmin) return;
    nbPlayers = 2;
    opt2.classList.add('active');
    opt4.classList.remove('active');
    extraSlots.forEach(s => s.style.display = 'none');
    socket.emit('updateConfig', { nbPlayers: 2 });
});

opt4.addEventListener('click', () => {
    if(!isAdmin) return;
    nbPlayers = 4;
    opt4.classList.add('active');
    opt2.classList.remove('active');
    extraSlots.forEach(s => s.style.display = 'block');
    socket.emit('updateConfig', { nbPlayers: 4 });
});

// Choix Ami/Ennemi
const optAmi = document.getElementById('opt-mode-ami');
const optEnnemi = document.getElementById('opt-mode-ennemi');

optAmi.addEventListener('click', () => {
    if(!isAdmin) return;
    modeAmi = true;
    optAmi.classList.add('active');
    optEnnemi.classList.remove('active');
    socket.emit('updateConfig', { modeAmi: true });
});

optEnnemi.addEventListener('click', () => {
    if(!isAdmin) return;
    modeAmi = false;
    optEnnemi.classList.add('active');
    optAmi.classList.remove('active');
    socket.emit('updateConfig', { modeAmi: false });
});

// ==========================================
// 5. LOGIQUE JEU (LANCEMENT & TIMERS)
// ==========================================

// Le Chef demande le lancement
document.getElementById('btn-start-service').addEventListener('click', () => {
    socket.emit('requestStart');
});

// TOUT LE MONDE reçoit l'ordre de commencer
socket.on('gameStarted', (config) => {
    nbPlayers = config.nbPlayers;
    modeAmi = config.modeAmi;
    showScreen('screen-game');
    resizeCanvas();
    startTestTimer();
});

function startTestTimer() {
    let timeLeft = 180;
    const timerDisplay = document.getElementById('timer');
    const countdown = setInterval(() => {
        if (!isPaused) {
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerDisplay.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            if (timeLeft <= 0) {
                clearInterval(countdown);
                endGame(false);
            }
        }
    }, 1000);
}

function endGame(isVictory) {
    const resultScreen = document.getElementById('screen-result');
    const resultTitle = document.getElementById('result-title');
    const finalScoreDisplay = document.getElementById('final-score');
    const currentScore = document.getElementById('score').innerText;

    resultScreen.classList.remove('victory', 'game-over');
    if (isVictory) {
        resultScreen.classList.add('victory');
        resultTitle.innerText = "MISSION RÉUSSIE !";
    } else {
        resultScreen.classList.add('game-over');
        resultTitle.innerText = "BRIGADE VIRÉE !";
    }
    finalScoreDisplay.innerText = currentScore;
    showScreen('screen-result');
}

// ==========================================
// 6. SYSTÈME (RESIZE, PAUSE, CLAVIER)
// ==========================================

function resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}

function togglePause() {
    if (document.getElementById('screen-game').classList.contains('active')) {
        isPaused = !isPaused;
        const pauseOverlay = document.getElementById('pause-overlay');
        pauseOverlay.style.display = isPaused ? 'flex' : 'none';
    }
}

window.addEventListener('resize', resizeCanvas);

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") togglePause();
    
    // TOUCHE E : Interaction levier (Logique de Raph)
    if (e.key.toLowerCase() === "e") {
        console.log("Interaction levier !");
        socket.emit('toggleLever', 'lever1'); // On envoie l'ID par défaut
    }
});

document.getElementById('btn-resume').addEventListener('click', togglePause);