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
        
        // --- SYSTÈME DE PARTICULES (Explosions) ---
        this.vfx = new VFXManager();

        // --- ÉTAT DU JOUEUR ---
        this.player = {
            x: 100,
            y: 400, // Ajusté pour être plus bas sur l'écran
            isMoving: false,
            direction: -1 
        };

        this.setupTestControls();
    }

    // Fonction pour déclencher une explosion (sera appelée lors des collisions)
    triggerExplosion(x, y, type) {
        this.vfx.createExplosion(x, y, type);
    }

    draw() {
        // 1. Nettoyage
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Mise à jour des particules
        this.vfx.update();

        // 3. Logique de mouvement (Test)
        if (this.player.isMoving) {
            this.player.x += 5 * this.player.direction;
        }

        // 4. DESSIN DU RAT
        const currentImg = this.player.isMoving ? this.imgRun : this.imgIdle;
        if (currentImg.complete) {
            const w = currentImg.naturalWidth;
            const h = currentImg.naturalHeight;

            this.ctx.save();
            // Symétrie si on va à droite
            if (this.player.direction === 1) {
                this.ctx.translate(this.player.x + w / 2, 0);
                this.ctx.scale(-1, 1);
                this.ctx.translate(-(this.player.x + w / 2), 0);
            }
            this.ctx.drawImage(currentImg, this.player.x, this.player.y, w, h);
            this.ctx.restore();
        }

        // 5. DESSIN DES EXPLOSIONS (toujours par-dessus le rat)
        this.vfx.draw(this.ctx);
    }

    setupTestControls() {
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        
        // Déplacement du rat
        if (key === 'd' || e.key === 'ArrowRight') {
            this.player.isMoving = true;
            this.player.direction = 1;
        } else if (key === 'q' || key === 'a' || e.key === 'ArrowLeft') {
            this.player.isMoving = true;
            this.player.direction = -1;
        }

        // --- TOUCHES DE TEST POUR LES EXPLOSIONS ---
        // T = Tomate (Rouge)
        if (key === 't') {
            console.log("Test Impact: Tomate");
            this.triggerExplosion(this.player.x + 40, this.player.y + 40, 'tomate');
        }
        // C = Couteau (Gris/Métal)
        if (key === 'c') {
            console.log("Test Impact: Couteau");
            this.triggerExplosion(this.player.x + 40, this.player.y + 40, 'couteau');
        }
        // R = Rouleau (Orange/Bois)
        if (key === 'r') {
            console.log("Test Impact: Rouleau");
            this.triggerExplosion(this.player.x + 40, this.player.y + 40, 'rouleau');
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (['d', 'q', 'a', 'arrowright', 'arrowleft'].includes(key)) {
            this.player.isMoving = false;
        }
    });
}
}