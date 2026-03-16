// renderer.js - Contrôle total par plateforme (Souris taille réelle)
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

        // --- TES RÉGLAGES INDIVIDUELS ICI ---
        // x: position gauche | y: hauteur | w: largeur | slope: inclinaison
        this.platforms = [
            { x: 42,   y: 800, w: this.canvas.width-81, h: 18, slope: -50 }, // Bas
            { x: 42,   y: 620, w: this.canvas.width-254, h: 18, slope: 45  }, // Étage 2
            { x: 109,   y: 520, w: this.canvas.width-149, h: 18, slope: -50 }, // Étage 3
            { x: 42,   y: 350, w: this.canvas.width-145, h: 18, slope: 50  }, // Étage 4
            { x: 42,   y: 270, w: this.canvas.width-83, h: 18, slope: -65  }, // Étage 5
            { x: 63, y: 105,  w: this.canvas.width - 228, h: 18, slope: 30 } // Sommet (ex: plus court et plat)
        ];

        this.player = {
    x: 100,
    // On la place sur la plateforme 0 (celle du bas)
    // On utilise 800 (ton y du bas) + une petite marge pour l'adhérence
    y: 800 - 64, 
    isMoving: false,
    direction: -1 
};

        this.setupTestControls();
    }

    drawPlatforms() {
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

            // Bordure
            this.ctx.strokeStyle = '#4b6584';
            this.ctx.stroke();
        });
    }

    draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawPlatforms();

    // ON FIXE LA TAILLE (Si naturalWidth est à 0, on met 64 par défaut)
    const currentImg = this.player.isMoving ? this.imgRun : this.imgIdle;
    const w = currentImg.naturalWidth || 64; 
    const h = currentImg.naturalHeight || 64;

    if (this.player.isMoving) {
        let nextX = this.player.x + (5 * this.player.direction);
        if (nextX < 0) nextX = 0;
        if (nextX > this.canvas.width - w) nextX = this.canvas.width - w;
        this.player.x = nextX;
    }

    // --- ADHÉRENCE ---
    let onAnyPlatform = false;
    this.platforms.forEach(plat => {
        const footX = this.player.x + (w / 2);
        if (footX >= plat.x && footX <= plat.x + plat.w) {
            const ratio = (footX - plat.x) / plat.w;
            const groundY = plat.y + (plat.slope * ratio);
            
            // On vérifie si on est assez proche pour "coller"
            if (Math.abs(this.player.y - (groundY - h)) < 50) {
                this.player.y = groundY - h;
                onAnyPlatform = true;
            }
        }
    });

    // --- DESSIN DU RAT ---
    if (currentImg.complete && w > 0) {
        this.ctx.save();
        if (this.player.direction === 1) {
            // On translate au centre du rat pour le retourner sans le ratatiner
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