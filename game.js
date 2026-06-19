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
    return;
  }

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, SILL_Y - 60);
  skyGrad.addColorStop(0, '#4A90D9');
  skyGrad.addColorStop(0.6, '#87CEEB');
  skyGrad.addColorStop(1, '#B8E4F0');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, SILL_Y - 60);

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  drawCloud(150, 80, 60);
  drawCloud(500, 120, 45);
  drawCloud(900, 60, 55);
  drawCloud(1150, 140, 40);

  // Road
  ctx.fillStyle = '#555';
  ctx.fillRect(0, SILL_Y - 60, W, 60);
  // Road edge lines
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(0, SILL_Y - 58, W, 4);
  ctx.fillRect(0, SILL_Y - 6, W, 4);
  // Road center dashes
  ctx.fillStyle = '#FFF';
  for (let x = 0; x < W; x += 120) {
    ctx.fillRect(x, SILL_Y - 32, 60, 6);
  }

  // Window sill
  if (HAS_SPRITESHEET && BG_SPRITES.sill && spritesheetImage) {
    ctx.drawImage(BG_SPRITES.sill, 0, SILL_Y, W, SILL_H);
    return;
  }
  const sillGrad = ctx.createLinearGradient(0, SILL_Y, 0, SILL_Y + SILL_H);
  sillGrad.addColorStop(0, '#8B6F47');
  sillGrad.addColorStop(0.3, '#6B4F2F');
  sillGrad.addColorStop(1, '#4A3520');
  ctx.fillStyle = sillGrad;
  ctx.fillRect(0, SILL_Y, W, SILL_H);
  // Sill top edge
  ctx.fillStyle = '#A8885E';
  ctx.fillRect(0, SILL_Y, W, 4);
}

function drawCloud(x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
  ctx.arc(x + size * 0.8, y, size * 0.45, 0, Math.PI * 2);
  ctx.arc(x + size * 0.35, y + size * 0.15, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawWindowFrame() {
  if (HAS_SPRITESHEET && BG_SPRITES.frame && spritesheetImage) {
    ctx.drawImage(BG_SPRITES.frame, 0, 0, W, H);
    return;
  }

  // Car interior frame - dark with gradient
  const frameGrad = ctx.createLinearGradient(0, 0, 0, 32);
  frameGrad.addColorStop(0, '#1A1A1A');
  frameGrad.addColorStop(1, '#333');
  ctx.fillStyle = frameGrad;
  ctx.fillRect(0, 0, W, 32);

  // Left pillar with gradient
  const pillarGrad = ctx.createLinearGradient(0, 0, 32, 0);
  pillarGrad.addColorStop(0, '#1A1A1A');
  pillarGrad.addColorStop(1, '#333');
  ctx.fillStyle = pillarGrad;
  ctx.fillRect(0, 0, 32, H);

  // Right pillar
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(W - 32, 0, 32, H);

  // Sill top edge (the window frame bottom)
  ctx.fillStyle = '#444';
  ctx.fillRect(32, SILL_Y - 16, W - 64, 16);
  ctx.fillStyle = '#555';
  ctx.fillRect(32, SILL_Y - 16, W - 64, 2);

  // Interior shadow gradient on the wall
  const shadowGrad = ctx.createLinearGradient(32, 32, 32, 80);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(32, 32, W - 64, 48);
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

  const x = player.x;
  const y = player.y;
  const w = player.w;
  const h = player.h;

  // Skin tone gradient
  const skinGrad = ctx.createLinearGradient(x, y, x, y + h);
  skinGrad.addColorStop(0, '#FFD5C2');
  skinGrad.addColorStop(0.5, '#FFB6A0');
  skinGrad.addColorStop(1, '#E8927A');

  ctx.fillStyle = skinGrad;

  if (state === 'idle') {
    // Palm
    roundRect(x, y, w, 56, 8);
    const sway = frame === 0 ? 0 : 6;
    roundRect(x + 6 + sway, y + 48, 20, 44, 6);
    roundRect(x + 38 - sway, y + 48, 20, 44, 6);
    // Fingernails
    ctx.fillStyle = '#FFEDE0';
    roundRect(x + 9 + sway, y + 82, 14, 6, 3);
    roundRect(x + 41 - sway, y + 82, 14, 6, 3);
  } else if (state === 'running') {
    // Palm
    roundRect(x, y, w, 48, 8);
    if (frame === 0) {
      roundRect(x + 6, y + 40, 22, 56, 6);
      roundRect(x + 36, y + 44, 22, 48, 6);
    } else if (frame === 1) {
      roundRect(x + 6, y + 44, 22, 44, 6);
      roundRect(x + 36, y + 40, 22, 40, 6);
    } else {
      roundRect(x + 6, y + 40, 22, 40, 6);
      roundRect(x + 36, y + 44, 22, 44, 6);
    }
    // Fingernails
    ctx.fillStyle = '#FFEDE0';
    if (frame === 0) {
      roundRect(x + 11, y + 88, 14, 6, 3);
      roundRect(x + 41, y + 84, 14, 6, 3);
    } else if (frame === 1) {
      roundRect(x + 11, y + 80, 14, 6, 3);
      roundRect(x + 41, y + 72, 14, 6, 3);
    } else {
      roundRect(x + 11, y + 72, 14, 6, 3);
      roundRect(x + 41, y + 80, 14, 6, 3);
    }
  } else if (state === 'jumping') {
    // Palm
    roundRect(x, y, w, 48, 8);
    if (frame === 0) {
      roundRect(x + 6, y + 32, 22, 36, 6);
      roundRect(x + 36, y + 32, 22, 36, 6);
    } else {
      roundRect(x + 2, y + 32, 22, 36, 6);
      roundRect(x + 40, y + 32, 22, 36, 6);
    }
    // Fingernails
    ctx.fillStyle = '#FFEDE0';
    if (frame === 0) {
      roundRect(x + 11, y + 60, 14, 6, 3);
      roundRect(x + 41, y + 60, 14, 6, 3);
    } else {
      roundRect(x + 7, y + 60, 14, 6, 3);
      roundRect(x + 45, y + 60, 14, 6, 3);
    }
  }
}

function drawCar(c) {
  if (HAS_SPRITESHEET && CAR_SPRITES[c.spriteIndex] && spritesheetImage) {
    ctx.drawImage(CAR_SPRITES[c.spriteIndex], c.x, c.y, c.w, c.h);
    return;
  }

  const x = c.x;
  const y = c.y;
  const w = c.w;
  const h = c.h;

  // Car body with gradient
  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  bodyGrad.addColorStop(0, lightenColor(c.color, 30));
  bodyGrad.addColorStop(1, c.color);
  ctx.fillStyle = bodyGrad;

  // Main body (rounded)
  roundRect(x, y, w, h, 12);

  // Roof (smaller, on top)
  ctx.fillStyle = c.color;
  roundRect(x + 16, y - 20, w - 32, 24, 8);

  // Windows
  ctx.fillStyle = '#8EC8E8';
  roundRect(x + 22, y - 16, w - 44, 16, 4);

  // Window shine
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(x + 26, y - 14, (w - 44) * 0.4, 10, 2);

  // Wheels
  ctx.fillStyle = '#222';
  roundRect(x + 12, y + h - 12, 22, 12, 4);
  roundRect(x + w - 34, y + h - 12, 22, 12, 4);
  // Wheel hub
  ctx.fillStyle = '#555';
  roundRect(x + 16, y + h - 10, 14, 8, 3);
  roundRect(x + w - 30, y + h - 10, 14, 8, 3);

  // Headlight / taillight
  ctx.fillStyle = '#FFFFAA';
  roundRect(x + 3, y + 8, 6, 8, 2);
  ctx.fillStyle = '#FF4444';
  roundRect(x + w - 9, y + 8, 6, 8, 2);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function lightenColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `rgb(${r},${g},${b})`;
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
