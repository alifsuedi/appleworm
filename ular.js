const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let grid = { cols: 20, rows: 20, cellSize: 20 };
let snake = [];
let direction = { x: 0, y: 0 };
let food = { x: 0, y: 0 };
let score = 0;
let highScore = 0;
let gameInterval = null;
let speed = 100;
// tempo settings: start fast (small ms) then increase (slower) as score grows
let tempoStart = 80; // initial interval (ms) - faster
let tempoMax = 220; // slowest interval (ms)
let tempoStep = 12; // how much to increase per food

const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const levelSelect = document.getElementById('levelSelect');
const restartBtn = document.getElementById('restartBtn');
const resetHighBtn = document.getElementById('resetHighBtn');
const autoStartChk = document.getElementById('autoStartChk');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayScore = document.getElementById('overlayScore');
const playAgainBtn = document.getElementById('playAgainBtn');
const dpad = document.getElementById('dpad');
const wallModeSelect = document.getElementById('wallModeSelect');

// wall mode: 'wrap' or 'solid'
let wallMode = 'wrap';

// responsive container
const canvasWrap = document.querySelector('.canvas-wrap');

function init() {
    // Load high score
    highScore = parseInt(localStorage.getItem('snakeHighScore') || '0', 10);
    highScoreEl.innerText = `High Score: ${highScore}`;

    setLevel('classic');
    resetGame();

    levelSelect.addEventListener('change', () => {
        setLevel(levelSelect.value);
        resetGame();
    });

    restartBtn.addEventListener('click', () => resetGame());

    resetHighBtn.addEventListener('click', () => {
        localStorage.removeItem('snakeHighScore');
        highScore = 0;
        highScoreEl.innerText = `High Score: ${highScore}`;
    });

    if (wallModeSelect) {
        wallMode = wallModeSelect.value || 'wrap';
        wallModeSelect.addEventListener('change', () => {
            wallMode = wallModeSelect.value;
        });
    }

    playAgainBtn.addEventListener('click', () => {
        hideOverlay();
        resetGame();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp' && direction.y === 0) {
            direction = { x: 0, y: -1 };
        } else if (event.key === 'ArrowDown' && direction.y === 0) {
            direction = { x: 0, y: 1 };
        } else if (event.key === 'ArrowLeft' && direction.x === 0) {
            direction = { x: -1, y: 0 };
        } else if (event.key === 'ArrowRight' && direction.x === 0) {
            direction = { x: 1, y: 0 };
        }
    });

    // Touch controls (simple swipe detection)
    let touchStart = null;
    canvas.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener('touchend', (e) => {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x;
        const dy = t.clientY - touchStart.y;
        if (Math.abs(dx) > Math.abs(dy)) {
            // horizontal
            if (dx > 20 && direction.x === 0) direction = { x: 1, y: 0 };
            else if (dx < -20 && direction.x === 0) direction = { x: -1, y: 0 };
        } else {
            // vertical
            if (dy > 20 && direction.y === 0) direction = { x: 0, y: 1 };
            else if (dy < -20 && direction.y === 0) direction = { x: 0, y: -1 };
        }
        touchStart = null;
    }, { passive: true });
}

function setLevel(level) {
    if (level === 'classic') {
        grid.cols = 20; grid.rows = 20; grid.cellSize = 20; speed = 100;
        canvas.width = grid.cols * grid.cellSize;
        canvas.height = grid.rows * grid.cellSize;
        // tempo defaults for level
        tempoStart = 80; tempoMax = 220; tempoStep = 10;
        updateCanvasScale();
    } else if (level === 'dense') {
        grid.cols = 25; grid.rows = 25; grid.cellSize = 16; speed = 80;
        canvas.width = grid.cols * grid.cellSize;
        canvas.height = grid.rows * grid.cellSize;
        tempoStart = 60; tempoMax = 200; tempoStep = 8;
        updateCanvasScale();
    } else if (level === 'wide') {
        grid.cols = 30; grid.rows = 15; grid.cellSize = 20; speed = 90;
        canvas.width = grid.cols * grid.cellSize;
        canvas.height = grid.rows * grid.cellSize;
        tempoStart = 90; tempoMax = 260; tempoStep = 12;
        updateCanvasScale();
    }
}

function updateCanvasScale() {
    // Fit canvas inside wrapper while preserving aspect and internal resolution
    const maxW = Math.min(window.innerWidth - 32, canvas.width);
    const scale = Math.min(1, maxW / canvas.width);
    canvas.style.width = Math.round(canvas.width * scale) + 'px';
    canvas.style.height = Math.round(canvas.height * scale) + 'px';
}

// prevent page scroll when interacting with canvas
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });

// D-pad wiring (pointer events)
if (dpad) {
    dpad.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.dpad-btn');
        if (!btn) return;
        const dir = btn.dataset.dir;
        applyDirection(dir);
    });
    // also allow click
    dpad.addEventListener('click', (e) => {
        const btn = e.target.closest('.dpad-btn');
        if (!btn) return;
        const dir = btn.dataset.dir;
        applyDirection(dir);
    });
}

function applyDirection(dir) {
    if (dir === 'up' && direction.y === 0) direction = { x: 0, y: -1 };
    else if (dir === 'down' && direction.y === 0) direction = { x: 0, y: 1 };
    else if (dir === 'left' && direction.x === 0) direction = { x: -1, y: 0 };
    else if (dir === 'right' && direction.x === 0) direction = { x: 1, y: 0 };
}

// update scale on resize
window.addEventListener('resize', () => updateCanvasScale());

function resetGame() {
    // start snake in center
    snake = [{ x: Math.floor(grid.cols / 2), y: Math.floor(grid.rows / 2) }];
    direction = { x: 0, y: 0 };
    score = 0;
    scoreEl.innerText = `Score: ${score}`;
    spawnFood();

    if (gameInterval) clearInterval(gameInterval);
    // initialize tempo and start interval
    updateSpeed(true);
    // Auto-start option
    if (autoStartChk.checked && direction.x === 0 && direction.y === 0) {
        // default start to right
        direction = { x: 1, y: 0 };
    }
}

function computeTempoForScore(sc) {
    // tempo increases with score (slows down). cap at tempoMax
    return Math.min(tempoMax, tempoStart + sc * tempoStep);
}

function updateSpeed(resetInterval = false) {
    const newSpeed = Math.round(computeTempoForScore(score));
    // if timer not running or speed changed, restart interval
    if (gameInterval) {
        if (newSpeed !== speed || resetInterval) {
            clearInterval(gameInterval);
            speed = newSpeed;
            gameInterval = setInterval(drawGame, speed);
        }
    } else {
        speed = newSpeed;
        gameInterval = setInterval(drawGame, speed);
    }
}

function drawGame() {
    // disable smoothing for crisp pixel look
    ctx.imageSmoothingEnabled = false;

    // background (dark grid)
    ctx.fillStyle = '#061018';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw food as a neon pixel square
    const fx = food.x * grid.cellSize;
    const fy = food.y * grid.cellSize;
    const pad = Math.max(1, Math.floor(grid.cellSize * 0.15));
    ctx.fillStyle = '#ff5fb4'; // neon pink food
    ctx.fillRect(fx + pad, fy + pad, grid.cellSize - pad*2, grid.cellSize - pad*2);

    // update head position based on wall mode
    const rawHead = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    let head = { x: rawHead.x, y: rawHead.y };
    if (wallMode === 'wrap') {
        // wrap-around
        if (head.x < 0) head.x = grid.cols - 1;
        if (head.x >= grid.cols) head.x = 0;
        if (head.y < 0) head.y = grid.rows - 1;
        if (head.y >= grid.rows) head.y = 0;
    } else {
        // solid walls: check bounds and die if out
        if (rawHead.x < 0 || rawHead.x >= grid.cols || rawHead.y < 0 || rawHead.y >= grid.rows) {
            showOverlay(score);
            if (gameInterval) clearInterval(gameInterval);
            return; // stop this frame
        }
    }

    // eat food
    if (head.x === food.x && head.y === food.y) {
        snake.unshift(head);
        score++;
        scoreEl.innerText = `Score: ${score}`;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('snakeHighScore', highScore);
            highScoreEl.innerText = `High Score: ${highScore}`;
        }
        spawnFood();
        // adjust tempo (slow down) as score increases
        updateSpeed();
    } else {
        snake.unshift(head);
        snake.pop();
    }

    // draw snake as blocky pixels (retro style)
    const bodyCols = ['#2ecc71','#29b86a','#22a25f']; // gradient-ish greens
    for (let i = snake.length - 1; i >= 0; i--) {
        const part = snake[i];
        const px = part.x * grid.cellSize;
        const py = part.y * grid.cellSize;
        // alternate color slightly for depth
        const color = i === 0 ? '#66d066' : bodyCols[i % bodyCols.length];
        ctx.fillStyle = color;
        ctx.fillRect(px + 1, py + 1, grid.cellSize - 2, grid.cellSize - 2);
    }

    // head: draw a square with simple pixel eyes
    if (snake.length > 0) {
        const head = snake[0];
        const hx = head.x * grid.cellSize;
        const hy = head.y * grid.cellSize;
        // head block
        ctx.fillStyle = '#66d066';
        ctx.fillRect(hx + 1, hy + 1, grid.cellSize - 2, grid.cellSize - 2);

        // eyes as tiny black squares positioned by direction
        const eyeSize = Math.max(1, Math.floor(grid.cellSize * 0.16));
        let ex1 = hx + Math.floor(grid.cellSize * 0.22);
        let ey1 = hy + Math.floor(grid.cellSize * 0.18);
        let ex2 = hx + Math.floor(grid.cellSize * 0.62);
        let ey2 = ey1;
        if (direction.x === 1) { ex1 = hx + Math.floor(grid.cellSize * 0.52); ex2 = hx + Math.floor(grid.cellSize * 0.75); }
        else if (direction.x === -1) { ex1 = hx + Math.floor(grid.cellSize * 0.12); ex2 = hx + Math.floor(grid.cellSize * 0.32); }
        else if (direction.y === 1) { ey1 = hy + Math.floor(grid.cellSize * 0.55); ey2 = ey1; ex1 = hx + Math.floor(grid.cellSize * 0.3); ex2 = hx + Math.floor(grid.cellSize * 0.6); }
        else if (direction.y === -1) { ey1 = hy + Math.floor(grid.cellSize * 0.12); ey2 = ey1; ex1 = hx + Math.floor(grid.cellSize * 0.3); ex2 = hx + Math.floor(grid.cellSize * 0.6); }

        ctx.fillStyle = '#061018';
        ctx.fillRect(ex1, ey1, eyeSize, eyeSize);
        ctx.fillRect(ex2, ey2, eyeSize, eyeSize);
    }

    // collision with itself only
    if (checkCollision(head)) {
        // show overlay instead of alert
        showOverlay(score);
        if (gameInterval) clearInterval(gameInterval);
    }
}

function showOverlay(finalScore) {
    overlayScore.innerText = `Score: ${finalScore}`;
    overlay.classList.remove('hidden');
}

function hideOverlay() {
    overlay.classList.add('hidden');
}

function spawnFood() {
    // spawn food not on snake
    let tries = 0;
    do {
        food.x = Math.floor(Math.random() * grid.cols);
        food.y = Math.floor(Math.random() * grid.rows);
        tries++;
    } while (snake.some(part => part.x === food.x && part.y === food.y) && tries < 1000);
}

function checkCollision(head) {
    return snake.slice(1).some(part => part.x === head.x && part.y === head.y);
}

init();
