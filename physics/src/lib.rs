use wasm_bindgen::prelude::*;

// ─── Plateforme (rectangle) ───────────────────────────────
#[wasm_bindgen]
#[derive(Clone)]
pub struct Platform {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[wasm_bindgen]
impl Platform {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Platform {
        Platform { x, y, width, height }
    }
}

// ─── Joueur ────────────────────────────────────────────────
#[wasm_bindgen]
#[derive(Clone)]
pub struct Player {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub vx: f32,
    pub vy: f32,
    pub on_ground: bool,
}

#[wasm_bindgen]
impl Player {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Player {
        Player {
            x, y, width, height,
            vx: 0.0, vy: 0.0,
            on_ground: false,
        }
    }
}

// ─── Monde physique ────────────────────────────────────────
#[wasm_bindgen]
pub struct World {
    gravity: f32,
    floor_y: f32,
    players: Vec<Player>,
    platforms: Vec<Platform>,
}

#[wasm_bindgen]
impl World {
    #[wasm_bindgen(constructor)]
    pub fn new(gravity: f32, floor_y: f32) -> World {
        World {
            gravity,
            floor_y,
            players: Vec::new(),
            platforms: Vec::new(),
        }
    }

    // ── Ajouter des entités ──

    pub fn add_player(&mut self, x: f32, y: f32, w: f32, h: f32) -> usize {
        let id = self.players.len();
        self.players.push(Player::new(x, y, w, h));
        id
    }

    pub fn add_platform(&mut self, x: f32, y: f32, w: f32, h: f32) -> usize {
        let id = self.platforms.len();
        self.platforms.push(Platform::new(x, y, w, h));
        id
    }

    // ── Inputs (appelés par ton camarade) ──

    pub fn set_player_vx(&mut self, id: usize, vx: f32) {
        if let Some(p) = self.players.get_mut(id) {
            p.vx = vx;
        }
    }

    pub fn player_jump(&mut self, id: usize, jump_speed: f32) {
        if let Some(p) = self.players.get_mut(id) {
            if p.on_ground {
                p.vy = -jump_speed;
                p.on_ground = false;
            }
        }
    }

    // ── Lire l'état (pour le rendu Canvas) ──

    pub fn get_player_x(&self, id: usize) -> f32 { self.players[id].x }
    pub fn get_player_y(&self, id: usize) -> f32 { self.players[id].y }
    pub fn get_player_on_ground(&self, id: usize) -> bool { self.players[id].on_ground }
    pub fn player_count(&self) -> usize { self.players.len() }

    // ── Simulation : 1 tick de physique ──

    pub fn step(&mut self, dt: f32) {
        let n = self.players.len();

        // 1) Gravité + déplacement
        for p in self.players.iter_mut() {
            p.vy += self.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.on_ground = false;
        }

        // 2) Collision avec le sol
        for p in self.players.iter_mut() {
            if p.y + p.height > self.floor_y {
                p.y = self.floor_y - p.height;
                p.vy = 0.0;
                p.on_ground = true;
            }
        }

        // 3) Collision avec les plateformes (one-way : par le dessus uniquement)
        for p in self.players.iter_mut() {
            for plat in &self.platforms {
                let player_bottom = p.y + p.height;
                let player_right = p.x + p.width;
                let plat_right = plat.x + plat.width;

                let lands = p.vy >= 0.0
                    && player_bottom >= plat.y
                    && player_bottom <= plat.y + plat.height + 2.0
                    && player_right > plat.x
                    && p.x < plat_right;

                if lands {
                    p.y = plat.y - p.height;
                    p.vy = 0.0;
                    p.on_ground = true;
                }
            }
        }

        // 4) Collision joueur contre joueur (push simple)
        for a in 0..n {
            for b in (a + 1)..n {
                let (left, right) = self.players.split_at_mut(a + 1);
                let pa = &mut left[a];
                let pb = &mut right[b - a - 1];

                let overlap_x = (pa.x + pa.width).min(pb.x + pb.width) - pa.x.max(pb.x);
                let overlap_y = (pa.y + pa.height).min(pb.y + pb.height) - pa.y.max(pb.y);

                if overlap_x > 0.0 && overlap_y > 0.0 {
                    if overlap_x < overlap_y {
                        let push = overlap_x / 2.0;
                        if pa.x < pb.x {
                            pa.x -= push;
                            pb.x += push;
                        } else {
                            pa.x += push;
                            pb.x -= push;
                        }
                    } else {
                        let push = overlap_y / 2.0;
                        if pa.y < pb.y {
                            pa.y -= push;
                            pb.y += push;
                        } else {
                            pa.y += push;
                            pb.y -= push;
                        }
                    }
                }
            }
        }
    }
}