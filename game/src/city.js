// Solmar City map: roads on a grid, buildings inside the blocks, parks,
// the harbor docks and the beach. Generated once from a fixed seed so the
// city is identical every time the game loads.
import { WORLD, DISTRICTS, SEA, BEACH } from './config.js';
import { makeRng, pick, range, rangeInt } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

export function buildCity(seed = 20261120) {
  const rng = makeRng(seed);
  const roadsX = [];
  const roadsY = [];
  for (let x = 225; x < WORLD.width; x += WORLD.roadGap) roadsX.push(x);
  for (let y = 225; y < WORLD.height; y += WORLD.roadGap) roadsY.push(y);

  const buildings = [];
  const parks = [];
  const trees = [];
  // One building (or a park) per block between four roads.
  for (let ix = 0; ix < roadsX.length - 1; ix++) {
    for (let iy = 0; iy < roadsY.length - 1; iy++) {
      const x0 = roadsX[ix] + WORLD.roadWidth / 2 + WORLD.blockPad;
      const y0 = roadsY[iy] + WORLD.roadWidth / 2 + WORLD.blockPad;
      const x1 = roadsX[ix + 1] - WORLD.roadWidth / 2 - WORLD.blockPad;
      const y1 = roadsY[iy + 1] - WORLD.roadWidth / 2 - WORLD.blockPad;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      if (x0 < SEA.w + 40) continue; // keep the sea edge clear
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      if (rng() < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, district: district.name });
        for (let t = 0; t < 5; t++) {
          trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 9, 15) });
        }
        continue;
      }
      const tall = district.tall && rng() < 0.5;
      buildings.push({
        x: x0, y: y0, w: x1 - x0, h: y1 - y0,
        color: pick(rng, district.roofs),
        height: tall ? rangeInt(rng, 3, 6) : rangeInt(rng, 1, 2),
        district: district.name,
      });
    }
  }

  // Harbor docks along the north-east water, and the pier at the beach.
  const docks = [
    { x: 2400, y: 60, w: 900, h: 26 },
    { x: 2400, y: 120, w: 700, h: 26 },
    { x: 300, y: 2450, w: 420, h: 26 },
  ];
  const landmarks = [
    { name: 'Solmar Tower', x: 1125, y: 675, kind: 'tower' },
    { name: 'Marlin Bay Bridge', x: 1800, y: 225, kind: 'bridge' },
    { name: 'Harbor Market', x: 2700, y: 675, kind: 'market' },
    { name: 'Palm Beach Pier', x: 320, y: 2100, kind: 'pier' },
    { name: 'Safehouse', x: 675, y: 2025, kind: 'safehouse' },
    { name: 'City Garage', x: 1125, y: 1575, kind: 'garage' },
  ];

  return { roadsX, roadsY, buildings, parks, trees, docks, landmarks, seed };
}

// True when a point sits on a road (used by traffic and the player).
export function onRoad(city, x, y) {
  const half = WORLD.roadWidth / 2 + 6;
  for (const rx of city.roadsX) if (Math.abs(x - rx) < half) return true;
  for (const ry of city.roadsY) if (Math.abs(y - ry) < half) return true;
  return false;
}

// Nearest road centre line, used to snap traffic cars onto lanes.
export function nearestRoad(city, x, y) {
  let bestX = city.roadsX[0];
  let bestY = city.roadsY[0];
  for (const rx of city.roadsX) if (Math.abs(x - rx) < Math.abs(x - bestX)) bestX = rx;
  for (const ry of city.roadsY) if (Math.abs(y - ry) < Math.abs(y - bestY)) bestY = ry;
  return { x: bestX, y: bestY };
}
