// renderer.js - Module de rendu complet (Membre C)

export class GameRenderer {
    constructor(canvas, color = 'gray') { // 'gray' par défaut si pas de couleur
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        
        // Empêche le flou pour le Pixel Art
        this.ctx.imageSmoothingEnabled = false;

        // --- CHARGEMENT DYNAMIQUE DES IMAGES ---
        this.imgIdle = new Image();
        this.imgIdle.src = `assets/rat_idle_${color}.png`; 
        
        this.imgRun = new Image();
        this.imgRun.src = `assets/rat_run_${color}.png`; 
        
        // --- ÉTAT DU JOUEUR ---
        this.player = {
            x: 100,
            y: 200,
            isMoving: false,
            direction: -1 // -1 car tes images regardent à GAUCHE par défaut
        };

        this.setupTestControls();
    }

    draw() {
        // 1. On nettoie le canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. On choisit l'image (course ou repos)
        const currentImg = this.player.isMoving ? this.imgRun : this.imgIdle;

        // 3. On attend que l'image soit chargée avant de dessiner
        if (!currentImg.complete) return;

        const w = currentImg.naturalWidth;
        const h = currentImg.naturalHeight;

        // 4. Mise à jour de la position pour le test
        if (this.player.isMoving) {
            this.player.x += 4 * this.player.direction;
        }

        this.ctx.save();

        // 5. SYMÉTRIE : Si direction = 1 (Droite), on retourne l'image
        if (this.player.direction === 1) {
            this.ctx.translate(this.player.x + w / 2, 0);
            this.ctx.scale(-1, 1);
            this.ctx.translate(-(this.player.x + w / 2), 0);
        }

        // 6. DESSIN FINAL
        this.ctx.drawImage(currentImg, this.player.x, this.player.y, w, h);

        this.ctx.restore();
    }

    // Système de test pour bouger le rat
    setupTestControls() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'd' || e.key === 'ArrowRight') {
                this.player.isMoving = true;
                this.player.direction = 1; // Droite (Active la symétrie)
            } else if (key === 'q' || key === 'a' || e.key === 'ArrowLeft') {
                this.player.isMoving = true;
                this.player.direction = -1; // Gauche (Image normale)
            }
        });

        window.addEventListener('keyup', () => {
            this.player.isMoving = false;
        });
    }
}