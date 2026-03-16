// renderer.js - Contrôle total, pseudo simple et échelles propres
import { VFXManager } from './vfx.js';

// Cache pour les animations des autres joueurs
const otherSkinsIdle = {};
const otherSkinsRun = {};

export class GameRenderer {
    constructor(canvas, color = 'gray') {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        this.imgIdle = new Image();
        this.imgIdle.src = `assets/rat_idle_${color}.png`; 
        this.imgRun = new Image();
        this.imgRun.src = `assets/rat_run_${color}.png`; 

        this.imgChef1 = new Image();
        this.imgChef1.src = 'assets/chef_1.png'; // Remplace par ton vrai nom de fichier
        this.imgChef2 = new Image();
        this.imgChef2.src = 'assets/chef_2.png'; // Remplace par ton vrai nom de fichier
        
        // Variables pour l'animation du chef
        this.chefFrame = 0;             // 0 pour image 1, 1 pour image 2
        this.lastChefSwap = Date.now(); // Chronomètre
        // --------------------------
        
        this.vfx = new VFXManager();

        // --- TES PLATEFORMES ---
        this.platforms = [
            { x: 42,   y: 800, w: this.canvas.width-81, h: 18, slope: -50 }, // Bas
            { x: 42,   y: 620, w: this.canvas.width-254, h: 18, slope: 45  }, // Étage 2
            { x: 109,  y: 520, w: this.canvas.width-149, h: 18, slope: -50 }, // Étage 3
            { x: 42,   y: 350, w: this.canvas.width-145, h: 18, slope: 50  }, // Étage 4
            { x: 42,   y: 270, w: this.canvas.width-83, h: 18, slope: -65  }, // Étage 5
            { x: 63,   y: 105, w: this.canvas.width - 228, h: 18, slope: 30 } // Sommet
        ];

        // --- TES ÉCHELLES ---
        // --- TES ÉCHELLES (Dynamiques) ---
        // topIndex: Plateforme du haut | bottomIndex: Plateforme du bas
        this.ladders = [
            { x: 600, topIndex: 1, bottomIndex: 0, w: 30 }, // Relie Étage 2 (1) au Bas (0)
            { x: 150, topIndex: 2, bottomIndex: 1, w: 30 }, // Relie Étage 3 (2) à Étage 2 (1)
            { x: 650, topIndex: 3, bottomIndex: 2, w: 30 }, // Relie Étage 4 (3) à Étage 3 (2)
            { x: 180, topIndex: 4, bottomIndex: 3, w: 30 }, // Relie Étage 5 (4) à Étage 4 (3)
            { x: 600, topIndex: 5, bottomIndex: 4, w: 30 }  // Relie Sommet (5) à Étage 5 (4)
        ];

        this.player = {
            x: 100,
            y: 800 - 64, // Position de départ
            isMoving: false,
            direction: -1 
        };

        this.setupTestControls();
    }

    // --- UTILITAIRE : Calcule le Y exact d'une plateforme à une position X ---
    getPlatformY(index, targetX) {
        const plat = this.platforms[index];
        const ratio = (targetX - plat.x) / plat.w;
        return plat.y + (plat.slope * ratio);
    }

    drawLadders() {
        this.ctx.save();

        this.ladders.forEach(lad => {
            // Calcul dynamique des hauteurs exactes (gauche et droite pour suivre la pente)
            const yTopL = this.getPlatformY(lad.topIndex, lad.x);
            const yBotL = this.getPlatformY(lad.bottomIndex, lad.x);
            const yTopR = this.getPlatformY(lad.topIndex, lad.x + lad.w);
            const yBotR = this.getPlatformY(lad.bottomIndex, lad.x + lad.w);

            // 1. Ombre portée (coupée parfaitement)
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(lad.x + 3, yTopL + 3);
            this.ctx.lineTo(lad.x + 3, yBotL + 3);
            this.ctx.moveTo(lad.x + lad.w + 3, yTopR + 3);
            this.ctx.lineTo(lad.x + lad.w + 3, yBotR + 3);
            this.ctx.stroke();

            // 2. Montants verticaux (ne dépassent plus)
            this.ctx.strokeStyle = '#d1d8e0'; 
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(lad.x, yTopL);
            this.ctx.lineTo(lad.x, yBotL);
            this.ctx.moveTo(lad.x + lad.w, yTopR);
            this.ctx.lineTo(lad.x + lad.w, yBotR);
            this.ctx.stroke();

            // 3. Barreaux (répartis sur la hauteur réelle)
            this.ctx.lineWidth = 3;
            const centerTopY = (yTopL + yTopR) / 2;
            const centerBotY = (yBotL + yBotR) / 2;
            const ladH = centerBotY - centerTopY;

            // On dessine les barreaux en restant dans les limites
            for (let i = 15; i < ladH - 5; i += 20) {
                const barY = centerTopY + i;
                
                // Ombre du barreau
                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                this.ctx.beginPath();
                this.ctx.moveTo(lad.x, barY + 2);
                this.ctx.lineTo(lad.x + lad.w, barY + 2);
                this.ctx.stroke();

                // Métal du barreau
                this.ctx.strokeStyle = '#a5b1c2';
                this.ctx.beginPath();
                this.ctx.moveTo(lad.x, barY);
                this.ctx.lineTo(lad.x + lad.w, barY);
                this.ctx.stroke();
            }
        });

        this.ctx.restore();
    }

    drawPlatforms() {
        this.ctx.lineWidth = 1; // On s'assure que le trait est fin
        this.platforms.forEach(plat => {
            const x1 = plat.x;
            const y1 = plat.y;
            const x2 = plat.x + plat.w;
            const y2 = plat.y + plat.slope;

            // Ombre
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.beginPath();
            this.ctx.moveTo(x1 + 4, y1 + 4);
            this.ctx.lineTo(x2 + 4, y2 + 4);
            this.ctx.lineTo(x2 + 4, y2 + plat.h + 4);
            this.ctx.lineTo(x1 + 4, y1 + plat.h + 4);
            this.ctx.fill();

            // Corps Inox
            let grad = this.ctx.createLinearGradient(x1, y1, x1, y1 + plat.h);
            grad.addColorStop(0, '#d1d8e0'); grad.addColorStop(1, '#778ca3');
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2);
            this.ctx.lineTo(x2, y2 + plat.h); this.ctx.lineTo(x1, y1 + plat.h);
            this.ctx.fill();

            // Bordure fine originale
            this.ctx.strokeStyle = '#4b6584';
            this.ctx.stroke();
        });
    }

    draw(otherPlayers = {}) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Ordre important : Échelles d'abord, plateformes par-dessus
        this.drawLadders();
        this.drawPlatforms();

        // ==========================================
        // --- DESSIN DU CHEF (Animation ttes les 2s) ---
        // ==========================================
        
        // 1. On vérifie le chronomètre : Si 2000 ms (2 sec) sont passées
        if (Date.now() - this.lastChefSwap > 2000) {
            // On alterne entre 0 et 1
            this.chefFrame = this.chefFrame === 0 ? 1 : 0;
            // On remet le chrono à zéro
            this.lastChefSwap = Date.now();
        }

        // 2. On choisit la bonne image selon la frame
        const currentChefImg = this.chefFrame === 0 ? this.imgChef1 : this.imgChef2;

        // 3. On le dessine S'IL est chargé
        if (currentChefImg && currentChefImg.complete && currentChefImg.naturalWidth > 0) {
            const echelle = 0.7; // 2 = deux fois plus grand, 0.5 = deux fois plus petit
            const cw = currentChefImg.naturalWidth * echelle;
            const ch = currentChefImg.naturalHeight * echelle;

            // La plateforme du sommet est la dernière (index 5)
            const platSommet = this.platforms[5];
            
            // Position X : un peu décalé du bord gauche de sa plateforme
            const chefX = platSommet.x + 70; 
            
            // Position Y : Grâce à la fonction mathématique qu'on a créée pour les échelles !
            // On calcule la hauteur de la pente au milieu du chef, et on soustrait sa hauteur
            const chefY = this.getPlatformY(5, chefX + cw / 2) - ch;

            this.ctx.drawImage(currentChefImg, chefX, chefY, cw, ch);
        }

        // --- 1. DESSIN DES AUTRES JOUEURS ---
        Object.values(otherPlayers).forEach(p => {
            if (!otherSkinsIdle[p.color]) {
                otherSkinsIdle[p.color] = new Image();
                otherSkinsIdle[p.color].src = `assets/rat_idle_${p.color}.png`;
            }
            if (!otherSkinsRun[p.color]) {
                otherSkinsRun[p.color] = new Image();
                otherSkinsRun[p.color].src = `assets/rat_run_${p.color}.png`;
            }

            const skin = p.isMoving ? otherSkinsRun[p.color] : otherSkinsIdle[p.color];

            if (skin && skin.complete && skin.naturalWidth > 0) {
                const ow = skin.naturalWidth; 
                const oh = skin.naturalHeight;
                
                this.ctx.save();
                if (p.direction === 1) {
                    this.ctx.translate(p.x + ow / 2, p.y + oh / 2);
                    this.ctx.scale(-1, 1);
                    this.ctx.drawImage(skin, -ow / 2, -oh / 2, ow, oh);
                } else {
                    this.ctx.drawImage(skin, p.x, p.y, ow, oh);
                }
                this.ctx.restore();

                // Pseudo simple
                this.ctx.fillStyle = "white";
                this.ctx.font = "bold 14px Arial";
                this.ctx.textAlign = "center";
                this.ctx.fillText(p.pseudo || "Rat", p.x + ow/2, p.y - 10);
            }
        });

        // --- 2. TON JOUEUR ---
        const currentImg = this.player.isMoving ? this.imgRun : this.imgIdle;

        if (currentImg && currentImg.complete && currentImg.naturalWidth > 0) {
            const w = currentImg.naturalWidth; 
            const h = currentImg.naturalHeight;

            if (this.player.isMoving) {
                let nextX = this.player.x + (5 * this.player.direction);
                if (nextX < 0) nextX = 0;
                if (nextX > this.canvas.width - w) nextX = this.canvas.width - w;
                this.player.x = nextX;
            }

            this.platforms.forEach(plat => {
                const footX = this.player.x + (w / 2);
                if (footX >= plat.x && footX <= plat.x + plat.w) {
                    const ratio = (footX - plat.x) / plat.w;
                    const groundY = plat.y + (plat.slope * ratio);
                    if (Math.abs(this.player.y - (groundY - h)) < 50) {
                        this.player.y = groundY - h;
                    }
                }
            });

            this.ctx.save();
            if (this.player.direction === 1) {
                this.ctx.translate(this.player.x + w / 2, this.player.y + h / 2);
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(currentImg, -w / 2, -h / 2, w, h);
            } else {
                this.ctx.drawImage(currentImg, this.player.x, this.player.y, w, h);
            }
            this.ctx.restore();
        }

        this.vfx.update();
        this.vfx.draw(this.ctx);
    }

    triggerExplosion(x, y, type) { this.vfx.createExplosion(x, y, type); }

    setupTestControls() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'd' || key === 'arrowright') { this.player.isMoving = true; this.player.direction = 1; }
            if (key === 'q' || key === 'a' || key === 'arrowleft') { this.player.isMoving = true; this.player.direction = -1; }
        });
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (['d', 'q', 'a', 'arrowright', 'arrowleft'].includes(key)) this.player.isMoving = false;
        });
    }
}