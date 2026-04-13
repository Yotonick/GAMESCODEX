const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const comboEl = document.getElementById('combo');
const levelEl = document.getElementById('level');
const coinsEl = document.getElementById('coins');
const missionEl = document.getElementById('mission');
const eventTextEl = document.getElementById('eventText');
const restartBtn = document.getElementById('restart');
const shopEl = document.getElementById('shop');

const grid = 20;
const cells = canvas.width / grid;

const missions = [
  { text: 'Съешь 5 яблок', goal: 5, reward: 20 },
  { text: 'Собери комбо x4', goal: 4, reward: 30, byCombo: true },
  { text: 'Набери 250 очков', goal: 250, reward: 35, byScore: true },
  { text: 'Сделай 3 рывка', goal: 3, reward: 15, byDash: true },
];

const upgrades = {
  magnet: { name: 'Комбо-ядро', cost: 30, max: 3, desc: 'Дольше держит комбо и иногда удваивает очки.' },
  shield: { name: 'Щит', cost: 45, max: 2, desc: 'Спасает от 1 столкновения.' },
  dash: { name: 'Быстрый рывок', cost: 40, max: 3, desc: 'Уменьшает кулдаун.' },
  coinBoost: { name: 'Монетный буст', cost: 50, max: 3, desc: '+монеты за яблоко.' },
};

let state;

function createInitialState() {
  const savedCoins = Number(localStorage.getItem('snake_coins') || 0);
  const savedBest = Number(localStorage.getItem('snake_best') || 0);
  const savedLvls = JSON.parse(localStorage.getItem('snake_upgrades') || '{}');

  return {
    snake: [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: spawnFood([]),
    score: 0,
    best: savedBest,
    combo: 1,
    comboTimer: 0,
    level: 1,
    speed: 130,
    over: false,
    ticks: 0,
    coins: savedCoins,
    runCoins: 0,
    upgrades: {
      magnet: savedLvls.magnet || 0,
      shield: savedLvls.shield || 0,
      dash: savedLvls.dash || 0,
      coinBoost: savedLvls.coinBoost || 0,
    },
    shields: savedLvls.shield || 0,
    dashCooldown: 0,
    mission: randomMission(),
    missionProgress: 0,
    dashesUsed: 0,
    event: { name: 'Спокойствие', timer: 900, type: 'calm' },
    reverseControls: false,
  };
}

function randomMission() {
  return structuredClone(missions[Math.floor(Math.random() * missions.length)]);
}

function spawnFood(snake) {
  let p;
  do {
    p = { x: Math.floor(Math.random() * cells), y: Math.floor(Math.random() * cells) };
  } while (snake.some(s => s.x === p.x && s.y === p.y));
  return p;
}

function setDirection(x, y) {
  if (state.over) return;
  if (state.dir.x === -x && state.dir.y === -y) return;
  state.nextDir = { x, y };
}

document.addEventListener('keydown', (e) => {
  const rev = state?.reverseControls;
  const map = rev
    ? { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [1, 0], ArrowRight: [-1, 0], w: [0, 1], s: [0, -1], a: [1, 0], d: [-1, 0] }
    : { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  if (map[e.key]) setDirection(...map[e.key]);
  if (e.code === 'Space') dash();
});

restartBtn.onclick = () => resetRun();

function dash() {
  if (state.over || state.dashCooldown > 0) return;
  const dashPower = 2;
  for (let i = 0; i < dashPower; i++) {
    state.snake.unshift({
      x: (state.snake[0].x + state.dir.x + cells) % cells,
      y: (state.snake[0].y + state.dir.y + cells) % cells,
    });
    state.snake.pop();
  }
  state.dashesUsed++;
  state.dashCooldown = Math.max(48 - state.upgrades.dash * 10, 16);
}

function resetRun() {
  const persistent = { coins: state.coins, best: state.best, upgrades: state.upgrades };
  state = createInitialState();
  state.coins = persistent.coins;
  state.best = persistent.best;
  state.upgrades = persistent.upgrades;
  state.shields = persistent.upgrades.shield;
  savePersistent();
  renderShop();
}

function savePersistent() {
  localStorage.setItem('snake_coins', String(state.coins));
  localStorage.setItem('snake_best', String(state.best));
  localStorage.setItem('snake_upgrades', JSON.stringify(state.upgrades));
}

function buyUpgrade(key) {
  const up = upgrades[key];
  if (state.upgrades[key] >= up.max || state.coins < up.cost) return;
  state.coins -= up.cost;
  state.upgrades[key]++;
  if (key === 'shield') state.shields++;
  savePersistent();
  renderShop();
}

function renderShop() {
  shopEl.innerHTML = '';
  Object.entries(upgrades).forEach(([key, up]) => {
    const wrap = document.createElement('div');
    wrap.className = 'upgrade';
    const lvl = state.upgrades[key];
    wrap.innerHTML = `<div><b>${up.name}</b><br><small>${up.desc}<br>Уровень: ${lvl}/${up.max} • ${up.cost}🪙</small></div>`;
    const btn = document.createElement('button');
    btn.textContent = lvl >= up.max ? 'MAX' : 'Купить';
    btn.disabled = lvl >= up.max || state.coins < up.cost;
    btn.onclick = () => buyUpgrade(key);
    wrap.appendChild(btn);
    shopEl.appendChild(wrap);
  });
}

function nextEvent() {
  const pool = [
    { type: 'calm', name: 'Спокойствие', timer: 700 },
    { type: 'coinRain', name: 'Золотой дождь', timer: 500 },
    { type: 'hyper', name: 'Гипер-скорость', timer: 360 },
    { type: 'reverse', name: 'Зеркальное управление', timer: 300 },
  ];
  return structuredClone(pool[Math.floor(Math.random() * pool.length)]);
}

function consumeFood() {
  const eventMult = state.event.type === 'coinRain' ? 2 : 1;
  const critChance = state.upgrades.magnet * 0.12;
  const crit = Math.random() < critChance;
  const plus = (10 * state.combo) * (crit ? 2 : 1);
  state.score += plus;
  state.runCoins += (1 + state.upgrades.coinBoost) * eventMult;
  state.coins += (1 + state.upgrades.coinBoost) * eventMult;
  state.combo = Math.min(state.combo + 1, 9);
  state.comboTimer = 26 + state.upgrades.magnet * 6;
  state.food = spawnFood(state.snake);
  state.speed = Math.max(70, state.speed - 1.2);

  if (!state.mission.byCombo && !state.mission.byScore && !state.mission.byDash) {
    state.missionProgress++;
  }
}

function tick() {
  if (state.over) return;
  state.ticks++;
  state.comboTimer = Math.max(0, state.comboTimer - 1);
  if (state.comboTimer === 0) state.combo = 1;
  if (state.dashCooldown > 0) state.dashCooldown--;

  state.event.timer--;
  if (state.event.timer <= 0) state.event = nextEvent();
  state.reverseControls = state.event.type === 'reverse';

  state.dir = { ...state.nextDir };
  const newHead = {
    x: (state.snake[0].x + state.dir.x + cells) % cells,
    y: (state.snake[0].y + state.dir.y + cells) % cells,
  };

  const hitSelf = state.snake.some((s, i) => i > 1 && s.x === newHead.x && s.y === newHead.y);
  if (hitSelf) {
    if (state.shields > 0) {
      state.shields--;
    } else {
      state.over = true;
      return;
    }
  }

  state.snake.unshift(newHead);
  const gotFood = newHead.x === state.food.x && newHead.y === state.food.y;

  if (gotFood) {
    consumeFood();
  } else {
    state.snake.pop();
  }

  if (state.mission.byCombo) state.missionProgress = Math.max(state.missionProgress, state.combo);
  if (state.mission.byScore) state.missionProgress = state.score;
  if (state.mission.byDash) state.missionProgress = state.dashesUsed;

  if (state.missionProgress >= state.mission.goal) {
    state.coins += state.mission.reward;
    state.mission = randomMission();
    state.missionProgress = 0;
  }

  state.level = 1 + Math.floor(state.score / 150);
  if (state.score > state.best) state.best = state.score;

  savePersistent();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = state.event.type === 'hyper' ? '#2a1830' : '#18152a';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = '#ffffff08';
        ctx.fillRect(x * grid, y * grid, grid, grid);
      }
    }
  }

  ctx.fillStyle = '#f34f6f';
  ctx.fillRect(state.food.x * grid + 3, state.food.y * grid + 3, grid - 6, grid - 6);

  state.snake.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? '#7fffb4' : '#44c488';
    ctx.fillRect(s.x * grid + 2, s.y * grid + 2, grid - 4, grid - 4);
  });

  if (state.over) {
    ctx.fillStyle = '#0008';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px Courier New';
    ctx.fillText('GAME OVER', 180, 300);
    ctx.font = '20px Courier New';
    ctx.fillText(`Счёт: ${state.score} | Нажми "Новый забег"`, 145, 340);
  }

  scoreEl.textContent = state.score;
  bestEl.textContent = state.best;
  comboEl.textContent = `x${state.combo}`;
  levelEl.textContent = state.level;
  coinsEl.textContent = state.coins;
  missionEl.textContent = `${state.mission.text} (${state.missionProgress}/${state.mission.goal})`;
  eventTextEl.textContent = `Событие: ${state.event.name}`;
}

let last = 0;
function loop(timestamp) {
  const activeSpeed = state.event.type === 'hyper' ? state.speed * 0.72 : state.speed;
  if (timestamp - last > activeSpeed) {
    tick();
    draw();
    last = timestamp;
  }
  requestAnimationFrame(loop);
}

state = createInitialState();
renderShop();
draw();
requestAnimationFrame(loop);
