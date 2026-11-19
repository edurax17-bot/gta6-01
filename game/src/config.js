// Solmar City — shared tuning and city layout constants.
// Everything here is original: a sun-soaked fictional coastal city on the
// Marlin Bay, built for a top-down open-world crime game.
export const WORLD = {
  width: 3600,
  height: 2600,
  roadGap: 450,      // distance between road centre lines
  roadWidth: 72,
  blockPad: 46,      // buildings stay this far inside a block
};

// Districts paint the map: name, bounds, palette and building flavour.
export const DISTRICTS = [
  { name: 'Downtown', x: 900, y: 300, w: 1350, h: 800, tall: true,
    roofs: ['#3d5a80', '#5b7fa6', '#7a6a9b', '#4a7c7a'], ground: '#2e3d33' },
  { name: 'Harbor', x: 2250, y: 300, w: 1350, h: 800, tall: false,
    roofs: ['#8a6d4b', '#6b7f8f', '#9b7b4f'], ground: '#3a3f45' },
  { name: 'Old Town', x: 0, y: 1100, w: 1350, h: 800, tall: false,
    roofs: ['#b08968', '#a47148', '#c08a5e', '#96684a'], ground: '#4a4438' },
  { name: 'Palm Beach', x: 1350, y: 1100, w: 900, h: 800, tall: false,
    roofs: ['#e8b4b8', '#f2d5a0', '#a8d8c8'], ground: '#e0c98f' },
  { name: 'Industrial', x: 2250, y: 1100, w: 1350, h: 800, tall: false,
    roofs: ['#6b7280', '#7a6a5e', '#5e6b7a'], ground: '#43484f' },
  { name: 'Suburbs', x: 0, y: 1900, w: 1800, h: 700, tall: false,
    roofs: ['#c96f4a', '#d9a05b', '#7ba05b', '#5b8fb0'], ground: '#4d6b43' },
  { name: 'Marina', x: 1800, y: 1900, w: 1800, h: 700, tall: false,
    roofs: ['#5b8fb0', '#e8e3d3', '#f2a65a'], ground: '#3f6b7a' },
];

// The sea laps the west edge and the south-west corner is a beach.
export const SEA = { x: 0, y: 0, w: 130, h: 2600 };
export const BEACH = { x: 130, y: 1750, w: 320, h: 850 };

export const PLAYER = {
  walkSpeed: 210,
  runSpeed: 320,
  radius: 13,
  maxHealth: 100,
};

export const CAR_TYPES = [
  { name: 'Marlin', color: '#e63946', top: 74, accel: 620, max: 420, grip: 3.4 },
  { name: 'Pelican', color: '#457b9d', top: 62, accel: 480, max: 330, grip: 3.0 },
  { name: 'Comet GT', color: '#f4a261', top: 84, accel: 760, max: 520, grip: 3.8 },
  { name: 'Dune Buggy', color: '#90be6d', top: 58, accel: 540, max: 350, grip: 2.6 },
  { name: 'Limo', color: '#2b2d42', top: 70, accel: 520, max: 380, grip: 3.2 },
  { name: 'Pickup', color: '#8d99ae', top: 64, accel: 560, max: 360, grip: 3.1 },
];

export const POLICE_CAR = { color: '#1d3557', accent: '#ffffff', top: 78, accel: 700, max: 470, grip: 3.6 };

// Wanted stars: what each level sends after the player.
export const WANTED = [
  { stars: 0, cops: 0, label: 'Clean' },
  { stars: 1, cops: 1, label: 'Suspect' },
  { stars: 2, cops: 2, label: 'Wanted' },
  { stars: 3, cops: 3, label: 'Fugitive' },
  { stars: 4, cops: 4, label: 'Most Wanted' },
  { stars: 5, cops: 6, label: 'City Lockdown' },
];

export const MISSION_REWARDS = [500, 900, 1400, 2000, 3200, 8000];
export const START_MONEY = 250;
export const SAVE_KEY = 'solmar-city-save-v1';
