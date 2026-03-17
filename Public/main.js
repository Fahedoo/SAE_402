// ==========================================
// 1. INITIALISATION & ÉTAT
// ==========================================
const socket = io();

let currentPseudo = "";
let selectedColor = "gray";
let nbPlayers = 2;
let modeAmi = true;
let isPaused = false;
let isAdmin = false;

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

    // Reset des slots
    for (let i = 1; i <= 4; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if (slot) {
            slot.innerText = "EN ATTENTE...";
            slot.classList.remove('active');
        }
    }

    // Remplissage
    playersList.forEach((player, index) => {
        const slotNum = index + 1;
        const slotEl = document.getElementById(`slot-${slotNum}`);
        if (slotEl) {
            slotEl.innerText = player.pseudo.toUpperCase() + (player.id === socket.id ? " (MOI)" : "");
            slotEl.classList.add('active');
        }
    });

    // Check si on devient Chef (si le J1 part)
    if (playersList[0] && playersList[0].id === socket.id) {
        isAdmin = true;
        setChefMode();
    } else {
        isAdmin = false;
        setGuestMode();
    }
}

function setChefMode() {
    document.getElementById('btn-start-service').style.display = 'block';
    document.getElementById('wait-message').style.display = 'none';
    document.querySelectorAll('.choice-card').forEach(card => {
        card.style.pointerEvents = 'auto';
        card.style.opacity = '1';
    });
}

function setGuestMode() {
    document.getElementById('btn-start-service').style.display = 'none';
    document.getElementById('wait-message').style.display = 'block';
    document.querySelectorAll('.choice-card').forEach(card => {
        card.style.pointerEvents = 'none';
        card.style.opacity = '0.5';
    });
}

socket.on('currentPlayers', (players) => updatePlayersSlots(players));

socket.on('configUpdated', (config) => {
    nbPlayers = config.nbPlayers;
    modeAmi = config.modeAmi;

    // Sync visuelle Taille
    if (nbPlayers === 2) {
        opt2.classList.add('active');
        opt4.classList.remove('active');
        extraSlots.forEach(s => s.style.display = 'none');
    } else {
        opt4.classList.add('active');
        opt2.classList.remove('active');
        extraSlots.forEach(s => s.style.display = 'block');
    }

    // Sync visuelle Mode
    if (modeAmi) {
        optAmi.classList.add('active');
        optEnnemi.classList.remove('active');
    } else {
        optEnnemi.classList.add('active');
        optAmi.classList.remove('active');
    }
});

// Événements boutons Lobby
const opt2 = document.getElementById('opt-2-players');
const opt4 = document.getElementById('opt-4-players');
const extraSlots = document.querySelectorAll('.extra-slot');
const optAmi = document.getElementById('opt-mode-ami');
const optEnnemi = document.getElementById('opt-mode-ennemi');

opt2.addEventListener('click', () => isAdmin && socket.emit('updateConfig', { nbPlayers: 2 }));
opt4.addEventListener('click', () => isAdmin && socket.emit('updateConfig', { nbPlayers: 4 }));
optAmi.addEventListener('click', () => isAdmin && socket.emit('updateConfig', { modeAmi: true }));
optEnnemi.addEventListener('click', () => isAdmin && socket.emit('updateConfig', { modeAmi: false }));


// ==========================================
// 5. LOGIQUE JEU (HUD & SCORE)
// ==========================================

document.getElementById('btn-start-service').addEventListener('click', () => {
    socket.emit('requestStart');
});

// ON GARDE SEULEMENT CELUI-CI (Le plus complet)
socket.on('gameStarted', (config) => {
    modeAmi = config.modeAmi;
    showScreen('screen-game');
    resizeCanvas();

    // Logique pour les indications "Style Pierre" sur le mur de gauche
    const hintE = document.getElementById('dynamic-e-text');
    const stoneE = document.querySelector('.key-stone.interact');

    if (hintE && stoneE) {
        if (modeAmi) {
            hintE.innerText = "INTERAGIR";
            hintE.className = "hint-text mode-ami-text";
            stoneE.style.borderColor = "#55aa55"; // Bordure verte
        } else {
            hintE.innerText = "INTERAGIR";
            hintE.className = "hint-text mode-rival-text";
            stoneE.style.borderColor = "#aa5555"; // Bordure rouge
        }
    }
});

// Mise à jour du score par Raphaël (Format Arcade 000000)
socket.on('updateScore', (score) => {
    document.getElementById('score').innerText = score.toString().padStart(6, '0');
});

// Mise à jour du Timer par Raphaël
socket.on('updateTimer', (timeLeft) => {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    document.getElementById('timer').innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
});

// Signal de fin envoyé par le serveur
socket.on('endGame', (data) => {
    endGame(data.isVictory, data.score);
});

function endGame(isVictory, finalScore) {
    const resultScreen = document.getElementById('screen-result');
    const resultTitle = document.getElementById('result-title');
    const resultMsg = document.getElementById('result-message');
    const scoreDisp = document.getElementById('final-score');

    resultScreen.classList.remove('victory', 'game-over');

    if (isVictory) {
        resultScreen.classList.add('victory');
        resultTitle.innerText = "MISSION RÉUSSIE !";
        resultMsg.innerText = "LE CHEF EST FIER DE VOUS !";
    } else {
        resultScreen.classList.add('game-over');
        resultTitle.innerText = "BRIGADE VIRÉE !";
        resultMsg.innerText = "RENDEZ VOS TABLIERS ET SORTEZ !";
    }

    scoreDisp.innerText = (finalScore || 0).toString().padStart(6, '0');
    showScreen('screen-result');
}
// ==========================================
// 6. SYSTÈME (INPUTS & RESIZE)
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
        document.getElementById('pause-overlay').style.display = isPaused ? 'flex' : 'none';
    }
}

window.addEventListener('resize', resizeCanvas);

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") togglePause();

    // SÉCURITÉ TOUCHE E + LOGIQUE MODE
    if (e && e.key && e.key.toLowerCase() === "e") {
        if (modeAmi) {
            console.log("Action : Levier");
            socket.emit('toggleLever', 'lever1');
        } else {
            console.log("Action : Pousser");
            socket.emit('playerAction', 'push');
        }
    }
});

document.getElementById('btn-resume').addEventListener('click', togglePause);