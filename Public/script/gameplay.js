// ==========================================
// 1. GESTIONNAIRE DE CLAVIER (ZQSD + Flèches + Action)
// ==========================================
class Clavier {
    constructor() {
        this.touches = {
            gauche: false,
            droite: false,
            saut: false,
            bas: false,
            action: false // NOUVEAU : Touche d'interaction
        };

        window.addEventListener('keydown', (e) => this.actualiserTouche(e.key, true));
        window.addEventListener('keyup', (e) => this.actualiserTouche(e.key, false));
    }

    actualiserTouche(cle, etat) {
        const touche = cle.toLowerCase();
        if (touche === 'q' || touche === 'arrowleft') this.touches.gauche = etat;
        if (touche === 'd' || touche === 'arrowright') this.touches.droite = etat;
        if (touche === 'z' || touche === 'arrowup') this.touches.saut = etat;
        if (touche === 's' || touche === 'arrowdown') this.touches.bas = etat;
        // La touche 'E' ou 'Espace' pour interagir avec les objets
        if (touche === 'e' || touche === ' ') this.touches.action = etat; 
    }
}

// ==========================================
// 2. SIMULATION PHYSIQUE (Provisoire, avant Wasm)
// ==========================================
class EntitePhysique {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0; 
        this.vy = 0; 
    }

    appliquerPhysique() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Fausse gravité
        if (this.y < 500) {
            this.vy += 0.5; // Gravité temporaire
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
        this.vitesseMarche = 3; 
        this.forceSaut = -8; 

        this.boostActif = false; // Usage unique (zone)
        this.surRat = false;     // État continu (bloc)
        this.peutSauter = false; 
    }

    declencherSaut() {
        if (this.boostActif || this.surRat) {
            // 🔥 Saut boosté !
            this.vy = this.forceSaut * 1.4; 
            this.boostActif = false; // On consomme le boost
        } else {
            // Saut normal
            this.vy = this.forceSaut;
        }
    }

    calculerVelocite(touches) {
        if (touches.gauche) {
            this.vx = -this.vitesseMarche;
        } else if (touches.droite) {
            this.vx = this.vitesseMarche;
        } else {
            this.vx = 0; 
        }

        if (touches.saut && this.peutSauter) {
            this.declencherSaut();
            touches.saut = false; 
            this.peutSauter = false; 
        }
    }
}

// ==========================================
// 4. INITIALISATION & ZONES DE JEU
// ==========================================

const clavier = new Clavier();
const monRat = new Rat(100, 500, "joueur1", "gris"); 

// --- ÉTAT GLOBAL DU JEU ---
let jeuTermine = false; 

// --- Élément A : La Zone Magique (Vert) ---
const zoneTestBoost = { x: 200, y: 460, width: 40, height: 40, couleur: "rgba(0, 255, 0, 0.5)" };

// --- Élément B : Le Faux Rat Solide (Gris/Bleu) ---
const fauxRat = { x: 350, y: 450, width: 50, height: 50 };

// --- Élément C : Le Fromage (Objectif de Victoire) ---
const fromage = { x: 450, y: 250, width: 40, height: 40 };

// --- Élément D : Le Levier (Mécanique Coop) ---
const levier = {
    x: 100,
    y: 450, // Posé au sol
    width: 30,
    height: 50,
    estActive: false // Baissé par défaut
};

// --- Élément E : La Cloche (Bloque le fromage) ---
const cloche = {
    x: fromage.x - 10, // Plus large que le fromage pour bien l'englober
    y: fromage.y - 10,
    width: fromage.width + 20,
    height: fromage.height + 20,
    estOuverte: false // Fermée par défaut
};

// Chargement de ton Sprite
const spriteRat = new Image();
spriteRat.src = '../assets/sprites/rats/rat_cours.png'; 

const canvas = document.getElementById("ecranDeJeu");
const ctx = canvas.getContext("2d");

// ==========================================
// 5. BOUCLE DE JEU (MOTEUR D'ACTION)
// ==========================================
function boucleDeJeu() {
    // 1. LOGIQUE DE TES TOUCHES (Bloquée si on a gagné)
    if (!jeuTermine) {
        monRat.calculerVelocite(clavier.touches);
    } else {
        monRat.vx = 0; 
    }

    // 2. PHYSIQUE & GRAVITÉ
    monRat.appliquerPhysique();

    // --- 3. SIMULATION DE COLLISIONS & INTERACTION ---
    monRat.peutSauter = false; 
    monRat.surRat = false; 

    // A. Collision avec le Sol (Y = 500)
    if (monRat.y >= 500) { 
        monRat.y = 500;
        monRat.vy = 0;
        monRat.peutSauter = true; 
    }

    // B. Collision avec le Faux Rat Solide
    let aligneHorizontalement = (monRat.x < fauxRat.x + fauxRat.width && monRat.x + 50 > fauxRat.x);
    if (monRat.vy >= 0 && monRat.y >= fauxRat.y && monRat.y <= fauxRat.y + 20 && aligneHorizontalement) {
        monRat.y = fauxRat.y; 
        monRat.vy = 0;        
        monRat.peutSauter = true; 
        monRat.surRat = true; 
    }

    // C. Collision avec la Zone Magique
    const boiteRat = { x: monRat.x, y: monRat.y - 50, w: 50, h: 50 };
    if (boiteRat.x < zoneTestBoost.x + zoneTestBoost.width &&
        boiteRat.x + boiteRat.w > zoneTestBoost.x &&
        boiteRat.y < zoneTestBoost.y + zoneTestBoost.height &&
        boiteRat.y + boiteRat.h > zoneTestBoost.y) {
        monRat.boostActif = true; 
    }

    // --- NOUVEAU : Logique d'Interaction avec le Levier ---
    const margeInteraction = 30; // Zone autour du levier où on peut agir
    let presDuLevier = (
        boiteRat.x < levier.x + levier.width + margeInteraction &&
        boiteRat.x + boiteRat.w > levier.x - margeInteraction &&
        boiteRat.y < levier.y + levier.height + margeInteraction &&
        boiteRat.y + boiteRat.h > levier.y - margeInteraction
    );

    // Si on est près du levier, qu'on appuie sur E, et qu'il n'est pas déjà activé
    if (presDuLevier && clavier.touches.action && !levier.estActive) {
        levier.estActive = true;
        cloche.estOuverte = true; // Ouvre la cloche
        console.log("Levier activé !");
        
        // Empêche le spam de la touche E
        clavier.touches.action = false; 
    }

    // D. Collision avec le Fromage (Victoire)
    // On doit vérifier que la cloche est bien ouverte !
    if (!jeuTermine && cloche.estOuverte &&
        boiteRat.x < fromage.x + fromage.width &&
        boiteRat.x + boiteRat.w > fromage.x &&
        boiteRat.y < fromage.y + fromage.height &&
        boiteRat.y + boiteRat.h > fromage.y) {
        
        jeuTermine = true;
        console.log("🧀 VICTOIRE ! Le rat a récupéré le fromage !");
    }

    // --- 4. RENDU VISUEL ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner le sol (Marron)
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(0, 500, canvas.width, 100);

    // Dessiner le Levier
    ctx.fillStyle = levier.estActive ? "lime" : "red";
    ctx.fillRect(levier.x, levier.y, levier.width, levier.height);
    
    // Feedback si on est proche du levier
    if (presDuLevier && !levier.estActive) {
        ctx.fillStyle = "white";
        ctx.font = "14px Arial";
        ctx.fillText("[E] Activer", levier.x - 15, levier.y - 10);
    }

    // Dessiner la Zone Magique
    ctx.fillStyle = zoneTestBoost.couleur;
    ctx.fillRect(zoneTestBoost.x, zoneTestBoost.y, zoneTestBoost.width, zoneTestBoost.height);

    // Dessiner le "Faux Rat" (Bloc Solide)
    ctx.fillStyle = "#557799";
    ctx.fillRect(fauxRat.x, fauxRat.y, fauxRat.width, fauxRat.height);
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.fillText("Autre Rat", fauxRat.x - 5, fauxRat.y - 10);

    // Dessiner le Fromage (Doré)
    ctx.fillStyle = "gold";
    ctx.fillRect(fromage.x, fromage.y, fromage.width, fromage.height);
    
    // Dessiner la Cloche (Par-dessus le fromage si elle est fermée)
    if (!cloche.estOuverte) {
        ctx.fillStyle = "rgba(180, 200, 220, 0.85)"; // Gris bleuté style "verre"
        ctx.fillRect(cloche.x, cloche.y, cloche.width, cloche.height);
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.fillText("Bloqué", cloche.x + 10, cloche.y - 5);
    }

    // Dessiner TON rat (Sprite)
    ctx.drawImage(spriteRat, monRat.x, monRat.y - 50, 50, 50);

    // Feedback visuel : Boost
    if (monRat.boostActif || monRat.surRat) {
        ctx.strokeStyle = "lime";
        ctx.lineWidth = 3;
        ctx.strokeRect(monRat.x, monRat.y - 50, 50, 50);
        ctx.fillStyle = "lime";
        ctx.font = "bold 16px Arial";
        ctx.fillText("SAUT BOOSTÉ PRÊT !", monRat.x - 30, monRat.y - 60);
    }

    // Écran de Victoire
    if (jeuTermine) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "gold";
        ctx.font = "bold 60px Arial";
        ctx.textAlign = "center";
        ctx.fillText("VICTOIRE !", canvas.width / 2, canvas.height / 2);
        
        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.fillText("La cloche est ouverte et le fromage est à nous !", canvas.width / 2, (canvas.height / 2) + 40);
        
        ctx.textAlign = "left"; 
    }

    requestAnimationFrame(boucleDeJeu);
}

// C'est parti !
boucleDeJeu();