// ==========================================
// 1. GESTIONNAIRE DE CLAVIER (ZQSD + Flèches)
// ==========================================
class Clavier {
    constructor() {
        // On stocke les actions logiques, pas les touches physiques
        this.touches = {
            gauche: false,
            droite: false,
            saut: false,
            bas: false
        };

        window.addEventListener('keydown', (e) => this.actualiserTouche(e.key, true));
        window.addEventListener('keyup', (e) => this.actualiserTouche(e.key, false));
    }

    actualiserTouche(cle, etat) {
        const touche = cle.toLowerCase();
        
        // On associe ZQSD ET les flèches aux mêmes actions
        if (touche === 'q' || touche === 'arrowleft') this.touches.gauche = etat;
        if (touche === 'd' || touche === 'arrowright') this.touches.droite = etat;
        if (touche === 'z' || touche === 'arrowup') this.touches.saut = etat;
        if (touche === 's' || touche === 'arrowdown') this.touches.bas = etat;
    }
}

// ==========================================
// 2. SIMULATION PHYSIQUE (Le travail de Fahed)
// ==========================================
class EntitePhysique {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0; // Vélocité X (gauche/droite)
        this.vy = 0; // Vélocité Y (haut/bas)
    }

    appliquerPhysique() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Fausse gravité et faux sol pour tes tests
        if (this.y > 500) { 
            this.y = 500;
            this.vy = 0; // On s'arrête de tomber
        } else if (this.y < 500) {
            this.vy += 0.5; // On tombe de plus en plus vite
        }
    }
}

// ==========================================
// 3. LOGIQUE DU PERSONNAGE (Ton travail !)
// ==========================================
class Rat extends EntitePhysique {
    constructor(x, y, idJoueur, couleur) {
        super(x, y);
        
        this.idJoueur = idJoueur;
        this.couleur = couleur;
        
        // Paramètres de Gameplay
        this.vitesseMarche = 5; 
        this.forceSaut = -12; // Négatif car Y monte vers le haut
    }

    calculerVelocite(touches) {
        // --- AXE X : Déplacements Horizontaux ---
        if (touches.gauche) {
            this.vx = -this.vitesseMarche;
        } else if (touches.droite) {
            this.vx = this.vitesseMarche;
        } else {
            this.vx = 0; // Friction/Arrêt
        }

        // --- AXE Y : Saut ---
        // On vérifie qu'on est au sol (y == 500 dans notre simulation)
        if (touches.saut && this.y === 500) {
            this.vy = this.forceSaut;
        }

        // --- AXE Y : Descendre ---
        if (touches.bas) {
            // Prêt pour plus tard (ex: descendre des plateformes)
        }
    }
}

// ==========================================
// 4. INITIALISATION & BOUCLE DE JEU
// ==========================================

const clavier = new Clavier();
const monRat = new Rat(100, 500, "joueur1", "gris"); 

// Chargement de ton Sprite (pense à modifier le nom du fichier PNG !)
const spriteRat = new Image();
spriteRat.src = '../assets/sprites/rats/rat_cours.png'; 

const canvas = document.getElementById("ecranDeJeu");
const ctx = canvas.getContext("2d");

function boucleDeJeu() {
    // 1. MISE À JOUR LOGIQUE
    monRat.calculerVelocite(clavier.touches);
    monRat.appliquerPhysique();

    // 2. RENDU VISUEL
    // On efface l'image précédente
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // On dessine le sol (Marron)
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(0, 500, canvas.width, 100);

    // On dessine ton sprite de rat (Ajuste le "50, 50" selon la taille de ton PNG)
    ctx.drawImage(spriteRat, monRat.x, monRat.y - 50, 50, 50);

    // On boucle à la prochaine frame (60 FPS)
    requestAnimationFrame(boucleDeJeu);
}

// C'est parti !
boucleDeJeu();