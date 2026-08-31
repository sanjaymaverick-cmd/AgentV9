import { Mission, MissionPathChoice, PlayerStats } from '../types/game';

export const STORY_MISSION_MIDNIGHT_PROTOTYPE: Mission = {
  id: 'mission_midnight_prototype',
  title: 'The Midnight Prototype',
  description: 'An experimental zero-gravity energy core vanished from the Technology Museum! Investigate the scene, track the CHAOS drone, and recover the prototype using Speed, Stealth, or Smarts.',
  category: 'story',
  steps: [
    {
      id: 'step_1_travel',
      title: 'Investigate Technology Museum',
      instruction: 'Ride V9 across the city to the Technology Museum north of the plaza.',
      targetPosition: [0, 1, -80],
      approachHint: {
        speed: 'Hit the street ramps and boost along the central boulevard!',
        stealth: 'Take the quiet side-streets in silent electric mode.',
        smarts: 'Scan shortcut tunnels on your minimap GPS route.',
      },
      completed: false,
    },
    {
      id: 'step_2_scan_dock',
      title: 'Scan the Loading Dock',
      instruction: 'Enter the museum and scan the staff loading room for the CHAOS breach.',
      targetPosition: [0, 1, -94],
      approachHint: {
        speed: 'Boost the east vent ramp and jump in through the wall hole — or smash the north dock if the laser is down!',
        stealth: 'Grab a tech/scientist disguise and walk through the glowing staff door.',
        smarts: 'Hack the exhibit-hall terminal to drop the laser and the staff door.',
      },
      completed: false,
    },
    {
      id: 'step_3_chase_drone',
      title: 'Pursue the CHAOS Transport Drone',
      instruction: 'A suspicious heavy transport drone is escaping toward the Monorail Station! Stay close to track its signal.',
      targetPosition: [50, 6, -30],
      approachHint: {
        speed: 'Use Nitro boost and jump the monorail ramp to intercept it!',
        stealth: 'Keep distance and track its shadow without triggering red alert.',
        smarts: 'Fire an EMP Tagger shot to slow the drone down by 40%.',
      },
      completed: false,
    },
    {
      id: 'step_4_infiltrate_station',
      title: 'Infiltrate the Cargo Station (Choose Your Path)',
      instruction: 'Breach the station warehouse where CHAOS is loading the prototype.',
      targetPosition: [85, 2, 25],
      approachHint: {
        speed: 'SPEED: Jump the big orange ramp directly onto the elevated monorail rail!',
        stealth: 'STEALTH: Put on the Maintenance Tech disguise from the locker and slip through the side vent.',
        smarts: 'SMARTS: Hack the Gantry Crane Terminal to raise the gate, or EMP the side breaker.',
      },
      completed: false,
    },
    {
      id: 'step_5_boss_drone',
      title: 'Final Event: Giant Cargo Drone Interception',
      instruction: 'CHAOS launched the Giant Cargo Drone! Race V9 underneath it and disable all 3 EMP relays with your EMP gadget!',
      targetPosition: [40, 7, 70],
      approachHint: {
        speed: 'Match the giant drone\'s top speed on the main highway straight!',
        stealth: 'Dodge the searchlight beams to stay under the drone\'s blindspot.',
        smarts: 'Tag all 3 glowing blue relays with EMP pulses to safely land the drone.',
      },
      completed: false,
    },
  ],
  currentStepIndex: 0,
  rewardXP: 1200,
  rewardCredits: 500,
  unlockedReward: 'Holographic Cyber Paint & Super Jump Springs',
  active: true,
  completed: false,
};

export const SIDE_MISSIONS: Mission[] = [
  {
    id: 'side_race_downtown',
    title: 'Velocity City Checkpoint Sprint',
    description: 'Race through 8 neon checkpoints across downtown rooftops and street ramps under 45 seconds.',
    category: 'side_race',
    steps: [
      {
        id: 'race_sprint',
        title: 'Complete Circuit',
        instruction: 'Hit all checkpoints in order before time runs out!',
        targetPosition: [18, 1, 0],
        approachHint: {
          speed: 'Maintain drift boost around corners and hit all orange jump ramps!',
          stealth: 'N/A',
          smarts: 'Find the shortcut alley near the Cyber Bites skyscraper.',
        },
        completed: false,
      },
    ],
    currentStepIndex: 0,
    rewardXP: 450,
    rewardCredits: 200,
    unlockedReward: 'Neon Pink Underglow',
    active: false,
    completed: false,
  },
  {
    id: 'side_drone_tag',
    title: 'CHAOS Drone Tagger Challenge',
    description: '4 rogue delivery drones are causing traffic chaos. Use your EMP or Foam Blaster to tag them.',
    category: 'chase',
    steps: [
      {
        id: 'tag_drones',
        title: 'Tag 4 Rogue Drones',
        instruction: 'Locate and EMP-tag the rogue drones flying above the plaza.',
        targetPosition: [0, 8, 0],
        approachHint: {
          speed: 'Jump off ramps to tag high-flying drones in mid-air!',
          stealth: 'Sneak close on foot before firing foam to prevent them from fleeing.',
          smarts: 'Deploy your Mini Drone to hack their flight controllers remotely.',
        },
        completed: false,
      },
    ],
    currentStepIndex: 0,
    rewardXP: 500,
    rewardCredits: 250,
    unlockedReward: 'Foam Cannon Capacity Upgrade',
    active: false,
    completed: false,
  },
];

export function calculateRank(xp: number): PlayerStats['rank'] {
  if (xp >= 3000) return 'V9 Agent';
  if (xp >= 2200) return 'Elite Agent';
  if (xp >= 1600) return 'Special Agent';
  if (xp >= 1000) return 'Field Agent';
  if (xp >= 500) return 'Investigator';
  if (xp >= 200) return 'Explorer';
  return 'Rookie';
}

/** Deep copy so tests / debug jumps don't mutate the module-level story template. */
export function cloneMission(mission: Mission): Mission {
  return {
    ...mission,
    steps: mission.steps.map((s) => ({
      ...s,
      approachHint: { ...s.approachHint },
      targetPosition: [...s.targetPosition] as [number, number, number],
    })),
  };
}

/**
 * Mark one objective done and walk the cursor forward. Returns false if that step
 * is missing or already completed (MissionRunner.checkStep is a no-op in that case).
 */
export function applyStepComplete(mission: Mission, stepId: string, path: MissionPathChoice): boolean {
  const step = mission.steps.find((s) => s.id === stepId);
  if (!step || step.completed) return false;
  step.completed = true;
  mission.chosenPath = path;
  mission.currentStepIndex++;
  return true;
}

/**
 * Story finale bookkeeping (credits + completed-id). XP / rank stay with `addXP`
 * so the engine can still play the promotion sting. Returns the XP the caller
 * should award, matching `MissionRunner.completeStoryMission`.
 */
export function applyMissionComplete(mission: Mission, stats: PlayerStats): number {
  mission.completed = true;
  stats.credits += mission.rewardCredits;
  stats.missionsCompleted.push(mission.id);
  return mission.rewardXP;
}
