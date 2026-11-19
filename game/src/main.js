// Solmar City — Harbor Heist: the game loop, state machine, missions,
// police chases, car stealing, combat wiring and saving. The city itself
// lives in city.js, the drawing in render.js, the story in missions.js.
import { WORLD, PLAYER, CAR_TYPES, POLICE_CAR, WANTED, SAVE_KEY, START_MONEY } from './config.js';
import { buildCity, districtAt } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { makeCar, spawnParkedCars, spawnTraffic, drivePlayerCar, updateTraffic, updatePoliceCar, hitsBuilding, carCorners } from './vehicles.js';
import { makePlayer, spawnPedestrians, updatePedestrians, makeFootCop, updateFootCops, addWanted, updateWanted, updatePlayerOnFoot } from './entities.js';
import { fireBullet, updateBullets, makeParticles, spawnBurst, spawnSmoke, updateParticles } from './combat.js';
import { MISSIONS, makeMissionState, currentMission, currentObjective, startMission, advanceMission } from './missions.js';
import { createCamera, drawCity, drawCar, drawPerson, drawBullet, drawParticles, drawHud, drawMenu, daylight } from './render.js';
import { makeRng, clamp, distance } from './random.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();

const game = {
  state: 'menu', // menu | playing | paused | busted | wasted | complete
  city: buildCity(),
  player: makePlayer(675, 2025),
  cars: [],
  traffic: [],
  policeCars: [],
  footCops: [],
  peds: [],
  rivals: [],
  bullets: [],
  particles: makeParticles(),
  mission: makeMissionState(),
  timeOfDay: 0.12, // morning sun
  elapsed: 0,
  fireCooldown: 0,
  crimeCooldown: 0,
  sirenTimer: 0,
  flash: false,
  flashTimer: 0,
  missionWait: 0,
  hasSave: false,
  shot: null,
};

function resetWorld(seed = 20261120) {
  const rng = makeRng(seed);
  game.city = buildCity(seed);
  game.player = makePlayer(675, 2025);
  game.player.money = START_MONEY;
  game.cars = spawnParkedCars(game.city, rng, 26);
  game.traffic = spawnTraffic(game.city, rng, 14);
  game.policeCars = [];
  game.footCops = [];
  game.peds = spawnPedestrians(game.city, rng, 36);
  game.rivals = [];
  game.bullets = [];
  game.particles = makeParticles();
  game.mission = makeMissionState();
  game.timeOfDay = 0.12;
  game.elapsed = 0;
  game.fireCooldown = 0;
  game.missionWait = 0;
}

function resize() {
  const w = Math.min(window.innerWidth, 1600);
  const h = Math.min(window.innerHeight, 1000);
  canvas.width = w;
  canvas.height = h;
  camera.resize(w, h);
}
const camera = createCamera(1280, 800);
window.addEventListener('resize', resize);
resize();

// ---- saving -------------------------------------------------------------
function saveGame() {
  try {
    const data = {
      money: game.player.money,
      health: game.player.health,
      missionsDone: game.mission.index,
      x: game.player.x, y: game.player.y,
      timeOfDay: game.timeOfDay,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    game.hasSave = true;
  } catch { /* storage unavailable — the game still plays */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function applyLoadedSave(data) {
  game.player.money = data.money ?? START_MONEY;
  game.player.health = data.health ?? PLAYER.maxHealth;
  game.player.x = data.x ?? 675;
  game.player.y = data.y ?? 2025;
  game.timeOfDay = data.timeOfDay ?? 0.12;
  game.mission.index = Math.min(data.missionsDone ?? 0, MISSIONS.length - 1);
  game.mission.active = false;
  game.missionWait = 2;
}
game.hasSave = !!loadSave();

// ---- police -------------------------------------------------------------
function nearestPoliceDistance() {
  let best = 99999;
  for (const c of game.policeCars) best = Math.min(best, distance(c.x, c.y, game.player.x, game.player.y));
  for (const c of game.footCops) best = Math.min(best, distance(c.x, c.y, game.player.x, game.player.y));
  return best;
}

function syncPolice(dt) {
  const want = WANTED[game.player.wanted].cops;
  const rng = Math.random;
  while (game.policeCars.length < want) {
    const a = rng() * Math.PI * 2;
    const x = clamp(game.player.x + Math.cos(a) * 700, 200, WORLD.width - 200);
    const y = clamp(game.player.y + Math.sin(a) * 700, 200, WORLD.height - 200);
    const car = makeCar(x, y, 0, POLICE_CAR, { driver: 'police', siren: true });
    game.policeCars.push(car);
  }
  while (game.policeCars.length > want) game.policeCars.pop();
  const footWant = game.player.wanted > 0 && !game.player.inCar ? Math.min(2, game.player.wanted) : 0;
  while (game.footCops.length < footWant) {
    const a = rng() * Math.PI * 2;
    game.footCops.push(makeFootCop(
      clamp(game.player.x + Math.cos(a) * 420, 200, WORLD.width - 200),
      clamp(game.player.y + Math.sin(a) * 420, 200, WORLD.height - 200)));
  }
  while (game.footCops.length > footWant) game.footCops.pop();
}

// ---- missions -----------------------------------------------------------
function beginMission(index) {
  const mission = startMission(game.mission, index);
  if (mission.startWanted) game.player.wanted = mission.startWanted;
  if (mission.rivals) spawnRivals(mission);
  if (mission.id === 6) spawnVaultCar();
  statusEl.textContent = 'Mission: ' + mission.title;
}

function spawnRivals(mission) {
  game.rivals = [];
  const t = mission.target;
  for (let i = 0; i < mission.rivals; i++) {
    game.rivals.push({
      x: t.x + (Math.random() - 0.5) * 320,
      y: t.y + (Math.random() - 0.5) * 320,
      angle: 0, radius: 12, health: 60, dead: false,
      color: '#7a1f1f', name: 'Viper', fireTimer: 1 + Math.random() * 2,
      owner: 'rival',
      hit(damage) { this.health -= damage; if (this.health <= 0) this.dead = true; },
    });
  }
}

function spawnVaultCar() {
  const vault = makeCar(2700, 200, 0, { name: 'Vault Comet', color: '#ffd166', top: 84, accel: 800, max: 540, grip: 3.9 }, { parked: true });
  vault.isVault = true;
  game.cars.push(vault);
}

function completeMission() {
  const result = advanceMission(game.mission);
  if (!result) return;
  const mission = result.mission;
  game.player.money += mission.reward;
  audio.missionDone();
  spawnBurst(game.particles, game.player.x, game.player.y, '#ffd166', 40, 220);
  game.mission.message = 'Job done: ' + mission.title + ' — paid $' + mission.reward.toLocaleString();
  game.mission.messageTimer = 5;
  saveGame();
  if (result.done && game.mission.index >= MISSIONS.length) {
    game.state = 'complete';
  } else {
    game.missionWait = 3.5;
  }
}

function failTimedMission() {
  const mission = currentMission(game.mission);
  game.mission.message = 'Too slow — ' + mission.title + ' failed. Try again from the start of the job.';
  game.mission.messageTimer = 5;
  game.mission.active = false;
  game.missionWait = 3;
  game.player.wanted = Math.max(0, game.player.wanted - 1);
}

function updateMission(dt) {
  const mission = currentMission(game.mission);
  if (!mission || !game.mission.active) return;
  const objective = currentObjective(game.mission);
  game.mission.timer += dt;
  if (objective.type === 'timed' && objective.timeLimit) {
    if (game.mission.timer > objective.timeLimit) { failTimedMission(); return; }
  }
  if (objective.type === 'loseheat') {
    if (game.player.wanted === 0) { completeMission(); return; }
  }
  if (objective.type === 'goto' || objective.type === 'timed' || objective.type === 'escort') {
    const target = objective.target;
    const who = game.mission.escort || game.player;
    if (target && distance(who.x, who.y, target.x, target.y) < objective.radius) {
      if (objective.type === 'escort' && game.mission.stage === 0) {
        game.mission.escort = { x: target.x + 30, y: target.y + 30, radius: 12, name: 'Juno', color: '#43aa8b', angle: 0, speed: 200 };
        game.mission.message = 'Juno: "Vex! I knew you would come. Get me to the Safehouse — fast."';
        game.mission.messageTimer = 5;
        advanceMission(game.mission);
        return;
      }
      completeMission();
      return;
    }
  }
  if (objective.type === 'steal') {
    const vault = game.cars.find((c) => c.isVault);
    if (vault && game.player.inCar === vault) {
      game.player.wanted = 4;
      game.mission.message = 'Sal: "You have the vault car. Every cop in Solmar is coming — RUN."';
      game.mission.messageTimer = 5;
      advanceMission(game.mission);
    }
  }
  // Escort companion trails the player.
  if (game.mission.escort) {
    const e = game.mission.escort;
    const d = distance(e.x, e.y, game.player.x, game.player.y);
    if (d > 60) {
      const a = Math.atan2(game.player.y - e.y, game.player.x - e.x);
      e.x += Math.cos(a) * 200 * dt;
      e.y += Math.sin(a) * 200 * dt;
      e.angle = a;
    }
  }
  // Rivals hunt the player and shoot.
  for (const r of game.rivals) {
    if (r.dead) continue;
    const d = distance(r.x, r.y, game.player.x, game.player.y);
    if (d < 520) {
      const a = Math.atan2(game.player.y - r.y, game.player.x - r.x);
      r.angle = a;
      if (d > 140) {
        const nx = r.x + Math.cos(a) * 130 * dt;
        const ny = r.y + Math.sin(a) * 130 * dt;
        if (!hitsBuilding(game.city, nx, ny, r.radius)) { r.x = nx; r.y = ny; }
        else r.angle += 1.2 * dt;
      }
      r.fireTimer -= dt;
      if (r.fireTimer <= 0) {
        const bullet = fireBullet(game.bullets, r.x, r.y, a + (Math.random() - 0.5) * 0.25, 'rival');
        bullet.damage = 16; // Viper pistols sting; they do not one-shot Vex.
        audio.shot();
        r.fireTimer = 1.4 + Math.random() * 0.8;
      }
    }
  }
  game.rivals = game.rivals.filter((r) => !r.dead);
}

// ---- entering / leaving cars --------------------------------------------
function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of [...game.cars, ...game.traffic]) {
    if (car.driver === 'traffic' && Math.abs(car.speed) > 60) continue;
    const d = distance(car.x, car.y, game.player.x, game.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  const wasParked = car.parked;
  const wasTraffic = car.driver === 'traffic';
  car.parked = false;
  car.driver = 'player';
  game.player.inCar = car;
  game.player.onFoot = false;
  game.player.x = car.x;
  game.player.y = car.y;
  game.cars = game.cars.filter((c) => c !== car);
  game.traffic = game.traffic.filter((c) => c !== car);
  if (wasParked || wasTraffic) {
    const copNear = nearestPoliceDistance() < 520;
    if (copNear || game.player.wanted > 0) addWanted(game.player, 1, 'car theft');
    else game.player.heat = 0.6;
  }
  audio.pickup();
}

function exitCar() {
  const car = game.player.inCar;
  if (!car) return;
  car.driver = null;
  car.parked = true;
  car.speed = 0;
  game.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  game.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  game.player.inCar = null;
  game.player.onFoot = true;
  game.cars.push(car);
}

// ---- combat wiring ------------------------------------------------------
function shootAt(worldX, worldY) {
  if (game.fireCooldown > 0 || game.player.inCar) return;
  game.fireCooldown = 0.24;
  const angle = Math.atan2(worldY - game.player.y, worldX - game.player.x);
  fireBullet(game.bullets, game.player.x, game.player.y, angle, 'player');
  audio.shot();
  spawnBurst(game.particles, game.player.x + Math.cos(angle) * 26, game.player.y + Math.sin(angle) * 26, '#ffe66d', 4, 120);
  const nearCop = nearestPoliceDistance() < 420;
  if (nearCop || game.player.wanted > 0) addWanted(game.player, 1, 'shooting');
}

function bulletTargets() {
  const targets = [];
  for (const car of [...game.cars, ...game.traffic, ...game.policeCars]) {
    targets.push({
      x: car.x, y: car.y, radius: 30, owner: car.driver || 'parked',
      hit(damage) {
        car.health -= damage;
        spawnBurst(game.particles, car.x, car.y, '#ffb703', 8, 140);
        if (car.health <= 0) explodeCar(car);
      },
    });
  }
  for (const ped of game.peds) {
    targets.push({
      x: ped.x, y: ped.y, radius: ped.radius, owner: 'ped',
      hit() { ped.fleeing = true; ped.x += (Math.random() - 0.5) * 40; ped.y += (Math.random() - 0.5) * 40; },
    });
  }
  for (const r of game.rivals) {
    if (!r.dead) targets.push({ x: r.x, y: r.y, radius: r.radius, owner: 'rival', hit: (d) => r.hit(d) });
  }
  for (const cop of game.footCops) {
    targets.push({
      x: cop.x, y: cop.y, radius: cop.radius, owner: 'police',
      hit(damage) { addWanted(game.player, 1, 'shooting a cop'); },
    });
  }
  targets.push({
    x: game.player.x, y: game.player.y, radius: game.player.radius, owner: 'player',
    hit(damage) {
      game.player.health -= damage;
      spawnBurst(game.particles, game.player.x, game.player.y, '#e63946', 6, 120);
    },
  });
  return targets;
}

function explodeCar(car) {
  spawnBurst(game.particles, car.x, car.y, '#ff7b00', 50, 320);
  spawnBurst(game.particles, car.x, car.y, '#555555', 30, 160);
  audio.crash();
  if (game.player.inCar === car) {
    game.player.health -= 35;
    exitCar();
  }
  game.cars = game.cars.filter((c) => c !== car);
  game.traffic = game.traffic.filter((c) => c !== car);
  game.policeCars = game.policeCars.filter((c) => c !== car);
  if (game.player.wanted < 2) addWanted(game.player, 1, 'explosion');
}

// ---- per-frame update ----------------------------------------------------
function update(dt) {
  game.elapsed += dt;
  game.timeOfDay = (game.timeOfDay + dt / 240) % 1;
  game.flashTimer += dt;
  if (game.flashTimer > 0.4) { game.flash = !game.flash; game.flashTimer = 0; }
  if (game.mission.messageTimer > 0) game.mission.messageTimer -= dt;
  game.fireCooldown = Math.max(0, game.fireCooldown - dt);
  game.crimeCooldown = Math.max(0, game.crimeCooldown - dt);

  // Start the next job a few seconds after the last one ended.
  if (!game.mission.active && game.mission.index < MISSIONS.length && game.missionWait > 0) {
    game.missionWait -= dt;
    if (game.missionWait <= 0) beginMission(game.mission.index);
  }

  const p = game.player;
  const mouse = input.mouse;
  const worldMouseX = camera.x + mouse.x;
  const worldMouseY = camera.y + mouse.y;

  // On foot or behind the wheel.
  if (p.inCar) {
    // Staged driving shots keep the throttle down so the car is moving.
    const carInput = (game.shot === 'drive' || game.shot === 'chase')
      ? { axis: () => ({ x: 0, y: -1 }), down: () => false, hit: () => false }
      : input;
    const moved = drivePlayerCar(p.inCar, carInput, dt, game.city);
    // Vex rides with the car: position, minimap dot and mission distances
    // all follow the car while she drives.
    p.x = p.inCar.x;
    p.y = p.inCar.y;
    audio.setEngine(Math.abs(p.inCar.speed) / p.inCar.type.max, moved);
    if (input.hit('KeyE')) exitCar();
  } else {
    audio.setEngine(0, false);
    updatePlayerOnFoot(p, input, dt, game.city, worldMouseX, worldMouseY);
    if (input.hit('KeyE')) {
      const car = nearestCar(70);
      if (car) enterCar(car);
    }
    if (mouse.clicked || mouse.down) shootAt(worldMouseX, worldMouseY);
  }

  // Traffic, pedestrians and the police.
  for (const car of game.traffic) updateTraffic(car, dt, game.city, game.traffic);
  updatePedestrians(game.peds, dt, game.city, p.inCar ? null : { x: p.x, y: p.y });
  syncPolice(dt);
  for (const cop of game.policeCars) updatePoliceCar(cop, dt, p, game.city);
  const nearestCop = updateFootCops(game.footCops, dt, p, game.city);
  updateWanted(p, dt, nearestPoliceDistance() < 620, !!p.inCar);

  // Sirens while wanted.
  if (p.wanted > 0) {
    game.sirenTimer -= dt;
    if (game.sirenTimer <= 0) { audio.siren(); game.sirenTimer = 1.1; }
  }

  // Car crashes: player car vs traffic, police and pedestrians.
  if (p.inCar) {
    const car = p.inCar;
    for (const other of [...game.traffic, ...game.policeCars, ...game.cars]) {
      if (other === car) continue;
      const d = distance(car.x, car.y, other.x, other.y);
      if (d < 52 && Math.abs(car.speed) > 200) {
        car.health -= 6;
        other.health -= 6;
        car.speed *= 0.45;
        spawnBurst(game.particles, car.x, car.y, '#ffb703', 14, 200);
        audio.crash();
        // A traffic bump is an accident, not a crime — only ramming a
        // police car draws heat, and only while the heat is already on.
        if (other.driver === 'police' && p.wanted > 0) addWanted(p, 1, 'ramming a cop car');
        if (car.health <= 0) explodeCar(car);
        if (other.health <= 0) explodeCar(other);
      }
    }
    for (const ped of game.peds) {
      if (distance(car.x, car.y, ped.x, ped.y) < 40 && Math.abs(car.speed) > 60) {
        ped.fleeing = true;
        ped.x += Math.cos(car.angle) * 60;
        ped.y += Math.sin(car.angle) * 60;
        // One witness report per incident: hitting pedestrians raises the
        // wanted level, but a single pile-up is one crime, not five.
        if (game.crimeCooldown <= 0) {
          addWanted(p, 1, 'hit a pedestrian');
          game.crimeCooldown = 5;
        }
        audio.crash();
        car.speed *= 0.8;
      }
    }
    if (car.smoke > 0.15 && Math.random() < dt * 8) spawnSmoke(game.particles, car.x, car.y);
  } else {
    // On foot: a police car that touches the player arrests them.
    for (const cop of game.policeCars) {
      if (distance(cop.x, cop.y, p.x, p.y) < 44) { bustPlayer(); return; }
    }
    const cop = game.footCops.find((c) => c.grabTimer > 1.6);
    if (cop) { bustPlayer(); return; }
  }

  // Bullets and particles.
  game.bullets = updateBullets(game.bullets, dt, game.city, bulletTargets());
  game.particles = updateParticles(game.particles, dt);

  // Slow health regen when the heat is off.
  if (p.wanted === 0 && p.health < PLAYER.maxHealth) p.health = Math.min(PLAYER.maxHealth, p.health + 2.5 * dt);

  updateMission(dt);

  if (p.health <= 0) {
    game.state = 'wasted';
    audio.busted();
    return;
  }
  camera.follow(p.inCar ? p.inCar.x : p.x, p.inCar ? p.inCar.y : p.y, dt);
}

function bustPlayer() {
  const p = game.player;
  p.money = Math.max(0, p.money - 300);
  p.wanted = 0;
  p.health = Math.max(40, p.health);
  if (p.inCar) { const car = p.inCar; car.driver = null; car.parked = true; game.cars.push(car); p.inCar = null; p.onFoot = true; }
  p.x = 675; p.y = 2025;
  game.policeCars = [];
  game.footCops = [];
  game.state = 'busted';
  audio.busted();
}

// ---- drawing -------------------------------------------------------------
function hudData() {
  const p = game.player;
  const objective = game.mission.active ? currentObjective(game.mission) : null;
  const hours = Math.floor(((game.timeOfDay + 0.3) % 1) * 24);
  const minutes = Math.floor((((game.timeOfDay + 0.3) % 1) * 24 % 1) * 60);
  const day = daylight(game.timeOfDay);
  return {
    player: p,
    city: game.city,
    policeCars: game.policeCars,
    missionTarget: objective ? objective.target : null,
    objectiveText: objective ? objective.objective : (game.mission.index >= MISSIONS.length ? 'Free roam — Solmar is yours' : 'Next job starting…'),
    messageText: game.mission.messageTimer > 0 ? game.mission.message : '',
    wantedLabel: WANTED[p.wanted].label,
    clockLabel: String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ' ' + day.label,
    districtName: districtAt(p.x, p.y).name,
    missionsDone: Math.min(game.mission.index, MISSIONS.length),
    hasSave: game.hasSave,
  };
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const day = drawCity(ctx, game.city, camera, game.timeOfDay);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  // Objective marker: a pulsing gold ring at the target.
  const objective = game.mission.active ? currentObjective(game.mission) : null;
  if (objective && objective.target) {
    const pulse = 1 + Math.sin(game.elapsed * 4) * 0.15;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(objective.target.x, objective.target.y, 46 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◆', objective.target.x, objective.target.y - 52);
    ctx.textAlign = 'left';
  }
  // Safehouse marker.
  ctx.fillStyle = '#43aa4b';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('⌂ SAFEHOUSE', 640, 1995);
  for (const car of [...game.cars, ...game.traffic]) drawCar(ctx, car, game.flash);
  for (const cop of game.policeCars) drawCar(ctx, cop, game.flash);
  for (const ped of game.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.fleeing ? '!' : null);
  for (const r of game.rivals) if (!r.dead) drawPerson(ctx, r.x, r.y, r.angle, r.color, 'VIPER');
  if (game.mission.escort) {
    const e = game.mission.escort;
    drawPerson(ctx, e.x, e.y, e.angle, e.color, 'JUNO');
  }
  const p = game.player;
  if (!p.inCar) drawPerson(ctx, p.x, p.y, p.inCar ? 0 : p.aimAngle, '#ffd166', 'VEX');
  else {
    // The player's car left game.cars when Vex got in, so draw it here.
    drawCar(ctx, p.inCar, game.flash);
  }
  for (const b of game.bullets) drawBullet(ctx, b);
  drawParticles(ctx, game.particles);
  ctx.restore();
  // Night tint and golden-hour wash over everything.
  if (day.dark > 0) {
    ctx.fillStyle = `rgba(8, 12, 40, ${day.dark})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (day.tint) {
    ctx.fillStyle = day.tint;
    ctx.fillRect(0, 0, w, h);
  }
  drawHud(ctx, w, h, hudData());
  if (game.state === 'menu') drawMenu(ctx, w, h, 'start', hudData());
  if (game.state === 'paused') drawMenu(ctx, w, h, 'pause', hudData());
  if (game.state === 'busted') drawMenu(ctx, w, h, 'busted', hudData());
  if (game.state === 'wasted') drawMenu(ctx, w, h, 'wasted', hudData());
  if (game.state === 'complete') drawMenu(ctx, w, h, 'complete', hudData());
}

// ---- menu and pause keys --------------------------------------------------
function handleMenuKeys() {
  if (game.state === 'menu') {
    if (input.hit('KeyN')) {
      // Fresh start: wipe the save and begin job one.
      audio.unlock();
      audio.startMusic();
      try { localStorage.removeItem(SAVE_KEY); } catch { /* no storage */ }
      game.hasSave = false;
      resetWorld();
      game.state = 'playing';
      beginMission(0);
      return;
    }
    if (input.hit('Enter')) {
      audio.unlock();
      audio.startMusic();
      if (game.hasSave) {
        // Continue: keep the saved money and job, drop Vex at the safehouse.
        const saved = loadSave();
        resetWorld();
        if (saved) applyLoadedSave(saved);
        game.player.x = 675;
        game.player.y = 2025;
        game.state = 'playing';
        game.missionWait = 2;
      } else {
        resetWorld();
        game.state = 'playing';
        beginMission(0);
      }
    }
    return;
  }
  if (game.state === 'playing' && input.hit('KeyP')) { game.state = 'paused'; return; }
  if (game.state === 'paused') {
    if (input.hit('KeyP')) game.state = 'playing';
    if (input.hit('KeyS')) { saveGame(); game.mission.message = 'Game saved.'; game.mission.messageTimer = 3; }
    if (input.hit('KeyR')) { resetWorld(); beginMission(game.mission.index); game.state = 'playing'; }
    if (input.hit('KeyQ')) { saveGame(); game.state = 'menu'; }
    return;
  }
  if ((game.state === 'busted' || game.state === 'wasted') && input.hit('Enter')) {
    game.player.health = PLAYER.maxHealth;
    game.state = 'playing';
    return;
  }
  if (game.state === 'complete' && input.hit('Enter')) {
    game.state = 'playing';
    return;
  }
}

// ---- main loop ------------------------------------------------------------
let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (input.hit('KeyM')) audio.setMuted(!audio.isMuted());
  handleMenuKeys();
  if (game.state === 'playing') update(dt);
  // Keep the camera centred on the player even in menus.
  if (game.state !== 'playing') {
    camera.follow(game.player.x, game.player.y, dt);
  }
  draw();
  input.endFrame();
  requestAnimationFrame(frame);
}

// ---- boot -----------------------------------------------------------------
resetWorld();
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  // Screenshot mode: stage a scene from the game's own code, then play —
  // except the start shot, which stays on the title menu.
  applyShot(game, shotName, { beginMission, saveGame });
  if (shotName !== 'start') game.state = 'playing';
} else if (game.hasSave) {
  // The menu offers Continue; the world below is the saved city's backdrop.
  const saved = loadSave();
  if (saved) applyLoadedSave(saved);
}
statusEl.textContent = 'Solmar City loaded. Press Enter to play.';
// A read-only handle for automated play-tests; the game never reads it.
window.__solmar = game;
requestAnimationFrame(frame);
