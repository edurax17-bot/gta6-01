// Cars: arcade driving physics, traffic AI that follows the road grid,
// parked cars to steal, and police interceptors that chase the player.
import { CAR_TYPES, POLICE_CAR, WORLD } from './config.js';
import { clamp, distance, turnToward } from './random.js';
import { nearestRoad, onRoad } from './city.js';

export function makeCar(x, y, angle, type, opts = {}) {
  return {
    x, y, angle, speed: 0,
    type,
    name: type.name,
    color: type.color,
    width: 44, length: 76,
    driver: opts.driver || null,      // 'player' | 'traffic' | 'police' | null
    parked: !!opts.parked,
    health: 100,
    smoke: 0,
    siren: !!opts.siren,
    home: { x, y },
    // Traffic state: which road the car follows and which way it drives.
    roadAxis: opts.roadAxis || 'x',
    roadLine: opts.roadLine || y,
    dir: opts.dir || 1,
    stuck: 0,
  };
}

export function spawnParkedCars(city, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 40) {
    guard += 1;
    const rx = city.roadsX[Math.floor(rng() * city.roadsX.length)];
    const ry = city.roadsY[Math.floor(rng() * city.roadsY.length)];
    const alongX = rng() < 0.5;
    const x = alongX ? rx + (rng() - 0.5) * 320 : rx + (rng() < 0.5 ? -26 : 26);
    const y = alongX ? ry + (rng() < 0.5 ? -26 : 26) : ry + (rng() - 0.5) * 320;
    if (x < 200 || y < 200 || x > WORLD.width - 100 || y > WORLD.height - 100) continue;
    if (cars.some((c) => distance(c.x, c.y, x, y) < 120)) continue;
    const type = CAR_TYPES[Math.floor(rng() * CAR_TYPES.length)];
    cars.push(makeCar(x, y, alongX ? 0 : Math.PI / 2, type, { parked: true }));
  }
  return cars;
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const rx = city.roadsX[Math.floor(rng() * city.roadsX.length)];
    const ry = city.roadsY[Math.floor(rng() * city.roadsY.length)];
    const alongX = rng() < 0.5;
    const type = CAR_TYPES[Math.floor(rng() * CAR_TYPES.length)];
    const car = makeCar(
      alongX ? rx + (rng() - 0.5) * 300 : rx,
      alongX ? ry : ry + (rng() - 0.5) * 300,
      alongX ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      type,
      { driver: 'traffic', roadAxis: alongX ? 'x' : 'y', roadLine: alongX ? ry : rx, dir: rng() < 0.5 ? 1 : -1 },
    );
    car.speed = 90 + rng() * 60;
    cars.push(car);
  }
  return cars;
}

// Drive a player-controlled car: forward/reverse throttle, steering that
// weakens at speed, off-road drag, and building collisions that bounce.
export function drivePlayerCar(car, input, dt, city) {
  const axis = input.axis();
  const throttle = -axis.y; // W is forward
  const steer = axis.x;
  const maxSpeed = car.type.max;
  car.speed += throttle * car.type.accel * dt;
  car.speed -= car.speed * 0.55 * dt; // rolling drag
  if (!onRoad(city, car.x, car.y)) car.speed -= car.speed * 1.1 * dt;
  car.speed = clamp(car.speed, -maxSpeed * 0.45, maxSpeed);
  const steerPower = steer * car.type.grip * dt * clamp(Math.abs(car.speed) / 120, 0.25, 1);
  car.angle += steerPower * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Move each axis on its own so the car slides along a building face
  // instead of stopping dead nose-first into a corner. Only a head-on
  // block on both axes bounces the car back.
  const xBlocked = hitsBuilding(city, nx, car.y, 22);
  const yBlocked = hitsBuilding(city, car.x, ny, 22);
  if (!xBlocked) car.x = nx;
  if (!yBlocked) car.y = ny;
  if (xBlocked && yBlocked) car.speed *= -0.25;
  if (car.health < 40) car.smoke = Math.min(1, car.smoke + dt);
  return Math.abs(car.speed) > 20;
}

// Traffic cars cruise their road, slow for the car ahead, and turn at
// intersections onto a new road.
export function updateTraffic(car, dt, city, others) {
  const targetSpeed = 110;
  car.speed += (targetSpeed - car.speed) * 0.5 * dt;
  const ahead = others.find((o) => o !== car && o.driver === 'traffic' &&
    distance(o.x, o.y, car.x, car.y) < 110 &&
    Math.abs(((Math.atan2(o.y - car.y, o.x - car.x) - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.6);
  if (ahead) car.speed = Math.max(0, car.speed - 260 * dt);
  const lane = 18;
  let tx;
  let ty;
  if (car.roadAxis === 'x') { tx = car.x + car.dir * 100; ty = car.roadLine + (car.dir > 0 ? lane : -lane); }
  else { tx = car.roadLine + (car.dir > 0 ? -lane : lane); ty = car.y + car.dir * 100; }
  const want = Math.atan2(ty - car.y, tx - car.x);
  car.angle = turnToward(car.angle, want, 1.6 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Reached the edge of the city: wrap to the opposite side.
  if (car.x < 150 || car.x > WORLD.width - 100 || car.y < 150 || car.y > WORLD.height - 100) {
    const near = nearestRoad(city, WORLD.width / 2, WORLD.height / 2);
    car.x = near.x; car.y = near.y;
  }
  // At an intersection, sometimes turn onto the crossing road.
  if (onRoad(city, car.x, car.y) && Math.random() < dt * 0.12) {
    const near = nearestRoad(city, car.x, car.y);
    if (car.roadAxis === 'x' && Math.abs(car.y - near.y) < 40) {
      car.roadAxis = 'y'; car.roadLine = near.x; car.dir = Math.random() < 0.5 ? 1 : -1;
    } else if (car.roadAxis === 'y' && Math.abs(car.x - near.x) < 40) {
      car.roadAxis = 'x'; car.roadLine = near.y; car.dir = Math.random() < 0.5 ? 1 : -1;
    }
  }
}

// Police interceptors: steer toward the player, ram on contact, and give
// up if the player stays far away for a long time.
export function updatePoliceCar(car, dt, player, city) {
  const want = Math.atan2(player.y - car.y, player.x - car.x);
  car.angle = turnToward(car.angle, want, 2.6 * dt);
  const dist = distance(car.x, car.y, player.x, player.y);
  const target = dist > 700 ? POLICE_CAR.max : POLICE_CAR.max * 0.92;
  car.speed += (target - car.speed) * 0.8 * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!hitsBuilding(city, nx, ny, 22)) { car.x = nx; car.y = ny; }
  else { car.speed *= 0.4; car.angle += 0.6 * dt; }
  return dist;
}

export function hitsBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    if (x > b.x - radius && x < b.x + b.w + radius && y > b.y - radius && y < b.y + b.h + radius) return true;
  }
  if (x < 140 || x > WORLD.width - 20 || y < 20 || y > WORLD.height - 20) return true;
  return false;
}

export function carCorners(car) {
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const hl = car.length / 2;
  const hw = car.width / 2;
  return [
    { x: car.x + c * hl - s * hw, y: car.y + s * hl + c * hw },
    { x: car.x + c * hl + s * hw, y: car.y + s * hl - c * hw },
    { x: car.x - c * hl + s * hw, y: car.y - s * hl - c * hw },
    { x: car.x - c * hl - s * hw, y: car.y - s * hl + c * hw },
  ];
}
