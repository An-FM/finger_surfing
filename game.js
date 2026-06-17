const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── Internal resolution (720p) ──
const W = 1280;
const H = 720;

// ── Game state ──
let state = 'menu'; // 'menu' | 'settings' | 'playing' | 'gameover'
let mirror = false;

// ── Player (scaled from 8×12 → 64×96) ──
const player = {
  x: 240,
  y: 0,
  w: 64,
  h: 96,
  vy: 0,
  grounded: false,
  animState: 'idle',
  animFrame: 0,
  animTimer: 0,
};

// ── Constants ──
const GRAVITY = 4;
const JUMP_FORCE = -32;
const SILL_Y = 560;
const SILL_H = 128;

// ── Spritesheet system ──
const HAS_SPRITESHEET = false;
const SPRITESHEET_FILE = 'spritesheet.png';

const BG_SPRITES = {
  sky: null,
  sill: null,
  frame: null,
};

const CAR_SPRITES = [null, null, null, null];

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

const ANIM_FRAMES = {
  idle:    { row: 0, count: 2, width: 64, height: 96 },
  running: { row: 1, count: 3, width: 64, height: 96 },
  jumping: { row: 2, count: 2, width: 64, height: 96 },
};

// ── Cars ──
let cars = [];
let score = 0;
let speed = 8;
let speedTimer = 0;
let frameCount = 0;
const CAR_INTERVAL = 60;

// ── Game over timer ──
let gameoverTimer = 0;
const GAMEOVER_DELAY = 120;

// ── Input ──
let jumpPressed = false;
let menuOption = 0;

// ── Init ──
function init() {
  player.x = 240;
  player.y = SILL_Y - player.h;
  player.vy = 0;
  player.grounded = true;
  player.animState = 'running';
  player.animFrame = 0;
  player.animTimer = 0;
  cars = [];
  score = 0;
  speed = 8;
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

  drawBackground();

  for (let c of cars) {
    drawCar(c);
  }

  drawPlayer();
  drawWindowFrame();

  ctx.restore();

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
    ctx.fillRect(0, SILL_Y - 60, W, 60);
    // Road dashes
    ctx.fillStyle = '#CCC';
    for (let x = 0; x < W; x += 120) {
      ctx.fillRect(x, SILL_Y - 35, 60, 8);
    }
  }

  if (HAS_SPRITESHEET && BG_SPRITES.sill && spritesheetImage) {
    ctx.drawImage(BG_SPRITES.sill, 0, SILL_Y, W, SILL_H);
  } else {
    // Window sill
    ctx.fillStyle = '#5C4033';
    ctx.fillRect(0, SILL_Y, W, SILL_H);
    ctx.fillStyle = '#7A5A4A';
    ctx.fillRect(0, SILL_Y + 16, W, 8);
    ctx.fillRect(0, SILL_Y + 64, W, 8);
  }
}

function drawWindowFrame() {
  if (HAS_SPRITESHEET && BG_SPRITES.frame && spritesheetImage) {
    ctx.drawImage(BG_SPRITES.frame, 0, 0, W, H);
    return;
  }

  // Top bar
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, W, 32);
  // Left pillar
  ctx.fillRect(0, 0, 32, H);
  // Right pillar
  ctx.fillRect(W - 32, 0, 32, H);
  // Sill top edge highlight
  ctx.fillStyle = '#666';
  ctx.fillRect(0, SILL_Y - 16, W, 16);
  // Interior shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(32, 32, W - 64, 32);
}

function drawPlayer() {
  const frame = player.animFrame;
  const state = player.animState;

  // Spritesheet mode
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

  // Fallback: colored shapes (all values ×8 from original)
  ctx.fillStyle = '#FFB6C1';

  if (state === 'idle') {
    ctx.fillRect(player.x, player.y, player.w, 56);
    const sway = frame === 0 ? 0 : 8;
    ctx.fillRect(player.x + sway, player.y + 56, 16, 40);
    ctx.fillRect(player.x + 48 - sway, player.y + 56, 16, 40);
  } else if (state === 'running') {
    ctx.fillRect(player.x, player.y, player.w, 48);
    if (frame === 0) {
      ctx.fillRect(player.x + 0, player.y + 48, 24, 48);
      ctx.fillRect(player.x + 40, player.y + 48, 24, 40);
    } else if (frame === 1) {
      ctx.fillRect(player.x + 0, player.y + 48, 24, 40);
      ctx.fillRect(player.x + 40, player.y + 56, 24, 32);
    } else {
      ctx.fillRect(player.x + 0, player.y + 56, 24, 32);
      ctx.fillRect(player.x + 40, player.y + 48, 24, 40);
    }
  } else if (state === 'jumping') {
    ctx.fillRect(player.x, player.y, player.w, 48);
    if (frame === 0) {
      ctx.fillRect(player.x + 0, player.y + 40, 24, 32);
      ctx.fillRect(player.x + 40, player.y + 40, 24, 32);
    } else {
      ctx.fillRect(player.x - 8, player.y + 40, 24, 32);
      ctx.fillRect(player.x + 48, player.y + 40, 24, 32);
    }
  }
}

function drawCar(c) {
  if (HAS_SPRITESHEET && CAR_SPRITES[c.spriteIndex] && spritesheetImage) {
    ctx.drawImage(CAR_SPRITES[c.spriteIndex], c.x, c.y, c.w, c.h);
    return;
  }

  // Fallback: colored car (all values ×8)
  ctx.fillStyle = c.color;
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.fillRect(c.x + 16, c.y - 24, c.w - 32, 24);
  ctx.fillStyle = '#AFEEEE';
  ctx.fillRect(c.x + 24, c.y - 16, c.w - 48, 16);
  ctx.fillStyle = '#222';
  ctx.fillRect(c.x + 16, c.y + c.h - 16, 24, 16);
  ctx.fillRect(c.x + c.w - 40, c.y + c.h - 16, 24, 16);
}

function drawUI() {
  if (state === 'playing' || state === 'gameover') {
    ctx.fillStyle = '#FFF';
    ctx.font = '48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(score, W / 2, 60);
  }

  if (state === 'menu') {
    ctx.fillStyle = '#FFF';
    ctx.font = '64px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FINGER', W / 2, 180);
    ctx.fillText('SURFING', W / 2, 260);

    ctx.font = '40px monospace';
    const items = ['PLAY', 'SETTINGS'];
    for (let i = 0; i < items.length; i++) {
      const y = 400 + i * 80;
      if (i === menuOption) {
        ctx.fillStyle = '#FF0';
        ctx.fillText('> ' + items[i] + ' <', W / 2, y);
      } else {
        ctx.fillStyle = '#AAA';
        ctx.fillText(items[i], W / 2, y);
      }
    }
  }

  if (state === 'settings') {
    ctx.fillStyle = '#FFF';
    ctx.font = '56px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SETTINGS', W / 2, 200);

    ctx.font = '40px monospace';
    ctx.fillStyle = '#FF0';
    ctx.fillText('WINDOW: ' + (mirror ? 'LEFT' : 'RIGHT'), W / 2, 360);
    ctx.font = '40px monospace';
    ctx.fillStyle = '#AAA';
    ctx.fillText('[Space/Tap to switch]', W / 2, 460);
    ctx.fillText('[Enter/Back to Menu]', W / 2, 540);
  }

  if (state === 'gameover') {
    ctx.fillStyle = '#FFF';
    ctx.font = '64px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, 300);
  }
}

// ── Update ──
function update() {
  // Animation timer
  player.animTimer++;
  const animSpeed = player.animState === 'running' ? 8 : 12;
  if (player.animTimer > animSpeed) {
    player.animTimer = 0;
    player.animFrame = (player.animFrame + 1) % 3;
  }

  // Game over countdown
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

  // Player physics
  player.vy += GRAVITY;
  if (player.vy > 40) player.vy = 40;
  player.y += player.vy;

  // Ground / sill collision
  if (player.y + player.h > SILL_Y) {
    player.y = SILL_Y - player.h;
    player.vy = 0;
    player.grounded = true;
    player.animState = 'running';
  }

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

  // Speed ramp
  speedTimer++;
  if (speedTimer > 300) {
    speedTimer = 0;
    speed *= 1.15;
    if (speed > 24) speed = 24;
  }

  // Spawn cars
  frameCount++;
  const interval = Math.max(20, CAR_INTERVAL / (speed / 8));
  if (frameCount > interval) {
    frameCount = 0;
    const carH = 80;
    const carY = SILL_Y - carH - 16 - Math.floor(Math.random() * 32);
    const colorIdx = Math.floor(Math.random() * 4);
    const colors = ['#E33', '#33E', '#E83', '#383'];
    cars.push({
      x: W + 16,
      y: carY,
      w: 128,
      h: carH,
      color: colors[colorIdx],
      spriteIndex: colorIdx,
      scored: false,
    });
  }

  // Move cars
  for (let i = cars.length - 1; i >= 0; i--) {
    cars[i].x -= speed;
    if (!cars[i].scored && cars[i].x + cars[i].w < player.x) {
      cars[i].scored = true;
      score++;
    }
    if (cars[i].x + cars[i].w < 0) {
      cars.splice(i, 1);
    }
  }

  // Collision
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
      state = 'playing';
      init();
    } else {
      state = 'settings';
    }
    return;
  }

  if (state === 'settings') {
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
      handleAction();
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

// Touch
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const ty = (e.touches[0].clientY / window.innerHeight);

  if (state === 'menu') {
    // Tap top half = up, bottom half = select Play
    if (ty < 0.5) handleMenuUp();
    else handleAction();
  } else if (state === 'settings') {
    handleAction();
  } else if (state === 'playing') {
    jumpPressed = true;
  } else if (state === 'gameover') {
    handleAction();
  }
});

canvas.addEventListener('click', () => {
  handleAction();
});
