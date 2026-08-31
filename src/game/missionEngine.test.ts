import { describe, expect, it } from 'vitest';
import {
  STORY_MISSION_MIDNIGHT_PROTOTYPE,
  applyMissionComplete,
  applyStepComplete,
  calculateRank,
  cloneMission,
} from './missionEngine';
import { cloneDefaultStats } from './saveManager';
import { MISSION } from './tunables';

describe('calculateRank', () => {
  it('maps XP thresholds to Agent ranks', () => {
    expect(calculateRank(0)).toBe('Rookie');
    expect(calculateRank(199)).toBe('Rookie');
    expect(calculateRank(200)).toBe('Explorer');
    expect(calculateRank(499)).toBe('Explorer');
    expect(calculateRank(500)).toBe('Investigator');
    expect(calculateRank(999)).toBe('Investigator');
    expect(calculateRank(1000)).toBe('Field Agent');
    expect(calculateRank(1599)).toBe('Field Agent');
    expect(calculateRank(1600)).toBe('Special Agent');
    expect(calculateRank(2199)).toBe('Special Agent');
    expect(calculateRank(2200)).toBe('Elite Agent');
    expect(calculateRank(2999)).toBe('Elite Agent');
    expect(calculateRank(3000)).toBe('V9 Agent');
    expect(calculateRank(99999)).toBe('V9 Agent');
  });
});

describe('mission advancement', () => {
  it('clones the story template so completing a step does not mutate the module export', () => {
    const mission = cloneMission(STORY_MISSION_MIDNIGHT_PROTOTYPE);
    applyStepComplete(mission, 'step_1_travel', 'speed');
    expect(STORY_MISSION_MIDNIGHT_PROTOTYPE.currentStepIndex).toBe(0);
    expect(STORY_MISSION_MIDNIGHT_PROTOTYPE.steps[0].completed).toBe(false);
  });

  it('completes the current objective, records the path, and advances the cursor', () => {
    const mission = cloneMission(STORY_MISSION_MIDNIGHT_PROTOTYPE);
    const ok = applyStepComplete(mission, 'step_1_travel', 'speed');
    expect(ok).toBe(true);
    expect(mission.steps[0].completed).toBe(true);
    expect(mission.chosenPath).toBe('speed');
    expect(mission.currentStepIndex).toBe(1);
    expect(mission.completed).toBe(false);
  });

  it('is a no-op for an unknown or already-completed step', () => {
    const mission = cloneMission(STORY_MISSION_MIDNIGHT_PROTOTYPE);
    expect(applyStepComplete(mission, 'not_a_step', 'smarts')).toBe(false);
    expect(applyStepComplete(mission, 'step_1_travel', 'stealth')).toBe(true);
    expect(applyStepComplete(mission, 'step_1_travel', 'speed')).toBe(false);
    expect(mission.currentStepIndex).toBe(1);
    expect(mission.chosenPath).toBe('stealth');
  });

  it('walks The Midnight Prototype through all five story steps', () => {
    const mission = cloneMission(STORY_MISSION_MIDNIGHT_PROTOTYPE);
    const sequence: Array<[string, 'speed' | 'stealth' | 'smarts']> = [
      ['step_1_travel', 'speed'],
      ['step_2_scan_dock', 'stealth'],
      ['step_3_chase_drone', 'speed'],
      ['step_4_infiltrate_station', 'smarts'],
      ['step_5_boss_drone', 'speed'],
    ];
    for (const [id, path] of sequence) {
      expect(applyStepComplete(mission, id, path)).toBe(true);
    }
    expect(mission.currentStepIndex).toBe(5);
    expect(mission.currentStepIndex).toBeGreaterThan(MISSION.bossStepIndex);
    expect(mission.steps.every((s) => s.completed)).toBe(true);
    expect(mission.completed).toBe(false);
  });

  it('awards credits and XP on finale without auto-ranking (engine addXP owns rank)', () => {
    const mission = cloneMission(STORY_MISSION_MIDNIGHT_PROTOTYPE);
    mission.currentStepIndex = mission.steps.length;
    const stats = cloneDefaultStats();
    const xpBefore = stats.xp;
    const creditsBefore = stats.credits;
    const awarded = applyMissionComplete(mission, stats);
    expect(awarded).toBe(mission.rewardXP);
    expect(mission.completed).toBe(true);
    expect(stats.xp).toBe(xpBefore);
    expect(stats.credits).toBe(creditsBefore + mission.rewardCredits);
    expect(stats.missionsCompleted).toContain(mission.id);
    expect(stats.rank).toBe('Rookie');
  });
});
