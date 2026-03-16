// renderer.js - Contrôle total sur chaque plateforme
import { VFXManager } from './vfx.js';

export class GameRenderer {
    constructor(canvas, color = 'gray') {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        this.imgIdle = new Image();
        this.imgIdle.src = `assets/rat_idle_${color}.png`; 
        this.imgRun = new Image();
        this.imgRun.src = `assets/rat_run_${color}.png`; 
        
        this.vfx = new VFXManager();

        // --- CONFIGURATION SUR MESURE ---
        const marginTop = 120;
        const marginBottom = 60;
        const availableHeight = this.canvas.height - marginTop - marginBottom;
        const stepY = availableHeight / 4; // 4 espaces pour 5 plateformes
        const slope = 35;

        // ICI TU CHOISIS TOUT : x (début), w (largeur), y (hauteur)
        // Dans ton constructor, remplace la partie platforms par ça :

this.platforms = [
    // 1. PLATEFORME DU BAS (i=0)
    { 
        x: 0,                   // Départ à gauche
        y: 540,                 // Hauteur précise (ex: 50px du bas si canvas=600)
        w: this.canvas.width,   // Largeur totale
        h: 18, 
        slope: -40              // Inclinaison vers le haut à droite
    },

    // 2. ÉTAGE 2
    { 
        x: 50,                  // Petit retrait à gauche
        y: 420,                 // Ecart de 120px avec celle du bas
        w: this.canvas.width - 50, // Elle s'arrête au bord droit
        h: 18, 
        slope: 40               // Inclinaison inverse
    },

    // 3. ÉTAGE 3
    { 
        x: 0, 
        y: 300,                 // Ecart de 120px
        w: this.canvas.width - 50, // Elle s'arrête avant le bord droit
        h: 18, 
        slope: -40 
    },

    // 4. ÉTAGE 4 (Plus courte par exemple)
    { 
        x: 100, 
        y: 180, 
        w: 400,                 // Taille fixe personnalisée
        h: 18, 
        slope: 20               // Moins inclinée que les autres
    },

    // 5. LE SOMMET (Tout en haut)
    { 
        x: 200, 
        y: 80,                  // 80px du plafond
        w: 200,                 // Toute petite plateforme
        h: 18, 
        slope: 0                // Parfaitement plate
    }
];

        this.player = {
            x: 100,
            y: this.platforms[0].y - 64, 
            isMoving: false,
            direction: -1 
        };

        this.setupTestControls();
    }

    // ... (Le reste des fonctions drawPlatforms et draw reste le même)
    drawPlatforms() {
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
            grad.addColorStop(0, '#d1d8e0'); 
            grad.addColorStop(1, '#778ca3');
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.lineTo(x2, y2 + plat.h);
            this.ctx.lineTo(x1, y1 + plat.h);
            this.ctx.fill();

            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            this.ctx.lineWidth = 1;
            for (let i = 0; i <= plat.w; i += 25) {
                const ratio = i / plat.w;
                const currY = y1 + (plat.slope * ratio);
                this.ctx.beginPath();
                this.ctx.moveTo(x1 + i, currY);
                this.ctx.lineTo(x1 + i, currY + plat.h);
                this.ctx.stroke();
            }

            this.ctx.strokeStyle = '#4b6584';
            this.ctx.stroke();
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawPlatforms();

        const ratW = this.imgIdle.naturalWidth || 64;
        const ratH = this.imgIdle.naturalHeight || 64;

        if (this.player.isMoving) {
            let nextX = this.player.x + (5 * this.player.direction);
            if (nextX < 0) nextX = 0;
            if (nextX > this.canvas.width - ratW) nextX = this.canvas.width - ratW;
            this.player.x = nextX;
        }

        this.platforms.forEach(plat => {
            const footX = this.player.x + (ratW / 2);
            if (footX >= plat.x && footX <= plat.x + plat.w) {
                const ratio = (footX - plat.x) / plat.w;
                const groundY = plat.y + (plat.slope * ratio);
                if (Math.abs(this.player.y - (groundY - ratH)) < 55) {
                    this.player.y = groundY - ratH;
                }
            }
        });

        const currentImg = this.player.isMoving ? this.imgRun : this.imgIdle;
        if (currentImg.complete) {
            this.ctx.save();
            if (this.player.direction === 1) {
                this.ctx.translate(this.player.x + ratW / 2, this.player.y + ratH / 2);
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(currentImg, -ratW / 2, -ratH / 2, ratW, ratH);
            } else {
                this.ctx.drawImage(currentImg, this.player.x, this.player.y, ratW, ratH);
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