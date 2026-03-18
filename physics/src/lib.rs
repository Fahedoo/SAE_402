use wasm_bindgen::prelude::*;

// ─── Plateforme (rectangle avec pente) ───────────────────────────────
#[wasm_bindgen]
#[derive(Clone)]
pub struct Platform {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub slope: f32, 
}

#[wasm_bindgen]
impl Platform {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32, width: f32, height: f32, slope: f32) -> Platform {
        Platform { x, y, width, height, slope }
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
    pub jump_boost_ready: bool,
}

#[wasm_bindgen]
impl Player {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Player {
        Player {
            x, y, width, height,
            vx: 0.0, vy: 0.0,
            on_ground: false,
            jump_boost_ready: false,
        }
    }
}

// ─── Monde physique ────────────────────────────────────────
#[wasm_bindgen]
pub struct World {
    gravity: f32,
    floor_y: f32,
    pub width: f32, // ⚠️ NOUVEAU : La largeur logique du monde !
    players: Vec<Player>,
    platforms: Vec<Platform>,
}

#[wasm_bindgen]
impl World {
    // ⚠️ NOUVEAU : Le constructeur prend maintenant la largeur
    #[wasm_bindgen(constructor)]
    pub fn new(gravity: f32, floor_y: f32, width: f32) -> World {
        World {
            gravity,
            floor_y,
            width, // ⚠️ NOUVEAU
            players: Vec::new(),
            platforms: Vec::new(),
        }
    }

    pub fn add_player(&mut self, x: f32, y: f32, w: f32, h: f32) -> usize {
        let id = self.players.len();
        self.players.push(Player::new(x, y, w, h));
        id
    }

    pub fn add_platform(&mut self, x: f32, y: f32, w: f32, h: f32, slope: f32) -> usize {
        let id = self.platforms.len();
        self.platforms.push(Platform::new(x, y, w, h, slope));
        id
    }

    pub fn set_player_vx(&mut self, id: usize, vx: f32) {
        if let Some(p) = self.players.get_mut(id) {
            p.vx = vx;
        }
    }

    pub fn set_player_vy(&mut self, id: usize, vy: f32) {
        if let Some(p) = self.players.get_mut(id) {
            p.vy = vy;
        }
    }

    pub fn player_jump(&mut self, id: usize, jump_speed: f32) {
        if let Some(p) = self.players.get_mut(id) {
            if p.on_ground {
                let jump_multiplier = if p.jump_boost_ready { 1.4 } else { 1.0 };
                p.vy = -jump_speed * jump_multiplier;
                p.on_ground = false;
                p.jump_boost_ready = false;
            }
        }
    }

    pub fn get_player_x(&self, id: usize) -> f32 { self.players[id].x }
    pub fn get_player_y(&self, id: usize) -> f32 { self.players[id].y }
    pub fn get_player_on_ground(&self, id: usize) -> bool { self.players[id].on_ground }
    pub fn player_count(&self) -> usize { self.players.len() }

    pub fn step(&mut self, dt: f32) {
        let n = self.players.len();

        // 1) Gravité + déplacement
        for p in self.players.iter_mut() {
            p.vy += self.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.on_ground = false;
            p.jump_boost_ready = false;
        }

        // 🌟 NOUVEAU : Murs physiques (Gauche et Droite) 🌟
        for p in self.players.iter_mut() {
            // Mur gauche (X = 0)
            if p.x < 0.0 {
                p.x = 0.0;
                p.vx = 0.0; // On l'arrête net
            }

            // Mur droit (X = self.width)
            if p.x + p.width > self.width {
                p.x = self.width - p.width;
                p.vx = 0.0; // On l'arrête net
            }
        }

        // 2) Collision avec le sol
        for p in self.players.iter_mut() {
            if p.y + p.height > self.floor_y {
                p.y = self.floor_y - p.height;
                p.vy = 0.0;
                p.on_ground = true;
            }
        }

        // 3) Collision avec les plateformes (Pentes intelligentes Wasm)
        for p in self.players.iter_mut() {
            for plat in &self.platforms {
                let player_center = p.x + (p.width / 2.0);

                if player_center >= plat.x && player_center <= plat.x + plat.width {
                    let ratio = (player_center - plat.x) / plat.width;
                    let exact_plat_y = plat.y + (plat.slope * ratio);

                    let prev_y = p.y - p.vy * dt;
                    let prev_bottom = prev_y + p.height;
                    let player_bottom = p.y + p.height;

                    let lands = p.vy >= 0.0
                        && prev_bottom <= exact_plat_y + 15.0 // Marge de tolérance
                        && player_bottom >= exact_plat_y;

                    if lands {
                        p.y = exact_plat_y - p.height;
                        p.vy = 0.0;
                        p.on_ground = true;
                    }
                }
            }
        }

        // 4) Collision joueur contre joueur
        for a in 0..n {
            for b in (a + 1)..n {
                let (left, right) = self.players.split_at_mut(a + 1);
                let pa = &mut left[a];
                let pb = &mut right[b - a - 1];

                let overlap_x = (pa.x + pa.width).min(pb.x + pb.width) - pa.x.max(pb.x);
                let overlap_y = (pa.y + pa.height).min(pb.y + pb.height) - pa.y.max(pb.y);

                if overlap_x > 0.0 && overlap_y > 0.0 {
                    let pa_is_above = pa.vy >= 0.0 && (pa.y + pa.height) <= (pb.y + 8.0);
                    let pb_is_above = pb.vy >= 0.0 && (pb.y + pb.height) <= (pa.y + 8.0);

                    if pa_is_above {
                        pa.y = pb.y - pa.height; pa.vy = 0.0; pa.on_ground = true; pa.jump_boost_ready = true;
                        continue;
                    }
                    if pb_is_above {
                        pb.y = pa.y - pb.height; pb.vy = 0.0; pb.on_ground = true; pb.jump_boost_ready = true;
                        continue;
                    }
                    if overlap_x < overlap_y {
                        let push = overlap_x / 2.0;
                        if pa.x < pb.x { pa.x -= push; pb.x += push; } 
                        else { pa.x += push; pb.x -= push; }
                    } else {
                        if pa.y < pb.y {
                            if pb.on_ground {
                                pa.y -= overlap_y; pa.vy = 0.0; pa.on_ground = true; pa.jump_boost_ready = true;
                            } else if pa.on_ground { pb.y += overlap_y;
                            } else { let push = overlap_y / 2.0; pa.y -= push; pb.y += push; }
                        } else {
                            if pa.on_ground {
                                pb.y -= overlap_y; pb.vy = 0.0; pb.on_ground = true; pb.jump_boost_ready = true;
                            } else if pb.on_ground { pa.y += overlap_y;
                            } else { let push = overlap_y / 2.0; pa.y += push; pb.y -= push; }
                        }
                    }
                }
            }
        }

        // 5) Re-clamp final au sol
        for p in self.players.iter_mut() {
            if p.y + p.height > self.floor_y {
                p.y = self.floor_y - p.height;
                p.vy = 0.0;
                p.on_ground = true;
            }
        }
    }
}