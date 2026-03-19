// renderer.js - Mode Coopératif (Plateformes aérées avec headroom final)
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

        // --- AJOUT LEVIERS ---
        this.imgLeverOff = new Image();
        this.imgLeverOff.src = 'assets/lever_off.jpg'; 
        this.imgLeverOn = new Image();
        this.imgLeverOn.src = 'assets/lever_on.png'; 

        // --- AJOUT PROJECTILES / ITEMS ---
        this.imgTomate = new Image();
        this.imgTomate.src = 'assets/tomate.png'; 
        this.imgKnife = new Image();
        this.imgKnife.src = 'assets/knife.png';
        this.imgCoeur = new Image();
        this.imgCoeur.src = 'assets/coeur.png';

        this.levers = [];
        this.cheeseActive = false;

        this.chefFrame = 0;             
        this.lastChefSwap = Date.now(); 
        
        this.vfx = new VFXManager();

        // ==========================================
        // --- NOUVEAU LEVEL DESIGN : AÉRÉ ET LONG ---
        // ==========================================
        this.platforms = [
            { x: 0,   y: 800, w: this.canvas.width, h: 20, slope: 0 }, 
            { x: 50,  y: 650, w: 300, h: 15, slope: 0 }, 
            { x: 550, y: 650, w: 300, h: 15, slope: 0 }, 
            { x: 200, y: 500, w: 400, h: 15, slope: 0 }, 
            { x: 650, y: 500, w: 250, h: 15, slope: 0 }, 
            { x: 50,  y: 350, w: 250, h: 15, slope: 0 }, 
            { x: 350, y: 350, w: 450, h: 15, slope: 0 }, 
            { x: 150, y: 200, w: 350, h: 15, slope: 0 }, 
            { x: 550, y: 200, w: 300, h: 15, slope: 0 }, 
            { x: 320, y: 150,  w: 400, h: 15, slope: 0 }  
        ];

        this.ladders = [
            { x: 100, topIndex: 1, bottomIndex: 0, w: 30 },
            { x: 710, topIndex: 2, bottomIndex: 0, w: 30 },
            { x: 250, topIndex: 3, bottomIndex: 1, w: 30 },
            { x: 560, topIndex: 3, bottomIndex: 2, w: 30 },
            { x: 740, topIndex: 4, bottomIndex: 2, w: 30 },
            { x: 210, topIndex: 5, bottomIndex: 3, w: 30 },
            { x: 450, topIndex: 6, bottomIndex: 3, w: 30 },
            { x: 680, topIndex: 6, bottomIndex: 4, w: 30 },
            { x: 180, topIndex: 7, bottomIndex: 5, w: 30 },
            { x: 650, topIndex: 8, bottomIndex: 6, w: 30 },
            { x: 350, topIndex: 9, bottomIndex: 7, w: 30 },
            { x: 600, topIndex: 9, bottomIndex: 8, w: 30 }
        ];

        this.brokenLadders = [
            { x: 350, topIndex: 3, bottomIndex: 0, w: 30 }, 
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

    draw(allPlayers = {}, state = { tomatoes: [], knives: [], hearts: [] }) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawLadders();
        this.drawBrokenLadders(); 
        this.drawPlatforms();

        // --- DESSIN DES PROJECTILES (NOUVEAU) ---
        
        // Tomates
        if (state.tomatoes) {
            state.tomatoes.forEach(t => {
                if (this.imgTomate.complete) this.ctx.drawImage(this.imgTomate, t.x, t.y, 25, 25);
            });
        }

        // Couteaux (Missiles)
        if (state.knives) {
            state.knives.forEach(k => {
                if (this.imgKnife.complete) {
                    this.ctx.save();
                    this.ctx.translate(k.x + 10, k.y + 20);
                    this.ctx.rotate(Math.PI); // Pointe vers le bas
                    this.ctx.drawImage(this.imgKnife, -10, -20, 20, 40);
                    this.ctx.restore();
                }
            });
        }

        // Cœurs (Bonus)
        if (state.hearts) {
            state.hearts.forEach(h => {
                if (this.imgCoeur.complete) {
                    const bob = Math.sin(Date.now() / 200) * 5; // Petit effet flottant
                    this.ctx.drawImage(this.imgCoeur, h.x, h.y + bob, 25, 25);
                }
            });
        }

        // --- LE FROMAGE (Objectif) ---
        if (this.imgFromage && this.imgFromage.complete && this.imgFromage.naturalWidth > 0) {
            const fw = 100; 
            const echelleFromage = fw / this.imgFromage.naturalWidth; 
            const fh = this.imgFromage.naturalHeight * echelleFromage;
            const platFromage = this.platforms[9]; 
            const fromX = platFromage.x + 180; 
            const fromY = this.getPlatformY(9, fromX + fw / 2) - fh + 21;
            
            this.ctx.save();
            if (!this.cheeseActive) this.ctx.filter = 'grayscale(100%) opacity(50%)';
            this.ctx.drawImage(this.imgFromage, fromX, fromY, fw, fh);
            this.ctx.restore();
        }

       // --- DESSIN DES LEVIERS ---
        this.levers.forEach(lev => {
            const img = lev.active ? this.imgLeverOn : this.imgLeverOff;
            const lw = 40; const lh = 40; 
            if (img.complete && img.naturalWidth > 0) {
                this.ctx.drawImage(img, lev.x - lw / 2, lev.y - lh, lw, lh);
            } else {
                this.ctx.fillStyle = lev.active ? '#27ae60' : '#c0392b';
                this.ctx.fillRect(lev.x - lw / 2, lev.y - lh, lw, lh);
            }
        });

        // --- LE CHEF ---
        if (Date.now() - this.lastChefSwap > 3000) {
            this.chefFrame = (this.chefFrame + 1) % 3;
            this.lastChefSwap = Date.now();
        }

        const chefImages = [this.imgChef3, this.imgChef2, this.imgChef1];
        const currentChefImg = chefImages[this.chefFrame];

        if (currentChefImg && currentChefImg.complete && currentChefImg.naturalWidth > 0) {
            let echelle = 0.8; let decalagePieds = 4;
            if (this.chefFrame === 1) { echelle = 0.95; decalagePieds = 8; }
            if (this.chefFrame === 2) { echelle = 0.75; decalagePieds = 2; }

            const cw = currentChefImg.naturalWidth * echelle;
            const ch = currentChefImg.naturalHeight * echelle;
            const platSommet = this.platforms[9]; 
            const chefX = platSommet.x + 100; 
            const chefY = this.getPlatformY(9, chefX + cw / 2) - ch + decalagePieds;
            this.ctx.drawImage(currentChefImg, chefX, chefY, cw, ch);
        }

        // --- LES JOUEURS ---
        Object.values(allPlayers).forEach(p => {
            if (!p.color) p.color = 'gray'; 

            if (!allSkinsIdle[p.color]) {
                allSkinsIdle[p.color] = new Image();
                allSkinsIdle[p.color].src = `assets/rat_idle_${p.color}.png`;
                allSkinsRun[p.color] = new Image();
                allSkinsRun[p.color].src = `assets/rat_run_${p.color}.png`;
                allSkinsClimb[p.color] = new Image();
                allSkinsClimb[p.color].src = `assets/rat_echelle_${p.color}.png`; 
            }

            let skin = p.isMoving ? allSkinsRun[p.color] : allSkinsIdle[p.color];
            if (p.isClimbing) skin = allSkinsClimb[p.color];

            if (skin && skin.complete && skin.naturalWidth > 0) {
                const ow = skin.naturalWidth; const oh = skin.naturalHeight;
                let renderX = p.x; let renderY = p.y; 

                if (p.on_ground) {
                    this.platforms.forEach((plat, index) => {
                        const footX = renderX + (ow / 2); 
                        if (footX >= plat.x && footX <= plat.x + plat.w) {
                            const groundY = this.getPlatformY(index, footX);
                            if (Math.abs(p.y - (groundY - oh)) < 15) renderY = groundY - oh; 
                        }
                    });
                }

                this.ctx.save();
                // Effet mort ou invulnérable
                if (p.isDead) { this.ctx.globalAlpha = 0.5; this.ctx.rotate(Math.PI); }
                else if (p.isInvulnerable && Math.floor(Date.now() / 100) % 2 === 0) { this.ctx.globalAlpha = 0.3; }

                if (p.direction === 1 && !p.isClimbing) { 
                    this.ctx.translate(renderX + ow / 2, renderY + oh / 2);
                    this.ctx.scale(-1, 1);
                    this.ctx.drawImage(skin, -ow / 2, -oh / 2, ow, oh);
                } else {
                    this.ctx.drawImage(skin, renderX, renderY, ow, oh);
                }
                this.ctx.restore();

                this.ctx.fillStyle = "white";
                this.ctx.font = "bold 14px Arial";
                this.ctx.textAlign = "center";
                this.ctx.fillText(p.pseudo || "Rat", renderX + ow/2, renderY - 10);
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
            if (key === 'e') this.socket.emit('interact'); 
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (['d', 'q', 'a', 'arrowright', 'arrowleft'].includes(key)) this.socket.emit('playerInput', { action: 'move', vx: 0 }); 
            if (['z', 'w', 's', 'arrowup', 'arrowdown'].includes(key)) this.socket.emit('playerInput', { action: 'move_v', vy: 0 }); 
        });
    }
}