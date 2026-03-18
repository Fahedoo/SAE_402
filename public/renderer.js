import { VFXManager } from './vfx.js';

const allSkinsIdle = {};
const allSkinsRun = {};
const allSkinsClimb = {}; 

export class GameRenderer {
    constructor(canvas, color = 'gray', socket) { 
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.socket = socket; 

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

        this.imgFromage = new Image();
        this.imgFromage.src = 'assets/fromage.png'; 

        this.imgTomate = new Image();
        this.imgTomate.src = 'assets/tomate.png'; 
        
        // 🌟 NOUVEAU : Chargement du sprite Coeur
        this.imgCoeur = new Image();
        this.imgCoeur.src = 'assets/coeur.png';

        this.chefFrame = 0;             
        this.lastChefSwap = Date.now(); 
        
        this.vfx = new VFXManager();

        this.platforms = [
            { x: 42,   y: 800, w: this.canvas.width-81, h: 18, slope: -50 }, 
            { x: 42,   y: 620, w: this.canvas.width-254, h: 18, slope: 45  }, 
            { x: 109,  y: 520, w: this.canvas.width-149, h: 18, slope: -50 }, 
            { x: 42,   y: 353, w: this.canvas.width-145, h: 18, slope: 50  }, 
            { x: 42,   y: 275, w: this.canvas.width-83, h: 18, slope: -65  }, 
            { x: 63,   y: 125, w: this.canvas.width - 228, h: 18, slope: 30 }, 
            { x: 300,  y: 70,  w: 170, h: 18, slope: 0 } 
        ];

        this.ladders = [
            { x: 600, topIndex: 1, bottomIndex: 0, w: 30 }, 
            { x: 150, topIndex: 2, bottomIndex: 1, w: 30 }, 
            { x: 650, topIndex: 3, bottomIndex: 2, w: 30 }, 
            { x: 100, topIndex: 4, bottomIndex: 3, w: 30 }, 
            { x: 600, topIndex: 5, bottomIndex: 4, w: 30 }, 
            { x: 420, topIndex: 6, bottomIndex: 5, w: 30 }  
        ];

        this.brokenLadders = [
            { x: 350, topIndex: 2, bottomIndex: 1, w: 30 }, 
            { x: 450, topIndex: 4, bottomIndex: 3, w: 30 }  
        ];

        this.setupTestControls();
    }

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

    draw(state = { players: {}, tomatoes: [], hearts: [] }) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawLadders();
        this.drawBrokenLadders(); 
        this.drawPlatforms();

        if (this.imgFromage.complete && this.imgFromage.naturalWidth > 0) {
            const fw = 100; 
            const echelleFromage = fw / this.imgFromage.naturalWidth; 
            const fh = this.imgFromage.naturalHeight * echelleFromage;
            const platFromage = this.platforms[6];
            const decalageX = 10;
            const fromX = platFromage.x + decalageX; 
            const decalageY = 21; 
            const fromY = this.getPlatformY(6, fromX + fw / 2) - fh + decalageY;
            this.ctx.drawImage(this.imgFromage, fromX, fromY, fw, fh);
        }

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

            if (this.chefFrame === 1) { echelle = 0.95; decalagePieds = 8; }
            if (this.chefFrame === 2) { echelle = 0.75; decalagePieds = 2; }

            const cw = currentChefImg.naturalWidth * echelle;
            const ch = currentChefImg.naturalHeight * echelle;
            const platSommet = this.platforms[5];
            const chefX = platSommet.x + 120; 
            const chefY = this.getPlatformY(5, chefX + cw / 2) - ch + decalagePieds;

            this.ctx.drawImage(currentChefImg, chefX, chefY, cw, ch);
        }

        // DESSIN DES OBJETS (Tomates et Coeurs)
        if (state.tomatoes) state.tomatoes.forEach(t => {
            if (this.imgTomate.complete && this.imgTomate.naturalWidth > 0) {
                this.ctx.drawImage(this.imgTomate, t.x, t.y, 30, 30);
            } else {
                this.ctx.font = "24px Arial";
                this.ctx.fillText("🍅", t.x, t.y + 24); 
            }
        });
        
        // 🌟 NOUVEAU : Affichage du sprite coeur
        if (state.hearts) state.hearts.forEach(h => {
            if (this.imgCoeur.complete && this.imgCoeur.naturalWidth > 0) {
                // Petit effet de lévitation sympa pour le coeur (monte et descend doucement)
                const floatY = Math.sin(Date.now() / 200) * 5; 
                this.ctx.drawImage(this.imgCoeur, h.x, h.y + floatY, 30, 30);
            } else {
                this.ctx.font = "24px Arial";
                this.ctx.fillText("💖", h.x, h.y + 24);
            }
        });

        // DESSIN DES JOUEURS
        Object.values(state.players).forEach(p => {
            if (!p.color) p.color = 'gray'; 

            if (!allSkinsIdle[p.color]) {
                allSkinsIdle[p.color] = new Image();
                allSkinsIdle[p.color].src = `assets/rat_idle_${p.color}.png`;
            }
            if (!allSkinsRun[p.color]) {
                allSkinsRun[p.color] = new Image();
                allSkinsRun[p.color].src = `assets/rat_run_${p.color}.png`;
            }
            if (!allSkinsClimb[p.color]) {
                allSkinsClimb[p.color] = new Image();
                allSkinsClimb[p.color].src = `assets/rat_echelle_${p.color}.png`; 
            }

            let skin = p.isMoving ? allSkinsRun[p.color] : allSkinsIdle[p.color];
            if (p.isClimbing) skin = allSkinsClimb[p.color];

            if (skin && skin.complete && skin.naturalWidth > 0) {
                const ow = skin.naturalWidth; 
                const oh = skin.naturalHeight;
                
                let renderX = p.x;
                let renderY = p.y; 

                // Magnétisme visuel sur les pentes
                if (p.on_ground) {
                    this.platforms.forEach((plat, index) => {
                        const footX = renderX + (ow / 2); 
                        if (footX >= plat.x && footX <= plat.x + plat.w) {
                            const groundY = this.getPlatformY(index, footX);
                            if (Math.abs(p.y - (groundY - oh)) < 15) {
                                renderY = groundY - oh; 
                            }
                        }
                    });
                }

                this.ctx.save();

                // On se place au centre de l'image pour faire des rotations propres
                this.ctx.translate(renderX + ow / 2, renderY + oh / 2);

                if (p.isDead) {
                    this.ctx.globalAlpha = 0.6; 
                    this.ctx.rotate(Math.PI); // Les pattes en l'air !
                } else if (p.isInvulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
                    this.ctx.globalAlpha = 0.5; // Clignotement de dégât
                }

                if (p.direction === 1 && !p.isClimbing && !p.isDead) { 
                    this.ctx.scale(-1, 1);
                }

                this.ctx.drawImage(skin, -ow / 2, -oh / 2, ow, oh);
                this.ctx.restore(); 

                // Couleur du texte au-dessus de la tête
                this.ctx.fillStyle = p.isDead ? "#FF004D" : "white";
                this.ctx.font = "bold 14px Arial";
                this.ctx.textAlign = "center";
                
                let displayName = p.isDead ? `K.O. - ${p.pseudo}` : (p.pseudo || "Rat");
                this.ctx.fillText(displayName, renderX + ow/2, renderY - 10);
            }
        });

        this.vfx.update();
        this.vfx.draw(this.ctx);
    }

    triggerExplosion(x, y, type) { this.vfx.createExplosion(x, y, type); }

    setupTestControls() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'd' || key === 'arrowright') this.socket.emit('playerInput', { action: 'move', vx: 200 }); 
            if (key === 'q' || key === 'a' || key === 'arrowleft') this.socket.emit('playerInput', { action: 'move', vx: -200 }); 
            if (key === 'z' || key === 'w' || key === 'arrowup') this.socket.emit('playerInput', { action: 'move_v', vy: -200 }); 
            if (key === 's' || key === 'arrowdown') this.socket.emit('playerInput', { action: 'move_v', vy: 200 }); 
            if (key === ' ' || key === 'spacebar') this.socket.emit('playerInput', { action: 'jump' });
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (['d', 'q', 'a', 'arrowright', 'arrowleft'].includes(key)) this.socket.emit('playerInput', { action: 'move', vx: 0 }); 
            if (['z', 'w', 's', 'arrowup', 'arrowdown'].includes(key)) this.socket.emit('playerInput', { action: 'move_v', vy: 0 }); 
        });
    }
}