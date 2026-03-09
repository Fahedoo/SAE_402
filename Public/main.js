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

// Lancement
document.getElementById('btn-start-service').addEventListener('click', () => {
    showScreen('screen-game');
    startTestTimer();
});

function startTestTimer() {
    let timeLeft = 180;
    const timerDisplay = document.getElementById('timer');
    const countdown = setInterval(() => {
        timeLeft--;
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerDisplay.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (timeLeft <= 0) {
            clearInterval(countdown);
            showScreen('screen-login');
        }
    }, 1000);
}

function resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        console.log(`Canvas redimensionné : ${canvas.width}x${canvas.height}`);
    }
}

// On écoute si l'utilisateur change la taille de sa fenêtre
window.addEventListener('resize', resizeCanvas);

// MODIFIE ton bouton de lancement pour appeler resizeCanvas
document.getElementById('btn-start-service').addEventListener('click', () => {
    showScreen('screen-game');
    resizeCanvas(); // On ajuste la taille juste au moment où le jeu commence
    startTestTimer();
});