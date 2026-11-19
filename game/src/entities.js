// People of Solmar City: the player on foot, pedestrians who stroll the
// sidewalks and flee from gunfire, and police officers who chase on foot.
import { PLAYER, WORLD } from './config.js';
import { clamp, distance, range, turnToward } from './random.js';
import { hitsBuilding } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: 0, radius: PLAYER.radius,
    health: PLAYER.maxHealth,
    money: 250,
    inCar: null,
    onFoot: true,
    speed: 0,
    running: false,
    aimAngle: 0,
    wanted: 0,
    wantedTimer: 0,
    heat: 0, // 0..1, how "hot" the player is right now
  };
}

export function updatePlayerOnFoot(player, input, dt, city, aimX, aimY) {
  const axis = input.axis();
  const len = Math.hypot(axis.x, axis.y) || 1;
  const running = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  player.running = running && (axis.x !== 0 || axis.y !== 0);
  const nx = player.x + (axis.x / len) * speed * dt * (axis.x || axis.y ? 1 : 0);
  const ny = player.y + (axis.y / len) * speed * dt * (axis.x || axis.y ? 1 : 0);
  if (!hitsBuilding(city, nx, player.y, player.radius)) player.x = clamp(nx, 150, WORLD.width - 30);
  if (!hitsBuilding(city, player.x, ny, player.radius)) player.y = clamp(ny, 30, WORLD.height - 30);
  player.speed = (axis.x || axis.y) ? speed : 0;
  if (axis.x || axis.y) player.angle = Math.atan2(axis.y, axis.x);
  player.aimAngle = Math.atan2(aimY - player.y, aimX - player.x);
  return player.speed > 0;
}

const PED_COLORS = ['#f4a261', '#e76f51', '#2a9d8f', '#e9c46a', '#9b5de5', '#ef476f', '#06d6a0'];
const PED_NAMES = ['Mara', 'Theo', 'June', 'Rafi', 'Ines', 'Kofi', 'Luz', 'Omar', 'Pia', 'Dario'];

export function spawnPedestrians(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const rx = city.roadsX[Math.floor(rng() * city.roadsX.length)];
    const ry = city.roadsY[Math.floor(rng() * city.roadsY.length)];
    peds.push({
      x: rx + range(rng, -120, 120),
      y: ry + range(rng, -120, 120),
      angle: rng() * Math.PI * 2,
      speed: range(rng, 35, 70),
      color: PED_COLORS[i % PED_COLORS.length],
      name: PED_NAMES[i % PED_NAMES.length],
      fleeing: false,
      state: 'walk',
      wait: 0,
      radius: 11,
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, city, danger) {
  for (const p of peds) {
    const d = danger ? distance(p.x, p.y, danger.x, danger.y) : 9999;
    p.fleeing = d < 260;
    if (p.fleeing) {
      p.state = 'flee';
      const away = Math.atan2(p.y - danger.y, p.x - danger.x);
      p.angle = turnToward(p.angle, away, 4 * dt);
      const nx = p.x + Math.cos(p.angle) * 150 * dt;
      const ny = p.y + Math.sin(p.angle) * 150 * dt;
      if (!hitsBuilding(city, nx, ny, p.radius)) { p.x = nx; p.y = ny; }
    } else if (p.wait > 0) {
      p.wait -= dt;
      p.state = 'idle';
    } else {
      p.state = 'walk';
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      if (hitsBuilding(city, p.x, p.y, p.radius) || p.x < 160 || p.y < 40 ||
          p.x > WORLD.width - 40 || p.y > WORLD.height - 40) {
        p.angle += Math.PI * (0.5 + Math.random() * 0.5);
        p.wait = 0.4 + Math.random() * 1.2;
      }
      if (Math.random() < dt * 0.05) p.angle += (Math.random() - 0.5) * 1.6;
    }
  }
}

// Foot police: spawn at the city edge, run at the player, and arrest them
// if they stay in reach — the "busted" end of a chase on foot.
export function makeFootCop(x, y) {
  return { x, y, angle: 0, speed: 235, radius: 12, grabTimer: 0 };
}

export function updateFootCops(cops, dt, player, city) {
  let nearest = 99999;
  for (const cop of cops) {
    const d = distance(cop.x, cop.y, player.x, player.y);
    nearest = Math.min(nearest, d);
    cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (!hitsBuilding(city, nx, ny, cop.radius)) { cop.x = nx; cop.y = ny; }
    if (d < 30) cop.grabTimer += dt;
    else cop.grabTimer = Math.max(0, cop.grabTimer - dt);
  }
  return nearest;
}

// Wanted level bookkeeping: crimes raise it, staying unseen lowers it,
// and the level decides how many police cars are on the hunt.
export function addWanted(player, stars, reason) {
  const before = player.wanted;
  player.wanted = Math.min(5, player.wanted + stars);
  player.wantedTimer = 0;
  player.heat = 1;
  return { before, after: player.wanted, reason };
}

export function updateWanted(player, dt, policeNear, inCar) {
  if (player.wanted === 0) { player.heat = Math.max(0, player.heat - dt * 0.2); return; }
  if (policeNear) {
    player.wantedTimer = 0;
    player.heat = 1;
  } else {
    player.wantedTimer += dt;
    player.heat = Math.max(0, 1 - player.wantedTimer / 18);
    // Lay low long enough and the heat dies down one star at a time.
    const coolTime = inCar ? 26 : 18;
    if (player.wantedTimer > coolTime) {
      player.wanted -= 1;
      player.wantedTimer = 0;
    }
  }
}
