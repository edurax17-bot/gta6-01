// The story of Solmar City: Lena "Vex" Marlowe, a getaway driver who owes
// the Harbor Crew one last debt. Six jobs, each with a briefing, an
// objective marker and a payout. All characters and places are original.
import { MISSION_REWARDS } from './config.js';

export const STORY = {
  hero: 'Lena "Vex" Marlowe',
  fixer: 'Salvatore "Sal" Bianchi',
  crew: 'the Harbor Crew',
  debt: 12000,
};

export const MISSIONS = [
  {
    id: 1, title: 'First Gear', reward: MISSION_REWARDS[0],
    brief: 'Sal: "Vex, you are back in Solmar. Prove the hands still work. Get to the City Garage."',
    objective: 'Drive to the City Garage',
    type: 'goto', target: { x: 1125, y: 1575 }, radius: 90,
    hint: 'Press E near a parked car to take it. WASD to drive.',
  },
  {
    id: 2, title: 'The Pickup', reward: MISSION_REWARDS[1],
    brief: 'Sal: "A package waits at the Harbor Market. Pick it up, then drop it at the Marina. No cops, no fuss."',
    objective: 'Pick up the package at Harbor Market',
    type: 'goto', target: { x: 2700, y: 675 }, radius: 90,
    next: { objective: 'Deliver the package to the Marina', type: 'goto', target: { x: 2925, y: 2475 }, radius: 90 },
    hint: 'Follow the gold marker on the map and the arrow at the screen edge.',
  },
  {
    id: 3, title: 'Heat Wave', reward: MISSION_REWARDS[2],
    brief: 'Sal: "The crew lifted a Comet GT and the whole city saw it. Lose the heat — two stars, then vanish."',
    objective: 'Lose the 2-star wanted level',
    type: 'loseheat', target: null, radius: 0,
    startWanted: 2,
    hint: 'Break line of sight: duck down side streets and stay away from blue lights.',
  },
  {
    id: 4, title: 'Harbor Run', reward: MISSION_REWARDS[3],
    brief: 'Sal: "Cargo at the docks, buyer at Palm Beach. Sixty seconds, Vex. The clock is already running."',
    objective: 'Reach the Palm Beach Pier in time',
    type: 'timed', target: { x: 450, y: 2025 }, radius: 100, timeLimit: 75,
    hint: 'Cut across the grid — straight lines beat main roads.',
  },
  {
    id: 5, title: 'The Informant', reward: MISSION_REWARDS[4],
    brief: 'Sal: "Our informant Juno is pinned down in Old Town by the Rust Vipers. Get her out — on foot, and loud if you must."',
    objective: 'Reach Juno in Old Town, then escort her to the Safehouse',
    type: 'escort', target: { x: 675, y: 1350 }, radius: 80,
    next: { objective: 'Escort Juno to the Safehouse', type: 'goto', target: { x: 675, y: 2025 }, radius: 90 },
    rivals: 4,
    hint: 'Click to shoot. The Vipers carry pistols — use parked cars as cover.',
  },
  {
    id: 6, title: 'The Harbor Heist', reward: MISSION_REWARDS[5],
    brief: 'Sal: "Last job, Vex. The vault car sits at the Harbor docks. Take it, outrun everything, bring it home. Debt cleared."',
    objective: 'Steal the vault car at the Harbor docks',
    type: 'steal', target: { x: 2700, y: 200 }, radius: 90,
    next: { objective: 'Escape the 4-star chase — reach the Safehouse', type: 'goto', target: { x: 675, y: 2025 }, radius: 90 },
    startWanted: 4,
    hint: 'Once you take the car, every cop in Solmar is coming. Do not stop.',
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

export function makeMissionState() {
  return {
    index: 0,            // 0-based into MISSIONS; 6 means story complete
    stage: 0,            // 0 = first leg, 1 = follow-up leg
    active: false,
    timer: 0,
    message: '',
    messageTimer: 0,
    rivals: [],
    escort: null,
  };
}

export function currentMission(state) {
  if (state.index >= MISSIONS.length) return null;
  return MISSIONS[state.index];
}

export function currentObjective(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  if (state.stage === 1 && mission.next) return mission.next;
  return mission;
}

export function startMission(state, index) {
  state.index = index;
  state.stage = 0;
  state.active = true;
  state.timer = 0;
  const mission = MISSIONS[index];
  state.message = mission.brief;
  state.messageTimer = 6;
  return mission;
}

export function advanceMission(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  if (state.stage === 0 && mission.next) {
    state.stage = 1;
    state.message = mission.next.objective;
    state.messageTimer = 4;
    return { done: false, mission };
  }
  state.index += 1;
  state.stage = 0;
  state.active = false;
  state.rivals = [];
  state.escort = null;
  return { done: true, mission };
}
