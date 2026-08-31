import * as THREE from 'three';
import { Mission } from '../types/game';
import type { GameEngine } from './gameEngine';
import { SaveDataV1, SAVE_DATA_VERSION } from './saveManager';
import { STORY_MISSION_MIDNIGHT_PROTOTYPE, SIDE_MISSIONS } from './missionEngine';

/**
 * Turns the live engine into a `SaveDataV1` snapshot and restores one back into the
 * running scene (spec §21). The versioned blob shape + migration live in
 * `saveManager.ts`; this is just the engine <-> blob marshalling.
 *
 * Moved verbatim from GameEngine.exportSave / applySave; only `this.` -> `this.e.`.
 */
export class SaveController {
  constructor(private e: GameEngine) {}

  /** Snapshot every piece of progress the spec requires to survive a reload. */
  export(): SaveDataV1 {
    const e = this.e;
    // If a side sprint is running, persist the parked story — the race itself is a session overlay.
    const m = e.stashedStoryMission ?? e.state.activeMission;
    const isSideQuest = SIDE_MISSIONS.some((s) => s.id === m.id);
    return {
      version: SAVE_DATA_VERSION,
      savedAt: Date.now(),
      player: {
        isRiding: e.state.isRiding,
        isSilentMode: e.state.isSilentMode,
        playerPos: [e.playerPos.x, e.playerPos.y, e.playerPos.z],
        playerRot: e.playerRot,
        bikePos: [e.bikePos.x, e.bikePos.y, e.bikePos.z],
        bikeRot: e.bikeRot,
        currentDisguise: e.state.currentDisguise,
        currentGadget: e.state.currentGadget,
      },
      mission: {
        activeMissionId: m.id,
        isSideQuest,
        currentStepIndex: m.currentStepIndex,
        chosenPath: m.chosenPath,
        completedStepIds: m.steps.filter((s) => s.completed).map((s) => s.id),
        completed: m.completed,
        bossRelaysRemaining: e.state.bossRelaysRemaining,
      },
      world: {
        collectedCollectibleIds: e.world.collectibles.filter((c) => c.collected).map((c) => c.id),
        collectedStuntRingIds: e.world.stuntRings.filter((r) => r.collected).map((r) => r.id),
        hackedTerminalIds: e.world.terminals.filter((t) => t.hacked).map((t) => t.id),
        chaosAlertLevel: e.state.chaosAlertLevel,
        chaosAlertProgress: e.state.chaosAlertProgress,
        fuelLevel: e.state.fuelLevel,
        nitroLevel: e.state.nitroLevel,
      },
      stats: e.state.stats,
      customization: e.customization,
    };
  }

  /** Restore a loaded save into the live scene. Runs once, during construction. */
  apply(data: SaveDataV1) {
    const e = this.e;

    // --- Player & vehicle transforms ---
    const p = data.player;
    e.playerPos.set(...p.playerPos);
    e.playerRot = p.playerRot;
    e.bikePos.set(...p.bikePos);
    e.bikeRot = p.bikeRot;
    e.bikeSpeed = 0;
    e.playerVel.set(0, 0, 0);
    e.motorcycle.group.position.copy(e.bikePos);
    e.motorcycle.group.rotation.y = e.bikeRot;
    e.agentChar.group.position.copy(e.playerPos);
    e.agentChar.group.rotation.y = e.playerRot;

    e.state.isRiding = p.isRiding;
    e.state.isSilentMode = p.isSilentMode;

    // --- Inventory / appearance ---
    e.state.currentGadget = p.currentGadget;
    e.state.currentDisguise = p.currentDisguise;
    e.updateCustomization(e.customization); // rebuilds agent + bike for disguise/colours

    // Mount visibility must be re-asserted AFTER updateCustomization rebuilds the meshes.
    e.agentChar.group.visible = !p.isRiding;
    e.motorcycle.riderMesh.visible = p.isRiding;

    // --- Mission progress ---
    const template = data.mission.isSideQuest
      ? SIDE_MISSIONS.find((s) => s.id === data.mission.activeMissionId)
      : data.mission.activeMissionId === STORY_MISSION_MIDNIGHT_PROTOTYPE.id
      ? STORY_MISSION_MIDNIGHT_PROTOTYPE
      : undefined;

    if (template) {
      const mission: Mission = JSON.parse(JSON.stringify(template));
      mission.active = true;
      mission.completed = data.mission.completed;
      mission.chosenPath = data.mission.chosenPath;
      mission.currentStepIndex = Math.max(
        0,
        Math.min(data.mission.currentStepIndex, mission.steps.length)
      );
      mission.steps.forEach((s, i) => {
        s.completed = i < mission.currentStepIndex || data.mission.completedStepIds.includes(s.id);
      });
      e.state.activeMission = mission;
      e.state.bossRelaysRemaining = data.mission.bossRelaysRemaining;
      if (!mission.completed && mission.currentStepIndex >= 4) {
        e.bossDrone.group.visible = true;
      }
    }

    // --- World object state ---
    const w = data.world;
    e.world.collectibles.forEach((c) => {
      if (w.collectedCollectibleIds.includes(c.id)) {
        c.collected = true;
        const mesh = e.scene.getObjectByName(c.id);
        if (mesh) e.scene.remove(mesh);
      }
    });
    e.world.stuntRings.forEach((r) => {
      if (w.collectedStuntRingIds.includes(r.id)) {
        r.collected = true;
        (r.mesh.material as THREE.MeshBasicMaterial).color.set('#22c55e');
      }
    });
    e.world.terminals.forEach((t) => {
      if (w.hackedTerminalIds.includes(t.id)) {
        t.hacked = true;
        (t.mesh.children[0] as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: '#22c55e' });
        if (t.id === 'term_museum_dock') {
          e.world.museumLaserGate.visible = false;
          e.world.museumStaffDoor.open = true;
          e.world.museumStaffDoor.mesh.visible = false;
          e.stealthAI.disableCamerasInZone('museum_dock');
        }
        if (t.id === 'term_station_crane') e.world.stationCraneGate.position.y += 6;
      }
    });

    e.state.chaosAlertLevel = w.chaosAlertLevel;
    e.state.chaosAlertProgress = w.chaosAlertProgress;
    e.chaosAlertManager.syncToState();
    e.raceManager.onMissionRestored();
    e.chaseController.syncToMission();
    e.state.fuelLevel = w.fuelLevel;
    e.state.nitroLevel = w.nitroLevel;

    // --- Framing ---
    e.state.notification = 'Progress restored — welcome back, Agent!';
    e.state.radioMessage = {
      sender: 'Agent Kira (HQ)',
      text: 'Welcome back, Agent V9. Picking up right where you left off. Check your objective marker.',
      time: Date.now(),
    };
    e.markSaved();
  }
}
