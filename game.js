const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── Internal resolution ──
const W = 160;
const H = 90;

// ── Game state ──
let state = 'menu'; // 'menu' | 'settings' | 'playing' | 'gameover'
let mirror = false;

// ── Player ──
const player = {
  x: 30,
  y: 0,
  w: 8,
  h: 12,
  vy: 0,
  grounded: false,
  // Animation
  animState: 'idle',   // 'idle' | 'running' | 'jumping'
  animFrame: 0,
  animTimer: 0,
};

// ── Constants ──
const GRAVITY = 0.5;
const JUMP_FORCE = -4;
const SILL_Y = 70; // top of window sill
const SILL_H = 16;

// ── Spritesheet system ──
// When you draw your pixel art spritesheet, put it in the same folder
// and set HAS_SPRITESHEET to true. The game will use your art instead
// of the colored placeholder shapes.

const HAS_SPRITESHEET = false; // ← Set to true when your spritesheet is ready!
const SPRITESHEET_FILE = 'spritesheet.png';

// Expected spritesheet layout (each cell = frameWidth × frameHeight pixels):
//
//   Row 0: Idle      (frame 0, 1, 2)
//   Row 1: Running   (frame 0, 1, 2)
//   Row 2: Jumping   (frame 0, 1, 2)
//
// Each frame is ~8×12 px. Total image = 24 × 36 px.
// Use a tool like Aseprite or Piskel to draw it.

// Background images (optional — set to null to keep colored placeholders)
const BG_SPRITES = {
  sky: null,      // 160 × 54 px sky/road
  sill: null,     // 160 × 16 px window sill
  frame: null,    // 160 × 90 px window frame overlay (with transparency)
};

// Car sprites (optional)
const CAR_SPRITES = [
  null, // red car, ~16×10 px
  null, // blue car
  null, // orange car
  null, // green car
];

let spritesheetImage = null;

function loadSpritesheet() {
  if (!HAS_SPRITESHEET) return;
  const img = new Image();
  img.src = SPRITESHEET_FILE;
  img.onload = () => {
    spritesheetImage = img;
    console.log('Spritesheet loaded!');
  };
  img.onerror = () => {
    console.warn('Could not load spritesheet at', SPRITESHEET_FILE);
  };
}

loadSpritesheet();

// Frame definitions: for each animation state, which row and how many frames
const ANIM_FRAMES = {
  idle:    { row: 0, count: 2, width: 8, height: 12 },
  running: { row: 1, count: 3, width: 8, height: 12 },
  jumping: { row: 2, count: 2, width: 8, height: 12 },
};

// ── Cars ──
let cars = [];
let score = 0;
let speed = 1;
let speedTimer = 0;
let frameCount = 0;
const CAR_INTERVAL = 60; // frames between cars at speed 1

// ── Game over timer ──
let gameoverTimer = 0;
const GAMEOVER_DELAY = 120; // ~2 seconds at 60fps

// ── Input ──
let jumpPressed = false;

// ── Menu selection ──
let menuOption = 0; // 0 = Play, 1 = Settings

// ── Init ──
function init() {
  player.x = 30;
  player.y = SILL_Y - player.h;
  player.vy = 0;
  player.grounded = true;
  player.animState = 'running';
  player.animFrame = 0;
  player.animTimer = 0;
  cars = [];
  score = 0;
  speed = 1;
  speedTimer = 0;
  frameCount = 0;
  gameoverTimer = 0;
}

init();

// ── Drawing ──
function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.save();

  if (mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }

  // Background
  drawBackground();

  // Cars
  for (let c of cars) {
    drawCar(c);
  }

  // Player
  drawPlayer();

  // Window frame overlay
  drawWindowFrame();

  ctx.restore();

  // UI (not mirrored)
  drawUI();
}

function drawBackground() {
  if (HAS_SPRITESHEET && BG_SPRITES.sky && spritesheetImage) {
    ctx.drawImage(BG_SPRITES.sky, 0, 0, W, SILL_Y);
  } else {
    // Sky
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, W, SILL_Y);
    // Road
    ctx.fillStyle = '#888';
    ctx.fillRect(0, SILL_Y - 8, W, 8);
    ctx.fillStyle = '#CCC';
    for (let x = 0; x < W; x += 16) {
      ctx.fillRect(x, SILL_Y - 5, 8, 1);
    }
  }

  if (HAS_SPRITESHEET && BG_SPRITES.sill && spritesheetImage) {
    ctx.drawImage(BG_SPRITES.sill, 0, SILL_Y, W, SILL_H);
  } else {
    // Window sill
    ctx.fillStyle = '#5C4033';
    ctx.fillRect(0, SILL_Y, W, SILL_H);
    ctx.fillStyle = '#7A5A4A';
    ctx.fillRect(0, SILL_Y + 2, W, 1);
    ctx.fillRect(0, SILL_Y + 8, W, 1);
  }
}

function drawWindowFrame() {
  if (HAS_SPRITESHEET && BG_SPRITES.frame && spritesheetImage) {
    ctx.drawImage(BG_SPRITES.frame, 0, 0, W, H);
    return;
  }

  // Top bar (car roof/trim)
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, W, 4);
  // Left door pillar
  ctx.fillRect(0, 0, 4, H);
  // Right door pillar
  ctx.fillRect(W - 4, 0, 4, H);
  // Window sill top edge highlight
  ctx.fillStyle = '#666';
  ctx.fillRect(0, SILL_Y - 2, W, 2);
  // Interior shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(4, 4, W - 8, 4);
}

function drawPlayer() {
  const frame = player.animFrame;
  const state = player.animState;

  // ── Spritesheet mode ──
  if (HAS_SPRITESHEET && spritesheetImage && ANIM_FRAMES[state]) {
    const f = ANIM_FRAMES[state];
    const sx = frame * f.width;
    const sy = f.row * f.height;
    ctx.drawImage(
      spritesheetImage,
      sx, sy, f.width, f.height,
      player.x, player.y, player.w, player.h
    );
    return;
  }

  // ── Fallback: colored shapes ──
  ctx.fillStyle = '#FFB6C1';

  // Idle
  if (state === 'idle') {
    ctx.fillRect(player.x, player.y, player.w, 7);
    const sway = frame === 0 ? 0 : 1;
    ctx.fillRect(player.x + sway, player.y + 7, 2, 5);
    ctx.fillRect(player.x + 6 - sway, player.y + 7, 2, 5);
  }

  // Running
  else if (state === 'running') {
    ctx.fillRect(player.x, player.y, player.w, 6);
    if (frame === 0) {
      ctx.fillRect(player.x + 0, player.y + 6, 3, 6);
      ctx.fillRect(player.x + 5, player.y + 6, 3, 5);
    } else if (frame === 1) {
      ctx.fillRect(player.x + 0, player.y + 6, 3, 5);
      ctx.fillRect(player.x + 5, player.y + 7, 3, 4);
    } else {
      ctx.fillRect(player.x + 0, player.y + 7, 3, 4);
      ctx.fillRect(player.x + 5, player.y + 6, 3, 5);
    }
  }

  // Jumping
  else if (state === 'jumping') {
    ctx.fillRect(player.x, player.y, player.w, 6);
    if (frame === 0) {
      ctx.fillRect(player.x + 0, player.y + 5, 3, 4);
      ctx.fillRect(player.x + 5, player.y + 5, 3, 4);
    } else {
      ctx.fillRect(player.x - 1, player.y + 5, 3, 4);
      ctx.fillRect(player.x + 6, player.y + 5, 3, 4);
    }
  }
}

function drawCar(c) {
  // Spritesheet car
  if (HAS_SPRITESHEET && CAR_SPRITES[c.spriteIndex] && spritesheetImage) {
    const img = CAR_SPRITES[c.spriteIndex];
    ctx.drawImage(img, c.x, c.y, c.w, c.h);
    return;
  }

  // Fallback: colored car
  ctx.fillStyle = c.color;
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.fillRect(c.x + 2, c.y - 3, c.w - 4, 3);
  ctx.fillStyle = '#AFEEEE';
  ctx.fillRect(c.x + 3, c.y - 2, c.w - 6, 2);
  ctx.fillStyle = '#222';
  ctx.fillRect(c.x + 2, c.y + c.h - 2, 3, 2);
  ctx.fillRect(c.x + c.w - 5, c.y + c.h - 2, 3, 2);
}

function drawUI() {
  // Score (always visible during play)
  if (state === 'playing' || state === 'gameover') {
    ctx.fillStyle = '#FFF';
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(score, W / 2, 8);
  }

  // ── Main Menu ──
  if (state === 'menu') {
    ctx.fillStyle = '#FFF';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CAR WINDOW', W / 2, 22);
    ctx.fillText('RUNNER', W / 2, 32);

    ctx.font = '5px monospace';
    const items = ['PLAY', 'SETTINGS'];
    for (let i = 0; i < items.length; i++) {
      const y = 50 + i * 10;
      if (i === menuOption) {
        ctx.fillStyle = '#FF0';
        ctx.fillText('> ' + items[i] + ' <', W / 2, y);
      } else {
        ctx.fillStyle = '#AAA';
        ctx.fillText(items[i], W / 2, y);
      }
    }
  }

  // ── Settings ──
  if (state === 'settings') {
    ctx.fillStyle = '#FFF';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SETTINGS', W / 2, 25);

    ctx.font = '5px monospace';
    ctx.fillStyle = '#FF0';
    ctx.fillText('WINDOW: ' + (mirror ? 'LEFT' : 'RIGHT'), W / 2, 45);
    ctx.font = '5px monospace';
    ctx.fillStyle = '#AAA';
    ctx.fillText('[Space/Tap to switch]', W / 2, 58);
    ctx.fillText('[Enter/Back to Menu]', W / 2, 68);
  }

  // ── Game Over ──
  if (state === 'gameover') {
    ctx.fillStyle = '#FFF';
    ctx.font = '5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('aw man, I messed up...', W / 2, 38);
  }
}

// ── Update ──
function update() {
  // ── Animation timer (always runs, even in menus) ──
  player.animTimer++;
  const animSpeed = player.animState === 'running' ? 8 : 12;
  if (player.animTimer > animSpeed) {
    player.animTimer = 0;
    player.animFrame = (player.animFrame + 1) % 3;
  }

  // ── Game over countdown ──
  if (state === 'gameover') {
    gameoverTimer--;
    if (gameoverTimer <= 0) {
      state = 'menu';
      menuOption = 0;
      init();
    }
    return;
  }

  if (state !== 'playing') return;

  // ── Player physics ──
  player.vy += GRAVITY;
  if (player.vy > 5) player.vy = 5;
  player.y += player.vy;

  // Ground / sill collision
  if (player.y + player.h > SILL_Y) {
    player.y = SILL_Y - player.h;
    player.vy = 0;
    player.grounded = true;
    player.animState = 'running';
  }

  // Just jumped
  if (!player.grounded && player.vy < 0) {
    player.animState = 'jumping';
  }

  // Jump
  if (jumpPressed && player.grounded) {
    player.vy = JUMP_FORCE;
    player.grounded = false;
    player.animState = 'jumping';
    jumpPressed = false;
  }

  // ── Speed ramp ──
  speedTimer++;
  if (speedTimer > 300) { // every ~5 seconds
    speedTimer = 0;
    speed *= 1.15;
    if (speed > 3) speed = 3;
  }

  // ── Spawn cars ──
  frameCount++;
  const interval = Math.max(20, CAR_INTERVAL / speed);
  if (frameCount > interval) {
    frameCount = 0;
    const carH = 10;
    const carY = SILL_Y - carH - 2 - Math.floor(Math.random() * 4);
    const colorIdx = Math.floor(Math.random() * 4);
    const colors = ['#E33', '#33E', '#E83', '#383'];
    cars.push({
      x: W + 2,
      y: carY,
      w: 16,
      h: carH,
      color: colors[colorIdx],
      spriteIndex: colorIdx,
      scored: false,
    });
  }

  // ── Move cars ──
  for (let i = cars.length - 1; i >= 0; i--) {
    cars[i].x -= speed;
    // Score if car passed player
    if (!cars[i].scored && cars[i].x + cars[i].w < player.x) {
      cars[i].scored = true;
      score++;
    }
    // Remove if off screen left
    if (cars[i].x + cars[i].w < 0) {
      cars.splice(i, 1);
    }
  }

  // ── Collision ──
  for (let c of cars) {
    if (rectOverlap(player, c)) {
      state = 'gameover';
      gameoverTimer = GAMEOVER_DELAY;
      break;
    }
  }
}

function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── Game loop ──
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();

// ── Input ──
function handleAction() {
  if (state === 'menu') {
    if (menuOption === 0) {
      // Play
      state = 'playing';
      init();
    } else {
      // Settings
      state = 'settings';
    }
    return;
  }

  if (state === 'settings') {
    // Toggle mirror
    mirror = !mirror;
    return;
  }

  if (state === 'playing') {
    jumpPressed = true;
  }

  if (state === 'gameover') {
    state = 'menu';
    menuOption = 0;
    init();
  }
}

function handleBack() {
  if (state === 'settings') {
    state = 'menu';
    menuOption = 0;
  }
}

function handleMenuUp() {
  if (state === 'menu') {
    menuOption = (menuOption - 1 + 2) % 2;
  }
}

function handleMenuDown() {
  if (state === 'menu') {
    menuOption = (menuOption + 1) % 2;
  }
}

// ── Keyboard ──
document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    handleAction();
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (state === 'menu') {
      handleMenuUp();
    } else {
      handleAction(); // jump in playing mode
    }
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (state === 'menu') handleMenuDown();
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    handleBack();
  }
});

// ── Touch ──
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const tx = (touch.clientX - rect.left) / rect.width;
  const ty = (touch.clientY - rect.top) / rect.height;

  if (state === 'menu') {
    // Tap top half = up, bottom half = down, center = select?
    // Simpler: tap anywhere = play (default to Play option)
    handleAction();
  } else if (state === 'settings') {
    handleAction(); // toggle
  } else if (state === 'playing') {
    jumpPressed = true;
  } else if (state === 'gameover') {
    handleAction(); // skip message, back to menu
  }
});

canvas.addEventListener('click', () => {
  handleAction();
});
