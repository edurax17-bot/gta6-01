// Rendering: a smooth camera that follows the player, the city drawn in
// warm sun-soaked colours, cars and people as readable top-down shapes,
// and a HUD with health, money, wanted stars, a live minimap and the
// current objective. Everything is drawn on one canvas.
import { WORLD, DISTRICTS, SEA, BEACH } from './config.js';
import { clamp } from './random.js';

export function createCamera(viewW, viewH) {
  return {
    x: 0, y: 0, viewW, viewH,
    zoom: 1,
    follow(tx, ty, dt) {
      const wantX = tx - this.viewW / 2;
      const wantY = ty - this.viewH / 2;
      const k = 1 - Math.pow(0.001, dt);
      this.x += (wantX - this.x) * k;
      this.y += (wantY - this.y) * k;
      this.x = clamp(this.x, -80, WORLD.width - this.viewW + 80);
      this.y = clamp(this.y, -80, WORLD.height - this.viewH + 80);
    },
    resize(w, h) { this.viewW = w; this.viewH = h; },
  };
}

// Time of day: 0..1 across a 4-minute day. Returns sky tint + darkness.
export function daylight(timeOfDay) {
  const sun = Math.sin(timeOfDay * Math.PI * 2);
  if (sun > 0.55) return { tint: 'rgba(255, 214, 130, 0.10)', dark: 0, label: 'Afternoon' };
  if (sun > 0.05) return { tint: 'rgba(255, 170, 90, 0.16)', dark: 0.06, label: 'Golden hour' };
  if (sun > -0.25) return { tint: 'rgba(90, 110, 200, 0.20)', dark: 0.22, label: 'Dusk' };
  return { tint: 'rgba(20, 30, 80, 0.30)', dark: 0.38, label: 'Night' };
}

export function drawCity(ctx, city, cam, time) {
  const day = daylight(time);
  // Ground: grass green, sand at the beach, blue sea on the west edge.
  ctx.fillStyle = '#5d7d4a';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = '#2f6f9f';
  ctx.fillRect(SEA.x, SEA.y, SEA.w, SEA.h);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(BEACH.x, BEACH.y, BEACH.w, BEACH.h);
  // District ground tints.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.globalAlpha = 1;
  }
  // Parks.
  for (const p of city.parks) {
    ctx.fillStyle = '#4a7c43';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Roads: dark asphalt with a pale centre line.
  ctx.fillStyle = '#33383f';
  for (const rx of city.roadsX) ctx.fillRect(rx - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.height);
  for (const ry of city.roadsY) ctx.fillRect(0, ry - WORLD.roadWidth / 2, WORLD.width, WORLD.roadWidth);
  ctx.fillStyle = '#c9b458';
  for (const rx of city.roadsX) ctx.fillRect(rx - 2, 0, 4, WORLD.height);
  for (const ry of city.roadsY) ctx.fillRect(0, ry - 2, WORLD.width, 4);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of city.roadsX) {
    for (const ry of city.roadsY) {
      for (let i = -2; i <= 2; i++) ctx.fillRect(rx + i * 12 - 4, ry - 30, 8, 60);
    }
  }
  // Docks and pier.
  ctx.fillStyle = '#7a5c38';
  for (const d of city.docks) ctx.fillRect(d.x, d.y, d.w, d.h);
  // Buildings: roof colour, darker edge, and a height shadow.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (b.height >= 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h / 2 - 14, 28, 28);
    }
  }
  // Trees.
  for (const t of city.trees) {
    ctx.fillStyle = '#2f6b2f';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7fb069';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  return day;
}

// A car seen from above: body, windshield, roof, headlights and, for
// police cars, a light bar that flashes red and blue.
export function drawCar(ctx, car, flash) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.length / 2 + 4, -car.width / 2 + 5, car.length, car.width);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 10);
  ctx.fill();
  ctx.fillStyle = '#1d3557';
  roundRect(ctx, -car.length * 0.18, -car.width / 2 + 6, car.length * 0.36, car.width - 12, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(car.length * 0.22, -car.width / 2 + 7, 10, car.width - 14);
  ctx.fillRect(-car.length * 0.32, -car.width / 2 + 7, 8, car.width - 14);
  // Headlights and tail lights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(car.length / 2 - 3, -car.width / 2 + 4, 4, 8);
  ctx.fillRect(car.length / 2 - 3, car.width / 2 - 12, 4, 8);
  ctx.fillStyle = '#ff2222';
  ctx.fillRect(-car.length / 2, -car.width / 2 + 4, 4, 8);
  ctx.fillRect(-car.length / 2, car.width / 2 - 12, 4, 8);
  if (car.siren) {
    ctx.fillStyle = flash ? '#ff2222' : '#2266ff';
    ctx.fillRect(-6, -car.width / 2 + 3, 12, 8);
    ctx.fillStyle = flash ? '#2266ff' : '#ff2222';
    ctx.fillRect(-6, car.width / 2 - 11, 12, 8);
  }
  if (car.smoke > 0.15) {
    ctx.fillStyle = 'rgba(80,80,80,0.7)';
    ctx.beginPath();
    ctx.arc(-car.length / 2 - 6, (Math.random() - 0.5) * 12, 5 + car.smoke * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPerson(ctx, x, y, angle, color, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(9, -4, 7, 3);
  ctx.fillRect(9, 1, 7, 3);
  ctx.restore();
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 18);
  }
}

export function drawBullet(ctx, b) {
  ctx.fillStyle = '#ffe66d';
  ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,109,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The HUD: health, cash, wanted stars, clock, mission objective, and the
// live minimap in the corner. All of it is drawn on the canvas so it shows
// up in every screenshot exactly as the player sees it.
export function drawHud(ctx, viewW, viewH, game) {
  const p = game.player;
  const pad = 16;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Health bar, top left.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, pad, pad, 240, 54, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('VEX', pad + 12, pad + 20);
  ctx.fillStyle = '#222';
  ctx.fillRect(pad + 12, pad + 28, 150, 12);
  ctx.fillStyle = p.health > 30 ? '#43aa4b' : '#e63946';
  ctx.fillRect(pad + 12, pad + 28, 150 * Math.max(0, p.health / 100), 12);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('$' + Math.floor(p.money).toLocaleString(), pad + 172, pad + 40);
  // Wanted stars, top right.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, viewW - 220, pad, 204, 46, 8); ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < p.wanted ? '#ffd166' : 'rgba(255,255,255,0.25)';
    drawStar(ctx, viewW - 200 + i * 36, pad + 26, 13);
  }
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(game.wantedLabel, viewW - 200, pad + 62);
  // Clock and district, under the stars.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, viewW - 220, pad + 70, 204, 30, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(game.clockLabel + '  ·  ' + game.districtName, viewW - 208, pad + 90);
  // Objective banner, top centre.
  if (game.objectiveText) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(game.objectiveText).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, (viewW - w) / 2, pad, w, 34, 8); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.fillText('◆ ' + game.objectiveText, viewW / 2, pad + 23);
    ctx.textAlign = 'left';
  }
  // Mission message ribbon.
  if (game.messageText) {
    ctx.font = '14px system-ui, sans-serif';
    const lines = wrapText(ctx, game.messageText, viewW - 320);
    const h = lines.length * 20 + 16;
    ctx.fillStyle = 'rgba(10,14,24,0.78)';
    roundRect(ctx, 160, viewH - h - 130, viewW - 320, h, 8); ctx.fill();
    ctx.fillStyle = '#ffe9c0';
    lines.forEach((line, i) => ctx.fillText(line, 176, viewH - h - 130 + 22 + i * 20));
  }
  // Controls reminder, bottom left.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, pad, viewH - 52, 330, 36, 8); ctx.fill();
  ctx.fillStyle = '#ddd';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD move/drive · E enter car · Click shoot · M mute · P pause', pad + 10, viewH - 30);
  drawMinimap(ctx, viewW, viewH, game);
  // Speed, when driving.
  if (p.inCar) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, pad, viewH - 108, 150, 44, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.24) + ' mph', pad + 14, viewH - 78);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(p.inCar.name, pad + 14, viewH - 116);
  }
}

export function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// The minimap: the whole city shrunk into the corner, with the player,
// police, mission target and safehouse as coloured dots.
export function drawMinimap(ctx, viewW, viewH, game) {
  const size = 190;
  const x0 = viewW - size - 16;
  const y0 = viewH - size - 16;
  const sx = size / WORLD.width;
  const sy = size / WORLD.height;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10); ctx.fill();
  ctx.fillStyle = '#3a5a3c';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2f6f9f';
  ctx.fillRect(x0, y0, 130 * sx, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  for (const rx of game.city.roadsX) {
    ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + size); ctx.stroke();
  }
  for (const ry of game.city.roadsY) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + size, y0 + ry * sy); ctx.stroke();
  }
  const dot = (x, y, color, r = 4) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x0 + x * sx, y0 + y * sy, r, 0, Math.PI * 2); ctx.fill();
  };
  if (game.missionTarget) dot(game.missionTarget.x, game.missionTarget.y, '#ffd166', 6);
  dot(675, 2025, '#43aa4b', 4); // safehouse
  for (const cop of game.policeCars) dot(cop.x, cop.y, '#4da3ff', 3);
  const p = game.player;
  dot(p.x, p.y, '#fff', 5);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('SOLMAR CITY', x0, y0 - 10);
}

// Full-screen menus: start, pause, busted, wasted and story complete.
export function drawMenu(ctx, viewW, viewH, kind, game) {
  ctx.fillStyle = 'rgba(8,12,22,0.82)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  if (kind === 'start') {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('SOLMAR CITY', viewW / 2, viewH / 2 - 130);
    ctx.fillStyle = '#ff7b54';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('— HARBOR HEIST —', viewW / 2, viewH / 2 - 88);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Lena "Vex" Marlowe owes the Harbor Crew $12,000. Six jobs. One city. No brakes.', viewW / 2, viewH / 2 - 48);
    ctx.fillStyle = '#ffd9a0';
    ctx.font = '15px system-ui, sans-serif';
    const lines = [
      'WASD / arrows — walk and drive   ·   SHIFT — run',
      'E — steal / enter a car, exit a car   ·   Mouse — aim, Click — shoot',
      'M — mute   ·   P — pause   ·   F5 — quick save (autosaves after every job)',
      game.hasSave ? 'ENTER — continue your saved game      N — start a new game' : 'ENTER — start a new game',
    ];
    lines.forEach((line, i) => ctx.fillText(line, viewW / 2, viewH / 2 + i * 26));
    ctx.fillStyle = '#9fb7d8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('An original game. Solmar City, its people and its story are invented — nothing is taken from any other game.', viewW / 2, viewH / 2 + 170);
  } else if (kind === 'pause') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 40);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('P — resume      S — save game      R — restart mission      Q — quit to menu', viewW / 2, viewH / 2 + 10);
    ctx.fillText('Jobs done: ' + game.missionsDone + ' / 6      Cash: $' + Math.floor(game.player.money), viewW / 2, viewH / 2 + 44);
  } else if (kind === 'busted') {
    ctx.fillStyle = '#4da3ff';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('BUSTED', viewW / 2, viewH / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('The Solmar PD took you in. Bail cost $300 — and the job goes on.', viewW / 2, viewH / 2 + 14);
    ctx.fillText('ENTER — back on the streets', viewW / 2, viewH / 2 + 48);
  } else if (kind === 'wasted') {
    ctx.fillStyle = '#e63946';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('WASTED', viewW / 2, viewH / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Vex went down in the streets of Solmar. The crew is waiting at the safehouse.', viewW / 2, viewH / 2 + 14);
    ctx.fillText('ENTER — respawn at the safehouse', viewW / 2, viewH / 2 + 48);
  } else if (kind === 'complete') {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('DEBT CLEARED', viewW / 2, viewH / 2 - 60);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('The vault car is home. Vex is free — and Solmar City is hers to keep.', viewW / 2, viewH / 2 - 16);
    ctx.fillText('Final cash: $' + Math.floor(game.player.money) + '      Jobs: 6 / 6', viewW / 2, viewH / 2 + 20);
    ctx.fillText('ENTER — keep playing free roam', viewW / 2, viewH / 2 + 56);
  }
  ctx.textAlign = 'left';
}

export function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
