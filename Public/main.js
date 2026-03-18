import { GameRenderer } from './renderer.js';

const socket = io();

// ==========================================
// 1. INITIALISATION & SONS
// ==========================================
const sfx = {
    click: new Audio('assets/bouton_lobby.ogg'),
    victory: new Audio('assets/victoire.wav'),
    defeat: new Audio('assets/defaite.wav')
};
Object.values(sfx).forEach(s => s.volume = 0.4);

function playSound(sound) {
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log("Audio bloqué :", e));
    }
}

let renderer = null;
let currentPseudo = "";
let selectedColor = "gray";
let nbPlayers = 2;
let modeAmi = true;
let isPaused = false;
let isAdmin = false;

let allPlayers = {};

// ==========================================
// 2. ÉLÉMENTS DU DOM
// ==========================================
const opt2 = document.getElementById('opt-2-players');
const opt4 = document.getElementById('opt-4-players');
const optAmi = document.getElementById('opt-mode-ami');
const optEnnemi = document.getElementById('opt-mode-ennemi');
const extraSlotsContainer = document.getElementById('extra-slots');

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// ==========================================
// 3. LOGIQUE LOBBY & CONNEXION
// ==========================================

document.querySelectorAll('.color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
        playSound(sfx.click); // 🔊 Son au clic couleur
        document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        selectedColor = opt.getAttribute('data-color');
    });
});

document.getElementById('btn-to-lobby').addEventListener('click', () => {
    playSound(sfx.click); // 🔊 Son au bouton rejoindre
    const input = document.getElementById('pseudo');
    currentPseudo = input.value.trim();
    if (currentPseudo !== "") {
        socket.emit('login', { pseudo: currentPseudo, color: selectedColor });
    } else {
        alert("Hé commis ! Entre un nom !");
    }
});

socket.on('loginSuccess', (playerData) => {
    showScreen('screen-lobby');
});

socket.on('loginFailed', (message) => { alert(message); });

function updatePlayersSlots(playersObj) {
    const playersList = Object.values(playersObj);
    for (let i = 1; i <= 4; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if (slot) { slot.innerText = "EN ATTENTE..."; slot.classList.remove('active'); }
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

    isAdmin = (playersList[0] && playersList[0].id === socket.id);
    document.getElementById('btn-start-service').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('wait-message').style.display = isAdmin ? 'none' : 'block';
    enableLobbyInteractions(isAdmin);
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
        opt2.classList.add('active'); opt4.classList.remove('active');
        if (extraSlotsContainer) extraSlotsContainer.style.display = 'none';
    } else {
        opt4.classList.add('active'); opt2.classList.remove('active');
        if (extraSlotsContainer) extraSlotsContainer.style.display = 'contents';
    }
    if (modeAmi) {
        optAmi.classList.add('active'); optEnnemi.classList.remove('active');
    } else {
        optEnnemi.classList.add('active'); optAmi.classList.remove('active');
    }
});

// Ajout des sons aux clics de configuration
opt2.addEventListener('click', () => { if (isAdmin) { playSound(sfx.click); socket.emit('updateConfig', { nbPlayers: 2, modeAmi: modeAmi }); } });
opt4.addEventListener('click', () => { if (isAdmin) { playSound(sfx.click); socket.emit('updateConfig', { nbPlayers: 4, modeAmi: modeAmi }); } });
optAmi.addEventListener('click', () => { if (isAdmin) { playSound(sfx.click); socket.emit('updateConfig', { nbPlayers: nbPlayers, modeAmi: true }); } });
optEnnemi.addEventListener('click', () => { if (isAdmin) { playSound(sfx.click); socket.emit('updateConfig', { nbPlayers: nbPlayers, modeAmi: false }); } });

document.getElementById('btn-start-service').addEventListener('click', () => {
    if (isAdmin) {
        playSound(sfx.click); // 🔊 Son au lancement
        socket.emit('requestStart');
    }
});

// ==========================================
// 4. LOGIQUE JEU
// ==========================================

socket.on('gameStarted', (config) => {
    showScreen('screen-game');
    initGameEngine();

    // Mise à jour de l'indice visuel sur le mur
    const hintAction = document.getElementById('dynamic-action-text');
    if (hintAction) {
        // Comme on ne pousse plus, c'est INTERAGIR pour tout le monde
        hintAction.innerText = "INTERAGIR (LEVIER)";
        hintAction.className = config.modeAmi ? "hint-text mode-ami-text" : "hint-text mode-rival-text";
    }
});

socket.on('worldState', (state) => {
    allPlayers = state.players;
});

socket.on('playerDisconnected', (id) => { delete allPlayers[id]; });

function initGameEngine() {
    const canvas = document.getElementById('gameCanvas');
    resizeCanvas();

    if (!renderer) {
        renderer = new GameRenderer(canvas, selectedColor, socket);
        function gameLoop() {
            if (!isPaused) renderer.draw(allPlayers);
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
    // 🔊 Déclenchement des sons de fin
    if (isVictory) playSound(sfx.victory);
    else playSound(sfx.defeat);

    const resultTitle = document.getElementById('result-title');
    const finalScoreDisplay = document.getElementById('final-score');
    const scoreEl = document.getElementById('score');
    if (resultTitle) resultTitle.innerText = isVictory ? "MISSION RÉUSSIE !" : "BRIGADE VIRÉE !";
    if (finalScoreDisplay) finalScoreDisplay.innerText = scoreEl ? scoreEl.innerText : "0";
    showScreen('screen-result');
}

// ==========================================
// 5. SYSTÈME (RESIZE, PAUSE, TOUCHES)
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
        if (overlay) {
            overlay.style.display = isPaused ? 'flex' : 'none';
            playSound(sfx.click); // 🔊 Son au toggle pause
        }
    }
}

window.addEventListener('resize', resizeCanvas);

document.addEventListener('keydown', (e) => {
    // 1. La Pause
    if (e.key === "Escape") togglePause();

    // On ne traite les touches que si on est en jeu et pas en pause
    if (isPaused || !document.getElementById('screen-game').classList.contains('active')) return;

    const key = e.key.toLowerCase();

    // --- 🏃 DÉPLACEMENTS (Q/D) ---
    if (key === 'd' || key === 'arrowright') {
        socket.emit('playerInput', { action: 'move', vx: 200 });
    }
    if (key === 'q' || key === 'a' || key === 'arrowleft') {
        socket.emit('playerInput', { action: 'move', vx: -200 });
    }

    // --- 🪜 GRIMPER (Z/S ou Flèches) ---
    // On utilise W/S ou Flèches pour monter/descendre sans sauter
    if (key === 'arrowup' || key === 'w') {
        socket.emit('playerInput', { action: 'move_v', vy: -200 });
    }
    if (key === 's' || key === 'arrowdown') {
        socket.emit('playerInput', { action: 'move_v', vy: 200 });
    }

    // --- ⬆️ SAUT (Touche ALT ou Flèche Haut selon ton choix, ici on peut mettre Z) ---
    // Si Z est pour sauter :
    if (key === 'z') {
        socket.emit('playerInput', { action: 'jump' });
    }

    // --- ⚡ ACTION SPÉCIALE (ESPACE = LEVIER + POWERUP) ---
    if (e.code === "Space") {
        e.preventDefault(); // Empêche le scroll de la page

        // On envoie les deux ordres au serveur
        socket.emit('toggleLever', 'lever1');
        socket.emit('playerAction', 'powerup');

        console.log("🔥 Powerup & Levier activés via ESPACE");
    }
});

// Arrêt du mouvement quand on relâche la touche
document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();

    // Arrêt horizontal
    if (['d', 'q', 'a', 'arrowright', 'arrowleft'].includes(key)) {
        socket.emit('playerInput', { action: 'move', vx: 0 });
    }
    // Arrêt vertical (échelles)
    if (['s', 'w', 'arrowup', 'arrowdown'].includes(key)) {
        socket.emit('playerInput', { action: 'move_v', vy: 0 });
    }
});