// renderer.js - Module de rendu complet avec VFX
import { VFXManager } from './vfx.js';

export class GameRenderer {
    constructor(canvas, color = 'gray') {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        // --- GESTION DES IMAGES ---
        this.imgIdle = new Image();
        this.imgIdle.src = `assets/rat_idle_${color}.png`; 
        this.imgRun = new Image();
        this.imgRun.src = `assets/rat_run_${color}.png`; 
        
        this.vfx = new VFXManager();

        // --- ÉTAT DU JOUEUR ---
        this.player = {
            x: 100,
            y: 500, // Ajusté pour être sur le plan de travail du bas
            isMoving: false,
            direction: -1 
        };

        // --- TES 6 PLATEFORMES ---
        this.platforms = [
            { x: 0,   y: 520, w: 300, h: 15 }, // Planche gauche
            { x: 600, y: 520, w: 300, h: 15 }, // Plan travail droite
            { x: 350, y: 400, w: 200, h: 15 }, // Centre
            { x: 0,   y: 300, w: 250, h: 15 }, // Haute gauche
            { x: 650, y: 300, w: 250, h: 15 }, // Haute droite
            { x: 300, y: 150, w: 300, h: 20 }  // Sommet
        ];

        this.setupTestControls();
    }

    triggerExplosion(x, y, type) {
        this.vfx.createExplosion(x, y, type);
    }

    // UNIQUE FONCTION POUR DESSINER LES PLATEFORMES
    drawPlatforms() {
        this.platforms.forEach(plat => {
            // 1. L'ombre portée
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.fillRect(plat.x + 4, plat.y + 4, plat.w, plat.h);

            // 2. Le corps Inox (Dégradé)
            let grad = this.ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
            grad.addColorStop(0, '#d1d8e0'); 
            grad.addColorStop(1, '#778ca3');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

            // 3. Texture de grille (DA Retro)
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.lineWidth = 1;
            for (let i = 10; i < plat.w; i += 15) {
                this.ctx.beginPath();
                this.ctx.moveTo(plat.x + i, plat.y);
                this.ctx.lineTo(plat.x + i, plat.y + plat.h);
                this.ctx.stroke();
            }

            // 4. Bordure Pixel Art
            this.ctx.strokeStyle = '#4b6584';
            this.ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 1. Plateformes
        this.drawPlatforms();

        // 2. Mouvement du rat (avec blocage)
        if (this.player.isMoving) {
            const w = this.imgIdle.naturalWidth || 64; 
            let nextX = this.player.x + (5 * this.player.direction);
            if (nextX < 0) nextX = 0;
            if (nextX > this.canvas.width - w) nextX = this.canvas.width - w;
            this.player.x = nextX;
        }

        // 3. Dessin du Rat
        const currentImg = this.player.isMoving ? this.imgRun : this.imgIdle;
        if (currentImg.complete) {
            const w = currentImg.naturalWidth;
            const h = currentImg.naturalHeight;
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

        // 4. VFX
        this.vfx.update();
        this.vfx.draw(this.ctx);
    }

    setupTestControls() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'd' || key === 'arrowright') {
                this.player.isMoving = true;
                this.player.direction = 1;
            } else if (key === 'q' || key === 'a' || key === 'arrowleft') {
                this.player.isMoving = true;
                this.player.direction = -1;
            }
            // Tests Explosions
            if (key === 't') this.triggerExplosion(this.player.x + 20, this.player.y + 20, 'tomate');
            if (key === 'c') this.triggerExplosion(this.player.x + 20, this.player.y + 20, 'couteau');
            if (key === 'r') this.triggerExplosion(this.player.x + 20, this.player.y + 20, 'rouleau');
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (['d', 'q', 'a', 'arrowright', 'arrowleft'].includes(key)) {
                this.player.isMoving = false;
            }
        });
    }
}