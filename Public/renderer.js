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

        this.imgChef3 = new Image();
        this.imgChef3.src = 'assets/chef_3.png'; 
        this.imgChef2 = new Image();
        this.imgChef2.src = 'assets/chef_2.png'; 
        this.imgChef1 = new Image();
        this.imgChef1.src = 'assets/chef_1.png'; 

        // --- NOUVEAU : CHARGEMENT DU FROMAGE ---
        this.imgFromage = new Image();
        this.imgFromage.src = 'assets/fromage.png'; // Vérifie bien le nom de ton fichier !

        // Variables pour l'animation du chef
        this.chefFrame = 0;             
        this.lastChefSwap = Date.now(); 
        
        this.vfx = new VFXManager();

        // --- TES PLATEFORMES ---
        this.platforms = [
            { x: 42,   y: 800, w: this.canvas.width-81, h: 18, slope: -50 }, // Bas (0)
            { x: 42,   y: 620, w: this.canvas.width-254, h: 18, slope: 45  }, // Étage 2 (1)
            { x: 109,  y: 520, w: this.canvas.width-149, h: 18, slope: -50 }, // Étage 3 (2)
            { x: 42,   y: 353, w: this.canvas.width-145, h: 18, slope: 50  }, // Étage 4 (3)
            { x: 42,   y: 275, w: this.canvas.width-83, h: 18, slope: -65  }, // Étage 5 (4)
            { x: 63,   y: 125, w: this.canvas.width - 228, h: 18, slope: 30 }, // Sommet Chef (5)
            // --- NOUVEAU : LA MINI-PLATEFORME DU FROMAGE ---
            { x: 300,  y: 70,  w: 170, h: 18, slope: 0 } // L'objectif tout en haut ! (6)
        ];

        // --- TES ÉCHELLES (Dynamiques) ---
        this.ladders = [
            { x: 600, topIndex: 1, bottomIndex: 0, w: 30 }, // Relie Étage 2 (1) au Bas (0)
            { x: 150, topIndex: 2, bottomIndex: 1, w: 30 }, // Relie Étage 3 (2) à Étage 2 (1)
            { x: 650, topIndex: 3, bottomIndex: 2, w: 30 }, // Relie Étage 4 (3) à Étage 3 (2)
            { x: 100, topIndex: 4, bottomIndex: 3, w: 30 }, // Relie Étage 5 (4) à Étage 4 (3)
            { x: 600, topIndex: 5, bottomIndex: 4, w: 30 }, // Relie Sommet (5) à Étage 5 (4)
            // --- NOUVEAU : L'ÉCHELLE VERS LE FROMAGE ---
            { x: 420, topIndex: 6, bottomIndex: 5, w: 30 }  // Relie Fromage (6) au Sommet (5)
        ];

        // --- TES ÉCHELLES CASSÉES (Protection visuelle) ---
        this.brokenLadders = [
            { x: 350, topIndex: 2, bottomIndex: 1, w: 30 }, // Entre étage 3 et 2
            { x: 450, topIndex: 4, bottomIndex: 3, w: 30 }  // Entre étage 5 et 4
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
            const yTopL = this.getPlatformY(lad.topIndex, lad.x);
            const yBotL = this.getPlatformY(lad.bottomIndex, lad.x);
            const yTopR = this.getPlatformY(lad.topIndex, lad.x + lad.w);
            const yBotR = this.getPlatformY(lad.bottomIndex, lad.x + lad.w);

            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(lad.x + 3, yTopL + 3);
            this.ctx.lineTo(lad.x + 3, yBotL + 3);
            this.ctx.moveTo(lad.x + lad.w + 3, yTopR + 3);
            this.ctx.lineTo(lad.x + lad.w + 3, yBotR + 3);
            this.ctx.stroke();

            this.ctx.strokeStyle = '#d1d8e0'; 
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(lad.x, yTopL);
            this.ctx.lineTo(lad.x, yBotL);
            this.ctx.moveTo(lad.x + lad.w, yTopR);
            this.ctx.lineTo(lad.x + lad.w, yBotR);
            this.ctx.stroke();

            this.ctx.lineWidth = 3;
            const centerTopY = (yTopL + yTopR) / 2;
            const centerBotY = (yBotL + yBotR) / 2;
            const ladH = centerBotY - centerTopY;

            for (let i = 15; i < ladH - 5; i += 20) {
                const barY = centerTopY + i;
                
                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                this.ctx.beginPath();
                this.ctx.moveTo(lad.x, barY + 2);
                this.ctx.lineTo(lad.x + lad.w, barY + 2);
                this.ctx.stroke();

                this.ctx.strokeStyle = '#a5b1c2';
                this.ctx.beginPath();
                this.ctx.moveTo(lad.x, barY);
                this.ctx.lineTo(lad.x + lad.w, barY);
                this.ctx.stroke();
            }
        });
        this.ctx.restore();
    }

    drawBrokenLadders() {
        this.ctx.save();
        this.brokenLadders.forEach(lad => {
            const yTopL = this.getPlatformY(lad.topIndex, lad.x);
            const yBotL = this.getPlatformY(lad.bottomIndex, lad.x);
            const yTopR = this.getPlatformY(lad.topIndex, lad.x + lad.w);
            const yBotR = this.getPlatformY(lad.bottomIndex, lad.x + lad.w);

            const centerTopY = (yTopL + yTopR) / 2;
            const centerBotY = (yBotL + yBotR) / 2;
            const ladH = centerBotY - centerTopY;

            const tailleBout = ladH * 0.3; 

            const drawSegment = (startY, endY) => {
                const ratioStart = (startY - centerTopY) / ladH;
                const ratioEnd = (endY - centerTopY) / ladH;
                
                const segTopL = yTopL + (yBotL - yTopL) * ratioStart;
                const segTopR = yTopR + (yBotR - yTopR) * ratioStart;
                const segBotL = yTopL + (yBotL - yTopL) * ratioEnd;
                const segBotR = yTopR + (yBotR - yTopR) * ratioEnd;

                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.moveTo(lad.x + 3, segTopL + 3);
                this.ctx.lineTo(lad.x + 3, segBotL + 3);
                this.ctx.moveTo(lad.x + lad.w + 3, segTopR + 3);
                this.ctx.lineTo(lad.x + lad.w + 3, segBotR + 3);
                this.ctx.stroke();

                this.ctx.strokeStyle = '#d1d8e0'; 
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.moveTo(lad.x, segTopL);
                this.ctx.lineTo(lad.x, segBotL);
                this.ctx.moveTo(lad.x + lad.w, segTopR);
                this.ctx.lineTo(lad.x + lad.w, segBotR);
                this.ctx.stroke();

                this.ctx.lineWidth = 3;
                for (let i = 15; i < ladH - 5; i += 20) {
                    const barY = centerTopY + i;
                    if (barY >= startY && barY <= endY) {
                        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                        this.ctx.beginPath();
                        this.ctx.moveTo(lad.x, barY + 2);
                        this.ctx.lineTo(lad.x + lad.w, barY + 2);
                        this.ctx.stroke();

                        this.ctx.strokeStyle = '#a5b1c2';
                        this.ctx.beginPath();
                        this.ctx.moveTo(lad.x, barY);
                        this.ctx.lineTo(lad.x + lad.w, barY);
                        this.ctx.stroke();
                    }
                }
            };
            drawSegment(centerTopY, centerTopY + tailleBout);
            drawSegment(centerBotY - tailleBout, centerBotY);
        });
        this.ctx.restore();
    }

    drawPlatforms() {
        this.ctx.lineWidth = 1; 
        this.platforms.forEach(plat => {
            const x1 = plat.x;
            const y1 = plat.y;
            const x2 = plat.x + plat.w;
            const y2 = plat.y + plat.slope;

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.beginPath();
            this.ctx.moveTo(x1 + 4, y1 + 4);
            this.ctx.lineTo(x2 + 4, y2 + 4);
            this.ctx.lineTo(x2 + 4, y2 + plat.h + 4);
            this.ctx.lineTo(x1 + 4, y1 + plat.h + 4);
            this.ctx.fill();

            let grad = this.ctx.createLinearGradient(x1, y1, x1, y1 + plat.h);
            grad.addColorStop(0, '#d1d8e0'); grad.addColorStop(1, '#778ca3');
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2);
            this.ctx.lineTo(x2, y2 + plat.h); this.ctx.lineTo(x1, y1 + plat.h);
            this.ctx.fill();

            this.ctx.strokeStyle = '#4b6584';
            this.ctx.stroke();
        });
    }

    draw(otherPlayers = {}) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawLadders();
        this.drawBrokenLadders(); 
        this.drawPlatforms();

        // ==========================================
        // --- DESSIN DU FROMAGE (Largeur 60px, Hauteur auto) ---
        // ==========================================
        if (this.imgFromage.complete && this.imgFromage.naturalWidth > 0) {
            
            // On fixe la largeur voulue
            const fw = 100; 
            
            // Le jeu calcule tout seul le coefficient de réduction (ex: 60 / 320)
            const echelleFromage = fw / this.imgFromage.naturalWidth; 
            
            // On applique ce même coefficient à la hauteur pour garder les proportions
            const fh = this.imgFromage.naturalHeight * echelleFromage;

            // On cible la petite plateforme tout en haut (index 6)
            const platFromage = this.platforms[6];
            
            const decalageX = 10;
            const fromX = platFromage.x + decalageX; 
            
            // Ajustement vertical si le fromage vole un peu ou rentre dans le métal
            const decalageY = 21; 
            
            // On calcule la position Y finale
            const fromY = this.getPlatformY(6, fromX + fw / 2) - fh + decalageY;

            this.ctx.drawImage(this.imgFromage, fromX, fromY, fw, fh);
        }

        // ==========================================
        // --- DESSIN DU CHEF (Animation 3-2-1 ttes les 3s) ---
        // ==========================================
        if (Date.now() - this.lastChefSwap > 3000) {
            this.chefFrame = this.chefFrame + 1;
            if (this.chefFrame >= 3) {
                this.chefFrame = 0;
            }
            this.lastChefSwap = Date.now();
        }

        const chefImages = [this.imgChef3, this.imgChef2, this.imgChef1];
        const currentChefImg = chefImages[this.chefFrame];

        if (currentChefImg && currentChefImg.complete && currentChefImg.naturalWidth > 0) {
            let echelle = 0.8;
            let decalagePieds = 4;

            if (this.chefFrame === 1) {
                echelle = 0.95;       
                decalagePieds = 8;  
            }

            if (this.chefFrame === 2) {
                echelle = 0.75;       
                decalagePieds = 2;  
            }

            const cw = currentChefImg.naturalWidth * echelle;
            const ch = currentChefImg.naturalHeight * echelle;

            const platSommet = this.platforms[5];
            const chefX = platSommet.x + 120; 
            const chefY = this.getPlatformY(5, chefX + cw / 2) - ch + decalagePieds;

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