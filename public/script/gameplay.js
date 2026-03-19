// ==========================================
// 1. GESTIONNAIRE DE CLAVIER (Mode 2 Joueurs Local)
// ==========================================
class Clavier {
    constructor() {
        this.touchesP1 = { gauche: false, droite: false, saut: false, bas: false, interact: false, powerup: false };
        this.touchesP2 = { gauche: false, droite: false, saut: false, bas: false, interact: false, powerup: false };
        window.addEventListener('keydown', (e) => this.actualiserTouche(e.key, true));
        window.addEventListener('keyup', (e) => this.actualiserTouche(e.key, false));
    }
    actualiserTouche(cle, etat) {
        const touche = cle.toLowerCase();
        
        if (touche === 'q' || touche === 'arrowleft') this.touchesP1.gauche = etat;
        if (touche === 'd' || touche === 'arrowright') this.touchesP1.droite = etat;
        if (touche === 'z' || touche === 'arrowup') this.touchesP1.saut = etat;
        if (touche === 's' || touche === 'arrowdown') this.touchesP1.bas = etat;
        if (touche === 'e') this.touchesP1.interact = etat;
        if (touche === ' ') this.touchesP1.powerup = etat; 
        
        if (touche === 'j') this.touchesP2.gauche = etat;
        if (touche === 'l') this.touchesP2.droite = etat;
        if (touche === 'i') this.touchesP2.saut = etat;
        if (touche === 'k') this.touchesP2.bas = etat;
        if (touche === 'u') this.touchesP2.interact = etat; 
        if (touche === 'o') this.touchesP2.powerup = etat;  
    }
}

// ==========================================
// 2. SIMULATION PHYSIQUE DE BASE
// ==========================================
class EntitePhysique {
    constructor(x, y) { 
        this.x = x; this.y = y; this.vx = 0; this.vy = 0; 
        this.ignoreGravite = false; 
        this.canMove = true; 
    }
    appliquerPhysique() {
        if (!this.canMove) { this.vx = 0; this.vy = 0; return; } 
        this.x += this.vx; this.y += this.vy;
        if (this.y < 800 && !this.ignoreGravite) {
            this.vy += 0.5; 
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
        this.direction = 1; 
        this.vitesseMarche = 4; this.forceSaut = -10; this.vitesseEscalade = 3; 
        this.peutSauter = false; this.enEscalade = false;  
        this.boostActif = false; 
        this.viesMax = 3; this.vies = this.viesMax; this.framesInvincibilite = 0; 
        this.estMort = false; 
        this.inventaire = null; 
        this.trappedTimer = 0; 
        this.controlsInvertedTimer = 0; 
        this.ignorePlateformesTimer = 0; 
    }

    prendreDegat() {
        if (this.framesInvincibilite <= 0 && !this.estMort) {
            this.vies--; 
            this.framesInvincibilite = 60; 
            if (this.vies <= 0) this.estMort = true; 
        }
    }

    soigner() { 
        if (!this.estMort && this.vies < this.viesMax) this.vies++; 
    }
    
    declencherSaut() {
        if (!this.canMove) return; 
        if (this.boostActif) {
            this.vy = this.forceSaut * 1.5; 
            this.boostActif = false; 
        } else {
            this.vy = this.forceSaut;
        }
        this.peutSauter = false;
    }
    
    calculerVelocite(touches) {
        if (this.estMort) { this.vx = 0; return; }
        if (this.ignorePlateformesTimer > 0) this.ignorePlateformesTimer--;
        if (this.trappedTimer > 0) {
            this.trappedTimer--; this.canMove = false; this.vx = 0; this.vy = 0;
            if (this.trappedTimer <= 0) this.canMove = true; 
            return; 
        }
        let directionMarche = 0;
        if (touches.gauche) directionMarche = -1;
        else if (touches.droite) directionMarche = 1;
        if (this.controlsInvertedTimer > 0) {
            this.controlsInvertedTimer--;
            directionMarche *= -1; 
        }
        if (directionMarche === -1) { this.vx = -this.vitesseMarche; this.direction = -1; }
        else if (directionMarche === 1) { this.vx = this.vitesseMarche; this.direction = 1; }
        else this.vx = 0; 

        if (this.enEscalade) {
            if (touches.saut) this.vy = -this.vitesseEscalade;
            else if (touches.bas) this.vy = this.vitesseEscalade;
            else this.vy = 0; 
        } else {
            if (touches.saut && this.peutSauter) { this.declencherSaut(); touches.saut = false; }
        }
        if (this.framesInvincibilite > 0) this.framesInvincibilite--;
    }

    utiliserPowerUp() {
        if (!this.inventaire || this.estMort || !this.canMove) return;
        console.log(`🚀 ${this.idJoueur} utilise le Power-up : ${this.inventaire}`);
        if (this.inventaire === 'ressort') {
            this.boostActif = true;
        } else {
            listeJoueurs.forEach(rat => {
                if (rat.idJoueur !== this.idJoueur && !rat.estMort) {
                    if (this.inventaire === 'éclair') {
                        if (!rat.enEscalade) {
                            rat.ignoreGravite = false; rat.ignorePlateformesTimer = 20; rat.vy = 5; 
                        }
                    } 
                    else if (this.inventaire === 'piege') rat.trappedTimer = 300; 
                    else if (this.inventaire === 'vin') rat.controlsInvertedTimer = 300; 
                }
            });
        }
        this.inventaire = null; 
    }
}

// ==========================================
// 4. CLASSES DES OBSTACLES & ITEMS 
// ==========================================
class Rouleau {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 45; this.h = 45; this.vx = 0; this.vy = 0; this.angle = 0;
    }
    bouger() {
        this.x += this.vx; this.y += this.vy; this.angle -= 0.03; 
        if (this.y + this.h < 790) { 
            if (this.x <= 0) { this.x = 0; this.vx = 1.5; }
            if (this.x + this.w >= canvasW) { this.x = canvasW - this.w; this.vx = -1.5; }
        }
        let estSurPlateformeInclinee = false;
        for (let plat of listePlateformes) {
            let ratio = (this.x - plat.x) / plat.w;
            let hauteurPente = plat.y + (plat.inclinaison * ratio);
            if (this.x + this.w / 2 > plat.x && this.x + this.w / 2 < plat.x + plat.w &&
                this.y + this.h >= hauteurPente - 10 && this.y + this.h - this.vy <= hauteurPente + 20) {
                estSurPlateformeInclinee = true; this.y = hauteurPente - this.h; this.vy = 0;
                let accelerationX = (plat.inclinaison / plat.w) * 30; this.vx = accelerationX; 
                if (this.vx > -1.5 && this.vx <= 0) this.vx = -2; 
                if (this.vx < 1.5 && this.vx >= 0) this.vx = 2;   
                break;
            }
        }
        if (!estSurPlateformeInclinee) {
            this.vy += 0.5; 
            if (this.y + this.h >= 800) { this.y = 800 - this.h; this.vy = 0; if (this.vx > -1) this.vx = -2.5; } 
        }
    }
}

class TomateTombante {
    constructor() {
        this.x = Math.random() * (canvasW - 100) + 50; this.y = -50; this.w = 25; this.h = 25; this.vy = Math.random() * 2 + 3; 
    }
    bouger() { this.y += this.vy; }
}

class CouteauTombante {
    constructor() {
        this.x = Math.random() * (canvasW - 100) + 50; this.y = -50; this.w = 20; this.h = 60; this.vy = 5;
    }
    bouger() { this.y += this.vy; }
}

class CoeurItem { constructor(x, y) { this.x = x; this.y = y; this.w = 30; this.h = 30; } }
class LevierItem { constructor(x, y) { this.x = x; this.y = y; this.w = 30; this.h = 50; this.estActive = false; } }
class FromageVictorieux { constructor(x, y) { this.x = x; this.y = y; this.w = 50; this.h = 40; } }

// Classe pour le panier (on garde 'CollectablePowerup' pour la structure, le type sera 'mystery')
class CollectablePowerup {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.w = 40; this.h = 40; // Légèrement plus grand pour le panier
        this.type = type; // Sera toujours 'mystery' pour le panier
    }
}

// ==========================================
// 5. DESIGN DU NIVEAU & VARIABLES GLOBALES
// ==========================================
const clavier = new Clavier();
const monRat = new Rat(100, 700, "joueur1", "gris"); 
const ratCobaye = new Rat(600, 300, "joueur2", "marron"); 
let listeJoueurs = [monRat, ratCobaye]; 
let etatPartie = "EN_COURS"; 
const canvasW = 900; const canvasH = 900;

const listePlateformes = [
    { x: 42, y: 800, w: canvasW-81, h: 18, inclinaison: -50 }, 
    { x: 42, y: 620, w: canvasW-254, h: 18, inclinaison: 45 }, 
    { x: 109, y: 520, w: canvasW-149, h: 18, inclinaison: -50 }, 
    { x: 42, y: 353, w: canvasW-145, h: 18, inclinaison: 50 }, 
    { x: 42, y: 275, w: canvasW-83, h: 18, inclinaison: -65 }, 
    { x: 63, y: 125, w: canvasW-228, h: 18, inclinaison: 30 }, 
    { x: 300, y: 70, w: 170, h: 18, inclinaison: 0 } 
];

function getPlatformY(plat, targetX) {
    let ratio = (targetX - plat.x) / plat.w;
    return plat.y + (plat.inclinaison * ratio);
}

const listeEchelles = [
    { x: 610, w: 30, yTop: getPlatformY(listePlateformes[1], 610), yBot: getPlatformY(listePlateformes[0], 610) },
    { x: 168, w: 30, yTop: getPlatformY(listePlateformes[2], 168), yBot: getPlatformY(listePlateformes[1], 168) },
    { x: 668, w: 30, yTop: getPlatformY(listePlateformes[3], 668), yBot: getPlatformY(listePlateformes[2], 668) }
];

let listeRouleaux = []; let listeTomates = []; let listeCouteaux = []; let listeCoeurs = []; let listePowerupsCollectables = [];

let listeLeviers = [
    new LevierItem(100, getPlatformY(listePlateformes[0], 100) - 50),
    new LevierItem(650, getPlatformY(listePlateformes[2], 650) - 50),
    new LevierItem(400, getPlatformY(listePlateformes[4], 400) - 50) 
];
let fromageVictorieux = new FromageVictorieux(450, 40); 
let clocheFromage = { x: fromageVictorieux.x - 10, y: fromageVictorieux.y - 10, w: fromageVictorieux.w + 20, h: fromageVictorieux.h + 20, estOuverte: false };

// --- NOUVEAU : Configuration de la loterie des Paniers ---
const typesPowerupsDisponibles = ['éclair', 'piege', 'vin', 'ressort'];

// ==========================================
// 6. SYSTÈME DE SPAWN 
// ==========================================
const BOSS_SPAWN = { x: 750, y: 50 }; 
function spawnRafaleRouleaux() {
    if (etatPartie !== "EN_COURS") return;
    let nbDansLaRafale = Math.floor(Math.random() * 3) + 1; let rouleauxLances = 0;
    function lancerProchain() {
        if (rouleauxLances < nbDansLaRafale && etatPartie === "EN_COURS") {
            listeRouleaux.push(new Rouleau(BOSS_SPAWN.x, BOSS_SPAWN.y));
            rouleauxLances++; let tempsAttente = Math.random() * (1500 - 200) + 200; 
            if (rouleauxLances < nbDansLaRafale) setTimeout(lancerProchain, tempsAttente);
        }
    }
    lancerProchain();
}
setInterval(spawnRafaleRouleaux, 3000); 
setInterval(() => { if (etatPartie === "EN_COURS") listeTomates.push(new TomateTombante()); }, 4000); 
setInterval(() => { if (etatPartie === "EN_COURS") listeCouteaux.push(new CouteauTombante()); }, 5000); 
setInterval(() => {
    if (etatPartie === "EN_COURS" && listeCoeurs.length < 3) {
        const plat = listePlateformes[Math.floor(Math.random() * listePlateformes.length)];
        const rx = plat.x + Math.random() * (plat.w - 50); const ry = getPlatformY(plat, rx) - 30;
        listeCoeurs.push(new CoeurItem(rx, ry));
    }
}, 10000); 

// --- SPAWN CORRIGÉ : Ne fait spawner que des Paniers Mystères ---
setInterval(() => {
    if (etatPartie === "EN_COURS" && listePowerupsCollectables.length < 2) {
        const plat = listePlateformes[Math.floor(Math.random() * (listePlateformes.length - 1))]; 
        const rx = plat.x + Math.random() * (plat.w - 50);
        const ry = getPlatformY(plat, rx) - 40; // Ajusté pour taille panier
        // On crée un collectable de type 'mystery'
        listePowerupsCollectables.push(new CollectablePowerup(rx, ry, 'mystery'));
        console.log("🎁 Un Panier Mystère est apparu !");
    }
}, 12000); 

// ==========================================
// 7. CHARGEMENT DES SPRITES 
// ==========================================
const imgRouleau = new Image(); imgRouleau.src = 'assets/rouleau.png'; 
const imgTomate = new Image(); imgTomate.src = 'assets/tomate.gif'; 
const imgCouteau = new Image(); imgCouteau.src = 'assets/couteaux.png'; 
const imgCoeur = new Image(); imgCoeur.src = 'assets/coeur.png'; 
const imgFromage = new Image(); imgFromage.src = 'assets/fromagewin.png'; 
const imgRat = new Image(); imgRat.src = 'assets/rat_cours.png'; 
const imgEclair = new Image(); imgEclair.src = 'assets/éclair.png'; 
const imgPiege = new Image(); imgPiege.src = 'assets/piege.png'; 
const imgVin = new Image(); imgVin.src = 'assets/vin.png'; 
const imgRessort = new Image(); imgRessort.src = 'assets/ressort.png'; 

// --- NOUVEAU : Sprite du Panier ---
const imgPanier = new Image(); imgPanier.src = 'assets/panier.png'; 

const canvas = document.getElementById("ecranDeJeu") || document.querySelector("canvas"); ctx = canvas.getContext("2d");

// ==========================================
// 8. BOUCLE DE JEU PRINCIPALE
// ==========================================
function boucleDeJeu() {
    let texteActionAffiche = false; let texteActionX = 0, texteActionY = 0;
    let tousMorts = true;
    for (let joueur of listeJoueurs) { if (!joueur.estMort) { tousMorts = false; break; } }
    if (tousMorts && etatPartie === "EN_COURS") etatPartie = "DEFAITE";
    if (etatPartie === "EN_COURS") { monRat.calculerVelocite(clavier.touchesP1); ratCobaye.calculerVelocite(clavier.touchesP2); }
    else { monRat.vx = 0; ratCobaye.vx = 0; }
    monRat.appliquerPhysique(); ratCobaye.appliquerPhysique();

    for (let joueur of listeJoueurs) {
        if (!joueur.estMort) {
            joueur.peutSauter = false; const boiteJoueur = { x: joueur.x, y: joueur.y, w: 30, h: 30 }; 
            const touchesJoueur = (joueur.idJoueur === "joueur1") ? clavier.touchesP1 : clavier.touchesP2;
            let toucheEchelle = false;
            for (let ech of listeEchelles) {
                if (boiteJoueur.x < ech.x + ech.w && boiteJoueur.x + boiteJoueur.w > ech.x &&
                    boiteJoueur.y < ech.yBot && boiteJoueur.y + boiteJoueur.h > ech.yTop) {
                    toucheEchelle = true;
                    if (!joueur.enEscalade && (touchesJoueur.saut || touchesJoueur.bas)) { joueur.enEscalade = true; joueur.ignoreGravite = true; }
                }
            }
            if (!toucheEchelle) { joueur.enEscalade = false; joueur.ignoreGravite = false; }
            if (!joueur.enEscalade && joueur.vy >= 0 && joueur.ignorePlateformesTimer <= 0) {
                let surPlateforme = false;
                for (let plat of listePlateformes) {
                    let rxCentre = joueur.x + boiteJoueur.w / 2;
                    if (rxCentre >= plat.x && rxCentre <= plat.x + plat.w) {
                        let yPente = getPlatformY(plat, rxCentre);
                        if (joueur.y + boiteJoueur.h >= yPente - 10 && joueur.y + boiteJoueur.h <= yPente + 15) {
                            joueur.y = yPente - boiteJoueur.h; joueur.vy = 0; joueur.peutSauter = true; surPlateforme = true; break;
                        }
                    }
                }
                if (!surPlateforme && joueur.y + boiteJoueur.h >= 800) { joueur.y = 800 - boiteJoueur.h; joueur.vy = 0; joueur.peutSauter = true; } 
            }

            // --- NOUVEAU : Logique de ramassage du Panier Mystère ---
            for (let i = listePowerupsCollectables.length - 1; i >= 0; i--) {
                let p = listePowerupsCollectables[i];
                if (checkCollisionAABB(boiteJoueur, p)) {
                    if (joueur.inventaire === null) {
                        // On tire au sort le boost UNIQUEMENT quand on ramasse le panier
                        const boostGagne = typesPowerupsDisponibles[Math.floor(Math.random() * typesPowerupsDisponibles.length)];
                        joueur.inventaire = boostGagne;
                        
                        // Petit feedback dans la console pour le test
                        console.log(`🎁 ${joueur.idJoueur} a ouvert le panier : Surprise ! C'est un(e) : ${boostGagne}`);
                        
                        listePowerupsCollectables.splice(i, 1);
                    }
                }
            }

            for (let obs of listeRouleaux) { if (checkCollisionAABB(boiteJoueur, obs)) joueur.prendreDegat(); }
            for (let t of listeTomates) { if (checkCollisionAABB(boiteJoueur, t)) joueur.prendreDegat(); }
            for (let c of listeCouteaux) { if (checkCollisionAABB(boiteJoueur, c)) joueur.prendreDegat(); }
            for (let i = listeCoeurs.length - 1; i >= 0; i--) {
                let c = listeCoeurs[i]; if (checkCollisionAABB(boiteJoueur, c)) { if(joueur.vies < joueur.viesMax) { joueur.soigner(); listeCoeurs.splice(i, 1); } }
            }
            if (touchesJoueur.powerup) { joueur.utiliserPowerUp(); touchesJoueur.powerup = false; }
            for (let lev of listeLeviers) {
                if (!lev.estActive) {
                    const zone = {x: lev.x - 30, y: lev.y - 30, w: lev.w + 60, h: lev.h + 60};
                    if (checkCollisionAABB(boiteJoueur, zone)) {
                        texteActionAffiche = true; texteActionX = lev.x; texteActionY = lev.y;
                        if (touchesJoueur.interact) { lev.estActive = true; touchesJoueur.interact = false; }
                    }
                }
            }
            if (etatPartie === "EN_COURS" && clocheFromage.estOuverte && checkCollisionAABB(boiteJoueur, fromageVictorieux)) etatPartie = "VICTOIRE";
        }
    }

    if (etatPartie === "EN_COURS") {
        for (let i = listeRouleaux.length - 1; i >= 0; i--) { let obs = listeRouleaux[i]; obs.bouger(); if (obs.x < -100 || obs.x > canvasW + 100 || obs.y > 950) listeRouleaux.splice(i, 1); }
        for (let i = listeTomates.length - 1; i >= 0; i--) { let t = listeTomates[i]; t.bouger(); if (t.y > canvasH) listeTomates.splice(i, 1); }
        for (let i = listeCouteaux.length - 1; i >= 0; i--) { let c = listeCouteaux[i]; c.bouger(); if (c.y > canvasH) listeCouteaux.splice(i, 1); }
    }

    let nbLeviersActifs = listeLeviers.filter(l => l.estActive).length; clocheFromage.estOuverte = (nbLeviersActifs === listeLeviers.length);

    // ================== RENDU VISUEL ==================
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.lineWidth = 2;
    for (let plat of listePlateformes) { ctx.fillStyle = "#CD853F"; ctx.strokeStyle = "#8B4513"; ctx.beginPath(); ctx.moveTo(plat.x, plat.y); ctx.lineTo(plat.x + plat.w, plat.y + plat.inclinaison); ctx.lineTo(plat.x + plat.w, plat.y + plat.inclinaison + plat.h); ctx.lineTo(plat.x, plat.y + plat.h); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = "#DEB887"; for (let ech of listeEchelles) { ctx.fillRect(ech.x, ech.yTop, 5, ech.yBot - ech.yTop); ctx.fillRect(ech.x + ech.w - 5, ech.yTop, 5, ech.yBot - ech.yTop); for(let i = ech.yTop + 10; i < ech.yBot; i+=20) ctx.fillRect(ech.x, i, ech.w, 4); }
    for (let c of listeCoeurs) dessinerSprite(imgCoeur, c.x, c.y, c.w, c.h, "pink"); 

    // --- NOUVEAU : Dessin des Paniers Mystères au sol ---
    for (let p of listePowerupsCollectables) {
        // On dessine toujours l'image du panier, peu importe le boost caché
        dessinerSprite(imgPanier, p.x, p.y, p.w, p.h, "cyan");
    }

    for (let obs of listeRouleaux) { dessinerSpriteRotatif(imgRouleau, obs.x, obs.y, obs.w, obs.h, obs.angle, "saddlebrown"); }
    for (let t of listeTomates) { dessinerSprite(imgTomate, t.x, t.y, t.w, t.h, "red"); }
    for (let c of listeCouteaux) { dessinerSprite(imgCouteau, c.x, c.y, c.w, c.h, "silver"); }
    for (let lev of listeLeviers) { ctx.fillStyle = "gray"; ctx.fillRect(lev.x, lev.y, lev.w, lev.h); ctx.fillStyle = lev.estActive ? "lime" : "red"; ctx.fillRect(lev.x + lev.w/2 - 5, lev.y + 10, 10, 20); }
    dessinerSprite(imgFromage, fromageVictorieux.x, fromageVictorieux.y, fromageVictorieux.w, fromageVictorieux.h, "gold");
    if (!clocheFromage.estOuverte) { ctx.fillStyle = "rgba(180, 200, 220, 0.85)"; ctx.fillRect(clocheFromage.x, clocheFromage.y, clocheFromage.w, clocheFromage.h); }

    for (let joueur of listeJoueurs) {
        if (joueur.estMort) ctx.globalAlpha = 0.4; else if (joueur.framesInvincibilite > 0 && joueur.framesInvincibilite % 10 >= 5) continue; 
        if (imgRat.complete && imgRat.naturalWidth > 0) {
            ctx.save(); if (joueur.direction === -1) { ctx.translate(joueur.x + 30, joueur.y); ctx.scale(-1, 1); ctx.drawImage(imgRat, 0, 0, 30, 30); } else ctx.drawImage(imgRat, joueur.x, joueur.y, 30, 30);
            if (joueur.boostActif) { ctx.fillStyle = "rgba(0,255,0,0.4)"; ctx.fillRect(0,0,30,30); }
            if (joueur.trappedTimer > 0) { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0,0,30,30); }
            if (joueur.controlsInvertedTimer > 0) { ctx.fillStyle = "rgba(128,0,128,0.3)"; ctx.fillRect(0,0,30,30); }
            ctx.fillStyle = "white"; ctx.font = "12px Arial"; ctx.fillText(joueur.idJoueur, (joueur.direction === -1) ? 0 : joueur.x, joueur.y - 10); ctx.restore();
        } else { ctx.fillStyle = (joueur.trappedTimer > 0) ? "black" : (joueur.controlsInvertedTimer > 0 ? "purple" : "gray"); ctx.fillRect(joueur.x, joueur.y, 30, 30); }
        ctx.globalAlpha = 1.0; 
    }
    // HUDs
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(10,10, 200, 80); ctx.fillStyle = "white"; ctx.font = "bold 20px Arial"; ctx.fillText("J1 Vies : ", 20, 35);
    if (monRat.estMort) { ctx.fillStyle = "red"; ctx.fillText("SPECTATEUR 👻", 100, 35); } else for(let i=0; i<monRat.vies; i++) dessinerSprite(imgCoeur, 100 + (i * 30), 15, 20, 20, "red");
    ctx.fillStyle = "white"; ctx.font = "16px Arial"; ctx.fillText(`Leviers : ${nbLeviersActifs}/3 🛠️`, 20, 60); ctx.fillText("P1 Power-up : ", 20, 80);
    if (monRat.inventaire) {
        let img = imgEclair; if (monRat.inventaire === 'piege') img = imgPiege; if (monRat.inventaire === 'vin') img = imgVin; if (monRat.inventaire === 'ressort') img = imgRessort;
        dessinerSprite(img, 130, 62, 25, 25, "cyan");
    } else { ctx.fillStyle = "#aaa"; ctx.fillText("(vide)", 130, 80); }
    if (texteActionAffiche) { ctx.fillStyle = "white"; ctx.font = "bold 16px Arial"; ctx.fillText("Interagir !", texteActionX - 10, texteActionY - 15); }
    if (etatPartie === "DEFAITE") { ctx.fillStyle = "rgba(100, 0, 0, 0.8)"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "white"; ctx.font = "bold 60px Arial"; ctx.textAlign = "center"; ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2); ctx.textAlign = "left"; }
    if (etatPartie === "VICTOIRE") { ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "gold"; ctx.font = "bold 60px Arial"; ctx.textAlign = "center"; ctx.fillText("VICTOIRE COLLECTIVE !", canvas.width / 2, canvas.height / 2); ctx.textAlign = "left"; }
    requestAnimationFrame(boucleDeJeu);
}

function checkCollisionAABB(r1, r2) { return (r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y); }
function dessinerSprite(img, x, y, w, h, couleurFallback) { if(img.complete && img.naturalWidth > 0) ctx.drawImage(img, x, y, w, h); else { ctx.fillStyle = couleurFallback; ctx.fillRect(x, y, w, h); } }
function dessinerSpriteRotatif(img, x, y, w, h, angle, couleurFallback) { if(img.complete && img.naturalWidth > 0) { ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(angle); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore(); } else { ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(angle); ctx.fillStyle = couleurFallback; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore(); } }
boucleDeJeu();