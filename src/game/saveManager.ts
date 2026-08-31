import {
  PlayerStats,
  VehicleCustomization,
  DisguiseType,
  GadgetType,
  MissionPathChoice,
} from '../types/game';

/**
 * Versioned save system (spec §21).
 *
 * One localStorage key holds one versioned blob. Bump SAVE_DATA_VERSION whenever the
 * shape changes and add a `MIGRATIONS[oldVersion]` entry that upgrades a blob by exactly
 * one version; `migrate()` chains them. A blob whose version is newer than this build, or
 * that is unparseable, is discarded and the game starts fresh.
 *
 * Trivial device-local settings (volumes, touch-control prefs, quality flag) deliberately
 * stay OUT of this object — see `agent_v9_settings_v1` in App.tsx.
 */
export const SAVE_DATA_VERSION = 1;

const SAVE_KEY = 'agent_v9_save_v1';

// Legacy pre-versioned keys — read once to seed the first versioned save, never written.
const LEGACY_STATS_KEY = 'agent_v9_stats_v1';
const LEGACY_CUSTOM_KEY = 'agent_v9_customization_v1';

/** Debounce window for autosave writes triggered by gameplay events. */
export const AUTOSAVE_DEBOUNCE_MS = 2000;
/** Wall-clock interval for the position-capture autosave heartbeat. */
export const PERIODIC_AUTOSAVE_SEC = 15;

export interface SaveDataV1 {
  version: number;
  savedAt: number;

  player: {
    isRiding: boolean;
    isSilentMode: boolean;
    playerPos: [number, number, number];
    playerRot: number;
    bikePos: [number, number, number];
    bikeRot: number;
    currentDisguise: DisguiseType;
    currentGadget: GadgetType;
  };

  mission: {
    activeMissionId: string;
    isSideQuest: boolean;
    currentStepIndex: number;
    chosenPath?: MissionPathChoice;
    completedStepIds: string[];
    completed: boolean;
    bossRelaysRemaining: number;
  };

  world: {
    collectedCollectibleIds: string[];
    collectedStuntRingIds: string[];
    hackedTerminalIds: string[];
    chaosAlertLevel: number;
    chaosAlertProgress: number;
    fuelLevel: number;
    nitroLevel: number;
  };

  stats: PlayerStats;
  customization: VehicleCustomization;
}

export type SaveData = SaveDataV1;

export const DEFAULT_CUSTOMIZATION: VehicleCustomization = {
  bodyColor: '#06b6d4', // Neon Cyan
  secondaryColor: '#0284c7',
  underglowColor: '#38bdf8',
  rimColor: '#f59e0b',
  decalStyle: 'academy',
  exhaustEffect: 'blue_flame',
  suitColor: '#0284c7',
};

export const DEFAULT_STATS: PlayerStats = {
  xp: 150,
  rank: 'Rookie',
  credits: 300,
  secretsFound: 0,
  stuntsCompleted: 0,
  missionsCompleted: [],
  unlockedDisguises: ['agent_suit', 'maintenance_tech', 'delivery_worker'],
  unlockedGadgets: ['emp', 'foam', 'drone', 'hologram', 'remote_v9'],
  unlockedUpgrades: ['turbo_v1'],
  bestRaceTimes: {},
  stuntHighScore: 0,
};

/** Fresh copy of the default stats with its own arrays/records — never share the const. */
export function cloneDefaultStats(): PlayerStats {
  return {
    ...DEFAULT_STATS,
    missionsCompleted: [...DEFAULT_STATS.missionsCompleted],
    unlockedDisguises: [...DEFAULT_STATS.unlockedDisguises],
    unlockedGadgets: [...DEFAULT_STATS.unlockedGadgets],
    unlockedUpgrades: [...DEFAULT_STATS.unlockedUpgrades],
    bestRaceTimes: { ...DEFAULT_STATS.bestRaceTimes },
  };
}

/** A pristine save — the shape the engine restores against and migrations fill toward. */
export function makeDefaultSaveData(): SaveDataV1 {
  return {
    version: SAVE_DATA_VERSION,
    savedAt: 0,
    player: {
      isRiding: true,
      isSilentMode: false,
      playerPos: [-60, 0, -48],
      playerRot: 0,
      bikePos: [-60, 0, -48],
      bikeRot: 0,
      currentDisguise: 'agent_suit',
      currentGadget: 'emp',
    },
    mission: {
      activeMissionId: 'mission_midnight_prototype',
      isSideQuest: false,
      currentStepIndex: 0,
      chosenPath: undefined,
      completedStepIds: [],
      completed: false,
      bossRelaysRemaining: 3,
    },
    world: {
      collectedCollectibleIds: [],
      collectedStuntRingIds: [],
      hackedTerminalIds: [],
      chaosAlertLevel: 0,
      chaosAlertProgress: 0,
      fuelLevel: 100,
      nitroLevel: 100,
    },
    stats: cloneDefaultStats(),
    customization: { ...DEFAULT_CUSTOMIZATION },
  };
}

// ---------------------------------------------------------------------------
// Migration chain — MIGRATIONS[n] upgrades a v(n) blob to v(n+1).
// ---------------------------------------------------------------------------

type AnyRecord = Record<string, unknown>;

const isObject = (v: unknown): v is AnyRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Shallow-merge `over` onto `base` one level deep for the known nested groups. */
function mergeOntoDefaults(raw: AnyRecord): SaveDataV1 {
  const def = makeDefaultSaveData();
  const pick = (key: keyof SaveDataV1) => (isObject(raw[key]) ? (raw[key] as AnyRecord) : {});
  return {
    ...def,
    ...raw,
    version: SAVE_DATA_VERSION,
    player: { ...def.player, ...pick('player') },
    mission: { ...def.mission, ...pick('mission') },
    world: { ...def.world, ...pick('world') },
    stats: { ...def.stats, ...pick('stats') },
    customization: { ...def.customization, ...pick('customization') },
  } as SaveDataV1;
}

const MIGRATIONS: Record<number, (raw: AnyRecord) => AnyRecord> = {
  // v0 (pre-versioned / hand-edited partial) -> v1: fill every missing field from defaults.
  0: (raw) => mergeOntoDefaults(raw) as unknown as AnyRecord,
};

/** Chain single-version migrations up to SAVE_DATA_VERSION. Returns null if impossible. */
export function migrate(raw: unknown): SaveDataV1 | null {
  if (!isObject(raw)) return null;

  let data: AnyRecord = raw;
  let version = Number.isFinite(data.version as number) ? Math.trunc(data.version as number) : 0;

  if (version > SAVE_DATA_VERSION) {
    console.warn(
      `[SaveManager] Save version ${version} is newer than this build (${SAVE_DATA_VERSION}). Ignoring it.`
    );
    return null;
  }

  while (version < SAVE_DATA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      console.warn(`[SaveManager] No migration from version ${version}; discarding save.`);
      return null;
    }
    data = step(data);
    version = Number(data.version) || version + 1;
  }

  return normalize(data);
}

/** Coerce a v-current blob into a well-formed SaveDataV1, backfilling anything missing. */
function normalize(raw: AnyRecord): SaveDataV1 {
  const merged = mergeOntoDefaults(raw);
  merged.version = SAVE_DATA_VERSION;
  // Arrays that migrations/merges may have left as non-arrays.
  merged.mission.completedStepIds = Array.isArray(merged.mission.completedStepIds)
    ? merged.mission.completedStepIds
    : [];
  merged.world.collectedCollectibleIds = Array.isArray(merged.world.collectedCollectibleIds)
    ? merged.world.collectedCollectibleIds
    : [];
  merged.world.collectedStuntRingIds = Array.isArray(merged.world.collectedStuntRingIds)
    ? merged.world.collectedStuntRingIds
    : [];
  merged.world.hackedTerminalIds = Array.isArray(merged.world.hackedTerminalIds)
    ? merged.world.hackedTerminalIds
    : [];
  return merged;
}

// ---------------------------------------------------------------------------
// SaveManager — the only thing that touches localStorage for game progress.
// ---------------------------------------------------------------------------

export const SaveManager = {
  /**
   * Load and migrate the stored save. On a fresh install, folds any pre-versioned
   * `stats` / `customization` keys into a first v1 save so early testers keep their XP.
   * Returns null when there is nothing usable — the caller then starts a new game.
   */
  load(): SaveDataV1 | null {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      return null;
    }

    if (raw) {
      try {
        return migrate(JSON.parse(raw));
      } catch {
        console.warn('[SaveManager] Stored save is corrupt and could not be parsed.');
        return null;
      }
    }

    return loadLegacy();
  },

  save(data: SaveDataV1): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_DATA_VERSION }));
    } catch {
      // Storage full or blocked (private mode) — progress just won't persist this session.
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Build a v1 save from the old standalone `stats` / `customization` keys, if present. */
function loadLegacy(): SaveDataV1 | null {
  let legacyStats: unknown;
  let legacyCustom: unknown;
  try {
    const s = localStorage.getItem(LEGACY_STATS_KEY);
    const c = localStorage.getItem(LEGACY_CUSTOM_KEY);
    if (s) legacyStats = JSON.parse(s);
    if (c) legacyCustom = JSON.parse(c);
  } catch {
    /* fall through */
  }

  if (!isObject(legacyStats) && !isObject(legacyCustom)) return null;

  const seed = makeDefaultSaveData();
  if (isObject(legacyStats)) seed.stats = { ...seed.stats, ...(legacyStats as AnyRecord) } as PlayerStats;
  if (isObject(legacyCustom)) {
    seed.customization = { ...seed.customization, ...(legacyCustom as AnyRecord) } as VehicleCustomization;
  }
  return seed;
}
