// renderer.js - Taille originale et symétrie corrigée

export class GameRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        this.imgIdle = new Image();
        this.imgIdle.src = 'assets/rat_idle.png'; 
        
        this.imgRun = new Image();
        this.imgRun.src = 'assets/rat_run.png'; 
        
        this.player = {
            x: 300,
            y: 200,
            isMoving: false,
            direction: -1 
        };

        this.setupTestControls();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const currentImg = this.player.isMoving ? this.imgRun : this.imgIdle;

        // On vérifie que l'image est bien chargée
        if (!currentImg.complete) return;

        // --- ON RÉCUPÈRE LA TAILLE ORIGINALE ICI ---
        const w = currentImg.naturalWidth;
        const h = currentImg.naturalHeight;

        if (this.player.isMoving) {
            this.player.x += 4 * this.player.direction;
        }

        this.ctx.save();

        // Symétrie : On tourne autour du centre du rat selon sa taille réelle
        if (this.player.direction === 1) {
            this.ctx.translate(this.player.x + w / 2, 0);
            this.ctx.scale(-1, 1);
            this.ctx.translate(-(this.player.x + w / 2), 0);
        }

        // --- DESSIN AVEC TAILLE RÉELLE (w, h) ---
        this.ctx.drawImage(
            currentImg,
            this.player.x, 
            this.player.y,
            w, // Largeur d'origine
            h  // Hauteur d'origine
        );

        this.ctx.restore();
    }

    setupTestControls() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'd' || e.key === 'ArrowRight') {
                this.player.isMoving = true;
                this.player.direction = 1;
            } else if (key === 'q' || key === 'a' || e.key === 'ArrowLeft') {
                this.player.isMoving = true;
                this.player.direction = -1;
            }
        });

        window.addEventListener('keyup', () => {
            this.player.isMoving = false;
        });
    }
}