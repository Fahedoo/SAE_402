import { initPhysics } from './wasm.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Source unique de vérité pour les plateformes:
// même tableau pour la physique ET le rendu.
const platforms = [
    { x: 100, y: 420, w: 200, h: 15 },
    { x: 400, y: 300, w: 250, h: 15 },
    { x: 0, y: 580, w: 800, h: 20 }, // sol
];

async function main() {
    const world = await initPhysics(980.0, 580.0);

    // Injection des plateformes dans le moteur physique
    for (const p of platforms) {
        world.add_platform(p.x, p.y, p.w, p.h);
    }

    // Ajouter un joueur
    const p0 = world.add_player(200, 100, 24, 32);

    // Inputs basiques pour tester
    const keys = {};
    window.addEventListener('keydown', (e) => { keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // Game loop
    const FIXED_DT = 1 / 60;
    let lastTime = performance.now();
    let accumulator = 0;

    function loop(now) {
        const frameDt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        accumulator += frameDt;

        // Lire les inputs
        let vx = 0;
        if (keys['ArrowLeft']) vx = -200;
        if (keys['ArrowRight']) vx = 200;
        world.set_player_vx(p0, vx);
        if (keys['ArrowUp']) world.player_jump(p0, 450);

        // Physique en fixed timestep
        while (accumulator >= FIXED_DT) {
            world.step(FIXED_DT);
            accumulator -= FIXED_DT;
        }

        // Rendu
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Dessiner les plateformes depuis la même source unique
        for (const p of platforms) {
            ctx.fillStyle = p.y >= 580 ? '#555' : '#8B4513';
            ctx.fillRect(p.x, p.y, p.w, p.h);
        }

        // Dessiner le joueur
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(world.get_player_x(p0), world.get_player_y(p0), 24, 32);

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}

main();