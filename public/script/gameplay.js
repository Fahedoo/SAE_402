// ==========================================
// 1. GESTIONNAIRE DE CLAVIER 
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
// 2. SIMULATION PHYSIQUE
// ==========================================
class EntitePhysique {
    constructor(x, y) { 
        this.x = x; this.y = y; this.vx = 0; this.vy = 0; 
        this.ignoreGravite = false; 
    }
    appliquerPhysique() {
        this.x += this.vx; this.y += this.vy;
        if (this.y < 500 && !this.ignoreGravite) {
            this.vy += 0.5; // Gravité
        }
    }
}

// ==========================================
// 3. LOGIQUE DU PERSONNAGE (Préparation Multijoueur)
// ==========================================
class Rat extends EntitePhysique {
    constructor(x, y, idJoueur, couleur) {
        super(x, y);
        this.idJoueur = idJoueur; this.couleur = couleur;
        
        this.vitesseMarche = 3; this.forceSaut = -8; this.vitesseEscalade = 2; 
        
        this.boostActif = false; this.surRat = false; 
        this.peutSauter = false; this.enEscalade = false;  
        
        this.viesMax = 3; this.vies = this.viesMax; this.framesInvincibilite = 0; 
        this.estMort = false; // NOUVEAU : État de mort
    }

    prendreDegat() {
        // On ne prend des dégâts que si on est vivant et pas invincible
        if (this.framesInvincibilite <= 0 && !this.estMort) {
            this.vies--; 
            this.framesInvincibilite = 60; 
            if (this.vies <= 0) {
                this.estMort = true; // On devient spectateur
                console.log(this.idJoueur + " est K.O. ! Mode Spectateur.");
            }
        }
    }

    soigner() { 
        if (!this.estMort && this.vies < this.viesMax) this.vies++; 
    }
    
    declencherSaut() {
        if (this.boostActif || this.surRat) {
            this.vy = this.forceSaut * 1.4; 
            this.boostActif = false; 
        } else {
            this.vy = this.forceSaut;
        }
    }
    
    calculerVelocite(touches) {
        // Si le rat est mort, il ne peut plus bouger !
        if (this.estMort) {
            this.vx = 0;
            return;
        }

        if (touches.gauche) this.vx = -this.vitesseMarche;
        else if (touches.droite) this.vx = this.vitesseMarche;
        else this.vx = 0; 

        if (this.enEscalade) {
            if (touches.saut) this.vy = -this.vitesseEscalade;
            else if (touches.bas) this.vy = this.vitesseEscalade;
            else this.vy = 0; 
        } else {
            if (touches.saut && this.peutSauter) {
                this.declencherSaut();
                touches.saut = false; this.peutSauter = false; 
            }
        }
        if (this.framesInvincibilite > 0) this.framesInvincibilite--;
    }
}

// ==========================================
// 4. OBSTACLES 
// ==========================================
class Obstacle {
    constructor(x, y, width, height, type) {
        this.x = x; this.y = y; this.width = width; this.height = height; this.type = type; 
        this.angle = 0; 
    }
    bouger() {
        if (this.type === "rouleau") {
            this.x -= 2; this.angle -= 0.05; if (this.x < -100) this.x = 850;
        } else if (this.type === "tomate") {
            this.x -= 3.5; this.angle -= 0.15; if (this.x < -50) this.x = 850;
        } else if (this.type === "couteau") {
            this.y += 5; if (this.y > 600) this.y = -50;
        }
    }
}

// ==========================================
// 5. DESIGN DU NIVEAU & VARIABLES GLOBALES
// ==========================================
const clavier = new Clavier();

// NOUVEAU : On met les joueurs dans une liste. Pour l'instant tu es seul.
const monRat = new Rat(50, 500, "joueur1", "gris"); 
let listeJoueurs = [monRat]; 

let etatPartie = "EN_COURS"; 

const listePlateformes = [
    { x: 50, y: 400, w: 250, h: 20 },  { x: 350, y: 300, w: 400, h: 20 },
    { x: 100, y: 200, w: 300, h: 20 }, { x: 400, y: 100, w: 200, h: 20 }
];
const listeEchelles = [{ x: 200, y: 400, width: 30, height: 100 }, { x: 360, y: 200, width: 30, height: 100 }];
const listeFauxRats = [{ x: 250, y: 350, width: 50, height: 50 }, { x: 200, y: 150, width: 50, height: 50 }];
let listeZonesBoost = [{ x: 500, y: 460, width: 40, height: 40, actif: true }, { x: 600, y: 260, width: 40, height: 40, actif: true }];
const listeLeviers = [
    { x: 80, y: 350, width: 30, height: 50, estActive: false },
    { x: 650, y: 250, width: 30, height: 50, estActive: false },
    { x: 120, y: 150, width: 30, height: 50, estActive: false }
];
const fromage = { x: 500, y: 60, width: 40, height: 40 };
const cloche = { x: fromage.x - 10, y: fromage.y - 10, width: fromage.width + 20, height: fromage.height + 20, estOuverte: false };

let listeObstacles = [
    new Obstacle(800, 460, 40, 40, "rouleau"), new Obstacle(600, 280, 20, 20, "tomate"), new Obstacle(400, -50, 15, 40, "couteau")
];
let bonusSoin = { x: 450, y: 460, width: 30, height: 30, actif: true };

// ==========================================
// 6. CHARGEMENT DES SPRITES
// ==========================================
const spriteRat = new Image(); spriteRat.src = '../assets/sprites/rats/rat_cours.png'; 
const spriteRouleau = new Image(); spriteRouleau.src = '../assets/sprites/items/Rouleau.png'; 
const spriteTomate = new Image(); spriteTomate.src = '../assets/sprites/items/tomate.gif';    
const spriteCouteau = new Image(); spriteCouteau.src = '../assets/sprites/items/couteaux.png'; 
const spriteFromage = new Image(); spriteFromage.src = '../assets/sprites/items/fromagewin.png'; 

const canvas = document.getElementById("ecranDeJeu");
const ctx = canvas.getContext("2d");

// ==========================================
// 7. BOUCLE DE JEU
// ==========================================
function boucleDeJeu() {
    // --- VÉRIFICATION GAME OVER MULTIJOUEUR ---
    let tousMorts = true;
    for (let joueur of listeJoueurs) {
        if (!joueur.estMort) {
            tousMorts = false;
            break;
        }
    }
    if (tousMorts && etatPartie === "EN_COURS") {
        etatPartie = "DEFAITE";
    }

    if (etatPartie === "EN_COURS") monRat.calculerVelocite(clavier.touches);
    else monRat.vx = 0; 
    
    monRat.appliquerPhysique();

    // Si on est mort, on arrête de gérer les collisions pour ce joueur
    if (!monRat.estMort) {
        monRat.peutSauter = false; monRat.surRat = false; 
        const boiteRat = { x: monRat.x, y: monRat.y - 50, w: 50, h: 50 };

        // --- ÉCHELLES ---
        let toucheEchelle = false;
        for (let echelle of listeEchelles) {
            if (boiteRat.x < echelle.x + echelle.width && boiteRat.x + boiteRat.w > echelle.x &&
                boiteRat.y < echelle.y + echelle.height && boiteRat.y + boiteRat.h > echelle.y) {
                toucheEchelle = true;
                if (!monRat.enEscalade && (clavier.touches.saut || clavier.touches.bas)) {
                    monRat.enEscalade = true; monRat.ignoreGravite = true; 
                }
            }
        }
        if (!toucheEchelle) { monRat.enEscalade = false; monRat.ignoreGravite = false; }

        // --- COLLISIONS ---
        if (monRat.y >= 500) { monRat.y = 500; monRat.vy = 0; monRat.peutSauter = true; }

        if (!monRat.enEscalade) {
            for (let plat of listePlateformes) {
                if (monRat.vy >= 0 && monRat.y >= plat.y && monRat.y <= plat.y + 20 &&
                    monRat.x + 50 > plat.x && monRat.x < plat.x + plat.w) {
                    monRat.y = plat.y; monRat.vy = 0; monRat.peutSauter = true;
                }
            }
            for (let fRat of listeFauxRats) {
                let aligne = (monRat.x < fRat.x + fRat.width && monRat.x + 50 > fRat.x);
                if (monRat.vy >= 0 && monRat.y >= fRat.y && monRat.y <= fRat.y + 20 && aligne) {
                    monRat.y = fRat.y; monRat.vy = 0; monRat.peutSauter = true; monRat.surRat = true; 
                }
            }
        }

        // --- ZONES BOOST ---
        for (let zone of listeZonesBoost) {
            if (zone.actif && boiteRat.x < zone.x + zone.width && boiteRat.x + boiteRat.w > zone.x &&
                boiteRat.y < zone.y + zone.height && boiteRat.y + boiteRat.h > zone.y) {
                monRat.boostActif = true; zone.actif = false; 
            }
        }

        // --- LEVIERS ---
        let texteActionAffiche = false; let texteActionX = 0, texteActionY = 0;
        for (let lev of listeLeviers) {
            if (!lev.estActive) {
                const margeInter = 30; 
                if (boiteRat.x < lev.x + lev.width + margeInter && boiteRat.x + boiteRat.w > lev.x - margeInter &&
                    boiteRat.y < lev.y + lev.height + margeInter && boiteRat.y + boiteRat.h > lev.y - margeInter) {
                    texteActionAffiche = true; texteActionX = lev.x; texteActionY = lev.y;
                    if (clavier.touches.action) {
                        lev.estActive = true; clavier.touches.action = false; 
                    }
                }
            }
        }

        // --- OBSTACLES & SOIN ---
        if (etatPartie === "EN_COURS") {
            for (let obs of listeObstacles) {
                if (boiteRat.x < obs.x + obs.width && boiteRat.x + boiteRat.w > obs.x &&
                    boiteRat.y < obs.y + obs.height && boiteRat.y + boiteRat.h > obs.y) {
                    monRat.prendreDegat();
                }
            }
            if (bonusSoin.actif && boiteRat.x < bonusSoin.x + bonusSoin.width && boiteRat.x + boiteRat.w > bonusSoin.x &&
                boiteRat.y < bonusSoin.y + bonusSoin.height && boiteRat.y + boiteRat.h > bonusSoin.y) {
                monRat.soigner(); bonusSoin.actif = false; 
            }
        }

        // --- VICTOIRE ---
        if (etatPartie === "EN_COURS" && cloche.estOuverte &&
            boiteRat.x < fromage.x + fromage.width && boiteRat.x + boiteRat.w > fromage.x &&
            boiteRat.y < fromage.y + fromage.height && boiteRat.y + boiteRat.h > fromage.y) {
            etatPartie = "VICTOIRE";
        }
        
        // --- AFFICHAGE TEXTE ACTION ---
        if (texteActionAffiche) {
            ctx.fillStyle = "white"; ctx.font = "bold 16px Arial"; ctx.fillText("Appuie sur E", texteActionX - 30, texteActionY - 15);
        }
    } // Fin de la condition "Si pas mort"

    // Les obstacles bougent toujours, même si on est mort
    if (etatPartie === "EN_COURS") {
        for (let obs of listeObstacles) obs.bouger();
    }

    // Gestion de la Cloche globale
    let nbLeviersActifs = listeLeviers.filter(l => l.estActive).length;
    cloche.estOuverte = (nbLeviersActifs === listeLeviers.length);


    // ================== RENDU VISUEL ==================
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#8B4513"; ctx.fillRect(0, 500, canvas.width, 100);
    ctx.fillStyle = "#CD853F"; for (let plat of listePlateformes) { ctx.fillRect(plat.x, plat.y, plat.w, plat.h); }

    ctx.fillStyle = "#DEB887";
    for (let ech of listeEchelles) { 
        ctx.fillRect(ech.x, ech.y, ech.width, ech.height); 
        ctx.fillStyle = "#A0522D";
        for (let i = ech.y + 10; i < ech.y + ech.height; i += 20) { ctx.fillRect(ech.x, i, ech.width, 5); }
        ctx.fillStyle = "#DEB887";
    }

    ctx.fillStyle = "#557799"; for (let fRat of listeFauxRats) { ctx.fillRect(fRat.x, fRat.y, fRat.width, fRat.height); }

    for (let zone of listeZonesBoost) {
        if (zone.actif) { ctx.fillStyle = zone.couleur; ctx.fillRect(zone.x, zone.y, zone.width, zone.height); }
    }

    for (let lev of listeLeviers) {
        ctx.fillStyle = lev.estActive ? "lime" : "red"; ctx.fillRect(lev.x, lev.y, lev.width, lev.height);
    }

    try { ctx.drawImage(spriteFromage, fromage.x, fromage.y, fromage.width, fromage.height); }
    catch { ctx.fillStyle = "gold"; ctx.fillRect(fromage.x, fromage.y, fromage.width, fromage.height); }
    
    if (!cloche.estOuverte) {
        ctx.fillStyle = "rgba(180, 200, 220, 0.85)"; ctx.fillRect(cloche.x, cloche.y, cloche.width, cloche.height);
    }

    for (let obs of listeObstacles) {
        if (obs.type === "rouleau" || obs.type === "tomate") {
            ctx.save(); 
            ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
            ctx.rotate(obs.angle); 
            let img = (obs.type === "rouleau") ? spriteRouleau : spriteTomate;
            try { ctx.drawImage(img, -obs.width / 2, -obs.height / 2, obs.width, obs.height); } 
            catch { ctx.fillStyle = (obs.type === "rouleau") ? "saddlebrown" : "red"; ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height); }
            ctx.restore(); 
        } else if (obs.type === "couteau") {
            try { ctx.drawImage(spriteCouteau, obs.x, obs.y, obs.width, obs.height); } 
            catch { ctx.fillStyle = "silver"; ctx.fillRect(obs.x, obs.y, obs.width, obs.height); }
        }
    }

    if (bonusSoin.actif) { ctx.fillStyle = "pink"; ctx.fillRect(bonusSoin.x, bonusSoin.y, bonusSoin.width, bonusSoin.height); }

    // --- DESSINER TOUS LES JOUEURS ---
    for (let joueur of listeJoueurs) {
        if (joueur.estMort) {
            // Effet Spectateur (Fantôme transparent)
            ctx.globalAlpha = 0.4; 
        } else if (joueur.framesInvincibilite > 0 && joueur.framesInvincibilite % 10 >= 5) {
            // Clignotement de dégâts (on ne dessine pas sur cette frame)
            continue; 
        }

        try { ctx.drawImage(spriteRat, joueur.x, joueur.y - 50, 50, 50); }
        catch { ctx.fillStyle = "gray"; ctx.fillRect(joueur.x, joueur.y - 50, 50, 50); }
        
        ctx.globalAlpha = 1.0; // On remet l'opacité normale pour le reste
    }

    // HUD
    ctx.fillStyle = "white"; ctx.font = "20px Arial";
    let texteVies = "Vies : "; 
    if (monRat.estMort) texteVies = "SPECTATEUR 👻";
    else for(let i=0; i<monRat.vies; i++) texteVies += "❤️";
    ctx.fillText(texteVies, 20, 30);
    ctx.font = "16px Arial"; ctx.fillText(`Leviers : ${nbLeviersActifs}/3`, 20, 55);

    if (monRat.boostActif || monRat.surRat) {
        ctx.strokeStyle = "lime"; ctx.lineWidth = 3; ctx.strokeRect(monRat.x, monRat.y - 50, 50, 50);
        ctx.fillStyle = "lime"; ctx.font = "bold 16px Arial"; ctx.fillText("SAUT BOOSTÉ PRÊT !", monRat.x - 30, monRat.y - 60);
    }

    if (etatPartie === "VICTOIRE") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "gold"; ctx.font = "bold 60px Arial"; ctx.textAlign = "center";
        ctx.fillText("VICTOIRE !", canvas.width / 2, canvas.height / 2); ctx.textAlign = "left"; 
    } else if (etatPartie === "DEFAITE") {
        ctx.fillStyle = "rgba(100, 0, 0, 0.8)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white"; ctx.font = "bold 60px Arial"; ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2); ctx.textAlign = "left"; 
    }

    requestAnimationFrame(boucleDeJeu);
}

boucleDeJeu();