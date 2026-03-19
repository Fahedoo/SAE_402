import { GameRenderer } from './renderer.js';

const socket = io();

// ==========================================
// 1. INITIALISATION DES SONS
// ==========================================
const sfx = {
    click: new Audio('assets/bouton_lobby.ogg'),
    victory: new Audio('assets/victoire.wav'),
    defeat: new Audio('assets/defaite.wav'),
    start: new Audio('assets/start_game.mp3'),
    tomatoHit: new Audio('assets/tomate_eclate.mp3'),
    knifeHit: new Audio('assets/couteau_tombe.ogg'),
    powerUp: new Audio('assets/powerup.ogg'),
    chefAttack: new Audio('assets/chef_enerve.wav')
};

// Réglage volumes
Object.values(sfx).forEach(s => s.volume = 0.4);
sfx.start.volume = 0.05;
sfx.defeat.volume = 0.1;
sfx.victory.volume = 0.1;

function playSound(sound) {
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.warn("Audio bloqué (attente interaction)"));
    }
}

function playShortSound(sound, start, duration) {
    if (sound) {
        sound.currentTime = start;
        sound.play().catch(e => {});
        setTimeout(() => { if (!sound.paused) sound.pause(); }, duration);
    }
}

function stopAllSounds() {
    Object.values(sfx).forEach(sound => {
        sound.pause();
        sound.currentTime = 0;
    });
}

// ==========================================
// 2. VARIABLES D'ÉTAT
// ==========================================
let renderer = null;
let currentPseudo = "";
let selectedColor = "gray";
let nbPlayers = 2;
let modeAmi = true;
let isPaused = false;
let isAdmin = false;

let currentState = { players: {}, tomatoes: [], hearts: [], knives: [], levers: [], cheeseActive: false };

// Mémoire pour les sons
let lastLives = 3;
let lastTomatoCount = 0;
let lastKnifeCount = 0;

// Éléments UI
const opt2 = document.getElementById('opt-2-players');
const opt4 = document.getElementById('opt-4-players');
const optAmi = document.getElementById('opt-mode-ami');
const optEnnemi = document.getElementById('opt-mode-ennemi');

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// ==========================================
// 3. LOGIQUE LOBBY & COULEURS
// ==========================================
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
            if (selectedColor === color) isSelectedAvailable = true;
        }
    });
    // Si ma couleur est prise, j'en prends une autre d'office
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
        playSound(sfx.click);
        document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        selectedColor = opt.getAttribute('data-color');
    });
});

document.getElementById('btn-to-lobby').addEventListener('click', () => {
    playSound(sfx.click);
    const input = document.getElementById('pseudo');
    currentPseudo = input.value.trim();
    if (currentPseudo !== "") {
        socket.emit('login', { pseudo: currentPseudo, color: selectedColor });
    } else {
        alert("Hé commis ! Entre un nom !");
    }
});

socket.on('loginSuccess', () => showScreen('screen-lobby'));
socket.on('loginFailed', (message) => alert(message));

// ==========================================
// 4. SYNCHRO SERVEUR & SONS
// ==========================================
socket.on('worldState', (state) => {
    currentState = state;
    const myPlayer = state.players[socket.id];
    
    if (myPlayer) {
        // Détection impacts
        if (myPlayer.lives < lastLives) {
            if (state.knives.length < lastKnifeCount) playSound(sfx.knifeHit);
            else playSound(sfx.tomatoHit);
        } else if (myPlayer.lives > lastLives) {
            playSound(sfx.powerUp);
        }
        lastLives = myPlayer.lives;

        // HUD Cœurs
        const livesEl = document.getElementById('lives-display');
        if (livesEl) {
            if (modeAmi) {
                livesEl.innerHTML = "<span style='color:#2ecc71'>COOP</span>";
            } else if (myPlayer.isDead) {
                livesEl.innerHTML = "👻 SPECTATEUR";
            } else {
                let heartsHtml = "";
                for (let i = 0; i < myPlayer.lives; i++) {
                    heartsHtml += `<img src="assets/coeur.png" style="width: 24px; margin-right: 5px;">`;
                }
                livesEl.innerHTML = heartsHtml;
            }
        }
    }

    // Cri du chef (attaque)
    if (state.tomatoes.length > lastTomatoCount || state.knives.length > lastKnifeCount) {
        playShortSound(sfx.chefAttack, 1.2, 1000);
    }
    lastTomatoCount = state.tomatoes.length;
    lastKnifeCount = state.knives.length;
});

// Admin config
socket.on('configUpdated', (config) => {
    nbPlayers = config.nbPlayers; 
    modeAmi = config.modeAmi;
    if(opt2) opt2.classList.toggle('active', nbPlayers === 2);
    if(opt4) opt4.classList.toggle('active', nbPlayers === 4);
    if(optAmi) optAmi.classList.toggle('active', modeAmi);
    if(optEnnemi) optEnnemi.classList.toggle('active', !modeAmi);
});

[opt2, opt4, optAmi, optEnnemi].forEach(btn => {
    if(!btn) return;
    btn.addEventListener('click', () => {
        if (isAdmin) {
            playSound(sfx.click);
            let newNb = (btn === opt2) ? 2 : (btn === opt4 ? 4 : nbPlayers);
            let newMode = (btn === optAmi) ? true : (btn === optEnnemi ? false : modeAmi);
            socket.emit('updateConfig', { nbPlayers: newNb, modeAmi: newMode });
        }
    });
});

document.getElementById('btn-start-service').addEventListener('click', () => {
    if (isAdmin) {
        playSound(sfx.click);
        socket.emit('requestStart');
    }
});

// ==========================================
// 5. MOTEUR DE JEU
// ==========================================
socket.on('gameStarted', (config) => {
    playSound(sfx.start);
    modeAmi = config.modeAmi;
    showScreen('screen-game');
    
    const modeText = document.getElementById('mode-text');
    if (modeText) {
        modeText.innerText = modeAmi ? "COOPÉRATEUR : AIDEZ-VOUS !" : "RIVALITÉ : CHACUN POUR SOI !";
        modeText.style.background = modeAmi ? "#2ecc71" : "#e74c3c";
    }
    
    initGameEngine();
});

function initGameEngine() {
    const canvas = document.getElementById('gameCanvas');
    resizeCanvas();
    
    // 1. On détruit proprement l'ancien renderer s'il existe
    if (renderer) {
        renderer = null; 
    }

    const modeKey = modeAmi ? 'coop' : 'ennemi';

    // 2. On crée le nouveau renderer
    renderer = new GameRenderer(canvas, selectedColor, socket, modeKey);
    
    isPaused = false;

    // 3. ON NE LANCE LA BOUCLE QU'UNE SEULE FOIS DANS TOUTE LA VIE DE LA PAGE
    if (!window.gameLoopRunning) {
        window.gameLoopRunning = true;
        
        const runLoop = () => {
            // On vérifie que le renderer existe ET que l'écran de jeu est actif
            if (!isPaused && renderer && document.getElementById('screen-game').classList.contains('active')) {
                renderer.draw(currentState);
            }
            requestAnimationFrame(runLoop);
        };
        
        requestAnimationFrame(runLoop);
    }
    
    startTimer();
}

socket.on('gameWon', (heroName) => {
    isPaused = true;
    stopAllSounds();
    playSound(sfx.victory);
    const title = document.getElementById('result-title');
    if(title) title.innerHTML = `<span class='text-glow-green'>VICTOIRE DE ${heroName.toUpperCase()} !</span>`;
    showScreen('screen-result');
});

socket.on('gameOver', () => {
    isPaused = true;
    stopAllSounds();
    playSound(sfx.defeat);
    const title = document.getElementById('result-title');
    if(title) title.innerHTML = "<span class='text-shake-red'>TOUT LE MONDE EST K.O. !</span>";
    showScreen('screen-result');
});

// ==========================================
// 6. CONTRÔLES & RESIZE
// ==========================================
document.addEventListener('keydown', (e) => {
    if (isPaused || !document.getElementById('screen-game').classList.contains('active')) return;
    
    // CORRECTION : Sécurité sur le toLowerCase
    const key = (e.key || "").toLowerCase();

    if (key === 'd' || key === 'arrowright') socket.emit('playerInput', { action: 'move', vx: 200 });
    if (key === 'q' || key === 'a' || key === 'arrowleft') socket.emit('playerInput', { action: 'move', vx: -200 });
    if (key === 'z' || key === 'w' || key === 'arrowup') socket.emit('playerInput', { action: 'move_v', vy: -200 });
    if (key === 's' || key === 'arrowdown') socket.emit('playerInput', { action: 'move_v', vy: 200 });
    
    if (key === ' ') { 
        e.preventDefault(); 
        socket.emit('playerInput', { action: 'jump' }); 
    }
    if (key === 'e') socket.emit('interact');
});

document.addEventListener('keyup', (e) => {
    const key = (e.key || "").toLowerCase();
    if (['d', 'q', 'a', 'arrowright', 'arrowleft'].includes(key)) socket.emit('playerInput', { action: 'move', vx: 0 });
    if (['z', 'w', 's', 'arrowup', 'arrowdown'].includes(key)) socket.emit('playerInput', { action: 'move_v', vy: 0 });
});

function resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        canvas.width = 900;
        canvas.height = window.innerHeight - 80;
    }
}

function startTimer() {
    let timeLeft = 180;
    if (window.gameTimer) clearInterval(window.gameTimer);
    window.gameTimer = setInterval(() => {
        if (!isPaused) {
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            const timerEl = document.getElementById('timer');
            if(timerEl) timerEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            if (timeLeft <= 0) clearInterval(window.gameTimer);
        }
    }, 1000);
}

socket.on('currentPlayers', (players) => updatePlayersSlots(players));
window.addEventListener('resize', resizeCanvas);

function updatePlayersSlots(playersObj) {
    const playersList = Object.values(playersObj);
    for (let i = 1; i <= 4; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if (slot) { slot.innerText = "EN ATTENTE..."; slot.classList.remove('active'); }
    }
    playersList.forEach((player, index) => {
        const slotEl = document.getElementById(`slot-${index + 1}`);
        if (slotEl) {
            slotEl.innerText = player.pseudo.toUpperCase() + (player.id === socket.id ? " (MOI)" : "");
            slotEl.classList.add('active');
            slotEl.style.color = player.color;
        }
    });
    isAdmin = (playersList[0] && playersList[0].id === socket.id);
    const sBtn = document.getElementById('btn-start-service');
    const wMsg = document.getElementById('wait-message');
    if(sBtn) sBtn.style.display = isAdmin ? 'block' : 'none';
    if(wMsg) wMsg.style.display = isAdmin ? 'none' : 'block';
}