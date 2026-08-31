import * as THREE from 'three';
import type { GameEngine } from './gameEngine';
import { createAgentCharacter } from './models';
import { soundEngine } from './audio';
import { STEALTH } from './tunables';

/**
 * Stealth detection & non-lethal enforcement (spec §11, §16).
 *
 * Per frame: moves patrols, runs vision-cone detection with disguise exemptions, drives
 * the CHAOS meter, and — on full alert — hands off to the humorous escort-out. Also owns
 * the EMP radius resolution and the hologram decoy, both fired from `engine.fireGadget()`.
 *
 * Moved verbatim from GameEngine (`this.` -> `this.e.`, magic numbers -> `STEALTH.*`).
 * TODO(spec §11): this is still a single `alertLevel` float, not the five named states.
 */
export class StealthAI {
  constructor(private e: GameEngine) {}

  update(dt: number) {
    const e = this.e;
    const playerTarget = e.state.isRiding ? e.bikePos : e.playerPos;
    const isDisguisedInMuseum = e.state.currentDisguise === 'maintenance_tech' || e.state.currentDisguise === 'lab_scientist';
    const isDisguisedInStation = e.state.currentDisguise === 'race_crew' || e.state.currentDisguise === 'delivery_worker';

    e.world.bots.forEach((bot) => {
      // Disabled state
      if (Date.now() < bot.data.disabledUntil) {
        bot.cone.visible = false;
        return;
      }
      bot.cone.visible = true;

      // Patrol movement
      if (bot.data.patrolPoints && bot.data.patrolPoints.length > 1) {
        const targetPt = bot.data.patrolPoints[bot.data.currentPatrolIndex || 0];
        const tVec = new THREE.Vector3(...targetPt);
        const dist = bot.obj.position.distanceTo(tVec);

        if (dist < STEALTH.patrolArriveDist) {
          bot.data.currentPatrolIndex = ((bot.data.currentPatrolIndex || 0) + 1) % bot.data.patrolPoints.length;
        } else {
          const pDir = tVec.clone().sub(bot.obj.position).normalize();
          bot.obj.position.add(pDir.multiplyScalar(STEALTH.patrolSpeed * dt));
          bot.obj.rotation.y = Math.atan2(pDir.x, pDir.z);
        }
      }

      // Detection Check
      const distToPlayer = bot.obj.position.distanceTo(playerTarget);
      const isEffectiveSilent = e.state.isRiding && e.state.isSilentMode;
      const detectDist = isEffectiveSilent ? bot.data.viewDistance * STEALTH.silentDetectMult : bot.data.viewDistance;

      if (distToPlayer < detectDist) {
        const toPlayer = playerTarget.clone().sub(bot.obj.position).normalize();
        const botFacing = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), bot.obj.rotation.y);
        const angle = botFacing.angleTo(toPlayer);

        const inVisionCone = angle < THREE.MathUtils.degToRad(bot.data.viewAngle / 2);
        const isExempt = (bot.data.id.includes('museum') && isDisguisedInMuseum) || (bot.data.id.includes('station') && isDisguisedInStation);

        if (inVisionCone && !isExempt) {
          bot.data.alertLevel = Math.min(1, bot.data.alertLevel + dt * STEALTH.alertRisePerSec);
          (bot.cone.material as THREE.MeshBasicMaterial).color.set('#ef4444');
          (bot.cone.material as THREE.MeshBasicMaterial).opacity = 0.45;

          if (bot.data.alertLevel >= 1 && !e.isEscortingOut) {
            this.triggerEscortOut(bot.data.name);
          }
        } else {
          bot.data.alertLevel = Math.max(0, bot.data.alertLevel - dt * STEALTH.alertDecayPerSec);
          (bot.cone.material as THREE.MeshBasicMaterial).color.set('#38bdf8');
          (bot.cone.material as THREE.MeshBasicMaterial).opacity = 0.15;
        }
      }
    });

    // Update Overall CHAOS Alert level
    const maxBotAlert = Math.max(0, ...e.world.bots.map((b) => b.data.alertLevel));
    e.state.stealthVisibility = Math.round(maxBotAlert * 100);
    e.state.chaosAlertProgress = Math.round(maxBotAlert * 100);
    if (e.state.chaosAlertProgress > STEALTH.chaosProgressThreshold && e.state.chaosAlertLevel < STEALTH.chaosTrippedLevel) {
      e.state.chaosAlertLevel = STEALTH.chaosTrippedLevel;
      e.requestAutosave();
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
      e.world.bots.forEach((b) => (b.data.alertLevel = 0));
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

    // Attract bots toward decoy
    e.world.bots.forEach((b) => {
      b.data.alertLevel = 0;
      b.obj.lookAt(pos);
    });
  }
}
