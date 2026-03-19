import { GameRenderer } from './renderer.js';

const socket = io(); 

let renderer = null; 
let currentPseudo = "";
let selectedColor = "gray";
let nbPlayers = 2;
let modeAmi = true;
let isPaused = false;
let isAdmin = false; 

let currentState = { players: {}, tomatoes: [], hearts: [], knives: [] }; 

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

socket.on('takenColors', (taken) => {
    let isSelectedAvailable = false;
    
    document.querySelectorAll('.color-opt').forEach(opt => {
        const color = opt.getAttribute('data-color');
        if (taken.includes(color)) {
            opt.style.opacity = '0.2';
            opt.style.pointerEvents = 'none';
            opt.classList.remove('active');
        } else {
            opt.style.opacity = '1';
            opt.style.pointerEvents = 'auto';
            if (selectedColor === color) {
                isSelectedAvailable = true;
            }
        }
    });

    if (!isSelectedAvailable) {
        const firstAvailable = Array.from(document.querySelectorAll('.color-opt')).find(opt => opt.style.pointerEvents === 'auto');
        if (firstAvailable) {
            firstAvailable.classList.add('active');
            selectedColor = firstAvailable.getAttribute('data-color');
        }
    }
});

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
        alert("Hé ! Entre un nom !");
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
    showScreen('screen-game');
    initGameEngine();
});

socket.on('worldState', (state) => {
    currentState = state; 
    
    if (state.players[socket.id]) {
        const myPlayer = state.players[socket.id];
        const livesEl = document.getElementById('lives-display');
        if (livesEl) {
            if (modeAmi) {
                livesEl.innerHTML = "---";
            } else if (myPlayer.isDead) {
                livesEl.innerHTML = "👻 SPECTATEUR";
            } else {
                let heartsHtml = "";
                for(let i = 0; i < myPlayer.lives; i++) {
                    heartsHtml += `<img src="assets/coeur.png" style="width: 24px; height: 24px; vertical-align: middle; margin-right: 5px; margin-bottom: 4px;">`;
                }
                livesEl.innerHTML = heartsHtml;
            }
        }
    }
});

socket.on('playerDisconnected', (id) => { delete currentState.players[id]; });

socket.on('gameWon', (heroName) => {
    isPaused = true; 
    clearInterval(window.gameTimer); 
    
    const resultTitle = document.getElementById('result-title');
    if (resultTitle) {
        resultTitle.innerHTML = `<span class='text-glow-green'>VICTOIRE DE ${heroName.toUpperCase()} !</span><br><span class='text-shake-red' style='font-size: 1.5rem; display: inline-block; margin-top: 20px;'>IL A PIQUÉ LE FROMAGE !</span>`;
    }
    
    endGame(true); 
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

function initGameEngine() {
    const canvas = document.getElementById('gameCanvas');
    resizeCanvas();

    if (modeAmi) {
        const livesEl = document.getElementById('lives-display');
        if (livesEl) livesEl.innerHTML = "---";
    }

    if (!renderer) {
        renderer = new GameRenderer(canvas, selectedColor, socket); 
        function gameLoop() {
            if (!isPaused) {
                // 🌟 L'Écran Noir en mode Coop
                if (modeAmi) {
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = "black";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    ctx.fillStyle = "#00FF41";
                    ctx.font = "20px 'Press Start 2P', cursive";
                    ctx.textAlign = "center";
                    ctx.fillText("MODE COOP", canvas.width / 2, canvas.height / 2 - 30);
                    
                    ctx.fillStyle = "white";
                    ctx.fillText("EN COURS DE CHARGEMENT...", canvas.width / 2, canvas.height / 2 + 20);
                } else {
                    renderer.draw(currentState); 
                }
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
    
    if (modeAmi) {
        if(timerDisplay) timerDisplay.innerText = "--:--";
        return; 
    }

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
    if (canvas) {
        canvas.width = 900; 
        canvas.height = window.innerHeight - 80; // 🌟 FIX : On soustrait toujours la taille fixe de notre HUD !
    }
}

function togglePause() {
    if (document.getElementById('screen-game').classList.contains('active')) {
        isPaused = !isPaused;
        const overlay = document.getElementById('pause-overlay');
        if(overlay) overlay.style.display = isPaused ? 'flex' : 'none';
    }
}

window.addEventListener('resize', resizeCanvas);
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") togglePause();
    if (e.key.toLowerCase() === "e") socket.emit('toggleLever'); 
});
const btnResume = document.getElementById('btn-resume');
if(btnResume) btnResume.addEventListener('click', togglePause);