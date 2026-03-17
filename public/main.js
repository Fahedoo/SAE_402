import { GameRenderer } from './renderer.js';

// ==========================================
// 1. INITIALISATION & ÉTAT
// ==========================================
const socket = io();

let renderer = null;
let currentPseudo = "";
let selectedColor = "gray";
let nbPlayers = 2;
let modeAmi = true;
let isPaused = false;
let isAdmin = false;

// --- NOUVEAU : GESTION MULTIJOUEUR ABSOLUE ---
let allPlayers = {}; // Contient TOUS les joueurs (y compris nous), dictés par le serveur

// Éléments UI récupérés une seule fois
const opt2 = document.getElementById('opt-2-players');
const opt4 = document.getElementById('opt-4-players');
const optAmi = document.getElementById('opt-mode-ami');
const optEnnemi = document.getElementById('opt-mode-ennemi');
const extraSlotsContainer = document.getElementById('extra-slots');

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

document.querySelectorAll('.color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        selectedColor = opt.getAttribute('data-color');
    });
});

document.getElementById('btn-to-lobby').addEventListener('click', () => {
    const input = document.getElementById('pseudo');
    currentPseudo = input.value.trim();

    if (currentPseudo !== "") {
        socket.emit('login', { pseudo: currentPseudo, color: selectedColor });
    } else {
        alert("Hé commis ! Entre un nom !");
    }
});

socket.on('loginSuccess', (playerData) => {
    console.log("Connecté en tant que :", playerData.pseudo);
    showScreen('screen-lobby');
});

socket.on('loginFailed', (message) => {
    alert(message);
});

// ==========================================
// 4. LOGIQUE LOBBY (SYNCHRONISATION)
// ==========================================

function updatePlayersSlots(playersObj) {
    const playersList = Object.values(playersObj);

    for (let i = 1; i <= 4; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if (slot) {
            slot.innerText = "EN ATTENTE...";
            slot.classList.remove('active');
        }
    }

    playersList.forEach((player, index) => {
        const slotNum = index + 1;
        const slotEl = document.getElementById(`slot-${slotNum}`);
        if (slotEl) {
            slotEl.innerText = player.pseudo.toUpperCase() + (player.id === socket.id ? " (MOI)" : "");
            slotEl.classList.add('active');
            slotEl.style.color = player.color;
        }
    });

    if (playersList[0] && playersList[0].id === socket.id) {
        isAdmin = true;
        document.getElementById('btn-start-service').style.display = 'block';
        document.getElementById('wait-message').style.display = 'none';
        enableLobbyInteractions(true);
    } else {
        isAdmin = false;
        document.getElementById('btn-start-service').style.display = 'none';
        document.getElementById('wait-message').style.display = 'block';
        enableLobbyInteractions(false);
    }
}

function enableLobbyInteractions(enabled) {
    document.querySelectorAll('.choice-card, .admin-btn').forEach(el => {
        el.style.pointerEvents = enabled ? 'auto' : 'none';
        el.style.opacity = enabled ? '1' : '0.5';
    });
}

socket.on('currentPlayers', (players) => updatePlayersSlots(players));

socket.on('configUpdated', (config) => {
    nbPlayers = config.nbPlayers;
    modeAmi = config.modeAmi;

    if (nbPlayers === 2) {
        opt2.classList.add('active');
        opt4.classList.remove('active');
        if (extraSlotsContainer) extraSlotsContainer.style.display = 'none';
    } else {
        opt4.classList.add('active');
        opt2.classList.remove('active');
        if (extraSlotsContainer) extraSlotsContainer.style.display = 'block';
    }

    if (modeAmi) {
        optAmi.classList.add('active');
        optEnnemi.classList.remove('active');
    } else {
        optEnnemi.classList.add('active');
        optAmi.classList.remove('active');
    }
});

opt2.addEventListener('click', () => { if (isAdmin) socket.emit('updateConfig', { nbPlayers: 2, modeAmi: modeAmi }); });
opt4.addEventListener('click', () => { if (isAdmin) socket.emit('updateConfig', { nbPlayers: 4, modeAmi: modeAmi }); });
optAmi.addEventListener('click', () => { if (isAdmin) socket.emit('updateConfig', { nbPlayers: nbPlayers, modeAmi: true }); });
optEnnemi.addEventListener('click', () => { if (isAdmin) socket.emit('updateConfig', { nbPlayers: nbPlayers, modeAmi: false }); });

// ==========================================
// 5. LOGIQUE JEU (LANCEMENT & RENDU)
// ==========================================

document.getElementById('btn-start-service').addEventListener('click', () => {
    if (isAdmin) socket.emit('requestStart');
});

socket.on('gameStarted', (config) => {
    showScreen('screen-game');
    initGameEngine();
});

// --- NOUVEAU : On reçoit la réalité absolue du serveur (Wasm) ---
socket.on('worldState', (state) => {
    allPlayers = state.players; // Contient les X/Y de TOUT LE MONDE dictés par le serveur
});

// Retirer un rat quand il se déconnecte
socket.on('playerDisconnected', (id) => {
    delete allPlayers[id];
});

function initGameEngine() {
    const canvas = document.getElementById('gameCanvas');
    resizeCanvas();

    if (!renderer) {
        // NOUVEAU : On passe le socket au renderer pour qu'il gère les inputs clavier
        renderer = new GameRenderer(canvas, selectedColor, socket);

        function gameLoop() {
            if (!isPaused) {
                // Le renderer dessine tout le monde d'un coup
                renderer.draw(allPlayers);
            }
            requestAnimationFrame(gameLoop);
        }
        gameLoop();
    }
    startTestTimer();
}

function startTestTimer() {
    let timeLeft = 180;
    const timerDisplay = document.getElementById('timer');
    if (window.gameTimer) clearInterval(window.gameTimer);

    window.gameTimer = setInterval(() => {
        if (!isPaused) {
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            if (timerDisplay) timerDisplay.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

            if (timeLeft <= 0) {
                clearInterval(window.gameTimer);
                endGame(false);
            }
        }
    }, 1000);
}

function endGame(isVictory) {
    const resultTitle = document.getElementById('result-title');
    const finalScoreDisplay = document.getElementById('final-score');
    const scoreEl = document.getElementById('score');
    const currentScore = scoreEl ? scoreEl.innerText : "0";

    if (resultTitle) resultTitle.innerText = isVictory ? "MISSION RÉUSSIE !" : "BRIGADE VIRÉE !";
    if (finalScoreDisplay) finalScoreDisplay.innerText = currentScore;
    showScreen('screen-result');
}

// ==========================================
// 6. SYSTÈME (RESIZE, PAUSE, CLAVIER)
// ==========================================

function resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    const hud = document.getElementById('hud');
    if (canvas) {
        canvas.width = 900;
        const offset = hud ? hud.offsetHeight : 0;
        canvas.height = window.innerHeight - offset;
    }
}

function togglePause() {
    if (document.getElementById('screen-game').classList.contains('active')) {
        isPaused = !isPaused;
        const overlay = document.getElementById('pause-overlay');
        if (overlay) overlay.style.display = isPaused ? 'flex' : 'none';
    }
}

window.addEventListener('resize', resizeCanvas);

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") togglePause();
    if (e.key.toLowerCase() === "e") socket.emit('toggleLever');
});

const btnResume = document.getElementById('btn-resume');
if (btnResume) btnResume.addEventListener('click', togglePause);