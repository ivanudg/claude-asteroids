"use strict";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────

const keys = {};
const justPressed = {};

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) {
    e.preventDefault();
  }
  if (!keys[e.code]) justPressed[e.code] = true;
  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v, max) => ((v % max) + max) % max;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

// ── Power-up: Disparo Triple ────────────────────────────────────────────────────
const TRIPLE_DURATION = 10; // segundos que dura el efecto
const TRIPLE_SPREAD = 0.26; // rad (~15°) de separación entre balas del abanico
const DROP_CHANCE = 0.15; // prob. de drop al destruir un asteroide
const DROP_GUARANTEE = 6; // fuerza el drop si no cayó en las primeras N destrucciones del nivel
const PU_COLOR = "#0ff"; // cian, color del power-up Disparo Triple
const SHIELD_DURATION = 5; // segundos que dura el escudo
const SHIELD_COLOR = "#8cf"; // azul claro, color del power-up Escudo
const SLOW_DURATION = 6; // segundos que dura el slow motion
const SLOW_FACTOR = 0.5; // asteroides a mitad de velocidad durante el efecto
const SLOW_COLOR = "#fd4"; // ámbar, color del power-up Slow Motion
const ALL_PU_TYPES = ["triple", "shield", "slow"]; // tipos existentes
const TYPES_PER_LEVEL = 2; // cuántos de los 3 tipos aparecen (1 c/u) por nivel, al azar

class Asteroid {
  constructor(x, y, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(triple) {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (!triple) return [new Bullet(ox, oy, this.angle)];
    return [
      new Bullet(ox, oy, this.angle),
      new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
      new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
    ];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = "rgba(255, 130, 0, 0.85)";
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-up recolectable ───────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // "triple" | "shield"
    this.radius = 11;
    this.rot = 0;
    this.rotSpeed = 1.4;
    // Deriva lenta para que no quede estático (con wrap toroidal)
    const angle = rand(0, Math.PI * 2);
    const speed = rand(12, 24);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    if (this.type === "shield") {
      // Anillo doble en azul (alude al escudo de energía)
      ctx.strokeStyle = SHIELD_COLOR;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === "slow") {
      // Reloj en ámbar (alude a la cámara lenta)
      ctx.strokeStyle = SLOW_COLOR;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      // Manecillas
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -this.radius * 0.6);
      ctx.moveTo(0, 0);
      ctx.lineTo(this.radius * 0.5, 0);
      ctx.stroke();
    } else {
      // Triple: rombo cian + abanico de 3 líneas
      ctx.strokeStyle = PU_COLOR;
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(this.radius, 0);
      ctx.lineTo(0, this.radius);
      ctx.lineTo(-this.radius, 0);
      ctx.closePath();
      ctx.stroke();

      for (const a of [-TRIPLE_SPREAD, 0, TRIPLE_SPREAD]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.sin(a) * this.radius, -Math.cos(a) * this.radius);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups;
let score, lives, level;
let tripleTimer, shieldTimer, slowTimer, droppedTypes, killsThisLevel, levelTypes;
let state; // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function resetLevelDrop() {
  droppedTypes = new Set();
  killsThisLevel = 0;
  // Elegir al azar TYPES_PER_LEVEL de los 3 tipos existentes para este nivel
  const pool = [...ALL_PU_TYPES];
  while (pool.length > TYPES_PER_LEVEL) pool.splice(randInt(0, pool.length - 1), 1);
  levelTypes = pool;
}

function tryDropPowerup(x, y) {
  if (droppedTypes.size >= levelTypes.length) return; // ya salieron los tipos del nivel
  killsThisLevel++;
  for (const t of levelTypes) {
    if (droppedTypes.has(t)) continue;
    if (Math.random() < DROP_CHANCE || killsThisLevel >= DROP_GUARANTEE) {
      powerups.push(new PowerUp(x, y, t));
      droppedTypes.add(t);
      return; // máx. un item por destrucción, para espaciarlos
    }
  }
}

function initGame() {
  ship = new Ship();
  bullets = [];
  asteroids = [];
  particles = [];
  powerups = [];
  tripleTimer = 0;
  shieldTimer = 0;
  slowTimer = 0;
  resetLevelDrop();
  score = 0;
  lives = 3;
  level = 1;
  state = "playing";
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets = [];
  particles = [];
  powerups = []; // no arrastrar un item sin recoger; tripleTimer persiste si estaba activo
  resetLevelDrop(); // garantiza un nuevo drop en el nivel nuevo
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = "gameover";
  } else {
    state = "dead";
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === "gameover") {
    if (pressed("Space")) initGame();
    particles.forEach((p) => p.update(dt));
    particles = particles.filter((p) => !p.dead);
    return;
  }

  if (state === "dead") {
    deadTimer -= dt;
    particles.forEach((p) => p.update(dt));
    particles = particles.filter((p) => !p.dead);
    asteroids.forEach((a) => a.update(dt));
    if (deadTimer <= 0) {
      state = "playing";
      ship.reset();
    }
    return;
  }

  if (tripleTimer > 0) tripleTimer -= dt;
  if (shieldTimer > 0) shieldTimer -= dt;
  if (slowTimer > 0) slowTimer -= dt;

  // Disparar
  if (pressed("Space")) {
    bullets.push(...ship.tryShoot(tripleTimer > 0));
  }

  ship.update(dt);
  bullets.forEach((b) => b.update(dt));
  // Slow motion: solo los asteroides van a mitad de velocidad; nave y balas normales
  const astDt = slowTimer > 0 ? dt * SLOW_FACTOR : dt;
  asteroids.forEach((a) => a.update(astDt));
  particles.forEach((p) => p.update(dt));
  powerups.forEach((p) => p.update(dt));

  bullets = bullets.filter((b) => !b.dead);
  particles = particles.filter((p) => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        tryDropPowerup(a.x, a.y);
      }
    }
  }
  asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
  bullets = bullets.filter((b) => !b.dead);

  // Nave vs power-up
  for (const p of powerups) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p.type === "triple") tripleTimer = TRIPLE_DURATION;
      else if (p.type === "shield") shieldTimer = SHIELD_DURATION;
      else if (p.type === "slow") slowTimer = SLOW_DURATION;
      explode(p.x, p.y, 12); // destello al recoger
    }
  }
  powerups = powerups.filter((p) => !p.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (shieldTimer > 0) {
          shieldTimer = 0; // el escudo absorbe el impacto y se consume
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          asteroids = asteroids.filter((x) => !x.dead).concat(a.split());
        } else {
          killShip();
        }
        break;
      }
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawPowerBar(label, frac, color, y) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.font = "15px monospace";
  ctx.textAlign = "left";
  ctx.lineWidth = 1;
  ctx.fillText(label, 14, y);
  const bx = 84;
  const bw = 120;
  const bh = 10;
  const by = y - 10;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillRect(bx, by, bw * frac, bh);
}

function drawHUD() {
  ctx.fillStyle = "#fff";
  ctx.font = "15px monospace";

  ctx.textAlign = "left";
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = "center";
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++) drawLifeIcon(W - 16 - i * 22, 18);

  // Indicadores de power-ups activos (fila inferior, uno por línea)
  if (slowTimer > 0)
    drawPowerBar("SLOW", slowTimer / SLOW_DURATION, SLOW_COLOR, H - 50);
  if (shieldTimer > 0)
    drawPowerBar("SHIELD", shieldTimer / SHIELD_DURATION, SHIELD_COLOR, H - 32);
  if (tripleTimer > 0)
    drawPowerBar("TRIPLE", tripleTimer / TRIPLE_DURATION, PU_COLOR, H - 14);
}

function drawOverlay(title, sub) {
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 46px monospace";
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font = "18px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function drawShield() {
  if (shieldTimer <= 0 || ship.dead) return;
  // Parpadeo en el último ~1s antes de expirar
  if (shieldTimer < 1 && Math.floor(shieldTimer * 8) % 2 === 0) return;
  ctx.strokeStyle = SHIELD_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.radius + 7, 0, Math.PI * 2);
  ctx.stroke();
}

function draw() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  particles.forEach((p) => p.draw());
  asteroids.forEach((a) => a.draw());
  bullets.forEach((b) => b.draw());
  powerups.forEach((p) => p.draw());
  drawShield();
  ship.draw();

  drawHUD();

  if (state === "gameover")
    drawOverlay("GAME OVER", `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
