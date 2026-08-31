import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SAVE_DATA_VERSION,
  SaveManager,
  cloneDefaultStats,
  makeDefaultSaveData,
  migrate,
} from './saveManager';

function installMemoryStorage() {
  const store = new Map<string, string>();
  const memory = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: memory,
    configurable: true,
  });
  return store;
}

describe('migrate', () => {
  it('returns null for non-objects and for a future version', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('blob')).toBeNull();
    expect(migrate(1)).toBeNull();
    expect(migrate({ version: SAVE_DATA_VERSION + 1 })).toBeNull();
  });

  it('promotes a v0 / partial blob onto v1 defaults and keeps known fields', () => {
    const upgraded = migrate({
      version: 0,
      stats: { xp: 999, rank: 'Investigator' },
      player: { currentDisguise: 'lab_scientist' },
    });
    expect(upgraded).not.toBeNull();
    expect(upgraded!.version).toBe(SAVE_DATA_VERSION);
    expect(upgraded!.stats.xp).toBe(999);
    expect(upgraded!.stats.rank).toBe('Investigator');
    expect(upgraded!.stats.credits).toBe(makeDefaultSaveData().stats.credits);
    expect(upgraded!.player.currentDisguise).toBe('lab_scientist');
    expect(upgraded!.player.currentGadget).toBe('emp');
    expect(upgraded!.mission.activeMissionId).toBe('mission_midnight_prototype');
    expect(upgraded!.world.fuelLevel).toBe(100);
    expect(upgraded!.world.collectedCollectibleIds).toEqual([]);
  });

  it('treats a missing version as v0', () => {
    const upgraded = migrate({ stats: { xp: 400 } });
    expect(upgraded?.version).toBe(SAVE_DATA_VERSION);
    expect(upgraded?.stats.xp).toBe(400);
  });

  it('coerces broken array fields on a current-version blob', () => {
    const upgraded = migrate({
      version: 1,
      mission: { completedStepIds: 'nope', currentStepIndex: 2 },
      world: { collectedCollectibleIds: 0, collectedStuntRingIds: null },
    });
    expect(upgraded!.mission.completedStepIds).toEqual([]);
    expect(upgraded!.mission.currentStepIndex).toBe(2);
    expect(upgraded!.world.collectedCollectibleIds).toEqual([]);
    expect(upgraded!.world.collectedStuntRingIds).toEqual([]);
  });

  it('round-trips a well-formed v1 save', () => {
    const original = makeDefaultSaveData();
    original.savedAt = 1_700_000_000_000;
    original.player.bikePos = [12, 0, -4];
    original.mission.currentStepIndex = 3;
    original.mission.completedStepIds = ['step_1_travel', 'step_2_scan_dock', 'step_3_chase_drone'];
    original.world.chaosAlertLevel = 2;
    original.stats.xp = 1800;
    const restored = migrate(JSON.parse(JSON.stringify(original)));
    expect(restored).toEqual({ ...original, version: SAVE_DATA_VERSION });
  });
});

describe('cloneDefaultStats', () => {
  it('does not share mutable collections across copies', () => {
    const a = cloneDefaultStats();
    const b = cloneDefaultStats();
    a.missionsCompleted.push('mission_midnight_prototype');
    a.unlockedDisguises.push('lab_scientist');
    a.bestRaceTimes.downtown = 41.2;
    expect(b.missionsCompleted).toEqual([]);
    expect(b.unlockedDisguises).not.toContain('lab_scientist');
    expect(b.bestRaceTimes).toEqual({});
  });
});

describe('SaveManager', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    SaveManager.clear();
  });

  it('saves and loads a versioned blob through localStorage', () => {
    const data = makeDefaultSaveData();
    data.stats.xp = 1250;
    data.player.playerPos = [8, 0, 3];
    data.mission.currentStepIndex = 2;
    SaveManager.save(data);
    const loaded = SaveManager.load();
    expect(loaded?.version).toBe(SAVE_DATA_VERSION);
    expect(loaded?.stats.xp).toBe(1250);
    expect(loaded?.player.playerPos).toEqual([8, 0, 3]);
    expect(loaded?.mission.currentStepIndex).toBe(2);
  });

  it('returns null when nothing is stored', () => {
    expect(SaveManager.load()).toBeNull();
  });

  it('discards corrupt JSON and starts fresh', () => {
    localStorage.setItem('agent_v9_save_v1', '{not json');
    expect(SaveManager.load()).toBeNull();
  });

  it('folds legacy pre-versioned stats into a first v1 save', () => {
    localStorage.setItem('agent_v9_stats_v1', JSON.stringify({ xp: 640, credits: 90 }));
    localStorage.setItem(
      'agent_v9_customization_v1',
      JSON.stringify({ bodyColor: '#ff00aa' }),
    );
    const loaded = SaveManager.load();
    expect(loaded?.version).toBe(SAVE_DATA_VERSION);
    expect(loaded?.stats.xp).toBe(640);
    expect(loaded?.stats.credits).toBe(90);
    expect(loaded?.customization.bodyColor).toBe('#ff00aa');
    expect(loaded?.mission.activeMissionId).toBe('mission_midnight_prototype');
  });
});
