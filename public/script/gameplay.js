// ==========================================
// 1. GESTIONNAIRE DE CLAVIER (ZQSD + Flèches + E/Espace)
// ==========================================
class Clavier {
    constructor() {
        this.touches = { gauche: false, droite: false, saut: false, bas: false, action: false };
        window.addEventListener('keydown', (e) => this.actualiserTouche(e.key, true));
        window.addEventListener('keyup', (e) => this.actualiserTouche(e.key, false));
    }
    actualiserTouche(cle, etat) {
        const touche = cle.toLowerCase();
        if (touche === 'q' || touche === 'arrowleft') this.touches.gauche = etat;
        if (touche === 'd' || touche === 'arrowright') this.touches.droite = etat;
        if (touche === 'z' || touche === 'arrowup') this.touches.saut = etat;
        if (touche === 's' || touche === 'arrowdown') this.touches.bas = etat;
        if (touche === 'e' || touche === ' ') this.touches.action = etat; 
    }
}

// ==========================================
// 2. SIMULATION PHYSIQUE DE BASE
// ==========================================
class EntitePhysique {
    constructor(x, y) { 
        this.x = x; this.y = y; this.vx = 0; this.vy = 0; 
        this.ignoreGravite = false; 
    }
    appliquerPhysique() {
        this.x += this.vx; this.y += this.vy;
        if (this.y < 800 && !this.ignoreGravite) { // Le sol global est plus bas (Y=800)
            this.vy += 0.5; // Gravité constante
        }
    }
}

// ==========================================
// 3. LOGIQUE DU PERSONNAGE (RAT)
// ==========================================
class Rat extends EntitePhysique {
    constructor(x, y, idJoueur, couleur) {
        super(x, y);
        this.idJoueur = idJoueur; this.couleur = couleur;
        
        // --- Réglages de Gameplay ---
        this.vitesseMarche = 4; this.forceSaut = -10; this.vitesseEscalade = 3; 
        
        this.boostActif = false; this.surRat = false; 
        this.peutSauter = false; this.enEscalade = false;  
        
        this.viesMax = 3; this.vies = this.viesMax; this.framesInvincibilite = 0; 
        this.estMort = false; 
    }

    prendreDegat() {
        // Invincibilité temporaire après un coup
        if (this.framesInvincibilite <= 0 && !this.estMort) {
            this.vies--; 
            this.framesInvincibilite = 60; // 1 seconde d'invincibilité à 60 FPS
            if (this.vies <= 0) {
                this.estMort = true; 
                console.log(this.idJoueur + " est K.O. ! Mode Spectateur.");
            }
        }
    }

    soigner() { 
        if (!this.estMort && this.vies < this.viesMax) this.vies++; 
    }
    
    declencherSaut() {
        // Mécanique Coopérative conservée pour tes tests
        if (this.boostActif || this.surRat) {
            this.vy = this.forceSaut * 1.5; // Super Saut !
            this.boostActif = false; 
        } else {
            this.vy = this.forceSaut;
        }
    }
    
    calculerVelocite(touches) {
        if (this.estMort) { this.vx = 0; return; }

        if (touches.gauche) this.vx = -this.vitesseMarche;
        else if (touches.droite) this.vx = this.vitesseMarche;
        else this.vx = 0; 

        if (this.enEscalade) {
            if (touches.saut) this.vy = -this.vitesseEscalade;
            else if (touches.bas) this.vy = this.vitesseEscalade;
            else this.vy = 0; 
        } else {
            // Permet de sauter si on est sur le sol ou une plateforme
            if (touches.saut && this.peutSauter) {
                this.declencherSaut();
                touches.saut = false; this.peutSauter = false; 
            }
        }
        if (this.framesInvincibilite > 0) this.framesInvincibilite--;
    }
}

// ==========================================
// 4. CLASSES DES OBSTACLES & ITEMS (Nouveautés)
// ==========================================

// --- Seul le ROULEAU roule sur les pentes ---
class Rouleau {
    constructor(x, y) {
        this.x = x; this.y = y;
        // Dimension demandée
        this.w = 45; this.h = 45;
        this.vx = 0; this.vy = 0;
        this.angle = 0;
    }
    bouger() {
        this.x += this.vx; this.y += this.vy;
        this.angle -= 0.05; // Rotation visuelle

        // --- Logique de Pente ---
        let estSurPlateforme = false;
        for (let plat of listePlateformes) {
            // Calcule la hauteur exacte de la plateforme sous le rouleau
            let ratio = (this.x - plat.x) / plat.w;
            let hauteurPente = plat.y + (plat.inclinaison * ratio);

            // Vérifie si le rouleau est sur la pente
            if (this.x + this.w / 2 > plat.x && this.x + this.w / 2 < plat.x + plat.w &&
                this.y + this.h >= hauteurPente - 5 && this.y + this.h <= hauteurPente + 15) {
                
                estSurPlateforme = true;
                this.y = hauteurPente - this.h;
                this.vy = 0;
                
                // --- Vitesse de glissade aléatoire/variable ---
                // La direction dépend de la pente (négative = roule à gauche)
                let accelerationX = (plat.inclinaison / plat.w) * 50; 
                this.vx = accelerationX; 
                
                // Assure une vitesse minimum pour le gameplay
                if (this.vx > -2 && this.vx <= 0) this.vx = -3;
                if (this.vx < 2 && this.vx >= 0) this.vx = 3;

                break;
            }
        }

        if (!estSurPlateforme) {
            this.vy += 0.5; // Gravité quand il tombe d'une plateforme
            this.vx *= 0.98; // Ralentissement de l'air
        }
    }
}

// --- La TOMATE tombe du ciel ---
class TomateTombante {
    constructor() {
        this.x = Math.random() * (canvasW - 100) + 50; // Spawn aléatoire en X
        this.y = -50; // En haut de l'écran
        // Dimension demandée (plus petite)
        this.w = 25; this.h = 25; 
        this.vy = Math.random() * 2 + 3; // Vitesse de chute variable
    }
    bouger() { this.y += this.vy; }
}

// --- Le COUTEAU tombe du ciel ---
class CouteauTombante {
    constructor() {
        this.x = Math.random() * (canvasW - 100) + 50;
        this.y = -50;
        this.w = 20; this.h = 60; // Plus haut que large
        this.vy = 5;
    }
    bouger() { this.y += this.vy; }
}

// --- Le CŒUR (Soin) ---
class CoeurItem {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 30; this.h = 30;
    }
}

// ==========================================
// 5. DESIGN DU NIVEAU & VARIABLES GLOBALES
// ==========================================
const clavier = new Clavier();
// Spawn du rat sur le sol
const monRat = new Rat(100, 700, "joueur1", "gris"); 
let listeJoueurs = [monRat]; 
let etatPartie = "EN_COURS"; 

// Dimensions de l'écran de jeu (doit correspondre à ton HTML)
const canvasW = 900;
const canvasH = 900;

// --- Plateformes Inclinées ---
// y de fin = y + inclinaison
const listePlateformes = [
    { x: 42, y: 800, w: canvasW-81, h: 18, inclinaison: -50 }, 
    { x: 42, y: 620, w: canvasW-254, h: 18, inclinaison: 45 }, 
    { x: 109, y: 520, w: canvasW-149, h: 18, inclinaison: -50 }, 
    { x: 42, y: 353, w: canvasW-145, h: 18, inclinaison: 50 }, 
    { x: 42, y: 275, w: canvasW-83, h: 18, inclinaison: -65 }, 
    { x: 63, y: 125, w: canvasW-228, h: 18, inclinaison: 30 }, 
    { x: 300, y: 70, w: 170, h: 18, inclinaison: 0 } 
];

// Helper pour calculer le Y exact d'une pente à un X précis
function getPlatformY(plat, targetX) {
    let ratio = (targetX - plat.x) / plat.w;
    return plat.y + (plat.inclinaison * ratio);
}

// Échelles calées sur les pentes inclinées
const listeEchelles = [
    { x: 610, w: 30, yTop: getPlatformY(listePlateformes[1], 610), yBot: getPlatformY(listePlateformes[0], 610) },
    { x: 168, w: 30, yTop: getPlatformY(listePlateformes[2], 168), yBot: getPlatformY(listePlateformes[1], 168) },
    { x: 668, w: 30, yTop: getPlatformY(listePlateformes[3], 668), yBot: getPlatformY(listePlateformes[2], 668) }
];

// Zone cooperative (Saut Boosté)
let listeZonesBoost = [{ x: 400, y: 750, width: 60, height: 40, actif: true }];

// Listes d'obstacles
let listeRouleaux = [];
let listeTomates = [];
let listeCouteaux = [];
let listeCoeurs = [];

// ==========================================
// 6. SYSTÈME DE SPAWN (Le Hasard demandée)
// ==========================================
const BOSS_SPAWN = { x: 750, y: 50 }; // Haut à droite

// --- 6.1 Hasard des ROULEAUX (Rafales à espacements aléatoires) ---
function spawnRafaleRouleaux() {
    if (etatPartie !== "EN_COURS") return;
    
    let nbDansLaRafale = Math.floor(Math.random() * 3) + 1; // 1 à 3 rouleaux par rafale
    let rouleauxLances = 0;

    function lancerProchain() {
        if (rouleauxLances < nbDansLaRafale && etatPartie === "EN_COURS") {
            listeRouleaux.push(new Rouleau(BOSS_SPAWN.x, BOSS_SPAWN.y));
            rouleauxLances++;
            
            // --- ESPACEMENT ALÉATOIRE demandée ---
            // Parfois très rapproché (200ms), parfois espacé (1500ms)
            let tempsAttente = Math.random() * (1500 - 200) + 200; 
            if (rouleauxLances < nbDansLaRafale) {
                setTimeout(lancerProchain, tempsAttente);
            }
        }
    }
    lancerProchain();
}
// Lance une nouvelle rafale toutes les 6 secondes
setInterval(spawnRafaleRouleaux, 6000);


// --- 6.2 Spawn des Tomates Tombantes ---
setInterval(() => {
    if (etatPartie === "EN_COURS") listeTomates.push(new TomateTombante());
}, 4000); // Une tomate toutes les 4s


// --- 6.3 Spawn des Couteaux Tombants ---
setInterval(() => {
    if (etatPartie === "EN_COURS") listeCouteaux.push(new CouteauTombante());
}, 5000); // Un couteau toutes les 5s


// --- 6.4 Spawn des CŒURS (Limitée à 3) ---
setInterval(() => {
    if (etatPartie === "EN_COURS" && listeCoeurs.length < 3) {
        const plat = listePlateformes[Math.floor(Math.random() * listePlateformes.length)];
        // Spawn juste au dessus de la pente inclinée
        const rx = plat.x + Math.random() * (plat.w - 50);
        const ry = getPlatformY(plat, rx) - 30;
        listeCoeurs.push(new CoeurItem(rx, ry));
    }
}, 10000);


// ==========================================
// 7. CHARGEMENT DES SPRITES (Intégré !)
// ==========================================
const imgRouleau = new Image(); imgRouleau.src = '../assets/rouleau.png';
const imgTomate = new Image(); imgTomate.src = '../assets/tomate.gif';
const imgCouteau = new Image(); imgCouteau.src = '../assets/couteaux.png';
const imgCoeur = new Image(); imgCoeur.src = '../assets/coeur.png';

const canvas = document.getElementById("ecranDeJeu") || document.querySelector("canvas");
const ctx = canvas.getContext("2d");

// ==========================================
// 8. BOUCLE DE JEU PRINCIPALE
// ==========================================
function boucleDeJeu() {
    // --- VÉRIFICATION GAME OVER (continue tant que qlq est en vie) ---
    let tousMorts = true;
    for (let joueur of listeJoueurs) {
        if (!joueur.estMort) { tousMorts = false; break; }
    }
    if (tousMorts && etatPartie === "EN_COURS") etatPartie = "DEFAITE";

    // Mouvements Rat
    if (etatPartie === "EN_COURS") monRat.calculerVelocite(clavier.touches);
    else monRat.vx = 0; 
    
    monRat.appliquerPhysique();

    // Logic Collisions si Rat vivant
    if (!monRat.estMort) {
        monRat.peutSauter = false;
        // Boîte de collision rat précise (30x30)
        const boiteRat = { x: monRat.x, y: monRat.y, w: 30, h: 30 }; 

        // --- COLLISION ÉCHELLES ---
        let toucheEchelle = false;
        for (let ech of listeEchelles) {
            if (boiteRat.x < ech.x + ech.w && boiteRat.x + boiteRat.w > ech.x &&
                boiteRat.y < ech.yBot && boiteRat.y + boiteRat.h > ech.yTop) {
                toucheEchelle = true;
                if (!monRat.enEscalade && (clavier.touches.saut || clavier.touches.bas)) {
                    monRat.enEscalade = true; monRat.ignoreGravite = true; 
                }
            }
        }
        if (!toucheEchelle) { monRat.enEscalade = false; monRat.ignoreGravite = false; }

        // --- COLLISION PLATEFORMES INCLINÉES ---
        if (!monRat.enEscalade && monRat.vy >= 0) {
            let surPlateforme = false;
            for (let plat of listePlateformes) {
                let rxCentre = monRat.x + boiteRat.w / 2;
                if (rxCentre >= plat.x && rxCentre <= plat.x + plat.w) {
                    let yPente = getPlatformY(plat, rxCentre);
                    // Tolérance d'atterrissage sur la pente
                    if (monRat.y + boiteRat.h >= yPente - 10 && monRat.y + boiteRat.h <= yPente + 15) {
                        monRat.y = yPente - boiteRat.h;
                        monRat.vy = 0;
                        monRat.peutSauter = true;
                        surPlateforme = true;
                        break;
                    }
                }
            }
            // Sol global de secours (Y=800)
            if (!surPlateforme && monRat.y + boiteRat.h >= 800) { 
                monRat.y = 800 - boiteRat.h; 
                monRat.vy = 0; monRat.peutSauter = true; 
            } 
        }

        // --- COLLISION ZONE BOOST Conserveé ---
        for (let zone of listeZonesBoost) {
            if (zone.actif && boiteRat.x < zone.x + zone.width && boiteRat.x + boiteRat.w > zone.x &&
                boiteRat.y < zone.y + zone.height && boiteRat.y + boiteRat.h > zone.y) {
                monRat.boostActif = true; // Prochain saut sera un Super Saut !
            }
        }

        // --- COLLISION DÉGÂTS (Rouleaux, Tomates, Couteaux) ---
        for (let obs of listeRouleaux) {
            if (checkCollisionAABB(boiteRat, obs)) monRat.prendreDegat();
        }
        for (let t of listeTomates) {
            if (checkCollisionAABB(boiteRat, t)) monRat.prendreDegat();
        }
        for (let c of listeCouteaux) {
            if (checkCollisionAABB(boiteRat, c)) monRat.prendreDegat();
        }

        // --- COLLISION CŒURS (Soin si < maxVies) ---
        for (let i = listeCoeurs.length - 1; i >= 0; i--) {
            let c = listeCoeurs[i];
            if (checkCollisionAABB(boiteRat, c)) {
                if(monRat.vies < monRat.viesMax) {
                    monRat.soigner();
                    listeCoeurs.splice(i, 1);
                }
            }
        }
    } // Fin Si Pas Mort

    // Mise à jour Objets
    if (etatPartie === "EN_COURS") {
        // Rouleaux
        for (let i = listeRouleaux.length - 1; i >= 0; i--) {
            let obs = listeRouleaux[i];
            obs.bouger();
            // Nettoyage hors écran
            if (obs.x < -100 || obs.y > canvasH + 100) listeRouleaux.splice(i, 1);
        }
        // Tomates
        for (let i = listeTomates.length - 1; i >= 0; i--) {
            let t = listeTomates[i];
            t.bouger();
            if (t.y > canvasH) listeTomates.splice(i, 1);
        }
        // Couteaux
        for (let i = listeCouteaux.length - 1; i >= 0; i--) {
            let c = listeCouteaux[i];
            c.bouger();
            if (c.y > canvasH) listeCouteaux.splice(i, 1);
        }
    }


    // ================== RENDU VISUEL (Dessin avec Sprites) ==================
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // ctx.fillStyle = "#111"; ctx.fillRect(0, 0, canvas.width, canvas.height); // Fond sombre de secours

    // 8.1 Dessin des Plateformes Inclinaison
    ctx.lineWidth = 2;
    for (let plat of listePlateformes) { 
        ctx.fillStyle = "#CD853F";
        ctx.strokeStyle = "#8B4513";
        // Dessine la forme trapézoïdale de la pente inclinee
        ctx.beginPath();
        ctx.moveTo(plat.x, plat.y);
        ctx.lineTo(plat.x + plat.w, plat.y + plat.inclinaison);
        ctx.lineTo(plat.x + plat.w, plat.y + plat.inclinaison + plat.h);
        ctx.lineTo(plat.x, plat.y + plat.h);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }

    // 8.2 Dessin des Échelles
    ctx.fillStyle = "#DEB887";
    for (let ech of listeEchelles) { 
        ctx.fillRect(ech.x, ech.yTop, 5, ech.yBot - ech.yTop); // Montant gauche
        ctx.fillRect(ech.x + ech.w - 5, ech.yTop, 5, ech.yBot - ech.yTop); // Montant droit
        for(let i = ech.yTop + 10; i < ech.yBot; i+=20) ctx.fillRect(ech.x, i, ech.w, 4); // Barreaux
    }

    // 8.3 Dessin de la Zone Boost (Courte-échelle simulée)
    for (let zone of listeZonesBoost) {
        if (zone.actif) { ctx.fillStyle = "rgba(0, 255, 0, 0.3)"; ctx.fillRect(zone.x, zone.y, zone.width, zone.height); }
    }

    // --- 8.4 DESSIN DES OBSTACLES & ITEMS (Intégration SPRITES) ---
    
    // Cœurs (Soin)
    for (let c of listeCoeurs) {
        dessinerSprite(imgCoeur, c.x, c.y, c.w, c.h, "pink");
    }

    // Rouleaux Roulants (avec rotation !)
    for (let obs of listeRouleaux) {
        dessinerSpriteRotatif(imgRouleau, obs.x, obs.y, obs.w, obs.h, obs.angle, "saddlebrown");
    }

    // Tomates Tombantes (Nouveauté : sprite tomate gif utilisé ici)
    for (let t of listeTomates) {
        dessinerSprite(imgTomate, t.x, t.y, t.w, t.h, "red");
    }

    // Couteaux Tombants
    for (let c of listeCouteaux) {
        dessinerSprite(imgCouteau, c.x, c.y, c.w, c.h, "silver");
    }

    // --- 8.5 Dessin Joueurs (TODO: Intégrer sprite rat quand disponible) ---
    for (let joueur of listeJoueurs) {
        if (joueur.estMort) ctx.globalAlpha = 0.4; // Effet fantôme pour spectateur
        else if (joueur.framesInvincibilite > 0 && joueur.framesInvincibilite % 10 >= 5) continue; // Clignotement
        
        // --- Carré gris temporaire pour le rat (vu qu'on a pas de sprite rat dans les assets envoyés) ---
        ctx.fillStyle = joueur.boostActif ? "lime" : "gray"; 
        ctx.fillRect(joueur.x, joueur.y, 30, 30);
        
        ctx.globalAlpha = 1.0; 
    }

    // --- 8.6 HUD (Vies avec icônes Cœur !) ---
    ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
    ctx.fillText("Vies : ", 20, 30);
    
    if (monRat.estMort) {
        ctx.fillStyle = "red";
        ctx.fillText("SPECTATEUR 👻", 80, 30);
    } else {
        // Dessine des petits sprites cœur pour chaque vie restante demandée
        for(let i=0; i<monRat.vies; i++) {
            dessinerSprite(imgCoeur, 80 + (i * 30), 10, 20, 20, "red");
        }
    }

    // Écran Game Over Collectif demandée
    if (etatPartie === "DEFAITE") {
        ctx.fillStyle = "rgba(100, 0, 0, 0.8)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white"; ctx.font = "bold 60px Arial"; ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2); ctx.textAlign = "left"; 
    }

    requestAnimationFrame(boucleDeJeu);
}

// ==========================================
// 9. UTILITAIRES DE DESSIN & COLLISION
// ==========================================

// Collision AABB classique
function checkCollisionAABB(r1, r2) {
    return (r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
            r1.y < r2.y + r2.h && r1.y + r1.h > r2.y);
}

// Helper pour dessiner un sprite avec fallback carré couleur si image pas chargée
function dessinerSprite(img, x, y, w, h, couleurFallback) {
    if(img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x, y, w, h);
    } else {
        ctx.fillStyle = couleurFallback;
        ctx.fillRect(x, y, w, h);
    }
}

// Helper pour dessiner un sprite rotatif (pour les rouleaux)
function dessinerSpriteRotatif(img, x, y, w, h, angle, couleurFallback) {
    if(img.complete && img.naturalWidth > 0) {
        ctx.save(); 
        // Se déplace au centre de l'objet pour la rotation
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(angle); 
        // Dessine l'image centrée sur l'origine du canvas actuel
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore(); 
    } else {
        // Fallback carré de secours
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(angle);
        ctx.fillStyle = couleurFallback;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
    }
}


// Lancement de la boucle de jeu Vanilla JS locale
boucleDeJeu();