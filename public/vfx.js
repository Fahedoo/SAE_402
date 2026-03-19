class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;

        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 3; // Vitesse un poil plus douce

        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        this.radius = Math.random() * 3 + 2;
        this.life = 1.0;

        // --- RÉGLAGE DURÉE ---
        // Avant c'était 0.08, on passe à 0.03 pour que ça reste 
        // environ 1/2 seconde à l'écran (assez pour être vu)
        this.decay = Math.random() * 0.03 + 0.02;

        // On réduit la friction (0.95 au lieu de 0.85) 
        // pour que l'explosion s'étende un peu plus
        this.friction = 0.85;
    }

    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx;
        this.y += this.vy;

        this.life -= this.decay;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;

        // Dessin "Pixel Perfect"
        ctx.fillRect(
            Math.round(this.x),
            Math.round(this.y),
            this.radius,
            this.radius
        );

        ctx.restore();
    }
}

export class VFXManager {
    constructor() {
        this.particles = [];
    }

    createExplosion(x, y, type) {
        let color = "#ff4757"; // Tomate
        let count = 14; // Un peu plus de particules pour bien marquer le coup

        if (type === 'couteau') color = "#f1f2f6"; // Étincelle
        if (type === 'rouleau') color = "#e67e22"; // Bois

        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    update() {
        this.particles = this.particles.filter(p => p.life > 0);
        this.particles.forEach(p => p.update());
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }
}