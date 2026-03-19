import { VFXManager } from './vfx.js';

const allSkinsIdle = {};
const allSkinsRun = {};
const allSkinsClimb = {};

// On crée une fonction qui génère les données selon la taille du canvas
const GET_LEVEL_CONFIGS = (canvasWidth) => ({
    coop: {
        platforms: [
            { x: 0,   y: 800, w: canvasWidth, h: 20, slope: 0 }, 
            { x: 50,  y: 650, w: 300, h: 15, slope: 0 }, 
            { x: 550, y: 650, w: 300, h: 15, slope: 0 }, 
            { x: 200, y: 500, w: 400, h: 15, slope: 0 }, 
            { x: 650, y: 500, w: 250, h: 15, slope: 0 }, 
            { x: 50,  y: 350, w: 250, h: 15, slope: 0 }, 
            { x: 350, y: 350, w: 450, h: 15, slope: 0 }, 
            { x: 150, y: 200, w: 350, h: 15, slope: 0 }, 
            { x: 550, y: 200, w: 300, h: 15, slope: 0 }, 
            { x: 320, y: 150, w: 400, h: 15, slope: 0 }  
        ],
        ladders: [
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
        ],
        brokenLadders: [
            { x: 350, topIndex: 3, bottomIndex: 0, w: 30 }
        ],
        chefPlatIndex: 9,
        fromagePlatIndex: 9
    },
    ennemi: {
        platforms: [
            { x: 42,  y: 800, w: canvasWidth - 81, h: 18, slope: -50 }, 
            { x: 42,  y: 620, w: canvasWidth - 254, h: 18, slope: 45  }, 
            { x: 109, y: 520, w: canvasWidth - 149, h: 18, slope: -50 }, 
            { x: 42,  y: 353, w: canvasWidth - 145, h: 18, slope: 50  }, 
            { x: 42,  y: 275, w: canvasWidth - 83, h: 18, slope: -65  }, 
            { x: 63,  y: 125, w: canvasWidth - 228, h: 18, slope: 30 }, 
            { x: 300, y: 70,  w: 170, h: 18, slope: 0 } 
        ],
        ladders: [
            { x: 600, topIndex: 1, bottomIndex: 0, w: 30 }, 
            { x: 150, topIndex: 2, bottomIndex: 1, w: 30 }, 
            { x: 650, topIndex: 3, bottomIndex: 2, w: 30 }, 
            { x: 100, topIndex: 4, bottomIndex: 3, w: 30 }, 
            { x: 600, topIndex: 5, bottomIndex: 4, w: 30 }, 
            { x: 420, topIndex: 6, bottomIndex: 5, w: 30 }  
        ],
        brokenLadders: [
            { x: 350, topIndex: 2, bottomIndex: 1, w: 30 }, 
            { x: 450, topIndex: 4, bottomIndex: 3, w: 30 }  
        ],
        chefPlatIndex: 5,
        fromagePlatIndex: 6
    }
});

export class GameRenderer {
    constructor(canvas, color = 'gray', socket, mode = 'coop') { 
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.socket = socket; 
        this.mode = mode;

        // --- LA CORRECTION EST ICI ---
        // On génère les coordonnées en fonction de la largeur réelle du canvas
        const configs = GET_LEVEL_CONFIGS(this.canvas.width);
        const config = configs[mode] || configs.coop;
        
        this.platforms = config.platforms;
        this.ladders = config.ladders;
        this.brokenLadders = config.brokenLadders;
        this.chefPlatIndex = config.chefPlatIndex;
        this.fromagePlatIndex = config.fromagePlatIndex;
        // ------------------------------

        // Assets
        this.initImages(color);

        // État de rendu
        this.lerpState = {};
        this.chefFrame = 0;
        this.lastChefSwap = Date.now();
        this.vfx = new VFXManager();
        
        // Petite correction sur le nom du mode pour correspondre à ton main.js
        this.cheeseActive = (mode === 'ennemi'); 
        this.levers = [];

        this.setupControls();
    }

    initImages(color) {
        this.images = {};
        const toLoad = {
            idle: `assets/rat_idle_${color}.png`,
            run: `assets/rat_run_${color}.png`,
            chef1: 'assets/chef_1.png',
            chef2: 'assets/chef_2.png',
            chef3: 'assets/chef_3.png',
            fromage: 'assets/fromage.png',
            leverOff: 'assets/levier_off.png',
            leverOn: 'assets/levier_on.png',
            tomate: 'assets/tomate.png',
            knife: 'assets/knife.png',
            coeur: 'assets/coeur.png'
        };
        for (const [key, src] of Object.entries(toLoad)) {
            this.images[key] = new Image();
            this.images[key].src = src;
        }
    }

    getPlatformY(index, targetX) {
        const plat = this.platforms[index];
        if (!plat) return 0;
        const ratio = (targetX - plat.x) / plat.w;
        return plat.y + (plat.slope * ratio);
    }

    draw(state = { players: {}, tomatoes: [], knives: [], hearts: [] }) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawLadders(this.ladders, false);
        this.drawLadders(this.brokenLadders, true);
        this.drawPlatforms();
        this.drawItems(state);
        this.drawChef();
        if (this.mode === 'coop') this.drawLevers();
        this.drawPlayers(state.players || {});

        this.vfx.update();
        this.vfx.draw(this.ctx);
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

    draw(state = { players: {}, tomatoes: [], hearts: [], knives: [], levers: [] }) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 1. DÉCORS DE BASE
    this.drawLadders(this.ladders, false);
    this.drawLadders(this.brokenLadders, true);
    this.drawPlatforms();

    // 2. LE FROMAGE (OBJECTIF)
    // On utilise this.fromagePlatIndex qui est défini dans le constructor (6 ou 9)
    if (this.images.fromage && this.images.fromage.complete && this.images.fromage.naturalWidth > 0) {
        const fw = 100; 
        const echelleFromage = fw / this.images.fromage.naturalWidth; 
        const fh = this.images.fromage.naturalHeight * echelleFromage;
        
        const platFromage = this.platforms[this.fromagePlatIndex];
        // En mode ennemi : à gauche (10px). En mode coop : à droite (180px).
        const decalageX = (this.mode === 'ennemi') ? 10 : 180;
        const fromX = platFromage.x + decalageX; 
        const decalageY = 21; 
        const fromY = this.getPlatformY(this.fromagePlatIndex, fromX + fw / 2) - fh + decalageY;
        
        this.ctx.save();
        // Gris si pas actif (Coop)
        if (!this.cheeseActive) this.ctx.filter = 'grayscale(100%) opacity(50%)';
        this.ctx.drawImage(this.images.fromage, fromX, fromY, fw, fh);
        this.ctx.restore();
    }

    // 3. LE CHEF (ANIMATION ET POSITION)
    if (Date.now() - this.lastChefSwap > 3000) {
        this.chefFrame = (this.chefFrame + 1) % 3;
        this.lastChefSwap = Date.now();
    }

    const chefImages = [this.images.chef3, this.images.chef2, this.images.chef1];
    const currentChefImg = chefImages[this.chefFrame];

    if (currentChefImg && currentChefImg.complete && currentChefImg.naturalWidth > 0) {
        let echelle = 0.8; 
        let decalagePieds = 4;
        if (this.chefFrame === 1) { echelle = 0.95; decalagePieds = 8; }
        if (this.chefFrame === 2) { echelle = 0.75; decalagePieds = 2; }

        const cw = currentChefImg.naturalWidth * echelle;
        const ch = currentChefImg.naturalHeight * echelle;
        
        const platChef = this.platforms[this.chefPlatIndex];
        // En mode ennemi : décalé de 120px. En mode coop : 100px.
        const decalageXChef = (this.mode === 'ennemi') ? 120 : 100;
        const chefX = platChef.x + decalageXChef; 
        const chefY = this.getPlatformY(this.chefPlatIndex, chefX + cw / 2) - ch + decalagePieds;

        this.ctx.drawImage(currentChefImg, chefX, chefY, cw, ch);
    }

    // 4. PROJECTILES ET BONUS
    if (state.tomatoes) state.tomatoes.forEach(t => {
        if (this.images.tomate.complete) this.ctx.drawImage(this.images.tomate, t.x, t.y, 30, 30);
    });
    
    if (state.knives) state.knives.forEach(k => {
        if (this.images.knife.complete) {
            this.ctx.save();
            this.ctx.translate(k.x + 15/2, k.y + 40/2);
            this.ctx.rotate(Math.PI);
            this.ctx.drawImage(this.images.knife, -7.5, -20, 15, 40);
            this.ctx.restore();
        }
    });

    if (state.hearts) state.hearts.forEach(h => {
        if (this.images.coeur.complete) {
            const floatY = Math.sin(Date.now() / 200) * 5; 
            this.ctx.drawImage(this.images.coeur, h.x, h.y + floatY, 30, 30);
        }
    });

    // 5. LES LEVIERS (UNIQUEMENT EN COOP)
    if (this.mode === 'coop' && state.levers) {
        state.levers.forEach(lev => {
            const img = lev.active ? this.images.leverOn : this.images.leverOff;
            if (img.complete) this.ctx.drawImage(img, lev.x - 20, lev.y - 40, 40, 40);
        });
    }

// 6. LES JOUEURS (AVEC LERP / LISSAGE ET ANIMATION)
    Object.values(state.players || {}).forEach(p => {
        const color = p.color || 'gray';
        
        // 1. Chargement dynamique des skins (si pas déjà en mémoire)
        if (!allSkinsIdle[color]) {
            allSkinsIdle[color] = new Image(); allSkinsIdle[color].src = `assets/rat_idle_${color}.png`;
            allSkinsRun[color] = new Image(); allSkinsRun[color].src = `assets/rat_run_${color}.png`;
            allSkinsClimb[color] = new Image(); allSkinsClimb[color].src = `assets/rat_echelle_${color}.png`;
        }

        // 2. Lissage de la position (Lerp) pour éviter les saccades
        if (!this.lerpState[p.id]) this.lerpState[p.id] = { x: p.x, y: p.y };
        let lerp = this.lerpState[p.id];
        lerp.x += (p.x - lerp.x) * 0.4;
        lerp.y += (p.y - lerp.y) * 0.4;
        
        // Anti-lag : téléportation si l'écart est trop grand (> 100px)
        if (Math.abs(p.x - lerp.x) > 100) lerp.x = p.x;
        if (Math.abs(p.y - lerp.y) > 100) lerp.y = p.y;

        // 3. Sélection du skin et calcul des frames
        let skin = allSkinsIdle[color];
        let frameCount = 1; 

        if (p.isClimbing) {
            skin = allSkinsClimb[color];
            frameCount = 4; 
        } else if (p.isMoving) {
            skin = allSkinsRun[color];
            frameCount = 4; 
        }

        if (skin && skin.complete) {
            // Calcul de la frame actuelle (boucle de 100ms par image)
            const currentFrame = Math.floor(Date.now() / 100) % frameCount;
            const frameW = skin.naturalWidth / frameCount;
            const frameH = skin.naturalHeight;

            this.ctx.save();
            // On se centre sur la hitbox du joueur (15, 15 étant le centre relatif)
            this.ctx.translate(lerp.x + 15, lerp.y + 15);

            // Gestion de l'état (Mort ou Invulnérable)
            if (p.isDead) {
                this.ctx.globalAlpha = 0.6;
                this.ctx.rotate(Math.PI); // Le rat mort est à l'envers
            } else if (p.isInvulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
                this.ctx.globalAlpha = 0.5; // Clignotement si invulnérable
            }

            // Direction du regard (Scale négatif pour simuler un Flip horizontal)
            if (p.direction === 1 && !p.isClimbing && !p.isDead) {
                this.ctx.scale(-1, 1);
            }

            // Dessin avec découpage de la spritesheet
            this.ctx.drawImage(
                skin, 
                currentFrame * frameW, 0, frameW, frameH, // Source
                -frameW / 2, 15 - frameH, frameW, frameH  // Destination
            );
            
            this.ctx.restore();

            // Pseudo au-dessus du rat
            this.ctx.fillStyle = p.isDead ? "#FF004D" : "white";
            this.ctx.font = "bold 14px Arial";
            this.ctx.textAlign = "center";
            this.ctx.fillText(p.pseudo || "Rat", lerp.x + 15, lerp.y - 10);
        }
    });

    // 7. SYSTÈME DE PARTICULES (VFX)
    this.vfx.update();
    this.vfx.draw(this.ctx);
}

    setupControls() {
        const send = (action, params = {}) => this.socket.emit('playerInput', { action, ...params });
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'd' || k === 'arrowright') send('move', { vx: 200 });
            if (k === 'q' || k === 'a' || k === 'arrowleft') send('move', { vx: -200 });
            if (k === 'z' || k === 'w' || k === 'arrowup') send('move_v', { vy: -200 });
            if (k === 's' || k === 'arrowdown') send('move_v', { vy: 200 });
            if (k === ' ') send('jump');
            if (k === 'e') this.socket.emit('interact');
        });
        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (['d', 'q', 'a', 'arrowright', 'arrowleft'].includes(k)) send('move', { vx: 0 });
            if (['z', 'w', 's', 'arrowup', 'arrowdown'].includes(k)) send('move_v', { vy: 0 });
        });
    }
}