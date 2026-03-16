import init, { World } from './pkg/physics.js';

let world = null;

export async function initPhysics(gravity = 980.0, floorY = 580.0) {
    await init();                          // charge le .wasm en mémoire
    world = new World(gravity, floorY);    // crée le monde physique
    return world;
}

export function getWorld() {
    return world;
}