import { GameRenderer } from './renderer.js';

let renderer = null; 
let currentPseudo = "";
let selectedColor = "gray";
let nbPlayers = 2;
let modeAmi = true;

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// Sélection couleur
document.querySelectorAll('.color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        selectedColor = opt.getAttribute('data-color');
    });
});

// Connexion -> Lobby
document.getElementById('btn-to-lobby').addEventListener('click', () => {
    const input = document.getElementById('pseudo');
    currentPseudo = input.value.trim();
    if (currentPseudo !== "") {
        const mySlot = document.getElementById('slot-1');
        if(mySlot) mySlot.innerText = currentPseudo.toUpperCase() + " (MOI)";
        showScreen('screen-lobby');
    } else {
        alert("Hé commis ! Entre un nom !");
    }
});

// Choix 2/4 Joueurs
const opt2 = document.getElementById('opt-2-players');
const opt4 = document.getElementById('opt-4-players');
const extraSlots = document.querySelectorAll('.extra-slot');

opt2.addEventListener('click', () => {
    nbPlayers = 2;
    opt2.classList.add('active');
    opt4.classList.remove('active');
    extraSlots.forEach(s => s.style.display = 'none');
});

opt4.addEventListener('click', () => {
    nbPlayers = 4;
    opt4.classList.add('active');
    opt2.classList.remove('active');
    extraSlots.forEach(s => s.style.display = 'block');
});

// Choix Ami/Ennemi
const optAmi = document.getElementById('opt-mode-ami');
const optEnnemi = document.getElementById('opt-mode-ennemi');

optAmi.addEventListener('click', () => {
    modeAmi = true;
    optAmi.classList.add('active');
    optEnnemi.classList.remove('active');
});

optEnnemi.addEventListener('click', () => {
    modeAmi = false;
    optEnnemi.classList.add('active');
    optAmi.classList.remove('active');
});

// --- GESTION DU CANVAS ET DU JEU ---

function resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    const hud = document.getElementById('hud');
    
    if (canvas && hud) {
        canvas.width = 900; // Largeur fixe
        // La hauteur = toute la fenêtre moins la place prise par le HUD
        canvas.height = window.innerHeight - hud.offsetHeight; 
        console.log("Canvas : 900x" + canvas.height);
    }
}

// UN SEUL écouteur pour lancer le service
document.getElementById('btn-start-service').addEventListener('click', () => {
    showScreen('screen-game');
    resizeCanvas(); // On prépare la taille
    
    const canvas = document.getElementById('gameCanvas');
    
    // On initialise le moteur de rendu seulement s'il n'existe pas
    if (!renderer) {
        // On passe la couleur sélectionnée au constructeur
        renderer = new GameRenderer(canvas, selectedColor); 
        
        function gameLoop() {
            renderer.draw();
            requestAnimationFrame(gameLoop);
        }
        gameLoop();
    } else {
        // Si le renderer existe déjà, on met juste à jour la couleur du rat
        renderer.setPlayerColor(selectedColor);
    }

    startTestTimer();
});

function startTestTimer() {
    let timeLeft = 180;
    const timerDisplay = document.getElementById('timer');
    // On nettoie un éventuel ancien timer s'il tourne encore
    if (window.currentTimer) clearInterval(window.currentTimer);

    window.currentTimer = setInterval(() => {
        timeLeft--;
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerDisplay.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (timeLeft <= 0) {
            clearInterval(window.currentTimer);
            showScreen('screen-login');
        }
    }, 1000);
}

window.addEventListener('resize', resizeCanvas);