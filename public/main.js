import { GameRenderer } from './renderer.js';

const socket = io(); 

let renderer = null; 
let currentPseudo = "";
let selectedColor = "gray";
let nbPlayers = 2;
let modeAmi = true;
let isPaused = false;
let isAdmin = false; 

let allPlayers = {}; 
// --- NOUVEAU : Stockage des projectiles ---
let currentTomatoes = [];
let currentKnives = [];

let currentLevers = [];
let isCheeseActive = false;

const opt2 = document.getElementById('opt-2-players');
const opt4 = document.getElementById('opt-4-players');
const optAmi = document.getElementById('opt-mode-ami');
const optEnnemi = document.getElementById('opt-mode-ennemi');
const extraSlotsContainer = document.getElementById('extra-slots');

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

socket.on('loginFailed', (message) => { alert(message); });

function updatePlayersSlots(playersObj) {
    const playersList = Object.values(playersObj);
    for (let i = 1; i <= 4; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if(slot) { slot.innerText = "EN ATTENTE..."; slot.classList.remove('active'); }
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
    nbPlayers = config.nbPlayers; modeAmi = config.modeAmi;
    if(nbPlayers === 2) {
        opt2.classList.add('active'); opt4.classList.remove('active');
        if(extraSlotsContainer) extraSlotsContainer.style.display = 'none';
    } else {
        opt4.classList.add('active'); opt2.classList.remove('active');
        if(extraSlotsContainer) extraSlotsContainer.style.display = 'contents';
    }
    if(modeAmi) {
        optAmi.classList.add('active'); optEnnemi.classList.remove('active');
    } else {
        optEnnemi.classList.add('active'); optAmi.classList.remove('active');
    }
});

opt2.addEventListener('click', () => { if(isAdmin) socket.emit('updateConfig', { nbPlayers: 2, modeAmi: modeAmi }); });
opt4.addEventListener('click', () => { if(isAdmin) socket.emit('updateConfig', { nbPlayers: 4, modeAmi: modeAmi }); });
optAmi.addEventListener('click', () => { if(isAdmin) socket.emit('updateConfig', { nbPlayers: nbPlayers, modeAmi: true }); });
optEnnemi.addEventListener('click', () => { if(isAdmin) socket.emit('updateConfig', { nbPlayers: nbPlayers, modeAmi: false }); });

document.getElementById('btn-start-service').addEventListener('click', () => {
    if(isAdmin) socket.emit('requestStart');
});

socket.on('gameStarted', (config) => {
    if (config.modeAmi) {
        showScreen('screen-game');
        initGameEngine();
    } else {
        let blackScreen = document.getElementById('screen-black');
        if (!blackScreen) {
            blackScreen = document.createElement('div');
            blackScreen.id = 'screen-black';
            blackScreen.className = 'screen'; 
            blackScreen.style.backgroundColor = 'black';
            blackScreen.style.width = '100vw';
            blackScreen.style.height = '100vh';
            blackScreen.style.display = 'flex';
            blackScreen.style.alignItems = 'center';
            blackScreen.style.justifyContent = 'center';
            blackScreen.innerHTML = '<h1 style="color: white; font-family: Arial;">Mode Ennemi - En cours de développement...</h1>';
            document.body.appendChild(blackScreen);
        }
        showScreen('screen-black');
    }
});

// --- MODIFIÉ : Récupération de l'état complet du monde ---
socket.on('worldState', (state) => {
    allPlayers = state.players; 
    currentTomatoes = state.tomatoes || [];
    currentKnives = state.knives || [];
});

socket.on('gameState', (data) => {
    currentLevers = data.levers;
    isCheeseActive = data.cheeseActive;
    
    if (renderer) {
        renderer.levers = currentLevers;
        renderer.cheeseActive = isCheeseActive;
    }
});

socket.on('gameWon', (heroName) => {
    isPaused = true; 
    const resultTitle = document.getElementById('result-title');
    if (resultTitle) {
        resultTitle.innerHTML = `<span class='text-glow-green'>VICTOIRE DE ${heroName.toUpperCase()} !</span>`;
    }
    console.log("Tentative d'affichage victoire");
    showScreen('screen-result'); 
});

socket.on('gameOver', () => {
    isPaused = true; 
    clearInterval(window.gameTimer); 
    const resultTitle = document.getElementById('result-title');
    if (resultTitle) {
        resultTitle.innerHTML = "<span class='text-shake-red'>TOUT LE MONDE EST K.O. !</span><br><span style='font-size: 1.5rem; color: #888; display: inline-block; margin-top: 20px; text-shadow: none; animation: none;'>LE CHEF A GAGNÉ...</span>";
    }
    endGame(false);
});

socket.on('playerDisconnected', (id) => { delete allPlayers[id]; });

function initGameEngine() {
    const canvas = document.getElementById('gameCanvas');
    resizeCanvas();

    if (!renderer) {
        renderer = new GameRenderer(canvas, selectedColor, socket); 
        
        renderer.levers = currentLevers;
        renderer.cheeseActive = isCheeseActive;

        function gameLoop() {
    if (!isPaused && renderer) {
        // On crée l'objet "state" tel que le renderer l'attend
        const gameState = {
            tomatoes: currentTomatoes,
            knives: currentKnives,
            hearts: [] // Tu pourras ajouter currentHearts ici plus tard
        };

        // On appelle le draw avec les deux arguments
        renderer.draw(allPlayers, gameState);
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
            if(timerDisplay) timerDisplay.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            if (timeLeft <= 0) {
                clearInterval(window.gameTimer);
                const resultTitle = document.getElementById('result-title');
                if (resultTitle) resultTitle.innerHTML = "<span class='text-shake-red'>LE TEMPS EST ÉCOULÉ !</span><br><span style='font-size: 1.5rem; color: #888; display: inline-block; margin-top: 20px; text-shadow: none; animation: none;'>PAS DE FROMAGE CE SOIR...</span>";
                endGame(false);
            }
        }
    }, 1000);
}

function endGame(isVictory) {
    showScreen('screen-result');
}

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
        if(overlay) overlay.style.display = isPaused ? 'flex' : 'none';
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        console.log("Affichage de l'écran :", screenId);
    } else {
        console.error("L'ID suivant n'existe pas dans ton HTML :", screenId);
    }
}

window.addEventListener('resize', resizeCanvas);
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") togglePause();
});
const btnResume = document.getElementById('btn-resume');
if(btnResume) btnResume.addEventListener('click', togglePause);