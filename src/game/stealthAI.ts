import * as THREE from 'three';
import type { GameEngine } from './gameEngine';
import { createAgentCharacter } from './models';
import { soundEngine } from './audio';
import { STEALTH } from './tunables';
import { GuardAI, SoundBus } from './guardAI';
import { raiseStationGate, type SideBreakerObject } from './world';

/**
 * Stealth detection & non-lethal enforcement (spec §11, §16).
 *
 * Guard awareness is a five-state machine (GuardAI). This class owns the sound bus,
 * escort-out, EMP, and the hologram decoy. CHAOS heat is still ChaosAlertManager.
 */
export class StealthAI {
  readonly sounds = new SoundBus();
  private readonly guards: GuardAI;

  constructor(private e: GameEngine) {
    this.guards = new GuardAI(e);
  }

  resetGuards() {
    this.guards.resetAll();
  }

  disableCamerasInZone(zoneId: string, ms = STEALTH.empDisableMs) {
    const until = Date.now() + ms;
    for (const cam of this.e.world.cameras) {
      if (cam.zoneId !== zoneId) continue;
      cam.disabledUntil = until;
      cam.disabled = true;
      cam.cone.visible = false;
      cam.alertLevel = 0;
    }
  }

  update(dt: number) {
    this.emitAmbientNoise();
    this.guards.tick(dt, this.sounds.drain());
  }

  private emitAmbientNoise() {
    const e = this.e;
    const p = e.state.isRiding ? e.bikePos : e.playerPos;
    if (!e.state.isRiding && e.state.stealthNoise >= 50) {
      this.sounds.emit({ x: p.x, z: p.z, radius: STEALTH.sprintHearRadius, kind: 'footstep' });
    }
    if (e.state.isRiding && !e.state.isSilentMode && Math.abs(e.bikeSpeed) > STEALTH.engineNoiseSpeed) {
      this.sounds.emit({ x: p.x, z: p.z, radius: STEALTH.engineHearRadius, kind: 'engine' });
    }
  }

  triggerEscortOut(guardName: string) {
    const e = this.e;
    e.isEscortingOut = true;
    e.escortTimer = STEALTH.escortDurationSec;
    soundEngine.playEscortOut();
    soundEngine.speak('Hold on there agent! Escorting you back outside the perimeter.', 'guard');
    e.setNotification(`Spotted by ${guardName}! Guard humorously escorting you outside.`);
    e.state.radioMessage = {
      sender: guardName,
      text: 'Hey! Unauthorized personnel must stay outside the loading perimeter. Try putting on a technician disguise or finding another way in!',
      time: Date.now(),
    };
    e.chaosAlertManager.reportCaught();
    e.notifyState();
  }

  updateEscortOut(dt: number) {
    const e = this.e;
    e.escortTimer -= dt;
    // Fade / move smoothly back to safe sidewalk
    const safeSidewalk = new THREE.Vector3(0, 0, -50);
    e.playerPos.lerp(safeSidewalk, dt * STEALTH.escortLerpPerSec);
    e.bikePos.lerp(safeSidewalk.clone().add(new THREE.Vector3(2, 0, 0)), dt * STEALTH.escortLerpPerSec);

    if (e.escortTimer <= 0) {
      e.isEscortingOut = false;
      this.resetGuards();
      e.setNotification('Back outside! Choose your path: Speed (ramps), Stealth (disguise/vent), or Smarts (gadgets)!');
      e.notifyState();
    }
  }

  applyEMPRadius(pos: THREE.Vector3, radius: number) {
    const e = this.e;
    // 1. Check Guard Bots
    e.world.bots.forEach((b) => {
      if (b.obj.position.distanceTo(pos) < radius) {
        b.data.disabledUntil = Date.now() + STEALTH.empDisableMs;
        b.cone.visible = false;
        e.setNotification(`EMP disabled ${b.data.name}!`);
        e.addXP(STEALTH.empBotXP, 'Bot EMP Hack');
      }
    });

    this.tripBreakers(pos, radius);

    // 2. Check Boss Cargo Drone Relays (Step 5 climax)
    if (e.state.activeMission.currentStepIndex === 4 && e.bossDrone.group.visible) {
      e.bossDrone.relays.forEach((relay, i) => {
        if (!relay.disabled) {
          const worldPos = new THREE.Vector3();
          relay.mesh.getWorldPosition(worldPos);
          if (worldPos.distanceTo(pos) < STEALTH.relayHitDist) {
            relay.disabled = true;
            (relay.mesh.material as THREE.MeshBasicMaterial).color.set('#22c55e');
            e.state.bossRelaysRemaining--;
            soundEngine.playMissionComplete();
            e.setNotification(`Relay ${i + 1} Disabled! ${e.state.bossRelaysRemaining} remaining.`);
            e.addXP(STEALTH.relayXP, 'Cargo Drone Relay Overload');

            if (e.state.bossRelaysRemaining <= 0) {
              e.completeStoryMission();
            }
          }
        }
      });
    }
  }

  /** Overload EMP-able side breakers in radius (station Smarts alt path). */
  tripBreakers(pos: THREE.Vector3, radius: number) {
    const e = this.e;
    for (const b of e.world.sideBreakers) {
      if (b.tripped) continue;
      if (b.mesh.position.distanceTo(pos) >= radius) continue;
      this.tripBreaker(b);
    }
  }

  tripBreaker(b: SideBreakerObject) {
    const e = this.e;
    if (b.tripped) return;
    b.tripped = true;
    const mat = b.mesh.material as THREE.MeshStandardMaterial;
    mat.color.set('#22c55e');
    mat.emissive.set('#14532d');
    raiseStationGate(e.world);
    soundEngine.playMissionComplete();
    e.addXP(150, 'Station Side Breaker EMP');
    e.setNotification('Side breaker overloaded! Warehouse gate is up.');
    e.checkMissionStepComplete('step_4_infiltrate_station', 'smarts');
    e.requestAutosave();
    e.notifyState();
  }

  deployHologramDecoy(pos: THREE.Vector3) {
    const e = this.e;
    if (e.hologramDecoy) {
      e.scene.remove(e.hologramDecoy);
    }
    const decoy = createAgentCharacter('agent_suit', '#38bdf8');
    decoy.group.position.copy(pos);
    e.scene.add(decoy.group);
    e.hologramDecoy = decoy.group;
    e.hologramTimer = 10; // 10 seconds

    e.setNotification('Hologram Decoy deployed! Guard bots distracted.');
    soundEngine.playAlert();
    this.sounds.emit({ x: pos.x, z: pos.z, radius: STEALTH.decoyHearRadius, kind: 'decoy' });
  }
}
