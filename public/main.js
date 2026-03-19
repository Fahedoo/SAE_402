import { GameRenderer } from './renderer.js';

const socket = io();

// ==========================================
// 1. INITIALISATION DES SONS (TON AJOUT)
// ==========================================
const sfx = {
    click: new Audio('assets/bouton_lobby.ogg'),
    victory: new Audio('assets/victoire.wav'),
    defeat: new Audio('assets/defaite.wav'),
    start: new Audio('assets/start_game.mp3'),
    tomatoHit: new Audio('assets/tomate_eclate.mp3'),
    knifeHit: new Audio('assets/couteau_tombe.ogg'),
    powerUp: new Audio('assets/powerup.ogg'),
    chefAttack: new Audio('assets/chef_enerve.wav'),
    jump: new Audio('assets/saut.ogg')
};
Object.values(sfx).forEach(s => s.volume = 0.4);
sfx.start.volume = 0.05;
sfx.defeat.volume = 0.1;
sfx.victory.volume = 0.1;
sfx.start.loop = true;
function playSound(sound) {
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log("Audio bloqué :", e));
    }
}

function playShortSound(sound, start, duration) {
    if (sound) {
        sound.currentTime = start;
        sound.play().catch(e => console.log("Audio bloqué :", e));
        setTimeout(() => { if (!sound.paused) sound.pause(); }, duration);
    }
}
function stopAllSounds() {
    Object.values(sfx).forEach(sound => {
        sound.pause();
        sound.currentTime = 0;
    });
}

// Variables d'état
let renderer = null;
let currentPseudo = "";
let selectedColor = "gray";
let nbPlayers = 2;
let modeAmi = true;
let isPaused = false;
let isAdmin = false;

let currentState = { players: {}, tomatoes: [], hearts: [], knives: [] };

// Variables pour détecter les changements (Sons)
let lastLives = 3;
let lastTomatoCount = 0;
let lastKnifeCount = 0;

// ==========================================
// 2. LOGIQUE LOBBY
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
        playSound(sfx.click); // 🔊 SON
        document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        selectedColor = opt.getAttribute('data-color');
    });
});

document.getElementById('btn-to-lobby').addEventListener('click', () => {
    playSound(sfx.click); // 🔊 SON
    const input = document.getElementById('pseudo');
    currentPseudo = input.value.trim();
    if (currentPseudo !== "") {
        socket.emit('login', { pseudo: currentPseudo, color: selectedColor });
    } else {
        alert("Hé ! Entre un nom !");
    }
});

socket.on('loginSuccess', () => showScreen('screen-lobby'));
socket.on('loginFailed', (message) => alert(message));

// ==========================================
// 3. LE CŒUR DU JEU (LÀ OÙ TES SONS SE DÉCLENCHENT)
// ==========================================
socket.on('worldState', (state) => {
    // 1. Mise à jour de l'état global pour le Renderer (Selma)
    currentState = state;

    const myPlayer = state.players[socket.id];
    if (myPlayer) {
        // --- 🔊 GESTION DES SONS D'IMPACT & POWERUPS ---
        if (myPlayer.lives < lastLives) {
            // On joue le son selon l'objet qui a disparu
            if (state.knives.length < lastKnifeCount) playSound(sfx.knifeHit);
            else playSound(sfx.tomatoHit);
        } else if (myPlayer.lives > lastLives) {
            playSound(sfx.powerUp);
        }
        lastLives = myPlayer.lives;

        // --- ❤️ MISE À JOUR DU HUD (CŒURS) ---
        const livesEl = document.getElementById('lives-display');
        if (livesEl) {
            if (modeAmi) {
                livesEl.innerHTML = "---";
            } else if (myPlayer.isDead) {
                livesEl.innerHTML = "👻 SPECTATEUR";
            } else {
                let heartsHtml = "";
                for (let i = 0; i < myPlayer.lives; i++) {
                    heartsHtml += `<img src="assets/coeur.png" style="width: 24px; height: 24px; vertical-align: middle; margin-right: 5px; margin-bottom: 4px;">`;
                }
                livesEl.innerHTML = heartsHtml;
            }
        }

        // --- 🎒 GESTION DE L'INVENTAIRE (DA ARDOISE) ---
        const icon = document.getElementById('inventory-icon');
        const emptyText = document.getElementById('inventory-empty');
        const box = document.getElementById('inventory-box');

        if (myPlayer.inventaire) {
            // Association entre le nom du pouvoir et le fichier image
            const powerupImages = {
                'éclair': 'assets/éclair.png',
                'piege': 'assets/piege.png',
                'vin': 'assets/vin.png',
                'ressort': 'assets/ressort.png'
            };

            const newSrc = powerupImages[myPlayer.inventaire];

            // Si on vient de ramasser l'objet (changement d'image)
            if (icon.src.indexOf(newSrc) === -1) {
                icon.src = newSrc;
                icon.style.display = 'block';
                emptyText.style.display = 'none';

                // Petite animation de vibration "DA"
                box.classList.add('item-pickup');
                setTimeout(() => box.classList.remove('item-pickup'), 300);
            }
        } else {
            // Inventaire vide
            icon.style.display = 'none';
            icon.src = "";
            emptyText.style.display = 'block';
        }
    }

    // --- 👨‍🍳 GESTION DU CRI DU CHEF (ATTAQUE) ---
    // Si le nombre de projectiles augmente, le chef crie
    if (state.tomatoes.length > lastTomatoCount || state.knives.length > lastKnifeCount) {
        playShortSound(sfx.chefAttack, 1.2, 1000);
    }

    // Mise à jour des compteurs pour le prochain tick
    lastTomatoCount = state.tomatoes.length;
    lastKnifeCount = state.knives.length;
});

// ==========================================
// 4. FIN DE PARTIE & CONFIG
// ==========================================
socket.on('gameWon', (heroName) => {
    isPaused = true;
    clearInterval(window.gameTimer);
    stopAllSounds();
    playSound(sfx.victory); // 🔊 SON
    const resultTitle = document.getElementById('result-title');
    if (resultTitle) resultTitle.innerHTML = `<span class='text-glow-green'>VICTOIRE DE ${heroName.toUpperCase()} !</span>`;
    showScreen('screen-result');
});

socket.on('gameOver', () => {
    isPaused = true;
    clearInterval(window.gameTimer);
    stopAllSounds();
    playSound(sfx.defeat); // 🔊 SON
    const resultTitle = document.getElementById('result-title');
    if (resultTitle) resultTitle.innerHTML = "<span class='text-shake-red'>TOUT LE MONDE EST K.O. !</span>";
    showScreen('screen-result');
});

socket.on('configUpdated', (config) => {
    nbPlayers = config.nbPlayers; modeAmi = config.modeAmi;
    opt2.classList.toggle('active', nbPlayers === 2);
    opt4.classList.toggle('active', nbPlayers === 4);
    optAmi.classList.toggle('active', modeAmi);
    optEnnemi.classList.toggle('active', !modeAmi);
});

[opt2, opt4, optAmi, optEnnemi].forEach(btn => {
    btn.addEventListener('click', () => {
        if (isAdmin) {
            playSound(sfx.click); // 🔊 SON
            if (btn === opt2) socket.emit('updateConfig', { nbPlayers: 2, modeAmi });
            if (btn === opt4) socket.emit('updateConfig', { nbPlayers: 4, modeAmi });
            if (btn === optAmi) socket.emit('updateConfig', { nbPlayers, modeAmi: true });
            if (btn === optEnnemi) socket.emit('updateConfig', { nbPlayers, modeAmi: false });
        }
    });
});

document.getElementById('btn-start-service').addEventListener('click', () => {
    if (isAdmin) {
        playSound(sfx.click); // 🔊 SON
        socket.emit('requestStart');
    }
});

// ==========================================
// 5. ENGINE & SYSTÈME
// ==========================================
socket.on('gameStarted', () => {
    playSound(sfx.start); // 🔊 SON
    showScreen('screen-game');
    initGameEngine();
});

function initGameEngine() {
    const canvas = document.getElementById('gameCanvas');
    resizeCanvas();
    if (!renderer) {
        renderer = new GameRenderer(canvas, selectedColor, socket);
        function gameLoop() {
            if (!isPaused) {
                // On retire son écran noir du mode Coop pour que tu vois le jeu
                renderer.draw(currentState);
            }
            requestAnimationFrame(gameLoop);
        }
        gameLoop();
    }
    startTestTimer();
}

function resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        canvas.width = 900;
        canvas.height = window.innerHeight - 80;
    }
}

document.addEventListener('keydown', (e) => {
    if (isPaused || !document.getElementById('screen-game').classList.contains('active')) return;

    const key = e.key.toLowerCase();

    // 🏃 MOUVEMENTS (Q / D)
    if (key === 'd' || key === 'arrowright') socket.emit('playerInput', { action: 'move', vx: 200 });
    if (key === 'q' || key === 'a' || key === 'arrowleft') socket.emit('playerInput', { action: 'move', vx: -200 });

    // 🪜 ÉCHELLES (On garde les flèches ou W/S pour grimper)
    if (key === 'w' || key === 's' || key === 'arrowdown') {
        socket.emit('playerInput', { action: 'move_v', vy: (key === 's' || key === 'arrowdown') ? 200 : -200 });
    }

    // 🦘 SAUT (Z ou Flèche Haut)
    if ((key === 'z' || e.key === 'ArrowUp') && !e.repeat) {
        playSound(sfx.jump);
        socket.emit('playerInput', { action: 'jump' });
    }

    // ⚙️ ACTIVER LEVIERS (Touche E)
    if (key === 'e') {
        socket.emit('toggleLever', 'lever1');
    }

    // 🚀 UTILISER POUVOIR (Espace)
    if (e.code === "Space") {
        e.preventDefault(); // Empêche la page de descendre
        socket.emit('playerInput', { action: 'usePowerup' }); // Ou le nom de ton action powerup
    }
});

// N'oublie pas le keyup pour arrêter de bouger
document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (['d', 'q', 'a', 'arrowright', 'arrowleft'].includes(key)) {
        socket.emit('playerInput', { action: 'move', vx: 0 });
    }
    if (['w', 's', 'arrowup', 'arrowdown'].includes(key)) {
        socket.emit('playerInput', { action: 'move_v', vy: 0 });
    }
});

// Garde les fonctions utilitaires (timer, slots, etc.) en bas
// Supprime tout ce qu'il y a après la ligne 197 (après le keyup)
// Et remplace par ce bloc propre :

window.addEventListener('resize', resizeCanvas);

socket.on('currentPlayers', (players) => updatePlayersSlots(players));

socket.on('gameStarted', (config) => {
    stopAllSounds(); // On coupe les sons du lobby
    playSound(sfx.start);
    showScreen('screen-game');

    const modeText = document.getElementById('mode-text');
    const instructions = document.getElementById('game-instructions');
    const inventory = document.getElementById('inventory-box');

    // On affiche l'inventaire direct
    if (inventory) {
        inventory.style.display = "block";
        inventory.style.opacity = "1";
    }

    if (modeText) {
        if (config.modeAmi) {
            modeText.innerText = "COOPÉRATEUR : AIDEZ-VOUS !";
            modeText.style.color = "#2ecc71";
        } else {
            modeText.innerText = "RIVALITÉ : CHACUN POUR SOI !";
            modeText.style.color = "#e74c3c";
        }
    }

    if (instructions) {
        instructions.style.opacity = "1";
        setTimeout(() => {
            instructions.style.opacity = "0";
        }, 7000);
    }

    initGameEngine();
});

function updatePlayersSlots(playersObj) {
    const playersList = Object.values(playersObj);

    // 1. On réinitialise les 4 slots
    for (let i = 1; i <= 4; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if (slot) {
            slot.innerText = "EN ATTENTE...";
            slot.classList.remove('active');
            slot.style.color = "white";
        }
    }

    // 2. On affiche les joueurs connectés
    playersList.forEach((player, index) => {
        const slotNum = index + 1;
        const slotEl = document.getElementById(`slot-${slotNum}`);
        if (slotEl) {
            slotEl.innerText = player.pseudo.toUpperCase() + (player.id === socket.id ? " (MOI)" : "");
            slotEl.classList.add('active');
            slotEl.style.color = player.color; // Applique la couleur du rat choisi
        }
    });

    // 3. On définit qui est l'admin (le premier de la liste)
    isAdmin = (playersList[0] && playersList[0].id === socket.id);

    // Affichage du bouton "Lancer" seulement pour l'admin
    const startBtn = document.getElementById('btn-start-service');
    const waitMsg = document.getElementById('wait-message');
    if (startBtn) startBtn.style.display = isAdmin ? 'block' : 'none';
    if (waitMsg) waitMsg.style.display = isAdmin ? 'none' : 'block';

    enableLobbyInteractions(isAdmin);
}

function enableLobbyInteractions(enabled) {
    // Active ou désactive les boutons de config selon si on est admin ou pas
    document.querySelectorAll('.choice-card').forEach(el => {
        el.style.pointerEvents = enabled ? 'auto' : 'none';
        el.style.opacity = enabled ? '1' : '0.5';
    });
}