// Screenshot staging: ?shot=start|drive|chase|mission sets the game up
// from its own live systems — same city, same cars, same police — so each
// screenshot is a real render of the game, not a posed picture.
// Usage: game/index.html?shot=drive
import { makeCar } from './vehicles.js';
import { POLICE_CAR } from './config.js';
import { addWanted } from './entities.js';

function putPlayerInCar(game, x, y, typeIndex = 2) {
  const car = game.cars.find((c) => c.x > x - 200 && c.x < x + 200) || game.cars[0];
  car.x = x; car.y = y; car.angle = 0; car.speed = 320; car.parked = false;
  car.driver = 'player';
  game.player.inCar = car;
  game.player.onFoot = false;
  game.player.x = x; game.player.y = y;
  game.cars = game.cars.filter((c) => c !== car);
  return car;
}

function addPoliceChase(game, count) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const car = makeCar(
      game.player.x + Math.cos(a) * 430,
      game.player.y + Math.sin(a) * 430,
      Math.atan2(game.player.y - (game.player.y + Math.sin(a) * 320), game.player.x - (game.player.x + Math.cos(a) * 320)),
      POLICE_CAR, { driver: 'police', siren: true });
    car.speed = 380;
    game.policeCars.push(car);
  }
}

export function applyShot(game, name, hooks) {
  const p = game.player;
  game.shot = name; // the loop auto-drives for the driving shots
  if (name === 'start') {
    // Title screen over the morning city.
    game.state = 'menu';
    return;
  }
  if (name === 'drive') {
    putPlayerInCar(game, 1125, 1125);
    p.money = 1250;
    game.timeOfDay = 0.12;
    hooks.beginMission(0);
    game.mission.message = '';
    game.mission.messageTimer = 0;
    return;
  }
  if (name === 'chase') {
    putPlayerInCar(game, 2025, 1125);
    p.money = 3400;
    addWanted(p, 3, 'screenshot chase');
    addPoliceChase(game, 3);
    game.timeOfDay = 0.62; // golden hour, long shadows
    game.mission.active = true;
    game.mission.index = 2;
    game.mission.message = 'Sal: "Lose the heat — two stars, then vanish."';
    game.mission.messageTimer = 8;
    return;
  }
  if (name === 'mission') {
    // On foot in Old Town, Juno beside Vex, Vipers closing in.
    p.x = 675; p.y = 1250; p.health = 100; p.money = 5600;
    game.timeOfDay = 0.3;
    hooks.beginMission(4);
    for (const r of game.rivals) r.fireTimer = 3.5;
    game.mission.escort = { x: 705, y: 1380, radius: 12, name: 'Juno', color: '#43aa8b', angle: 0, speed: 200 };
    game.mission.stage = 1;
    game.mission.message = 'Juno: "Vex! Get me to the Safehouse — fast."';
    game.mission.messageTimer = 8;
    return;
  }
  // Unknown shot name: just play the game.
  game.state = 'playing';
}
