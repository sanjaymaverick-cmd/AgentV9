import * as THREE from 'three';
import { DisguiseType } from '../types/game';
import type { GameEngine } from './gameEngine';

/**
 * Dev-only debug controls (spec §33).
 *
 * This module is imported dynamically from `GameEngine` only under `import.meta.env.DEV`.
 * In a production build that branch is dead-code-eliminated, Rollup never emits this
 * chunk, and `engine.debug` stays `null`. Nothing here runs for the shipped game.
 *
 * It is the one sanctioned backdoor into engine internals — hence the single structural
 * cast below. Everything the tools poke is listed on `Internals` so the cast stays honest.
 */

export interface DebugTools {
  clearChaos(): void;
  setChaosLevel(level: number): void;
  refill(): void;
  unlockAllDisguises(): void;
  equipDisguise(d: DisguiseType): void;
  teleport(pos: [number, number, number]): void;
  jumpToMissionStep(index: number): void;
  setRenderQuality(level: 'low' | 'medium' | 'high'): void;
  startDowntownRace(): void;
}

/** The engine members the debug tools reach into (public API + a few privates). */
interface Internals {
  state: GameEngine['state'];
  renderer: GameEngine['renderer'];
  settings: GameEngine['settings'];
  applyQuality: GameEngine['applyQuality'];
  bikePos: THREE.Vector3;
  playerPos: THREE.Vector3;
  dronePos: THREE.Vector3;
  playerVel: THREE.Vector3;
  bikeSpeed: number;
  bikeVerticalVel: number;
  isBikeGrounded: boolean;
  bikeLean: number;
  bikePitch: number;
  isGrounded: boolean;
  orbitYawOffset: number;
  orbitPitchOffset: number;
  isEscortingOut: boolean;
  escortTimer: number;
  hasWarnedZeroFuel: boolean;
  lastLowFuelAlertTime: number;
  world: { bots: { data: { alertLevel: number; disabledUntil: number; trappedByFoamUntil: number } }[] };
  motorcycle: { group: THREE.Object3D };
  agentChar: { group: THREE.Object3D };
  bossDrone: { group: THREE.Object3D; relays: { mesh: THREE.Mesh; disabled: boolean }[] };
  equipDisguise(d: DisguiseType): void;
  requestAutosave(): void;
  setNotification(text: string): void;
  notifyState(): void;
  chaosAlertManager: { clear(): void; setLevel(level: number): void };
  raceManager: { start(raceId?: string): void };
}

const ALL_DISGUISES: DisguiseType[] = [
  'agent_suit',
  'delivery_worker',
  'maintenance_tech',
  'lab_scientist',
  'race_crew',
];

export function attachDebugTools(engine: GameEngine): DebugTools {
  const e = engine as unknown as Internals;

  const teleport = (pos: [number, number, number]) => {
    const target = new THREE.Vector3(pos[0], pos[1], pos[2]);
    if (e.state.isRiding) {
      e.bikePos.copy(target);
      e.bikeSpeed = 0;
      e.bikeVerticalVel = 0;
      e.isBikeGrounded = true;
      e.bikeLean = 0;
      e.bikePitch = 0;
      e.motorcycle.group.position.copy(target);
    } else {
      e.playerPos.copy(target);
      e.playerVel.set(0, 0, 0);
      e.isGrounded = true;
      e.agentChar.group.position.copy(target);
    }
    e.dronePos.set(target.x, target.y + 3, target.z);
    e.orbitYawOffset = 0;
    e.orbitPitchOffset = 0;
    e.requestAutosave();
    e.notifyState();
  };

  return {
    clearChaos() {
      e.chaosAlertManager.clear();
      e.state.stealthVisibility = 0;
      e.world.bots.forEach((b) => {
        b.data.alertLevel = 0;
        b.data.disabledUntil = 0;
      });
      e.isEscortingOut = false;
      e.escortTimer = 0;
      e.setNotification('[debug] CHAOS alert cleared');
      e.notifyState();
    },

    setChaosLevel(level: number) {
      e.chaosAlertManager.setLevel(level);
      e.setNotification(`[debug] CHAOS level ${level}`);
      e.notifyState();
    },

    refill() {
      e.state.fuelLevel = 100;
      e.state.nitroLevel = 100;
      e.hasWarnedZeroFuel = false;
      e.lastLowFuelAlertTime = 0;
      e.world.bots.forEach((b) => {
        b.data.disabledUntil = 0;
        b.data.trappedByFoamUntil = 0;
      });
      e.setNotification('[debug] Fuel + Nitro refilled');
      e.notifyState();
    },

    unlockAllDisguises() {
      e.state.stats.unlockedDisguises = [...ALL_DISGUISES];
      e.requestAutosave();
      e.setNotification('[debug] All disguises unlocked');
      e.notifyState();
    },

    equipDisguise(d) {
      if (!e.state.stats.unlockedDisguises.includes(d)) {
        e.state.stats.unlockedDisguises.push(d);
      }
      e.equipDisguise(d);
    },

    teleport,

    jumpToMissionStep(index) {
      const mission = e.state.activeMission;
      if (!mission.steps.length) return;
      const clamped = Math.max(0, Math.min(index, mission.steps.length - 1));

      mission.completed = false;
      mission.active = true;
      mission.currentStepIndex = clamped;
      mission.steps.forEach((s, i) => {
        s.completed = i < clamped;
      });

      // Reset the boss encounter so step 5 can be replayed cleanly.
      e.state.bossRelaysRemaining = 3;
      e.bossDrone.relays.forEach((r) => {
        r.disabled = false;
        (r.mesh.material as THREE.MeshBasicMaterial).color.set('#38bdf8');
      });
      e.bossDrone.group.visible = clamped >= 4;

      const t = mission.steps[clamped].targetPosition;
      teleport([t[0], Math.max(0, t[1] - 1), t[2] + 6]);

      e.setNotification(
        `[debug] Step ${clamped + 1}/${mission.steps.length}: ${mission.steps[clamped].title}`
      );
      e.requestAutosave();
      e.notifyState();
    },

    setRenderQuality(level) {
      e.applyQuality(level);
      e.notifyState();
    },

    startDowntownRace() {
      teleport([16, 0, 4]);
      e.raceManager.start();
      e.setNotification('[debug] Downtown sprint armed');
      e.notifyState();
    },
  };
}
